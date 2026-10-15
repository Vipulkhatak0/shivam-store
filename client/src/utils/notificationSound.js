const files={universfield:'/sounds/universfield-new-notification.mp3',default:'/sounds/soft-bell.mp3',soft:'/sounds/soft-bell.mp3','soft-bell':'/sounds/soft-bell.mp3',doorbell:'/sounds/door-bell.mp3','door-bell':'/sounds/door-bell.mp3',success:'/sounds/customer-success.mp3',alert:'/sounds/admin-alert.mp3','admin-alert':'/sounds/admin-alert.mp3','cash-register':'/sounds/cash-register.mp3','admin-order':'/sounds/admin-order.mp3','admin-payment':'/sounds/admin-payment.mp3','customer-success':'/sounds/customer-success.mp3','customer-error':'/sounds/customer-error.mp3','customer-order':'/sounds/customer-order.mp3','customer-shipped':'/sounds/customer-shipped.mp3',soundreality:'/sounds/soundreality-notification.mp3'};
let activeNotificationAudio=null;
let activeNotificationTimer=null;
let activeNotificationToastId=null;
let activeNotificationContext=null;
let activeNotificationOscillator=null;
let activeNotificationGain=null;
let activeNotificationPulseTimer=null;

function startFallbackTone(soundId,volume){
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const ctx=new C(),osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=soundId.includes('alert')?620:880;gain.gain.value=0.0001;osc.connect(gain);gain.connect(ctx.destination);osc.start();
    const pulse=()=>{const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(0.0001,t);gain.gain.linearRampToValueAtTime(Math.max(0.0002,volume*0.15),t+0.02);gain.gain.exponentialRampToValueAtTime(0.001,t+0.24);};
    pulse();activeNotificationPulseTimer=setInterval(pulse,650);ctx.resume().catch(()=>{});
    activeNotificationContext=ctx;activeNotificationOscillator=osc;activeNotificationGain=gain;
  }catch{}
}

function releaseAudio(audio){
  if(!audio)return;
  audio.onerror=null;audio.onended=null;
  audio.loop=false;audio.pause();try{audio.currentTime=0;}catch{}
  audio.removeAttribute('src');audio.load();
}

export function stopNotificationSound(toastId) {
  if(toastId!==undefined && activeNotificationToastId!==toastId)return;
  if(activeNotificationTimer){clearTimeout(activeNotificationTimer);activeNotificationTimer=null;}
  if(activeNotificationAudio){
    const audio=activeNotificationAudio;
    activeNotificationAudio=null;
    releaseAudio(audio);
  }
  if(activeNotificationPulseTimer){clearInterval(activeNotificationPulseTimer);activeNotificationPulseTimer=null;}
  if(activeNotificationOscillator){try{activeNotificationOscillator.stop();}catch{}activeNotificationOscillator=null;}
  if(activeNotificationContext){activeNotificationContext.close().catch(()=>{});activeNotificationContext=null;activeNotificationGain=null;}
  activeNotificationToastId=null;
}

export function playNotificationSound(prefs,toastId) {
  stopNotificationSound();
  if(prefs?.sound?.enabled===false)return;
  const id=prefs?.sound?.soundId||'universfield';
  if(id==='none')return;
  const src=files[id];
  const volume=Math.max(0,Math.min(1,prefs?.sound?.volume??0.7));
  activeNotificationToastId=toastId??null;
  activeNotificationTimer=setTimeout(()=>stopNotificationSound(),5000);
  if(!src){startFallbackTone(id,volume);return;}
  const audio=new Audio(src);
  audio.volume=volume;
  audio.loop=false;
  activeNotificationAudio=audio;
  audio.onended=()=>{if(activeNotificationAudio!==audio)return;activeNotificationAudio=null;audio.onerror=null;audio.onended=null;if(activeNotificationTimer){clearTimeout(activeNotificationTimer);activeNotificationTimer=null;}activeNotificationToastId=null;};
  const fallback=()=>{if(activeNotificationAudio!==audio)return;releaseAudio(audio);activeNotificationAudio=null;if(id!=='universfield')startFallbackTone(id,volume);};
  audio.onerror=fallback;
  audio.play().catch(fallback);
}
