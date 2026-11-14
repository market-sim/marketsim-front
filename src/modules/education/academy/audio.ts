/**
 * Ambiance sonore de l'Academie, entierement generee avec la Web Audio API :
 * aucune musique ni aucun son n'est telecharge (pas de fichiers, pas de droits d'auteur).
 *
 * - musique generative douce (accords, basse, arpeges, petite batterie) avec 3 ambiances : exploration, lecon, boss ;
 * - ambiance de l'ile : vagues et chants d'oiseaux ;
 * - effets : pas, carillon de station, bonne / mauvaise reponse, XP, deblocage, achat / vente, krach.
 *
 * Les navigateurs n'autorisent le son qu'apres un clic ou une touche : start() est appele a la premiere interaction.
 */

export type Mood = "explore" | "lesson" | "boss";

export interface SoundSettings {
  music: boolean;
  sfx: boolean;
  ambience: boolean;
  volume: number; // 0..1
}

export const DEFAULT_SOUND: SoundSettings = { music: true, sfx: true, ambience: true, volume: 0.6 };

const KEY = "marketsim.academy.sound";

export function loadSound(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SOUND, ...(JSON.parse(raw) as Partial<SoundSettings>) } : DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSound(s: SoundSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* preference non enregistree : sans consequence */
  }
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Progressions (notes MIDI) : exploration lumineuse, boss en mineur plus sombre. */
const PROGRESSIONS: Record<Mood, number[][]> = {
  explore: [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
    [48, 52, 55, 59], // Cmaj7
    [55, 59, 62, 69], // G(add9)
  ],
  lesson: [
    [53, 57, 60, 64],
    [48, 52, 55, 59],
    [57, 60, 64, 67],
    [55, 59, 62, 66],
  ],
  boss: [
    [52, 55, 59, 62], // Em7
    [48, 52, 55, 58], // C7
    [50, 53, 57, 60], // Dm7
    [47, 50, 54, 57], // Bm7b5
  ],
};

const TEMPO: Record<Mood, number> = { explore: 84, lesson: 72, boss: 118 };

class AcademyAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambienceBus!: GainNode;
  private delay!: DelayNode;
  private noiseBuffer!: AudioBuffer;
  private settings: SoundSettings = loadSound();
  private mood: Mood = "explore";
  private timer: number | null = null;
  private birdTimer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private lastStep = 0;

  get started() {
    return this.ctx !== null;
  }

  /** A appeler depuis un clic ou une touche (regle des navigateurs). */
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambienceBus.connect(this.master);
    // echo doux pour les arpeges
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.musicBus);
    // bruit blanc reutilise (vagues, charleston, pas, souffle)
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.apply();
    this.startWaves();
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 100);
    this.birdTimer = window.setInterval(() => {
      if (Math.random() < 0.45) this.bird();
    }, 3500);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    if (this.birdTimer) window.clearInterval(this.birdTimer);
    this.timer = null;
    this.birdTimer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  configure(s: SoundSettings) {
    this.settings = s;
    saveSound(s);
    this.apply();
  }

  setMood(m: Mood) {
    this.mood = m;
    this.apply();
  }

  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.volume, t, 0.1);
    const musicLevel = s.music ? (this.mood === "lesson" ? 0.18 : this.mood === "boss" ? 0.32 : 0.26) : 0;
    this.musicBus.gain.setTargetAtTime(musicLevel, t, 0.6);
    this.sfxBus.gain.setTargetAtTime(s.sfx ? 0.55 : 0, t, 0.05);
    this.ambienceBus.gain.setTargetAtTime(s.ambience ? (this.mood === "lesson" ? 0.08 : 0.16) : 0, t, 0.6);
  }

  // ─── musique generative ──────────────────────────────────────────────────────────────────

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const spb = 60 / TEMPO[this.mood] / 2; // croche
    while (this.nextTime < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
  }

  /** Une mesure = 8 croches ; l accord change toutes les 2 mesures (16 croches). */
  private playStep(step: number, t: number, spb: number) {
    const prog = PROGRESSIONS[this.mood];
    const chord = prog[Math.floor(step / 16) % prog.length];
    const inBar = step % 8;
    const boss = this.mood === "boss";
    if (step % 16 === 0) this.pad(chord, t, spb * 16);
    if (inBar === 0 || (boss && inBar === 4)) this.bass(chord[0] - 12, t, spb * (boss ? 2 : 3.5));
    if (inBar === 4 && !boss) this.bass(chord[0] - 12 + (step % 32 < 16 ? 7 : 5), t, spb * 2.5);
    // arpege : notes de l'accord + une octave, motif qui varie toutes les 2 mesures
    const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
    if (this.mood !== "lesson" || inBar % 2 === 0) {
      const idx = pattern[(inBar + Math.floor(step / 16)) % pattern.length];
      const note = idx < 4 ? chord[idx] + 12 : chord[0] + 24;
      if (boss || (step * 7919) % 5 !== 0) this.pluck(note, t, boss ? 0.09 : 0.12);
    }
    if (this.mood !== "lesson") {
      if (inBar === 0 || inBar === 4) this.kick(t, boss ? 0.5 : 0.28);
      if (inBar % 2 === 1) this.hat(t, boss ? 0.09 : 0.05);
      if (boss && (inBar === 2 || inBar === 6)) this.snare(t);
    }
  }

  private pad(chord: number[], t: number, dur: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.mood === "boss" ? 1400 : 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 1.2);
    g.gain.setValueAtTime(0.08, t + dur - 1);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    filter.connect(g).connect(this.musicBus);
    for (const n of chord) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = this.mood === "boss" ? "sawtooth" : "triangle";
        o.frequency.value = midi(n);
        o.detune.value = detune;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.7);
      }
    }
  }

  private bass(n: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = midi(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pluck(n: number, t: number, level: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = midi(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    g.connect(this.musicBus);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + 0.55);
  }

  private kick(t: number, level: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, freq: number, level: number, bus: GainNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
    return f;
  }

  private hat(t: number, level: number) {
    this.noise(t, 0.05, "highpass", 7000, level, this.musicBus);
  }

  private snare(t: number) {
    this.noise(t, 0.16, "bandpass", 1800, 0.18, this.musicBus);
  }

  // ─── ambiance de l'ile ──────────────────────────────────────────────────────────────────

  private startWaves() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    // houle : le volume monte et descend lentement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambienceBus);
    src.start();
    lfo.start();
  }

  private bird() {
    const ctx = this.ctx;
    if (!ctx || !this.settings.ambience || this.mood === "boss") return;
    const t = ctx.currentTime + Math.random() * 0.5;
    const base = 2200 + Math.random() * 1600;
    const chirps = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < chirps; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.06, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
      o.connect(g).connect(this.ambienceBus);
      o.start(s);
      o.stop(s + 0.1);
    }
  }

  // ─── effets sonores ─────────────────────────────────────────────────────────────────────

  private tone(n: number, t: number, dur: number, type: OscillatorType, level: number, glideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(midi(n), t);
    if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(midi(glideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private now() {
    return this.ctx ? this.ctx.currentTime + 0.01 : -1;
  }

  /** Un pas (limite a un toutes les 0,2 s). */
  footstep() {
    const t = this.now();
    if (t < 0 || t - this.lastStep < 0.2) return;
    this.lastStep = t;
    this.noise(t, 0.07, "lowpass", 600 + Math.random() * 300, 0.25, this.sfxBus);
  }

  /** On arrive devant une station. */
  chime() {
    const t = this.now();
    if (t < 0) return;
    [76, 81, 88].forEach((n, i) => this.tone(n, t + i * 0.08, 0.6, "sine", 0.14));
  }

  click() {
    const t = this.now();
    if (t < 0) return;
    this.tone(84, t, 0.06, "triangle", 0.1);
  }

  /** Entree dans un batiment : souffle qui monte. */
  enter() {
    const t = this.now();
    if (t < 0) return;
    const f = this.noise(t, 0.45, "bandpass", 400, 0.3, this.sfxBus);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
    this.tone(72, t + 0.15, 0.4, "sine", 0.1, 79);
  }

  pageTurn() {
    const t = this.now();
    if (t < 0) return;
    this.noise(t, 0.12, "highpass", 2500, 0.12, this.sfxBus);
  }

  correct() {
    const t = this.now();
    if (t < 0) return;
    this.tone(76, t, 0.18, "triangle", 0.2);
    this.tone(83, t + 0.1, 0.35, "triangle", 0.2);
  }

  wrong() {
    const t = this.now();
    if (t < 0) return;
    this.tone(50, t, 0.3, "square", 0.08, 45);
  }

  /** Station reussie : arpege + etincelles. */
  success() {
    const t = this.now();
    if (t < 0) return;
    [72, 76, 79, 84, 88].forEach((n, i) => this.tone(n, t + i * 0.09, 0.5, "triangle", 0.18));
    for (let i = 0; i < 6; i++) this.tone(96 + Math.floor(Math.random() * 8), t + 0.5 + i * 0.06, 0.25, "sine", 0.06);
  }

  /** Zone debloquee / diplome : petite fanfare. */
  fanfare() {
    const t = this.now();
    if (t < 0) return;
    const notes: [number, number, number][] = [[67, 0, 0.18], [72, 0.18, 0.18], [76, 0.36, 0.18], [79, 0.54, 0.7], [76, 0.9, 0.18], [79, 1.08, 0.9]];
    for (const [n, at, d] of notes) {
      this.tone(n, t + at, d, "sawtooth", 0.07);
      this.tone(n - 12, t + at, d, "triangle", 0.1);
    }
  }

  coin() {
    const t = this.now();
    if (t < 0) return;
    this.tone(88, t, 0.08, "square", 0.06);
    this.tone(95, t + 0.07, 0.25, "square", 0.06);
  }

  /** Grondement du krach. */
  rumble() {
    const t = this.now();
    if (t < 0) return;
    this.noise(t, 1.6, "lowpass", 120, 0.6, this.sfxBus);
    this.tone(33, t, 1.4, "sawtooth", 0.08, 28);
  }

  /** Message du mentor. */
  pop() {
    const t = this.now();
    if (t < 0) return;
    this.tone(79, t, 0.12, "sine", 0.12, 86);
  }
}

/** Une seule instance pour toute la page. */
export const academyAudio = new AcademyAudio();
