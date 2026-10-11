import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.js';
import { btn, Icon, GoogleG, useSeo } from '../ui.jsx';

function GoogleBtn() {
  const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID, ref = useRef(); const { setAuth, toast } = useStore(); const nav = useNavigate();
  useEffect(() => {
    if (!cid) return; let dead = false;
    const init = () => {
      if (dead || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: cid, callback: async (r) => { try { const d = await api('/auth/google', { method: 'POST', body: { credential: r.credential } }); setAuth(d.token, d.user); nav(d.user.role === 'ADMIN' ? '/admin' : '/'); } catch (e) { toast(e.message); } } });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'continue_with', width: ref.current.offsetWidth || 300 });
    };
    if (window.google) init(); else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init; document.head.append(s); }
    return () => { dead = true; };
  }, [cid]); // eslint-disable-line
  if (!cid) return <button type="button" onClick={() => toast('Google login is not configured. Set VITE_GOOGLE_CLIENT_ID in the client and GOOGLE_CLIENT_ID on the server.')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2.5 text-sm font-semibold hover:bg-neutral-50"><GoogleG />Continue with Google</button>;
  return <div ref={ref} className="flex min-h-[44px] w-full justify-center" />;
}
const Input = ({ icon, type = 'text', ...r }) => {
  const [show, setShow] = useState(false);
  return <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"><Icon n={icon} className="h-4 w-4" /></span>
    <input required type={type === 'password' && show ? 'text' : type} {...r} className="w-full rounded-lg border border-neutral-300 py-2.5 pl-10 pr-10 text-sm" />
    {type === 'password' && <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"><Icon n={show ? 'eyeoff' : 'eye'} className="h-4 w-4" /></button>}</div>;
};
export default function Auth({ admin }) {
  const [mode, setMode] = useState('login'), [f, setF] = useState({}), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const { setAuth, toast } = useStore(); const nav = useNavigate();
  useSeo(admin ? 'Admin login' : 'Login');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const T = { login: ['Welcome Back', 'Login to your account'], register: ['Create Account', 'Join us for a better shopping experience'], otp: ['Verify your email', `Enter the 6-digit code sent to ${f.email || 'your email'}`], forgot: ['Forgot Password?', "Enter your email and we'll send a reset code"], reset: ['Reset Password', 'Enter the code we emailed and choose a new password'] }[mode];
  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'otp') { await api('/auth/verify-otp', { method: 'POST', body: { email: f.email, otp: f.otp } }); toast('Email verified. Please log in.'); setMode('login'); }
      else if (mode === 'register') { await api('/auth/register', { method: 'POST', body: { name: f.name, email: f.email, phone: f.phone, password: f.password } }); toast('We emailed you a 6-digit code.'); setMode('otp'); }
      else if (mode === 'forgot') { await api('/auth/forgot-password', { method: 'POST', body: { email: f.email } }); toast('If that email has an account, a code is on its way.'); setMode('reset'); }
      else if (mode === 'reset') { await api('/auth/reset-password', { method: 'POST', body: { email: f.email, otp: f.otp, password: f.password } }); toast('Password updated. Please log in.'); setF({ email: f.email }); setMode('login'); }
      else { const d = await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } }); setAuth(d.token, d.user); nav(d.user.role === 'ADMIN' ? '/admin' : '/'); }
    } catch (x) { setErr(x.message); if (x.code === 'NOT_VERIFIED') setMode('otp'); } finally { setBusy(false); }
  }
  async function resend() { try { await api('/auth/resend-otp', { method: 'POST', body: { email: f.email } }); toast('New code sent.'); } catch (x) { setErr(x.message); } }
  const showEmail = mode !== 'otp' || !f.email;
  return (
    <form onSubmit={go} className="mx-auto mt-4 w-full max-w-sm space-y-3 rounded-2xl border bg-white p-6 text-center shadow-sm">
      <img src="/img/auth.png" alt="Shivam Store mascot" className="mx-auto h-24 object-contain" />
      <div className="text-2xl font-extrabold tracking-tight">Shivam <span className="text-brand">Store</span></div>
      <h1 className="text-base font-extrabold">{admin ? 'Admin Login' : T[0]}</h1><p className="-mt-2 text-xs text-neutral-500">{admin ? 'Sign in to manage the store' : T[1]}</p>
      <div className="space-y-3 text-left">
        {mode === 'register' && <><Input icon="user" aria-label="Full Name" placeholder="Full Name" value={f.name || ''} onChange={set('name')} /></>}
        {showEmail && <Input icon="mail" type="email" aria-label="Email address" placeholder="Email address" value={f.email || ''} onChange={set('email')} />}
        {mode === 'register' && <Input icon="phone" aria-label="Phone Number" placeholder="Phone Number" value={f.phone || ''} onChange={set('phone')} />}
        {(mode === 'otp' || mode === 'reset') && <input required inputMode="numeric" maxLength={6} aria-label="Verification code" placeholder="000000" value={f.otp || ''} onChange={set('otp')} className="w-full rounded-lg border border-neutral-300 py-2.5 text-center text-xl tracking-[0.4em]" />}
        {['login', 'register', 'reset'].includes(mode) && <Input icon="lock" type="password" minLength={mode === 'login' ? 1 : 8} aria-label="Password" placeholder={mode === 'reset' ? 'New password (min 8)' : 'Password'} value={f.password || ''} onChange={set('password')} />}
      </div>
      {mode === 'login' && <div className="text-right"><button type="button" className="text-xs font-semibold text-brand" onClick={() => { setMode('forgot'); setErr(''); }}>Forgot Password?</button></div>}
      {(mode === 'otp') && <button type="button" className="text-sm font-semibold text-brand" onClick={resend}>Resend code</button>}
      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
      <button className={btn + ' w-full py-2.5'} disabled={busy}>{busy ? 'Please wait…' : { login: 'Login', register: 'Create Account', otp: 'Verify', forgot: 'Send reset code', reset: 'Update password' }[mode]}</button>
      {['login', 'register'].includes(mode) && !admin && <><div className="flex items-center gap-2 text-xs text-neutral-400"><span className="h-px flex-1 bg-neutral-200" />or continue with<span className="h-px flex-1 bg-neutral-200" /></div><GoogleBtn />
        <p className="text-xs text-neutral-600">{mode === 'login' ? "Don't have an account? " : 'Already have an account? '}<button type="button" className="font-semibold text-brand" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'Register' : 'Login'}</button></p></>}
      {['forgot', 'reset', 'otp'].includes(mode) && <button type="button" className="text-xs font-semibold text-brand" onClick={() => { setMode('login'); setErr(''); }}>Back to login</button>}
    </form>);
}
