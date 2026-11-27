// 0장 광장 배치(docs/PLAZA_PLAN.md 안 A). 판정용 충돌체와 화면용 소품 배치를 함께 선언한다.
// 좌표: x 동쪽, z 남쪽(카메라 쪽), 광장 가운데 (0, 0).
// 둥근 광장(반지름 16) 가운데 큰 마을 트리, 둘레에 골목 넷 = 0장 배달 표식 넷(유나네·수선집·민재네·할머니 댁).
// 카메라(남동쪽 위) 쪽 둘레에는 낮은 것만 둔다. 시계탑은 광장 밖 북쪽 랜드마크(§3.2).
import type { Bounds, Collider } from '../core/collision';
import { KENNEY_HOUSE_SCALE } from './townScale';

/** 둥근 광장 반지름(돌 포장 끝). 둘레 벽 안쪽 면이 여기서 0.3 안쪽 */
export const PLAZA_R = 16;
/** 판정 경계(사각형): 둥근 둘레 벽이 실제로 막고, 이것은 그 바깥을 한 번 더 막는다 */
export const PLAZA_BOUNDS: Bounds = { minX: -16.5, maxX: 16.5, minZ: -16.5, maxZ: 16.5 };

/** 시험 광장(?test) 요정 시작: 트리 화단 남동쪽, 화면 위·아래·좌·우로 몇 걸음 열려 있다 */
export const ELF_SPAWN = { x: 6, z: 7 };

export type PropKind = 'sleigh' | 'snowPile' | 'santa' | 'tree' | 'treeBed' | 'pine' | 'cabin' | 'clockTower' | 'bench' | 'lamp' | 'workshop' | 'workbench' | 'shed' | 'snowman' | 'candyCane';

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** 바닥면 크기(m). 사각형은 w·d(회전 뒤 x·z 크기), 원형은 r */
  w?: number;
  d?: number;
  r?: number;
  rotY?: number;
  /** 통나무집 깊이 칸 수(1칸 = 2 m) */
  cells?: number;
  collider: Collider | null;
}

const box = (x: number, z: number, w: number, d: number): Collider => ({ kind: 'box', x, z, hx: w / 2, hz: d / 2 });
const circle = (x: number, z: number, r: number): Collider => ({ kind: 'circle', x, z, r });

/**
 * 사람이 사는 통나무집(Kenney 조각, 문 높이 = 요정 키 × 4.5). 가로 2칸, 깊이 cells칸(1칸 = KENNEY_HOUSE_SCALE 단위).
 * 판정 상자는 보이는 벽 바깥 둘레와 맞춘다. rotY가 ±π/2면 가로·세로가 바뀐다
 */
function cabin(id: string, x: number, z: number, cells: number, rotY: number): Prop {
  // 벽 바깥면은 칸 가장자리에서 0.2단위 더 나와 있다(Kenney 벽 두께) → 보이는 벽 둘레와 판정을 맞춘다
  const across = 2.4 * KENNEY_HOUSE_SCALE;
  const deep = (cells + 0.4) * KENNEY_HOUSE_SCALE;
  const side = Math.abs(Math.sin(rotY)) > 0.5;
  const w = side ? deep : across;
  const d = side ? across : deep;
  // 플레이 경계와 겹치지 않는 바깥 집은 판정이 필요 없다(요정이 경계 밖으로 못 나간다)
  const B = PLAZA_BOUNDS;
  const inside = x - w / 2 < B.maxX && x + w / 2 > B.minX && z - d / 2 < B.maxZ && z + d / 2 > B.minZ;
  return { id, kind: 'cabin', x, z, w, d, rotY, cells, collider: inside ? box(x, z, w, d) : null };
}

/** 가로등(사람용): 기둥 받침만 막는다 */
function lamp(id: string, x: number, z: number): Prop {
  return { id, kind: 'lamp', x, z, r: 0.25, collider: circle(x, z, 0.25) };
}

const H = KENNEY_HOUSE_SCALE; // 집 1칸
/** 방향(도, x축에서 z축 쪽으로) → 단위 벡터 */
const dirOf = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), z: Math.sin((deg * Math.PI) / 180) });
const polar = (deg: number, r: number) => ({ x: dirOf(deg).x * r, z: dirOf(deg).z * r });

export type AlleyDest = 'yuna' | 'tailor' | 'minjae' | 'grandma';
/**
 * 광장 둘레의 골목 넷(입구 폭 4.4). 입구마다 그 장의 배달 표식이 선다(0장 분류 = "이 길로 가면 그 집").
 * 골목은 다음 장 공간이라 0장에서는 둘레 벽이 입구를 막는다(입구 바닥·양옆 집만 보인다).
 * 카메라는 남동쪽 위: 남동(25°~115°)에는 골목·집을 두지 않는다.
 */
export const ALLEYS: readonly { dest: AlleyDest; deg: number; width: number }[] = [
  { dest: 'yuna', deg: -62, width: 4.4 }, // 북북동: 1장 돌 아치 → 우편함 골목 → 유나네
  { dest: 'tailor', deg: 8, width: 4.4 }, // 동: 2장 수선집
  { dest: 'minjae', deg: 128, width: 4.4 }, // 남서: 3장 민재네(화면 왼쪽 아래라 가리지 않는다)
  { dest: 'grandma', deg: 196, width: 4.4 }, // 서북서: 4장 할머니 댁
];
export const alleyDir = (dest: AlleyDest) => dirOf(ALLEYS.find((a) => a.dest === dest)!.deg);
/** 골목 입구 바닥 가운데(광장 둘레) */
export const alleyMouthOf = (dest: AlleyDest) => polar(ALLEYS.find((a) => a.dest === dest)!.deg, PLAZA_R);

/** 가운데 큰 마을 트리와 둘레 낮은 화단(턱 높이). 요정은 화단 둘레를 돈다 */
export const TREE_BED = { x: 0, z: 0, r: 3.2 };

/**
 * 요정 공방(요정 크기 통나무집 2 × 2칸): 광장 북쪽 가장자리에 반쯤 걸쳐 앞면(+z)이 광장 가운데를 본다.
 * 문 오른쪽 창 아래 낮은 작업대. 출발 기지.
 */
export const WORKSHOP = {
  x: -7.6,
  z: -14.2,
  /** Kenney 배율: 문 열린 부분 0.8 × 3.5 = 2.8(요정 키의 약 2.1배) */
  scale: 3.5,
  /** 요정 손 높이의 문손잡이 */
  knob: 1.25,
};
const WS_HALF = 1.2 * WORKSHOP.scale;
/** 공방 문(앞면 왼쪽 칸)·창(오른쪽 칸) 위치 */
export const WORKSHOP_DOOR = { x: WORKSHOP.x - WORKSHOP.scale / 2, z: WORKSHOP.z + WS_HALF };
export const WORKSHOP_WINDOW = { x: WORKSHOP.x + WORKSHOP.scale / 2, z: WORKSHOP.z + WS_HALF };
/** 낮은 작업대(요정 허리~가슴 높이): 공방 창 아래, 문 오른쪽 */
export const WORKBENCH = { x: WORKSHOP_WINDOW.x + 0.35, z: WORKSHOP.z + WS_HALF + 0.85, w: 2.6, d: 0.9, h: 1.0 };
/**
 * 썰매(산타의 썰매 1.8배, 돌리지 않는다: 5·6장 양말·가방·좌석이 썰매 기준): 트리 북동쪽 눈더미에 앞이 처박혔다.
 * 카메라(남동쪽 위)에서 트리에 가리지 않는다.
 */
export const SLEIGH = { x: 3.6, z: -6.6, rotY: 0 };

// 골목 양옆 집(사람 크기 통나무집, 앞면이 골목을 본다): 광장 둘레 바깥
function alleyCabins(): Prop[] {
  const out: Prop[] = [];
  for (const a of ALLEYS) {
    const d = dirOf(a.deg);
    const side = { x: -d.z, z: d.x };
    // 카메라 쪽(동·남서) 골목은 사람 집이 광장을 가린다 → 집 없이 낮은 울타리만(꾸밈 fences)
    if (a.dest === 'minjae' || a.dest === 'tailor') continue;
    const far = 21.5;
    for (const s of [-1, 1]) {
      const x = d.x * far + side.x * s * (a.width / 2 + HALF_HOUSE + 0.4);
      const z = d.z * far + side.z * s * (a.width / 2 + HALF_HOUSE + 0.4);
      // 앞면(+z)이 골목 가운데 선을 보게: 집 → 골목 방향 = -side * s. 판정 상자는 0/±π/2만 지원하므로 가까운 직각으로
      const face = Math.atan2(-side.x * s, -side.z * s);
      const rot = Math.round(face / (Math.PI / 2)) * (Math.PI / 2);
      out.push(cabin(`house-${a.dest}-${s > 0 ? 'r' : 'l'}`, x, z, 2, rot));
    }
  }
  return out;
}
const HALF_HOUSE = 1.2 * H;

/** 둘레 가로등: 먼 쪽 반원에만(카메라 쪽 남동에 세우면 화면 앞에 검은 기둥이 선다). 골목 입구와 겹치면 조금 옆으로 */
function ringLamps(): Prop[] {
  const out: Prop[] = [];
  for (let k = 0; k < 8; k++) {
    let deg = 22.5 + k * 45;
    if (deg > 0 && deg < 130) continue; // 카메라 쪽(남동)
    for (const a of ALLEYS) {
      const diff = ((deg - a.deg + 540) % 360) - 180;
      if (Math.abs(diff) < 16) deg = a.deg + (diff >= 0 ? 16 : -16);
    }
    const p = polar(deg, PLAZA_R - 1.0);
    out.push(lamp(`lamp${k}`, p.x, p.z));
  }
  return out;
}

export const PLAZA_PROPS: readonly Prop[] = [
  // 가운데 큰 마을 트리 + 둘레 화단(판정은 화단 턱)
  { id: 'tree', kind: 'tree', x: TREE_BED.x, z: TREE_BED.z, r: 1.6, collider: null },
  { id: 'treeBed', kind: 'treeBed', x: TREE_BED.x, z: TREE_BED.z, r: TREE_BED.r, collider: circle(TREE_BED.x, TREE_BED.z, TREE_BED.r) },
  // 썰매 + 앞쪽 눈더미. 판정: 썰매 몸 상자 + 눈더미 원
  { id: 'sleigh', kind: 'sleigh', x: SLEIGH.x, z: SLEIGH.z, w: 5.4, d: 2.8, rotY: SLEIGH.rotY, collider: box(SLEIGH.x, SLEIGH.z, 5.4, 2.8) },
  { id: 'snowPile', kind: 'snowPile', x: SLEIGH.x + 3.1, z: SLEIGH.z + 0.1, r: 1.2, collider: circle(SLEIGH.x + 3.1, SLEIGH.z + 0.1, 1.2) },
  // 산타: 썰매 앞코 남쪽에서 썰매를 받친다(사람 어른). 북쪽에 서면 유나네 골목 표식을 가린다
  { id: 'santa', kind: 'santa', x: SLEIGH.x + 2.6, z: SLEIGH.z + 2.3, r: 1.1, collider: circle(SLEIGH.x + 2.6, SLEIGH.z + 2.3, 1.1) },
  // 요정 공방 · 작업대
  { id: 'workshop', kind: 'workshop', x: WORKSHOP.x, z: WORKSHOP.z, w: 2 * WS_HALF, d: 2 * WS_HALF, collider: box(WORKSHOP.x, WORKSHOP.z, 2 * WS_HALF, 2 * WS_HALF) },
  { id: 'workbench', kind: 'workbench', x: WORKBENCH.x, z: WORKBENCH.z, w: WORKBENCH.w, d: WORKBENCH.d, collider: box(WORKBENCH.x, WORKBENCH.z, WORKBENCH.w + 0.1, WORKBENCH.d + 0.1) },
  // 시계탑: 광장 밖 북쪽, 공방과 유나네 골목 사이로 보인다
  { id: 'clockTower', kind: 'clockTower', x: 1.5, z: -22.5, w: 5.6, d: 5.6, collider: null },
  // 골목 양옆 사람 집
  ...alleyCabins(),
  // 소나무: 광장 밖 사이사이(카메라 쪽 남동은 비운다)
  { id: 'pine1', kind: 'pine', x: -21, z: -15, r: 2.9, collider: null },
  { id: 'pine2', kind: 'pine', x: 15, z: -21, r: 2.9, collider: null },
  { id: 'pine3', kind: 'pine', x: -24, z: 6, r: 2.9, collider: null },
  { id: 'pine4', kind: 'pine', x: 23, z: -10, r: 2.9, collider: null },
  { id: 'pine5', kind: 'pine', x: -8, z: -27, r: 2.9, collider: null },
  { id: 'pine6', kind: 'pine', x: -20, z: 20, r: 2.9, collider: null },
  // 둘레 가로등
  ...ringLamps(),
  // 작은 소품(Kenney CC0): 북서쪽 눈사람(공방과 할머니 댁 골목 사이), 유나네 골목 입구 양옆 지팡이 사탕(둘레 벽 위라 판정 없음)
  { id: 'snowman', kind: 'snowman', x: -9.4, z: -7.9, r: 0.7, rotY: 0.75, collider: circle(-9.4, -7.9, 0.7) },
  ...[-1, 1].map((s) => ({ id: `candyCane${s > 0 ? 'R' : 'L'}`, kind: 'candyCane' as const, ...polar(-62 + s * 9.5, PLAZA_R + 0.2), rotY: s * 0.6, collider: null })),
];

/** 둥근 둘레 벽(판정): 원 조각을 둘레에 촘촘히(골목 입구도 막는다) */
function ringWall(): Collider[] {
  const n = 64;
  return Array.from({ length: n }, (_, i) => circle(Math.cos((i / n) * Math.PI * 2) * (PLAZA_R + 0.6), Math.sin((i / n) * Math.PI * 2) * (PLAZA_R + 0.6), 0.9));
}

/**
 * 화면용 꾸밈(판정 없음).
 * - 다진 눈길: 공방 문 → 트리 둘레 → 골목 넷으로 갈라진다(골목 입구까지).
 * - 썰매 날 자국: 썰매가 들어온 쪽(서쪽)에서 썰매 뒤까지 두 줄.
 * - 발자국: 실제로 오갈 곳(공방 문 ↔ 작업대, 트리 둘레)에만.
 */
const ringPath = (r: number, n = 24) => Array.from({ length: n + 1 }, (_, i) => polar((i / n) * 360 + 90, r));
export const PLAZA_DRESSING = {
  /** 공방 문 → 트리 둘레 길 */
  path: {
    width: 2.0,
    points: [
      { x: WORKSHOP_DOOR.x, z: WORKSHOP_DOOR.z + 0.5 },
      { x: WORKSHOP_DOOR.x + 0.4, z: WORKSHOP_DOOR.z + 2.6 },
      polar(-125, 6.2),
    ],
  },
  /** 트리 둘레 원 길 + 골목 넷으로 가는 갈래 길 */
  paths: [
    { width: 1.9, points: ringPath(6.2) },
    ...ALLEYS.map((a) => ({ width: 2.0, points: [polar(a.deg, 6.2), polar(a.deg, 11), polar(a.deg, PLAZA_R + 6)] })),
  ],
  /** 발자국 줄(요정 발, 실제로 오가는 곳) */
  footprints: [
    [{ x: WORKSHOP_DOOR.x, z: WORKSHOP_DOOR.z + 0.3 }, { x: WORKSHOP_DOOR.x + 1.0, z: WORKSHOP_DOOR.z + 1.6 }, { x: WORKBENCH.x - 0.4, z: WORKBENCH.z + 0.8 }],
    [{ x: WORKBENCH.x + 0.4, z: WORKBENCH.z + 0.8 }, polar(-110, 7.5), polar(-80, 7.2)],
  ],
  /** 유나네 골목(1장) 입구 우편함(물고기 깃발 = 유나네 표식과 같은 그림) */
  mailbox: { ...polar(-62 + 9, PLAZA_R + 1.6), rotY: Math.PI / 2 },
  /** 0장이 끝나면 카메라가 조금 보여 주는 곳: 유나네 골목 입구(1장으로 가는 길) */
  alleyMouth: alleyMouthOf('yuna'),
  /** 썰매가 들어온 방향(썰매 날 자국이 시작하는 쪽 끝)과 날 간격(썰매 1.8배) */
  sleighEntry: { length: 2.6, gauge: 2.0 },
  /** 닫힌 노점(서쪽 둘레 안쪽, 앞면이 광장 가운데를 본다 → 사진기에서 줄무늬 차양이 보인다). 판정은 PLAZA_COLLIDERS 끝의 원 */
  stall: { x: -12.6, z: 3.6, rotY: Math.atan2(12.6, -3.6) },
  /** 둥근 둘레(눈 둑·돌담을 그린다) */
  ring: { r: PLAZA_R, alleys: ALLEYS },
  /** 카메라 쪽 골목(수선집·민재네) 양옆 낮은 울타리(사람 집 대신, 광장을 가리지 않게) */
  fences: ALLEYS.filter((a) => a.dest === 'tailor' || a.dest === 'minjae').flatMap((a) => {
    const d = dirOf(a.deg);
    const side = { x: -d.z, z: d.x };
    return [-1, 1].map((s) => {
      const o = (a.width / 2 + 0.5) * s;
      return { from: { x: d.x * (PLAZA_R + 0.8) + side.x * o, z: d.z * (PLAZA_R + 0.8) + side.z * o }, to: { x: d.x * (PLAZA_R + 9) + side.x * o, z: d.z * (PLAZA_R + 9) + side.z * o } };
    });
  }),
  laneFences: [] as { from: { x: number; z: number }; to: { x: number; z: number } }[],
};

/** 길가 울타리 판정: 얇은 상자를 이어 붙인다(울타리 한 줄 = 조각 판정 여러 개) */
function fenceColliders(from: { x: number; z: number }, to: { x: number; z: number }): Collider[] {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / 0.8));
  return Array.from({ length: n }, (_, i) => circle(from.x + (dx * (i + 0.5)) / n, from.z + (dz * (i + 0.5)) / n, 0.42));
}

export const PLAZA_COLLIDERS: readonly Collider[] = [
  ...PLAZA_PROPS.flatMap((p) => (p.collider ? [p.collider] : [])),
  ...PLAZA_DRESSING.laneFences.flatMap((f) => fenceColliders(f.from, f.to)),
  ...ringWall(),
  // 닫힌 노점(꾸밈 PLAZA_DRESSING.stall과 같은 자리)
  { kind: 'circle', x: -12.6, z: 3.6, r: 1.3 },
];
