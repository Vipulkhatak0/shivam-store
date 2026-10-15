import { Router } from 'express';
import { z } from 'zod';
import { NotificationPreference, Notification } from './models.js';
import { auth, ok, wrap, AppError } from './util.js';
import { defaultsFor, SOUND_CHOICES, TYPES } from './notificationDefaults.js';
const r = Router();
const getPrefs = async (u) => { const d = defaultsFor(u.role), saved = await NotificationPreference.findOne({ user: u._id }).lean(); if(!saved)return d; const {customSound,...p}=saved; const sound={...d.sound,...p.sound}; if(sound.soundId==='custom')sound.soundId='universfield'; return { ...d, ...p, push: { ...d.push, ...p.push }, sound, notifications: { ...d.notifications, ...p.notifications }, email: { ...d.email, ...p.email } }; };
r.get('/notifications/preferences', auth, wrap(async (req,res) => ok(res, await getPrefs(req.user))));
r.post('/notifications/read',auth,wrap(async(req,res)=>{if(req.body?.id)await Notification.updateOne({_id:req.body.id,user:req.user._id},{read:true});else await Notification.updateMany({user:req.user._id,read:false},{read:true});ok(res,{});}));
r.delete('/notifications/:id',auth,wrap(async(req,res)=>{await Notification.deleteOne({_id:req.params.id,user:req.user._id});ok(res,{});}));
r.put('/notifications/preferences', auth, wrap(async (req,res) => {
 const b=req.body||{}, d=defaultsFor(req.user.role), out={};
 for (const k of ['push','sound','notifications','email']) if (b[k] !== undefined && (!b[k] || typeof b[k] !== 'object' || Array.isArray(b[k]))) throw new AppError('Invalid notification settings.','VALIDATION_ERROR',422);
 if (b.push?.enabled !== undefined) { if(typeof b.push.enabled!=='boolean') throw new AppError('Invalid push setting.','VALIDATION_ERROR',422); out['push.enabled']=b.push.enabled; }
 if(b.sound){ if(b.sound.enabled!==undefined){if(typeof b.sound.enabled!=='boolean') throw new AppError('Invalid sound setting.','VALIDATION_ERROR',422);out['sound.enabled']=b.sound.enabled;} if(b.sound.volume!==undefined){if(typeof b.sound.volume!=='number'||b.sound.volume<0||b.sound.volume>1) throw new AppError('Volume must be between 0 and 1.','VALIDATION_ERROR',422);out['sound.volume']=b.sound.volume;} if(b.sound.soundId!==undefined){if(!SOUND_CHOICES.includes(b.sound.soundId)) throw new AppError('Unsupported sound.','VALIDATION_ERROR',422);out['sound.soundId']=b.sound.soundId;} }
 for(const k of ['notifications','email']) if(b[k]) for(const [t,v] of Object.entries(b[k])) {if(!(k==='notifications'?TYPES:['ORDER_PLACED','ORDER_ACCEPTED','ORDER_REJECTED','ORDER_STATUS','ORDER_CANCELLED','PAYMENT_SUCCESS','PAYMENT_FAILED','CUSTOM_ORDER','CUSTOM_REQUEST','CUSTOM_ACCEPTED','CUSTOM_REJECTED','NEW_CUSTOMER','NEW_MESSAGE','PROMOTIONS','NEW_PRODUCT']).includes(t)||typeof v!=='boolean') throw new AppError('Invalid notification preference.','VALIDATION_ERROR',422);out[`${k}.${t}`]=v;}
 const p=await NotificationPreference.findOneAndUpdate({user:req.user._id},{$set:out,$unset:{customSound:1},$setOnInsert:{user:req.user._id}}, {upsert:true,new:true,setDefaultsOnInsert:true}); const result=p.toObject(); delete result.customSound; if(result.sound?.soundId==='custom')result.sound.soundId='universfield'; ok(res,{...d,...result,sound:{...d.sound,...result.sound},notifications:{...d.notifications,...result.notifications},email:{...d.email,...result.email}});
}));
export default r;
