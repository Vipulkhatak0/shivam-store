import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, img } from '../api.js';
import { btn, Icon } from '../ui.jsx';

const ROTATE_MS = 120000;
const external = (url) => /^https?:\/\//i.test(url || '');

export default function BannerCarousel() {
  const [banners, setBanners] = useState(null), [index, setIndex] = useState(0), [paused, setPaused] = useState(false), [reducedMotion, setReducedMotion] = useState(false), [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const load = () => api('/banner').then((items) => { setLoadError(false); setBanners(items || []); setIndex((i) => Math.min(i, Math.max(0, (items?.length || 1) - 1))); }).catch(() => { setLoadError(true); setBanners([]); });
    load(); window.addEventListener('banner:changed', load); return () => window.removeEventListener('banner:changed', load);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches); update(); media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (!banners || banners.length < 2 || paused || reducedMotion) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % banners.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [banners, index, paused, reducedMotion]);
  if (!banners) return <div aria-label="Loading banners" aria-busy="true" className="mt-4 h-[220px] animate-pulse rounded-2xl bg-neutral-100 sm:h-[280px] lg:h-[340px]" />;
  if (banners.length === 0) return loadError ? <section role="status" className="mt-4 flex h-24 items-center rounded-2xl bg-peach px-5 text-sm font-semibold text-cocoa">Promotions are temporarily unavailable.</section> : null;
  const current = banners[index];
  const move = (step) => setIndex((i) => (i + step + banners.length) % banners.length);
  const cta = current.cta && current.link && (external(current.link)
    ? <a href={current.link} target="_blank" rel="noreferrer" className={btn + ' mt-4'}>{current.cta}<Icon n="arrow" className="h-4 w-4" /></a>
    : <Link to={current.link} className={btn + ' mt-4'}>{current.cta}<Icon n="arrow" className="h-4 w-4" /></Link>);
  return <section aria-label="Store promotions" aria-roledescription="carousel" className="mt-1" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className="relative isolate h-[220px] overflow-hidden rounded-2xl bg-peach shadow-sm sm:h-[280px] lg:h-[340px]" style={{ backgroundColor: current.backgroundColor || '#FCE8E6' }}>
      <div className={'flex h-full ' + (reducedMotion ? '' : 'transition-transform duration-700 ease-in-out')} style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => <article key={b._id} aria-hidden={i !== index} style={{ backgroundColor: b.backgroundColor || '#FCE8E6' }} className="relative h-full w-full shrink-0 overflow-hidden">
          {(b.desktopImage || b.mobileImage) && <picture className="absolute inset-0 z-0">
            {b.mobileImage && <source media="(max-width: 639px)" srcSet={img(b.mobileImage)} />}
            {b.desktopImage && <img src={img(b.desktopImage)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} loading={i === index ? 'eager' : 'lazy'} className="h-full w-full object-cover transition-transform duration-[8000ms] ease-out hover:scale-[1.025]" />}
            {!b.desktopImage && b.mobileImage && <img src={img(b.mobileImage)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} loading={i === index ? 'eager' : 'lazy'} className="h-full w-full object-cover" />}
          </picture>}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />
          <div className="relative z-20 flex h-full max-w-2xl flex-col items-start justify-center px-5 py-5 text-white sm:px-9 lg:px-12">
            {(b.badge || b.type) && <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand shadow-sm">{b.badge || b.type?.replaceAll('_', ' ')}</span>}
            <h2 className="mt-3 max-w-xl text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl lg:text-5xl">{b.title}</h2>
            {b.subtitle && <p className="mt-2 max-w-lg text-sm font-medium drop-shadow sm:text-lg">{b.subtitle}</p>}
            {b.discountText && <p className="mt-2 text-sm font-extrabold text-yellow-200 sm:text-base">{b.discountText}</p>}
            {cta}
          </div>
        </article>)}
      </div>
      {banners.length > 1 && <>
        <button type="button" aria-label="Previous banner" onClick={() => move(-1)} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-cocoa shadow hover:bg-white sm:left-4"><Icon n="back" /></button>
        <button type="button" aria-label="Next banner" onClick={() => move(1)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-cocoa shadow hover:bg-white sm:right-4"><Icon n="chev" /></button>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2" role="group" aria-label="Choose banner">{banners.map((b, i) => <button key={b._id} type="button" aria-label={`Show banner ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={'h-2.5 rounded-full transition-all ' + (i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/60 hover:bg-white')} />)}</div>
      </>}
    </div>
  </section>;
}
