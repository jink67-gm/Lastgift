// 광장 가운데 큰 마을 트리(직접 만든 모형). 높이 약 9.6(요정 키의 약 7배), 맨 아래 가지 반지름 약 2.3.
// 원판을 쌓은 느낌을 없애려고: 층마다 가지 끝이 들쭉날쭉 처지고, 층 윗면에 눈이 얹히고,
// 나선으로 감긴 전구 줄·장식 공·꼭대기 별을 단다. 전구·공은 한 번에 그리는 묶음(InstancedMesh).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const VILLAGE_TREE = { height: 9.6, baseR: 2.3 } as const; // 가지 끝·장식 공이 화단 판정(반지름 3.2) 안에 들게

/** 고른 난수(같은 모양이 나오게) */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 가지 층 하나: 위는 뾰족, 아래 가장자리는 가지 끝이 번갈아 처지고 튀어나온다 */
function tierGeometry(r: number, h: number, tips: number, rand: () => number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(r, h, tips * 2, 3, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * tips * 2);
    const tip = k % 2 === 0; // 가지 끝 / 사이 골
    const edge = (h / 2 - v.y) / h; // 0 = 꼭대기, 1 = 아래 가장자리
    if (edge > 0.3) {
      const w = (edge - 0.3) / 0.7;
      const out = tip ? 1 + 0.1 * w + rand() * 0.05 * w : 1 - 0.12 * w;
      v.x *= out;
      v.z *= out;
      if (edge > 0.99) v.y -= tip ? h * (0.1 + rand() * 0.06) : -h * 0.06; // 가지 끝이 처진다
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 층 윗면에 얹힌 눈: 꼭대기부터 가장자리 조금 위까지, 가장자리는 물결 */
function snowGeometry(r: number, h: number, tips: number): THREE.BufferGeometry {
  const hs = h * 0.62;
  const rs = r * 0.68;
  const geo = new THREE.ConeGeometry(rs, hs, tips * 2, 1, true);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < 0) {
      const a = Math.atan2(z, x);
      const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * tips * 2);
      pos.setY(i, y - (k % 2 === 0 ? hs * 0.14 : 0));
    }
  }
  geo.translate(0, h / 2 - hs / 2 + 0.03, 0);
  geo.scale(1.05, 1, 1.05);
  geo.computeVertexNormals();
  return geo;
}

/** 꼭대기 별(다섯 뿔, 두께 있게) */
function starGeometry(r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: r * 0.22, bevelEnabled: true, bevelThickness: r * 0.1, bevelSize: r * 0.08, bevelSegments: 2 });
  geo.center();
  return geo;
}

export function createVillageTree(opts: { lights?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'villageTree';
  const rand = rng(20261127);

  // 줄기(아래 가지 밑으로 조금 보인다)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.3, 10), new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.9 }));
  trunk.position.y = 0.65;
  g.add(trunk);

  // 가지 층: 아래에서 위로 작아지며 겹친다
  const greens = ['#24583a', '#286041', '#2d6a47', '#2a6443', '#2f6f4a', '#33774f', '#367d53'];
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f4f8fd', roughness: 1 });
  const tiers: { y: number; r: number; h: number }[] = [];
  const n = 7;
  let y = 1.05;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const r = VILLAGE_TREE.baseR * (1 - u * 0.78);
    const h = 2.3 - u * 0.95;
    tiers.push({ y: y + h / 2, r, h });
    y += h * 0.52;
  }
  const top = tiers[n - 1]!;
  const crown = top.y + top.h / 2; // 별 아래
  // 층·눈을 각각 한 덩어리로(그리기 호출 2번). 층마다 초록을 조금씩 달리(정점 색)
  const tierGeos: THREE.BufferGeometry[] = [];
  const snowGeos: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  tiers.forEach((t, i) => {
    const tips = Math.max(7, Math.round(8 + t.r * 3));
    const tg = tierGeometry(t.r, t.h, tips, rand).toNonIndexed();
    tg.rotateY(i * 0.7);
    tg.translate(0, t.y, 0);
    col.set(greens[i]!);
    const n = tg.attributes.position!.count;
    const c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) c.set([col.r, col.g, col.b], k * 3);
    tg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    tg.deleteAttribute('uv');
    tierGeos.push(tg);
    const sg = snowGeometry(t.r, t.h, tips).toNonIndexed();
    sg.rotateY(i * 0.7);
    sg.translate(0, t.y, 0);
    sg.deleteAttribute('uv');
    snowGeos.push(sg);
  });
  g.add(new THREE.Mesh(mergeGeometries(tierGeos)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })));
  g.add(new THREE.Mesh(mergeGeometries(snowGeos)!, snowMat));

  // 겉면 반지름(높이 y에서): 층 가장자리를 잇는 원뿔 근사
  const bottomY = tiers[0]!.y - tiers[0]!.h / 2;
  const envR = (yy: number) => Math.max(0.15, VILLAGE_TREE.baseR * 1.02 * (1 - (yy - bottomY) / (crown - bottomY)));

  // 나선 금빛 줄(반짝이)과 그 위 전구
  const turns = 5.5;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 220; i++) {
    const u = i / 220;
    const yy = bottomY + 0.5 + u * (crown - bottomY - 0.9);
    const a = u * turns * Math.PI * 2;
    const rr = envR(yy) * 0.93 + 0.06;
    pts.push(new THREE.Vector3(Math.cos(a) * rr, yy - 0.18 * Math.abs(Math.sin(a * 2.5)), Math.sin(a) * rr));
  }
  const spiral = new THREE.CatmullRomCurve3(pts);
  const garland = new THREE.Mesh(new THREE.TubeGeometry(spiral, 180, 0.05, 4, false), new THREE.MeshStandardMaterial({ color: '#e7c35a', roughness: 0.35, metalness: 0.7 }));
  g.add(garland);

  const bulbCount = 110;
  const bulbs = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbCount); // 빛나는 전구: 조명과 무관하게 제 색(묶음마다 색). 면 8개(소프트웨어 그리기에서 트리가 가장 무거웠다)
  const bulbColors = ['#ffd36b', '#ff6b5e', '#7fc8ff', '#a6f08a', '#ffd36b'];
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < bulbCount; i++) {
    const p = spiral.getPointAt((i + 0.5) / bulbCount);
    m.makeTranslation(p.x * 1.02, p.y - 0.06, p.z * 1.02);
    bulbs.setMatrixAt(i, m);
    bulbs.setColorAt(i, c.set(bulbColors[i % bulbColors.length]!));
  }
  bulbs.name = 'treeBulbs';
  g.add(bulbs);

  // 장식 공: 층 가장자리 가지 끝에 매달린다
  const balls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.45 }), 46);
  const ballColors = ['#c8333b', '#e0b64e', '#3f6fd1', '#d9dde5', '#c8333b', '#7b3fc4'];
  let bi = 0;
  tiers.forEach((t, ti) => {
    const per = Math.max(3, Math.round(t.r * 3.2));
    for (let k = 0; k < per && bi < 46; k++) {
      const a = (k / per) * Math.PI * 2 + ti * 0.9 + rand() * 0.3;
      const yy = t.y - t.h / 2 + t.h * (0.12 + rand() * 0.12);
      const rr = envR(yy) * 0.98 + 0.02;
      const s = 0.12 + rand() * 0.07 + (ti < 2 ? 0.05 : 0);
      m.compose(new THREE.Vector3(Math.cos(a) * rr, yy - s * 0.6, Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      balls.setMatrixAt(bi, m);
      balls.setColorAt(bi, c.set(ballColors[bi % ballColors.length]!));
      bi++;
    }
  });
  balls.count = bi;
  g.add(balls);

  // 꼭대기 별(빛나는 금색)
  const star = new THREE.Mesh(starGeometry(0.55), new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffbf2e', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 }));
  star.position.y = crown + 0.45;
  star.name = 'treeStar';
  g.add(star);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = o !== bulbs;
      o.receiveShadow = true;
    }
  });
  if (opts.lights === false) bulbs.visible = false;
  return g;
}
