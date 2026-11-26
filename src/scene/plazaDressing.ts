// 광장 꾸밈(판정 없음): 그래픽 개선 지시서(LAST_GIFT_GRAPHICS_PROMPT.md)와 연출 가이드 §4·§6.
//   다진 눈길 · 썰매 날 자국 · 쌓인 눈(벽 밑·벤치 다리·울타리) · 물체가 바닥에 닿는 그늘 · 가장자리 울타리와 눈둑
//   · 썰매 뒤 두 집 사이 골목(우편함) · 화면 밖으로 이어지는 마을 지붕 실루엣.
// 외부 재료(모두 CC0, ASSET_LICENSES.md):
//   Poly Haven Snow 02 · Cobblestone Floor 001(512 px로 줄이고 대비를 낮춤), Tiny Treats Homely House(집·울타리·우편함).
// 텍스처나 모델을 못 불러와도 색과 기본 도형으로 길·골목이 보인다. 저사양(detail: 'low')은 눈결·노멀맵을 뺀다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PLAZA_DRESSING, PLAZA_PROPS, WORKSHOP, type Prop } from '../data/plaza';
import { FENCE_SCALE, KENNEY_HOUSE_SCALE, MAILBOX_SCALE, TOWN } from '../data/townScale';
import type { Models } from './models';
import { warmPool } from './winterLight';

export type Detail = 'low' | 'normal';

const C = {
  snowLit: '#fbf8f2', // 빛 받는 눈(크림)
  drift: '#fdfcf8',
  packed: '#bfcadb', // 밟아 다진 회청색 눈
  stone: '#8e98aa',
  groove: '#9aa9c2',
  contact: '#5d6c8c', // 물체가 바닥에 닿는 그늘(밝은 청회색 계열의 진한 쪽)
  farRoof: '#d3dceb',
  farWall: '#46557a',
};

// ─── 텍스처 ──────────────────────────────────────────────────────────────

const loader = new THREE.TextureLoader();
function tex(url: string, srgb: boolean): Promise<THREE.Texture | null> {
  return loader.loadAsync(url).then(
    (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    },
    () => null,
  );
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 가운데가 진하고 가장자리가 투명한 그늘(물체가 바닥에 닿는 곳) */
let contactTex: THREE.CanvasTexture | null = null;
export function contactShadow(w: number, d: number, opacity = 0.32): THREE.Mesh {
  contactTex ??= canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: C.contact, alphaMap: contactTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.007;
  m.userData.flat = true;
  m.renderOrder = 1;
  return m;
}

// ─── 바닥 눈결 ───────────────────────────────────────────────────────────

/** 광장 바닥·바깥 눈밭에 눈결(Snow 02)을 아주 약하게 입힌다. 2.5 m마다 한 장 */
export function applySnowSurface(mats: { mat: THREE.MeshStandardMaterial; w: number; d: number }[], base: string, detail: Detail): Promise<void> {
  if (detail === 'low') return Promise.resolve();
  // 노멀맵은 플레이 거리에서 거의 보이지 않는데 화면 전체를 덮어 비용이 커서 쓰지 않는다(색 눈결만)
  return tex(`${base}textures/polyhaven/snow_02_diff_512.jpg`, true).then((diff) => {
    if (!diff) return;
    for (const { mat, w, d } of mats) {
      const t = diff.clone();
      t.repeat.set(w / 3.5, d / 3.5);
      t.needsUpdate = true;
      mat.map = t;
      mat.needsUpdate = true;
    }
  });
}

// ─── 리본(길·자국) ─────────────────────────────────────────────────────

/** 땅 위 곡선을 따라가는 띠. u = 폭 방향 0~1, v = 길이(m) / tile */
function ribbon(points: THREE.Vector3[], width: number, tile: number, y: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = Math.max(8, Math.ceil(curve.getLength() / 0.4));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let run = 0;
  let prev = curve.getPointAt(0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    run += p.distanceTo(prev);
    prev = p;
    const nx = -tan.z, nz = tan.x;
    const l = Math.hypot(nx, nz) || 1;
    for (const s of [-1, 1]) {
      pos.push(p.x + (nx / l) * (width / 2) * s, y, p.z + (nz / l) * (width / 2) * s);
      uv.push(s < 0 ? 0 : 1, run / tile);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 다진 눈길 텍스처: 회청색 눈, 가운데에만 눈 사이로 둥근 포석 윗면 몇 개. 가장자리는 부드럽게 사라진다 */
function packedPathTexture(cobble: HTMLImageElement | null): THREE.CanvasTexture {
  const W = 128, H = 512; // 폭 2.2 m × 길이 8.8 m(한 장)
  return canvasTex(W, H, (g) => {
    // 1) 다진 눈: 폭 방향으로 가운데 진하고 가장자리 투명
    const across = g.createLinearGradient(0, 0, W, 0);
    across.addColorStop(0, 'rgba(191,202,219,0)');
    across.addColorStop(0.22, 'rgba(191,202,219,0.75)');
    across.addColorStop(0.5, 'rgba(184,196,214,0.95)');
    across.addColorStop(0.78, 'rgba(191,202,219,0.75)');
    across.addColorStop(1, 'rgba(191,202,219,0)');
    g.fillStyle = across;
    g.fillRect(0, 0, W, H);
    // 2) 포석 윗면: 정해진 자리(매번 같은 그림)에 둥근 돌 몇 개만 눈 밖으로
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stones = document.createElement('canvas');
    stones.width = W;
    stones.height = H;
    const sg = stones.getContext('2d')!;
    if (cobble) {
      // 돌 하나 ≈ 15~20 cm(요정 신발의 두 배쯤): 2 m 텍스처를 116 px로
      for (let y = 0; y < H; y += 116) for (let x = -20; x < W; x += 116) sg.drawImage(cobble, x, y, 116, 116);
      sg.globalCompositeOperation = 'source-atop';
      sg.fillStyle = 'rgba(205,214,230,0.68)'; // 푸르고 밝게, 대비 낮게(눈 묻은 돌 윗면)
      sg.fillRect(0, 0, W, H);
    } else {
      sg.fillStyle = C.stone;
      sg.fillRect(0, 0, W, H);
    }
    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const mg = mask.getContext('2d')!;
    for (let i = 0; i < 16; i++) {
      const x = W * (0.34 + rnd() * 0.32);
      const y = rnd() * H;
      const r = 8 + rnd() * 6;
      for (const dy of [-H, 0, H]) {
        const gr = mg.createRadialGradient(x, y + dy, 0, x, y + dy, r);
        gr.addColorStop(0, 'rgba(0,0,0,0.9)');
        gr.addColorStop(0.7, 'rgba(0,0,0,0.6)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        mg.fillStyle = gr;
        mg.beginPath();
        mg.ellipse(x, y + dy, r * 1.15, r, 0, 0, Math.PI * 2);
        mg.fill();
      }
    }
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(mask, 0, 0);
    g.drawImage(stones, 0, 0);
    // 돌 윗면에 남은 눈가루(위쪽 가장자리를 밝게): 둥근 돌로 읽히게
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.35;
    g.drawImage(mask, 0, -3);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  });
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

export function packedPath(base: string, detail: Detail, path: { width: number; points: { x: number; z: number }[] } = PLAZA_DRESSING.path): THREE.Mesh {
  const pts = path.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, depthWrite: false, roughness: 0.9, map: packedPathTexture(null), side: THREE.DoubleSide });
  const m = new THREE.Mesh(ribbon(pts, path.width, 8.8, 0.006), mat);
  m.userData.flat = true;
  m.renderOrder = 1;
  if (detail !== 'low') {
    void loadImage(`${base}textures/polyhaven/cobblestone_floor_001_diff_512.jpg`).then((im) => {
      if (!im) return;
      mat.map?.dispose();
      mat.map = packedPathTexture(im);
      mat.map.wrapT = THREE.RepeatWrapping;
      mat.needsUpdate = true;
    });
  }
  mat.map!.wrapT = THREE.RepeatWrapping;
  return m;
}

// ─── 썰매 날 자국 ──────────────────────────────────────────────────────

/** 날 홈 하나: 가운데 그늘진 홈 + 양옆으로 밀려 올라간 밝은 턱. 썰매 쪽(v=길이 끝)이 깊고 뒤쪽은 얕다 */
function grooveTexture(): THREE.CanvasTexture {
  return canvasTex(32, 256, (g) => {
    for (let y = 0; y < 256; y++) {
      const depth = 0.25 + 0.75 * (y / 255); // 0 = 들어온 쪽(얕음), 255 = 썰매 쪽(깊음)
      const gr = g.createLinearGradient(0, 0, 32, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.18, `rgba(255,255,255,${(0.7 * depth).toFixed(3)})`);
      gr.addColorStop(0.38, `rgba(130,148,178,${(0.75 * depth).toFixed(3)})`);
      gr.addColorStop(0.62, `rgba(130,148,178,${(0.75 * depth).toFixed(3)})`);
      gr.addColorStop(0.82, `rgba(255,255,255,${(0.7 * depth).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, y, 32, 1);
    }
  });
}

function sleighTrail(sleigh: Prop): THREE.Group {
  const root = new THREE.Group();
  const yaw = sleigh.rotY ?? 0;
  // 썰매 몸의 +x(앞, 고리 쪽)가 가는 방향 → 자국은 뒤쪽(-x)으로 뻗는다
  const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const side = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const { length, gauge } = PLAZA_DRESSING.sleighEntry;
  const map = grooveTexture();
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const back = 1.3 + (length * (6 - i)) / 6; // 들어온 쪽 → 썰매 뒤
      const bend = Math.sin(((6 - i) / 6) * Math.PI) * 0.6; // 아주 살짝 휘어 들어온 자국
      pts.push(new THREE.Vector3(sleigh.x, 0, sleigh.z).addScaledVector(fwd, -back).addScaledVector(side, s * gauge / 2 + bend));
    }
    const m = new THREE.Mesh(ribbon(pts, 0.32, length + 1.3, 0.009), mat);
    m.userData.flat = true;
    m.renderOrder = 2;
    root.add(m);
  }
  // 썰매가 멈춘 앞쪽: 밀려 모인 눈(눈더미 앞에 초승달 모양으로)
  const snow = new THREE.MeshStandardMaterial({ color: C.drift, roughness: 1 });
  for (const [ahead, off, sx, sh] of [[2.3, 0, 1.1, 0.5], [2.0, 0.9, 0.7, 0.36], [2.0, -0.9, 0.75, 0.38], [1.6, 1.5, 0.5, 0.26]] as const) {
    const lump = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), snow);
    lump.scale.set(sx, sh, sx * 0.8);
    lump.position.copy(new THREE.Vector3(sleigh.x, 0, sleigh.z).addScaledVector(fwd, ahead).addScaledVector(side, off));
    root.add(lump);
  }
  // 날 아래 그늘(썰매가 눈에 닿은 자리)
  for (const s of [-1, 1]) {
    const c = contactShadow(3.4, 0.5, 0.4);
    c.rotation.z = yaw;
    c.position.copy(new THREE.Vector3(sleigh.x, 0.012, sleigh.z).addScaledVector(side, (s * gauge) / 2));
    root.add(c);
  }
  return root;
}

// ─── 쌓인 눈·그늘 ──────────────────────────────────────────────────────

const driftMat = new THREE.MeshStandardMaterial({ color: C.drift, roughness: 1 });

/**
 * 낮고 길게 이어지는 불규칙한 눈둑. 선(points)을 따라 단면이 둥근 띠를 만들고, 폭·높이를 천천히 출렁이게 한다.
 * bumps: 이 지점들(울타리 기둥·모서리) 둘레는 도톰하게. 반복되는 타원 덩어리 대신 한 덩어리로 이어진다.
 */
export function berm(points: { x: number; z: number }[], width: number, height: number, seed = 1, bumps: { x: number; z: number }[] = []): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(6, Math.ceil(len / 0.35));
  const across = 7;
  const pos: number[] = [];
  const idx: number[] = [];
  const noise = (t: number, k: number) => Math.sin(t * 2.3 + seed * 1.7 + k) * 0.5 + Math.sin(t * 5.1 + seed * 3.1 + k * 2) * 0.3;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z, nz = tan.x;
    const run = t * len;
    // 끝은 땅으로 잦아들고, 기둥 가까이는 도톰하게
    const end = Math.min(1, run / 0.8, (len - run) / 0.8);
    let bump = 0;
    for (const b of bumps) bump = Math.max(bump, Math.exp(-((p.x - b.x) ** 2 + (p.z - b.z) ** 2) / 0.35));
    const h = height * Math.max(0, end) * (1 + 0.25 * noise(run, 0) + 0.6 * bump);
    const w = width * (0.6 + 0.4 * Math.max(0, end)) * (1 + 0.2 * noise(run, 1) + 0.35 * bump);
    for (let j = 0; j <= across; j++) {
      const a = (j / across) * Math.PI; // 0..π: 한쪽 끝 → 꼭대기 → 반대쪽 끝
      const off = Math.cos(a) * (w / 2);
      pos.push(p.x + nx * off, Math.sin(a) * h + 0.002, p.z + nz * off);
    }
    if (i > 0) {
      const r0 = (i - 1) * (across + 1), r1 = i * (across + 1);
      for (let j = 0; j < across; j++) idx.push(r0 + j, r1 + j, r0 + j + 1, r0 + j + 1, r1 + j, r1 + j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, bermMat);
  m.userData.noCast = true;
  return m;
}
const bermMat = new THREE.MeshStandardMaterial({ color: C.drift, roughness: 1, side: THREE.DoubleSide });

/** 요정 발자국 줄(실제로 오가는 곳에만). 좌우로 번갈아 찍힌 작은 타원, 끝으로 갈수록 옅다 */
let printTex: THREE.CanvasTexture | null = null;
export function footprints(points: { x: number; z: number }[]): THREE.Mesh {
  printTex ??= (() => {
    const t = canvasTex(32, 64, (g) => {
      g.fillStyle = 'rgba(120,138,170,0.75)';
      for (const [x, y] of [[10, 14], [22, 46]] as const) {
        g.beginPath();
        g.ellipse(x, y, 4.2, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const pts = points.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const m = new THREE.Mesh(ribbon(pts, 0.42, 0.62, 0.01), new THREE.MeshBasicMaterial({ map: printTex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.userData.flat = true;
  m.renderOrder = 2;
  return m;
}

/** 집 벽 밑 눈(처마 아래 그늘 띠와 함께). 처마 밑은 얇게, 모서리 기둥 밑은 도톰하게, 문 앞은 비운다. 회전은 집과 같이 */
function cabinBase(p: Prop, scale: number): THREE.Group {
  const g = new THREE.Group();
  const w = 2.4 * scale, d = ((p.cells ?? 2) + 0.4) * scale; // 회전 전 벽 바깥 둘레
  const k = scale / KENNEY_HOUSE_SCALE; // 사람 집 1, 요정 공방 약 0.57
  // 처마 밑 그늘: 벽에서 조금 나온 띠(앞쪽은 문 안쪽 그늘과 이어져 깊이를 준다)
  const eave = 1.8 * k + 0.4;
  for (const [x, z, sw, sd, o] of [[0, d / 2 + eave / 2, w + 0.6, eave, 0.34], [0, -d / 2 - eave / 2, w + 0.6, eave, 0.28], [w / 2 + eave / 2, 0, eave, d + 0.6, 0.28], [-w / 2 - eave / 2, 0, eave, d + 0.6, 0.28]] as const) {
    const c = contactShadow(sw, sd, o);
    c.position.set(x, 0.008, z);
    g.add(c);
  }
  const fz = d / 2 + 0.25, bz = -d / 2 - 0.3, sx = w / 2 + 0.3;
  const corners = [{ x: sx, z: fz }, { x: -sx, z: fz }, { x: sx, z: bz }, { x: -sx, z: bz }];
  // 처마 밑(앞벽): 얇게, 창 아래 쪽만. 문(왼쪽 칸) 앞은 비운다
  g.add(berm([{ x: w * 0.02, z: fz }, { x: w * 0.25, z: fz + 0.05 }, { x: sx, z: fz }], 0.9 * k + 0.4, 0.22 * k + 0.08, p.x, corners));
  // 뒤·옆 벽 밑: 바람에 몰린 도톰한 눈
  g.add(berm([{ x: -sx, z: fz - 0.6 }, { x: -sx - 0.1, z: 0 }, { x: -sx, z: bz }, { x: 0, z: bz - 0.1 }, { x: sx, z: bz }, { x: sx + 0.1, z: 0 }, { x: sx, z: fz - 0.6 }], 1.5 * k + 0.5, 0.55 * k + 0.15, p.z, corners));
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotY ?? 0;
  return g;
}

/** 벤치 다리 밑 눈과 그늘(벤치 좌판 아래는 눈이 덜 쌓여 그늘진다) */
function benchBase(p: Prop): THREE.Group {
  const g = new THREE.Group();
  const c = contactShadow((p.w ?? 1.5) + 0.5, (p.d ?? 0.85) + 0.4, 0.38);
  g.add(c);
  const hw = (p.w ?? 1.5) / 2;
  g.add(berm([{ x: -hw - 0.3, z: -0.35 }, { x: 0, z: -0.45 }, { x: hw + 0.3, z: -0.35 }], 0.9, 0.22, p.x, [{ x: -hw + 0.2, z: -0.3 }, { x: hw - 0.2, z: -0.3 }]));
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotY ?? 0;
  return g;
}

// ─── 가장자리 울타리·눈둑 ───────────────────────────────────────────────

const roundedCache = new Map<string, THREE.BufferGeometry>();
export function roundedBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w}|${h}|${d}`;
  let g = roundedCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.45);
    roundedCache.set(k, g);
  }
  return g;
}

/** 낮은 울타리(Tiny Treats, 없으면 기본 도형) + 가로대 위 둥근 눈 + 바깥 눈둑. 바닥 단면을 가린다 */
export function edgeFence(
  models: Models,
  from: { x: number; z: number },
  to: { x: number; z: number },
  scale = FENCE_SCALE,
  /** 울타리 바깥 방향(눈둑이 도톰하게 쌓이는 쪽). 없으면 광장 가운데에서 먼 쪽 */
  outward?: { x: number; z: number },
): THREE.Group {
  const g = new THREE.Group();
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  const yaw = -Math.atan2(dz, dx); // 울타리 조각의 +x를 진행 방향으로
  const SCALE = scale; // 사람 울타리: 무릎~허리 높이(요정 키 × 1.6). 길가 울타리는 요정 키 높이
  const piece = 2.5 * SCALE;
  const n = Math.floor(len / piece);
  const snowMat = new THREE.MeshStandardMaterial({ color: C.drift, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.9 });
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * piece;
    const x = from.x + (dx / len) * t, z = from.z + (dz / len) * t;
    let f = models.clone('ttFence');
    if (f) f.scale.setScalar(SCALE);
    else {
      // 모델이 없을 때: 가로대 둘 + 기둥 둘(position은 읽기 전용이라 set으로)
      const fb = new THREE.Group();
      for (const y of [0.32, 0.6]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(piece, 0.12, 0.08), wood);
        rail.position.set(0, y * (TOWN.fence / 0.77), 0);
        fb.add(rail);
      }
      for (const px of [-piece / 2 + 0.1, piece / 2 - 0.1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, TOWN.fence, 0.14), wood);
        post.position.set(px, TOWN.fence / 2, 0);
        fb.add(post);
      }
      f = fb;
    }
    // 조각 하나 = 울타리 + 위에 얹힌 눈(같이 흐려지도록 한 묶음)
    const pg = new THREE.Group();
    pg.add(f);
    const cap = new THREE.Mesh(roundedBox(piece * 0.96, 0.14, 0.3), snowMat);
    cap.position.y = TOWN.fence + 0.03;
    pg.add(cap);
    pg.position.set(x, 0, z);
    pg.rotation.y = yaw;
    pg.traverse((o) => (o.userData.noCast = true)); // 낮은 울타리 그림자는 빼서 그림자 지도 부담을 줄인다
    pg.userData.fadeable = true; // 앞쪽 울타리가 요정을 가리면 잠시 흐리게
    g.add(pg);
  }
  // 바깥(광장 밖) 눈둑: 울타리 아랫단을 덮고 그 너머 땅을 가린다
  const out = new THREE.Vector3(-dz / len, 0, dx / len);
  const center = new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
  if (outward) {
    if (out.x * outward.x + out.z * outward.z < 0) out.negate();
  } else if (Math.abs(center.x + out.x) < Math.abs(center.x) || Math.abs(center.z + out.z) < Math.abs(center.z)) out.negate();
  // 한 덩어리로 낮고 길게 이어지는 눈둑: 바깥쪽은 도톰하게(땅을 가린다), 안쪽은 얇게. 기둥 밑은 더 도톰하게
  const along = (t: number, o: number) => ({ x: from.x + (dx / len) * t + out.x * o, z: from.z + (dz / len) * t + out.z * o });
  const steps = Math.max(2, Math.ceil(len / 3));
  const outer = Array.from({ length: steps + 1 }, (_, i) => along((i / steps) * len, 0.9 + 0.25 * Math.sin(i * 1.7)));
  const inner = Array.from({ length: steps + 1 }, (_, i) => along((i / steps) * len, -0.15));
  const posts = Array.from({ length: n + 1 }, (_, i) => along(i * piece, 0));
  const k = SCALE / FENCE_SCALE;
  g.add(berm(outer, 2.4 * k + 0.4, 0.5 * k + 0.1, from.x + from.z));
  g.add(berm(inner, 0.7 * k + 0.2, 0.16 * k + 0.05, from.x - from.z, posts));
  return g;
}

// ─── 골목(두 집 사이)과 우편함 ─────────────────────────────────────────

/** 지붕 두 면을 따라 얹은 둥근 눈(Tiny Treats 집: 용마루가 앞뒤(z) 방향, 모델 단위) */
function roofSnow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: C.drift, roughness: 1 });
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(roundedBox(3.3, 0.34, 6.6), mat);
    slab.position.set(s * 1.55, 4.42, 1.0);
    slab.rotation.z = s * -0.56;
    g.add(slab);
  }
  return g;
}

export function alleyHouse(models: Models, h: { x: number; z: number; rotY: number; scale: number }): THREE.Object3D {
  const g = new THREE.Group();
  const house = models.clone('ttHouse');
  if (house) {
    house.add(roofSnow());
    house.scale.setScalar(h.scale);
    g.add(house);
    // 배경 집의 창빛은 약하게: 문 옆 벽등 아래 작은 빛 웅덩이
    const pool = warmPool(2.2);
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.6;
    pool.position.set(0.8 * h.scale, 0.005, 4.6 * h.scale);
    g.add(pool);
  } else {
    // 모델이 없을 때: 벽 + 박공지붕 + 눈
    const k = h.scale; // 모델 단위 → 게임 단위(Tiny Treats 집: 폭 5.9 · 벽 약 3.4 · 지붕 끝 5.6)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5.6 * k, 3.4 * k, 6 * k), new THREE.MeshStandardMaterial({ color: '#9aa7c4' }));
    wall.position.y = 1.7 * k;
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), new THREE.MeshStandardMaterial({ color: '#d9e2f0' }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(6.6 * k, 2.2 * k, 7 * k);
    roof.position.y = 4.5 * k;
    g.add(roof);
  }
  const shade = contactShadow(7.2 * h.scale, 8.2 * h.scale, 0.3);
  shade.position.z = 1 * h.scale;
  g.add(shade);
  g.position.set(h.x, 0, h.z);
  g.rotation.y = h.rotY;
  g.userData.fadeable = true; // 사람 크기 집: 요정을 가리면 잠시 흐리게
  return g;
}

/** 우편함 + 물고기 깃발(유나네 표식의 물고기와 같은 파랑). 골목 입구에서 실루엣으로 보인다 */
function fishMailbox(models: Models): THREE.Object3D {
  const g = new THREE.Group();
  const mb = models.clone('ttMailbox');
  if (mb) {
    mb.scale.setScalar(MAILBOX_SCALE);
    g.add(mb);
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, TOWN.mailbox * 0.7, 0.2), new THREE.MeshStandardMaterial({ color: '#8a5a3a' }));
    post.position.y = TOWN.mailbox * 0.35;
    g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 1.1), new THREE.MeshStandardMaterial({ color: '#e0b33c' }));
    box.position.set(0, TOWN.mailbox * 0.78, 0.5);
    g.add(box);
  }
  const blue = new THREE.MeshStandardMaterial({ color: '#4a9be8', roughness: 0.6 });
  const k = MAILBOX_SCALE / 0.75; // 예전(요정 크기) 우편함 대비
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22 * k, 16, 10), blue);
  body.scale.set(1.5, 1, 0.5);
  body.position.set(0, 1.95 * k, 0.35 * k);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3), blue);
  tail.rotation.z = Math.PI / 2;
  tail.scale.setScalar(k);
  tail.position.set(0.42 * k, 1.95 * k, 0.35 * k);
  g.add(tail);
  const cap = new THREE.Mesh(roundedBox(0.5 * k, 0.08 * k, 0.72 * k), driftMat);
  cap.position.set(0, 1.66 * k, 0.38 * k);
  g.add(cap);
  g.add(contactShadow(0.9 * k, 1.2 * k, 0.35));
  const p = PLAZA_DRESSING.mailbox;
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotY;
  return g;
}

/** 오른쪽 아래 집 현관 바닥: 높이 0 그대로(요정이 서고 선물을 놓는 곳). 사람용 발판 매트 + 문 앞 살구빛 */
function porch(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5), new THREE.MeshStandardMaterial({ color: '#8c4a3a', roughness: 1 }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.012, 0.95);
  mat.userData.flat = true;
  g.add(mat);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.18), new THREE.MeshStandardMaterial({ color: '#d9b35a', roughness: 1 }));
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.014, 0.95);
  stripe.userData.flat = true;
  g.add(stripe);
  const glow = warmPool(2.6);
  glow.position.set(0, 0.006, 1.6);
  g.add(glow);
  g.position.set(PLAZA_DRESSING.porch.x, 0, PLAZA_DRESSING.porch.z);
  g.rotation.y = PLAZA_DRESSING.porch.rotY; // 앞(+z) = 집 앞면 방향
  return g;
}

// ─── 먼 마을 ──────────────────────────────────────────────────────────

/** 화면 위쪽(광장 너머)으로 겹겹이 이어지는 지붕 실루엣 세 줄. 창은 아주 약한 살구색 점 */
function farTown(): THREE.Group {
  const g = new THREE.Group();
  const rows: { line: (t: number) => { x: number; z: number }; n: number; shade: number }[] = [
    // 북쪽(-z) 줄: 골목 집 뒤
    { line: (t) => ({ x: -50 + t * 90, z: -46 }), n: 9, shade: 0 },
    { line: (t) => ({ x: -60 + t * 100, z: -60 }), n: 10, shade: 1 },
    // 서쪽(-x) 줄
    { line: (t) => ({ x: -44, z: -40 + t * 60 }), n: 6, shade: 0 },
    { line: (t) => ({ x: -58, z: -50 + t * 76 }), n: 8, shade: 1 },
  ];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wallMats = [new THREE.MeshStandardMaterial({ color: '#7f8db0', roughness: 1 }), new THREE.MeshStandardMaterial({ color: '#9aa6c4', roughness: 1 })];
  const roofMat = new THREE.MeshStandardMaterial({ color: C.farRoof, roughness: 1 });
  const win = new THREE.MeshBasicMaterial({ color: '#ffc68a', transparent: true, opacity: 0.55 });
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      const p = r.line((i + rnd() * 0.4) / r.n);
      // 사람 집 크기(벽 약 6, 폭 약 10)
      const w = 8 + rnd() * 5, d = 9 + rnd() * 4, h = 5.5 + rnd() * 3 + r.shade * 2;
      const house = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[r.shade]!);
      wall.position.y = h / 2;
      house.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w + 1, 3 + rnd() * 3, d + 1);
      roof.position.y = h + roof.scale.y / 2;
      house.add(roof);
      if (rnd() < 0.55) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), win);
        pane.position.set((rnd() - 0.5) * w * 0.5, h * 0.55, d / 2 + 0.02);
        house.add(pane);
      }
      house.position.set(p.x, 0, p.z);
      house.rotation.y = (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.3;
      g.add(house);
    }
  }
  return g;
}

// ─── 모두 ────────────────────────────────────────────────────────────

export function createPlazaDressing(models: Models, base: string, detail: Detail): THREE.Group {
  const root = new THREE.Group();
  root.name = 'plazaDressing';
  root.add(packedPath(base, detail));
  root.add(packedPath(base, detail, PLAZA_DRESSING.porchPath));
  for (const f of PLAZA_DRESSING.footprints) root.add(footprints(f));
  const sleigh = PLAZA_PROPS.find((p) => p.kind === 'sleigh');
  if (sleigh) root.add(sleighTrail(sleigh));
  for (const p of PLAZA_PROPS) {
    if (p.kind === 'cabin') root.add(cabinBase(p, KENNEY_HOUSE_SCALE));
    if (p.kind === 'workshop') root.add(cabinBase(p, WORKSHOP.scale));
    if (p.kind === 'workbench' || p.kind === 'shed') {
      // 작업대·창고 밑 그늘(깊이)
      const c = contactShadow((p.w ?? 2) + 0.6, (p.d ?? 1) + 0.6, 0.42);
      c.position.set(p.x, 0.009, p.z);
      root.add(c);
    }
    if (p.kind === 'bench') root.add(benchBase(p));
    if (p.kind === 'lamp') {
      const c = contactShadow(0.7, 0.7, 0.35);
      c.position.set(p.x, 0.008, p.z);
      root.add(c);
    }
    if (p.kind === 'clockTower') {
      const h = (p.w ?? 5.6) / 2 + 0.3;
      root.add(berm([{ x: p.x - h, z: p.z + h }, { x: p.x + h, z: p.z + h }], 1.4, 0.45, 3));
    }
  }
  for (const f of PLAZA_DRESSING.fences) root.add(edgeFence(models, f.from, f.to));
  // 길 북쪽 윤곽: 요정 키 높이 울타리(Tiny Treats 울타리 배율 1)
  for (const f of PLAZA_DRESSING.laneFences) root.add(edgeFence(models, f.from, f.to, 1.0));
  for (const h of PLAZA_DRESSING.alleyHouses) root.add(alleyHouse(models, h));
  root.add(fishMailbox(models));
  root.add(porch());
  const town = farTown();
  town.traverse((o) => (o.userData.noCast = true)); // 그림자 범위 밖
  root.add(town);
  return root;
}
