import { Router } from 'express';
import { z } from 'zod';
import { Banner, DeliverySlot } from './models.js';
import { ok, AppError, wrap, auth, adminOnly, validate, audit } from './util.js';
import { upload, storeFile } from './shopRoutes.js';
const r = Router();
r.use(auth, adminOnly);
const bannerTypes = ['IMAGE', 'PROMOTIONAL', 'TODAYS_SPECIAL', 'FESTIVAL', 'PRODUCT_OFFER'];
const textField = (max) => z.string().trim().max(max).optional();
const bannerInput = z.object({
  title: z.string().trim().min(2).max(80), subtitle: textField(180), type: z.enum(bannerTypes).default('TODAYS_SPECIAL'),
  cta: textField(40), link: textField(500).refine((v) => !v || (v.startsWith('/') && !v.startsWith('//')) || /^https?:\/\//i.test(v), 'Use a site path or http(s) URL.'),
  discountText: textField(50), badge: textField(30), backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  active: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional(), order: z.preprocess((v) => v === undefined || v === '' ? undefined : Number(v), z.number().int().min(0).max(10000)).optional(),
  startsAt: textField(30), endsAt: textField(30),
});
const bannerFiles = upload.fields([{ name: 'desktopImage', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]);
async function persistBannerFiles(body, files) {
  const update = { ...body };
  for (const field of ['desktopImage', 'mobileImage']) if (files?.[field]?.[0]) update[field] = await storeFile(files[field][0], { requireCloudinary: true });
  if (update.startsAt === '') update.startsAt = null;
  else if (update.startsAt) update.startsAt = new Date(update.startsAt);
  if (update.endsAt === '') update.endsAt = null;
  else if (update.endsAt) update.endsAt = new Date(update.endsAt);
  if (update.startsAt && Number.isNaN(update.startsAt.getTime()) || update.endsAt && Number.isNaN(update.endsAt.getTime())) throw new AppError('Enter valid schedule dates.', 'VALIDATION_ERROR', 422);
  if (update.startsAt && update.endsAt && update.startsAt >= update.endsAt) throw new AppError('End date must be after start date.', 'VALIDATION_ERROR', 422);
  return update;
}
r.get('/banner', wrap(async (req, res) => ok(res, await Banner.findOne({ key: 'special' }))));
r.put('/banner', bannerFiles, validate(bannerInput), wrap(async (req, res) => {
  const body = await persistBannerFiles(req.body, req.files);
  const b = await Banner.findOneAndUpdate({ key: 'special' }, { key: 'special', ...body }, { upsert: true, new: true, runValidators: true });
  await audit(req, 'Updated homepage banner', b._id); ok(res, b, 'Banner saved.');
}));
r.get('/banners', wrap(async (req, res) => ok(res, await Banner.find().sort({ order: 1, createdAt: 1 }))));
r.post('/banners', bannerFiles, validate(bannerInput), wrap(async (req, res) => {
  const body = await persistBannerFiles(req.body, req.files);
  const b = await Banner.create({ ...body, key: `banner-${Date.now()}-${Math.random().toString(36).slice(2)}`, order: body.order ?? await Banner.countDocuments() });
  await audit(req, `Created banner ${b.title}`, b._id); ok(res, b, 'Banner created.', 201);
}));
r.put('/banners/reorder', validate(z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(100) })), wrap(async (req, res) => {
  const existing = await Banner.find({ _id: { $in: req.body.ids } }).select('_id');
  if (existing.length !== req.body.ids.length) throw new AppError('One or more banners were not found.', 'NOT_FOUND', 404);
  await Promise.all(req.body.ids.map((id, order) => Banner.updateOne({ _id: id }, { $set: { order } })));
  await audit(req, 'Reordered homepage banners', req.body.ids.join(','));
  ok(res, await Banner.find().sort({ order: 1, createdAt: 1 }));
}));
r.delete('/banners/:id', wrap(async (req, res) => {
  const b = await Banner.findByIdAndDelete(req.params.id);
  if (!b) throw new AppError('Banner not found.', 'NOT_FOUND', 404);
  await audit(req, `Deleted banner ${b.title}`, b._id); ok(res, { id: b._id });
}));
r.put('/banners/:id', bannerFiles, validate(bannerInput.partial()), wrap(async (req, res) => {
  const body = await persistBannerFiles(req.body, req.files);
  const b = await Banner.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
  if (!b) throw new AppError('Banner not found.', 'NOT_FOUND', 404);
  await audit(req, `Updated banner ${b.title}`, b._id); ok(res, b, 'Banner updated.');
}));
r.get('/delivery-slots', wrap(async (req, res) => ok(res, await DeliverySlot.find().sort('order'))));
r.post('/delivery-slots', validate(z.object({ label: z.string().min(2).max(20) })), wrap(async (req, res) => {
  const s = await DeliverySlot.create({ label: req.body.label, order: await DeliverySlot.countDocuments() }); await audit(req, `Added slot ${s.label}`, s._id); ok(res, s, 'Slot added.', 201);
}));
r.patch('/delivery-slots/:id', validate(z.object({ active: z.boolean() })), wrap(async (req, res) => {
  const s = await DeliverySlot.findByIdAndUpdate(req.params.id, req.body, { new: true }); if (!s) throw new AppError('Slot not found.', 'NOT_FOUND', 404); ok(res, s);
}));
export default r;
