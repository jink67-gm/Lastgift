// 1장 공간 그리기: 돌 아치 → 우편함 골목(양옆 집·우편함 무늬·화분) → 낮은 담 안 유나네 앞마당·창가.
// 배치는 src/data/chapter1.ts만 따른다(판정과 같은 값). 사람(유나·지우)은 사용자 에셋을 받아 넣는다(지금은 창가에 실루엣 자리만).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawPerson, YUNA_2D } from '../ui/people2d';
import {
  ARCH,
  CH1_HOUSES,
  HOUSE_HALF,
  YUNA_HOUSE_K,
  houseScaleOf,
  LANE_HALF,
  LOW_WALL_H,
  W,
  YAW,
  YUNA_WINDOW,
  COVERS,
  GARDEN_PATH,
  DOORBELL,
  PORCH,
  SENSOR,
  HEDGES,
  GATES,
  GATE_HALF,
  LANDMARKS,
  LOW_WALLS,
  STREETS,
  STREET_FENCES,
  type YardGate,
  doorOf,
  gateOf,
  mailboxOf,
  potOf,
  type Ch1House,
  type MailSymbol,
  type PotKind,
} from '../data/chapter1';
import { MAILBOX_SCALE, TOWN } from '../data/townScale';
import type { Models } from './models';
import { alleyHouse, berm, contactShadow, edgeFence, footprints, packedPath, roundedBox, stoneWall } from './plazaDressing';
import { townLamp } from './plaza';
import { kenneyProp } from './kenney';
import { warmPool } from './winterLight';
import { createVillageTree } from './villageTree';
import type { Detail } from './plazaDressing';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const SNOW = '#f4f7fc';
const snowMat = std(SNOW, { roughness: 1 });

const at = (s: number, t: number, y = 0) => {
  const p = W(s, t);
  return new THREE.Vector3(p.x, y, p.z);
};
/** 문 앞 1.2(문 앞 빛 웅덩이 자리) */
const housePointAhead = (h: Ch1House, d: { s: number; t: number }) => {
  const f = h.faces === 'back' ? { s: -1, t: 0 } : h.faces === 'left' ? { s: 0, t: -1 } : { s: 0, t: 1 };
  return { s: d.s + f.s * 1.2, t: d.t + f.t * 1.2 };
};
const faceYaw = (h: Ch1House) => (h.faces === 'back' ? YAW.back : h.faces === 'left' ? YAW.left : YAW.right);

// ── 우편함 무늬 ──────────────────────────────────────────
function symbol(kind: MailSymbol): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'fish') {
    const m = std('#4a9be8', { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), m);
    body.scale.set(1.5, 1, 0.45);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 3), m);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = 0.45;
    g.add(tail);
  } else if (kind === 'bird') {
    const m = std('#d23a3a', { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), m);
    body.scale.set(1.3, 1, 0.5);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), m);
    head.position.set(-0.26, 0.16, 0);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), std('#f2b02a'));
    beak.rotation.z = Math.PI / 2;
    beak.position.set(-0.43, 0.16, 0);
    g.add(beak);
  } else if (kind === 'star') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i + Math.PI / 2;
      const r = i % 2 ? 0.12 : 0.3;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), std('#f2c230', { roughness: 0.5 }));
    m.position.z = -0.04;
    g.add(m);
  } else {
    const m = std('#8a8f9c');
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), m);
    head.scale.set(1.1, 0.95, 0.5);
    g.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), m);
      ear.position.set(sx * 0.15, 0.24, 0);
      g.add(ear);
    }
  }
  return g;
}

/** 사람 우편함 + 무늬 깃발. 원점 = 기둥 밑, 앞(+z) = 골목 쪽 */
function mailbox(models: Models, kind: MailSymbol): THREE.Group {
  const g = new THREE.Group();
  const mb = models.clone('ttMailbox');
  if (mb) {
    mb.scale.setScalar(MAILBOX_SCALE);
    g.add(mb);
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, TOWN.mailbox * 0.7, 0.2), std('#8a5a3a'));
    post.position.y = TOWN.mailbox * 0.35;
    g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 1.1), std('#e0b33c'));
    box.position.set(0, TOWN.mailbox * 0.78, 0.5);
    g.add(box);
  }
  const k = MAILBOX_SCALE / 0.75;
  const sym = symbol(kind);
  sym.scale.setScalar(k);
  sym.position.set(0, 1.98 * k, 0.35 * k);
  sym.rotation.y = Math.PI / 2; // 골목에서 옆모습이 보이게
  g.add(sym);
  const cap = new THREE.Mesh(roundedBox(0.5 * k, 0.08 * k, 0.72 * k), snowMat);
  cap.position.set(0, 1.66 * k, 0.38 * k);
  g.add(cap);
  g.add(contactShadow(0.9 * k, 1.2 * k, 0.35));
  return g;
}

// ── 화분 ─────────────────────────────────────────────────
/** 바람개비(풍차) 날개: 돌아간다(animate) */
export interface Pot {
  group: THREE.Group;
  spin?: THREE.Object3D;
}

function pot(kind: PotKind): Pot {
  const g = new THREE.Group();
  const clay = std('#c0623a', { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.62, 16), clay);
  body.position.y = 0.31;
  g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 18), clay);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.62;
  g.add(rim);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), std(SNOW, { roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.6;
  g.add(soil);
  let spin: THREE.Object3D | undefined;
  if (kind === 'windmill') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), std('#f4f1ea'));
    stick.position.y = 1.35;
    g.add(stick);
    const wheel = new THREE.Group();
    wheel.position.set(0, 2.1, 0.06);
    const cols = ['#d23a3a', '#f2c230', '#2f6fd0', '#2f9a4a'];
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 3), std(cols[i]!, { roughness: 0.5, side: THREE.DoubleSide }));
      blade.scale.z = 0.15;
      blade.position.set(0, 0.26, 0);
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(blade);
      wheel.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#f4f1ea'));
    wheel.add(hub);
    g.add(wheel);
    spin = wheel;
  } else if (kind === 'tulip') {
    for (const [x, z, h, c] of [[-0.14, 0, 0.75, '#d23a3a'], [0.12, 0.08, 0.95, '#e57ab0'], [0.04, -0.14, 0.62, '#d23a3a']] as const) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 6), std('#2f8a3e'));
      stem.position.set(x, 0.6 + h / 2, z);
      g.add(stem);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), std(c, { side: THREE.DoubleSide }));
      cup.rotation.x = Math.PI;
      cup.position.set(x, 0.6 + h + 0.1, z);
      g.add(cup);
    }
  } else {
    const green = std('#3f8a4e');
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 6, 12), green);
    trunk.position.y = 1.1;
    g.add(trunk);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 8), green);
      arm.position.set(sx * 0.24, 1.15 + sx * 0.12, 0);
      g.add(arm);
    }
  }
  g.add(contactShadow(1.1, 1.1, 0.3));
  return { group: g, spin };
}

// ── 돌 아치 ──────────────────────────────────────────────
function stoneArch(): THREE.Group {
  const g = new THREE.Group();
  const stone = std('#b9a990', { roughness: 0.95 });
  const dark = std('#9c8d76', { roughness: 0.95 });
  const pillarH = ARCH.height - 1.4;
  for (const sgn of [-1, 1]) {
    let y = 0;
    let i = 0;
    while (y < pillarH) {
      const h = 0.55 + ((i * 37) % 5) * 0.05;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.35 - (i % 2) * 0.12, h, 1.2), i % 3 === 1 ? dark : stone);
      b.position.set(sgn * ARCH.halfSpan, y + h / 2, 0);
      g.add(b);
      y += h + 0.03;
      i++;
    }
  }
  // 둥근 머리: 돌 조각을 반원으로
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = Math.PI - (i + 0.5) * (Math.PI / N);
    const r = ARCH.halfSpan;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 1.2), i % 2 ? dark : stone);
    b.position.set(Math.cos(a) * r, pillarH + Math.sin(a) * 1.5, 0);
    b.rotation.z = a - Math.PI / 2;
    g.add(b);
  }
  const cap = new THREE.Mesh(new THREE.TorusGeometry(ARCH.halfSpan, 0.22, 6, 20, Math.PI), snowMat);
  cap.scale.set(1, 1.5 / ARCH.halfSpan + 0.02, 1.6);
  cap.position.y = pillarH + 0.5;
  g.add(cap);
  for (const sgn of [-1, 1]) {
    const sh = contactShadow(1.8, 1.8, 0.35);
    sh.position.set(sgn * ARCH.halfSpan, 0.01, 0);
    g.add(sh);
  }
  return g;
}

// ── 낮은 돌담 ────────────────────────────────────────────
function lowWall(a: { s: number; t: number }, b: { s: number; t: number }): THREE.Group {
  const g = new THREE.Group();
  const pa = at(a.s, a.t);
  const pb = at(b.s, b.t);
  const len = pa.distanceTo(pb);
  const mid = pa.clone().add(pb).multiplyScalar(0.5);
  // 크기·색이 다른 돌을 엇갈려 쌓은 담(예전: 회색 긴 상자 + 줄눈 띠 둘)
  g.add(stoneWall(len, LOW_WALL_H, 0.5, Math.round(len * 7)));
  const cap = new THREE.Mesh(roundedBox(len + 0.1, 0.22, 0.7), snowMat);
  cap.position.y = LOW_WALL_H + 0.08;
  g.add(cap);
  g.position.copy(mid);
  g.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z) - Math.PI / 2;
  g.userData.fadeable = true;
  return g;
}

// ── 낮은 담 나무 대문 ────────────────────────────────────
/** 돌기둥 둘 + 나무 살 문짝(경첩 쪽 기둥에 매달려 앞마당 안쪽으로 열린다). leaf: 돌릴 경첩, openSign: 여는 쪽 */
function yardGate(g: YardGate, paint: string): { group: THREE.Group; leaf: THREE.Group; openSign: number } {
  const group = new THREE.Group();
  const stone = std('#9c8d76', { roughness: 0.95 });
  const ends = g.axis === 't' ? [{ s: g.s, t: g.t - GATE_HALF }, { s: g.s, t: g.t + GATE_HALF }] : [{ s: g.s - GATE_HALF, t: g.t }, { s: g.s + GATE_HALF, t: g.t }];
  for (const e of ends) {
    const post = new THREE.Mesh(roundedBox(0.72, LOW_WALL_H + 0.55, 0.72), stone);
    post.position.copy(at(e.s, e.t, (LOW_WALL_H + 0.55) / 2));
    group.add(post);
    const cap = new THREE.Mesh(roundedBox(0.88, 0.22, 0.88), snowMat);
    cap.position.copy(at(e.s, e.t, LOW_WALL_H + 0.66));
    group.add(cap);
    // 기둥 위 작은 등(따뜻한 빛)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a0' }));
    lamp.position.copy(at(e.s, e.t, LOW_WALL_H + 0.92));
    group.add(lamp);
  }
  // 문짝: 경첩(ends[0])에서 다른 기둥 쪽으로 길이 2·GATE_HALF - 0.5
  const hinge = at(ends[0]!.s, ends[0]!.t);
  const other = at(ends[1]!.s, ends[1]!.t);
  const len = GATE_HALF * 2 - 0.5;
  const leaf = new THREE.Group();
  leaf.position.copy(hinge);
  leaf.rotation.y = Math.atan2(other.x - hinge.x, other.z - hinge.z);
  const wood = std(paint, { roughness: 0.85 });
  const dark = std('#5a3a24', { roughness: 0.9 });
  const H = LOW_WALL_H + 0.15;
  const panel = new THREE.Group();
  panel.position.z = 0.25;
  for (const y of [0.3, H - 0.25]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, len), dark);
    rail.position.set(0, y, len / 2);
    panel.add(rail);
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const z = 0.12 + (i * (len - 0.24)) / (n - 1);
    const h = H - 0.05 + Math.sin((i / (n - 1)) * Math.PI) * 0.28; // 가운데가 둥글게 높은 살
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.22), wood);
    picket.position.set(0.05, h / 2 + 0.05, z);
    panel.add(picket);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 4), wood);
    tip.position.set(0.05, h + 0.13, z);
    tip.rotation.y = Math.PI / 4;
    panel.add(tip);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, Math.hypot(len, H - 0.55)), dark);
  brace.position.set(0.09, H / 2 + 0.02, len / 2);
  brace.rotation.x = Math.atan2(H - 0.55, len);
  panel.add(brace);
  // 빗장(문짝 끝 쪽): 금색 고리
  const latch = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), std('#e0b64e', { metalness: 0.6, roughness: 0.35 }));
  latch.position.set(0.12, H * 0.6, len - 0.12);
  latch.rotation.y = Math.PI / 2;
  panel.add(latch);
  const snowTop = new THREE.Mesh(roundedBox(0.16, 0.08, len - 0.1), snowMat);
  snowTop.position.set(0, H - 0.12, len / 2);
  panel.add(snowTop);
  leaf.add(panel);
  group.add(leaf);
  // 여는 쪽: 문짝 끝이 담 안(길의 반대쪽)으로 움직이는 회전 방향
  const inward = g.axis === 't' ? W(-g.out, 0) : W(0, -g.out);
  const tipAt = (yaw: number) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
  const a = tipAt(leaf.rotation.y + 0.3);
  const openSign = a.x * inward.x + a.z * inward.z > 0 ? 1 : -1;
  group.userData.fadeable = true;
  return { group, leaf, openSign };
}

/** 빨간 우체통(갈림길 길잡이): 둥근 머리 기둥형 */
function postBox(): THREE.Group {
  const g = new THREE.Group();
  const red = std('#c8282e', { roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.2, 20), red);
  body.position.y = 1.1;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 2.2;
  g.add(dome);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.1, 20), std('#2a2a2e'));
  band.position.y = 2.18;
  g.add(band);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.1), std('#1e1e24'));
  slot.position.set(0, 1.75, 0.5);
  g.add(slot);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.18, 20), std('#3b3f4a'));
  plinth.position.y = 0.09;
  g.add(plinth);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
  cap.scale.y = 0.45;
  cap.position.y = 2.68;
  g.add(cap);
  g.add(contactShadow(1.6, 1.6, 0.35));
  return g;
}

/** 이 길 좌표가 길(STREETS) 안인가 */
function inStreet(s: number, t: number): boolean {
  return Object.values(STREETS).some((r) => s > r.s0 && s < r.s1 && t > r.t0 && t < r.t1);
}

// ── 유나네 돌출 창가 ─────────────────────────────────────
/** 창가: 하얀 창틀 + 유리 + 따뜻한 방 안 + 책상. 사람(유나)은 사용자 에셋으로 넣는다(지금은 실루엣 판) */
function bayWindow(): { group: THREE.Group; seat: THREE.Vector3; silhouette: THREE.Group; frost: THREE.Mesh } {
  const g = new THREE.Group();
  const w = YUNA_WINDOW.width;
  const sill = YUNA_WINDOW.sill;
  const h = YUNA_WINDOW.height;
  const depth = 1.5;
  const frame = std('#f4efe6', { roughness: 0.7 });
  // 바닥 받침(창 아래 벽)
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, sill, depth), std('#c9a27a'));
  base.position.set(0, sill / 2, depth / 2);
  g.add(base);
  // 방 안: 뒷벽(따뜻한 빛) · 옆벽 · 천장
  const room = std('#ffd7a0', { emissive: '#ffb860', emissiveIntensity: 0.55, roughness: 1 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), room);
  back.position.set(0, sill + h / 2, 0.02);
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, depth), frame);
    side.position.set(sx * (w / 2 + 0.08), sill + h / 2, depth / 2);
    g.add(side);
    // 커튼
    const cur = new THREE.Mesh(new THREE.BoxGeometry(0.4, h * 0.9, 0.08), std('#d65a5a', { roughness: 1 }));
    cur.position.set(sx * (w / 2 - 0.25), sill + h * 0.5, depth - 0.25);
    g.add(cur);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.25, depth + 0.2), frame);
  top.position.set(0, sill + h + 0.12, depth / 2);
  g.add(top);
  const roofSnow = new THREE.Mesh(roundedBox(w + 0.6, 0.25, depth + 0.3), snowMat);
  roofSnow.position.set(0, sill + h + 0.35, depth / 2);
  g.add(roofSnow);
  // 책상(창턱 높이)
  const desk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.12, 0.7), std('#8a5a3a'));
  desk.position.set(0, sill + 0.05, depth - 0.55);
  g.add(desk);
  // 방 안 살림(단색 벽이던 것): 벽 액자, 책꽂이, 책상 스탠드
  const frameTex = (() => {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 72;
    const x = c.getContext('2d')!;
    x.fillStyle = '#8a5a3a';
    x.fillRect(0, 0, 96, 72);
    x.fillStyle = '#fff8e8';
    x.fillRect(7, 7, 82, 58);
    x.fillStyle = '#7fb6e8';
    x.fillRect(7, 7, 82, 30);
    x.fillStyle = '#e57a3a';
    x.beginPath();
    x.moveTo(30, 44);
    x.lineTo(48, 26);
    x.lineTo(66, 44);
    x.fill();
    x.fillStyle = '#f2c230';
    x.fillRect(36, 44, 24, 18);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: frameTex }));
  pic.position.set(-w * 0.3, sill + h * 0.74, 0.04);
  g.add(pic);
  const shelf = new THREE.Group();
  const wood = std('#9a6a44');
  const sideBoard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.32), wood);
  for (const y of [0, 0.42, 0.84]) {
    const b = sideBoard.clone();
    b.position.y = y;
    shelf.add(b);
  }
  ['#d23a3a', '#2f6fd0', '#2f9a4a', '#f2c230', '#7a4ad0'].forEach((c, i) => {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3 + (i % 2) * 0.06, 0.24), std(c));
    book.position.set(-0.24 + i * 0.11, 0.18 + (i % 2) * 0.03, 0);
    shelf.add(book);
  });
  shelf.position.set(w * 0.34, sill + h * 0.32, 0.2);
  g.add(shelf);
  const lamp = new THREE.Group();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 14, 1, true), std('#f4c86a', { emissive: '#ffcf7a', emissiveIntensity: 0.7, side: THREE.DoubleSide }));
  shade.position.y = 0.42;
  lamp.add(shade);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), std('#3b3f4a'));
  pole.position.y = 0.2;
  lamp.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  bulb.position.y = 0.36;
  lamp.add(bulb);
  lamp.position.set(-w * 0.36, sill + 0.11, depth - 0.6);
  g.add(lamp);
  // 유나 자리(사용자 에셋이 올 때까지 그림책 화풍 세움판)
  const yuna = new THREE.Group();
  yuna.name = 'yunaPlaceholder';
  // 그림책 화풍 유나(ui/people2d): 앞모습·뒷모습 판을 등지게 붙여 돌리면 "몸 돌리기"가 보인다(사람 에셋을 받으면 3D 인물로)
  const card = (back: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    drawPerson(c.getContext('2d')!, YUNA_2D, 128, 256, 1.05, { back, mood: 1 });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    m.position.y = 0.8;
    return m;
  };
  const front = card(false);
  front.position.z = 0.01;
  yuna.add(front);
  const backSide = card(true);
  backSide.rotation.y = Math.PI;
  backSide.position.z = -0.01;
  yuna.add(backSide);
  yuna.position.set(0, sill + 0.12, depth * 0.45);
  g.add(yuna);
  const silhouette = yuna;
  // 유리(아주 옅게) + 가운데 창살
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false }));
  glass.position.set(0, sill + h / 2, depth);
  g.add(glass);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), frame);
  bar.position.set(0, sill + h / 2, depth);
  g.add(bar);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.12, 0.2), frame);
  rail.position.set(0, sill + 0.02, depth + 0.02);
  g.add(rail);
  // 성에: 멀리(큰 화면)서는 유리가 뿌옇게 보여 유나가 어디를 보는지 모른다. 망보는 자리의 작은 화면(층 0만)에서는 보이지 않는다
  const frost = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshBasicMaterial({ map: frostTexture(), transparent: true, opacity: FROST_OPACITY, depthWrite: false }));
  frost.position.set(0, sill + h / 2, depth + 0.03);
  frost.layers.set(FROST_LAYER);
  frost.renderOrder = 4;
  g.add(frost);
  // 창 아래 눈 위 따뜻한 빛
  const pool = warmPool(2.6);
  pool.position.set(0, 0.006, depth + 1.4);
  g.add(pool);
  return { group: g, seat: new THREE.Vector3(0, sill + 0.12, depth * 0.45), silhouette, frost };
}

/** 성에 무늬(희뿌연 바탕 + 얼음 잎맥) */
function frostTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(128, 128, 20, 128, 128, 180);
  bg.addColorStop(0, 'rgba(235,244,255,0.78)');
  bg.addColorStop(1, 'rgba(250,252,255,0.95)');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  let r = 11;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = 'rgba(170,200,235,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += Math.cos(a) * 12;
      y += Math.sin(a) * 12;
      g.lineTo(x, y);
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a + 0.8) * 7, y + Math.sin(a + 0.8) * 7);
      g.moveTo(x, y);
      a += (rnd() - 0.5) * 0.6;
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 창 성에 진하기: 옅게(유나가 일어나 돌아서는 모습은 누구나 보인다) */
export const FROST_OPACITY = 0.3;
/** 큰 화면에만 보이는 층(창 성에) */
export const FROST_LAYER = 1;

// ── 앞마당 엄폐물 ────────────────────────────────────────
/** 모델을 높이 h에 맞춰 줄이고 바닥을 0에 */
function fitHeight(o: THREE.Object3D, h: number): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(o);
  const k = h / Math.max(0.01, box.max.y - box.min.y);
  o.scale.multiplyScalar(k);
  o.position.y -= box.min.y * k;
  const g = new THREE.Group();
  g.add(o);
  return g;
}

/** 유나가 만든 눈사람(Kenney CC0 모자 쓴 눈사람, 요정 키의 두 배쯤) + 빨간 목도리 */
function gardenSnowman(models: Models): THREE.Group {
  const m = models.clone('snowman');
  const g = new THREE.Group();
  if (m) g.add(fitHeight(m, 2.7));
  else {
    const white = std('#f8fbff', { roughness: 1 });
    for (const [y, r] of [[0.72, 0.78], [1.72, 0.56], [2.45, 0.4]] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), white);
      b.position.y = y;
      g.add(b);
    }
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 8, 20), std('#d23a3a', { roughness: 0.9 }));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.62;
  g.add(scarf);
  const tail = new THREE.Mesh(roundedBox(0.16, 0.5, 0.05), std('#d23a3a', { roughness: 0.9 }));
  tail.position.set(0.22, 1.35, 0.3);
  tail.rotation.z = 0.2;
  g.add(tail);
  g.add(contactShadow(1.9, 1.9, 0.32));
  return g;
}

/** 마당 개집: 판자 벽(두 가지 나무색 줄무늬) + 빨간 박공지붕 + 둥근 문 + 문패(뼈다귀) + 밥그릇. 요정보다 높다 */
function doghouse(): THREE.Group {
  const g = new THREE.Group();
  const woodA = std('#b07a4a', { roughness: 0.85 });
  const woodB = std('#9c6a3f', { roughness: 0.85 });
  const roofM = std('#b8322e', { roughness: 0.7 });
  const W0 = 1.7, D0 = 1.5, H0 = 1.15;
  // 판자 벽: 가로 판자 줄을 번갈아
  const rows = 6;
  for (let i = 0; i < rows; i++) {
    const p = new THREE.Mesh(roundedBox(W0, H0 / rows - 0.015, D0), i % 2 ? woodA : woodB);
    p.position.y = 0.06 + (i + 0.5) * (H0 / rows);
    g.add(p);
  }
  // 박공(앞뒤 삼각 벽)
  const tri = new THREE.Shape();
  tri.moveTo(-W0 / 2, 0);
  tri.lineTo(W0 / 2, 0);
  tri.lineTo(0, 0.62);
  tri.closePath();
  for (const z of [D0 / 2 - 0.04, -D0 / 2 - 0.04]) {
    const gab = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false }), woodA);
    gab.position.set(0, 0.06 + H0, z);
    g.add(gab);
  }
  // 지붕 두 판(처마가 살짝 나온다) + 그 위 얇게 앉은 눈
  const slope = Math.atan2(0.62, W0 / 2);
  const len = Math.hypot(W0 / 2, 0.62) + 0.22;
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(roundedBox(len, 0.1, D0 + 0.35), roofM);
    r.position.set(sx * (W0 / 4 + 0.04), 0.06 + H0 + 0.33, 0);
    r.rotation.z = -sx * slope;
    g.add(r);
    const sn = new THREE.Mesh(roundedBox(len - 0.12, 0.05, D0 + 0.2), snowMat);
    sn.position.set(sx * (W0 / 4 + 0.02), 0.06 + H0 + 0.4, 0);
    sn.rotation.z = -sx * slope;
    g.add(sn);
  }
  // 둥근 문(어두운 안쪽)
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20, 0, Math.PI), std('#2a1c14', { roughness: 1 }));
  door.position.set(0, 0.5, D0 / 2 + 0.005);
  g.add(door);
  const doorLow = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.44), std('#2a1c14', { roughness: 1 }));
  doorLow.position.set(0, 0.28, D0 / 2 + 0.005);
  g.add(doorLow);
  // 문패: 하얀 뼈다귀
  const bone = new THREE.Group();
  const boneM = std('#f4efe2', { roughness: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), boneM);
  shaft.rotation.z = Math.PI / 2;
  bone.add(shaft);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), boneM);
    knob.position.set(sx * 0.15, sy * 0.035, 0);
    bone.add(knob);
  }
  bone.position.set(0, 1.0, D0 / 2 + 0.05);
  g.add(bone);
  // 밥그릇
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.12, 16), std('#3f6fd1', { roughness: 0.5 }));
  bowl.position.set(0.55, 0.06, D0 / 2 + 0.35);
  g.add(bowl);
  g.add(contactShadow(2.4, 2.2, 0.32));
  return g;
}

/** 정원의 작은 장식 나무(Kenney CC0) */
function gardenTree(models: Models): THREE.Group {
  const m = models.clone('treeDecorated');
  const g = new THREE.Group();
  if (m) g.add(fitHeight(m, 3.4));
  else {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.0, 10), std('#2f6a47'));
    cone.position.y = 1.7;
    g.add(cone);
  }
  g.add(contactShadow(2.2, 2.2, 0.32));
  return g;
}

/** 생울타리(상록, 다듬은 둥근 덩이를 길게 이어 붙임 + 위에 눈 + 빨간 열매), 길이 len·두께 1·높이 1.6(요정보다 높다). 덩이를 한 덩어리로 합친다 */
function hedgeRow(len: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  let r0 = seed * 7919 + 13;
  const rnd = () => ((r0 = (r0 * 16807) % 2147483647) / 2147483647);
  const greens: THREE.BufferGeometry[] = [];
  const snows: THREE.BufferGeometry[] = [];
  const berries: THREE.BufferGeometry[] = [];
  const n = Math.max(2, Math.round(len / 0.75));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    const r = 0.62 + rnd() * 0.12;
    const geo = new THREE.IcosahedronGeometry(r, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      v.multiplyScalar(1 + 0.06 * Math.sin(v.x * 9 + i) * Math.cos(v.z * 8 + v.y * 5));
      pos.setXYZ(k, v.x, v.y, v.z);
    }
    geo.scale(1, 1.25, 0.85);
    geo.translate(x, 0.85 + rnd() * 0.08, 0);
    geo.computeVertexNormals();
    greens.push(geo);
    const cap = new THREE.SphereGeometry(r * 0.92, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3.2);
    cap.scale(1, 1, 0.85);
    cap.translate(x, 0.85 + r * 0.55, 0);
    snows.push(cap);
    for (let b = 0; b < 2; b++) {
      const bg = new THREE.SphereGeometry(0.055, 6, 5);
      bg.translate(x + (rnd() - 0.5) * 0.8, 0.5 + rnd() * 0.8, (rnd() < 0.5 ? -1 : 1) * 0.52);
      berries.push(bg);
    }
  }
  const strip = (arr: THREE.BufferGeometry[]) => arr.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    y.deleteAttribute('uv');
    return y;
  });
  g.add(new THREE.Mesh(mergeGeometries(strip(greens))!, std('#2f5e40', { roughness: 0.95 })));
  g.add(new THREE.Mesh(mergeGeometries(strip(snows))!, std('#f8fbff', { roughness: 1 })));
  g.add(new THREE.Mesh(mergeGeometries(strip(berries))!, std('#c8282e', { roughness: 0.4 })));
  g.add(contactShadow(len + 0.8, 1.6, 0.3));
  return g;
}

/** 둥글게 다듬은 상록 덤불: 울퉁불퉁한 공 몇 개 + 그 위 눈 + 빨간 열매 */
function gardenBush(): THREE.Group {
  const g = new THREE.Group();
  const leaf = std('#2f5e40', { roughness: 0.95 });
  const leaf2 = std('#3a7150', { roughness: 0.95 });
  const snow = std('#f8fbff', { roughness: 1 });
  let r0 = 5;
  const rnd = () => ((r0 = (r0 * 16807) % 2147483647) / 2147483647);
  const lump = (r: number) => {
    const geo = new THREE.IcosahedronGeometry(r, 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = 1 + 0.07 * Math.sin(v.x * 9 + v.y * 5) * Math.cos(v.z * 8 - v.y * 4);
      v.multiplyScalar(n);
      if (v.y < -r * 0.35) v.y = -r * 0.35; // 바닥은 평평하게
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const parts: [number, number, number, number][] = [[0, 0, 0.95, 0], [0.62, 0.3, 0.68, 1], [-0.6, 0.22, 0.7, 1], [0.08, -0.52, 0.66, 0], [0.1, 0.55, 0.6, 0]];
  for (const [x, z, r, k] of parts) {
    const b = new THREE.Mesh(lump(r), k ? leaf2 : leaf);
    b.position.set(x, r * 0.35 + 0.02, z);
    g.add(b);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), snow);
    cap.position.set(x, r * 0.35 + r * 0.2, z);
    g.add(cap);
  }
  const berry = std('#c8282e', { roughness: 0.4 });
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, y = 0.35 + rnd() * 0.5;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), berry);
    b.position.set(Math.cos(a) * 1.0, y, Math.sin(a) * 0.9);
    g.add(b);
  }
  g.add(contactShadow(2.4, 2.2, 0.3));
  return g;
}

/** 정원길 디딤돌: 납작하고 모서리가 둥근 돌, 위에 눈이 살짝 */
function steppingStones(points: readonly { s: number; t: number }[]): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => at(p.s, p.t)), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(2, Math.round(len / 0.95));
  const tones = ['#a99c88', '#9a8e7b', '#b4a893'].map((c) => std(c, { roughness: 0.95 }));
  let r0 = 3;
  const rnd = () => ((r0 = (r0 * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.38 + rnd() * 0.1, 0.42 + rnd() * 0.1, 0.08, 9), tones[i % 3]!);
    st.scale.set(1.25, 1, 0.9);
    st.rotation.y = rnd() * Math.PI;
    st.position.set(p.x + (rnd() - 0.5) * 0.15, 0.03, p.z + (rnd() - 0.5) * 0.15);
    st.receiveShadow = true;
    g.add(st);
  }
  return g;
}

function logs(): THREE.Group {
  const g = new THREE.Group();
  const bark = std('#7a4a2a', { roughness: 0.95 });
  const cut = std('#d9b07a', { roughness: 0.9 });
  const rows = [[-0.42, 0, 0.3], [0.42, 0, 0.3], [0, 0.55, 0.3], [-0.84, 0, 0.3], [0.84, 0, 0.3], [-0.42, 0.55, 0.3], [0.42, 0.55, 0.3], [0, 1.08, 0.3]] as const;
  for (const [x, y] of rows) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 10), bark);
    log.rotation.x = Math.PI / 2;
    log.position.set(x, y + 0.28, 0);
    g.add(log);
    for (const z of [-0.751, 0.751]) {
      const end = new THREE.Mesh(new THREE.CircleGeometry(0.27, 10), cut);
      end.position.set(x, y + 0.28, z);
      end.rotation.y = z > 0 ? 0 : Math.PI;
      g.add(end);
    }
  }
  const snow = new THREE.Mesh(roundedBox(1.9, 0.2, 1.4), std('#f8fbff', { roughness: 1 }));
  snow.position.y = 1.62;
  g.add(snow);
  g.add(contactShadow(2.4, 1.8, 0.3));
  return g;
}

/** 초인종: 금색 판 + 빨간 단추 + 위에 작은 종 그림, 아래 작은 등. press(k): 눌린 뒤 지난 비율(단추가 빛난다) */
function doorbellPlate(): { group: THREE.Group; press(k: number): void } {
  const g = new THREE.Group();
  const gold = std('#e0b64e', { roughness: 0.3, metalness: 0.75 });
  const plate = new THREE.Mesh(roundedBox(0.8, 1.05, 0.1), gold);
  g.add(plate);
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#c8282e', roughness: 0.4, emissive: '#ff3b30', emissiveIntensity: 0 });
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.12, 20), buttonMat);
  button.rotation.x = Math.PI / 2;
  button.position.set(0, -0.12, 0.08);
  g.add(button);
  // 위: 작은 종 그림(금색 반구 + 추)
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#f2c230', { roughness: 0.3, metalness: 0.6 }));
  bell.position.set(0, 0.26, 0.07);
  g.add(bell);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std('#5a3620'));
  knob.position.set(0, 0.25, 0.1);
  g.add(knob);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, depthWrite: false }));
  glow.position.z = 0.14;
  g.add(glow);
  return {
    group: g,
    press(k) {
      const on = k >= 0 && k < 1 ? 1 - k : 0;
      buttonMat.emissiveIntensity = 1.2 * on;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.7 * on;
      button.position.z = 0.08 - 0.05 * on;
    },
  };
}

/** 현관 센서등: 문 위 둥근 등 + 옆 작은 감지기(빨간 불). light(on), cover(k: 눈 덮임 0~1) */
function porchSensor(): { lamp: THREE.Group; sensor: THREE.Group; set(on: number, cover: number): void } {
  const lamp = new THREE.Group();
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd36b', emissiveIntensity: 0.05, roughness: 0.4 });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lampMat);
  lamp.add(globe);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.16, 16), std('#3b3f4a', { roughness: 0.5, metalness: 0.5 }));
  cap.position.y = 0.32;
  lamp.add(cap);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), std('#3b3f4a'));
  arm.position.set(0, 0.38, -0.25);
  lamp.add(arm);
  const pool = warmPool(4.2);
  (pool.material as THREE.MeshBasicMaterial).opacity = 0;
  const sensor = new THREE.Group();
  const box = new THREE.Mesh(roundedBox(0.5, 0.4, 0.22), std('#e8e4dc', { roughness: 0.6 }));
  sensor.add(box);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#2a2d36', { roughness: 0.2, metalness: 0.4 }));
  eye.rotation.x = Math.PI / 2;
  eye.position.z = 0.11;
  sensor.add(eye);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ff3b30' });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), ledMat);
  led.position.set(0.17, 0.12, 0.12);
  sensor.add(led);
  const snow = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), std('#f8fbff', { roughness: 1 }));
  snow.scale.set(1.1, 0.8, 0.7);
  snow.position.z = 0.12;
  sensor.add(snow);
  return {
    lamp,
    sensor,
    set(on, cover) {
      lampMat.emissiveIntensity = 0.05 + 2.2 * on;
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.75 * on;
      snow.visible = cover > 0.02;
      snow.scale.set(1.1 * (0.4 + 0.6 * cover), 0.8 * (0.4 + 0.6 * cover), 0.7);
      ledMat.color.set(cover > 0.02 ? '#555555' : '#ff3b30');
    },
    pool,
  } as { lamp: THREE.Group; sensor: THREE.Group; set(on: number, cover: number): void; pool: THREE.Mesh };
}

/** 현관에 나온 유나(그림책 화풍 세움판, 발끝까지): look -1·0·1 세 장(두리번) */
function doorYuna(): { group: THREE.Group; look(i: number, smile?: boolean): void } {
  const g = new THREE.Group();
  // 두리번(왼·가운데·오른쪽) 셋 + 선물을 발견해 웃는 얼굴 하나
  const mats = [[-1, 0], [0, 0], [1, 0], [0, 1]].map(([look, mood]) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const x = c.getContext('2d')!;
    // 아래: 바지·신발(스웨터 아래로 이어진다)
    x.fillStyle = '#2b3a67';
    x.fillRect(84, 250, 40, 200);
    x.fillRect(132, 250, 40, 200);
    x.fillStyle = '#5a3620';
    x.beginPath();
    x.ellipse(100, 460, 30, 14, 0, 0, Math.PI * 2);
    x.ellipse(156, 460, 30, 14, 0, 0, Math.PI * 2);
    x.fill();
    // 몸통(스웨터 아랫단)
    x.fillStyle = YUNA_2D.sweater;
    x.fillRect(70, 230, 116, 40);
    drawPerson(x, YUNA_2D, 128, 260, 0.95, { mood, look });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5 });
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.4), mats[1]);
  m.position.y = 1.7;
  g.add(m);
  return {
    group: g,
    look(i, smile) {
      m.material = smile ? mats[3]! : mats[Math.max(0, Math.min(2, i + 1))]!;
    },
  };
}

export interface Ch1Scene {
  root: THREE.Group;
  /** 매 프레임(바람개비가 돈다) */
  update(t: number): void;
  /** 창가 유나 자리(월드). 사용자 에셋으로 사람을 세울 곳 */
  yunaSeat: THREE.Vector3;
  yunaPlaceholder: THREE.Object3D;
  /** 창 성에(끝 장면에서 걷는다) */
  frost: THREE.Object3D;
  /** 창가 유나 자리 모습(사용자 에셋이 오기 전 실루엣): 유나 시선 단계 */
  setGaze(phase: 'away' | 'turn' | 'look' | 'back' | 'gone' | 'door' | 'peer', k: number, t: number): void;
  /** 창 가운데(월드, 망보는 작은 화면이 보는 곳) */
  windowCenter: THREE.Vector3;
  /** 현관 계단 위 선물 두 자리(월드) */
  doorstep: THREE.Vector3[];
  /** 초인종이 눌린 뒤 지난 비율(0~1, 단추가 빛난다) */
  ringBell(k: number): void;
  /** 현관 센서등: on 0~1(켜짐), cover 0~1(눈에 덮인 정도) */
  setPorchLight(on: number, cover: number): void;
  /** 현관문 가운데(월드, 끝 장면 사진기가 먼저 보는 곳) */
  doorCenter: THREE.Vector3;
  /** 현관문: open 0(닫힘)~1(열림), yunaLook: 문간 유나가 보는 쪽(-1·0·1), null이면 유나 없음 */
  setDoor(open: number, yunaLook: number | null, smile?: boolean): void;
  /** 유나네 대문 열림 정도(0 닫힘 ~ 1 활짝) */
  setGateOpen(k: number): void;
  /** 잠긴 대문 덜컹(k: 0~1, 지난 비율) */
  rattleGate(id: string, k: number): void;
}

export function createChapter1Scene(models: Models, base: string, detail: Detail): Ch1Scene {
  const root = new THREE.Group();
  // 바닥: 넓은 눈밭
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), std('#eef2f8', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.userData.flat = true;
  root.add(ground);
  const g0 = W(24, -2);
  ground.position.x = g0.x;
  ground.position.z = g0.z;

  // 다진 눈길: 길마다 가운데 줄(맞는 길만 다져 있으면 답이 보인다). 대문 → 현관은 앞마당 안 발자국 길
  const { M, D, X, LU, RU, U } = STREETS;
  const mid = (a: number, b: number) => (a + b) / 2;
  const roads: { s: number; t: number }[][] = [
    [{ s: -14, t: 0 }, { s: ARCH.s, t: 0 }, { s: 10, t: 0.3 }, { s: mid(X.s0, X.s1), t: 0 }],
    [{ s: mid(D.s0, D.s1), t: M.t0 + 0.5 }, { s: mid(D.s0, D.s1), t: D.t0 + 1 }],
    [{ s: mid(X.s0, X.s1), t: X.t0 + 3 }, { s: mid(X.s0, X.s1) + 0.3, t: 0 }, { s: mid(X.s0, X.s1), t: X.t1 - 3 }],
    [{ s: mid(X.s0, X.s1), t: mid(LU.t0, LU.t1) }, { s: mid(U.s0, U.s1), t: mid(LU.t0, LU.t1) }],
    [{ s: mid(X.s0, X.s1), t: mid(RU.t0, RU.t1) }, { s: RU.s1 - 1, t: mid(RU.t0, RU.t1) }],
    [{ s: mid(U.s0, U.s1), t: U.t0 + 3 }, { s: mid(U.s0, U.s1) + 0.4, t: -8 }, { s: mid(U.s0, U.s1), t: U.t1 - 2.5 }],
  ];
  for (const r of roads) root.add(packedPath(base, detail, { width: 3.0, points: r.map((p) => W(p.s, p.t)) }));
  root.add(footprints([W(-12, -0.6), W(-6, -0.3), W(2, 0.2), W(9, -0.4)]));

  // 돌 아치
  const arch = stoneArch();
  arch.position.copy(at(ARCH.s, 0));
  arch.rotation.y = YAW.back; // 아치 면이 사진기 쪽
  arch.userData.fadeable = true;
  root.add(arch);

  // 길 둘레 울타리(바깥쪽에 눈둑): 선분 가운데에서 양옆 중 길이 아닌 쪽이 바깥
  for (const [a, b] of STREET_FENCES) {
    const ms = mid(a.s, b.s), mt = mid(a.t, b.t);
    const ns = a.t === b.t ? 1 : 0, nt = a.t === b.t ? 0 : 1; // 선분에 수직인 골목 좌표 방향
    const sign = inStreet(ms + ns * 0.8, mt + nt * 0.8) ? -1 : 1;
    const o = W(ns * sign, nt * sign);
    root.add(edgeFence(models, W(a.s, a.t), W(b.s, b.t), undefined, o));
  }
  // 아치 아래쪽 눈둑(시작 자리 뒤)
  root.add(berm([W(-15, -4.5), W(-15.5, 0), W(-15, 4.5)], 3, 0.7, 3));

  // 집·우편함·화분
  const pots: Pot[] = [];
  const houseMeshes: THREE.Object3D[] = [];
  let yunaPot: { group: THREE.Object3D; s: number; t: number } | null = null;
  for (const h of CH1_HOUSES) {
    const c = at(h.s, h.t);
    const house = alleyHouse(models, { x: c.x, z: c.z, rotY: faceYaw(h), scale: houseScaleOf(h) });
    if (!h.yuna) house.userData.fadeable = true;
    else {
      house.scale.x *= -1; // 유나네는 좌우를 뒤집어 문이 왼쪽, 창가가 오른쪽(데이터 doorOff와 같다)
      houseMeshes.push(house);
    } // 앞쪽 집이 뒤 길의 요정을 가리면 흐려진다
    root.add(house);
    const m = mailboxOf(h);
    const mb = mailbox(models, h.mail);
    mb.position.copy(at(m.s, m.t));
    // 우편함 앞(+z)이 골목·대문 바깥쪽을 보게
    mb.rotation.y = h.faces === 'back' ? YAW.back : h.faces === 'left' ? YAW.left : YAW.right;
    root.add(mb);
    const p = pot(h.pot);
    const pp = potOf(h);
    p.group.position.copy(at(pp.s, pp.t));
    p.group.rotation.y = faceYaw(h);
    root.add(p.group);
    pots.push(p);
    if (h.yuna) yunaPot = { group: p.group, s: pp.s, t: pp.t };
    // 문 앞 발판
    const d = doorOf(h);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), std('#8c4a3a', { roughness: 1 }));
    mat.rotation.set(-Math.PI / 2, 0, -faceYaw(h));
    mat.position.copy(at(d.s, d.t, 0.012));
    mat.userData.flat = true;
    root.add(mat);
    // 골목 울타리의 작은 나무 대문(배경 집: 들어갈 수 없다)
    if (!h.lowWall) {
      const gt = gateOf(h);
      const gate = new THREE.Group();
      const wood = std('#7a4a2a', { roughness: 0.9 });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, TOWN.fence + 0.55, 0.28), wood);
        post.position.set(sx * 1.25, (TOWN.fence + 0.55) / 2, 0);
        gate.add(post);
        const cap = new THREE.Mesh(roundedBox(0.4, 0.14, 0.4), snowMat);
        cap.position.set(sx * 1.25, TOWN.fence + 0.6, 0);
        gate.add(cap);
      }
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, TOWN.fence * 0.85, 0.12), std('#b5703f', { roughness: 0.9 }));
      panel.position.y = TOWN.fence * 0.5;
      gate.add(panel);
      for (const y of [0.35, 0.75]) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 0.16), wood);
        slat.position.y = TOWN.fence * y;
        gate.add(slat);
      }
      gate.position.copy(at(gt.s, gt.t));
      gate.rotation.y = faceYaw(h);
      root.add(gate);
    } else {
      // 낮은 담 집: 문 앞 따뜻한 빛(네 집 모두 같게: 불빛으로는 못 고른다)
      const glow = warmPool(2.8);
      const dd = housePointAhead(h, d);
      glow.position.copy(at(dd.s, dd.t, 0.006));
      root.add(glow);
    }
  }
  void HOUSE_HALF;

  // 낮은 돌담(대문 자리는 비운다) + 나무 대문 넷(칠이 서로 다르다)
  for (const [a, b] of LOW_WALLS) root.add(lowWall(a, b));
  const PAINT: Record<string, string> = { yuna: '#f1ece2', A: '#5f8f5a', B: '#b5703f', C: '#7f9fc4' };
  const gates = new Map<string, { leaf: THREE.Group; base: number; openSign: number }>();
  for (const g of GATES) {
    const yg = yardGate(g, PAINT[g.id] ?? '#b5703f');
    root.add(yg.group);
    gates.set(g.id, { leaf: yg.leaf, base: yg.leaf.rotation.y, openSign: yg.openSign });
  }

  // 길잡이: 갈림길의 빨간 우체통(골목에서 올라오면 정면), 윗길 모퉁이의 큰 장식 트리
  const pb = postBox();
  pb.position.copy(at(LANDMARKS.postBox.s, LANDMARKS.postBox.t));
  pb.rotation.y = YAW.back;
  root.add(pb);
  const ct = createVillageTree({ lights: true });
  ct.scale.setScalar(0.62);
  ct.position.copy(at(LANDMARKS.cornerTree.s, LANDMARKS.cornerTree.t));
  ct.userData.fadeable = true;
  root.add(ct);

  // 유나네 창가
  const win = bayWindow();
  win.group.position.copy(at(YUNA_WINDOW.s, YUNA_WINDOW.t));
  win.group.rotation.y = YAW.back;
  root.add(win.group);
  win.group.updateMatrixWorld(true);
  const yunaSeat = win.group.localToWorld(win.seat.clone());

  // 가로등(길가), 나무(길 사이 빈 땅·바깥). 길 안은 비운다
  for (const [ls, lt] of [[2, LANE_HALF + 1.2], [14, -LANE_HALF - 1.2], [X.s1 + 1.2, -10], [X.s1 + 1.2, 12], [LU.s0 + 6, LU.t0 - 1.2], [U.s0 - 1.2, -4], [RU.s0 + 7, RU.t1 + 1.2]] as const) {
    const l = townLamp();
    l.position.copy(at(ls, lt));
    l.userData.fadeable = true;
    root.add(l);
  }
  const trees: [number, number, 'treeSnowA' | 'treeSnowB'][] = [
    [-9, -7, 'treeSnowA'], [-10, 7.5, 'treeSnowB'],
    // 갈림길 위 빈 땅(우체통 뒤): 윗길 바로 아래는 비운다(큰 나무가 윗길의 요정을 가렸다)
    [25.2, -14, 'treeSnowB'], [25.4, -6, 'treeSnowA'], [25.2, 6, 'treeSnowB'], [25.6, 15.6, 'treeSnowA'],
    // 골목 오른쪽 집 위, 갈래 사이
    [12.5, 8, 'treeSnowA'], [12, 15, 'treeSnowB'], [13.5, -8, 'treeSnowA'],
    // 바깥 둘레
    [20, -32, 'treeSnowB'], [36, -32, 'treeSnowA'], [8, 29, 'treeSnowA'], [24, 29, 'treeSnowB'], [-3, -9, 'treeSnowB'],
  ];
  for (const [ts, tt, n] of trees) {
    const tr = kenneyProp(models, n, ts > 20 && ts < 34 ? 4.2 : 5.4);
    if (!tr) continue;
    tr.position.copy(at(ts, tt));
    tr.userData.fadeable = true;
    root.add(tr);
  }

  // 앞마당 생울타리 둘(길을 세 갈래로 나누는 긴 엄폐물)
  HEDGES.forEach((h, i) => {
    const pa = at(h.a.s, h.a.t), pb = at(h.b.s, h.b.t);
    const row = hedgeRow(pa.distanceTo(pb), i + 1);
    row.position.copy(pa).add(pb).multiplyScalar(0.5);
    row.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z) - Math.PI / 2;
    row.userData.fadeable = true;
    root.add(row);
  });
  // 앞마당: 대문 → 현관 디딤돌 정원길(비워 둔다), 길옆 엄폐물(눈사람·장식 나무·덤불), 장작 더미, 현관 등
  root.add(steppingStones(GARDEN_PATH));
  const makers = { snowman: () => gardenSnowman(models), tree: () => gardenTree(models), bush: gardenBush, logs, doghouse } as const;
  for (const c of COVERS) {
    const o = makers[c.kind]();
    o.position.copy(at(c.s, c.t));
    o.rotation.y = YAW.back + (c.kind === 'snowman' ? -0.5 : c.kind === 'doghouse' ? -0.35 : 0);
    o.userData.fadeable = true;
    root.add(o);
  }
  // 현관 양옆 등(Kenney CC0)
  {
    const yuna = CH1_HOUSES.find((h) => h.yuna)!;
    const d = doorOf(yuna);
    for (const k of [-1.5, 1.5]) {
      const l = models.clone('lantern');
      if (!l) break;
      const o = fitHeight(l, 0.9);
      o.position.copy(at(d.s - 0.5 * YUNA_HOUSE_K, d.t + k * 1.75 * YUNA_HOUSE_K));
      root.add(o);
    }
  }
  // 현관 계단 위 선물 자리: 집 모델의 계단 윗면 높이를 아래로 쏘아 재고, 문 앞 왼쪽·오른쪽 두 자리
  const yunaHouse = CH1_HOUSES.find((h) => h.yuna)!;
  const door = doorOf(yunaHouse);
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const stepTop = (s0: number, t0: number) => {
    const p = at(s0, t0, 6);
    ray.set(p, new THREE.Vector3(0, -1, 0));
    // 처마·지붕은 건너뛰고 계단 윗면(낮은 곳)만
    const hit = ray.intersectObjects(houseMeshes, true).find((h) => h.point.y < 1.6);
    return hit ? hit.point.y : 0;
  };
  // 계단 윗단(집 모델에서 잰 높이 약 0.8)은 문 앞 t 약 -0.5 ~ 1.6에 걸쳐 있다 → 그 가운데 두 자리
  // 유나네 화분은 큰 현관 계단 위에(계단 속에 묻혀 흙만 보이지 않게)
  if (yunaPot) yunaPot.group.position.y = stepTop(yunaPot.s, yunaPot.t);
  const kk = YUNA_HOUSE_K;
  const doorstep = [-0.55, 0.55].map((k) => {
    const s0 = door.s - 0.8 * kk;
    const t0 = PORCH.t + k; // 뒤집어 세운 집: 계단 윗단은 문 앞(가운데 왼쪽)
    return at(s0, t0, stepTop(s0, t0) + 0.01);
  });
  // 초인종(문 오른쪽 벽, 창가 쪽)
  const bellPlate = doorbellPlate();
  bellPlate.group.position.copy(at(DOORBELL.s - 0.06, DOORBELL.t, DOORBELL.y));
  bellPlate.group.rotation.y = YAW.back;
  root.add(bellPlate.group);
  // 현관문이 열리면: 문간에 따뜻한 방 빛 + 문간에 선 유나(두리번)
  const stoopY = stepTop(door.s - 0.6 * kk, PORCH.t);
  const doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 6.0),
    new THREE.MeshBasicMaterial({ color: '#ffd59a', transparent: true, opacity: 0, depthWrite: false }),
  );
  doorway.position.copy(at(door.s + 0.55, PORCH.t, stoopY + 3.0)); // 문짝 바로 앞(현관 기둥 사이)
  doorway.rotation.y = YAW.back;
  root.add(doorway);
  const dy = doorYuna();
  dy.group.position.copy(at(door.s - 1.3, PORCH.t, stoopY)); // 문을 열고 계단 윗단 앞쪽에 나와 선다(현관 지붕에 머리가 가리지 않게)
  dy.group.rotation.y = YAW.back;
  dy.group.visible = false;
  root.add(dy.group);
  // 현관 센서등(문 위)과 감지기(문 왼쪽 위)
  const ps = porchSensor() as ReturnType<typeof porchSensor> & { pool: THREE.Mesh };
  ps.lamp.position.copy(at(door.s - 0.25, PORCH.t, stoopY + 6.4));
  ps.lamp.rotation.y = YAW.back;
  root.add(ps.lamp);
  ps.sensor.position.copy(at(SENSOR.s - 0.06, SENSOR.t, SENSOR.y));
  ps.sensor.rotation.y = YAW.back;
  root.add(ps.sensor);
  ps.pool.position.copy(at(door.s - 2.0, PORCH.t, 0.02));
  root.add(ps.pool);
  const windowCenter = win.group.localToWorld(new THREE.Vector3(0, YUNA_WINDOW.sill + YUNA_WINDOW.height / 2, 1.5));
  const sil = win.silhouette;
  const baseY = sil.position.y;
  const baseX = sil.position.x;
  return {
    root,
    doorstep,
    doorCenter: at(door.s, PORCH.t, stoopY + 2.0),
    ringBell(k) {
      bellPlate.press(k);
    },
    setPorchLight(on, cover) {
      ps.set(on, cover);
    },
    setDoor(open, yunaLook, smile) {
      (doorway.material as THREE.MeshBasicMaterial).opacity = 0.95 * open;
      dy.group.visible = yunaLook !== null && open > 0.3;
      if (yunaLook !== null) dy.look(Math.round(yunaLook), smile);
    },
    yunaSeat,
    yunaPlaceholder: sil,
    frost: win.frost,
    windowCenter,
    setGaze(phase, k, t) {
      // door: 현관에 나가 있다(창은 비어 있다)
      if (phase === 'door') {
        sil.visible = false;
        return;
      }
      // gone: 초인종에 일어나 옆으로 걸어 나가 창이 빈다(처음 0.08·끝 0.08 동안 나가고 들어온다)
      if (phase === 'gone') {
        const out = Math.min(1, k / 0.08, (1 - k) / 0.08);
        sil.rotation.y = Math.PI * 0.5;
        sil.position.x = baseX + out * YUNA_WINDOW.width * 0.8;
        sil.position.y = baseY;
        sil.visible = out < 0.98;
        return;
      }
      sil.visible = true;
      sil.position.x = baseX;
      // peer: 창문 톡 소리에 창에 바짝 붙어 창 쪽(오른쪽)을 내다본다
      if (phase === 'peer') {
        sil.rotation.y = 0;
        sil.position.x = baseX - 0.5;
        sil.position.y = baseY + 0.12;
        return;
      }
      // away: 등을 보이고 고개 숙여 그림(살짝 들썩) / turn: 일어나며 돌아선다 / look: 창밖을 본다 / back: 다시 돌아앉는다
      const e = k * k * (3 - 2 * k);
      const turn = phase === 'away' ? 0 : phase === 'turn' ? e : phase === 'look' ? 1 : 1 - e;
      sil.rotation.y = Math.PI * (1 - turn);
      sil.position.y = baseY - 0.28 * (1 - turn) + (phase === 'away' ? Math.abs(Math.sin(t * 5)) * 0.03 : 0);
    },
    update(t) {
      for (const p of pots) if (p.spin) p.spin.rotation.z = -t * 2.2;
    },
    setGateOpen(k) {
      const g = gates.get('yuna');
      if (g) g.leaf.rotation.y = g.base + g.openSign * 1.75 * k;
    },
    rattleGate(id, k) {
      const g = gates.get(id);
      if (g) g.leaf.rotation.y = g.base + g.openSign * Math.sin(k * Math.PI * 6) * 0.06 * (1 - k);
    },
  };
}
