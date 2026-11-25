import {signatureCues} from './signature-cues.js';

// Original mono impact, movement and training cues. Bake each short waveform once per
// AudioContext, then let the audio thread handle pitch, pan, filtering and fades.
const sampleRate = 24000;
const cycles = 4096;
const wave = Float32Array.from({length: cycles + 1}, (_, i) => Math.sin(2 * Math.PI * i / cycles));
const cache = new WeakMap();
const tone = (at, duration, hz, to, sound, gain) => ({at, duration, hz, to, sound, gain});
const air = (at, duration, low, high, gain) => ({at, duration, low, high, sound: 'air', gain});
const cinematic = signatureCues(tone, air);

const scores = {
  ...cinematic,
  armyRush: [air(0,.15,560,5100,.68),tone(.008,.13,190,507,'hollow',.57),tone(.13,.076,480,195,'edge',.35)],
  armyStrike: [tone(0,.112,161,64,'thump',.98),air(0,.072,950,7100,.53),tone(.012,.135,692,490,'metal',.66),tone(.045,.09,306,243,'edge',.39)],
  armySlam: [tone(0,.196,110,39,'thump',1),air(.005,.18,210,5200,.73),tone(.025,.22,291,160,'metal',.62),tone(.101,.103,980,552,'glass',.37)],
  armyBlock: [air(0,.038,1800,7200,.46),tone(.005,.148,1165,784,'metal',.72),tone(.043,.13,521,390,'glass',.62)],
  armyEvade: [air(0,.14,1100,5900,.57),tone(.027,.14,748,430,'hollow',.48)],
  cardAngry: [tone(0,.076,189,250,'hollow',.64),tone(.068,.133,279,185,'edge',.49)],
  cardBounce: [tone(0,.105,283,562,'hollow',.80),tone(.091,.079,620,388,'hollow',.55),tone(.155,.073,333,241,'soft',.40)],
  cardBlock: [tone(0,.132,975,925,'glass',.70),tone(.062,.152,1466,1372,'glass',.51)],
  cardCounter: [tone(0,.077,440,660,'hollow',.73),tone(.063,.094,659,990,'glass',.69),tone(.111,.165,880,879,'bell',.56)],
  cardRetry: [tone(0,.086,575,421,'edge',.56),tone(.074,.095,429,286,'hollow',.62),tone(.168,.150,249,119,'thump',.81)],
  shatter: [air(0,.074,650,7500,.48),tone(0,.085,164,78,'thump',.49),tone(.016,.14,1976,1642,'glass',.54),tone(.04,.145,1480,1220,'glass',.40),tone(.081,.14,2488,2180,'glass',.30)],
  lance: [air(0,.102,950,6500,.37),tone(.003,.093,420,1580,'edge',.65),tone(.078,.089,1520,480,'edge',.43),tone(.08,.102,118,56,'thump',.78)],
  siphon: [tone(0,.176,670,158,'hollow',.78),tone(.027,.14,980,260,'glass',.31),tone(.169,.15,266,511,'hollow',.68),tone(.237,.107,653,729,'glass',.34)],
  chain: [tone(0,.094,364,415,'metal',.83),air(0,.041,1800,6300,.44),tone(.069,.104,573,684,'metal',.70),air(.069,.042,1600,7200,.30),tone(.145,.126,852,975,'metal',.59)],
  ward: [tone(0,.091,141,86,'thump',.56),tone(.003,.235,329.6,328,'glass',.68),tone(.031,.224,493.9,492,'hollow',.58),tone(.084,.181,659.3,657,'glass',.34)],
  rupture: [tone(0,.202,191,51,'thump',1),air(.006,.152,170,4900,.65),tone(.088,.168,99,47,'edge',.51),air(.119,.138,390,3300,.39)],
  surge: [tone(0,.086,250,334,'edge',.62),tone(.066,.091,374,495,'edge',.69),tone(.137,.110,494,750,'edge',.69),tone(.209,.139,747,995,'glass',.62)],
  vortex: [tone(0,.214,799,258,'hollow',.67),tone(.033,.171,935,418,'glass',.27),air(.037,.191,450,4800,.34),tone(.179,.167,265,643,'hollow',.72),tone(.226,.124,354,867,'glass',.27)],
  forge: [tone(0,.198,162,102,'metal',.78),air(0,.052,750,7100,.62),tone(.016,.202,602,571,'metal',.66),tone(.174,.121,1138,1074,'glass',.37)],
  spin: [air(0,.10,570,5200,.51),tone(0,.091,289,728,'hollow',.49),air(.086,.11,780,6400,.54),tone(.09,.109,712,345,'hollow',.55),tone(.188,.10,295,189,'thump',.54)],
  dodge: [air(0,.114,1200,7200,.63),tone(.002,.087,675,1220,'hollow',.54),tone(.08,.083,1230,625,'hollow',.42)],
  perfect: [tone(0,.099,880,880,'glass',.86),tone(.043,.15,1174.7,1174.7,'glass',.66),tone(.098,.194,1760,1760,'bell',.65)],
  trainWin: [tone(0,.101,587.3,587.3,'bell',.80),tone(.072,.114,740,740,'bell',.81),tone(.145,.140,880,880,'bell',.82),tone(.235,.223,1174.7,1174.7,'glass',.77),tone(.24,.199,587.3,587.3,'hollow',.46)],
  telegraph: [tone(0,.071,311.1,311.1,'soft',.75),tone(.115,.105,349.2,340,'soft',.65)],
  interrupt: [air(0,.035,970,6600,.50),tone(0,.06,1310,380,'edge',.65),tone(.085,.107,625,235,'metal',.65),tone(.092,.113,120,68,'thump',.52)]
};

function sinCycle(x) {
  const phase = (x - Math.floor(x)) * cycles;
  const index = Math.floor(phase);
  return wave[index] + (wave[index + 1] - wave[index]) * (phase - index);
}

function fingerprint(value) {
  let h = 2166136261;
  for (const character of String(value)) h = Math.imul(h ^ character.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

function bake(ctx, name) {
  let bank = cache.get(ctx);
  if (!bank) { bank = new Map(); cache.set(ctx, bank); }
  if (bank.has(name)) return bank.get(name);
  const layers = scores[name];
  const length = Math.ceil(sampleRate * Math.max(...layers.map(l => l.at + l.duration)));
  const result = ctx.createBuffer(1, length, sampleRate);
  const data = result.getChannelData(0);
  let noiseState = fingerprint(name);
  for (const l of layers) {
    const count = Math.round(sampleRate * l.duration), offset = Math.round(l.at * sampleRate);
    const attack = Math.round(sampleRate * (l.sound === 'hollow' ? .006 : .002));
    const lowK = l.low ? 1 - Math.exp(-2 * Math.PI * l.low / sampleRate) : 0;
    const highK = l.high ? 1 - Math.exp(-2 * Math.PI * l.high / sampleRate) : 0;
    let phase = 0, low = 0, high = 0;
    for (let i = 0; i < count && offset + i < length; i++) {
      const t = i / count, tail = 1 - t, envelope = Math.min(1, i / attack) * tail * tail;
      let value;
      if (l.sound === 'air') {
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        const white = noiseState / 2147483648 - 1;
        low += lowK * (white - low); high += highK * (white - high);
        value = (high - low) * 1.4;
      } else {
        phase += (l.to + (l.hz - l.to) * tail * tail) / sampleRate;
        const s = sinCycle(phase);
        switch (l.sound) {
          case 'glass': value = s + .29 * tail * sinCycle(phase * 2.51) + .11 * sinCycle(phase * 3.98); break;
          case 'metal': value = s + .46 * tail * sinCycle(phase * 2.74) + .22 * tail * sinCycle(phase * 4.39); break;
          case 'edge': value = s + .37 * sinCycle(phase * 3) + .11 * sinCycle(phase * 5); break;
          case 'hollow': value = sinCycle(phase + .16 * sinCycle(1.5 * phase) * tail); break;
          case 'thump': value = s + .28 * tail * sinCycle(2 * phase); break;
          case 'bell': value = sinCycle(phase + .115 * sinCycle(2.02 * phase) * tail) + .18 * sinCycle(phase * 2); break;
          default: value = s + .09 * sinCycle(phase * 3);
        }
      }
      data[offset + i] += l.gain * envelope * value;
    }
  }
  let peak = 0, energy = 0, maxWindow = 0;
  const width = Math.round(sampleRate * .025);
  for (let i = 0; i < length; i++) {
    peak = Math.max(peak, Math.abs(data[i]));
    energy += data[i] * data[i];
    if (i >= width) energy -= data[i-width] * data[i-width];
    maxWindow = Math.max(maxWindow, energy);
  }
  const target = name === 'telegraph' ? .075 : name === 'rupture' || name === 'trainWin' ? .154 : .132;
  const scale = Math.min(.54 / peak, target / Math.sqrt(maxWindow / width));
  for (let i = 0; i < length; i++) data[i] *= scale;
  bank.set(name, result);
  return result;
}

const clamp = (n, min, max, fallback) => Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

export function synthCue(ctx, master, name, {rate=1, pan=0, level=1, seed=0, onended}={}) {
  if (!ctx || !master || ctx.state === 'closed' || !Object.hasOwn(scores, name) || level <= 0) return;
  const hash = fingerprint(seed);
  const pitch = .977 + .046 * (hash & 65535) / 65535;
  const cutoff = 4100 + 4500 * (hash >>> 16) / 65535;
  const buffer = bake(ctx, name);
  const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
  const stereo = ctx.createStereoPanner?.();
  const now = ctx.currentTime;
  source.buffer = buffer;
  const maxTime=Object.hasOwn(cinematic,name)?1.6:.5;
  source.playbackRate.value = clamp(clamp(rate,.65,1.60,1) * pitch, buffer.duration/maxTime, buffer.duration/.12, 1);
  filter.type = 'lowpass'; filter.frequency.value = Math.min(ctx.sampleRate*.46, cutoff); filter.Q.value = .6;
  gain.gain.value = clamp(level, 0, 1.35, 1);
  source.connect(filter); filter.connect(gain);
  if (stereo) {stereo.pan.value = clamp(pan, -1, 1, 0);gain.connect(stereo);stereo.connect(master);}
  else gain.connect(master);
  let stopped = false, ended = false;
  source.onended = () => {
    if (ended) return;
    ended = true;
    source.disconnect(); filter.disconnect(); gain.disconnect(); stereo?.disconnect();
    if (typeof onended === 'function') onended();
  };
  source.start(now);
  return {stop() {
    if (stopped || ended || ctx.state === 'closed') return;
    stopped = true;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + .010);
    source.stop(t + .012);
  }};
}
