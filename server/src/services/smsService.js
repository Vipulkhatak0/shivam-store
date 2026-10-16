import { SmsEvent } from '../models.js';

const FLOW_URL = 'https://control.msg91.com/api/v5/flow';
const TEMPLATE_ENV = {
  ORDER_PLACED: 'MSG91_TEMPLATE_ORDER_PLACED', ORDER_ACCEPTED: 'MSG91_TEMPLATE_ORDER_ACCEPTED',
  ORDER_REJECTED: 'MSG91_TEMPLATE_ORDER_REJECTED', OUT_FOR_DELIVERY: 'MSG91_TEMPLATE_OUT_FOR_DELIVERY',
  ORDER_DELIVERED: 'MSG91_TEMPLATE_ORDER_DELIVERED', ADMIN_NEW_ORDER: 'MSG91_TEMPLATE_ADMIN_NEW_ORDER',
  ADMIN_NEW_PRODUCT: 'MSG91_TEMPLATE_ADMIN_NEW_PRODUCT', PAYMENT_SUCCESS: 'MSG91_TEMPLATE_PAYMENT_SUCCESS',
  CUSTOMER_REGISTERED: 'MSG91_TEMPLATE_CUSTOMER_REGISTERED', TEST: 'MSG91_TEMPLATE_TEST',
};
export function normalizeIndianMobile(value) {
  const digits = String(value ?? '').trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  const normalized = digits.startsWith('91') && digits.length === 12 ? digits : digits.length === 10 ? `91${digits}` : '';
  return /^91[6-9]\d{9}$/.test(normalized) ? normalized : null;
}
export const maskMobile = (mobile) => mobile ? `${mobile.slice(0, 4)}******${mobile.slice(-2)}` : 'unknown';
export function getAdminSmsNumbers() {
  return [...new Set(String(process.env.ADMIN_SMS_NUMBERS || '').split(',').map(normalizeIndianMobile).filter(Boolean))];
}
export function smsStatus() {
  return { provider: 'MSG91', configured: Boolean(process.env.MSG91_AUTH_KEY), enabled: process.env.SMS_ENABLED !== 'false',
    customerOrderSms: Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ORDER_PLACED && process.env.SMS_ENABLED !== 'false'),
    adminNewOrderSms: Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ADMIN_NEW_ORDER && getAdminSmsNumbers().length && process.env.SMS_ENABLED !== 'false'),
    adminNewProductSms: Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ADMIN_NEW_PRODUCT && getAdminSmsNumbers().length && process.env.SMS_ENABLED !== 'false') };
}
function safeError(e) {
  let detail = String(e?.response?.data?.message || e?.message || 'provider request failed');
  if (process.env.MSG91_AUTH_KEY) detail = detail.split(process.env.MSG91_AUTH_KEY).join('[redacted]');
  return detail.replace(/authkey|authorization|token|key/ig, '[redacted]').slice(0, 180);
}
function templateVariables(event, values) {
  const env = process.env[`MSG91_VARIABLES_${event}`];
  if (!env) return values;
  try {
    const names = JSON.parse(env);
    return Object.fromEntries(Object.entries(values).filter(([key]) => names[key]).map(([key, value]) => [names[key], String(value ?? '')]));
  } catch { console.error(`[SMS] Invalid MSG91_VARIABLES_${event} JSON; skipping SMS.`); return null; }
}
export async function sendSms({ templateId, mobile, variables = {}, event = 'SMS', eventKey }) {
  const number = normalizeIndianMobile(mobile);
  if (!number) return { success: false, skipped: true, reason: 'invalid_mobile' };
  if (process.env.SMS_ENABLED === 'false') return { success: false, skipped: true, reason: 'disabled' };
  if (!process.env.MSG91_AUTH_KEY || !templateId) { console.info('[SMS] MSG91 is not configured; skipping SMS.'); return { success: false, skipped: true, reason: 'not_configured' }; }
  const recipientVars = templateVariables(event, variables);
  if (!recipientVars) return { success: false, skipped: true, reason: 'invalid_template_variables' };
  if (eventKey) {
    try { await SmsEvent.create({ key: eventKey, event, mobile: maskMobile(number), status: 'SENDING' }); }
    catch (e) {
      if (e.code !== 11000) { console.error(`[SMS] ${event} idempotency reservation failed: ${safeError(e)}`); return { success: false, reason: 'reservation_failed' }; }
      const prior = await SmsEvent.findOne({ key: eventKey });
      if (prior?.status === 'SENT' || prior?.status === 'SENDING') return { success: prior.status === 'SENT', skipped: true, reason: 'duplicate' };
      const claimed = await SmsEvent.updateOne({ key: eventKey, status: 'FAILED' }, { $set: { status: 'SENDING', mobile: maskMobile(number) } });
      if (!claimed.modifiedCount) return { success: false, skipped: true, reason: 'duplicate' };
    }
  }
  try {
    const response = await fetch(FLOW_URL, { method: 'POST', headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: number, ...recipientVars }] }) });
    if (!response.ok) { let detail; try { detail = await response.json(); } catch {} throw Object.assign(new Error(detail?.message || `MSG91 returned HTTP ${response.status}`), { response: { data: detail } }); }
    if (eventKey) await SmsEvent.updateOne({ key: eventKey, status: 'SENDING' }, { $set: { status: 'SENT' } });
    console.info(`[SMS] ${event} sent to ${maskMobile(number)}`); return { success: true };
  } catch (e) {
    if (eventKey) await SmsEvent.updateOne({ key: eventKey, status: 'SENDING' }, { $set: { status: 'FAILED' } }).catch(() => {});
    console.error(`[SMS] ${event} failed: ${safeError(e)}`); return { success: false, reason: 'provider_error' };
  }
}
export async function sendSmsEvent(event, mobile, values, eventKey) {
  return sendSms({ event, mobile, variables: values, eventKey, templateId: process.env[TEMPLATE_ENV[event]] });
}
export async function sendAdminSmsEvent(event, values, eventKey) {
  return Promise.all(getAdminSmsNumbers().map((mobile) => sendSmsEvent(event, mobile, values, `${eventKey}:${mobile}`)));
}
