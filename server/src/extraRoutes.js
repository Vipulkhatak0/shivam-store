import { Router } from 'express';
import { z } from 'zod';
import { User, Product, Order, Review, Banner, DeliverySlot } from './models.js';
import { ok, AppError, wrap, auth, validate } from './util.js';
const r = Router();

// ---------- wishlist ----------
r.get('/wishlist', auth, wrap(async (req, res) => {
  const u = await User.findById(req.user._id).populate({ path: 'wishlist', match: { active: true }, populate: { path: 'category', select: 'name slug' } });
  ok(res, u.wishlist);
}));
r.post('/wishlist/:productId', auth, wrap(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId, active: true }))) throw new AppError('Product not found.', 'NOT_FOUND', 404);
  const has = req.user.wishlist.some((i) => String(i) === req.params.productId);
  await User.updateOne({ _id: req.user._id }, has ? { $pull: { wishlist: req.params.productId } } : { $addToSet: { wishlist: req.params.productId } });
  const u = await User.findById(req.user._id).select('wishlist');
  ok(res, { ids: u.wishlist.map(String), added: !has }, has ? 'Removed from wishlist' : 'Added to wishlist');
}));
r.get('/wishlist/ids', auth, wrap(async (req, res) => ok(res, { ids: req.user.wishlist.map(String) })));

// ---------- addresses ----------
const addr = z.object({
  label: z.enum(['Home', 'Hostel', 'Work', 'Other']).default('Home'),
  name: z.string().min(2), phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().min(3), area: z.string().min(2), city: z.string().min(2), pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'), landmark: z.string().optional(),
});
r.get('/addresses', auth, (req, res) => ok(res, req.user.addresses));
r.post('/addresses', auth, validate(addr), wrap(async (req, res) => {
  if (req.user.addresses.length >= 10) throw new AppError('You can save up to 10 addresses.', 'LIMIT');
  req.user.addresses.push(req.body); await req.user.save(); ok(res, req.user.addresses, 'Address saved.', 201);
}));
r.delete('/addresses/:id', auth, wrap(async (req, res) => {
  req.user.addresses.pull({ _id: req.params.id }); await req.user.save(); ok(res, req.user.addresses, 'Address removed.');
}));

// ---------- reviews (only customers whose order containing the product was delivered) ----------
r.get('/products/:id/reviews', wrap(async (req, res) => ok(res, await Review.find({ product: req.params.id }).sort('-createdAt').limit(50))));
r.post('/products/:id/reviews', auth, validate(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(500).default('') })), wrap(async (req, res) => {
  const bought = await Order.exists({ user: req.user._id, status: 'DELIVERED', 'items.product': req.params.id });
  if (!bought) throw new AppError('You can review a product after it has been delivered to you.', 'NOT_PURCHASED', 403);
  try { await Review.create({ product: req.params.id, user: req.user._id, name: req.user.name, ...req.body }); }
  catch (e) { if (e.code === 11000) throw new AppError('You have already reviewed this product.', 'DUPLICATE', 409); throw e; }
  const [a] = await Review.aggregate([{ $match: { product: (await Product.findById(req.params.id))._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Product.updateOne({ _id: req.params.id }, { rating: Math.round(a.avg * 10) / 10, reviewCount: a.n });
  ok(res, {}, 'Thanks for your review!', 201);
}));

// ---------- reorder: current, in-stock versions of a past order's products ----------
r.get('/orders/:id/reorder', auth, wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!o) throw new AppError('Order not found.', 'NOT_FOUND', 404);
  const ps = await Product.find({ _id: { $in: o.items.filter((i) => i.product).map((i) => i.product) }, active: true, stock: { $gt: 0 } });
  ok(res, ps.map((p) => ({ product: p, qty: Math.min(o.items.find((i) => String(i.product) === String(p._id)).qty, p.stock) })));
}));

// ---------- public store content ----------
r.get('/banner', wrap(async (req, res) => {
  const now = new Date();
  ok(res, await Banner.find({ active: true, $and: [{ $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gt: now } }] }] }).sort({ order: 1, createdAt: 1 }));
}));
r.get('/delivery-slots', wrap(async (req, res) => ok(res, await DeliverySlot.find({ active: true }).sort('order'))));
export default r;
