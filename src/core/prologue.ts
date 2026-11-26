// 프롤로그(명세서 §4 0장 첫 문단) 시간표와 단체사진 구도. three.js와 무관한 순수 값·계산(단위 시험 대상).
//   ① 단체사진(나중 5장 장면을 먼저 보여 준다): 예약 셔터가 깜박이는 동안 화면 아래로 콩이 꼬리가 휙 → 모두 발밑을 본다 → 찰칵
//   ② 사진을 뒤집으면 '한 시간 전, 마을 광장'
//   ③ 눈보라 속 별빛 → 삐걱거리는 썰매가 광장 눈더미에 처박힘 → 선물·요정이 흩어짐 → 산타 무사(손 흔들기)
//      → 도토가 눈을 털고 썰매 날을 살핌 → 산타가 썰매 한쪽을 받침 → 0장 플레이
// 대사·자막 없음. 글자는 사진 뒷면 한 줄뿐(소품).

/** 구간 [시작, 끝](초) */
export type Span = readonly [number, number];

export const PROLOGUE = {
  photo: {
    /** 예약 셔터 깜박임(점점 빨라진다) */
    blinks: [1.0, 1.8, 2.45, 2.95, 3.35, 3.65] as const,
    /** 콩이가 화면 아래를 가로지른다 */
    tail: [3.0, 3.75] as Span,
    /** 모두 발밑을 내려다본다 */
    lookDown: [3.15, 3.5] as Span,
    shutter: 3.95,
  },
  card: {
    show: [4.15, 4.75] as Span,
    flip: [5.9, 6.7] as Span,
    /** 뒷면을 보여 준 뒤 사라진다 */
    hide: [8.1, 8.7] as Span,
  },
  crash: {
    /** 눈보라 밤하늘 */
    storm: [8.4, 19.2] as Span,
    /** 하늘을 가르는 별빛 */
    streak: [8.9, 10.9] as Span,
    /** 썰매가 내려와 미끄러진다 */
    sleigh: [10.6, 12.6] as Span,
    impact: 12.6,
    /** 선물이 흩어져 떨어진다 */
    gifts: [12.7, 14.0] as Span,
    /** 요정들이 굴러 나와 일어선다 */
    elves: [12.9, 14.1] as Span,
    /** 산타가 썰매에서 일어나 내려선다 */
    santaUp: [13.6, 14.4] as Span,
    santaOut: [14.4, 15.3] as Span,
    /** 산타가 손을 흔든다(무사하다) */
    santaWave: [15.3, 16.9] as Span,
    /** 도토가 눈더미에서 나와 눈을 털고 썰매 날로 간다 */
    dotoUp: [14.2, 15.0] as Span,
    dotoShake: [15.0, 15.9] as Span,
    dotoWalk: [15.9, 17.2] as Span,
    /** 산타가 썰매 앞쪽을 받친다 */
    santaHold: [16.9, 18.0] as Span,
    /** 눈보라가 잦아든다 */
    calm: [16.0, 19.0] as Span,
  },
  /** 0장 플레이 화면으로 넘어가는 어둡게 하기 */
  fadeOut: [19.2, 19.6] as Span,
  end: 19.6,
} as const;

/** t가 구간 안에서 어디쯤인가(0~1로 자른다) */
export function seg(t: number, s: Span): number {
  if (s[1] <= s[0]) return t >= s[1] ? 1 : 0;
  return Math.min(1, Math.max(0, (t - s[0]) / (s[1] - s[0])));
}

/** 부드럽게 시작하고 멈추기 */
export function ease(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 예약 셔터 불빛이 지금 켜져 있는가(깜박임마다 0.16초) */
export function blinkOn(t: number): boolean {
  return PROLOGUE.photo.blinks.some((b) => t >= b && t < b + 0.16);
}

/** 지금 장면 이름(화면 확인·시험용) */
export type PrologueBeat = 'photo' | 'card' | 'storm' | 'crash' | 'aftermath' | 'done';
export function beatAt(t: number): PrologueBeat {
  if (t >= PROLOGUE.end) return 'done';
  if (t < PROLOGUE.photo.shutter) return 'photo';
  if (t < PROLOGUE.card.hide[1]) return 'card';
  if (t < PROLOGUE.crash.sleigh[0]) return 'storm';
  if (t < PROLOGUE.crash.impact + 0.6) return 'crash';
  return 'aftermath';
}

// ── 단체사진 구도(5장에서 같은 컷을 다시 찍는다) ──────────────

export interface PhotoSetup {
  version: 1;
  /** 사진에 선 요정(참가자 자리 번호 = 모자) */
  elves: { slot: number; x: number; z: number; facing: number }[];
  santa: { x: number; z: number; facing: number };
  /** 사진기(원근) 위치·보는 점·세로 화각(도) */
  camera: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov: number };
}

/** 사진 찍는 자리: 썰매 앞(남쪽) 눈길. 산타가 가운데, 요정들은 산타 앞 양옆으로 번갈아 선다 */
export const PHOTO_SPOT = { x: 2.7, z: -3.2 };

/**
 * 참가 요정 자리 번호(모자)로 단체사진 구도를 정한다. 같은 참가자면 언제나 같은 구도(5장 재현).
 * 사진기는 요정 눈높이쯤의 삼각대(요정들이 맞춘 예약 셔터)라 산타를 조금 올려다본다.
 */
export function photoLineup(slots: readonly number[]): PhotoSetup {
  const order = [...slots].sort((a, b) => a - b);
  const facing = 0; // 남쪽(+z, 사진기 쪽)을 본다
  const elves = order.map((slot, i) => {
    // 산타 왼쪽·오른쪽을 번갈아(1·2번째가 가장 가깝게)
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    return { slot, x: PHOTO_SPOT.x + side * (1.0 + rank * 0.95), z: PHOTO_SPOT.z + 1.7 + rank * 0.3, facing };
  });
  return {
    version: 1,
    elves,
    santa: { x: PHOTO_SPOT.x, z: PHOTO_SPOT.z - 0.35, facing },
    camera: { x: PHOTO_SPOT.x, y: 1.2, z: PHOTO_SPOT.z + 7.8, tx: PHOTO_SPOT.x, ty: 2.25, tz: PHOTO_SPOT.z, fov: 46 },
  };
}

/** 저장해 둔 값이 사진 구도인지(체크포인트 읽기 검사) */
export function isPhotoSetup(v: unknown): v is PhotoSetup {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  const cam = p.camera as Record<string, unknown> | undefined;
  const santa = p.santa as Record<string, unknown> | undefined;
  return (
    p.version === 1 &&
    Array.isArray(p.elves) &&
    p.elves.length >= 1 &&
    p.elves.length <= 4 &&
    p.elves.every((e: Record<string, unknown>) => Number.isInteger(e.slot) && num(e.x) && num(e.z) && num(e.facing)) &&
    !!santa &&
    num(santa.x) &&
    num(santa.z) &&
    num(santa.facing) &&
    !!cam &&
    ['x', 'y', 'z', 'tx', 'ty', 'tz', 'fov'].every((k) => num(cam[k]))
  );
}
