import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, img } from '../api.js';
import { useStore } from '../store.js';
import { money, btn, btn2, inp, Badge, Timeline, label, useSync, Icon, Logo } from '../ui.jsx';
import Chat from './Chat.jsx';
import NotificationSettings from './NotificationSettings.jsx';

const TABS = [['Dashboard', 'grid'], ['Orders', 'box'], ['Custom Orders', 'cake'], ['Products', 'tag'], ['Categories', 'tag'], ['Customers', 'users'], ['Coupons', 'tag'], ['Messages', 'chat'], ['Settings', 'cog'], ['Notifications', 'bell']];
const NEXT = { PENDING: ['CONFIRMED', 'REJECTED'], CONFIRMED: ['PREPARING', 'REJECTED'], PREPARING: ['READY', 'OUT_FOR_DELIVERY', 'REJECTED'], READY: ['OUT_FOR_DELIVERY', 'DELIVERED'], OUT_FOR_DELIVERY: ['DELIVERED'] };
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
  return os.length === 0 ? <p className="text-neutral-500">No orders yet.</p> : os.map((o) => <div key={o._id} className="mb-3 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>#{o.code} · {o.user?.name}</b><span>{new Date(o.createdAt).toLocaleString()} · {money(o.total)} · {o.payment.method} · {o.payment.status}</span></div>
    <p className="text-xs text-neutral-500">{o.user?.email} · {o.user?.phone}</p><div className="mt-2 space-y-2">{o.items.map((i, k) => <div key={k} className="flex items-center gap-2 text-sm"><img src={img(i.product?.image || i.product?.images?.[0]) || '/img/special.png'} alt="" className="h-10 w-10 rounded object-contain" /><span>{i.qty} × {i.name} · {money(i.price)} each</span></div>)}</div><p className="mt-2 text-sm text-neutral-500">{o.address?.name}, {o.address?.line1}, {o.address?.area}, {o.address?.city}, {o.address?.pincode} · {o.address?.phone} · {o.deliverySlot}, {o.deliveryDate}{o.note ? ` · “${o.note}”` : ''}</p>
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
      <div className="flex items-center justify-between"><b>{r.status === 'PENDING' ? 'New Custom Cake Request' : 'Custom request'} #{r.code}</b><Badge s={r.status} /></div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 text-sm"><dt className="text-neutral-500">Customer</dt><dd>{r.user?.name} ({r.user?.phone})</dd><dt className="text-neutral-500">Cake</dt><dd>{r.productName}</dd><dt className="text-neutral-500">Size</dt><dd>{c.kg} KG</dd><dt className="text-neutral-500">Flavor / shape</dt><dd>{c.flavor} · {c.shape} · {c.cream}</dd><dt className="text-neutral-500">Eggless</dt><dd>{c.eggless ? 'Yes' : 'No'}</dd><dt className="text-neutral-500">Message</dt><dd>{c.message || '-'}</dd><dt className="text-neutral-500">Toppings</dt><dd>{c.toppings?.join(', ') || '-'}</dd><dt className="text-neutral-500">Notes</dt><dd>{c.notes || '-'}</dd><dt className="text-neutral-500">Delivery</dt><dd>{r.deliveryTime}, {r.deliveryDate}</dd><dt className="text-neutral-500">Estimate</dt><dd>{money(r.estimatedPrice)}</dd></dl>
      {c.photo && <a href={img(c.photo)} target="_blank" rel="noreferrer"><img src={img(c.photo)} alt="Customer reference" className="mt-2 h-24 rounded-lg" /></a>}
      {r.status === 'PENDING' && <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-sm font-semibold">Final price ₹<input type="number" min={1} className="ml-1 w-24 rounded-lg border px-2 py-1" defaultValue={r.estimatedPrice} onChange={(e) => setPrice({ ...price, [r._id]: e.target.value })} /></label>
        <button className={btn} onClick={() => act(r, 'accept')}>Accept ₹{price[r._id] ?? r.estimatedPrice}</button><button className={btn2} onClick={() => act(r, 'reject')}>Reject</button><button className={btn2} onClick={() => openChat(r.user?._id)}>Chat</button></div>}
      {r.status === 'ACCEPTED' && <p className="mt-2 text-sm">Accepted at {money(r.finalPrice)}. Waiting for the customer to pay.</p>}{r.status === 'REJECTED' && <p className="mt-2 text-sm">Reason: {r.rejectReason}</p>}</div>); });
}
function Products() {
  const [ps, setPs] = useState(null), [cats, setCats] = useState([]), [err, setErr] = useState(''), [files,setFiles]=useState([]), [main,setMain]=useState(0), [progress,setProgress]=useState(null), [aiDescription,setAiDescription]=useState(''), [aiLoading,setAiLoading]=useState(false), [aiError,setAiError]=useState(''), [cameraNotice,setCameraNotice]=useState(''); const toast = useStore((s) => s.toast), cameraInput=useRef(null), galleryInput=useRef(null), productForm=useRef(null), [mobileCapture]=useState(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(pointer: coarse)').matches);
  useSync(() => { api('/admin/products').then(setPs).catch(() => setPs([])); api('/admin/categories').then(setCats).catch(() => {}); }, []);
  function addFiles(list){const next=[...files];for(const f of list){if(!/^image\/(png|jpeg|webp)$/.test(f.type)){setErr('Unsupported image format.');continue;}if(f.size>5*1024*1024){setErr('Image must be smaller than 5 MB.');continue;}if(next.length>=8){setErr('You can upload up to 8 images.');break;}next.push({file:f,url:URL.createObjectURL(f)});}setFiles(next);if(!next.length)setMain(0);}
  function replaceFile(index,file){if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setErr('Unsupported image format.');return;}if(file.size>5*1024*1024){setErr('Image must be smaller than 5 MB.');return;}const url=URL.createObjectURL(file);URL.revokeObjectURL(files[index].url);setFiles(files.map((x,i)=>i===index?{file,url}:x));setErr('');}
  function openCamera(){const input=cameraInput.current;if(!mobileCapture||!input||!('capture' in input)){setCameraNotice("Camera isn't available in this browser. Please use Upload Image.");return;}setCameraNotice('');input.click();}
  async function generateProduct(){if(aiLoading)return;setAiError('');setAiLoading(true);try{const d=await api('/admin/products/ai-generate',{method:'POST',body:{description:aiDescription}});const form=productForm.current;if(!form)throw new Error('Product form is unavailable.');const category=cats.find(c=>c.name.toLowerCase()===String(d.category||'').toLowerCase());for(const [key,value] of Object.entries({name:d.name,description:d.description,category:category?._id||'',price:d.price,comparePrice:d.compareAtPrice??'',brand:d.brand||'',condition:d.condition||'',tags:Array.isArray(d.tags)?d.tags.join(', '):'',stock:d.stock})){const field=form.elements.namedItem(key);if(field)field.value=String(value);}toast('AI product details generated. Please review before adding the product.');}catch(e){setAiError(e.message||'Unable to generate product details. Please try again.');}finally{setAiLoading(false);}}
  function upload(form){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',(import.meta.env.VITE_API_URL||'http://localhost:5000')+'/api/admin/products');const token=localStorage.getItem('token');if(token)x.setRequestHeader('Authorization','Bearer '+token);x.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100));};x.onload=()=>{try{const j=JSON.parse(x.responseText);if(x.status>=200&&x.status<300&&j.success!==false)resolve(j.data);else reject(new Error(j.message||'Image upload failed. Please try again.'));}catch{reject(new Error('Image upload failed. Please try again.'));}};x.onerror=()=>reject(new Error('Image upload failed. Please try again.'));x.send(form);});}
  async function add(e) {
    e.preventDefault(); setErr(''); const f = new FormData(e.target); f.delete('image');files.forEach(x=>f.append('images',x.file));f.set('mainImageIndex',String(main));
    ['featured', 'popular', 'customizable', 'eggless'].forEach((k) => f.set(k, e.target[k].checked));
    try { setProgress(0); await upload(f); e.target.reset();files.forEach(x=>URL.revokeObjectURL(x.url));setFiles([]);setMain(0);toast('Product published. Customers are notified in real time.');sync(); } catch (x) { setErr(x.message); } finally {setProgress(null);}
  }
  async function patch(p, body) { const f = new FormData(); Object.entries(body).forEach(([k, v]) => f.set(k, v)); try { await api('/admin/products/' + p._id, { method: 'PUT', form: f }); sync(); } catch (x) { toast(x.message); } }
  return (<><section className="mb-3 rounded-2xl border bg-white p-4"><label className="block text-sm font-bold" htmlFor="ai-product-description">AI Add Product</label><textarea id="ai-product-description" value={aiDescription} onChange={e=>setAiDescription(e.target.value)} maxLength={500} placeholder="Describe the product, e.g. Samsung Galaxy S24 128GB used in excellent condition..." className={inp+' mt-2'} rows={2}/><div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" disabled={aiLoading||aiDescription.trim().length<5||cats.length===0} onClick={generateProduct} className={btn}>{aiLoading?'Generating...':'✨ Generate with AI'}</button>{aiError&&<p role="alert" className="text-sm text-red-600">{aiError}</p>}</div></section><form ref={productForm} onSubmit={add} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"><h2 className="font-extrabold sm:col-span-3">Add product</h2>
    <input name="name" required placeholder="Name" aria-label="Name" className={inp} /><select name="category" required aria-label="Category" className={inp}>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
    <input name="price" type="number" min="0" required placeholder="Price ₹ (per KG for cakes)" aria-label="Price" className={inp} /><input name="comparePrice" type="number" min="0" placeholder="Old price (optional)" aria-label="Old price" className={inp} /><input name="stock" type="number" min="0" required placeholder="Stock" aria-label="Stock" className={inp} />
    <input name="brand" placeholder="Brand (optional)" aria-label="Brand" className={inp} /><input name="condition" placeholder="Condition (optional)" aria-label="Condition" className={inp} /><input name="unit" placeholder="Unit (pc, kg, pack)" aria-label="Unit" className={inp} /><input name="tags" placeholder="Tags, comma separated" aria-label="Tags" className={inp} />
    <div role="group" aria-label="Product images" onClick={e=>{if(e.target===e.currentTarget||e.target.closest('[data-image-dropzone]'))galleryInput.current?.click();}} className="relative flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-neutral-800 hover:border-brand hover:bg-brand-soft dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 sm:col-span-3">
      <div data-image-dropzone className="pointer-events-none flex flex-col items-center gap-2"><Icon n="camera" className="h-10 w-10 text-brand"/><strong>{files.length?'Add another product image':'Add Product Image'}</strong><span className="text-sm text-neutral-600 dark:text-neutral-300">Take a photo or choose an image from your device</span></div>
      <div className="relative z-10 flex flex-wrap justify-center gap-2"><button type="button" className={btn2} onClick={e=>{e.stopPropagation();openCamera();}}><Icon n="camera" className="h-4 w-4"/>Take Photo</button><button type="button" className={btn2} onClick={e=>{e.stopPropagation();setCameraNotice('');galleryInput.current?.click();}}>Upload Image</button></div>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take product photo" onChange={e=>{addFiles(e.target.files);e.currentTarget.value='';}}/><input ref={galleryInput} type="file" accept="image/*" multiple className="sr-only" aria-label="Upload product images" onChange={e=>{addFiles(e.target.files);e.currentTarget.value='';}}/>
      {cameraNotice&&<p role="status" className="text-sm font-semibold text-amber-800 dark:text-amber-200">{cameraNotice}</p>}
    </div>
    {files.length>0&&<div className="grid grid-cols-2 gap-2 sm:col-span-3 sm:grid-cols-4">{files.map((x,i)=><div key={x.url} className="relative rounded-xl border p-2"><img src={x.url} alt={`Product preview ${i+1}`} className="h-28 w-full rounded-lg object-cover"/><button type="button" onClick={()=>{URL.revokeObjectURL(x.url);setFiles(files.filter((_,j)=>j!==i));setMain(m=>m===i?0:m>i?m-1:m);}} className="absolute right-3 top-3 rounded bg-white px-2 py-1 text-xs">Remove</button><label className="mt-2 block w-full cursor-pointer rounded border px-2 py-1 text-center text-xs">Replace<input type="file" accept="image/*" capture={mobileCapture?'environment':undefined} className="sr-only" onChange={e=>{replaceFile(i,e.target.files?.[0]);e.currentTarget.value='';}}/></label><button type="button" onClick={()=>setMain(i)} className="mt-2 w-full rounded border px-2 py-1 text-xs">{main===i?'Primary Image':'Set as Main Image'}</button></div>)}</div>}
    <textarea name="description" placeholder="Description" aria-label="Description" className={inp + ' sm:col-span-3'} rows={2} />
    <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">{['featured', 'popular', 'customizable', 'eggless'].map((k) => <label key={k}><input type="checkbox" name={k} /> {label(k)}</label>)}</div>
    {progress!==null&&<div className="sm:col-span-3" aria-live="polite"><p>Uploading... {progress}%</p><progress className="w-full" value={progress} max="100"/></div>}{err && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{err}</p>}<button disabled={progress!==null} className={btn + ' sm:col-span-3'}>{progress!==null?'Uploading...':'Publish product'}</button></form>
    <h2 className="mb-2 mt-6 font-extrabold">All products</h2>{!ps ? <div className="skeleton h-32" /> : ps.map((p) => <div key={p._id} className={'mb-2 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm ' + (p.active ? '' : 'opacity-50')}><b className="min-w-0 flex-1">{p.name}</b>
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
  return <div className="grid gap-3 md:grid-cols-3"><div>{cs.length === 0 && <p className="text-neutral-500">No conversations yet.</p>}{cs.map((c) => <button key={c.customer} onClick={() => setSel(c.customer)} className={'mb-2 block w-full rounded-xl border p-3 text-left text-sm ' + (sel === c.customer ? 'border-brand bg-brand-soft' : 'bg-white')}><b>{c.name}</b>{c.unread > 0 && <span className="ml-2 rounded-md bg-brand px-2 text-xs text-white">{c.unread}</span>}<div className="truncate text-neutral-500">{c.last}</div></button>)}</div>
    <div className="md:col-span-2">{sel ? <Chat key={sel} base={'/admin/chat/' + sel} me="ADMIN" peer={sel} /> : <p className="text-neutral-500">Select a conversation.</p>}</div></div>;
}
function Categories() {
  const [cs, setCs] = useState([]), [f, setF] = useState({ name: '' }); const toast = useStore((s) => s.toast);
  useSync(() => { api('/admin/categories').then(setCs).catch(() => {}); }, []);
  async function add(e) { e.preventDefault(); try { await api('/admin/categories', { method: 'POST', body: { name: f.name, order: cs.length } }); setF({ name: '' }); sync(); } catch (x) { toast(x.message); } }
  return <><form onSubmit={add} className="mb-4 flex flex-wrap gap-2 rounded-xl border bg-white p-3"><input required className={inp + ' !w-48'} aria-label="Category name" placeholder="Category name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><button className={btn}>Add category</button></form>
    {cs.map((c) => <div key={c._id} className={'mb-2 flex items-center justify-between rounded-xl border bg-white p-3 text-sm ' + (c.active ? '' : 'opacity-50')}><b>{c.name}</b><button className={btn2} onClick={async () => { await api('/admin/categories/' + c._id, { method: 'PUT', body: { active: !c.active } }); sync(); }}>{c.active ? 'Disable' : 'Enable'}</button></div>)}</>;
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
      {tab === 'Products' && <Products />}{tab === 'Categories' && <Categories />}{tab === 'Customers' && <Customers />}{tab === 'Coupons' && <Coupons />}{tab === 'Messages' && <Messages pick={chatWith} />}{tab === 'Settings' && <Settings />}{tab === 'Notifications'&&<NotificationSettings/>}</section></div>);
}
