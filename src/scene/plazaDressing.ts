// 광장 꾸밈(판정 없음): 그래픽 개선 지시서(LAST_GIFT_GRAPHICS_PROMPT.md)와 연출 가이드 §4·§6.
//   다진 눈길 · 썰매 날 자국 · 쌓인 눈(벽 밑·벤치 다리·울타리) · 물체가 바닥에 닿는 그늘 · 가장자리 울타리와 눈둑
//   · 썰매 뒤 두 집 사이 골목(우편함) · 화면 밖으로 이어지는 마을 지붕 실루엣.
// 외부 재료(모두 CC0, ASSET_LICENSES.md):
//   Poly Haven Snow 02 · Cobblestone Floor 001(512 px로 줄이고 대비를 낮춤), Tiny Treats Homely House(집·울타리·우편함).
// 텍스처나 모델을 못 불러와도 색과 기본 도형으로 길·골목이 보인다. 저사양(detail: 'low')은 눈결·노멀맵을 뺀다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PLAZA_DRESSING, PLAZA_PROPS, type Prop } from '../data/plaza';
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
function contactShadow(w: number, d: number, opacity = 0.32): THREE.Mesh {
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

function packedPath(base: string, detail: Detail): THREE.Mesh {
  const pts = PLAZA_DRESSING.path.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, depthWrite: false, roughness: 0.9, map: packedPathTexture(null), side: THREE.DoubleSide });
  const m = new THREE.Mesh(ribbon(pts, PLAZA_DRESSING.path.width, 8.8, 0.006), mat);
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
/** 낮고 둥글게 쌓인 눈 더미(길이 len, 폭 depth, 높이 h) */
function drift(len: number, depth: number, h: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), driftMat);
  m.scale.set(len / 2, h, depth / 2);
  m.userData.noCast = true; // 낮은 눈 더미는 그림자 지도에 그리지 않는다(저사양 부담)
  return m;
}

/** 통나무집 벽 밑 눈(처마 아래 그늘 띠와 함께). 회전은 집과 같이 */
function cabinBase(p: Prop): THREE.Group {
  const g = new THREE.Group();
  const w = 4.4, d = (p.cells ?? 3) * 2 + 0.4; // 회전 전 가로·깊이
  // 처마 밑 그늘: 벽에서 조금 나온 띠
  for (const [x, z, sw, sd] of [[0, d / 2 + 0.35, w + 0.6, 0.8], [0, -d / 2 - 0.35, w + 0.6, 0.8], [w / 2 + 0.35, 0, 0.8, d + 0.6], [-w / 2 - 0.35, 0, 0.8, d + 0.6]] as const) {
    const c = contactShadow(sw, sd, 0.3);
    c.position.set(x, 0.008, z);
    g.add(c);
  }
  // 벽 밑에 두툼하게 남은 눈(현관 앞 문 자리는 비운다)
  const front = d / 2 + 0.15;
  const parts: [number, number, number, number, number][] = [
    [1.15, front, 2.0, 0.7, 0.32], // 앞벽 오른쪽(창 밑)
    [0, -d / 2 - 0.15, w, 0.7, 0.38],
    [w / 2 + 0.15, 0, 0.7, d, 0.36],
    [-w / 2 - 0.15, 0, 0.7, d, 0.36],
  ];
  for (const [x, z, sx, sz, h] of parts) {
    const m = drift(Math.max(sx, sz), Math.min(sx, sz), h);
    if (sz > sx) m.rotation.y = Math.PI / 2;
    m.position.set(x, 0, z);
    g.add(m);
  }
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotY ?? 0;
  return g;
}

/** 벤치 다리 밑 눈과 그늘(벤치 좌판 아래는 눈이 덜 쌓여 그늘진다) */
function benchBase(p: Prop): THREE.Group {
  const g = new THREE.Group();
  const c = contactShadow((p.w ?? 1.5) + 0.3, (p.d ?? 0.85) + 0.2, 0.38);
  g.add(c);
  for (const s of [-1, 1]) {
    const m = drift(0.7, 0.55, 0.16);
    m.position.set((s * (p.w ?? 1.5)) / 2, 0, 0.1);
    g.add(m);
  }
  g.position.set(p.x, 0, p.z);
  return g;
}

// ─── 가장자리 울타리·눈둑 ───────────────────────────────────────────────

const roundedCache = new Map<string, THREE.BufferGeometry>();
function roundedBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w}|${h}|${d}`;
  let g = roundedCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.45);
    roundedCache.set(k, g);
  }
  return g;
}

/** 낮은 울타리(Tiny Treats, 없으면 기본 도형) + 가로대 위 둥근 눈 + 바깥 눈둑. 바닥 단면을 가린다 */
function edgeFence(models: Models, from: { x: number; z: number }, to: { x: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  const yaw = -Math.atan2(dz, dx); // 울타리 조각의 +x를 진행 방향으로
  const SCALE = 0.6; // 조각 2.5 m → 1.5 m, 높이 0.77 m(요정 허리)
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
      f = new THREE.Group();
      for (const y of [0.32, 0.6]) (f as THREE.Group).add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(piece, 0.08, 0.06), wood), { position: new THREE.Vector3(0, y, 0) }));
      for (const px of [-piece / 2 + 0.1, piece / 2 - 0.1]) (f as THREE.Group).add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.77, 0.1), wood), { position: new THREE.Vector3(px, 0.38, 0) }));
    }
    f.position.set(x, 0, z);
    f.rotation.y = yaw;
    f.traverse((o) => (o.userData.noCast = true)); // 낮은 울타리 그림자는 빼서 그림자 지도 부담을 줄인다
    g.add(f);
    // 가로대·기둥 위에 얹힌 눈
    const cap = new THREE.Mesh(roundedBox(piece * 0.96, 0.1, 0.2), snowMat);
    cap.userData.noCast = true;
    cap.position.set(x, 0.8, z);
    cap.rotation.y = yaw;
    g.add(cap);
  }
  // 바깥(광장 밖) 눈둑: 울타리 아랫단을 덮고 그 너머 땅을 가린다
  const out = new THREE.Vector3(-dz / len, 0, dx / len);
  const center = new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
  if (Math.abs(center.x + out.x) < Math.abs(center.x) || Math.abs(center.z + out.z) < Math.abs(center.z)) out.negate();
  for (let i = 0; i < Math.ceil(len / 3.2); i++) {
    const t = (i + 0.5) * (len / Math.ceil(len / 3.2));
    const m = drift(4.2, 1.4, 0.34 + ((i * 37) % 5) * 0.03);
    m.position.set(from.x + (dx / len) * t + out.x * 0.75, 0, from.z + (dz / len) * t + out.z * 0.75);
    m.rotation.y = yaw;
    g.add(m);
    const inner = drift(3.6, 0.7, 0.2);
    inner.position.set(from.x + (dx / len) * t - out.x * 0.35, 0, from.z + (dz / len) * t - out.z * 0.35);
    inner.rotation.y = yaw;
    g.add(inner);
  }
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

function alleyHouse(models: Models, h: { x: number; z: number; rotY: number; scale: number }): THREE.Object3D {
  const g = new THREE.Group();
  const house = models.clone('ttHouse');
  if (house) {
    house.add(roofSnow());
    house.scale.setScalar(h.scale);
    g.add(house);
    // 배경 집의 창빛은 약하게: 문 옆 벽등 아래 작은 빛 웅덩이
    const pool = warmPool(1.1);
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.6;
    pool.position.set(0.3 * h.scale * 2, 0.005, 4.0 * h.scale);
    g.add(pool);
  } else {
    // 모델이 없을 때: 벽 + 박공지붕 + 눈
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 4), new THREE.MeshStandardMaterial({ color: '#9aa7c4' }));
    wall.position.y = 1.2;
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), new THREE.MeshStandardMaterial({ color: '#d9e2f0' }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(4.4, 1.6 * (h.scale / 0.64), 4.8);
    roof.position.y = 3.2;
    g.add(roof);
  }
  const shade = contactShadow(4.6 * (h.scale / 0.64), 5.2 * (h.scale / 0.64), 0.3);
  g.add(shade);
  g.position.set(h.x, 0, h.z);
  g.rotation.y = h.rotY;
  return g;
}

/** 우편함 + 물고기 깃발(유나네 표식의 물고기와 같은 파랑). 골목 입구에서 실루엣으로 보인다 */
function fishMailbox(models: Models): THREE.Object3D {
  const g = new THREE.Group();
  const mb = models.clone('ttMailbox');
  if (mb) {
    mb.scale.setScalar(0.75);
    g.add(mb);
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), new THREE.MeshStandardMaterial({ color: '#8a5a3a' }));
    post.position.y = 0.7;
    g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: '#e0b33c' }));
    box.position.set(0, 1.35, 0.3);
    g.add(box);
  }
  const blue = new THREE.MeshStandardMaterial({ color: '#4a9be8', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), blue);
  body.scale.set(1.5, 1, 0.5);
  body.position.set(0, 1.95, 0.35);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3), blue);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(0.42, 1.95, 0.35);
  g.add(tail);
  const cap = new THREE.Mesh(roundedBox(0.5, 0.08, 0.72), driftMat);
  cap.position.set(0, 1.66, 0.38);
  g.add(cap);
  g.add(contactShadow(0.9, 1.2, 0.35));
  const p = PLAZA_DRESSING.mailbox;
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotY;
  return g;
}

/** 현관 계단(오른쪽 집): 나무 계단 두 단 + 계단에 흐릿하게 번진 살구빛 */
function porch(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#7d5233', roughness: 0.9 });
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.5), wood);
  s1.position.set(0, 0.08, 0.55);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.4), wood);
  s2.position.set(0, 0.15, 0.15);
  g.add(s1, s2);
  const snow = new THREE.Mesh(roundedBox(0.4, 0.08, 0.45), driftMat);
  snow.position.set(0.62, 0.2, 0.55);
  g.add(snow);
  const glow = warmPool(1.0);
  glow.position.set(0, 0.32, 0.5);
  g.add(glow);
  const glow2 = warmPool(1.5);
  glow2.position.set(0, 0.006, 1.4);
  g.add(glow2);
  g.position.set(PLAZA_DRESSING.porch.x, 0, PLAZA_DRESSING.porch.z);
  return g;
}

// ─── 먼 마을 ──────────────────────────────────────────────────────────

/** 화면 위쪽(광장 너머)으로 겹겹이 이어지는 지붕 실루엣 세 줄. 창은 아주 약한 살구색 점 */
function farTown(): THREE.Group {
  const g = new THREE.Group();
  const rows: { line: (t: number) => { x: number; z: number }; n: number; shade: number }[] = [
    // 북쪽(-z) 줄: 골목 집 뒤
    { line: (t) => ({ x: -36 + t * 60, z: -25 }), n: 13, shade: 0 },
    { line: (t) => ({ x: -40 + t * 62, z: -31 }), n: 14, shade: 1 },
    // 서쪽(-x) 줄
    { line: (t) => ({ x: -27, z: -22 + t * 40 }), n: 9, shade: 0 },
    { line: (t) => ({ x: -33, z: -28 + t * 50 }), n: 11, shade: 1 },
  ];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wallMats = [new THREE.MeshStandardMaterial({ color: '#7f8db0', roughness: 1 }), new THREE.MeshStandardMaterial({ color: '#9aa6c4', roughness: 1 })];
  const roofMat = new THREE.MeshStandardMaterial({ color: C.farRoof, roughness: 1 });
  const win = new THREE.MeshBasicMaterial({ color: '#ffc68a', transparent: true, opacity: 0.55 });
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      const p = r.line((i + rnd() * 0.4) / r.n);
      const w = 3 + rnd() * 2.4, d = 3.5 + rnd() * 2, h = 2.4 + rnd() * 2.2 + r.shade * 1.2;
      const house = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[r.shade]!);
      wall.position.y = h / 2;
      house.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w + 0.5, 1.2 + rnd() * 1.4, d + 0.5);
      roof.position.y = h + roof.scale.y / 2;
      house.add(roof);
      if (rnd() < 0.55) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), win);
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
  const sleigh = PLAZA_PROPS.find((p) => p.kind === 'sleigh');
  if (sleigh) root.add(sleighTrail(sleigh));
  for (const p of PLAZA_PROPS) {
    if (p.kind === 'cabin') root.add(cabinBase(p));
    if (p.kind === 'bench') root.add(benchBase(p));
    if (p.kind === 'lamp') {
      const c = contactShadow(0.7, 0.7, 0.35);
      c.position.set(p.x, 0.008, p.z);
      root.add(c);
    }
    if (p.kind === 'clockTower') {
      for (const s of [-1, 1]) {
        const m = drift(2.8, 0.8, 0.4);
        m.position.set(p.x, 0, p.z + s * 1.45);
        root.add(m);
      }
    }
  }
  for (const f of PLAZA_DRESSING.fences) root.add(edgeFence(models, f.from, f.to));
  for (const h of PLAZA_DRESSING.alleyHouses) root.add(alleyHouse(models, h));
  root.add(fishMailbox(models));
  root.add(porch());
  const town = farTown();
  town.traverse((o) => (o.userData.noCast = true)); // 그림자 범위 밖
  root.add(town);
  return root;
}
