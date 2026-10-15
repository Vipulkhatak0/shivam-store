import { Router } from 'express';
import { z } from 'zod';
import { NotificationPreference, Notification, PushDevice } from './models.js';
import { auth, ok, wrap, AppError } from './util.js';
import { defaultsFor, SOUND_CHOICES, TYPES } from './notificationDefaults.js';
import { pushConfigured } from './push.js';
const r = Router();
const getPrefs = async (u) => { const d = defaultsFor(u.role), saved = await NotificationPreference.findOne({ user: u._id }).lean(); if(!saved)return d; const {customSound,...p}=saved; const sound={...d.sound,...p.sound}; if(sound.soundId==='custom')sound.soundId='universfield'; const push={...d.push,...p.push}; if(u.role!=='CUSTOMER'||push.enabled&&!await PushDevice.exists({user:u._id}))push.enabled=false; return { ...d, ...p, inApp:{...d.inApp,...p.inApp}, push, sound, notifications: { ...d.notifications, ...p.notifications }, email: { ...d.email, ...p.email } }; };
r.get('/notifications/preferences', auth, wrap(async (req,res) => ok(res, await getPrefs(req.user))));
r.get('/push/status', auth, wrap(async (req,res) => ok(res, { configured: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null, devices: req.user.role === 'CUSTOMER' ? await PushDevice.countDocuments({ user: req.user._id }) : 0 })));
r.post('/push/subscribe', auth, wrap(async (req,res) => {
  if (req.user.role !== 'CUSTOMER') throw new AppError('Push subscriptions are available for customer accounts.', 'FORBIDDEN', 403);
  if (!pushConfigured()) throw new AppError('Web Push is not configured on the store server yet.', 'PUSH_NOT_CONFIGURED', 503);
  const schema = z.object({ endpoint: z.string().url().max(2048).refine((v) => v.startsWith('https://'), 'Push endpoint must use HTTPS.'), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, 'Invalid p256dh key.'), auth: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/, 'Invalid auth key.') }), expirationTime: z.number().nullable().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 'VALIDATION_ERROR', 422);
  const s = parsed.data, other = await PushDevice.findOne({ endpoint: s.endpoint });
  if (other && String(other.user) !== String(req.user._id)) throw new AppError('This push subscription is already linked to another account.', 'FORBIDDEN', 403);
  const device = await PushDevice.findOneAndUpdate({ endpoint: s.endpoint }, { $set: { user: req.user._id, keys: s.keys, expirationTime: s.expirationTime ?? null } }, { upsert: true, new: true, runValidators: true });
  await NotificationPreference.updateOne({ user: req.user._id }, { $set: { 'push.enabled': true }, $setOnInsert: { user: req.user._id } }, { upsert: true });
  ok(res, { subscribed: true, id: device._id }, 'Push notifications enabled.', 201);
}));
r.delete('/push/subscribe', auth, wrap(async (req,res) => {
  if (req.user.role !== 'CUSTOMER') throw new AppError('Push subscriptions are available for customer accounts.', 'FORBIDDEN', 403);
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !endpoint.startsWith('https://')) throw new AppError('Invalid push subscription.', 'VALIDATION_ERROR', 422);
  await PushDevice.deleteOne({ user: req.user._id, endpoint }); ok(res, { unsubscribed: true });
}));
r.post('/notifications/read',auth,wrap(async(req,res)=>{if(req.body?.id)await Notification.updateOne({_id:req.body.id,user:req.user._id},{read:true});else await Notification.updateMany({user:req.user._id,read:false},{read:true});ok(res,{});}));
r.delete('/notifications/:id',auth,wrap(async(req,res)=>{await Notification.deleteOne({_id:req.params.id,user:req.user._id});ok(res,{});}));
r.put('/notifications/preferences', auth, wrap(async (req,res) => {
 const b=req.body||{}, d=defaultsFor(req.user.role), out={};
 for (const k of ['inApp','push','sound','notifications','email']) if (b[k] !== undefined && (!b[k] || typeof b[k] !== 'object' || Array.isArray(b[k]))) throw new AppError('Invalid notification settings.','VALIDATION_ERROR',422);
 for (const k of ['inApp','push']) if (b[k]?.enabled !== undefined) { if(typeof b[k].enabled!=='boolean') throw new AppError(`Invalid ${k} setting.`,'VALIDATION_ERROR',422); out[`${k}.enabled`]=b[k].enabled; }
 if(b.sound){ if(b.sound.enabled!==undefined){if(typeof b.sound.enabled!=='boolean') throw new AppError('Invalid sound setting.','VALIDATION_ERROR',422);out['sound.enabled']=b.sound.enabled;} if(b.sound.volume!==undefined){if(typeof b.sound.volume!=='number'||b.sound.volume<0||b.sound.volume>1) throw new AppError('Volume must be between 0 and 1.','VALIDATION_ERROR',422);out['sound.volume']=b.sound.volume;} if(b.sound.soundId!==undefined){if(!SOUND_CHOICES.includes(b.sound.soundId)) throw new AppError('Unsupported sound.','VALIDATION_ERROR',422);out['sound.soundId']=b.sound.soundId;} }
 for(const k of ['notifications','email']) if(b[k]) for(const [t,v] of Object.entries(b[k])) {if(!(k==='notifications'?TYPES:['ORDER_PLACED','ORDER_ACCEPTED','ORDER_REJECTED','ORDER_STATUS','ORDER_CANCELLED','PAYMENT_SUCCESS','PAYMENT_FAILED','CUSTOM_ORDER','CUSTOM_REQUEST','CUSTOM_ACCEPTED','CUSTOM_REJECTED','NEW_CUSTOMER','NEW_MESSAGE','PROMOTIONS','NEW_PRODUCT']).includes(t)||typeof v!=='boolean') throw new AppError('Invalid notification preference.','VALIDATION_ERROR',422);out[`${k}.${t}`]=v;}
 const p=await NotificationPreference.findOneAndUpdate({user:req.user._id},{$set:out,$unset:{customSound:1},$setOnInsert:{user:req.user._id}}, {upsert:true,new:true,setDefaultsOnInsert:true}); const result=p.toObject(); delete result.customSound; if(result.sound?.soundId==='custom')result.sound.soundId='universfield'; ok(res,{...d,...result,sound:{...d.sound,...result.sound},notifications:{...d.notifications,...result.notifications},email:{...d.email,...result.email}});
}));
export default r;
