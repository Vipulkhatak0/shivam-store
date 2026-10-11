import { Router } from 'express';
import { z } from 'zod';
import { Banner, DeliverySlot } from './models.js';
import { ok, AppError, wrap, auth, adminOnly, validate, audit } from './util.js';
const r = Router();
r.use(auth, adminOnly);
r.get('/banner', wrap(async (req, res) => ok(res, await Banner.findOne({ key: 'special' }))));
r.put('/banner', validate(z.object({ title: z.string().min(2).max(60), subtitle: z.string().max(80).default(''), cta: z.string().max(20).default('Order Now'), link: z.string().max(100).default('/shop/cakes'), active: z.boolean().default(true) })),
  wrap(async (req, res) => { const b = await Banner.findOneAndUpdate({ key: 'special' }, { key: 'special', ...req.body }, { upsert: true, new: true }); await audit(req, 'Updated homepage banner', b._id); ok(res, b, 'Banner saved.'); }));
r.get('/delivery-slots', wrap(async (req, res) => ok(res, await DeliverySlot.find().sort('order'))));
r.post('/delivery-slots', validate(z.object({ label: z.string().min(2).max(20) })), wrap(async (req, res) => {
  const s = await DeliverySlot.create({ label: req.body.label, order: await DeliverySlot.countDocuments() }); await audit(req, `Added slot ${s.label}`, s._id); ok(res, s, 'Slot added.', 201);
}));
r.patch('/delivery-slots/:id', validate(z.object({ active: z.boolean() })), wrap(async (req, res) => {
  const s = await DeliverySlot.findByIdAndUpdate(req.params.id, req.body, { new: true }); if (!s) throw new AppError('Slot not found.', 'NOT_FOUND', 404); ok(res, s);
}));
export default r;
