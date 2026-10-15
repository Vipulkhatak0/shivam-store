import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store.js';
import { Home, Shop } from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import { Cart, Checkout } from './pages/Cart.jsx';
import Orders from './pages/Orders.jsx';
import Account from './pages/Account.jsx';
import Auth from './pages/Auth.jsx';
import Admin from './pages/Admin.jsx';
import { PrivacyPolicy, Terms } from './pages/Legal.jsx';
import { api } from './api.js';
import { Icon, Logo, NotFound } from './ui.jsx';

function Bell() {
  const { notes, unread, readAll } = useStore(); const [open, setOpen] = useState(false); const nav = useNavigate();
  return (
    <div className="relative">
      <button aria-label={`Notifications, ${unread} unread`} className="relative rounded-md p-2 hover:bg-neutral-100" onClick={() => { setOpen(!open); if (!open && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }}>
        <Icon n="bell" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-md bg-brand px-1 text-center text-[11px] font-bold text-white">{unread}</span>}
      </button>
      {open && <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 max-w-[88vw] overflow-auto rounded-xl border bg-white p-2 shadow-xl">
        <div className="flex items-center justify-between p-2"><b>Notifications</b><button className="text-sm font-semibold text-brand" onClick={readAll}>Mark all as read</button></div>
        {notes.length === 0 && <p className="p-3 text-sm text-neutral-500">Nothing yet.</p>}
        {notes.map((n, i) => <button key={n._id || i} onClick={() => { setOpen(false); nav(n.type === 'NEW_MESSAGE' ? '/orders' : n.data?.slug ? `/product/${n.data.slug}` : '/orders'); }} className={'block w-full rounded-lg p-2 text-left text-sm hover:bg-neutral-50 ' + (n.read ? '' : 'bg-brand-soft')}><b>{n.title}</b><div className="text-neutral-600">{n.message}</div></button>)}
      </div>}
    </div>);
}
function Header() {
  const { user, cart, logout, wish } = useStore(); const nav = useNavigate(); const loc = useLocation();
  const [q, setQ] = useState(''), [menu, setMenu] = useState(false), [side, setSide] = useState(false);
  const count = cart.reduce((a, i) => a + i.qty, 0);
  const search = (e) => { e.preventDefault(); nav('/shop?q=' + encodeURIComponent(q)); setSide(false); };
  const L = ({ to, end, children }) => <NavLink to={to} end={end} className={({ isActive }) => 'border-b-2 py-1 text-[15px] font-semibold ' + (isActive ? 'border-brand text-brand' : 'border-transparent hover:text-brand')}>{children}</NavLink>;
  const SearchBox = ({ cls }) => <form onSubmit={search} role="search" className={cls}><div className="flex items-center rounded-lg bg-neutral-100 pr-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." aria-label="Search products" className="w-full min-w-0 rounded-lg bg-transparent px-4 py-2.5 text-sm" /><button aria-label="Search" className="text-neutral-700"><Icon n="search" /></button></div></form>;
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4">
        {loc.pathname !== '/' && <button className="md:hidden" aria-label="Go back" onClick={() => nav(-1)}><Icon n="back" /></button>}
        <Logo size="h-12 w-12 md:h-14 md:w-14" text="text-xl md:text-[28px]" />
        <nav className="mx-auto hidden items-center gap-7 lg:flex" aria-label="Main"><L to="/" end>Home</L><L to="/shop/cakes">Cakes</L><L to="/shop/biscuits">Biscuits</L><L to="/shop/snacks">Snacks</L><L to="/shop/grocery">Grocery</L></nav>
        <SearchBox cls="ml-auto hidden w-64 md:block xl:w-72" />
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <Link to="/account/wishlist" aria-label={`Wishlist, ${wish.length} items`} className="hidden rounded-md p-2 hover:bg-neutral-100 md:block"><Icon n="heart" /></Link>
          <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative hidden rounded-md p-2 hover:bg-neutral-100 md:block"><Icon n="cart" className="h-6 w-6" />{count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-md bg-brand px-1 text-center text-[11px] font-bold text-white">{count}</span>}</Link>
          {user && <Bell />}
          {user ? <div className="relative hidden md:block"><button className="flex items-center gap-1.5 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand" onClick={() => setMenu(!menu)} aria-expanded={menu}><Icon n="user" className="h-4 w-4" />{user.name.split(' ')[0]}</button>
            {menu && <div className="absolute right-0 z-40 mt-2 w-48 rounded-xl border bg-white p-1 shadow-xl" onClick={() => setMenu(false)}>
              {user.role === 'ADMIN' && <Link className="block rounded-lg p-2 hover:bg-neutral-50" to="/admin">Admin panel</Link>}
              {[['/account', 'My Account'], ['/orders', 'My Orders'], ['/account/wishlist', 'Wishlist'], ['/account/addresses', 'Addresses'], ['/account/notifications', 'Notifications']].map(([t, l]) => <Link key={t} className="block rounded-lg p-2 hover:bg-neutral-50" to={t}>{l}</Link>)}
              <button className="block w-full rounded-lg p-2 text-left hover:bg-neutral-50" onClick={() => { logout(); nav('/'); }}>Logout</button></div>}</div>
            : <Link to="/login" className="hidden items-center gap-1.5 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand md:flex"><Icon n="user" className="h-4 w-4" />Login</Link>}
          <button className="rounded-md p-2 md:hidden" aria-label="Menu" aria-expanded={side} onClick={() => setSide(!side)}><Icon n="menu" className="h-6 w-6" /></button>
        </div>
      </div>
      <SearchBox cls="px-4 pb-3 md:hidden" />
      {side && <div className="border-t bg-white px-4 py-2 md:hidden" onClick={() => setSide(false)}>
        {[['/shop/cakes', 'Cakes'], ['/shop/biscuits', 'Biscuits'], ['/shop/snacks', 'Snacks'], ['/shop/grocery', 'Grocery'], ['/account/wishlist', 'Wishlist']].map(([t, l]) => <Link key={t} to={t} className="block py-2 font-semibold">{l}</Link>)}
        {user ? <><Link to="/account" className="block py-2 font-semibold">My Account</Link>{user.role === 'ADMIN' && <Link to="/admin" className="block py-2 font-semibold">Admin panel</Link>}<button className="py-2 font-semibold text-brand" onClick={() => { logout(); nav('/'); }}>Logout</button></> : <Link to="/login" className="block py-2 font-semibold text-brand">Login / Register</Link>}</div>}
    </header>);
}
function BottomNav() {
  const { cart, user } = useStore(); const count = cart.reduce((a, i) => a + i.qty, 0);
  const T = ({ to, i, t, end }) => <NavLink to={to} end={end} className={({ isActive }) => 'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ' + (isActive ? 'text-brand' : 'text-neutral-500')}><Icon n={i} className="h-6 w-6" />{t}{t === 'Cart' && count > 0 && <span className="absolute right-[26%] top-0.5 min-w-[18px] rounded-md bg-brand px-1 text-center text-[10px] text-white">{count}</span>}</NavLink>;
  return <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Bottom"><T to="/" i="home" t="Home" end /><T to="/shop" i="grid" t="Categories" /><T to="/cart" i="cart" t="Cart" /><T to="/orders" i="box" t="Orders" /><T to={user ? '/account' : '/login'} i="user" t="Account" /></nav>;
}
function Footer() {
  return <footer className="border-t bg-neutral-50 px-4 py-6 text-sm text-neutral-700"><div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>Shivam Store</span><nav aria-label="Policies" className="flex gap-5"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms and Conditions</Link></nav></div></footer>;
}
function Toasts() {
  const t = useStore((s) => s.toasts), dismiss=useStore((s)=>s.dismissToast);
  return <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex w-[92%] max-w-md flex-col gap-2 md:bottom-6" aria-live="polite">{t.map((x) => <div key={x.id} role="status" onClick={()=>dismiss(x.id)} className="pointer-events-auto flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-cocoa px-4 py-3 text-sm text-white shadow-lg">{x.m}<button type="button" aria-label="Dismiss notification" onClick={(e)=>{e.stopPropagation();dismiss(x.id);}} className="shrink-0 font-bold">×</button></div>)}</div>;
}
export default function App() {
  const boot = useStore((s) => s.boot), ready = useStore((s) => s.ready), refreshUser = useStore((s) => s.refreshUser);
  const [offline, setOffline] = useState(false); const loc = useLocation();

  useEffect(() => {
    boot();
    api('/categories').catch(() => setOffline(true));
    // remove any stale service worker left over from another project on this port
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    }
    // re-read the user (and role) from the server whenever you return to the tab
    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []); // eslint-disable-line

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  if (!ready) return <div className="p-10 text-center text-neutral-500">Loading…</div>;
  const admin = loc.pathname.startsWith('/admin') && loc.pathname !== '/admin/login';
  return (<>
    {!admin && <Header />}
    {offline && <div className="bg-amber-100 p-2 text-center text-sm">Sorry</div>}
    <main className={admin ? '' : 'mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-10'}>
      <Routes>
        <Route path="/" element={<Home />} /><Route path="/shop" element={<Shop />} /><Route path="/shop/:cat" element={<Shop />} /><Route path="/category/:cat" element={<Shop />} />
        <Route path="/product/:slug" element={<Product />} /><Route path="/cart" element={<Cart />} /><Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} /><Route path="/account/:tab?" element={<Account />} />
        <Route path="/privacy" element={<PrivacyPolicy />} /><Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Auth />} /><Route path="/admin/login" element={<Auth admin />} /><Route path="/admin/*" element={<Admin />} /><Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    {!admin && <><Footer /><BottomNav /></>}<Toasts />
  </>);
}
