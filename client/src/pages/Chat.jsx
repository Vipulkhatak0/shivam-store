import { useEffect, useRef, useState } from 'react';
import { api, img } from '../api.js';
import { sock } from '../store.js';
import { btn, inp, useSync, Icon } from '../ui.jsx';
// base: '/chat' (customer) or '/admin/chat/<customerId>' (admin). Live updates arrive through Socket.IO.
export default function Chat({ base, me, peer }) {
  const [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [file, setFile] = useState(null), [err, setErr] = useState(''), [typing, setTyping] = useState(false); const end = useRef(), last = useRef(0), timer = useRef();
  useSync(() => { api(base).then((m) => { setMsgs(m); setTimeout(() => end.current?.scrollIntoView(), 50); }).catch((e) => setErr(e.message)); }, [base]);
  useEffect(() => {
    const h = (e) => { const d = e.detail; if ((me === 'CUSTOMER' && d.from === 'admin') || (me === 'ADMIN' && d.from === peer)) { setTyping(true); clearTimeout(timer.current); timer.current = setTimeout(() => setTyping(false), 2500); } };
    window.addEventListener('typing', h); return () => window.removeEventListener('typing', h);
  }, [me, peer]);
  const onType = (v) => { setT(v); if (Date.now() - last.current > 1500) { last.current = Date.now(); sock()?.emit('chat:typing', { to: peer }); } };
  async function send(e) {
    e.preventDefault(); if (!t.trim() && !file) return;
    try { const f = new FormData(); f.set('text', t.trim()); if (file) f.set('file', file); await api(base, { method: 'POST', form: f }); setT(''); setFile(null); setErr(''); window.dispatchEvent(new Event('sync')); } catch (x) { setErr(x.message); }
  }
  return (
    <div className="rounded-xl border bg-white p-3"><div className="flex max-h-72 min-h-24 flex-col gap-1.5 overflow-auto" aria-live="polite">
      {msgs.length === 0 && <p className="text-sm text-neutral-500">No messages yet. Say hello!</p>}
      {msgs.map((m) => <div key={m._id} className={'max-w-[80%] rounded-xl px-3 py-1.5 text-sm ' + (m.senderRole === me ? 'self-end bg-brand-soft' : 'self-start bg-neutral-100')}>
        {m.attachments?.map((a) => <a key={a} href={img(a)} target="_blank" rel="noreferrer"><img src={img(a)} alt="Attachment" className="mb-1 max-h-40 rounded-lg" /></a>)}{m.text}
        <div className="text-[10px] text-neutral-400">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.senderRole === me ? (m.read ? ' · Read' : ' · Sent') : ''}</div></div>)}
      {typing && <div className="self-start text-xs italic text-neutral-500">typing…</div>}<div ref={end} /></div>
    {err && <p className="text-xs text-red-600">{err}</p>}
    <form onSubmit={send} className="mt-2 flex items-center gap-2"><label className="cursor-pointer rounded-lg border p-2" title="Attach a photo"><Icon n="clip" className="h-4 w-4" /><span className="sr-only">Attach a photo</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files[0])} /></label>
      <input className={inp} value={t} onChange={(e) => onType(e.target.value)} placeholder={file ? file.name : 'Type a message'} aria-label="Message" maxLength={1000} /><button className={btn}>Send</button></form></div>);
}
