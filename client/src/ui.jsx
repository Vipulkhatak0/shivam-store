import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { img } from './api.js';

export const btn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50';
export const btn2 = 'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 font-semibold transition hover:bg-neutral-100 disabled:opacity-50';
export const inp = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm';
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const STAGES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
export const label = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>', chev: '<path d="m9 18 6-6-6-6"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>', lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>', back: '<path d="m15 18-6-6 6-6"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>', tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>', cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s1.5 2 4 2 4-2 4-2 1.5 2 4 2 4-2 4-2M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>', check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
export const Icon = ({ n, className = 'h-5 w-5', fill }) => <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] }} />;
export const GoogleG = () => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" /></svg>;

export function Logo({ size = 'h-14 w-14', text = 'text-2xl', tagline = true, dark }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2" aria-label="Shivam Store home">
      <img src="/img/logo.png" alt="" className={size + ' shrink-0 object-contain'} />
      <span className="min-w-0 leading-none"><span className={'block truncate font-extrabold tracking-tight ' + text + (dark ? ' text-white' : ' text-cocoa')}>Shivam <span className="text-brand">Store</span></span>
        {tagline && <span className={'mt-1 hidden truncate text-[11px] sm:block ' + (dark ? 'text-neutral-300' : 'text-neutral-600')}>Fresh Cakes • Snacks • Everyday Essentials</span>}</span>
    </Link>);
}
export function Thumb({ p, cls = '' }) {
  return p.image
    ? <img src={img(p.image)} alt={p.name} loading="lazy" className={'bg-white object-contain ' + cls} />
    : <div role="img" aria-label={p.name} className={'flex items-center justify-center bg-neutral-100 ' + cls}><span className="text-sm font-semibold text-neutral-500">Image unavailable</span></div>;
}
export function Qty({ v, set, max = 20 }) {
  return <div className="inline-flex items-center rounded-lg border border-neutral-300 bg-white"><button type="button" aria-label="Decrease quantity" className="px-2.5 py-1.5 text-neutral-600" onClick={() => set(Math.max(1, v - 1))}><Icon n="minus" className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-sm font-semibold" aria-live="polite">{v}</span><button type="button" aria-label="Increase quantity" className="px-2.5 py-1.5 text-neutral-600" onClick={() => set(Math.min(max, v + 1))}><Icon n="plus" className="h-3.5 w-3.5" /></button></div>;
}
const tone = { PENDING: 'bg-amber-100 text-amber-800', ACCEPTED: 'bg-green-100 text-green-800', CONFIRMED: 'bg-green-100 text-green-800', PAID: 'bg-green-100 text-green-800', DELIVERED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-700', CANCELLED: 'bg-neutral-200 text-neutral-700', OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-800', PREPARING: 'bg-sky-100 text-sky-800', READY: 'bg-indigo-100 text-indigo-800' };
export const Badge = ({ s }) => <span className={'whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ' + (tone[s] || 'bg-neutral-100')}>{label(s)}</span>;
export function Timeline({ status }) {
  if (['CANCELLED', 'REJECTED'].includes(status)) return <div className="mt-2"><Badge s={status} /></div>;
  const at = STAGES.indexOf(status);
  return <ol className="mt-3 flex flex-wrap gap-1.5 text-xs">{STAGES.map((s, i) => <li key={s} className={'rounded-md px-2.5 py-1 font-semibold ' + (i <= at ? 'bg-green-600 text-white' : 'bg-neutral-100 text-neutral-500')}>{label(s)}</li>)}</ol>;
}
export function useSync(fn, deps = []) {
  useEffect(() => { fn(); const h = () => fn(); window.addEventListener('sync', h); return () => window.removeEventListener('sync', h); }, deps); // eslint-disable-line
}
export function useSeo(title, desc, ld) {
  useEffect(() => {
    document.title = title ? `${title} | Shivam Store` : 'Shivam Store | Fresh Cakes • Snacks • Everyday Essentials';
    const set = (sel, attr, val, mk) => { let e = document.head.querySelector(sel); if (!e) { e = document.createElement(mk.tag); Object.entries(mk.attrs).forEach(([k, v]) => e.setAttribute(k, v)); document.head.append(e); } e.setAttribute(attr, val); };
    const d = desc || 'Shivam Store: fresh cakes, snacks and everyday groceries, delivered.';
    set('meta[name=description]', 'content', d, { tag: 'meta', attrs: { name: 'description' } });
    set('meta[property="og:title"]', 'content', document.title, { tag: 'meta', attrs: { property: 'og:title' } });
    set('meta[property="og:description"]', 'content', d, { tag: 'meta', attrs: { property: 'og:description' } });
    set('meta[name="twitter:card"]', 'content', 'summary_large_image', { tag: 'meta', attrs: { name: 'twitter:card' } });
    set('link[rel=canonical]', 'href', location.origin + location.pathname, { tag: 'link', attrs: { rel: 'canonical' } });
    let s = document.getElementById('ld-json'); if (s) s.remove();
    if (ld) { s = document.createElement('script'); s.id = 'ld-json'; s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.append(s); }
  }, [title, desc, JSON.stringify(ld)]); // eslint-disable-line
}
export const Skel = ({ n = 6 }) => <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-60" />)}</div>;
export const Field = ({ l, children }) => <label className="block text-sm font-semibold">{l}<div className="mt-1 font-normal">{children}</div></label>;
export const NotFound = () => <div className="p-16 text-center"><h1 className="text-3xl font-extrabold">Page not found</h1><Link to="/" className="mt-4 inline-block text-brand">Back to home</Link></div>;
