import { currentEra } from './state.js';

// ==================== 2. 物理モーダル音響合成（王手太鼓・勝鬨雅楽・惜敗梵鐘対応） ====================
  let ac = null;
  let noiseBuf = null;

  function audio() {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        ac = new Ctx();
        const len = ac.sampleRate * 0.25;
        noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
      }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  function triggerFilteredNoise(duration, filterType, freq, Q, gainVal, delay = 0) {
    const a = audio(); if (!a || !noiseBuf) return;
    const t = a.currentTime + delay;
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const filter = a.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(Q, t);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(a.destination);
    src.start(t, Math.random() * 0.1, duration + 0.01);
  }

  function triggerModalResonator(freq, duration, gainVal, delay = 0, type = 'sine') {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + duration + 0.005);
  }


export function playSingleRattleGrain(intensity = 1.0) {
    const vol = Math.min(1.3, intensity);
    const sfx = currentEra().sfx;
    const p = 0.92 + Math.random() * 0.16;
    triggerFilteredNoise(0.028, 'bandpass', sfx.rattleFreq * p, 7.5, 0.25 * vol);
    triggerFilteredNoise(0.018, 'bandpass', sfx.rattleFreq * 2.3 * p, 9.0, 0.20 * vol);
    triggerFilteredNoise(0.009, 'highpass', 3300 * p, 1.5, 0.15 * vol);
    if (sfx.cupType === 'iron_bowl') {
      triggerModalResonator(580 * p, 0.065, 0.08 * vol);
    } else if (sfx.cupType === 'teacup') {
      triggerModalResonator(1920 * p, 0.045, 0.09 * vol);
    }
  }

export function playDiceBounce(velNorm = 0.5) {
    const v = Math.max(0.06, Math.min(1.0, velNorm));
    const sfx = currentEra().sfx;
    const p = 0.94 + Math.random() * 0.12;
    triggerFilteredNoise(0.011, 'bandpass', 2950 * p, 6.5, 0.28 * v);
    triggerFilteredNoise(0.024, 'bandpass', 780 * p, 4.5, 0.22 * v);
    triggerModalResonator(sfx.woodRes * 1.3 * p, 0.045, 0.09 * v);
  }

export function playStoneLift() {
    triggerFilteredNoise(0.012, 'bandpass', 1650, 5.0, 0.08);
  }

export function playStoneImpact(isHit = false) {
    const res = currentEra().sfx.woodRes;
    if (isHit) {
      triggerFilteredNoise(0.014, 'bandpass', 3650, 8.5, 0.42, 0);
      triggerFilteredNoise(0.022, 'bandpass', 1850, 6.0, 0.34, 0);
      triggerModalResonator(2180, 0.025, 0.14, 0);
      triggerFilteredNoise(0.016, 'bandpass', 2650, 5.5, 0.38, 0.024);
      triggerFilteredNoise(0.038, 'bandpass', 820, 3.8, 0.36, 0.024);
      triggerModalResonator(res * 0.94, 0.145, 0.38, 0.024);
      triggerModalResonator(res * 1.42, 0.095, 0.24, 0.024);
    } else {
      triggerFilteredNoise(0.012, 'bandpass', 2780, 6.0, 0.32, 0);
      triggerFilteredNoise(0.028, 'bandpass', 890, 4.2, 0.28, 0);
      triggerModalResonator(res, 0.115, 0.28, 0);
      triggerModalResonator(res * 1.5, 0.075, 0.16, 0);
    }
  }

  // 【王手・決戦迫る】：大鼓（おおつづみ）の鋭い革打音＋盤面強打の重低音
export function playOteClimaxSound() {
    triggerFilteredNoise(0.025, 'bandpass', 2150, 5.0, 0.48, 0);
    triggerModalResonator(78, 0.38, 0.52, 0);
    triggerModalResonator(124, 0.26, 0.36, 0);
    triggerFilteredNoise(0.020, 'bandpass', 2400, 6.0, 0.42, 0.14);
    triggerModalResonator(92, 0.32, 0.45, 0.14);
  }

  // 【勝利決済音】：琵琶の撥音＋雅楽平調の慶祝和音
export function playVictoryFanfare() {
    const notes = [220, 293.66, 329.63, 440, 587.33];
    notes.forEach((f, i) => {
      triggerFilteredNoise(0.015, 'bandpass', 2400, 5.0, 0.22, i * 0.085);
      triggerModalResonator(f, 0.85, 0.24, i * 0.085, 'triangle');
      triggerModalResonator(f * 1.5, 0.55, 0.10, i * 0.085, 'sine');
    });
    triggerModalResonator(110, 1.2, 0.32, 0.35);
  }

  // 【敗北決済音】：寺院の梵鐘（低音のうなり減衰）
export function playDefeatBell() {
    triggerFilteredNoise(0.03, 'bandpass', 1200, 4.0, 0.25, 0);
    triggerModalResonator(136, 1.8, 0.36, 0);
    triggerModalResonator(273, 1.4, 0.18, 0);
    triggerModalResonator(412, 0.9, 0.10, 0);
  }
