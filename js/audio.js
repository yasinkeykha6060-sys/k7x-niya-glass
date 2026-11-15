export function createAudio() {
  let ctx = null;
  let music = null;
  let musicGain = null;
  let on = true;

  function ensure() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, gain, type, delay) {
    const context = ensure();
    if (!context || !on) return;
    const t = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(context.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  return {
    unlock() { ensure(); },
    setOn(value) { on = !!value; },
    tick() {
      const context = ensure();
      if (!context || !on) return;
      const t = context.currentTime;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.03), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      const amp = context.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.03, t + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(context.destination);
      src.start(t);
      src.stop(t + 0.04);
    },
    chime() {
      tone(880, 0.35, 0.05, "sine", 0);
      tone(1320, 0.45, 0.03, "sine", 0.03);
    },
    chord() {
      tone(523, 0.7, 0.04, "sine", 0);
      tone(659, 0.8, 0.035, "sine", 0.02);
      tone(784, 0.9, 0.03, "sine", 0.04);
    },
    async loadMusic(url) {
      const context = ensure();
      if (!context) return false;
      const response = await fetch(url);
      if (!response.ok) return false;
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      music = audio;
      return true;
    },
    toggleMusic() {
      const context = ensure();
      if (!context || !music) return false;
      if (musicGain) {
        const t = context.currentTime;
        musicGain.gain.setTargetAtTime(0.0001, t, 0.08);
        const old = musicGain;
        musicGain = null;
        setTimeout(() => old.disconnect(), 400);
        return false;
      }
      const src = context.createBufferSource();
      src.buffer = music;
      src.loop = true;
      musicGain = context.createGain();
      musicGain.gain.setValueAtTime(0.0001, context.currentTime);
      musicGain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.8);
      src.connect(musicGain);
      musicGain.connect(context.destination);
      src.start();
      return true;
    },
    resume() {
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
  };
}
