// 0장 광장 배치. 판정용 충돌체와 화면용 소품 배치를 함께 선언한다.
// 좌표: x 오른쪽, z 카메라 쪽. 광장 40 × 28 m, 중심 (0, 0).
// 남쪽(카메라 쪽)은 비워 두어 시야를 가리지 않는다. 북쪽 가운데 시계탑은 다른 골목에서도 보이는 랜드마크(§3.2).
import type { Bounds, Collider } from '../core/collision';
import { BENCH_SCALE, KENNEY_HOUSE_SCALE, TOWN, TT_HOUSE_SCALE } from './townScale';

export const PLAZA_BOUNDS: Bounds = { minX: -20, maxX: 20, minZ: -14, maxZ: 14 };

export const ELF_SPAWN = { x: 3, z: 4 };

export type PropKind = 'sleigh' | 'snowPile' | 'santa' | 'tree' | 'pine' | 'cabin' | 'clockTower' | 'bench' | 'lamp' | 'workshop' | 'workbench' | 'shed';

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

/** 벤치(사람용): 폭 요정 키 × 3.6, 깊이는 앉는 면 높이에 맞춘 배율 */
function bench(id: string, x: number, z: number): Prop {
  const w = TOWN.benchWidth + 0.1;
  const d = 0.64 * BENCH_SCALE.z + 0.1;
  return { id, kind: 'bench', x, z, w, d, collider: box(x, z, w, d) };
}

/** 가로등(사람용): 기둥 받침만 막는다 */
function lamp(id: string, x: number, z: number): Prop {
  return { id, kind: 'lamp', x, z, r: 0.25, collider: circle(x, z, 0.25) };
}

// 사람 키 기준으로 커진 집·나무·시계탑은 플레이 경계(40 × 28) 바로 바깥에 두고 앞면이 광장을 보게 한다.
// 카메라(남동쪽 위)에서 앞면이 보이는 건 북쪽·서쪽 집이다. 오른쪽 아래 집(houseE)만 현관 바닥이 광장 안에 들어오게 걸쳐 둔다.
const H = KENNEY_HOUSE_SCALE; // 집 1칸
const HALF = 1.2 * H; // 2 × 2칸 집의 중심 ~ 벽 바깥면

// 오른쪽 아래(카메라 앞) 집: 앞에 있는 사람 크기 집은 그 뒤 땅을 20 m 가까이 가리므로, 지붕 끝만 화면 가장자리에 걸리게 멀리 둔다
const HOUSE_E = { x: 40, z: 22 }; // 경계 안 어느 자리에서 봐도 요정 앞을 가리지 않는 거리(시선이 지붕 위로 지나간다)
// 서쪽 집(앞면 +x가 광장을 본다): 집 입구 장면. 문 = 앞벽 왼쪽 칸, 창 = 오른쪽 칸
const HOUSE_W = { x: -20.4 - HALF, z: 3 };
export const HOUSE_W_DOOR = { x: -20.4, z: HOUSE_W.z + KENNEY_HOUSE_SCALE / 2 };
const HOUSE_W_WINDOW = { x: -20.4, z: HOUSE_W.z - KENNEY_HOUSE_SCALE / 2 };

/**
 * 요정 공방 골목(광장 북서쪽): 요정 크기의 선물 포장 공방 + 문 옆 낮은 작업대 + 뒤 짐칸이 작업대를 향한 썰매.
 * 공방 문 앞은 비우고, 작업대와 썰매 사이(폭 약 1.5)가 선물을 옮겨 싣는 통로. 밀도는 벽·모서리·작업 자리에 모으고
 * 광장 가운데는 두 요정이 움직이고 엇갈릴 수 있게 비운다.
 */
export const WORKSHOP = {
  /** 공방 중심(요정 크기 통나무집 2 × 2칸). 앞면(+z)이 광장을 본다 */
  x: -7.0,
  z: -10.0,
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
 * 썰매: 공방 앞 골목 동쪽 끝, 길가 울타리를 따라 세워 뒤(짐칸)가 작업대 쪽(서쪽). 앞은 눈둑에 처박혔다.
 * 카메라(남동쪽 위)와 작업대 사이에 있지 않아 싣는 요정을 가리지 않는다.
 */
export const SLEIGH = { x: 2.7, z: -6.3, rotY: 0 };

export const PLAZA_PROPS: readonly Prop[] = [
  // 썰매(산타의 썰매, 1.8배) + 앞쪽 눈둑. 판정: 썰매 몸 상자 + 앞 눈둑 원
  { id: 'sleigh', kind: 'sleigh', x: SLEIGH.x, z: SLEIGH.z, w: 5.4, d: 2.8, rotY: SLEIGH.rotY, collider: box(SLEIGH.x, SLEIGH.z, 5.4, 2.8) },
  { id: 'snowPile', kind: 'snowPile', x: SLEIGH.x + 3.1, z: SLEIGH.z + 0.1, r: 1.2, collider: circle(SLEIGH.x + 3.1, SLEIGH.z + 0.1, 1.2) },
  // 산타: 썰매 앞쪽, 창고 옆에서 싣는 것을 지켜본다(사람 어른). 길 북쪽이라 요정을 가리지 않는다
  { id: 'santa', kind: 'santa', x: 6.2, z: -8.3, r: 1.1, collider: circle(6.2, -8.3, 1.1) },
  // 요정 공방 · 작업대 · 길가 창고
  { id: 'workshop', kind: 'workshop', x: WORKSHOP.x, z: WORKSHOP.z, w: 2 * WS_HALF, d: 2 * WS_HALF, collider: box(WORKSHOP.x, WORKSHOP.z, 2 * WS_HALF, 2 * WS_HALF) },
  { id: 'workbench', kind: 'workbench', x: WORKBENCH.x, z: WORKBENCH.z, w: WORKBENCH.w, d: WORKBENCH.d, collider: box(WORKBENCH.x, WORKBENCH.z, WORKBENCH.w + 0.1, WORKBENCH.d + 0.1) },
  { id: 'shed', kind: 'shed', x: 7.0, z: -10.6, w: 3.4, d: 2.4, collider: box(7.0, -10.6, 3.4, 2.4) },
  // 마을 트리: 공방 왼쪽(요정 키의 약 7배). 아래 가지만 막는다
  { id: 'tree', kind: 'tree', x: -14.6, z: -9.8, r: 1.6, collider: circle(-14.6, -9.8, 1.6) },
  // 시계탑: 공방 앞 눈길이 북동쪽으로 꺾이는 끝에 보이는 랜드마크(경계 바깥)
  { id: 'clockTower', kind: 'clockTower', x: 11, z: -17.3, w: 5.6, d: 5.6, collider: null },
  // 사람 집(경계 바깥, 앞면이 광장을 본다)
  cabin('houseNW', -14.2, -14.4 - HALF, 2, 0),
  cabin('houseNE', 27.5, -14.4 - HALF, 2, 0),
  cabin('houseW', HOUSE_W.x, HOUSE_W.z, 2, Math.PI / 2),
  // 오른쪽 아래 집: 화면 오른쪽 아래 모서리에 지붕만 걸린다(판정 없음)
  cabin('houseE', HOUSE_E.x, HOUSE_E.z, 2, 0),
  // 소나무(사람 마을 나무): 모두 경계 바깥
  { id: 'pine1', kind: 'pine', x: -26, z: -17, r: 2.9, collider: null },
  { id: 'pine2', kind: 'pine', x: 24.5, z: -9.5, r: 2.9, collider: null },
  { id: 'pine3', kind: 'pine', x: -29, z: 12, r: 2.9, collider: null },
  { id: 'pine4', kind: 'pine', x: 33, z: -6, r: 2.9, collider: null },
  { id: 'pine5', kind: 'pine', x: 8.5, z: -30, r: 2.9, collider: null },
  { id: 'pine6', kind: 'pine', x: -30, z: -4, r: 2.9, collider: null },
  // 벤치: 서쪽 집 창 아래(문턱 앞은 비운다). 벽을 등지고 광장을 본다
  { ...bench('benchA', HOUSE_W_WINDOW.x + 1.15, HOUSE_W_WINDOW.z), rotY: Math.PI / 2, collider: box(HOUSE_W_WINDOW.x + 1.15, HOUSE_W_WINDOW.z, 0.64 * 2.3 + 0.1, TOWN.benchWidth + 0.1) },
  // 가로등: 길 가장자리. lampF는 공방 앞 모서리
  lamp('lampA', 7.3, -5.1),
  lamp('lampC', 12.6, 0.4),
  lamp('lampD', -11, 9),
  lamp('lampE', 13.4, 12.4),
  lamp('lampF', -11.8, -4.8),
];

/**
 * 화면용 꾸밈(판정 없음). 연출 가이드 §4·§6, 그래픽 지시.
 * - 눈길: 공방 문 → 작업대 앞 → 썰매 옆 → 북쪽으로 살짝 꺾인 끝에 시계탑, 그 오른쪽이 골목(우편함). 길 북쪽은 창고·울타리가 윤곽.
 *   (카메라에서 화면 위쪽 = 북서쪽이라, 꺾인 길의 끝에 탑을 두어야 걸어가며 화면에 들어온다)
 *   오른쪽 아래 집 현관에서 내려오는 가지 길이 중간에서 만난다.
 * - 썰매 날 자국: 썰매가 들어온 쪽(서쪽, 공방 앞)에서 썰매 뒤까지 두 줄.
 * - 발자국: 실제로 오갈 곳(공방 문 ↔ 작업대 ↔ 썰매 짐칸, 현관 ↔ 길)에만.
 * - 광장 밖은 플레이 경계 밖이라 충돌체가 없다(요정은 경계 안에서만 움직인다).
 */
export const PLAZA_DRESSING = {
  /** 서쪽 집 현관(문 앞 바닥, 앞 = +x). 요정이 서고 선물을 놓을 수 있는 높이 0 바닥 */
  porch: { x: HOUSE_W_DOOR.x, z: HOUSE_W_DOOR.z, rotY: Math.PI / 2 },
  /** 다진 눈길(공방 문 → 시계탑 골목). 폭 */
  path: {
    width: 2.2,
    points: [
      { x: WORKSHOP_DOOR.x, z: WORKSHOP_DOOR.z + 0.5 },
      { x: WORKSHOP_DOOR.x + 0.6, z: -3.8 },
      { x: -2.6, z: -3.9 },
      { x: 3.0, z: -3.8 },
      { x: 7.0, z: -3.9 },
      { x: 9.6, z: -7.0 },
      { x: 10.6, z: -11.4 },
      { x: 12.8, z: -13.3 },
      { x: 16.8, z: -14.6 },
      { x: 17.0, z: -26 },
    ],
  },
  /** 서쪽 집 현관에서 공방 앞 길로 이어지는 가지 길 */
  porchPath: {
    width: 1.8,
    points: [
      { x: HOUSE_W_DOOR.x + 0.6, z: HOUSE_W_DOOR.z },
      { x: -16.6, z: 5.2 },
      { x: -12.4, z: 1.8 },
      { x: -9.8, z: -2.0 },
      { x: -8.2, z: -3.8 },
    ],
  },
  /** 발자국 줄(요정 발, 실제로 오가는 곳) */
  footprints: [
    [{ x: WORKSHOP_DOOR.x, z: WORKSHOP_DOOR.z + 0.3 }, { x: WORKSHOP_DOOR.x + 1.2, z: -4.3 }, { x: WORKBENCH.x - 0.4, z: WORKBENCH.z + 0.8 }],
    [{ x: WORKBENCH.x + 0.4, z: WORKBENCH.z + 0.7 }, { x: -2.2, z: -4.6 }, { x: SLEIGH.x - 3.0, z: SLEIGH.z + 0.6 }],
    [{ x: WORKBENCH.x + 1.4, z: WORKBENCH.z + 0.3 }, { x: -1.6, z: -5.6 }, { x: SLEIGH.x - 3.0, z: SLEIGH.z - 0.3 }],
    [{ x: HOUSE_W_DOOR.x + 0.4, z: HOUSE_W_DOOR.z + 0.3 }, { x: -17.4, z: 5.9 }, { x: -15.0, z: 4.4 }],
  ],
  /** 골목 오른쪽 집과 골목 끝 집(Tiny Treats, 사람 문 높이). 배율·방향이 서로 다르다 */
  alleyHouses: [
    { x: 1.8, z: -25.2, rotY: 0, scale: TT_HOUSE_SCALE },
    { x: -3.6, z: -38, rotY: Math.PI / 2 + 0.12, scale: TT_HOUSE_SCALE * 0.9 },
  ],
  /** 시계탑 골목 입구 우편함(물고기 깃발 = 유나네 표식과 같은 그림) */
  mailbox: { x: 15.0, z: -15.8, rotY: Math.PI / 2 },
  /** 골목 입구: 시계탑 오른쪽(정리가 끝나면 카메라가 이쪽을 조금 보여 준다) */
  alleyMouth: { x: 16.8, z: -14.2 },
  /** 썰매가 들어온 방향(썰매 날 자국이 시작하는 쪽 끝)과 날 간격(썰매 1.8배) */
  sleighEntry: { length: 2.6, gauge: 2.0 },
  /** 광장 가장자리(카메라 쪽 두 변) 낮은 울타리와 눈둑 + 길 북쪽 윤곽(창고 옆) */
  fences: [
    { from: { x: -22, z: 14.9 }, to: { x: 21, z: 14.9 } },
    { from: { x: 20.9, z: 14.9 }, to: { x: 20.9, z: 9.0 } },
  ],
  /** 길 북쪽 윤곽: 공방 오른쪽 모서리 ~ 창고 ~ 골목 입구(요정 키 높이 울타리) */
  laneFences: [
    { from: { x: -2.2, z: -8.6 }, to: { x: 5.1, z: -8.6 } },
    { from: { x: 8.9, z: -9.6 }, to: { x: 9.5, z: -13.6 } },
  ],
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
];
