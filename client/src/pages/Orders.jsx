import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, img, pay } from '../api.js';
import { useStore } from '../store.js';
import { money, btn, btn2, inp, Badge, Timeline, useSync, Icon } from '../ui.jsx';
import Chat from './Chat.jsx';

function Review({ item }) {
  const [open, setOpen] = useState(false), [r, setR] = useState(5), [c, setC] = useState(''), [done, setDone] = useState(false); const toast = useStore((s) => s.toast);
  async function go(e) { e.preventDefault(); try { await api(`/products/${item.product}/reviews`, { method: 'POST', body: { rating: r, comment: c } }); setDone(true); toast('Thanks for your review!'); } catch (x) { toast(x.message); } }
  if (done) return <span className="text-xs text-green-700"> · Reviewed</span>;
  return <>{' '}<button className="text-xs font-bold text-brand" onClick={() => setOpen(!open)}>· Rate</button>
    {open && <form onSubmit={go} className="mt-1 flex flex-wrap items-center gap-2"><select aria-label="Rating" className="rounded-lg border px-2 py-1" value={r} onChange={(e) => setR(+e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select><input className={inp + ' !w-56'} placeholder="Say something (optional)" value={c} maxLength={500} onChange={(e) => setC(e.target.value)} /><button className={btn + ' !py-1.5 text-sm'}>Submit</button></form>}</>;
}
export default function Orders() {
  const { user, toast, add } = useStore(); const loc = useLocation(); const nav = useNavigate(); const [orders, setOrders] = useState(null), [reqs, setReqs] = useState([]), [chat, setChat] = useState(false), [busy, setBusy] = useState('');
  useSync(() => { if (!user) return; api('/orders').then(setOrders).catch(() => setOrders([])); api('/custom-orders').then(setReqs).catch(() => {}); }, [user?._id]);
  if (!user) return <Navigate to="/login" />;
  async function payReq(r, method) {
    setBusy(r._id);
    try { const d = await api(`/custom-orders/${r._id}/pay`, { method: 'POST', body: { method } }); if (method === 'ONLINE') await pay(d.order._id, d.payment); toast('Order placed'); }
    catch (e) { toast(e.message); } finally { setBusy(''); window.dispatchEvent(new Event('sync')); }
  }
  async function cancel(o) { try { await api(`/orders/${o._id}/cancel`, { method: 'POST' }); toast('Order cancelled'); window.dispatchEvent(new Event('sync')); } catch (e) { toast(e.message); } }
  async function reorder(o) {
    try { const l = await api(`/orders/${o._id}/reorder`); if (!l.length) return toast('Custom cakes and unavailable items cannot be reordered. Request a new custom cake instead.'); l.forEach((x) => add(x.product, x.qty)); nav('/cart'); } catch (e) { toast(e.message); }
  }
  async function retryPay(o) { try { await api(`/orders/${o._id}/verify`, { method: 'POST', body: {} }); toast('Paid'); } catch (e) { toast(e.message); } window.dispatchEvent(new Event('sync')); }
  const ChatBox = <div className="mt-3"><button className={btn2} onClick={() => setChat(!chat)}><Icon n="chat" className="h-4 w-4" />{chat ? 'Hide chat' : 'Chat with the bakery'}</button>{chat && <div className="mt-2"><Chat base="/chat" me="CUSTOMER" /></div>}</div>;
  return (<div className="mx-auto max-w-3xl space-y-8">
    {loc.state?.placed && <div className="rounded-2xl bg-green-50 p-5 text-center"><div className="text-4xl">🎉</div><h1 className="text-xl font-extrabold">Order Confirmed!</h1><p>Order #{loc.state.placed} has been placed. Track it below.</p></div>}
    {reqs.length > 0 && <section><h1 className="mb-3 text-2xl font-extrabold">Custom cake requests</h1>
      {reqs.map((r) => <div key={r._id} className="mb-3 rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><b>#{r.code} · {r.productName}</b><Badge s={r.status} /></div>
        <p className="mt-1 text-sm text-neutral-600">{r.customization.kg} KG · {r.customization.flavor} · {r.customization.eggless ? 'Eggless' : 'Egg'} · “{r.customization.message}” · {r.deliveryTime}, {r.deliveryDate}</p>
        {r.customization.photo && <img src={img(r.customization.photo)} alt="Your reference" className="mt-2 h-20 rounded-lg" />}
        {r.status === 'PENDING' && <p className="mt-2 text-sm">Estimated {money(r.estimatedPrice)}. Waiting for the bakery to respond…</p>}
        {r.status === 'ACCEPTED' && !r.order && <div className="mt-3 rounded-xl bg-green-50 p-3"><b>🎂 Your custom cake request has been accepted!</b><p className="text-sm">Final price: <b>{money(r.finalPrice)}</b> · Delivery: {r.deliveryTime}</p>
          <div className="mt-2 flex flex-wrap gap-2"><button className={btn} disabled={busy === r._id} onClick={() => payReq(r, 'ONLINE')}>Confirm &amp; Pay {money(r.finalPrice)}</button><button className={btn2} disabled={busy === r._id} onClick={() => payReq(r, 'COD')}>Pay on delivery</button></div></div>}
        {r.status === 'REJECTED' && <p className="mt-2 text-sm text-red-700">Declined: {r.rejectReason}</p>}</div>)}{ChatBox}</section>}
    <section><h1 className="mb-3 text-2xl font-extrabold">My orders</h1>
      {!orders ? <div className="skeleton h-32" /> : orders.length === 0 ? <div className="py-12 text-center text-neutral-500">No orders yet. <Link to="/shop" className="font-semibold text-brand">Start shopping</Link></div>
        : orders.map((o) => <div key={o._id} className="mb-3 rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><b>#{o.code}</b><span className="text-sm text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</span></div>
          <ul className="mt-1 text-sm text-neutral-700">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}{o.status === 'DELIVERED' && i.product && <Review item={i} />}</li>)}</ul>
          <p className="mt-1 text-sm"><b>{money(o.total)}</b> · {o.payment.method === 'COD' ? 'Cash on delivery' : o.payment.status === 'PAID' ? 'Paid online' : 'Payment pending'} · {o.deliverySlot}, {o.deliveryDate}</p>
          <Timeline status={o.status} />
          <div className="mt-3 flex flex-wrap gap-2">{o.payment.method === 'ONLINE' && o.payment.status !== 'PAID' && o.status === 'PENDING' && o.payment.test && <button className={btn} onClick={() => retryPay(o)}>Complete test payment</button>}
            {['PENDING', 'CONFIRMED'].includes(o.status) && <button className={btn2} onClick={() => cancel(o)}>Cancel order</button>}
            {o.status === 'DELIVERED' && <button className={btn2} onClick={() => reorder(o)}>Reorder</button>}</div></div>)}
      {!reqs.length && ChatBox}</section></div>);
}
