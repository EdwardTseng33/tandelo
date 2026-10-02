// sfx.js — 合成音效（WebAudio，不用音檔）：打中、沒中、連擊、任務卡、收服、獎勵、輕點。
// 第一次使用者互動後才建立 AudioContext；設定關掉就全部靜音。

let ctx = null;
let enabled = true;
const unlock = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));

export function setEnabled(on) { enabled = !!on; }
export function isEnabled() { return enabled; }

function tone(freq, { t = 0, dur = 0.12, type = 'sine', gain = 0.18, slide = 0, attack = 0.005 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); const now = ctx.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(freq, now);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + dur);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(gain, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + dur + 0.02);
}
function noise({ t = 0, dur = 0.08, gain = 0.08 } = {}) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
  s.buffer = buf; g.gain.value = gain; s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(ctx.currentTime + t);
}

const SOUNDS = {
  tap: () => tone(880, { dur: 0.05, gain: 0.06, type: 'triangle' }),
  hit: () => { tone(660, { dur: 0.09, type: 'triangle', gain: 0.16 }); tone(990, { t: 0.07, dur: 0.14, type: 'triangle', gain: 0.16 }); },
  miss: () => { tone(220, { dur: 0.16, type: 'square', gain: 0.07, slide: -80 }); noise({ dur: 0.1, gain: 0.05 }); },
  combo: () => { [660, 830, 990, 1320].forEach((f, i) => tone(f, { t: i * 0.06, dur: 0.1, type: 'triangle', gain: 0.14 })); },
  card: () => { tone(523, { dur: 0.1, type: 'sine', gain: 0.16 }); tone(784, { t: 0.1, dur: 0.18, type: 'sine', gain: 0.16 }); },
  reward: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, { t: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.15 })); tone(1568, { t: 0.4, dur: 0.5, type: 'sine', gain: 0.12 }); },
  capture: () => { tone(392, { dur: 0.3, type: 'sine', gain: 0.14, slide: 400 }); [784, 988, 1175, 1568].forEach((f, i) => tone(f, { t: 0.3 + i * 0.1, dur: 0.26, type: 'triangle', gain: 0.14 })); noise({ t: 0.3, dur: 0.25, gain: 0.04 }); },
  wake: () => { tone(330, { dur: 0.25, type: 'sine', gain: 0.12, slide: 330 }); tone(880, { t: 0.25, dur: 0.3, type: 'triangle', gain: 0.14 }); },
  pop: () => tone(1200, { dur: 0.05, gain: 0.08, type: 'sine', slide: -400 }),
};

export function play(name) {
  if (!enabled || !ctx || !SOUNDS[name]) return;
  try { SOUNDS[name](); } catch (e) { /* 音效失敗不影響遊戲 */ }
}
