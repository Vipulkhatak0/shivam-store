import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, img } from '../api.js';
import { useStore } from '../store.js';
import { Thumb, money, btn, btn2, Skel, useSync, useSeo, Icon, Qty } from '../ui.jsx';

export function ProductCard({ p }) {
  const { add, toggleWish, wish } = useStore(); const [q, setQ] = useState(1);
  const off = p.stock < 1, liked = wish.includes(p._id);
  const pct = p.comparePrice > p.price ? Math.round((1 - p.price / p.comparePrice) * 100) : 0;
  return (
    <article className="relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <button aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={liked} onClick={() => toggleWish(p._id)} className={'absolute right-2.5 top-2.5 z-10 ' + (liked ? 'text-brand' : 'text-neutral-400')}><Icon n="heart" className="h-5 w-5" fill={liked} /></button>
      <Link to={`/product/${p.slug}`} className="block"><Thumb p={p} cls="mx-auto h-28 w-full rounded-lg" /></Link>
      <Link to={`/product/${p.slug}`} className="mt-2 text-sm font-bold leading-snug hover:text-brand">{p.name}</Link>
      <div className="flex items-baseline gap-1.5"><b className="text-[15px]">{money(p.price)}</b>{pct > 0 && <s className="text-xs text-neutral-400">{money(p.comparePrice)}</s>}</div>
      <div className="mt-2 flex justify-center"><Qty v={q} set={setQ} max={Math.max(1, p.stock)} /></div>
      <button className={btn + ' mt-2 w-full text-sm'} disabled={off} onClick={() => { add(p, q); setQ(1); }}>{off ? 'Out of Stock' : <><Icon n="cart" className="h-4 w-4" />Add to Cart</>}</button>
      {p.customizable && !off && <Link to={`/product/${p.slug}#customize`} className="mt-1.5 text-center text-xs font-bold text-brand hover:underline">Customize Cake</Link>}
    </article>);
}
const SEC = ({ title, to, children }) => <section className="mt-8"><div className="mb-3 flex items-end justify-between"><h2 className="text-2xl font-extrabold">{title}</h2>{to && <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-brand">View All <Icon n="arrow" className="h-4 w-4" /></Link>}</div>{children}</section>;
export function Home() {
  const [cats, setCats] = useState(null), [pop, setPop] = useState(null), [ban, setBan] = useState(null);
  useSeo('', 'Order fresh cakes, biscuits, snacks and everyday groceries from Shivam Store with fast local delivery.', { '@context': 'https://schema.org', '@type': 'Bakery', name: 'Shivam Store', slogan: 'Fresh Cakes • Snacks • Everyday Essentials', url: location.origin, priceRange: '₹' });
  useSync(() => { api('/categories').then(setCats).catch(() => setCats([])); api('/products?featured=true&limit=6').then((d) => setPop(d.items)).catch(() => setPop([])); api('/banner').then(setBan).catch(() => {}); }, []);
  const top = (cats || []).slice(0, 4), rest = (cats || []).slice(4);
  return (<>
    <section className="relative hidden h-[258px] overflow-hidden rounded-lg bg-peach md:block">
      <img src="/img/hero.png" alt="Shivam Store mascot holding a chocolate cake and giving a thumbs up" className="hero-img absolute right-0 top-0 h-full w-auto max-w-[68%] object-cover object-right" />
      <div className="relative z-10 px-10 pt-9"><h1 className="text-[42px] font-extrabold leading-tight text-cocoa">Cakes, snacks<br />and daily groceries</h1>
        <p className="mt-3 max-w-xs text-[17px] leading-snug text-cocoa/80">Browse the Shivam Store range and place an order for local delivery.</p></div>
      <Link to="/shop" className={btn + ' absolute bottom-6 left-10 z-10 !px-7 !py-2.5 text-lg'}>Browse products <Icon n="arrow" /></Link>
    </section>
    {top.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2 md:hidden">{top.map((c) => <Link key={c._id} to={`/shop/${c.slug}`} className="text-center"><div className="flex h-16 items-center justify-center rounded-xl border bg-white p-1"><img src={img(c.image)} alt="" className="max-h-full object-contain" /></div><span className="text-xs font-semibold">{c.name}</span></Link>)}</div>}
    {ban && <section className="mt-4 flex items-center justify-between overflow-hidden rounded-2xl bg-peach p-4 md:hidden"><div><h2 className="font-extrabold leading-tight text-brand">Today's Special</h2><p className="mt-1 font-semibold leading-tight text-cocoa">{ban.title}<br />{ban.subtitle}</p><Link to={ban.link || '/shop'} className={btn + ' mt-3 !px-4 !py-1.5 text-sm'}>{ban.cta}</Link></div><img src="/img/special.png" alt="" className="h-28 w-28 object-contain" /></section>}
    <div className="mt-4 hidden grid-cols-4 gap-4 md:grid">{!cats ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[66px]" />) : top.map((c) => (
      <Link key={c._id} to={`/shop/${c.slug}`} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-[#F6F3F1] px-4 py-2 transition hover:border-brand"><img src={img(c.image)} alt="" className="h-12 w-16 object-contain mix-blend-multiply" /><b className="flex-1 text-lg">{c.name}</b><Icon n="chev" className="h-5 w-5 text-neutral-500" /></Link>))}</div>
    {rest.length > 0 && <div className="noscroll mt-3 flex gap-2 overflow-x-auto">{rest.map((c) => <Link key={c._id} to={`/shop/${c.slug}`} className="whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-sm font-semibold hover:border-brand">{c.name}</Link>)}</div>}
    <SEC title="Popular Products" to="/shop">{!pop ? <Skel /> : pop.length === 0 ? <p className="text-neutral-500">No products yet</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{pop.map((p) => <ProductCard key={p._id} p={p} />)}</div>}</SEC>
  </>);
}
export function Shop() {
  const { cat } = useParams(); const [sp, setSp] = useSearchParams();
  const [data, setData] = useState(null), [cats, setCats] = useState([]);
  const q = sp.get('q') || '', sort = sp.get('sort') || 'popular', page = +sp.get('page') || 1;
  const cur = cats.find((c) => c.slug === cat);
  useSeo(cur ? cur.name : q ? `Search: ${q}` : 'All products', cur ? `Buy ${cur.name.toLowerCase()} online from Shivam Store.` : undefined);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  useSync(() => {
    setData(null);
    const p = new URLSearchParams({ sort, page, limit: 12 }); if (q) p.set('q', q); if (cat) p.set('category', cat);
    ['eggless', 'customizable'].forEach((k) => sp.get(k) && p.set(k, 'true')); if (sp.get('maxPrice')) p.set('maxPrice', sp.get('maxPrice'));
    api('/products?' + p).then(setData).catch(() => setData({ items: [], total: 0, pages: 1 }));
  }, [cat, sp.toString()]); // eslint-disable-line
  useSync(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  return (<>
    <h1 className="text-2xl font-extrabold">{cur ? cur.name : q ? `Results for “${q}”` : 'All products'}</h1>
    <div className="noscroll my-3 flex gap-2 overflow-x-auto"><Link to="/shop" className={'whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold ' + (!cat ? 'border-brand bg-brand-soft text-brand' : 'bg-white')}>All</Link>
      {cats.map((c) => <Link key={c._id} to={`/shop/${c.slug}`} className={'whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold ' + (cat === c.slug ? 'border-brand bg-brand-soft text-brand' : 'bg-white')}>{c.name}</Link>)}</div>
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="popular">Popular</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="new">Newest</option><option value="rating">Rating</option></select>
      <select aria-label="Max price" value={sp.get('maxPrice') || ''} onChange={(e) => set('maxPrice', e.target.value)} className="rounded-lg border bg-white px-2 py-1.5"><option value="">Any price</option><option value="100">Under ₹100</option><option value="500">Under ₹500</option><option value="1000">Under ₹1000</option></select>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!sp.get('eggless')} onChange={(e) => set('eggless', e.target.checked ? '1' : '')} />Eggless</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!sp.get('customizable')} onChange={(e) => set('customizable', e.target.checked ? '1' : '')} />Customizable</label></div>
    {!data ? <Skel /> : data.items.length === 0 ? <p className="py-16 text-center text-neutral-500">No products found. Try different filters.</p>
      : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{data.items.map((p) => <ProductCard key={p._id} p={p} />)}</div>}
    {data?.pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><button className={btn2} disabled={page < 2} onClick={() => set('page', page - 1)}>Previous</button><span>Page {page} of {data.pages}</span><button className={btn2} disabled={page >= data.pages} onClick={() => set('page', page + 1)}>Next</button></div>}
  </>);
}
