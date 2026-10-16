import { Router } from 'express';
import { z } from 'zod';
import { User, Notification, Category, Product, Order, CustomRequest, Message, Coupon, AuditLog } from './models.js';
import { ok, AppError, wrap, auth, adminOnly, validate, notify, emitUser, emitAdmin, audit } from './util.js';
import { upload, restoreStock, logStatus, storeFile } from './shopRoutes.js';
import { sendSms, sendSmsEvent, sendAdminSmsEvent, smsStatus, getAdminSmsNumbers, normalizeIndianMobile } from './services/smsService.js';
const r = Router();
r.use(auth, adminOnly);
const smsTestSchema = z.object({ mobile: z.string().min(10).max(16) });
r.get('/notifications/sms-status', wrap(async (_req, res) => ok(res, smsStatus())));
r.post('/notifications/test-sms', validate(smsTestSchema), wrap(async (req, res) => {
  const mobile = normalizeIndianMobile(req.body.mobile);
  if (!mobile || !getAdminSmsNumbers().includes(mobile)) throw new AppError('Choose a valid number configured in ADMIN_SMS_NUMBERS.', 'INVALID_MOBILE', 422);
  if (!process.env.MSG91_TEMPLATE_TEST) throw new AppError('The MSG91 test SMS template is not configured.', 'SMS_TEST_TEMPLATE_MISSING', 503);
  const result = await sendSms({ event: 'TEST', mobile, templateId: process.env.MSG91_TEMPLATE_TEST, variables: {}, eventKey: `sms-test:${req.user._id}:${Date.now()}` });
  if (!result.success) throw new AppError(result.reason === 'not_configured' ? 'MSG91 is not configured.' : 'Test SMS could not be sent.', 'SMS_SEND_FAILED', 502);
  ok(res, {}, 'Test SMS sent.');
}));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5);
const bool = z.preprocess((v) => v === true || v === 'true', z.boolean());

const aiRequestSchema = z.object({ description: z.string().trim().min(5, 'Describe the product in a little more detail.').max(500, 'Product description must be 500 characters or fewer.') });
const aiProductSchema = z.object({
  name: z.string().trim().min(2).max(80), description: z.string().trim().min(2).max(1000),
  category: z.string().trim().min(1).max(80), price: z.number().finite().min(0).max(10000000),
  compareAtPrice: z.number().finite().min(0).max(10000000).nullable(), tags: z.array(z.string().trim().min(1).max(30)).max(12),
  condition: z.string().trim().min(1).max(40), brand: z.string().trim().max(60), stock: z.number().int().min(0).max(1000000),
});
function parseAiJson(content) {
  const clean = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid AI response');
  return JSON.parse(clean.slice(start, end + 1));
}

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
r.get('/orders', wrap(async (req, res) => ok(res, await Order.find(req.query.status ? { status: String(req.query.status) } : {}).sort('-createdAt').limit(100).populate('user', 'name email phone').populate('items.product', 'image images'))));
const ORDER_TRANSITIONS = { PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'REJECTED', 'CANCELLED'], PREPARING: ['READY', 'OUT_FOR_DELIVERY', 'REJECTED', 'CANCELLED'], READY: ['OUT_FOR_DELIVERY', 'DELIVERED'], OUT_FOR_DELIVERY: ['DELIVERED'] };
const TEXT = { CONFIRMED: 'has been accepted', PREPARING: 'is now being prepared', READY: 'is ready', OUT_FOR_DELIVERY: 'is out for delivery', DELIVERED: 'has been delivered', CANCELLED: 'was cancelled', REJECTED: 'was rejected' };
r.patch('/orders/:id/status', validate(z.object({ status: z.enum(Object.keys(TEXT)), reason: z.string().max(200).optional() })), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404);
  const s = req.body.status;
  if (!(ORDER_TRANSITIONS[o.status] || []).includes(s)) throw new AppError(`Cannot change an order from ${o.status} to ${s}.`, 'INVALID_STATUS_TRANSITION', 409);
  if (s === 'REJECTED' && !req.body.reason) throw new AppError('Please give a reason for rejecting.', 'REASON_REQUIRED');
  if (['CANCELLED', 'REJECTED'].includes(s)) await restoreStock(o);
  if (s === 'REJECTED') o.rejectionReason = req.body.reason;
  if (s === 'DELIVERED' && o.payment.method === 'COD') o.payment.status = 'PAID';
  logStatus(o, s); await o.save(); await audit(req, `Order ${o.code} → ${s}`, o._id);
  const type = s === 'CONFIRMED' ? 'ORDER_ACCEPTED' : s === 'REJECTED' ? 'ORDER_REJECTED' : s === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS';
  const smsEvent = s === 'CONFIRMED' ? 'ORDER_ACCEPTED' : s === 'REJECTED' || s === 'CANCELLED' ? 'ORDER_REJECTED' : s === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : s === 'DELIVERED' ? 'ORDER_DELIVERED' : null;
  if (smsEvent) User.findById(o.user).select('name phone').lean().then((customer) => sendSmsEvent(smsEvent, customer?.phone || o.address?.phone, { customer_name: customer?.name || o.address?.name || '', order_id: o.code, amount: o.total, reason: req.body.reason || '' }, `order-status:${o._id}:${s}`)).catch((e) => console.error(`[SMS] ${smsEvent} failed safely:`, e.message));
  try { await notify(o.user, type, '', '', { template:true, orderNumber:o.code, status:TEXT[s], orderId:o._id, ...(req.body.reason&&{reason:req.body.reason}) }); }
  catch (e) { console.error('Order notification persistence failed:', e.message); }
  emitUser(o.user, 'order:updated', o); emitAdmin('order:updated', o); ok(res, o);
}));

// ---------- custom requests ----------
r.get('/custom-orders', wrap(async (req, res) => ok(res, await CustomRequest.find().sort('-createdAt').limit(100).populate('user', 'name phone'))));
r.post('/custom-orders/:id/accept', validate(z.object({ finalPrice: z.number().min(1).max(100000) })), wrap(async (req, res) => {
  const cr = await CustomRequest.findById(req.params.id);
  if (!cr || cr.status !== 'PENDING') throw new AppError('This request is no longer pending.', 'BAD_STATE');
  cr.status = 'ACCEPTED'; cr.finalPrice = Math.round(req.body.finalPrice); await cr.save(); await audit(req, `Accepted custom ${cr.code} at ₹${cr.finalPrice}`, cr._id);
  await notify(cr.user, 'CUSTOM_ACCEPTED', '', '', { template:true, requestId: cr._id });
  emitUser(cr.user, 'custom-order:updated', cr); emitAdmin('custom-order:updated', cr); ok(res, cr);
}));
r.post('/custom-orders/:id/reject', validate(z.object({ reason: z.string().min(3).max(300) })), wrap(async (req, res) => {
  const cr = await CustomRequest.findById(req.params.id);
  if (!cr || cr.status !== 'PENDING') throw new AppError('This request is no longer pending.', 'BAD_STATE');
  cr.status = 'REJECTED'; cr.rejectReason = req.body.reason; await cr.save(); await audit(req, `Rejected custom ${cr.code}`, cr._id);
  await notify(cr.user, 'CUSTOM_REJECTED', '', '', { template:true, requestId: cr._id });
  emitUser(cr.user, 'custom-order:updated', cr); emitAdmin('custom-order:updated', cr); ok(res, cr);
}));

// ---------- products & categories ----------
 r.post('/products/ai-generate', validate(aiRequestSchema), wrap(async (req,res) => {
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new AppError('AI product generation is not configured on this server.','AI_NOT_CONFIGURED',503);
  const categories=await Category.find({active:true}).select('name').sort('order').lean();
  if(!categories.length) throw new AppError('Add a product category before generating product details.','NO_CATEGORIES',422);
  try {
    const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL||'gpt-4o-mini',temperature:0.2,response_format:{type:'json_object'},messages:[
      {role:'system',content:`Create accurate, concise e-commerce product listing details from the user's description. Return only a JSON object with keys name, description, category, price, compareAtPrice, tags, condition, brand, stock. category must exactly match one of these existing categories: ${categories.map(c=>c.name).join(', ')}. Use a reasonable market price in INR only when the description supports estimating it; otherwise price 0. compareAtPrice must be a number or null. stock should default to 1 for used/pre-owned items and 0 when unspecified for other products. Never claim unprovided specifications, condition, warranty, or authenticity. condition should be a short value such as New, Used, or Unspecified; brand can be an empty string when unknown. tags must be an array of short strings.`},
      {role:'user',content:req.body.description}
    ]})});
    if(!response.ok) throw new Error('AI provider request failed');
    const body=await response.json(), content=body?.choices?.[0]?.message?.content;
    const parsed=aiProductSchema.safeParse(parseAiJson(content));
    if(!parsed.success) throw new Error('AI response did not match product fields');
    const category=categories.find(c=>c.name.toLowerCase()===parsed.data.category.toLowerCase());
    if(!category) throw new Error('AI returned an unknown category');
    ok(res,{...parsed.data,category:category.name});
  } catch {
    throw new AppError('Unable to generate product details. Please try again.','AI_GENERATION_FAILED',502);
  }
}));
const prodSchema = z.object({
  name: z.string().min(2).max(80), description: z.string().max(1000).optional(), category: z.string(), emoji: z.string().max(8).optional(), brand: z.string().max(60).optional(), condition: z.string().max(40).optional(),
  price: z.coerce.number().min(0), comparePrice: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  stock: z.coerce.number().int().min(0), unit: z.string().max(20).default('pc'),
  featured: bool, popular: bool, customizable: bool, eggless: bool, active: bool.default(true),
  tags: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v || []), z.array(z.string())), mainImageIndex: z.coerce.number().int().min(0).optional(),
});
async function announcePublishedProduct(p) {
  const cursor = User.find({ role: 'CUSTOMER', active: true, verified: true }).select('_id').lean().cursor();
  let batch = [], failures = 0;
  const sendBatch = async () => {
    const results = await Promise.allSettled(batch.map((c) => notify(c._id, 'NEW_PRODUCT', 'New at Shivam Store', `New at Shivam Store! Check out ${p.name}. Price INR ${p.price}.`, { slug: p.slug, productId: p._id, image: p.image || p.images?.[0], price: p.price, url: `/product/${p.slug}`, dedupeKey: `NEW_PRODUCT:${p._id}` })));
    failures += results.filter((x) => x.status === 'rejected').length; batch = [];
  };
  for await (const c of cursor) { batch.push(c); if (batch.length >= 50) await sendBatch(); }
  if (batch.length) await sendBatch();
  if (failures) console.error(`New product notifications failed for ${failures} customer account(s).`);
}
r.get('/products', wrap(async (req, res) => ok(res, await Product.find().populate('category', 'name').sort('-createdAt').limit(200))));
r.post('/products', upload.fields([{name:'images',maxCount:8},{name:'image',maxCount:1}]), validate(prodSchema), wrap(async (req, res) => {
  const files=[...(req.files?.images||[]),...(req.files?.image||[])]; if(files.length>8) throw new AppError('Upload up to 8 product images.','INVALID_FILE',422);
  const images=(await Promise.all(files.map(storeFile))).filter(Boolean); const main=images[req.body.mainImageIndex||0]||images[0];
  const p = await Product.create({ ...req.body, slug: slug(req.body.name), image: main, images, ...(req.body.active && { notificationPublishedAt: new Date() }) });
  await audit(req, `Added product ${p.name}`, p._id);
  if (p.active) sendAdminSmsEvent('ADMIN_NEW_PRODUCT', { product_name: p.name }, `admin-product:${p._id}`).catch((e) => console.error('[SMS] ADMIN_NEW_PRODUCT failed safely:', e.message));
  if (p.active) await announcePublishedProduct(p).catch((e) => console.error('New product notification batch failed:', e.message));
  emitAdmin('inventory:updated', { id: p._id, stock: p.stock });
  ok(res, p, 'Product added.', 201);
}));
r.put('/products/:id', upload.fields([{name:'images',maxCount:8},{name:'image',maxCount:1}]), validate(prodSchema.partial()), wrap(async (req, res) => {
  const p = await Product.findById(req.params.id); if (!p) throw new AppError('Product not found.', 'NOT_FOUND', 404);
  const wasActive=Boolean(p.active), files=[...(req.files?.images||[]),...(req.files?.image||[])]; Object.assign(p, req.body); if(files.length){p.images=await Promise.all(files.map(storeFile));p.image=p.images[req.body.mainImageIndex||0]||p.images[0];}
  const newlyPublished=Boolean(!wasActive&&p.active&&!p.notificationPublishedAt);if(newlyPublished)p.notificationPublishedAt=new Date();await p.save();
  if(newlyPublished)sendAdminSmsEvent('ADMIN_NEW_PRODUCT',{product_name:p.name},`admin-product:${p._id}`).catch((e)=>console.error('[SMS] ADMIN_NEW_PRODUCT failed safely:',e.message));
  if(newlyPublished)await announcePublishedProduct(p).catch((e)=>console.error('New product notification batch failed:',e.message));
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
