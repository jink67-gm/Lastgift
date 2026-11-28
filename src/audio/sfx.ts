// 효과음: 파일 없이 Web Audio로 그 자리에서 만든다(외부 에셋·라이선스 없음, 내려받을 것 없음).
// 대사·음악은 없고, 행동이 됐는지 알려 주는 짧은 소리만(명세서 §9: 준비 완료·단자 연결·스위치 피드백).
//   - 브라우저는 사람이 처음 누르기 전에는 소리를 막는다(특히 iPad): 첫 키·터치·클릭에서 켠다.
//   - 설정 「소리」를 끄면 아무 소리도 내지 않는다. 같은 소리를 아주 짧은 사이에 겹쳐 내지 않는다.
//   - 장마다 사건 이름이 비슷하다(pick·drop·complete…) → sfxForEvent 한 곳에서 소리를 고른다.
//     여러 기기에서는 참가자도 방장이 보낸 같은 사건으로 같은 소리를 낸다.

export type SfxName =
  | 'pick'
  | 'drop'
  | 'ok'
  | 'wrong'
  | 'signal'
  | 'throw'
  | 'catch'
  | 'click'
  | 'switch'
  | 'crank'
  | 'charge'
  | 'bark'
  | 'chime'
  | 'complete'
  | 'timeout'
  | 'tick'
  | 'join'
  | 'shutter';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let muted = false;
const lastAt = new Map<SfxName, number>();
/** 시험·점검용: 낸 소리 기록(최근 50) */
export const sfxLog: { name: SfxName; at: number; muted: boolean; played: boolean }[] = [];

function ensure(): Ctx | null {
  if (ctx) return ctx;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** 첫 키·터치·클릭에서 소리를 켠다(한 번 붙이면 된다) */
let attached = false;
export function attachSfx(doc: Document = document): void {
  if (attached) return;
  attached = true;
  const unlock = () => {
    const c = ensure();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  };
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) doc.addEventListener(ev, unlock, { capture: true, passive: true });
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test'))
    (window as unknown as Record<string, unknown>).__lastgiftSfx = { log: () => sfxLog.map((e) => ({ ...e })), state: sfxState };
}

export function setSfxMuted(on: boolean): void {
  muted = on;
}

export function sfxState(): { ready: boolean; running: boolean; muted: boolean } {
  return { ready: !!ctx, running: ctx?.state === 'running', muted };
}

// ── 소리 만들기 ──
function tone(c: Ctx, at: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: Ctx, at: number, dur: number, freq: number, q: number, vol: number, sweepTo?: number): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(master!);
  s.start(at);
  s.stop(at + dur + 0.02);
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // 미디 번호 → Hz

const RECIPES: Record<SfxName, (c: Ctx, t: number) => void> = {
  pick: (c, t) => tone(c, t, 520, 820, 0.09, 'sine', 0.35),
  drop: (c, t) => tone(c, t, 620, 360, 0.11, 'sine', 0.3),
  ok: (c, t) => {
    tone(c, t, NOTE(84), NOTE(84), 0.16, 'triangle', 0.25);
    tone(c, t + 0.08, NOTE(88), NOTE(88), 0.22, 'triangle', 0.25);
  },
  wrong: (c, t) => {
    tone(c, t, 220, 180, 0.12, 'triangle', 0.22);
    tone(c, t + 0.13, 200, 160, 0.14, 'triangle', 0.2);
  },
  signal: (c, t) => tone(c, t, 880, 1320, 0.12, 'sine', 0.22),
  throw: (c, t) => noise(c, t, 0.32, 600, 1.2, 0.3, 2400),
  catch: (c, t) => tone(c, t, 300, 700, 0.08, 'sine', 0.35),
  click: (c, t) => noise(c, t, 0.05, 2500, 3, 0.35),
  switch: (c, t) => {
    noise(c, t, 0.04, 3000, 4, 0.4);
    tone(c, t + 0.03, NOTE(79), NOTE(79), 0.14, 'square', 0.08);
  },
  crank: (c, t) => noise(c, t, 0.035, 1500, 6, 0.25),
  charge: (c, t) => tone(c, t, 300, 1200, 0.5, 'sawtooth', 0.06),
  bark: (c, t) => {
    tone(c, t, 520, 300, 0.09, 'square', 0.1);
    tone(c, t + 0.14, 560, 320, 0.09, 'square', 0.1);
  },
  chime: (c, t) => {
    for (const [i, n] of [79, 83, 86].entries()) tone(c, t + i * 0.07, NOTE(n), NOTE(n), 0.5, 'sine', 0.18);
  },
  complete: (c, t) => {
    for (const [i, n] of [72, 76, 79, 84].entries()) tone(c, t + i * 0.11, NOTE(n), NOTE(n), 0.45, 'triangle', 0.22);
    tone(c, t + 0.44, NOTE(88), NOTE(88), 0.8, 'sine', 0.15);
  },
  timeout: (c, t) => {
    tone(c, t, NOTE(72), NOTE(72), 0.25, 'triangle', 0.22);
    tone(c, t + 0.22, NOTE(67), NOTE(67), 0.45, 'triangle', 0.22);
  },
  tick: (c, t) => tone(c, t, 1000, 1000, 0.05, 'sine', 0.15),
  join: (c, t) => {
    tone(c, t, NOTE(81), NOTE(81), 0.3, 'sine', 0.2);
    tone(c, t + 0.1, NOTE(88), NOTE(88), 0.4, 'sine', 0.16);
  },
  shutter: (c, t) => {
    noise(c, t, 0.05, 2000, 2, 0.45);
    noise(c, t + 0.07, 0.07, 1200, 2, 0.35);
  },
};

/** 같은 소리를 이 간격(초)보다 촘촘히 내지 않는다 */
const GAP: Partial<Record<SfxName, number>> = { crank: 0.12, tick: 0.5, click: 0.05 };

export function playSfx(name: SfxName): void {
  const now = performance.now() / 1000;
  if (now - (lastAt.get(name) ?? -9) < (GAP[name] ?? 0.06)) return;
  lastAt.set(name, now);
  const c = ctx;
  const played = !muted && !!c && !!master && c.state === 'running';
  sfxLog.push({ name, at: Math.round(now * 1000), muted, played });
  if (sfxLog.length > 50) sfxLog.shift();
  if (!played) return;
  try {
    RECIPES[name](c, c.currentTime + 0.005);
  } catch {
    /* 소리가 안 나도 게임은 계속 */
  }
}

/** 장 사건 → 소리(0~6장 공통). 모르는 사건은 소리 없음 */
export function sfxForEvent(e: { type: string; event?: { type: string } }): SfxName | null {
  switch (e.type) {
    case 'pick':
    case 'take':
    case 'grab':
    case 'lift':
      return 'pick';
    case 'drop':
    case 'release':
      return 'drop';
    case 'sorted':
    case 'placed':
    case 'plugged':
    case 'found':
    case 'latched':
      return 'ok';
    case 'wrong':
    case 'blocked':
    case 'needPower':
    case 'notYet':
    case 'miss':
      return 'wrong';
    case 'signal':
      return 'signal';
    case 'throw':
      return 'throw';
    case 'catch':
      return 'catch';
    case 'switch':
      return 'switch';
    case 'charged':
      return 'charge';
    case 'wake':
    case 'bite':
      return 'bark';
    case 'caught':
    case 'gateLocked':
      return 'wrong';
    case 'peek':
      return 'click';
    case 'doorOpened':
    case 'doorClosed':
    case 'gateOpened':
    case 'map':
      return 'click';
    case 'doorbell':
      return 'chime';
    case 'doorOpen':
      return 'click';
    case 'snowball':
      return 'pick';
    case 'splat':
      return 'drop';
    case 'stockingChecked':
    case 'opened':
    case 'handover':
      return 'chime';
    case 'complete':
    case 'delivered':
    case 'deliver':
      return 'complete';
    case 'timeout':
      return 'timeout';
    case 'sewing':
      return e.event ? sfxForEvent(e.event) : null;
    default:
      return null;
  }
}

/** 장 코드에서: 사건 하나에 맞는 소리를 낸다 */
export function sfxEvent(e: { type: string; event?: { type: string } }): void {
  const n = sfxForEvent(e);
  if (n) playSfx(n);
}
