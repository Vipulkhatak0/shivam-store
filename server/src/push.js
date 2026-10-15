import webpush from 'web-push';
import { PushDevice } from './models.js';

const config = () => ({ publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT });
export function pushConfigured() { const c = config(); return Boolean(c.publicKey && c.privateKey && c.subject); }

let configuredFor = '';
export async function sendPushToUser(userId, payload) {
  if (!pushConfigured()) return;
  const c = config(), fingerprint = `${c.publicKey}:${c.privateKey}:${c.subject}`;
  if (configuredFor !== fingerprint) { webpush.setVapidDetails(c.subject, c.publicKey, c.privateKey); configuredFor = fingerprint; }
  const devices = await PushDevice.find({ user: userId }).lean();
  await Promise.all(devices.map(async (device) => {
    const subscription = { endpoint: device.endpoint, keys: device.keys, expirationTime: device.expirationTime };
    try { await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 }); }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await PushDevice.deleteOne({ _id: device._id });
      else console.error('Web Push delivery failed:', Number(e.statusCode) || 'network');
    }
  }));
}
