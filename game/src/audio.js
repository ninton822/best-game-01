// Procedural WebAudio sounds: every effect is synthesized, no audio files, no
// network. The context is created lazily on the first user gesture (browsers block
// audio before that) and every call is a no-op while muted or unavailable, so the
// game also runs fine headless with no sound device at all.
export function makeSfx() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  const sfx = {
    muted: false,
    ensure() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
        const len = ctx.sampleRate * 0.5;
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        return true;
      } catch {
        return false;
      }
    },
    tone(freq, dur, type, vol, slideTo, delay = 0) {
      if (sfx.muted || !ctx) return;
      try {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch {
        /* audio is cosmetic; never break the game */
      }
    },
    noise(dur, vol, freq, delay = 0) {
      if (sfx.muted || !ctx || !noiseBuf) return;
      try {
        const t0 = ctx.currentTime + delay;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      } catch {
        /* audio is cosmetic */
      }
    },
    click() {
      sfx.tone(660, 0.06, 'sine', 0.15, 520);
    },
    build() {
      sfx.tone(180, 0.12, 'triangle', 0.3, 90);
      sfx.noise(0.08, 0.12, 900);
    },
    shoot() {
      sfx.tone(880, 0.07, 'square', 0.07, 440);
    },
    mortar() {
      sfx.noise(0.28, 0.25, 500);
      sfx.tone(120, 0.25, 'sine', 0.3, 45);
    },
    zap() {
      sfx.tone(1400, 0.09, 'sawtooth', 0.09, 220);
      sfx.noise(0.06, 0.08, 4000);
    },
    frost() {
      sfx.tone(1200, 0.18, 'sine', 0.06, 1800);
    },
    coin() {
      sfx.tone(990, 0.07, 'sine', 0.12);
      sfx.tone(1320, 0.1, 'sine', 0.12, undefined, 0.06);
    },
    leak() {
      sfx.tone(220, 0.16, 'sawtooth', 0.2, 160);
      sfx.tone(220, 0.16, 'sawtooth', 0.2, 160, 0.18);
    },
    horn() {
      sfx.tone(196, 0.5, 'sawtooth', 0.16, 147);
      sfx.tone(294, 0.5, 'sawtooth', 0.1, 220, 0.05);
    },
    boss() {
      sfx.tone(98, 0.7, 'sawtooth', 0.22, 65);
      sfx.noise(0.5, 0.14, 300);
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => sfx.tone(f, 0.28, 'triangle', 0.2, undefined, i * 0.13));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => sfx.tone(f, 0.34, 'triangle', 0.18, undefined, i * 0.17));
    },
  };
  return sfx;
}
