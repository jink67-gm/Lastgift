// 1장 공간 그리기: 돌 아치 → 우편함 골목(양옆 집·우편함 무늬·화분) → 낮은 담 안 유나네 앞마당·창가.
// 배치는 src/data/chapter1.ts만 따른다(판정과 같은 값). 사람(유나·지우)은 사용자 에셋을 받아 넣는다(지금은 창가에 실루엣 자리만).
import * as THREE from 'three';
import {
  ARCH,
  CH1_HOUSES,
  HOUSE_HALF,
  HOUSE_SCALE,
  LANE_HALF,
  LOW_WALL_H,
  W,
  YARD,
  YAW,
  YUNA_WINDOW,
  COVERS,
  LOOKOUTS,
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
import { alleyHouse, berm, contactShadow, edgeFence, footprints, packedPath, roundedBox } from './plazaDressing';
import { townLamp } from './plaza';
import { kenneyProp } from './kenney';
import { warmPool } from './winterLight';
import type { Detail } from './plazaDressing';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const SNOW = '#f4f7fc';
const snowMat = std(SNOW, { roughness: 1 });

const at = (s: number, t: number, y = 0) => {
  const p = W(s, t);
  return new THREE.Vector3(p.x, y, p.z);
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
  const body = new THREE.Mesh(roundedBox(len, LOW_WALL_H, 0.5), std('#a89a86', { roughness: 0.95 }));
  body.position.set(0, LOW_WALL_H / 2, 0);
  g.add(body);
  // 돌 줄눈(짙은 띠 둘)
  for (const y of [0.55, 1.15]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.05, 0.52), std('#8a7d6a'));
    seam.position.y = y;
    g.add(seam);
  }
  const cap = new THREE.Mesh(roundedBox(len + 0.1, 0.22, 0.7), snowMat);
  cap.position.y = LOW_WALL_H + 0.08;
  g.add(cap);
  g.position.copy(mid);
  g.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z) - Math.PI / 2;
  g.userData.fadeable = true;
  return g;
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
  // 유나 자리(사용자 에셋이 올 때까지 실루엣 판). 앞면(눈 있음)·뒷면(뒤통수)을 붙인 판을 돌려 "몸 돌리기"를 보인다
  const yuna = new THREE.Group();
  yuna.name = 'yunaPlaceholder';
  const sil = (color: string) => {
    const head = new THREE.Shape();
    head.absarc(0, 0.95, 0.42, 0, Math.PI * 2, false);
    const body = new THREE.Shape();
    body.moveTo(-0.75, 0);
    body.quadraticCurveTo(-0.7, 0.55, 0, 0.6);
    body.quadraticCurveTo(0.7, 0.55, 0.75, 0);
    body.lineTo(-0.75, 0);
    const tails = [-1, 1].map((sx) => {
      const t = new THREE.Shape();
      t.absarc(sx * 0.5, 0.85, 0.16, 0, Math.PI * 2, false);
      return t;
    });
    return new THREE.Mesh(new THREE.ShapeGeometry([head, body, ...tails]), new THREE.MeshBasicMaterial({ color, side: THREE.FrontSide }));
  };
  const front = sil('#6a4430');
  front.position.z = 0.01;
  yuna.add(front);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), new THREE.MeshBasicMaterial({ color: '#f3cfb2' }));
  face.position.set(0, 0.93, 0.015);
  yuna.add(face);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: '#1b1210' }));
    eye.position.set(sx * 0.12, 0.98, 0.02);
    yuna.add(eye);
  }
  const backSide = sil('#3a2418');
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
  const frost = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshBasicMaterial({ map: frostTexture(), transparent: true, opacity: 0.9, depthWrite: false }));
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

/** 큰 화면에만 보이는 층(창 성에) */
export const FROST_LAYER = 1;

// ── 앞마당 엄폐물 ────────────────────────────────────────
function snowman(): THREE.Group {
  const g = new THREE.Group();
  const white = std('#f8fbff', { roughness: 1 });
  for (const [y, r] of [[0.72, 0.78], [1.72, 0.56], [2.45, 0.4]] as const) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), white);
    b.position.y = y;
    g.add(b);
  }
  const coal = std('#1e1e24');
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), coal);
    e.position.set(sx * 0.13, 2.55, 0.36);
    g.add(e);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 6), std('#6b4428'));
    arm.position.set(sx * 0.85, 1.95, 0);
    arm.rotation.z = sx * 1.0;
    g.add(arm);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), std('#f07a2a'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.45, 0.5);
  g.add(nose);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 20), std('#d23a3a'));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 2.15;
  g.add(scarf);
  g.add(contactShadow(1.9, 1.9, 0.32));
  return g;
}

function wheelbarrow(): THREE.Group {
  const g = new THREE.Group();
  const green = std('#3f7a5a', { roughness: 0.8 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 1.15), green);
  tray.position.set(0, 1.0, 0);
  tray.rotation.z = 0.08;
  g.add(tray);
  const snow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 10), std('#f8fbff', { roughness: 1 }));
  snow.scale.set(1.15, 0.55, 0.75);
  snow.position.set(0, 1.4, 0);
  g.add(snow);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 8, 18), std('#2a2a2e'));
  wheel.position.set(1.0, 0.42, 0);
  g.add(wheel);
  const wood = std('#8a5a3a');
  for (const sz of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), wood);
    handle.rotation.z = Math.PI / 2 - 0.25;
    handle.position.set(-1.25, 0.95, sz * 0.4);
    g.add(handle);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), wood);
    leg.position.set(-0.55, 0.35, sz * 0.4);
    g.add(leg);
  }
  g.add(contactShadow(2.4, 1.6, 0.3));
  return g;
}

function bush(): THREE.Group {
  const g = new THREE.Group();
  const leaf = std('#3c6e4a', { roughness: 1 });
  const snow = std('#f8fbff', { roughness: 1 });
  for (const [x, z, r] of [[0, 0, 0.95], [0.6, 0.3, 0.7], [-0.55, 0.25, 0.72], [0.1, -0.5, 0.65]] as const) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
    b.position.set(x, r * 0.9, z);
    g.add(b);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), snow);
    cap.position.set(x, r * 1.15, z);
    g.add(cap);
  }
  g.add(contactShadow(2.2, 2.2, 0.3));
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

/** 망보는 자리 바닥 표시: 눈 모양(여기 서면 창 안이 보인다) */
function eyeMark(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.0)';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(60,90,140,0.7)';
  g.lineWidth = 6;
  g.setLineDash([10, 8]);
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(60,90,140,0.75)';
  g.beginPath();
  g.ellipse(64, 64, 34, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(64, 64, 11, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.flat = true;
  return m;
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
  setGaze(phase: 'away' | 'turn' | 'look' | 'back', k: number, t: number): void;
  /** 창 가운데(월드, 망보는 작은 화면이 보는 곳) */
  windowCenter: THREE.Vector3;
}

export function createChapter1Scene(models: Models, base: string, detail: Detail): Ch1Scene {
  const root = new THREE.Group();
  // 바닥: 넓은 눈밭
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), std('#eef2f8', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.userData.flat = true;
  root.add(ground);
  const mid = W(22, 0);
  ground.position.x = mid.x;
  ground.position.z = mid.z;

  // 골목 다진 눈길: 아치 아래에서 담 앞까지, 담 오른쪽 끝을 돌아 앞마당으로
  const route = [W(-14, 0), W(ARCH.s, 0), W(10, 0.3), W(25, -0.3), W(38, 0.5), W(40.5, 6), W(43.5, 8.4), W(47, 6), W(YARD.back - 0.8, 2.4)];
  root.add(packedPath(base, detail, { width: 3.2, points: route }));
  root.add(footprints([W(-12, -0.6), W(-6, -0.3), W(2, 0.2), W(9, -0.4)]));

  // 돌 아치
  const arch = stoneArch();
  arch.position.copy(at(ARCH.s, 0));
  arch.rotation.y = YAW.back; // 아치 면이 사진기 쪽
  arch.userData.fadeable = true;
  root.add(arch);

  // 골목 양옆 울타리(바깥쪽에 눈둑)
  const left = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
  const right = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
  root.add(edgeFence(models, W(ARCH.s + 0.8, -LANE_HALF), W(YARD.front - 0.3, -LANE_HALF), undefined, left));
  root.add(edgeFence(models, W(ARCH.s + 0.8, LANE_HALF), W(YARD.front - 4.5, LANE_HALF), undefined, right));
  root.add(edgeFence(models, W(YARD.front - 4.5, LANE_HALF), W(YARD.front - 4.5, YARD.right + 2.2), undefined, { x: -Math.SQRT1_2, z: Math.SQRT1_2 }));
  root.add(edgeFence(models, W(YARD.front - 4.5, YARD.right + 2.2), W(YARD.back, YARD.right + 2.2), undefined, right));
  // 아치 아래쪽 눈둑(시작 자리 뒤)
  root.add(berm([W(-15, -4.5), W(-15.5, 0), W(-15, 4.5)], 3, 0.7, 3));

  // 집·우편함·화분
  const pots: Pot[] = [];
  for (const h of CH1_HOUSES) {
    const c = at(h.s, h.t);
    root.add(alleyHouse(models, { x: c.x, z: c.z, rotY: faceYaw(h), scale: HOUSE_SCALE }));
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
    // 문 앞 발판
    const d = doorOf(h);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), std('#8c4a3a', { roughness: 1 }));
    mat.rotation.set(-Math.PI / 2, 0, -faceYaw(h));
    mat.position.copy(at(d.s, d.t, 0.012));
    mat.userData.flat = true;
    root.add(mat);
    // 골목 울타리의 작은 나무 대문(우편함이 대문 왼쪽·오른쪽 어디에 있는지 비교하는 기준)
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
    }
    if (h.lowWall) {
      const glow = warmPool(2.8);
      glow.position.copy(at(d.s - 1.2, d.t, 0.006));
      root.add(glow);
    }
  }
  void HOUSE_HALF;

  // 유나네 낮은 담(대문은 오른쪽 끝) + 대문 기둥
  root.add(lowWall({ s: YARD.front, t: YARD.left }, { s: YARD.front, t: YARD.gate[0] }));
  root.add(lowWall({ s: YARD.front, t: YARD.left }, { s: YARD.back, t: YARD.left }));
  for (const t of YARD.gate) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, LOW_WALL_H + 0.5, 0.7), std('#9c8d76', { roughness: 0.95 }));
    post.position.copy(at(YARD.front, t, (LOW_WALL_H + 0.5) / 2));
    root.add(post);
    const cap = new THREE.Mesh(roundedBox(0.85, 0.2, 0.85), snowMat);
    cap.position.copy(at(YARD.front, t, LOW_WALL_H + 0.6));
    root.add(cap);
  }

  // 유나네 창가
  const win = bayWindow();
  win.group.position.copy(at(YUNA_WINDOW.s, YUNA_WINDOW.t));
  win.group.rotation.y = YAW.back;
  root.add(win.group);
  win.group.updateMatrixWorld(true);
  const yunaSeat = win.group.localToWorld(win.seat.clone());

  // 가로등·나무(골목 바깥)
  for (const [s, t] of [[2, LANE_HALF + 1.2], [20, -LANE_HALF - 1.2], [36, LANE_HALF + 1.2]] as const) {
    const l = townLamp();
    l.position.copy(at(s, t));
    l.userData.fadeable = true;
    root.add(l);
  }
  for (const [s, t, n] of [[-9, -7, 'treeSnowA'], [-10, 7.5, 'treeSnowB'], [18, -8.5, 'treeSnowB'], [44, -13, 'treeSnowA'], [40, 15, 'treeSnowA']] as const) {
    const tr = kenneyProp(models, n, 5.4);
    if (!tr) continue;
    tr.position.copy(at(s, t));
    tr.userData.fadeable = true;
    root.add(tr);
  }

  // 앞마당 엄폐물·망보는 자리 표시
  const makers = { snowman, barrow: wheelbarrow, bush, logs } as const;
  for (const c of COVERS) {
    const o = makers[c.id]();
    o.position.copy(at(c.s, c.t));
    o.rotation.y = YAW.back + (c.id === 'barrow' ? 0.6 : 0);
    o.userData.fadeable = true;
    root.add(o);
  }
  for (const l of LOOKOUTS) {
    const m = eyeMark();
    m.position.copy(at(l.s, l.t, 0.015));
    root.add(m);
  }
  const windowCenter = win.group.localToWorld(new THREE.Vector3(0, YUNA_WINDOW.sill + YUNA_WINDOW.height / 2, 1.5));
  const sil = win.silhouette;
  const baseY = sil.position.y;
  return {
    root,
    yunaSeat,
    yunaPlaceholder: sil,
    frost: win.frost,
    windowCenter,
    setGaze(phase, k, t) {
      // away: 등을 보이고 고개 숙여 그림(살짝 들썩) / turn: 일어나며 돌아선다 / look: 창밖을 본다 / back: 다시 돌아앉는다
      const e = k * k * (3 - 2 * k);
      const turn = phase === 'away' ? 0 : phase === 'turn' ? e : phase === 'look' ? 1 : 1 - e;
      sil.rotation.y = Math.PI * (1 - turn);
      sil.position.y = baseY - 0.28 * (1 - turn) + (phase === 'away' ? Math.abs(Math.sin(t * 5)) * 0.03 : 0);
    },
    update(t) {
      for (const p of pots) if (p.spin) p.spin.rotation.z = -t * 2.2;
    },
  };
}
