import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, pay } from '../api.js';
import { useStore } from '../store.js';
import { Thumb, money, btn, btn2, inp, Icon, Qty, useSync } from '../ui.jsx';

function useSummary() {
  const { cart, coupon, setCoupon } = useStore(); const [sum, setSum] = useState(null), [err, setErr] = useState('');
  const items = cart.map((i) => ({ product: i.id, qty: i.qty }));
  useEffect(() => { // totals always come from the server
    if (!cart.length) return setSum(null);
    api('/coupons/validate', { method: 'POST', body: { items, coupon: coupon || undefined } }).then((s) => { setSum(s); setErr(''); }).catch((e) => { setErr(e.message); if (coupon) setCoupon(''); });
  }, [JSON.stringify(items), coupon]); // eslint-disable-line
  return { sum, err, items };
}
const Summary = ({ sum }) => sum && <dl className="space-y-1.5 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(sum.subtotal)}</dd></div><div className="flex justify-between"><dt>Delivery Charge</dt><dd>{sum.deliveryFee ? money(sum.deliveryFee) : 'Free'}</dd></div>{sum.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount ({sum.coupon})</dt><dd>−{money(sum.discount)}</dd></div>}<div className="flex justify-between border-t pt-2 text-base font-extrabold"><dt>Total</dt><dd>{money(sum.total)}</dd></div></dl>;
const Empty = () => <div className="py-20 text-center"><Icon n="cart" className="mx-auto h-14 w-14 text-neutral-300" /><h1 className="mt-2 text-2xl font-extrabold">Your cart is empty</h1><Link to="/shop" className={btn + ' mt-4'}>Browse products</Link></div>;

export function Cart() {
  const { cart, setQty, clearCart, coupon, setCoupon } = useStore(); const nav = useNavigate(); const { sum, err } = useSummary(); const [c, setC] = useState(coupon);
  if (!cart.length) return <Empty />;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between"><h1 className="flex items-center gap-2 text-xl font-extrabold"><button aria-label="Go back" onClick={() => nav(-1)}><Icon n="back" /></button>Your Cart</h1><button aria-label="Clear cart" className="text-neutral-500 hover:text-brand" onClick={clearCart}><Icon n="trash" /></button></div>
      <div className="grid gap-4 md:grid-cols-5"><section className="space-y-2 md:col-span-3">
        {cart.map((i) => <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><Thumb p={i} cls="h-16 w-16 rounded-lg" />
          <div className="min-w-0 flex-1"><b className="block truncate text-sm">{i.name}</b><span className="text-sm font-semibold">{money(i.price)}</span></div>
          <Qty v={i.qty} set={(q) => setQty(i.id, q)} max={i.stock} /><button aria-label={`Remove ${i.name}`} className="text-neutral-400 hover:text-brand" onClick={() => setQty(i.id, 0)}><Icon n="trash" className="h-4 w-4" /></button></div>)}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCoupon(c.trim().toUpperCase()); }}><input className={inp} placeholder="Coupon code" aria-label="Coupon code" value={c} onChange={(e) => setC(e.target.value)} /><button className={btn2}>Apply</button></form>
        {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}</section>
        <aside className="h-fit rounded-xl border bg-white p-4 md:col-span-2"><h2 className="mb-3 font-extrabold">Order Summary</h2><Summary sum={sum} /><button className={btn + ' mt-4 w-full py-3'} disabled={!sum} onClick={() => nav('/checkout')}>Checkout</button></aside></div>
    </div>);
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export function Checkout() {
  const { cart, clearCart, user, toast, coupon } = useStore(); const nav = useNavigate(); const { sum, err: sErr, items } = useSummary();
  const [a, setA] = useState({ name: user?.name || '', phone: user?.phone || '', line1: '', area: '', city: '', pincode: '', landmark: '' });
  const [d, setD] = useState({ deliveryDate: today(), deliverySlot: 'ASAP', note: '', method: 'COD' }), [saved, setSaved] = useState([]), [slots, setSlots] = useState([]), [keep, setKeep] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useSync(() => { api('/delivery-slots').then(setSlots).catch(() => {}); if (user) api('/addresses').then(setSaved).catch(() => {}); }, [user?._id]);
  async function place(e) {
    e.preventDefault(); setErr('');
    if (!user) return nav('/login');
    setBusy(true); let created;
    try {
      created = await api('/orders', { method: 'POST', body: { items, coupon: coupon || undefined, method: d.method, address: a, deliveryDate: d.deliveryDate, deliverySlot: d.deliverySlot, note: d.note || undefined } });
      if (keep) api('/addresses', { method: 'POST', body: { ...a, label: 'Home' } }).catch(() => {});
      if (d.method === 'ONLINE') await pay(created.order._id, created.payment);
      clearCart(); nav('/orders', { state: { placed: created.order.code } });
    } catch (x) { setErr(x.message); if (created) { clearCart(); toast('Order saved. Complete payment from My Orders.'); nav('/orders'); } } finally { setBusy(false); }
  }
  if (!cart.length) return <Empty />;
  if (!user) return <div className="py-20 text-center"><h1 className="text-2xl font-extrabold">Log in to check out</h1><Link to="/login" className={btn + ' mt-4'}>Login</Link></div>;
  return (
    <div className="mx-auto max-w-3xl"><h1 className="mb-3 flex items-center gap-2 text-xl font-extrabold"><button aria-label="Go back" onClick={() => nav(-1)}><Icon n="back" /></button>Checkout</h1>
      <form onSubmit={place} className="grid gap-4 md:grid-cols-5">
        <section className="space-y-3 rounded-xl border bg-white p-4 md:col-span-3"><h2 className="font-extrabold">Delivery Details</h2>
          {saved.length > 0 && <select aria-label="Use a saved address" className={inp} defaultValue="" onChange={(e) => { const s = saved.find((x) => x._id === e.target.value); if (s) setA({ name: s.name, phone: s.phone, line1: s.line1, area: s.area, city: s.city, pincode: s.pincode, landmark: s.landmark || '' }); }}><option value="">Use a saved address…</option>{saved.map((s) => <option key={s._id} value={s._id}>{s.label}: {s.line1}, {s.area}</option>)}</select>}
          {[['name', 'Full Name'], ['phone', 'Phone Number'], ['line1', 'House / Flat, Street'], ['area', 'Area'], ['city', 'City'], ['pincode', 'Pincode'], ['landmark', 'Landmark (optional)']].map(([k, l]) => <input key={k} required={k !== 'landmark'} aria-label={l} placeholder={l} className={inp} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} />)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Save this address for next time</label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Delivery Date<input type="date" required min={today()} className={inp} value={d.deliveryDate} onChange={(e) => setD({ ...d, deliveryDate: e.target.value })} /></label>
            <label className="text-xs font-semibold">Delivery Time<select className={inp} value={d.deliverySlot} onChange={(e) => setD({ ...d, deliverySlot: e.target.value })}>{(slots.length ? slots.map((s) => s.label) : ['ASAP']).map((s) => <option key={s}>{s}</option>)}</select></label></div>
          <textarea aria-label="Special instructions" placeholder="Special Instructions (Optional)" rows={2} className={inp} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></section>
        <aside className="h-fit space-y-3 rounded-xl border bg-white p-4 md:col-span-2"><h2 className="font-extrabold">Payment</h2>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="radio" checked={d.method === 'COD'} onChange={() => setD({ ...d, method: 'COD' })} />Cash on Delivery</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="radio" checked={d.method === 'ONLINE'} onChange={() => setD({ ...d, method: 'ONLINE' })} />Pay online (Razorpay)</label>
          <Summary sum={sum} />{(err || sErr) && <p role="alert" className="text-sm font-semibold text-red-600">{err || sErr}</p>}
          <button className={btn + ' w-full py-3'} disabled={busy || !sum}>{busy ? 'Placing…' : 'Place Order'}</button></aside>
      </form></div>);
}
