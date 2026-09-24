import type { TrackId } from "@/lib/tracks";

type Handle = { ctx: AudioContext; stop: () => void };

function env(ctx: AudioContext, start: number, attack: number, release: number, peak = 0.12) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  return gain;
}

function scheduleWarm(ctx: AudioContext, t: number) {
  const notes = [261.63, 329.63, 392.0, 493.88];
  notes.forEach((freq, i) => {
    const start = t + i * 0.45;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = env(ctx, start, 0.04, 0.7, 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.8);
  });
}

function scheduleNight(ctx: AudioContext, t: number) {
  const pad = ctx.createOscillator();
  pad.type = "triangle";
  pad.frequency.value = 110;
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.04, t);
  pad.connect(padGain).connect(ctx.destination);
  pad.start(t);
  pad.stop(t + 2.4);

  [146.83, 174.61].forEach((freq, i) => {
    const start = t + 0.3 + i * 0.9;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = env(ctx, start, 0.08, 1.1, 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.2);
  });
}

function schedulePulse(ctx: AudioContext, t: number) {
  for (let i = 0; i < 4; i++) {
    const start = t + i * 0.45;
    const kick = ctx.createOscillator();
    kick.type = "sine";
    kick.frequency.setValueAtTime(140, start);
    kick.frequency.exponentialRampToValueAtTime(50, start + 0.15);
    const kickGain = env(ctx, start, 0.005, 0.18, 0.2);
    kick.connect(kickGain).connect(ctx.destination);
    kick.start(start);
    kick.stop(start + 0.2);

    if (i % 2 === 1) {
      const hat = ctx.createOscillator();
      hat.type = "square";
      hat.frequency.value = 900;
      const hatGain = env(ctx, start + 0.22, 0.002, 0.05, 0.03);
      hat.connect(hatGain).connect(ctx.destination);
      hat.start(start + 0.22);
      hat.stop(start + 0.28);
    }
  }
}

const SCHEDULERS: Record<TrackId, (ctx: AudioContext, t: number) => void> = {
  warm: scheduleWarm,
  night: scheduleNight,
  pulse: schedulePulse,
};

const LOOP: Record<TrackId, number> = {
  warm: 1.9,
  night: 2.4,
  pulse: 1.8,
};

export function startTrack(id: TrackId): Handle | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const play = () => SCHEDULERS[id](ctx, ctx.currentTime + 0.02);
  play();
  const timer = window.setInterval(play, LOOP[id] * 1000);
  return {
    ctx,
    stop() {
      window.clearInterval(timer);
      void ctx.close();
    },
  };
}