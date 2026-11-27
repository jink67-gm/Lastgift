// 프롤로그(명세서 §4 0장 첫 문단) 시간표와 단체사진 구도. three.js와 무관한 순수 값·계산(단위 시험 대상).
//   ① 단체사진(나중 5장 장면을 먼저 보여 준다): 예약 셔터가 깜박이는 동안 화면 아래로 콩이 꼬리가 휙 → 모두 발밑을 본다 → 찰칵
//   ② 사진을 뒤집으면 '한 시간 전, 마을 광장'
//   ③ 아무도 없는 눈보라 광장 → 별빛 → 삐걱거리는 썰매가 광장 눈더미에 처박힘 → 선물·요정이 흩어짐
//      → 눈 구름이 가라앉는 동안 쓰러진 요정들에게 낮게 다가감 → 하나씩 일어나 두리번 → 산타 무사(손 흔들기)
//      → 도토가 눈을 털고 썰매 날을 살핌 → 산타가 썰매 한쪽을 받침 → 흩어진 선물의 그림 이름표 → 0장 플레이
// 대사·자막 없음. 글자는 사진 뒷면 한 줄뿐(소품).

/** 구간 [시작, 끝](초) */
export type Span = readonly [number, number];

export const PROLOGUE = {
  photo: {
    /** 사진기가 천천히 다가간다 */
    push: [0, 5.6] as Span,
    /** 예약 셔터 깜박임(점점 빨라진다) */
    blinks: [1.6, 2.6, 3.4, 4.0, 4.45, 4.8, 5.05] as const,
    /** 콩이가 화면 아래를 가로지른다 */
    tail: [4.3, 5.05] as Span,
    /** 모두 발밑을 내려다본다 */
    lookDown: [4.45, 4.85] as Span,
    shutter: 5.35,
  },
  card: {
    show: [5.6, 6.3] as Span,
    flip: [8.4, 9.3] as Span,
    /** 뒷면을 보여 준 뒤 사라진다 */
    hide: [11.3, 12.0] as Span,
  },
  crash: {
    /** 눈보라 밤하늘 */
    storm: [11.6, 37.1] as Span,
    /** 아무도 없는 눈보라 광장을 천천히 훑는다(폭풍 전 고요) */
    quiet: [12.0, 15.0] as Span,
    /** 하늘을 가르는 별빛 */
    streak: [14.8, 17.8] as Span,
    /** 썰매가 내려와 미끄러진다 */
    sleigh: [17.6, 20.2] as Span,
    impact: 20.2,
    /** 선물이 흩어져 떨어진다 */
    gifts: [20.3, 21.6] as Span,
    /** 요정들이 튕겨 나가 눈밭에 쓰러진다 */
    elves: [20.35, 21.4] as Span,
    /** 눈 구름이 가라앉는 동안 쓰러진 요정들에게 낮게 다가간다(정적) */
    settle: [21.6, 24.6] as Span,
    /** 요정들이 하나씩 일어나 두리번거린다 */
    elfUp: [24.6, 26.8] as Span,
    /** 산타가 썰매 안에서 어리둥절하게 일어나 내려선다 */
    santaUp: [26.8, 28.2] as Span,
    santaOut: [28.2, 29.1] as Span,
    /** 산타가 손을 흔든다(무사하다) */
    santaWave: [29.1, 30.7] as Span,
    /** 도토가 눈더미에서 나와 눈을 털고 썰매 날로 간다 */
    dotoUp: [30.4, 31.3] as Span,
    dotoShake: [31.3, 32.4] as Span,
    dotoWalk: [32.4, 33.8] as Span,
    /** 산타가 썰매 앞쪽을 받친다 */
    santaHold: [33.4, 34.6] as Span,
    /** 흩어진 선물을 훑으며 그림 이름표가 하나씩 나타난다 */
    tags: [34.0, 36.4] as Span,
    /** 눈보라가 잦아든다 */
    calm: [30.0, 35.0] as Span,
  },
  /** 0장 플레이 화면으로 넘어가는 어둡게 하기 */
  fadeOut: [36.6, 37.1] as Span,
  end: 37.1,
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
/**
 * 단체사진 자리: 큰 트리 남남동(배경 왼쪽에 트리), 사진기는 남쪽 조금 서쪽(docs/PLAZA_PLAN.md).
 * 예전(트리 바로 남쪽 0, 4.6)에는 트리가 산타 머리 바로 위에 겹쳐 "트리를 쓴 산타"처럼 보였고, 화단 턱이 발 뒤에 받침대처럼 보였다.
 */
export const PHOTO_SPOT = { x: 2.2, z: 6.0 };

/**
 * 참가 요정 자리 번호(모자)로 단체사진 구도를 정한다. 같은 참가자면 언제나 같은 구도(5장 재현).
 * 사진기는 요정 눈높이쯤의 삼각대(요정들이 맞춘 예약 셔터)라 산타를 조금 올려다본다.
 */
export function photoLineup(slots: readonly number[]): PhotoSetup {
  const order = [...slots].sort((a, b) => a - b);
  // 사진기: 조금 뒤로 물러 낮게(요정 눈높이 삼각대) → 트리 꼭대기 별과 요정 발끝이 함께 들어온다
  const camera = { x: PHOTO_SPOT.x - 1.2, y: 1.2, z: PHOTO_SPOT.z + 9.0, tx: PHOTO_SPOT.x - 0.6, ty: 2.8, tz: PHOTO_SPOT.z, fov: 46 };
  // 모두 사진기를 본다
  const face = (x: number, z: number) => Math.atan2(camera.x - x, camera.z - z);
  const elves = order.map((slot, i) => {
    // 산타 왼쪽·오른쪽을 번갈아(1·2번째가 가장 가깝게)
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const x = PHOTO_SPOT.x + side * (1.0 + rank * 0.95);
    const z = PHOTO_SPOT.z + 1.7 + rank * 0.3;
    return { slot, x, z, facing: face(x, z) };
  });
  const santa = { x: PHOTO_SPOT.x, z: PHOTO_SPOT.z - 0.35 };
  return { version: 1, elves, santa: { ...santa, facing: face(santa.x, santa.z) }, camera };
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
