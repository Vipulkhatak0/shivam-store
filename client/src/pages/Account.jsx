import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.js';
import { btn, btn2, inp, Icon, useSync, Field } from '../ui.jsx';
import { ProductCard } from './Shop.jsx';
import NotificationSettings from './NotificationSettings.jsx';

const TABS = [['profile', 'Profile'], ['wishlist', 'Wishlist'], ['addresses', 'Addresses'], ['notifications', 'Notifications']];
function Profile() {
  const { user, setUser, toast, logout } = useStore(); const nav = useNavigate();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' }), [pw, setPw] = useState({ current: '', password: '' });
  async function save(e) { e.preventDefault(); try { const d = await api('/auth/me', { method: 'PATCH', body: { name: f.name, ...(f.phone && { phone: f.phone }) } }); setUser(d.user); toast('Profile updated'); } catch (x) { toast(x.message); } }
  async function chg(e) { e.preventDefault(); try { await api('/auth/change-password', { method: 'POST', body: pw }); setPw({ current: '', password: '' }); toast('Password updated'); } catch (x) { toast(x.message); } }
  return <div className="grid gap-4 md:grid-cols-2">
    <form onSubmit={save} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-extrabold">Profile</h2>
      <Field l="Name"><input className={inp} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field l="Email"><input className={inp + ' bg-neutral-50'} disabled value={user.email} /></Field>
      <Field l="Phone"><input className={inp} value={f.phone} placeholder="10-digit mobile" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><button className={btn}>Save changes</button></form>
    <form onSubmit={chg} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-extrabold">Change password</h2>
      <input type="password" required className={inp} aria-label="Current password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><input type="password" required minLength={8} className={inp} aria-label="New password" placeholder="New password (min 8)" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
      <button className={btn}>Update password</button><p className="text-xs text-neutral-500">Signed in with Google? Use “Forgot Password?” on the login page to set one.</p></form>
    <div className="flex flex-wrap gap-2 md:col-span-2"><Link to="/orders" className={btn2}>My orders</Link><button className={btn2} onClick={() => { logout(); nav('/'); }}><Icon n="logout" className="h-4 w-4" />Logout</button></div></div>;
}
function Wishlist() {
  const [items, setItems] = useState(null);
  const load = () => api('/wishlist').then(setItems).catch(() => setItems([]));
  useSync(load, []);
  useEffect(() => { window.addEventListener('wish', load); return () => window.removeEventListener('wish', load); }, []);
  if (!items) return <div className="skeleton h-40" />;
  return items.length === 0 ? <p className="py-10 text-center text-neutral-500">Your wishlist is empty. Tap the heart on any product to save it.</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{items.map((p) => <ProductCard key={p._id} p={p} />)}</div>;
}
function Addresses() {
  const [list, setList] = useState([]), [a, setA] = useState({ label: 'Home', name: '', phone: '', line1: '', area: '', city: '', pincode: '', landmark: '' }); const toast = useStore((s) => s.toast);
  useSync(() => { api('/addresses').then(setList).catch(() => {}); }, []);
  async function add(e) { e.preventDefault(); try { setList(await api('/addresses', { method: 'POST', body: { ...a, landmark: a.landmark || undefined } })); toast('Address saved'); } catch (x) { toast(x.message); } }
  return <div className="grid gap-4 md:grid-cols-2"><div>{list.length === 0 && <p className="text-neutral-500">No saved addresses yet.</p>}
    {list.map((s) => <div key={s._id} className="mb-2 flex items-start justify-between rounded-xl border bg-white p-3 text-sm"><div><b>{s.label}</b> · {s.name}<div className="text-neutral-600">{s.line1}, {s.area}, {s.city} {s.pincode}<br />{s.phone}</div></div><button aria-label="Remove address" className="text-neutral-400 hover:text-brand" onClick={async () => setList(await api('/addresses/' + s._id, { method: 'DELETE' }))}><Icon n="trash" className="h-4 w-4" /></button></div>)}</div>
    <form onSubmit={add} className="space-y-2 rounded-xl border bg-white p-4"><h2 className="font-extrabold">Add address</h2><select aria-label="Label" className={inp} value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })}>{['Home', 'Hostel', 'Work', 'Other'].map((l) => <option key={l}>{l}</option>)}</select>
      {[['name', 'Full Name'], ['phone', 'Phone Number'], ['line1', 'House / Flat, Street'], ['area', 'Area'], ['city', 'City'], ['pincode', 'Pincode'], ['landmark', 'Landmark (optional)']].map(([k, l]) => <input key={k} required={k !== 'landmark'} aria-label={l} placeholder={l} className={inp} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} />)}<button className={btn}>Save address</button></form></div>;
}
function Notes() {
  const { notes, readAll, readOne, deleteNote, unread } = useStore();
  return <div className="space-y-5"><NotificationSettings/><div className="max-w-xl"><div className="mb-2 flex items-center justify-between"><b>{unread} unread</b><button className="text-sm font-semibold text-brand" onClick={readAll}>Mark all as read</button></div>
    {notes.length === 0 && <p className="text-neutral-500">Nothing yet.</p>}{notes.map((n, i) => <div key={n._id || i} className={'mb-2 rounded-xl border p-3 text-sm ' + (n.read ? 'bg-white' : 'bg-brand-soft')}><div className="flex items-start justify-between gap-2"><div><b>{({ORDER_PLACED:'🛍️',ORDER_ACCEPTED:'✅',ORDER_REJECTED:'❌',ORDER_STATUS:'📦',PAYMENT_SUCCESS:'💳',PAYMENT_FAILED:'⚠️',CUSTOM_ORDER:'🎂',CUSTOM_REQUEST:'🎂',CUSTOM_ACCEPTED:'🎉',CUSTOM_REJECTED:'❌',NEW_CUSTOMER:'👤',NEW_MESSAGE:'💬',ORDER_CANCELLED:'⚠️',PROMOTIONS:'🎁',NEW_PRODUCT:'🆕'})[n.type]||'🔔'} {n.title}</b><div className="text-neutral-700">{n.message}</div><div className="text-xs text-neutral-400">{new Date(n.createdAt).toLocaleString()}</div></div><div className="flex shrink-0 gap-2">{!n.read&&<button className="text-xs font-semibold text-brand" onClick={()=>readOne(n._id)}>Mark read</button>}<button aria-label="Delete notification" className="text-xs text-neutral-500" onClick={()=>deleteNote(n._id)}>Delete</button></div></div></div>)}</div>;
  </div>;
}
export default function Account() {
  const { tab = 'profile' } = useParams(); const user = useStore((s) => s.user);
  if (!user) return <Navigate to="/login" />;
  return <div><h1 className="mb-3 text-2xl font-extrabold">My Account</h1>
    <div className="noscroll mb-4 flex gap-2 overflow-x-auto">{TABS.map(([k, l]) => <Link key={k} to={`/account/${k}`} className={'whitespace-nowrap rounded-md border px-4 py-1.5 text-sm font-semibold ' + (tab === k ? 'border-brand bg-brand-soft text-brand' : 'bg-white')}>{l}</Link>)}</div>
    {tab === 'wishlist' ? <Wishlist /> : tab === 'addresses' ? <Addresses /> : tab === 'notifications' ? <Notes /> : <Profile />}</div>;
}
