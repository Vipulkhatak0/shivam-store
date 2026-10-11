export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const img = (p) => (!p ? null : /^(https?:)?\/\//.test(p) || p.startsWith('/img/') ? p : API + p);
export async function api(path, { method = 'GET', body, form } = {}) {
  const h = {}; const t = localStorage.getItem('token');
  if (t) h.Authorization = 'Bearer ' + t;
  let b;
  if (form) b = form; else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  let res;
  try { res = await fetch(API + '/api' + path, { method, headers: h, body: b }); }
  catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) { const e = new Error(j.message || 'Something went wrong. Please try again.'); e.code = j.errorCode; throw e; }
  return j.data;
}
// Opens Razorpay (or the clearly-labelled dev test mode) and verifies on the server.
export async function pay(orderId, payment) {
  if (!payment) return;
  if (payment.test) return api(`/orders/${orderId}/verify`, { method: 'POST', body: {} });
  await new Promise((ok, no) => {
    if (window.Razorpay) return ok();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load the payment window.')); document.body.append(s);
  });
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: payment.keyId, order_id: payment.razorpayOrderId, amount: payment.amount, currency: 'INR', name: 'Shivam Store',
      handler: (r) => api(`/orders/${orderId}/verify`, { method: 'POST', body: r }).then(resolve, reject),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. Your order is saved; pay from My Orders.')) },
    });
    rz.open();
  });
}
