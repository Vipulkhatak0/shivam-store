import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, img } from '../api.js';
import { useStore } from '../store.js';
import { money, btn, btn2, inp, Badge, Timeline, label, useSync, Icon, Logo } from '../ui.jsx';
import Chat from './Chat.jsx';

const TABS = [['Dashboard', 'grid'], ['Orders', 'box'], ['Custom Orders', 'cake'], ['Products', 'tag'], ['Categories', 'tag'], ['Customers', 'users'], ['Coupons', 'tag'], ['Messages', 'chat'], ['Settings', 'cog']];
const NEXT = { PENDING: ['CONFIRMED', 'REJECTED'], CONFIRMED: ['PREPARING'], PREPARING: ['READY'], READY: ['OUT_FOR_DELIVERY'], OUT_FOR_DELIVERY: ['DELIVERED'] };
const sync = () => window.dispatchEvent(new Event('sync'));

function ChangePassword() {
  const { setAuth, toast } = useStore(); const [f, setF] = useState({ current: '', password: '' }), [err, setErr] = useState('');
  async function go(e) { e.preventDefault(); try { const d = await api('/auth/change-password', { method: 'POST', body: f }); setAuth(localStorage.getItem('token'), d.user); toast('Password updated'); } catch (x) { setErr(x.message); } }
  return <form onSubmit={go} className="mx-auto mt-6 max-w-sm space-y-3 rounded-2xl border bg-white p-6"><h1 className="text-xl font-extrabold">Set a new password</h1><p className="text-sm text-neutral-600">You're using the default admin password. Change it to continue.</p>
    <input type="password" required aria-label="Current password" placeholder="Current password" className={inp} onChange={(e) => setF({ ...f, current: e.target.value })} /><input type="password" required minLength={8} aria-label="New password" placeholder="New password (min 8)" className={inp} onChange={(e) => setF({ ...f, password: e.target.value })} />
    {err && <p role="alert" className="text-sm text-red-600">{err}</p>}<button className={btn + ' w-full'}>Update password</button></form>;
}
function Sales({ data }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-extrabold">Sales, last 7 days</h2>
    <svg viewBox="0 0 280 120" className="w-full" role="img" aria-label="Bar chart of sales for the last 7 days">{data.map((d, i) => { const h = (d.total / max) * 80; return <g key={i}><rect x={i * 40 + 8} y={90 - h} width="24" height={h} rx="3" fill="#E53935"><title>{d.day}: {money(d.total)} ({d.orders} orders)</title></rect><text x={i * 40 + 20} y="106" textAnchor="middle" fontSize="9" fill="#666">{d.day}</text><text x={i * 40 + 20} y={84 - h} textAnchor="middle" fontSize="8" fill="#333">{d.total ? Math.round(d.total) : ''}</text></g>; })}</svg></div>;
}
function Dash({ go }) {
  const [d, setD] = useState(null); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/dashboard').then(setD).catch(() => {}); }, []);
  async function act(o, status) {
    let reason; if (status === 'REJECTED') { reason = prompt('Reason for rejecting this order?'); if (!reason) return; }
    try { await api(`/admin/orders/${o._id}/status`, { method: 'PATCH', body: { status, reason } }); sync(); } catch (e) { toast(e.message); }
  }
  if (!d) return <div className="skeleton h-40" />;
  const C = [['New Orders', d.pending, 'bg-orange-50 text-orange-600', 'bell'], ['Total Orders', d.totalOrders, 'bg-green-50 text-green-700', 'cart'], ["Today's Sales", money(d.sales.at(-1).total), 'bg-blue-50 text-blue-700', 'tag']];
  const S = [["Today's orders", d.todayOrders], ['Delivered', d.delivered], ['Revenue', money(d.revenue)], ['Customers', d.customers], ['Products', d.products], ['Low stock', d.lowStock], ['Custom requests', d.customPending]];
  return <><div className="grid gap-3 sm:grid-cols-3">{C.map(([l, v, c, ic]) => <div key={l} className={'flex items-center gap-3 rounded-xl p-4 ' + c}><Icon n={ic} className="h-8 w-8" /><div><div className="text-2xl font-extrabold">{v}</div><div className="text-xs font-semibold">{l}</div></div></div>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{S.map(([l, v]) => <div key={l} className="rounded-xl border bg-white p-3"><div className="text-xs text-neutral-500">{l}</div><div className="font-extrabold">{v}</div></div>)}</div>
    <div className="mt-4"><Sales data={d.sales} /></div>
    <h2 className="mb-2 mt-5 font-extrabold">Recent Orders</h2>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr>{['#', 'Customer', 'Items', 'Time', 'Status', 'Action'].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{d.recent.map((o) => <tr key={o._id} className="border-t"><td className="p-3 font-bold">{o.code}</td><td className="p-3">{o.user?.name}</td><td className="max-w-[180px] truncate p-3">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</td><td className="p-3">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td className="p-3"><Badge s={o.status} /></td>
        <td className="space-x-1 whitespace-nowrap p-3">{o.status === 'PENDING' && <><button className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white" onClick={() => act(o, 'CONFIRMED')}>Accept</button><button className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white" onClick={() => act(o, 'REJECTED')}>Reject</button></>}<button className="rounded border px-2 py-1 text-xs font-bold" onClick={() => go('Orders')}>View</button></td></tr>)}
        {d.recent.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-neutral-500">No orders yet.</td></tr>}</tbody></table></div></>;
}
function Orders() {
  const [os, setOs] = useState(null), [msg, setMsg] = useState(''); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/orders').then(setOs).catch(() => setOs([])); }, []);
  async function set(o, status) {
    let reason; if (status === 'REJECTED') { reason = prompt('Reason for rejecting this order?'); if (!reason) return; }
    try { await api(`/admin/orders/${o._id}/status`, { method: 'PATCH', body: { status, reason } }); sync(); } catch (e) { toast(e.message); }
  }
  if (!os) return <div className="skeleton h-40" />;
  return os.length === 0 ? <p className="text-neutral-500">No orders yet.</p> : os.map((o) => <div key={o._id} className="mb-3 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>#{o.code} · {o.user?.name}</b><span>{money(o.total)} · {o.payment.method} · {o.payment.status}</span></div>
    <p className="text-sm text-neutral-600">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p><p className="text-sm text-neutral-500">{o.address?.line1}, {o.address?.area}, {o.address?.city} · {o.address?.phone} · {o.deliverySlot}, {o.deliveryDate}{o.note ? ` · “${o.note}”` : ''}</p>
    <Timeline status={o.status} /><div className="mt-2 flex flex-wrap gap-2">{(NEXT[o.status] || []).map((s) => <button key={s} className={s === 'REJECTED' ? btn2 : btn} onClick={() => set(o, s)}>{s === 'CONFIRMED' ? 'Accept' : s === 'REJECTED' ? 'Reject' : 'Mark ' + label(s)}</button>)}{['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status) && <button className={btn2} onClick={() => set(o, 'CANCELLED')}>Cancel</button>}</div></div>);
}
function Custom({ openChat }) {
  const [rs, setRs] = useState(null), [price, setPrice] = useState({}); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/custom-orders').then(setRs).catch(() => setRs([])); }, []);
  async function act(r, kind) {
    try {
      if (kind === 'accept') await api(`/admin/custom-orders/${r._id}/accept`, { method: 'POST', body: { finalPrice: +(price[r._id] ?? r.estimatedPrice) } });
      else { const reason = prompt('Reason for rejecting (the customer will see this)?'); if (!reason) return; await api(`/admin/custom-orders/${r._id}/reject`, { method: 'POST', body: { reason } }); }
      sync();
    } catch (e) { toast(e.message); }
  }
  if (!rs) return <div className="skeleton h-40" />;
  return rs.length === 0 ? <p className="text-neutral-500">No custom cake requests yet.</p> : rs.map((r) => { const c = r.customization; return (
    <div key={r._id} className={'mb-3 rounded-xl border p-4 ' + (r.status === 'PENDING' ? 'border-brand bg-brand-soft' : 'bg-white')}>
      <div className="flex items-center justify-between"><b>{r.status === 'PENDING' ? '🔔 New Custom Cake Request' : 'Custom request'} #{r.code}</b><Badge s={r.status} /></div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 text-sm"><dt className="text-neutral-500">Customer</dt><dd>{r.user?.name} ({r.user?.phone})</dd><dt className="text-neutral-500">Cake</dt><dd>{r.productName}</dd><dt className="text-neutral-500">Size</dt><dd>{c.kg} KG</dd><dt className="text-neutral-500">Flavor / shape</dt><dd>{c.flavor} · {c.shape} · {c.cream}</dd><dt className="text-neutral-500">Eggless</dt><dd>{c.eggless ? 'Yes' : 'No'}</dd><dt className="text-neutral-500">Message</dt><dd>{c.message || '-'}</dd><dt className="text-neutral-500">Toppings</dt><dd>{c.toppings?.join(', ') || '-'}</dd><dt className="text-neutral-500">Notes</dt><dd>{c.notes || '-'}</dd><dt className="text-neutral-500">Delivery</dt><dd>{r.deliveryTime}, {r.deliveryDate}</dd><dt className="text-neutral-500">Estimate</dt><dd>{money(r.estimatedPrice)}</dd></dl>
      {c.photo && <a href={img(c.photo)} target="_blank" rel="noreferrer"><img src={img(c.photo)} alt="Customer reference" className="mt-2 h-24 rounded-lg" /></a>}
      {r.status === 'PENDING' && <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-sm font-semibold">Final price ₹<input type="number" min={1} className="ml-1 w-24 rounded-lg border px-2 py-1" defaultValue={r.estimatedPrice} onChange={(e) => setPrice({ ...price, [r._id]: e.target.value })} /></label>
        <button className={btn} onClick={() => act(r, 'accept')}>Accept ₹{price[r._id] ?? r.estimatedPrice}</button><button className={btn2} onClick={() => act(r, 'reject')}>Reject</button><button className={btn2} onClick={() => openChat(r.user?._id)}>Chat</button></div>}
      {r.status === 'ACCEPTED' && <p className="mt-2 text-sm">Accepted at {money(r.finalPrice)}. Waiting for the customer to pay.</p>}{r.status === 'REJECTED' && <p className="mt-2 text-sm">Reason: {r.rejectReason}</p>}</div>); });
}
function Products() {
  const [ps, setPs] = useState(null), [cats, setCats] = useState([]), [err, setErr] = useState(''); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/products').then(setPs).catch(() => setPs([])); api('/admin/categories').then(setCats).catch(() => {}); }, []);
  async function add(e) {
    e.preventDefault(); setErr(''); const f = new FormData(e.target);
    ['featured', 'popular', 'customizable', 'eggless'].forEach((k) => f.set(k, e.target[k].checked));
    try { await api('/admin/products', { method: 'POST', form: f }); e.target.reset(); toast('Product published. Customers are notified in real time.'); sync(); } catch (x) { setErr(x.message); }
  }
  async function patch(p, body) { const f = new FormData(); Object.entries(body).forEach(([k, v]) => f.set(k, v)); try { await api('/admin/products/' + p._id, { method: 'PUT', form: f }); sync(); } catch (x) { toast(x.message); } }
  return (<><form onSubmit={add} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"><h2 className="font-extrabold sm:col-span-3">Add product</h2>
    <input name="name" required placeholder="Name" aria-label="Name" className={inp} /><select name="category" required aria-label="Category" className={inp}>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select><input name="emoji" placeholder="Emoji (shown if no image)" aria-label="Emoji" className={inp} />
    <input name="price" type="number" min="0" required placeholder="Price ₹ (per KG for cakes)" aria-label="Price" className={inp} /><input name="comparePrice" type="number" min="0" placeholder="Old price (optional)" aria-label="Old price" className={inp} /><input name="stock" type="number" min="0" required placeholder="Stock" aria-label="Stock" className={inp} />
    <input name="unit" placeholder="Unit (pc, kg, pack)" aria-label="Unit" className={inp} /><input name="tags" placeholder="Tags, comma separated" aria-label="Tags" className={inp} /><input name="image" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Image" />
    <textarea name="description" placeholder="Description" aria-label="Description" className={inp + ' sm:col-span-3'} rows={2} />
    <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">{['featured', 'popular', 'customizable', 'eggless'].map((k) => <label key={k}><input type="checkbox" name={k} /> {label(k)}</label>)}</div>
    {err && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{err}</p>}<button className={btn + ' sm:col-span-3'}>Publish product</button></form>
    <h2 className="mb-2 mt-6 font-extrabold">All products</h2>{!ps ? <div className="skeleton h-32" /> : ps.map((p) => <div key={p._id} className={'mb-2 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm ' + (p.active ? '' : 'opacity-50')}><span className="text-2xl">{p.emoji}</span><b className="min-w-0 flex-1">{p.name}</b>
      <label>₹<input type="number" defaultValue={p.price} className="ml-1 w-20 rounded border px-1" onBlur={(e) => +e.target.value !== p.price && patch(p, { price: e.target.value })} /></label><label>Stock<input type="number" defaultValue={p.stock} className={'ml-1 w-16 rounded border px-1 ' + (p.stock <= 5 ? 'border-red-400' : '')} onBlur={(e) => +e.target.value !== p.stock && patch(p, { stock: e.target.value })} /></label>
      <button className={btn2} onClick={() => patch(p, { active: !p.active })}>{p.active ? 'Disable' : 'Enable'}</button></div>)}</>);
}
function Customers() {
  const [cs, setCs] = useState(null); useSync(() => { api('/admin/customers').then(setCs).catch(() => setCs([])); }, []);
  if (!cs) return <div className="skeleton h-32" />;
  return cs.map((c) => <div key={c._id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm"><div><b>{c.name}</b><div className="text-neutral-500">{c.email} · {c.phone}</div></div><span>{c.orders} orders · {money(c.spent)}</span><button className={btn2} onClick={async () => { await api('/admin/customers/' + c._id, { method: 'PATCH', body: { active: !c.active } }); sync(); }}>{c.active ? 'Disable account' : 'Enable account'}</button></div>);
}
function Coupons() {
  const [cs, setCs] = useState([]), [err, setErr] = useState(''); useSync(() => { api('/admin/coupons').then(setCs).catch(() => {}); }, []);
  async function add(e) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); setErr('');
    const body = { code: f.code, type: f.type, amount: +f.amount, minOrder: +f.minOrder || 0, ...(f.maxDiscount && { maxDiscount: +f.maxDiscount }), ...(f.expiresAt && { expiresAt: f.expiresAt }), ...(f.usageLimit && { usageLimit: +f.usageLimit }) };
    try { await api('/admin/coupons', { method: 'POST', body }); e.target.reset(); sync(); } catch (x) { setErr(x.message); }
  }
  return <><form onSubmit={add} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"><input name="code" required placeholder="Code e.g. SHIVAM10" aria-label="Code" className={inp} /><select name="type" aria-label="Type" className={inp}><option value="PERCENT">Percent off</option><option value="FLAT">Flat ₹ off</option></select><input name="amount" type="number" required placeholder="Amount" aria-label="Amount" className={inp} />
    <input name="minOrder" type="number" placeholder="Min order ₹" aria-label="Min order" className={inp} /><input name="maxDiscount" type="number" placeholder="Max discount ₹" aria-label="Max discount" className={inp} /><input name="expiresAt" type="date" aria-label="Expiry" className={inp} /><input name="usageLimit" type="number" placeholder="Usage limit" aria-label="Usage limit" className={inp} />
    {err && <p role="alert" className="text-sm text-red-600">{err}</p>}<button className={btn + ' sm:col-span-3'}>Create coupon</button></form>
    {cs.map((c) => <div key={c._id} className="mt-2 flex items-center justify-between rounded-xl border bg-white p-3 text-sm"><b>{c.code}</b><span>{c.type === 'PERCENT' ? c.amount + '%' : money(c.amount)} · min {money(c.minOrder)} · used {c.used}{c.usageLimit ? '/' + c.usageLimit : ''}</span><button className={btn2} onClick={async () => { await api('/admin/coupons/' + c._id, { method: 'PATCH', body: { active: !c.active } }); sync(); }}>{c.active ? 'Disable' : 'Enable'}</button></div>)}</>;
}
function Messages({ pick }) {
  const [cs, setCs] = useState([]), [sel, setSel] = useState(pick); useSync(() => { api('/admin/chat').then(setCs).catch(() => {}); }, []);
  return <div className="grid gap-3 md:grid-cols-3"><div>{cs.length === 0 && <p className="text-neutral-500">No conversations yet.</p>}{cs.map((c) => <button key={c.customer} onClick={() => setSel(c.customer)} className={'mb-2 block w-full rounded-xl border p-3 text-left text-sm ' + (sel === c.customer ? 'border-brand bg-brand-soft' : 'bg-white')}><b>{c.name}</b>{c.unread > 0 && <span className="ml-2 rounded-full bg-brand px-2 text-xs text-white">{c.unread}</span>}<div className="truncate text-neutral-500">{c.last}</div></button>)}</div>
    <div className="md:col-span-2">{sel ? <Chat key={sel} base={'/admin/chat/' + sel} me="ADMIN" peer={sel} /> : <p className="text-neutral-500">Select a conversation.</p>}</div></div>;
}
function Categories() {
  const [cs, setCs] = useState([]), [f, setF] = useState({ name: '', emoji: '' }); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/categories').then(setCs).catch(() => {}); }, []);
  async function add(e) { e.preventDefault(); try { await api('/admin/categories', { method: 'POST', body: { name: f.name, emoji: f.emoji || undefined, order: cs.length } }); setF({ name: '', emoji: '' }); sync(); } catch (x) { toast(x.message); } }
  return <><form onSubmit={add} className="mb-4 flex flex-wrap gap-2 rounded-xl border bg-white p-3"><input required className={inp + ' !w-48'} aria-label="Category name" placeholder="Category name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className={inp + ' !w-24'} aria-label="Emoji" placeholder="Emoji" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} /><button className={btn}>Add category</button></form>
    {cs.map((c) => <div key={c._id} className={'mb-2 flex items-center justify-between rounded-xl border bg-white p-3 text-sm ' + (c.active ? '' : 'opacity-50')}><span>{c.emoji} <b>{c.name}</b></span><button className={btn2} onClick={async () => { await api('/admin/categories/' + c._id, { method: 'PUT', body: { active: !c.active } }); sync(); }}>{c.active ? 'Disable' : 'Enable'}</button></div>)}</>;
}
function Settings() {
  const [b, setB] = useState({ title: '', subtitle: '', cta: 'Order Now', link: '/shop/cakes', active: true }), [slots, setSlots] = useState([]), [lab, setLab] = useState(''), [log, setLog] = useState([]); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/banner').then((x) => x && setB(x)).catch(() => {}); api('/admin/delivery-slots').then(setSlots).catch(() => {}); api('/admin/audit').then(setLog).catch(() => {}); }, []);
  async function saveB(e) { e.preventDefault(); try { await api('/admin/banner', { method: 'PUT', body: { title: b.title, subtitle: b.subtitle, cta: b.cta, link: b.link, active: b.active } }); toast('Banner saved'); } catch (x) { toast(x.message); } }
  async function addS(e) { e.preventDefault(); try { await api('/admin/delivery-slots', { method: 'POST', body: { label: lab } }); setLab(''); sync(); } catch (x) { toast(x.message); } }
  return <div className="grid gap-4 lg:grid-cols-2">
    <form onSubmit={saveB} className="space-y-2 rounded-xl border bg-white p-4"><h2 className="font-extrabold">"Today's Special" banner</h2>
      {[['title', 'Title'], ['subtitle', 'Subtitle'], ['cta', 'Button text'], ['link', 'Button link (e.g. /shop/cakes)']].map(([k, l]) => <input key={k} required={k === 'title'} aria-label={l} placeholder={l} className={inp} value={b[k] || ''} onChange={(e) => setB({ ...b, [k]: e.target.value })} />)}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.active} onChange={(e) => setB({ ...b, active: e.target.checked })} />Show on homepage</label><button className={btn}>Save banner</button></form>
    <div className="rounded-xl border bg-white p-4"><h2 className="mb-2 font-extrabold">Delivery slots</h2>{slots.map((s) => <div key={s._id} className="mb-1 flex items-center justify-between text-sm"><span className={s.active ? '' : 'text-neutral-400 line-through'}>{s.label}</span><button className="text-xs font-bold text-brand" onClick={async () => { await api('/admin/delivery-slots/' + s._id, { method: 'PATCH', body: { active: !s.active } }); sync(); }}>{s.active ? 'Disable' : 'Enable'}</button></div>)}
      <form onSubmit={addS} className="mt-2 flex gap-2"><input required className={inp} aria-label="New slot" placeholder="e.g. 8-10" value={lab} onChange={(e) => setLab(e.target.value)} /><button className={btn}>Add</button></form>
      <p className="mt-3 text-xs text-neutral-500">Delivery fee, free-delivery threshold and minimum order are set in the server's .env (DELIVERY_FEE, FREE_DELIVERY_ABOVE, MIN_ORDER).</p></div>
    <div className="rounded-xl border bg-white p-4 lg:col-span-2"><h2 className="mb-2 font-extrabold">Admin activity log</h2>{log.length === 0 && <p className="text-sm text-neutral-500">No activity yet.</p>}{log.slice(0, 20).map((l) => <div key={l._id} className="border-t py-1 text-sm"><b>{l.admin?.name}</b> {l.action} <span className="text-xs text-neutral-400">{new Date(l.createdAt).toLocaleString()}</span></div>)}</div></div>;
}
export default function Admin() {
  const { user, ready, logout } = useStore(); const nav = useNavigate(); const [tab, setTab] = useState('Dashboard'), [open, setOpen] = useState(false), [chatWith, setChatWith] = useState(null);
  if (!ready) return null;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/admin/login" />;
  if (user.mustChangePassword) return <ChangePassword />;
  const go = (t) => { setTab(t); setOpen(false); };
  const Side = <><div className="flex items-center gap-2 p-4"><img src="/img/logo.png" alt="" className="h-11 w-11 object-contain" /><div className="leading-tight"><b className="block text-white">Shivam <span className="text-brand">Store</span></b><span className="text-[11px] text-neutral-400">Admin Panel</span></div></div>
    <nav className="flex-1 space-y-1 px-3" aria-label="Admin">{TABS.map(([t, ic]) => <button key={t} onClick={() => go(t)} className={'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ' + (tab === t ? 'bg-brand text-white' : 'text-neutral-300 hover:bg-white/10')}><Icon n={ic} className="h-4 w-4" />{t}</button>)}</nav>
    <button onClick={() => { logout(); nav('/'); }} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10"><Icon n="logout" className="h-4 w-4" />Logout</button></>;
  return (<div className="min-h-screen bg-neutral-50 md:flex">
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-[#222] md:flex">{Side}</aside>
    {open && <div className="fixed inset-0 z-40 flex md:hidden"><aside className="flex w-64 flex-col bg-[#222]">{Side}</aside><button className="flex-1 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} /></div>}
    <section className="min-w-0 flex-1 p-4 md:p-6"><div className="mb-4 flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-extrabold"><button className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Icon n="menu" className="h-6 w-6" /></button>{tab}</h1>
      <button className={btn + ' hidden sm:inline-flex'} onClick={() => go('Products')}><Icon n="plus" className="h-4 w-4" />Add Product</button></div>
      {tab === 'Dashboard' && <Dash go={go} />}{tab === 'Orders' && <Orders />}{tab === 'Custom Orders' && <Custom openChat={(id) => { setChatWith(id); setTab('Messages'); }} />}
      {tab === 'Products' && <Products />}{tab === 'Categories' && <Categories />}{tab === 'Customers' && <Customers />}{tab === 'Coupons' && <Coupons />}{tab === 'Messages' && <Messages pick={chatWith} />}{tab === 'Settings' && <Settings />}</section></div>);
}
