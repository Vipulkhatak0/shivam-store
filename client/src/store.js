import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';
import { API, api } from './api.js';
import { playNotificationSound, stopNotificationSound } from './utils/notificationSound.js';

let socket;
const toastTimers=new Map();
export const sock = () => socket;

export const useStore = create(persist((set, get) => ({
  cart: [], coupon: '', user: null, ready: false, notes: [], unread: 0, toasts: [], wish: [], notificationPrefs:null,
  toast: (m, { notification=false } = {}) => { const id = `${Date.now()}-${Math.random()}`; set((s) => ({ toasts: [...s.toasts, { id, m, notification }] })); const timer=setTimeout(()=>get().dismissToast(id),notification?6000:4000);toastTimers.set(id,timer);return id; },
  dismissToast: (id) => { const timer=toastTimers.get(id);if(timer){clearTimeout(timer);toastTimers.delete(id);}const toast=get().toasts.find(t=>t.id===id);if(toast?.notification)stopNotificationSound(id);set(s=>({toasts:s.toasts.filter(t=>t.id!==id)})); },
  setCoupon: (coupon) => set({ coupon }),
  setNotificationPrefs: (notificationPrefs) => set({ notificationPrefs }),
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
  afterLogin() { get().connect(); get().loadNotes(); api('/notifications/preferences').then((notificationPrefs)=>set({notificationPrefs})).catch(()=>{}); api('/wishlist/ids').then((d) => set({ wish: d.ids })).catch(() => {}); },
  setAuth(token, user) { localStorage.setItem('token', token); set({ user }); get().afterLogin(); },
  setUser: (user) => set({ user }),
  logout() { localStorage.removeItem('token'); socket?.disconnect(); socket = null; stopNotificationSound();for(const timer of toastTimers.values())clearTimeout(timer);toastTimers.clear();set({ user: null, notes: [], unread: 0, wish: [], notificationPrefs:null,toasts:[] }); },
  async loadNotes() { try { const d = await api('/notifications'); set({ notes: d.items, unread: d.unread }); } catch {} },
  async readAll() { await api('/notifications/read', { method: 'POST', body: {} }).catch(() => {}); set((s) => ({ unread: 0, notes: s.notes.map((n) => ({ ...n, read: true })) })); },
  async readOne(id) { await api('/notifications/read',{method:'POST',body:{id}}).catch(()=>{});set((s)=>({notes:s.notes.map(n=>n._id===id?{...n,read:true}:n),unread:Math.max(0,s.unread-(s.notes.find(n=>n._id===id&&!n.read)?1:0))})); },
  async deleteNote(id) { await api('/notifications/'+id,{method:'DELETE'}).catch(()=>{});set((s)=>({notes:s.notes.filter(n=>n._id!==id),unread:Math.max(0,s.unread-(s.notes.find(n=>n._id===id&&!n.read)?1:0))})); },
  connect() {
    socket?.disconnect();
    socket = io(API, { auth: { token: localStorage.getItem('token') } });
    socket.on('notification:new', (n) => {
      set((s) => ({ notes: [n, ...s.notes], unread: s.unread + 1 })); const toastId=get().toast(`${n.title} ${n.message}`,{notification:true});
      const prefs=get().notificationPrefs; playNotificationSound(prefs,toastId);
      if (prefs?.push?.enabled===true && 'Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.message });
    });
    ['order:created', 'custom-order:new'].forEach((ev) => socket.on(ev, () => window.dispatchEvent(new Event('sync'))));
    ['order:updated', 'custom-order:updated', 'chat:message', 'inventory:updated'].forEach((ev) => socket.on(ev, () => window.dispatchEvent(new Event('sync'))));
    socket.on('chat:typing', (d) => window.dispatchEvent(new CustomEvent('typing', { detail: d })));
  },
}), { name: 'shivam-cart', partialize: (s) => ({ cart: s.cart, coupon: s.coupon }) }));
