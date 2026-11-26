// 장면 뒤 배경(놀이 판정과 무관): 별·달이 있는 밤하늘, 먼 눈 언덕, 놀이 공간을 둘러싼 눈 덮인 숲, 불 켜진 이웃집들,
// 지평선까지 이어지는 눈밭과 옅은 안개. 사진기가 비스듬히 내려다보므로 사진기 쪽(길 아래쪽)은 넉넉히 비워 키 큰 나무가
// 놀이 공간을 가리지 않게 한다. 나무는 InstancedMesh 둘(잎·눈)로 그려 가볍게.
import * as THREE from 'three';
import type { Models } from './models';
import { alleyHouse } from './plazaDressing';
import { HOUSE_SCALE } from '../data/chapter1';

export interface BackdropOptions {
  /** 배경 가운데(월드) */
  center: { x: number; z: number };
  /** 이 자리에는 나무·집을 두지 않는다(놀이 공간 + 사진기 쪽 여유) */
  keepOut(p: { x: number; z: number }): boolean;
  /** 숲 안쪽·바깥쪽 반지름(가운데에서) */
  forest?: [number, number];
  /** 나무 수 */
  trees?: number;
  /** 이웃집 수 */
  houses?: number;
  seed?: number;
}

const SNOW = '#eef2f8';

function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function sky(): THREE.Group {
  const g = new THREE.Group();
  const R = 240;
  const geo = new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const top = new THREE.Color('#0d1836');
  const horizon = new THREE.Color('#5e7099');
  const col: number[] = [];
  const p = geo.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / R;
    const c = horizon.clone().lerp(top, Math.min(1, Math.max(0, y * 1.7)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -10;
  dome.position.y = -20;
  g.add(dome);
  const r = rng(11);
  const pos: number[] = [];
  for (let i = 0; i < 320; i++) {
    const a = r() * Math.PI * 2;
    const e = 0.18 + r() * 1.2;
    pos.push(Math.cos(a) * Math.cos(e) * (R - 10), Math.sin(e) * (R - 10) - 20, Math.sin(a) * Math.cos(e) * (R - 10));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff7d6', size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
  stars.renderOrder = -9;
  g.add(stars);
  // 달: 화면 위쪽(길 앞쪽 = 북서) 하늘
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#fff4d2', fog: false, depthWrite: false }));
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const gg = c.getContext('2d')!;
    const grd = gg.createRadialGradient(64, 64, 10, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,240,200,0.55)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, fog: false, transparent: true }));
  glow.scale.setScalar(60);
  const az = -Math.PI * 0.58; // 화면 위쪽에서 조금 왼쪽(집·트리 뒤에 가리지 않게)
  const el = 0.5;
  const mp = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(R - 20);
  moon.position.copy(mp);
  moon.lookAt(0, 0, 0);
  glow.position.copy(mp).multiplyScalar(0.99);
  moon.renderOrder = glow.renderOrder = -8;
  g.add(glow, moon);
  g.name = 'sky';
  return g;
}

/** 눈 덮인 전나무 둘(잎 원뿔·눈 원뿔)을 한 번에 */
function forest(o: BackdropOptions): THREE.Group {
  const g = new THREE.Group();
  const [r0, r1] = o.forest ?? [40, 95];
  const n = o.trees ?? 320;
  const r = rng(o.seed ?? 3);
  const spots: { x: number; z: number; h: number }[] = [];
  for (let tries = 0; spots.length < n && tries < n * 12; tries++) {
    const a = r() * Math.PI * 2;
    const d = r0 + Math.sqrt(r()) * (r1 - r0);
    const p = { x: o.center.x + Math.cos(a) * d, z: o.center.z + Math.sin(a) * d };
    if (o.keepOut(p)) continue;
    spots.push({ ...p, h: 5 + r() * 6 + (d - r0) * 0.04 });
  }
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color: '#2f5a44', roughness: 1, flatShading: true }), spots.length);
  const snow = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1 }), spots.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: '#5a3e2a', roughness: 1 }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((s, i) => {
    const w = s.h * 0.34;
    m.compose(new THREE.Vector3(s.x, s.h * 0.15 + s.h * 0.85 * 0.5, s.z), q, new THREE.Vector3(w, s.h * 0.85, w));
    leaf.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, s.h * 0.15 + s.h * 0.85 * 0.78, s.z), q, new THREE.Vector3(w * 0.5, s.h * 0.4, w * 0.5));
    snow.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, s.h * 0.08, s.z), q, new THREE.Vector3(0.25, s.h * 0.16, 0.25));
    trunk.setMatrixAt(i, m);
  });
  for (const im of [leaf, snow, trunk]) {
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    g.add(im);
  }
  return g;
}

/**
 * 지평선을 둘러싼 띠 모양 지형(이음매 없음): 각도마다 높이가 다른 능선.
 * ridge: 봉우리 날카로움(0 둥근 언덕 ~ 1 뾰족한 산), snowLine: 이 높이 비율 위는 눈, 아래는 바위·숲 색
 */
function ring(center: { x: number; z: number }, o: { r: number; depth: number; base: number; amp: number; ridge: number; seed: number; rock: string; snow: string; snowLine: number }): THREE.Mesh {
  const r = rng(o.seed);
  // 여러 겹의 사인 + 접은 사인(능선)으로 자연스러운 높낮이
  const waves = Array.from({ length: 7 }, (_, i) => ({ f: 2 + i * 2.3 + r() * 2, a: 1 / (1 + i * 0.9), p: r() * Math.PI * 2 }));
  const height = (ang: number) => {
    let h = 0;
    for (const w of waves) {
      const v = Math.sin(ang * w.f + w.p);
      h += w.a * ((1 - o.ridge) * (v * 0.5 + 0.5) + o.ridge * (1 - Math.abs(v)));
    }
    return o.base + o.amp * Math.pow(h / 2.6, 1.4);
  };
  const N = 220;
  const rows = 4; // 앞 가장자리(낮음) → 능선 → 뒤
  const pos: number[] = [];
  const col: number[] = [];
  const rock = new THREE.Color(o.rock), snow = new THREE.Color(o.snow);
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const top = height(ang);
    for (let j = 0; j <= rows; j++) {
      const k = j / rows;
      // 단면: 앞에서 완만히 오르다 능선(k≈0.6)에서 꼭대기, 뒤로 낮아진다
      const prof = k < 0.6 ? Math.sin((k / 0.6) * Math.PI * 0.5) : 1 - ((k - 0.6) / 0.4) * 0.35;
      const jitter = (r() - 0.5) * o.amp * 0.08 * (j > 0 && j < rows ? 1 : 0);
      const y = j === 0 ? -1 : top * prof + jitter;
      const rr = o.r + k * o.depth;
      pos.push(center.x + Math.cos(ang) * rr, y, center.z + Math.sin(ang) * rr);
      const c = y > top * o.snowLine ? snow : rock.clone().lerp(snow, Math.max(0, y / (top * o.snowLine)) * 0.35);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = a + rows + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const nonIndexed = geo.toNonIndexed(); // 낮은 다각형 면이 보이게(면마다 따로 그늘)
  nonIndexed.computeVertexNormals();
  return new THREE.Mesh(nonIndexed, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
}

/** 먼 산맥(눈 덮인 봉우리) + 그 앞 낮고 굴곡진 눈 언덕 */
function hills(center: { x: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  g.add(ring(center, { r: 175, depth: 40, base: 22, amp: 82, ridge: 0.75, seed: 21, rock: '#6b7a99', snow: '#f2f5fb', snowLine: 0.55 }));
  g.add(ring(center, { r: 118, depth: 30, base: 5, amp: 22, ridge: 0.15, seed: 8, rock: '#a7b6cc', snow: '#eef2f8', snowLine: 0.3 }));
  return g;
}

/** 불 켜진 이웃집(창빛) */
function neighbours(models: Models, o: BackdropOptions): THREE.Group {
  const g = new THREE.Group();
  const n = o.houses ?? 6;
  const [r0, r1] = o.forest ?? [40, 95];
  const r = rng((o.seed ?? 3) + 17);
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
  let placed = 0;
  for (let tries = 0; placed < n && tries < 400; tries++) {
    const a = r() * Math.PI * 2;
    const d = r0 * 0.75 + r() * (r1 - r0) * 0.35;
    const p = { x: o.center.x + Math.cos(a) * d, z: o.center.z + Math.sin(a) * d };
    if (o.keepOut(p)) continue;
    // 집이 가운데를 보게
    const rot = Math.atan2(o.center.x - p.x, o.center.z - p.z);
    const h = alleyHouse(models, { x: p.x, z: p.z, rotY: rot, scale: HOUSE_SCALE * (0.9 + r() * 0.3) });
    h.userData.fadeable = false;
    // 앞면 창 두 개에 따뜻한 불빛
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), winMat);
      w.position.set(sx * 1.9, 2.4, 3.05 * HOUSE_SCALE + 0.02);
      h.add(w);
    }
    g.add(h);
    placed++;
  }
  return g;
}

export function createBackdrop(models: Models, o: BackdropOptions): THREE.Group {
  const g = new THREE.Group();
  g.name = 'backdrop';
  const s = sky();
  s.position.set(o.center.x, 0, o.center.z);
  g.add(s);
  // 지평선까지 눈밭(장면 바닥보다 살짝 아래)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ color: SNOW, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(o.center.x, -0.03, o.center.z);
  ground.userData.flat = true;
  g.add(ground);
  g.add(hills(o.center));
  g.add(forest(o));
  g.add(neighbours(models, o));
  return g;
}

/** 먼 곳을 하늘빛으로 옅게(놀이 사진기는 60 m 떨어져 있어 놀이 공간에는 닿지 않는다) */
export function addHaze(scene: THREE.Scene): void {
  scene.fog = new THREE.Fog('#5a6a93', 110, 340);
}
