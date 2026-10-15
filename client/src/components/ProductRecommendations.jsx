import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ProductCard } from '../pages/Shop.jsx';
import { Icon } from '../ui.jsx';

export default function ProductRecommendations({ productId }) {
  const [items,setItems]=useState(null), row=useRef(null);
  useEffect(()=>{let alive=true;setItems(null);api(`/products/${encodeURIComponent(productId)}/recommendations`).then(d=>{if(alive)setItems(d.items||[]);}).catch(()=>{if(alive)setItems([]);});return()=>{alive=false;};},[productId]);
  if(items?.length===0)return null;
  const scroll=(dir)=>row.current?.scrollBy({left:dir*row.current.clientWidth*.8,behavior:'smooth'});
  return <section className="mt-10" aria-label="Product recommendations">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-extrabold">You May Also Like</h2>{items?.length>2&&<div className="hidden gap-2 md:flex"><button type="button" aria-label="Scroll recommendations left" onClick={()=>scroll(-1)} className="rounded-full border bg-white p-2 hover:border-brand"><Icon n="back" className="h-4 w-4"/></button><button type="button" aria-label="Scroll recommendations right" onClick={()=>scroll(1)} className="rounded-full border bg-white p-2 hover:border-brand"><Icon n="arrow" className="h-4 w-4"/></button></div>}</div>
    <div ref={row} className="recommendation-row noscroll grid grid-flow-col grid-rows-1 gap-3 overflow-x-auto scroll-smooth pb-2">
      {items===null?Array.from({length:4},(_,i)=><div key={i} className="rounded-xl border bg-white p-3"><div className="skeleton h-28 w-full rounded-lg"/><div className="skeleton mt-3 h-4 w-3/4"/><div className="skeleton mt-2 h-4 w-1/2"/><div className="skeleton mt-4 h-9 w-full"/></div>):items.map(p=><ProductCard key={p._id} p={p}/>)}
    </div>
  </section>;
}
