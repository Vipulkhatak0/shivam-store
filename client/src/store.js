import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';
import { API, api } from './api.js';

let socket;
export const sock = () => socket;
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5); o.start(); o.stop(a.currentTime + 0.5); } catch {} }

export const useStore = create(persist((set, get) => ({
  cart: [], coupon: '', user: null, ready: false, notes: [], unread: 0, toasts: [], wish: [],
  toast: (m) => { const id = Math.random(); set((s) => ({ toasts: [...s.toasts, { id, m }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000); },
  setCoupon: (coupon) => set({ coupon }),
  add: (p, qty = 1) => {
    const c = get().cart, ex = c.find((i) => i.id === p._id), have = ex ? ex.qty : 0;
    if (have + qty > p.stock) return get().toast(`Only ${p.stock} in stock.`);
    set({ cart: ex ? c.map((i) => (i.id === p._id ? { ...i, qty: i.qty + qty } : i)) : [...c, { id: p._id, name: p.name, price: p.price, emoji: p.emoji, image: p.image, stock: p.stock, qty }] });
    get().toast('Added to cart');
  },
  setQty: (id, q) => set((s) => ({ cart: q < 1 ? s.cart.filter((i) => i.id !== id) : s.cart.map((i) => (i.id === id ? { ...i, qty: Math.min(q, i.stock) } : i)) })),
  clearCart: () => set({ cart: [], coupon: '' }),
  async toggleWish(id) {
    if (!get().user) return get().toast('Log in to save items to your wishlist.');
    try { const d = await api('/wishlist/' + id, { method: 'POST' }); set({ wish: d.ids }); get().toast(d.added ? 'Added to wishlist' : 'Removed from wishlist'); window.dispatchEvent(new Event('wish')); } catch (e) { get().toast(e.message); }
  },
  async boot() {
    if (localStorage.getItem('token')) { try { set({ user: (await api('/auth/me')).user }); get().afterLogin(); } catch { localStorage.removeItem('token'); } }
    set({ ready: true });
  },
  async refreshUser() {
    if (!localStorage.getItem('token')) return;
    try { set({ user: (await api('/auth/me')).user }); } catch {}
  },
  afterLogin() { get().connect(); get().loadNotes(); api('/wishlist/ids').then((d) => set({ wish: d.ids })).catch(() => {}); },
  setAuth(token, user) { localStorage.setItem('token', token); set({ user }); get().afterLogin(); },
  setUser: (user) => set({ user }),
  logout() { localStorage.removeItem('token'); socket?.disconnect(); socket = null; set({ user: null, notes: [], unread: 0, wish: [] }); },
  async loadNotes() { try { const d = await api('/notifications'); set({ notes: d.items, unread: d.unread }); } catch {} },
  async readAll() { await api('/notifications/read', { method: 'POST', body: {} }).catch(() => {}); set((s) => ({ unread: 0, notes: s.notes.map((n) => ({ ...n, read: true })) })); },
  connect() {
    socket?.disconnect();
    socket = io(API, { auth: { token: localStorage.getItem('token') } });
    socket.on('notification:new', (n) => {
      set((s) => ({ notes: [n, ...s.notes], unread: s.unread + 1 })); get().toast(`${n.title} ${n.message}`);
      if ('Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.message });
    });
    ['order:created', 'custom-order:new'].forEach((ev) => socket.on(ev, () => { if (get().user?.role === 'ADMIN') beep(); window.dispatchEvent(new Event('sync')); }));
    ['order:updated', 'custom-order:updated', 'chat:message', 'inventory:updated'].forEach((ev) => socket.on(ev, () => window.dispatchEvent(new Event('sync'))));
    socket.on('chat:typing', (d) => window.dispatchEvent(new CustomEvent('typing', { detail: d })));
  },
}), { name: 'shivam-cart', partialize: (s) => ({ cart: s.cart, coupon: s.coupon }) }));