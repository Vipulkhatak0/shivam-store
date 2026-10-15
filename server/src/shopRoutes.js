import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import Razorpay from 'razorpay';
import { v2 as cloudinary } from 'cloudinary';
import { Category, Product, Order, CustomRequest, Notification, Message, Coupon, DeliverySlot, User } from './models.js';
import { ok, AppError, wrap, auth, validate, notify, notifyAdmins, emitUser, emitAdmin } from './util.js';

export const upload = multer({
  storage: multer.diskStorage({ destination: 'uploads', filename: (q, f, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 5e6 },
  fileFilter: (q, f, cb) => (/^image\/(png|jpe?g|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new AppError('Only PNG, JPG or WebP images are allowed.', 'INVALID_FILE', 422))),
});
export async function storeFile(f) {
  if (!f) return undefined;
  const bytes=fs.readFileSync(f.path), ext=path.extname(f.originalname).toLowerCase();
  const valid=(ext==='.png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(['.jpg','.jpeg'].includes(ext)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(ext==='.webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
  if(!valid){fs.unlink(f.path,()=>{});throw new AppError('Unsupported image format.','INVALID_FILE',422);}
  const { CLOUDINARY_CLOUD_NAME: c, CLOUDINARY_API_KEY: k, CLOUDINARY_API_SECRET: s } = process.env;
  if (c && k && s) {
    cloudinary.config({ cloud_name: c, api_key: k, api_secret: s });
    const up = await cloudinary.uploader.upload(f.path, { folder: 'shivam-store' }); fs.unlink(f.path, () => {}); return up.secure_url;
  }
  return '/uploads/' + f.filename;
}
const r = Router();
const num = (k, d) => Number(process.env[k] ?? d);
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const addr = z.object({
  name: z.string().min(2), phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().min(3), area: z.string().min(2), city: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'), landmark: z.string().optional(),
});

// ---------- catalog ----------
r.get('/categories', wrap(async (q, res) => {
  const cats = await Category.find({ active: true }).sort('order').lean();
  const counts = await Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const m = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  ok(res, cats.map((c) => ({ ...c, productCount: m[String(c._id)] || 0 })));
}));

r.get('/products', wrap(async (req, res) => {
  const { q, category, sort = 'popular', eggless, customizable, featured, minPrice, maxPrice } = req.query;
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(48, +req.query.limit || 12);
  const f = { active: true };
  if (q) f.$or = [{ name: rx(q) }, { tags: rx(q) }];
  if (category) { const c = await Category.findOne({ slug: String(category) }); f.category = c?._id; }
  if (eggless === 'true') f.eggless = true;
  if (customizable === 'true') f.customizable = true;
  if (featured === 'true') f.featured = true;
  if (minPrice || maxPrice) f.price = { ...(minPrice && { $gte: +minPrice }), ...(maxPrice && { $lte: +maxPrice }) };
  const S = { popular: { popular: -1, reviewCount: -1 }, low: { price: 1 }, high: { price: -1 }, new: { createdAt: -1 }, rating: { reviewCount: -1, rating: -1 } };
  const [items, total] = await Promise.all([
    Product.find(f).populate('category', 'name slug').sort(S[sort] || S.popular).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(f)]);
  ok(res, { items, total, page, pages: Math.ceil(total / limit) });
}));
r.get('/products/:id/recommendations', wrap(async (req,res)=>{
  const id=String(req.params.id);
  if(!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid product ID.','VALIDATION_ERROR',422);
  const current=await Product.findOne({_id:id,active:true}).select('category price tags name').lean();
  if(!current) throw new AppError('Product not found.','NOT_FOUND',404);
  const imageFilter={name:{$type:'string',$ne:''},price:{$type:'number',$gte:0},stock:{$gt:0},$or:[{image:{$type:'string',$ne:''}},{images:{$elemMatch:{$type:'string',$ne:''}}}]};
  const fields='_id name slug price comparePrice image images emoji stock rating reviewCount customizable category tags popular featured';
  const same=current.category?await Product.find({...imageFilter,active:true,category:current.category,_id:{$ne:current._id}}).select(fields).limit(48).lean():[];
  const terms=new Set([...(current.tags||[]),...(current.name||'').toLowerCase().split(/[^a-z0-9]+/)].map(x=>String(x).toLowerCase().trim()).filter(x=>x.length>2));
  const keywordScore=(p)=>{const cand=new Set([...(p.tags||[]),...(p.name||'').toLowerCase().split(/[^a-z0-9]+/)].map(x=>String(x).toLowerCase().trim()));let n=0;for(const t of terms)if(cand.has(t))n++;return n;};
  const priceGap=(p)=>Math.abs(Number(p.price)-Number(current.price))/Math.max(1,Number(current.price));
  same.sort((a,b)=>priceGap(a)-priceGap(b)||keywordScore(b)-keywordScore(a)||Number(b.popular||b.featured)-Number(a.popular||a.featured));
  const out=same.slice(0,6), seen=new Set([id,...out.map(p=>String(p._id))]);
  if(out.length<6){const fallback=await Product.find({...imageFilter,active:true,_id:{$nin:[...seen]}}).select(fields).sort({popular:-1,featured:-1,reviewCount:-1,rating:-1}).limit(18).lean();for(const p of fallback){const key=String(p._id);if(!seen.has(key)){seen.add(key);out.push(p);if(out.length===6)break;}}}
  ok(res,{items:out});
}));
r.get('/products/:slug', wrap(async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug, active: true }).populate('category', 'name slug');
  if (!p) throw new AppError('Product not found.', 'NOT_FOUND', 404); ok(res, p);
}));

// ---------- pricing (server is the only source of truth) ----------
async function priceLines(items) {
  const lines = []; let subtotal = 0;
  for (const it of items) {
    const p = await Product.findOne({ _id: it.product, active: true });
    if (!p) throw new AppError('An item in your cart is no longer available.', 'PRODUCT_UNAVAILABLE');
    if (p.stock < it.qty) throw new AppError(`${p.name}: only ${p.stock} left in stock.`, 'OUT_OF_STOCK');
    lines.push({ product: p._id, name: p.name, price: p.price, qty: it.qty }); subtotal += p.price * it.qty;
  }
  return { lines, subtotal };
}
async function totals(subtotal, code) {
  if (subtotal < num('MIN_ORDER', 0)) throw new AppError(`Minimum order is ₹${num('MIN_ORDER', 0)}.`, 'MIN_ORDER');
  const deliveryFee = subtotal >= num('FREE_DELIVERY_ABOVE', 499) ? 0 : num('DELIVERY_FEE', 40);
  let discount = 0, coupon;
  if (code) {
    const c = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!c) throw new AppError('This coupon is not valid.', 'COUPON_INVALID');
    if (c.expiresAt && c.expiresAt < new Date()) throw new AppError('This coupon has expired.', 'COUPON_EXPIRED');
    if (c.usageLimit && c.used >= c.usageLimit) throw new AppError('This coupon has been fully used.', 'COUPON_USED');
    if (subtotal < c.minOrder) throw new AppError(`Add items worth ₹${c.minOrder} to use this coupon.`, 'COUPON_MIN');
    discount = c.type === 'PERCENT' ? Math.min(subtotal * c.amount / 100, c.maxDiscount || Infinity) : c.amount;
    discount = Math.min(Math.round(discount), subtotal); coupon = c.code;
  }
  return { deliveryFee, discount, coupon, total: subtotal + deliveryFee - discount };
}
const itemsSchema = z.array(z.object({ product: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product in cart.'), qty: z.number().int().min(1).max(20) })).min(1);
r.post('/cart/validate', validate(z.object({ items: itemsSchema })), wrap(async (req, res) => {
  const ids = req.body.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids } }).select('_id name price stock active image images emoji').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  ok(res, req.body.items.map((i) => {
    const p = byId.get(i.product);
    return p ? { id: i.product, name: p.name, price: p.price, stock: p.stock, active: p.active, available: p.active && p.stock >= i.qty, image: p.image || p.images?.[0] || '', emoji: p.emoji } : { id: i.product, name: 'Unavailable item', available: false, missing: true };
  }));
}));
r.post('/coupons/validate', validate(z.object({ items: itemsSchema, coupon: z.string().optional() })), wrap(async (req, res) => {
  const { subtotal } = await priceLines(req.body.items); ok(res, { subtotal, ...(await totals(subtotal, req.body.coupon)) });
}));

// ---------- orders & payment ----------
const rzp = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new AppError('Online payments are not configured on this server.', 'PAYMENT_NOT_CONFIGURED', 503);
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};
const testPay = () => process.env.TEST_PAYMENT === 'true' && process.env.NODE_ENV !== 'production';
const log = (o, s) => { o.status = s; o.history.push({ status: s }); };

async function startPayment(order) {
  if (order.payment.method !== 'ONLINE') return null;
  if (testPay()) { order.payment.test = true; await order.save(); return { test: true, label: 'TEST MODE: no real payment is taken' }; }
  const rz = await rzp().orders.create({ amount: Math.round(order.total * 100), currency: 'INR', receipt: order.code });
  order.payment.razorpayOrderId = rz.id; order.payment.amount = order.total; await order.save();
  return { razorpayOrderId: rz.id, keyId: process.env.RAZORPAY_KEY_ID, amount: rz.amount };
}
async function announce(order, paid) {
  if (order.customRequest) {
    try { const cr = await CustomRequest.findById(order.customRequest); if (cr && (paid || order.payment.method === 'COD')) { cr.status = 'PAID'; await cr.save(); emitAdmin('custom-order:updated', cr); } }
    catch (e) { console.error('Custom order notification update failed:', e.message); }
  }
  const customerName=order.address?.name||'A customer';
  const tasks=[
    notifyAdmins('ORDER_PLACED', '', '', { template:true, orderNumber:order.code, customerName, total:order.total, orderId: order._id }, 'order:created', order),
    notify(order.user, paid ? 'PAYMENT_SUCCESS' : 'ORDER_PLACED', '', '', { template:true, orderNumber:order.code, total:order.total, orderId: order._id }),
  ];
  if(paid)tasks.push(notifyAdmins('PAYMENT_SUCCESS','','',{template:true,orderNumber:order.code,customerName,total:order.total,orderId:order._id}));
  const results=await Promise.allSettled(tasks);for(const r of results)if(r.status==='rejected')console.error('Order notification delivery failed:',r.reason?.message||'database or transport error');
}
async function createOrder({ user, lines, subtotal, deliveryFee, discount, coupon, total, address, deliveryDate, deliverySlot, note, method, customRequest, idempotencyKey }) {
  const taken = [];
  try {
    for (const l of lines.filter((x) => x.product)) {
      const p = await Product.findOneAndUpdate({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } }, { new: true });
      if (!p) throw new AppError(`${l.name} just went out of stock.`, 'OUT_OF_STOCK');
      taken.push(l);
      emitAdmin('inventory:updated', { id: p._id, stock: p.stock });
      if (p.stock <= num('LOW_STOCK', 5)) notifyAdmins('LOW_STOCK', 'Low stock', `${p.name} has only ${p.stock} left.`, { productId: p._id });
    }
    if (coupon) await Coupon.updateOne({ code: coupon }, { $inc: { used: 1 } });
    const code = 'SHV' + (1000 + (await Order.countDocuments()) + Math.floor(Math.random() * 9));
    const o = await Order.create({ code, idempotencyKey, user, items: lines, subtotal, deliveryFee, discount, total, coupon, address, deliveryDate, deliverySlot, note, customRequest,
      status: customRequest && method === 'COD' ? 'CONFIRMED' : 'PENDING', payment: { method, amount: total }, history: [{ status: 'PENDING' }] });
    return o;
  } catch (e) { for (const l of taken) await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } }); throw e; }
}
async function restoreStock(o) {
  if (o.stockRestored) return;
  for (const l of o.items) if (l.product) await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } });
  o.stockRestored = true;
}
export { restoreStock, log as logStatus };

r.post('/orders', auth, validate(z.object({
  items: itemsSchema, coupon: z.string().optional(), method: z.enum(['COD', 'ONLINE']), address: addr,
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), deliverySlot: z.string().min(2), note: z.string().max(300).optional(), idempotencyKey: z.string().uuid(),
})), wrap(async (req, res) => {
  const b = req.body;
  const paymentDetails = (order) => order.payment.method !== 'ONLINE' ? null : testPay()
    ? { test: true, label: 'TEST MODE: no real payment is taken' }
    : { razorpayOrderId: order.payment.razorpayOrderId, keyId: process.env.RAZORPAY_KEY_ID, amount: Math.round(order.total * 100) };
  const existing = await Order.findOne({ user: req.user._id, idempotencyKey: b.idempotencyKey });
  if (existing) return ok(res, { order: existing, payment: paymentDetails(existing) }, 'Order already created.');
  if (new Date(b.deliveryDate + 'T23:59:59') < new Date()) throw new AppError('Choose today or a future delivery date.', 'BAD_DATE');
  if (b.deliverySlot !== 'ASAP' && !(await DeliverySlot.exists({ label: b.deliverySlot, active: true }))) throw new AppError('Choose an available delivery slot.', 'BAD_SLOT');
  const { lines, subtotal } = await priceLines(b.items); const t = await totals(subtotal, b.coupon);
  const order = await createOrder({ user: req.user._id, lines, subtotal, ...t, address: b.address, deliveryDate: b.deliveryDate, deliverySlot: b.deliverySlot, note: b.note, method: b.method, idempotencyKey: b.idempotencyKey });
  let payment = null;
  try { payment = await startPayment(order); } catch (e) { await restoreStock(order); if (order.coupon) await Coupon.updateOne({ code: order.coupon, used: { $gt: 0 } }, { $inc: { used: -1 } }); await order.deleteOne(); throw e; }
  if (b.method === 'COD') {
    try { await announce(order, false); } catch (e) { console.error('Order notification delivery failed:', e); }
  }
  ok(res, { order, payment }, 'Order created.', 201);
}));
r.post('/orders/:id/verify', auth, wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404);
  if (o.payment.status === 'PAID') return ok(res, o);
  if (o.payment.method !== 'ONLINE') throw new AppError('This order is not an online-payment order.', 'BAD_REQUEST');
  if (o.payment.test) { if (!testPay()) throw new AppError('Test payments are disabled.', 'PAYMENT_NOT_CONFIGURED', 503); o.payment.paymentId = 'TEST-' + Date.now(); }
  else {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!process.env.RAZORPAY_KEY_SECRET || razorpay_order_id !== o.payment.razorpayOrderId) throw new AppError('Payment could not be verified.', 'PAYMENT_FAILED');
    const exp = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(exp), b = Buffer.from(String(razorpay_signature || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new AppError('Payment could not be verified.', 'PAYMENT_FAILED', 400);
    o.payment.paymentId = razorpay_payment_id; o.payment.signature = razorpay_signature;
  }
  o.payment.status = 'PAID'; log(o, 'CONFIRMED'); await o.save(); await announce(o, true); ok(res, o, 'Payment successful.');
}));
r.get('/orders', auth, wrap(async (req, res) => ok(res, await Order.find({ user: req.user._id, $or: [{ 'payment.method': 'COD' }, { 'payment.status': 'PAID' }, { status: { $ne: 'CANCELLED' } }] }).sort('-createdAt').limit(50))));
r.get('/orders/:id', auth, wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404); ok(res, o);
}));
r.post('/orders/:id/cancel', auth, wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404);
  if (!['PENDING', 'CONFIRMED'].includes(o.status)) throw new AppError('This order can no longer be cancelled.', 'NOT_CANCELLABLE');
  await restoreStock(o); log(o, 'CANCELLED'); await o.save();
  await notifyAdmins('ORDER_CANCELLED', '', '', { template:true, orderNumber:o.code, orderId: o._id }, 'order:updated', o); ok(res, o);
}));

// ---------- custom cakes ----------
// product.price is the 1 KG price; larger/smaller cakes use these multipliers (2 KG chocolate = ₹898).
const MULT = { 0.5: 0.6, 1: 1, 1.5: 1.4, 2: 1.8, 3: 2.6 };
export const baseFor = (p, kg) => Math.round(p.price * MULT[kg]);
export const estimate = (p, c) => baseFor(p, c.kg) + (c.toppings?.length || 0) * 40 + (c.shape === 'Heart' ? 100 : 0);
const safeJson = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
const customSchema = z.object({
  productId: z.string(), kg: z.coerce.number().refine((v) => [0.5, 1, 1.5, 2, 3].includes(v), 'Pick a valid size'),
  flavor: z.string().max(30).default('Chocolate'), shape: z.enum(['Round', 'Heart', 'Square']).default('Round'),
  cream: z.string().max(30).default('Whipped Cream'), theme: z.string().max(30).default('Birthday'),
  eggless: z.preprocess((v) => v === true || v === 'true', z.boolean()),
  message: z.string().max(60).default(''), notes: z.string().max(400).default(''),
  toppings: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []), z.array(z.string().max(30)).max(6)),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), deliveryTime: z.string().min(2),
  address: z.preprocess(safeJson, addr),
});
const customProduct = async (id) => {
  const p = await Product.findOne({ _id: id, active: true, customizable: true });
  if (!p) throw new AppError('This product cannot be customized.', 'NOT_CUSTOMIZABLE'); return p;
};
r.post('/custom-orders/estimate', validate(customSchema.partial({ deliveryDate: true, deliveryTime: true, address: true })), wrap(async (req, res) => {
  const p = await customProduct(req.body.productId);
  const base = baseFor(p, req.body.kg), extras = estimate(p, req.body) - base;
  ok(res, { base, extras, deliveryFee: 0, discount: 0, total: estimate(p, req.body) });
}));
r.post('/custom-orders', auth, upload.single('photo'), validate(customSchema), wrap(async (req, res) => {
  const b = req.body, p = await customProduct(b.productId); const photo = await storeFile(req.file);
  if (new Date(b.deliveryDate + 'T23:59:59') < new Date()) throw new AppError('Choose today or a future delivery date.', 'BAD_DATE');
  const cr = await CustomRequest.create({
    code: 'CC' + Date.now().toString().slice(-6), user: req.user._id, product: p._id, productName: p.name,
    customization: { kg: b.kg, flavor: b.flavor, shape: b.shape, cream: b.cream, theme: b.theme, eggless: b.eggless, message: b.message, notes: b.notes, toppings: b.toppings, photo },
    deliveryDate: b.deliveryDate, deliveryTime: b.deliveryTime, address: b.address, estimatedPrice: estimate(p, b),
  });
  const payload = { ...cr.toObject(), customer: { _id: req.user._id, name: req.user.name } };
  await notifyAdmins('CUSTOM_REQUEST', '', '', { template:true, customerName:req.user.name, requestId: cr._id }, 'custom-order:new', payload);
  await notify(req.user._id, 'CUSTOM_REQUEST', '', '', { template:true, requestId: cr._id });
  ok(res, cr, 'Custom cake request sent.', 201);
}));
r.get('/custom-orders', auth, wrap(async (req, res) => ok(res, await CustomRequest.find({ user: req.user._id }).sort('-createdAt'))));
r.post('/custom-orders/:id/pay', auth, validate(z.object({ method: z.enum(['COD', 'ONLINE']) })), wrap(async (req, res) => {
  const cr = await CustomRequest.findOne({ _id: req.params.id, user: req.user._id });
  if (!cr) throw new AppError('Request not found.', 'NOT_FOUND', 404);
  if (cr.status !== 'ACCEPTED' || cr.order) throw new AppError('This request is not ready for payment.', 'BAD_STATE');
  const line = { name: `Custom ${cr.productName} ${cr.customization.kg} KG${cr.customization.eggless ? ' (eggless)' : ''} - “${cr.customization.message}”`, price: cr.finalPrice, qty: 1 };
  const order = await createOrder({ user: req.user._id, lines: [line], subtotal: cr.finalPrice, deliveryFee: 0, discount: 0, total: cr.finalPrice,
    address: cr.address, deliveryDate: cr.deliveryDate, deliverySlot: cr.deliveryTime, note: cr.customization.notes, method: req.body.method, customRequest: cr._id });
  cr.order = order._id; await cr.save();
  let payment = null;
  try { payment = await startPayment(order); } catch (e) { cr.order = undefined; await cr.save(); log(order, 'CANCELLED'); await order.save(); throw e; }
  if (req.body.method === 'COD') await announce(order, false);
  ok(res, { order, payment }, 'Order created.', 201);
}));

// ---------- notifications & chat ----------
r.get('/notifications', auth, wrap(async (req, res) => ok(res, {
  items: await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30),
  unread: await Notification.countDocuments({ user: req.user._id, read: false }),
})));
r.post('/notifications/read', auth, wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, ...(req.body?.id && { _id: req.body.id }) }, { read: true }); ok(res);
}));
r.get('/chat', auth, wrap(async (req, res) => {
  await Message.updateMany({ customer: req.user._id, senderRole: 'ADMIN' }, { read: true });
  ok(res, await Message.find({ customer: req.user._id }).sort('createdAt').limit(200));
}));
r.post('/chat', auth, upload.single('file'), validate(z.object({ text: z.string().max(1000).default('') })), wrap(async (req, res) => {
  const att = req.file ? [await storeFile(req.file)] : [], text = req.body.text.trim();
  if (!text && !att.length) throw new AppError('Write a message or attach a photo.', 'VALIDATION_ERROR', 422);
  const m = await Message.create({ customer: req.user._id, sender: req.user._id, senderRole: 'CUSTOMER', text, attachments: att });
  emitAdmin('chat:message', { ...m.toObject(), customerName: req.user.name });
  await notifyAdmins('NEW_MESSAGE', 'New message', `${req.user.name}: ${(text || 'Photo attachment').slice(0, 80)}`, { customerId: req.user._id });
  ok(res, m, 'Message sent.', 201);
}));
export { emitUser };
export default r;
