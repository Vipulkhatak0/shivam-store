import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, img } from '../api.js';
import { useStore } from '../store.js';
import { Thumb, money, btn, btn2, inp, Field, useSync, useSeo, NotFound, Icon, Qty } from '../ui.jsx';

const SIZES = [0.5, 1, 1.5, 2, 3], FLAVORS = ['Chocolate', 'Vanilla', 'Butterscotch', 'Red Velvet', 'Black Forest', 'Pineapple', 'Strawberry'];
const TOPS = ['Strawberry', 'Chocolate', 'Oreo', 'KitKat', 'Ferrero', 'Nuts'], TIMES = ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM'];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const Chip = ({ on, children, ...r }) => <button type="button" aria-pressed={on} {...r} className={'rounded-full border px-3 py-1 text-sm font-semibold ' + (on ? 'border-brand bg-brand-soft text-brand' : 'bg-white')}>{children}</button>;

function Customize({ p }) {
  const { user, toast } = useStore(); const nav = useNavigate();
  const [c, setC] = useState({ kg: 2, flavor: FLAVORS.find((f) => p.name.includes(f.split(' ')[0])) || 'Chocolate', shape: 'Round', cream: 'Whipped Cream', theme: 'Birthday', eggless: true, message: '', notes: '', toppings: [], deliveryDate: today(), deliveryTime: '6:00 PM' });
  const [a, setA] = useState({ name: user?.name || '', phone: user?.phone || '', line1: '', area: '', city: '', pincode: '' });
  const [photo, setPhoto] = useState(null), [est, setEst] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  useEffect(() => { api('/custom-orders/estimate', { method: 'POST', body: { productId: p._id, kg: c.kg, shape: c.shape, eggless: c.eggless, toppings: c.toppings } }).then(setEst).catch(() => setEst(null)); }, [c.kg, c.shape, c.toppings, p._id]); // eslint-disable-line
  async function send(e) {
    e.preventDefault(); setErr('');
    if (!user) return nav('/login');
    setBusy(true);
    try {
      const f = new FormData(); f.set('productId', p._id);
      Object.entries(c).forEach(([k, v]) => f.set(k, Array.isArray(v) ? v.join(',') : v)); f.set('address', JSON.stringify(a)); if (photo) f.set('photo', photo);
      await api('/custom-orders', { method: 'POST', form: f }); toast('Custom cake request sent'); nav('/orders');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <form id="customize" onSubmit={send} className="mt-8 space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-extrabold">Customize your cake</h2>
      <Field l="Size"><div className="flex flex-wrap gap-2">{SIZES.map((s) => <Chip key={s} on={c.kg === s} onClick={() => set('kg', s)}>{s} kg</Chip>)}</div></Field>
      <Field l="Flavor"><div className="flex flex-wrap gap-2">{FLAVORS.map((s) => <Chip key={s} on={c.flavor === s} onClick={() => set('flavor', s)}>{s}</Chip>)}</div></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field l="Shape"><select className={inp} value={c.shape} onChange={(e) => set('shape', e.target.value)}><option>Round</option><option>Heart</option><option>Square</option></select></Field>
        <Field l="Cream"><select className={inp} value={c.cream} onChange={(e) => set('cream', e.target.value)}><option>Whipped Cream</option><option>Buttercream</option><option>Chocolate</option></select></Field>
        <Field l="Theme"><select className={inp} value={c.theme} onChange={(e) => set('theme', e.target.value)}>{['Birthday', 'Anniversary', 'Wedding', 'Kids', 'Custom'].map((t) => <option key={t}>{t}</option>)}</select></Field></div>
      <Field l="Egg preference"><div className="flex gap-2"><Chip on={c.eggless} onClick={() => set('eggless', true)}>Eggless</Chip><Chip on={!c.eggless} onClick={() => set('eggless', false)}>Egg</Chip></div></Field>
      <Field l="Toppings (₹40 each)"><div className="flex flex-wrap gap-2">{TOPS.map((t) => <Chip key={t} on={c.toppings.includes(t)} onClick={() => set('toppings', c.toppings.includes(t) ? c.toppings.filter((x) => x !== t) : [...c.toppings, t])}>{t}</Chip>)}</div></Field>
      <Field l="Message on cake"><input className={inp} maxLength={60} placeholder="Happy Birthday Vipul" value={c.message} onChange={(e) => set('message', e.target.value)} /></Field>
      <Field l="Reference photo (optional)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhoto(e.target.files[0])} /></Field>
      <Field l="Additional instructions"><textarea className={inp} rows={2} maxLength={400} value={c.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field l="Delivery date"><input type="date" required min={today()} className={inp} value={c.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} /></Field>
        <Field l="Delivery time"><select className={inp} value={c.deliveryTime} onChange={(e) => set('deliveryTime', e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></Field></div>
      <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-1 text-sm font-semibold">Delivery address</legend>
        {[['name', 'Name'], ['phone', 'Mobile (10 digits)'], ['line1', 'House / street'], ['area', 'Area'], ['city', 'City'], ['pincode', 'Pincode']].map(([k, l]) => <input key={k} required aria-label={l} placeholder={l} className={inp} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} />)}</fieldset>
      {est && <dl className="rounded-xl bg-cream p-4 text-sm"><div className="flex justify-between"><dt>Base price</dt><dd>{money(est.base)}</dd></div><div className="flex justify-between"><dt>Customization</dt><dd>{money(est.extras)}</dd></div><div className="flex justify-between"><dt>Delivery</dt><dd>{money(est.deliveryFee)}</dd></div><div className="flex justify-between"><dt>Discount</dt><dd>{money(est.discount)}</dd></div><div className="mt-1 flex justify-between border-t pt-1 text-base font-extrabold"><dt>Estimated total</dt><dd>{money(est.total)}</dd></div><p className="mt-1 text-xs text-neutral-500">The bakery confirms the final price before you pay.</p></dl>}
      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
      <button className={btn + ' w-full py-3'} disabled={busy}>{busy ? 'Sending…' : user ? 'Request Custom Cake' : 'Log in to request'}</button>
    </form>);
}
export default function Product() {
  const { slug } = useParams(); const [p, setP] = useState(undefined), [revs, setRevs] = useState([]), [q, setQ] = useState(1);
  const { add, toggleWish, wish } = useStore(); const nav = useNavigate();
  useSeo(p?.name || 'Product', p?.description, p && { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, image: p.image ? [new URL(img(p.image), location.origin).href] : undefined, offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }, ...(p.reviewCount > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount } }) });
  useSync(() => { api('/products/' + slug).then((x) => { setP(x); api(`/products/${x._id}/reviews`).then(setRevs).catch(() => {}); }).catch(() => setP(null)); }, [slug]);
  useEffect(() => { if (p && location.hash === '#customize') setTimeout(() => document.getElementById('customize')?.scrollIntoView({ behavior: 'smooth' }), 100); }, [p]);
  if (p === undefined) return <div className="skeleton h-80" />;
  if (!p) return <NotFound />;
  const liked = wish.includes(p._id);
  return (<>
    <div className="grid gap-6 md:grid-cols-2">
      <div className="relative rounded-2xl border bg-white p-4"><Thumb p={p} cls="mx-auto aspect-square w-full max-w-sm rounded-xl" />
        <button aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={liked} onClick={() => toggleWish(p._id)} className={'absolute right-4 top-4 ' + (liked ? 'text-brand' : 'text-neutral-400')}><Icon n="heart" className="h-6 w-6" fill={liked} /></button></div>
      <div><span className="text-sm text-neutral-500">{p.category?.name}</span><h1 className="text-3xl font-extrabold">{p.name}</h1>
        <p className="text-sm">⭐ {p.rating?.toFixed(1)} · {p.reviewCount} review{p.reviewCount === 1 ? '' : 's'}</p>
        <p className="mt-2 text-3xl font-extrabold">{money(p.price)} <span className="text-base font-normal text-neutral-500">/ {p.unit}</span></p>
        <p className="mt-3 text-neutral-700">{p.description}</p>
        <p className={'mt-3 text-sm font-bold ' + (p.stock > 0 ? 'text-green-700' : 'text-red-600')}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
        {p.eggless && <p className="mt-1 text-sm text-green-700">🟢 Eggless available</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3"><Qty v={q} set={setQ} max={Math.max(1, p.stock)} />
          <button className={btn} disabled={p.stock < 1} onClick={() => add(p, q)}><Icon n="cart" className="h-4 w-4" />Add to Cart</button>
          <button className={btn2} disabled={p.stock < 1} onClick={() => { add(p, q); nav('/cart'); }}>Buy Now</button>
          {p.customizable && <a href="#customize" className={btn2}>Customize</a>}</div></div></div>
    {p.customizable && <Customize p={p} />}
    <h2 className="mb-2 mt-8 text-xl font-extrabold">Reviews</h2>
    {revs.length === 0 ? <p className="text-sm text-neutral-500">No reviews yet. Customers can review a product after it is delivered.</p> : revs.map((r) => <div key={r._id} className="mb-2 rounded-xl border bg-white p-3 text-sm"><b>{r.name}</b> <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span><p className="text-neutral-700">{r.comment}</p></div>)}
  </>);
}
