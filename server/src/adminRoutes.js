import { Router } from 'express';
import { z } from 'zod';
import { User, Notification, Category, Product, Order, CustomRequest, Message, Coupon, AuditLog } from './models.js';
import { ok, AppError, wrap, auth, adminOnly, validate, notify, emitUser, emitAdmin, audit } from './util.js';
import { upload, restoreStock, logStatus, storeFile } from './shopRoutes.js';
const r = Router();
r.use(auth, adminOnly);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5);
const bool = z.preprocess((v) => v === true || v === 'true', z.boolean());

// ---------- dashboard ----------
r.get('/dashboard', wrap(async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const paid = { $or: [{ 'payment.status': 'PAID' }, { status: 'DELIVERED' }] };
  const [todayOrders, pending, delivered, rev, customers, products, lowStock, customPending, recent] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: today } }), Order.countDocuments({ status: 'PENDING' }), Order.countDocuments({ status: 'DELIVERED' }),
    Order.aggregate([{ $match: { ...paid, status: { $nin: ['CANCELLED', 'REJECTED'] } } }, { $group: { _id: null, t: { $sum: '$total' } } }]),
    User.countDocuments({ role: 'CUSTOMER' }), Product.countDocuments({ active: true }),
    Product.countDocuments({ active: true, stock: { $lte: Number(process.env.LOW_STOCK || 5) } }), CustomRequest.countDocuments({ status: 'PENDING' }),
    Order.find().sort('-createdAt').limit(8).populate('user', 'name')]);
  const tz = process.env.STORE_TZ || 'Asia/Kolkata';
  const raw = await Order.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 8 * 864e5) }, status: { $nin: ['CANCELLED', 'REJECTED'] } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }, total: { $sum: '$total' }, orders: { $sum: 1 } } }]);
  const byDay = Object.fromEntries(raw.map((x) => [x._id, x])), sales = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5), k = d.toLocaleDateString('en-CA', { timeZone: tz });
    sales.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: tz }), total: byDay[k]?.total || 0, orders: byDay[k]?.orders || 0 });
  }
  ok(res, { totalOrders: await Order.countDocuments(), todayOrders, pending, delivered, revenue: rev[0]?.t || 0, customers, products, lowStock, customPending, recent, sales });
}));

// ---------- orders ----------
r.get('/orders', wrap(async (req, res) => ok(res, await Order.find(req.query.status ? { status: String(req.query.status) } : {}).sort('-createdAt').limit(100).populate('user', 'name email phone'))));
const TEXT = { CONFIRMED: 'has been accepted', PREPARING: 'is now being prepared', READY: 'is ready', OUT_FOR_DELIVERY: 'is out for delivery', DELIVERED: 'has been delivered', CANCELLED: 'was cancelled', REJECTED: 'was rejected' };
r.patch('/orders/:id/status', validate(z.object({ status: z.enum(Object.keys(TEXT)), reason: z.string().max(200).optional() })), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404);
  if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)) throw new AppError('This order is already closed.', 'ORDER_CLOSED');
  const s = req.body.status;
  if (s === 'REJECTED' && !req.body.reason) throw new AppError('Please give a reason for rejecting.', 'REASON_REQUIRED');
  if (['CANCELLED', 'REJECTED'].includes(s)) await restoreStock(o);
  if (s === 'DELIVERED' && o.payment.method === 'COD') o.payment.status = 'PAID';
  logStatus(o, s); await o.save(); await audit(req, `Order ${o.code} → ${s}`, o._id);
  const type = s === 'CONFIRMED' ? 'ORDER_ACCEPTED' : s === 'REJECTED' ? 'ORDER_REJECTED' : 'ORDER_STATUS';
  await notify(o.user, type, `Order ${s.replace(/_/g, ' ').toLowerCase()}`, `Your Shivam Store order #${o.code} ${TEXT[s]}.${req.body.reason ? ' Reason: ' + req.body.reason : ''}`, { orderId: o._id });
  emitUser(o.user, 'order:updated', o); emitAdmin('order:updated', o); ok(res, o);
}));

// ---------- custom requests ----------
r.get('/custom-orders', wrap(async (req, res) => ok(res, await CustomRequest.find().sort('-createdAt').limit(100).populate('user', 'name phone'))));
r.post('/custom-orders/:id/accept', validate(z.object({ finalPrice: z.number().min(1).max(100000) })), wrap(async (req, res) => {
  const cr = await CustomRequest.findById(req.params.id);
  if (!cr || cr.status !== 'PENDING') throw new AppError('This request is no longer pending.', 'BAD_STATE');
  cr.status = 'ACCEPTED'; cr.finalPrice = Math.round(req.body.finalPrice); await cr.save(); await audit(req, `Accepted custom ${cr.code} at ₹${cr.finalPrice}`, cr._id);
  await notify(cr.user, 'CUSTOM_ACCEPTED', 'Your custom cake request has been accepted.', `Final price: ₹${cr.finalPrice}. Delivery: ${cr.deliveryTime}. Open My Orders to confirm and pay.`, { requestId: cr._id });
  emitUser(cr.user, 'custom-order:updated', cr); emitAdmin('custom-order:updated', cr); ok(res, cr);
}));
r.post('/custom-orders/:id/reject', validate(z.object({ reason: z.string().min(3).max(300) })), wrap(async (req, res) => {
  const cr = await CustomRequest.findById(req.params.id);
  if (!cr || cr.status !== 'PENDING') throw new AppError('This request is no longer pending.', 'BAD_STATE');
  cr.status = 'REJECTED'; cr.rejectReason = req.body.reason; await cr.save(); await audit(req, `Rejected custom ${cr.code}`, cr._id);
  await notify(cr.user, 'CUSTOM_REJECTED', 'Custom cake request declined', `Sorry: ${req.body.reason}`, { requestId: cr._id });
  emitUser(cr.user, 'custom-order:updated', cr); emitAdmin('custom-order:updated', cr); ok(res, cr);
}));

// ---------- products & categories ----------
const prodSchema = z.object({
  name: z.string().min(2).max(80), description: z.string().max(1000).optional(), category: z.string(), emoji: z.string().max(8).optional(),
  price: z.coerce.number().min(0), comparePrice: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  stock: z.coerce.number().int().min(0), unit: z.string().max(20).default('pc'),
  featured: bool, popular: bool, customizable: bool, eggless: bool, active: bool.default(true),
  tags: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v || []), z.array(z.string())),
});
r.get('/products', wrap(async (req, res) => ok(res, await Product.find().populate('category', 'name').sort('-createdAt').limit(200))));
r.post('/products', upload.single('image'), validate(prodSchema), wrap(async (req, res) => {
  const p = await Product.create({ ...req.body, slug: slug(req.body.name), image: await storeFile(req.file) });
  await audit(req, `Added product ${p.name}`, p._id);
  // Notify every active customer in real time (and keep it in their notification history).
  const customers = await User.find({ role: 'CUSTOMER', active: true, verified: true }).select('_id');
  const docs = await Notification.insertMany(customers.map((c) => ({ user: c._id, type: 'PROMOTION', title: 'New at Shivam Store', message: `${p.name} is now available for ₹${p.price}.`, data: { slug: p.slug } })));
  docs.forEach((n) => emitUser(n.user, 'notification:new', n));
  emitAdmin('inventory:updated', { id: p._id, stock: p.stock });
  ok(res, p, 'Product added.', 201);
}));
r.put('/products/:id', upload.single('image'), validate(prodSchema.partial()), wrap(async (req, res) => {
  const p = await Product.findById(req.params.id); if (!p) throw new AppError('Product not found.', 'NOT_FOUND', 404);
  Object.assign(p, req.body); if (req.file) p.image = await storeFile(req.file); await p.save();
  await audit(req, `Edited product ${p.name} (₹${p.price}, stock ${p.stock})`, p._id); emitAdmin('inventory:updated', { id: p._id, stock: p.stock }); ok(res, p);
}));
r.delete('/products/:id', wrap(async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!p) throw new AppError('Product not found.', 'NOT_FOUND', 404); await audit(req, `Deactivated product ${p.name}`, p._id); ok(res, p, 'Product deactivated.');
}));
const catSchema = z.object({ name: z.string().min(2).max(40), emoji: z.string().max(8).optional(), order: z.coerce.number().default(0), active: bool.default(true) });
r.get('/categories', wrap(async (req, res) => ok(res, await Category.find().sort('order'))));
r.post('/categories', validate(catSchema), wrap(async (req, res) => ok(res, await Category.create({ ...req.body, slug: slug(req.body.name) }), 'Category added.', 201)));
r.put('/categories/:id', validate(catSchema.partial()), wrap(async (req, res) => ok(res, await Category.findByIdAndUpdate(req.params.id, req.body, { new: true }))));

// ---------- customers, coupons ----------
r.get('/customers', wrap(async (req, res) => {
  const users = await User.find({ role: 'CUSTOMER' }).sort('-createdAt').limit(200).lean();
  const agg = await Order.aggregate([{ $match: { status: { $nin: ['CANCELLED', 'REJECTED'] } } }, { $group: { _id: '$user', n: { $sum: 1 }, spent: { $sum: '$total' }, last: { $max: '$createdAt' } } }]);
  const m = Object.fromEntries(agg.map((a) => [String(a._id), a]));
  ok(res, users.map((u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, active: u.active, orders: m[u._id]?.n || 0, spent: m[u._id]?.spent || 0, last: m[u._id]?.last })));
}));
r.patch('/customers/:id', validate(z.object({ active: z.boolean() })), wrap(async (req, res) => {
  const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'CUSTOMER' }, { active: req.body.active }, { new: true });
  if (!u) throw new AppError('Customer not found.', 'NOT_FOUND', 404); await audit(req, `${u.active ? 'Enabled' : 'Disabled'} account ${u.email}`, u._id); ok(res, u);
}));
r.get('/coupons', wrap(async (req, res) => ok(res, await Coupon.find().sort('-_id'))));
r.post('/coupons', validate(z.object({ code: z.string().min(3).max(20), type: z.enum(['PERCENT', 'FLAT']), amount: z.number().min(1), minOrder: z.number().min(0).default(0), maxDiscount: z.number().min(0).optional(), expiresAt: z.string().optional(), usageLimit: z.number().int().min(1).optional() })),
  wrap(async (req, res) => { const c = await Coupon.create(req.body); await audit(req, `Created coupon ${c.code}`, c._id); ok(res, c, 'Coupon created.', 201); }));
r.patch('/coupons/:id', validate(z.object({ active: z.boolean() })), wrap(async (req, res) => ok(res, await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
r.get('/audit', wrap(async (req, res) => ok(res, await AuditLog.find().sort('-createdAt').limit(100).populate('admin', 'name'))));

// ---------- chat ----------
r.get('/chat', wrap(async (req, res) => {
  const agg = await Message.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$customer', last: { $first: '$text' }, at: { $first: '$createdAt' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$senderRole', 'CUSTOMER'] }, { $eq: ['$read', false] }] }, 1, 0] } } } }, { $sort: { at: -1 } }]);
  const users = await User.find({ _id: { $in: agg.map((a) => a._id) } }).select('name'); const m = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
  ok(res, agg.map((a) => ({ customer: a._id, name: m[String(a._id)] || 'Customer', last: a.last, at: a.at, unread: a.unread })));
}));
r.get('/chat/:uid', wrap(async (req, res) => {
  await Message.updateMany({ customer: req.params.uid, senderRole: 'CUSTOMER' }, { read: true });
  ok(res, await Message.find({ customer: req.params.uid }).sort('createdAt').limit(200));
}));
r.post('/chat/:uid', upload.single('file'), validate(z.object({ text: z.string().max(1000).default('') })), wrap(async (req, res) => {
  const att = req.file ? [await storeFile(req.file)] : [], text = req.body.text.trim();
  if (!text && !att.length) throw new AppError('Write a message or attach a photo.', 'VALIDATION_ERROR', 422);
  const m = await Message.create({ customer: req.params.uid, sender: req.user._id, senderRole: 'ADMIN', text, attachments: att });
  emitUser(req.params.uid, 'chat:message', m);
  await notify(req.params.uid, 'NEW_MESSAGE', 'New message from Shivam Store', (text || 'Photo attachment').slice(0, 100), {});
  ok(res, m, 'Message sent.', 201);
}));
export default r;
