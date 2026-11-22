// v9 final: the shotgun fires through this synth set — still no audio files, everything WebAudio.
// audio.js — every sound is synthesized with WebAudio: engine hum, police
// siren, gunshots, pickups, mission jingles, and a low-key music loop.
// Nothing is loaded from a file. The context only starts after a user
// gesture, and every call is safe when the context is not running.
export function createAudio(S) {
  const audio = {
    ctx: null,
    muted: false,
    engineNodes: null,
    sirenNodes: null,
    sirenOn: false,
    musicTimer: null,
    musicStep: 0,
  };
  S.audio = audio;

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume().catch(() => {});
      return audio.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio.ctx = new AC();
      return audio.ctx;
    } catch (err) {
      return null;
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.engineNodes) audio.engineNodes.gain.gain.value = 0;
    return audio.muted;
  };

  function blip(freq, dur, type, vol, slideTo) {
    const ctx = audio.ensure();
    if (!ctx || audio.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (err) {
      // Sound is garnish; a failure never breaks the game.
    }
  }

  function noiseBurst(dur, vol, lowpass) {
    const ctx = audio.ensure();
    if (!ctx || audio.muted) return;
    try {
      const frames = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const samples = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      if (lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = lowpass;
        src.connect(f).connect(g).connect(ctx.destination);
      } else {
        src.connect(g).connect(ctx.destination);
      }
      src.start();
    } catch (err) {
      // Ignore audio failures.
    }
  }

  audio.engine = (level) => {
    const ctx = audio.ensure();
    if (!ctx || audio.muted) return;
    try {
      if (!audio.engineNodes) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = 55;
        const g = ctx.createGain();
        g.gain.value = 0;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 420;
        o.connect(f).connect(g).connect(ctx.destination);
        o.start();
        audio.engineNodes = { osc: o, gain: g };
      }
      const nodes = audio.engineNodes;
      nodes.osc.frequency.setTargetAtTime(48 + level * 110, ctx.currentTime, 0.08);
      nodes.gain.gain.setTargetAtTime(level > 0.02 ? 0.035 + level * 0.03 : 0, ctx.currentTime, 0.1);
    } catch (err) {
      // Ignore.
    }
  };

  audio.siren = (on) => {
    const ctx = audio.ensure();
    if (!ctx || audio.muted) {
      audio.sirenOn = false;
      return;
    }
    if (on === audio.sirenOn) return;
    audio.sirenOn = on;
    try {
      if (on && !audio.sirenNodes) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = 720;
        const g = ctx.createGain();
        g.gain.value = 0.028;
        o.connect(g).connect(ctx.destination);
        o.start();
        audio.sirenNodes = { osc: o, gain: g, high: false };
        audio.sirenNodes.timer = window.setInterval(() => {
          if (!audio.sirenNodes) return;
          audio.sirenNodes.high = !audio.sirenNodes.high;
          audio.sirenNodes.osc.frequency.setTargetAtTime(audio.sirenNodes.high ? 960 : 720, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && audio.sirenNodes) {
        window.clearInterval(audio.sirenNodes.timer);
        try { audio.sirenNodes.osc.stop(); } catch (err) {}
        audio.sirenNodes = null;
      }
    } catch (err) {
      // Ignore.
    }
  };

  audio.gunshot = () => noiseBurst(0.16, 0.3, 1800);
  audio.shotgun = () => { noiseBurst(0.32, 0.5, 900); blip(90, 0.25, "sawtooth", 0.2, 45); };
  audio.raceGo = () => {
    blip(440, 0.12, "square", 0.1);
    setTimeout(() => blip(440, 0.12, "square", 0.1), 200);
    setTimeout(() => blip(880, 0.3, "square", 0.12), 400);
  };
  audio.crash = () => noiseBurst(0.3, 0.35, 500);
  audio.thud = () => noiseBurst(0.12, 0.2, 300);
  audio.punch = () => blip(130, 0.12, "sine", 0.2, 60);
  audio.pickup = () => { blip(880, 0.1, "sine", 0.12); setTimeout(() => blip(1320, 0.14, "sine", 0.12), 90); };
  audio.cash = () => { blip(990, 0.09, "square", 0.06); setTimeout(() => blip(1320, 0.16, "square", 0.06), 80); };
  audio.click = () => blip(1400, 0.04, "square", 0.05);
  audio.reload = () => { blip(500, 0.05, "square", 0.08); setTimeout(() => blip(700, 0.05, "square", 0.08), 110); };
  audio.door = () => blip(220, 0.09, "square", 0.08, 140);
  audio.hurt = () => blip(200, 0.2, "sawtooth", 0.14, 90);
  audio.missionDone = () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, "triangle", 0.12), i * 110));
  };
  audio.busted = () => {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, "triangle", 0.12), i * 160));
  };

  audio.startMusic = () => {
    const ctx = audio.ensure();
    if (!ctx || audio.musicTimer) return;
    // A lazy bassline: Am – F – C – G, one chord note per beat.
    const bass = [55, 43.65, 65.41, 49];
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    audio.musicTimer = window.setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      try {
        const step = audio.musicStep++ % 4;
        const t = audio.ctx.currentTime;
        const o = audio.ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = bass[step];
        const g = audio.ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o.connect(g).connect(audio.ctx.destination);
        o.start(t);
        o.stop(t + 0.95);
        for (const f of chords[step]) {
          const p = audio.ctx.createOscillator();
          p.type = "sine";
          p.frequency.value = f;
          const pg = audio.ctx.createGain();
          pg.gain.setValueAtTime(0.014, t);
          pg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
          p.connect(pg).connect(audio.ctx.destination);
          p.start(t);
          p.stop(t + 0.95);
        }
      } catch (err) {
        // Ignore.
      }
    }, 1000);
  };

  return audio;
}
