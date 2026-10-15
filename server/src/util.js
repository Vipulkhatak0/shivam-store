import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { User, Notification, AuditLog, NotificationPreference } from './models.js';
import { defaultsFor, TYPES } from './notificationDefaults.js';
import { notificationTemplate } from './notifications.js';
import { sendPushToUser } from './push.js';

export class AppError extends Error {
  constructor(message, errorCode = 'BAD_REQUEST', status = 400) { super(message); this.errorCode = errorCode; this.status = status; }
}
export const ok = (res, data = {}, message = 'Success', code = 200) => res.status(code).json({ success: true, message, data });
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export async function userFromToken(t) {
  if (!t) return null;
  try { const { id } = jwt.verify(t, process.env.JWT_SECRET); const u = await User.findById(id); return u && u.active ? u : null; } catch { return null; }
}
export const auth = wrap(async (req, res, next) => {
  const u = await userFromToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!u) throw new AppError('Please log in to continue.', 'UNAUTHORIZED', 401);
  req.user = u; next();
});
export const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return next(new AppError('Admins only.', 'FORBIDDEN', 403));
  if (req.user.mustChangePassword) return next(new AppError('Change your password before using the admin panel.', 'PASSWORD_CHANGE_REQUIRED', 403));
  next();
};
export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) { const i = r.error.issues[0]; return next(new AppError(`${i.path.join('.') || 'Request'}: ${i.message}`, 'VALIDATION_ERROR', 422)); }
  req.body = r.data; next();
};

let io; export const setIO = (i) => { io = i; };
export async function notify(userId, type, title, message, data = {}) {
  const user = await User.findById(userId).select('role active'); if (!user?.active) return null;
  const pref = await NotificationPreference.findOne({ user: userId }).lean();
  const defaults = defaultsFor(user.role), enabled = pref?.notifications?.[type] ?? defaults.notifications[type] ?? true;
  if (!enabled) return null;
  if (data?.template) [title, message] = notificationTemplate(user.role, type, data);
  const cleanData = { ...data }; delete cleanData.template;
  if (!cleanData.url) {
    if (cleanData.orderId) cleanData.url = user.role === 'ADMIN' ? `/admin?tab=Orders&order=${encodeURIComponent(cleanData.orderId)}` : `/orders?order=${encodeURIComponent(cleanData.orderId)}`;
    else if (cleanData.slug) cleanData.url = `/product/${encodeURIComponent(cleanData.slug)}`;
  }
  const dedupeKey = cleanData.dedupeKey || (cleanData.orderId ? `${cleanData.orderId}:${type}:${cleanData.status || ''}` : type === 'NEW_PRODUCT' && cleanData.slug ? `${type}:${cleanData.slug}` : undefined);
  let n;
  try { n = await Notification.create({ user: userId, type, title, message, data: cleanData, dedupeKey }); }
  catch (e) { if (e.code !== 11000 || !dedupeKey) throw e; return Notification.findOne({ user: userId, dedupeKey }); }
  if (pref?.inApp?.enabled !== false) io.to(`user:${userId}`).emit('notification:new', n);
  if (user.role === 'CUSTOMER' && pref?.push?.enabled === true) {
    const payload = { title, body: message, icon: '/favicon.png', badge: '/favicon.png', tag: dedupeKey || String(n._id), showWhenVisible: pref?.inApp?.enabled === false, data: { url: cleanData.url || '/', type } };
    if (type === 'NEW_PRODUCT' && cleanData.image) payload.image = cleanData.image;
    sendPushToUser(userId, payload).catch((e) => console.error('Web Push preparation failed:', e.message));
  }
  if (EMAIL_TYPES.has(type)) emailUser(userId, type, title, message).catch((e) => console.error('Email failed:', e.message));
  return n;
}
export async function notifyAdmins(type, title, message, data = {}, event, payload) {
  const admins = await User.find({ role: 'ADMIN' }).select('_id');
  for (const a of admins) await notify(a._id, type, title, message, data);
  if (event) io.to('admin').emit(event, payload);
}
export const emitUser = (uid, ev, payload) => io.to(`user:${uid}`).emit(ev, payload);
export const emitAdmin = (ev, payload) => io.to('admin').emit(ev, payload);
export const audit = (req, action, target) => AuditLog.create({ admin: req.user._id, action, target: String(target) });

export const mailHtml = (title, body) => `<div style="font-family:Arial,sans-serif;background:#FFF8F2;padding:24px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#F44336;color:#fff;padding:16px 24px;font-size:20px;font-weight:bold">Shivam Store</div><div style="padding:24px"><h2 style="margin:0 0 12px;color:#171717">${title}</h2><p style="color:#333;font-size:15px;line-height:1.5">${body}</p></div><div style="padding:12px 24px;background:#fafafa;color:#888;font-size:12px">Fresh Cakes • Snacks • Everyday Essentials</div></div></div>`;
const EMAIL_TYPES = new Set(['ORDER_PLACED','PAYMENT_SUCCESS','ORDER_ACCEPTED','ORDER_REJECTED','ORDER_STATUS','ORDER_CANCELLED','PAYMENT_FAILED','CUSTOM_ORDER','CUSTOM_REQUEST','CUSTOM_ACCEPTED','CUSTOM_REJECTED','NEW_CUSTOMER','NEW_MESSAGE','PROMOTIONS','NEW_PRODUCT']);
async function emailUser(uid, type, title, message) {
  if (!process.env.SMTP_HOST) return;
  const u = await User.findById(uid).select('email role');
  if (u) { const p = await NotificationPreference.findOne({ user: uid }).lean(), d=defaultsFor(u.role); if(p?.email?.enabled===false || (p?.email?.[type] ?? d.email[type])===false) return; await sendMail(u.email, title, message, mailHtml(title, message)); }
}
export async function sendMail(to, subject, text, html) {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') throw new AppError('Email is not configured on this server.', 'EMAIL_NOT_CONFIGURED', 503);
    console.log(`\n[DEV EMAIL - SMTP not configured]\nTo: ${to}\n${subject}\n${text}\n`); return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
}
