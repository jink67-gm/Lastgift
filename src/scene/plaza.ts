// 광장 소품. Kenney 모델(CC0)이 있으면 그것으로, 없으면 기본 도형으로 그린다. 배치는 src/data/plaza.ts를 따른다.
// 썰매·눈더미·산타·시계탑은 아직 직접 만든 기본 도형이다.
import * as THREE from 'three';
import { PLAZA_BOUNDS, PLAZA_PROPS, WORKBENCH, WORKSHOP, type Prop, type PropKind } from '../data/plaza';

/** 요정을 가리면 잠시 흐려지는 큰 물체(집·공방·창고·나무·시계탑·썰매·산타·가로등) */
const FADEABLE = new Set<PropKind>(['cabin', 'workshop', 'shed', 'pine', 'tree', 'clockTower', 'sleigh', 'santa', 'lamp']);
import { BENCH_SCALE, KENNEY_HOUSE_SCALE, TOWN } from '../data/townScale';
import { buildCabin, kenneyProp } from './kenney';
import { createShed, createWorkbench, createWorkshopSign } from './workshop';
import { Models } from './models';
import { applySnowSurface, createPlazaDressing, type Detail } from './plazaDressing';
import { warmPool } from './winterLight';

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function sleigh(): THREE.Group {
  const g = new THREE.Group();
  const red = mat('#b3262e');
  g.add(mesh(new THREE.BoxGeometry(2.6, 0.7, 1.3), red, 0, 0.75, 0));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.9, 1.3), red, -1.05, 1.2, 0)); // 등받이
  const gold = mat('#d8b04a', { metalness: 0.4, roughness: 0.4 });
  for (const z of [-0.55, 0.55]) {
    g.add(mesh(new THREE.BoxGeometry(3.0, 0.08, 0.08), gold, 0.1, 0.25, z)); // 썰매 날
    const curl = mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 12, Math.PI), gold, 1.6, 0.53, z);
    curl.rotation.z = -Math.PI / 2;
    g.add(curl);
  }
  // 눈에 처박힌 각도
  g.rotation.z = 0.28;
  g.position.y = 0.25;
  return g;
}

function snowPile(r: number): THREE.Group {
  const g = new THREE.Group();
  const snow = mat('#f7fbff', { roughness: 1 });
  const big = mesh(new THREE.SphereGeometry(r, 20, 12), snow);
  big.scale.y = 0.38;
  g.add(big);
  for (const [x, z, s] of [[1.4, 0.9, 0.9], [-1.5, 0.6, 0.8], [0.4, -1.5, 1.0]] as const) {
    const lump = mesh(new THREE.SphereGeometry(s, 14, 10), snow, x, 0, z);
    lump.scale.y = 0.45;
    g.add(lump);
  }
  return g;
}

function santa(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.1, 16), mat('#c42b30'), 0, 0.55, 0));
  const belt = mesh(new THREE.TorusGeometry(0.47, 0.06, 6, 20), mat('#2a1d14'), 0, 0.55, 0);
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#f3cfb0'), 0, 1.38, 0));
  const beard = mesh(new THREE.ConeGeometry(0.28, 0.5, 14), mat('#f8f8f8'), 0, 1.15, 0.15);
  beard.rotation.x = Math.PI;
  g.add(beard);
  g.add(mesh(new THREE.ConeGeometry(0.3, 0.55, 16), mat('#c42b30'), 0, 1.8, -0.03));
  g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('#f8f8f8'), 0, 2.08, -0.05));
  g.rotation.y = -0.9; // 썰매 쪽을 본다
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 10), mat('#6b4428'), 0, 0.3, 0));
  const green = mat('#2e6b3e');
  [[1.1, 1.3, 0.95], [0.85, 1.1, 1.75], [0.55, 0.9, 2.45]].forEach(([r, h, y]) =>
    g.add(mesh(new THREE.ConeGeometry(r!, h!, 14), green, 0, y!, 0)),
  );
  g.add(mesh(new THREE.OctahedronGeometry(0.18), mat('#ffd84a', { emissive: '#ffcf33', emissiveIntensity: 0.6 }), 0, 3.0, 0));
  return g;
}

function house(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const wallH = KENNEY_HOUSE_SCALE; // 사람 집 벽 높이(문 열린 부분 = 요정 키 × 4.5보다 조금 높다)
  g.add(mesh(new THREE.BoxGeometry(w, wallH, d), mat('#c9a27a'), 0, wallH / 2, 0));
  const roof = mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), mat('#7a3a2e'), 0, wallH * 1.275, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w + 0.6, wallH * 0.55, d + 0.6);
  g.add(roof);
  const snowCap = mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), mat('#f7fbff', { roughness: 1 }), 0, wallH * 1.48, 0);
  snowCap.rotation.y = Math.PI / 4;
  snowCap.scale.set((w + 0.6) * 0.45, wallH * 0.25, (d + 0.6) * 0.45);
  g.add(snowCap);
  // 카메라 쪽(+z, +x) 벽에 문과 창
  g.add(mesh(new THREE.BoxGeometry(TOWN.doorOpening * 0.6, TOWN.doorOpening, 0.06), mat('#5a3620'), -w * 0.2, TOWN.doorOpening / 2, d / 2 + 0.03));
  g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), mat('#d8b04a'), -w * 0.2 + TOWN.doorOpening * 0.24, TOWN.doorKnob, d / 2 + 0.1)); // 손잡이
  g.add(mesh(new THREE.BoxGeometry(w * 0.22, wallH * 0.28, 0.06), mat('#ffe6a0', { emissive: '#ffcc66', emissiveIntensity: 0.5 }), w * 0.22, wallH * 0.55, d / 2 + 0.03));
  return g;
}

function bench(w: number, d: number, seat = 0.45): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#7d5233');
  g.add(mesh(new THREE.BoxGeometry(w, 0.12, d), wood, 0, seat, 0));
  g.add(mesh(new THREE.BoxGeometry(w, seat * 0.9, 0.1), wood, 0, seat * 1.6, -d / 2 + 0.05));
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) g.add(mesh(new THREE.BoxGeometry(0.12, seat, d * 0.9), mat('#2f3340'), x, seat / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(w, 0.08, d), mat('#f7fbff', { roughness: 1 }), 0, seat + 0.1, 0)); // 소복한 눈
  return g;
}

function clockTower(): THREE.Group {
  // 광장 시계탑(랜드마크): 돌 기둥 + 시계 네 면 + 눈 덮인 뾰족 지붕
  const g = new THREE.Group();
  const stone = mat('#b9a38a');
  g.add(mesh(new THREE.BoxGeometry(2.2, 6.4, 2.2), stone, 0, 3.2, 0));
  g.add(mesh(new THREE.BoxGeometry(2.6, 0.3, 2.6), mat('#8a7560'), 0, 6.5, 0));
  const face = mat('#fff8e6', { emissive: '#ffe9b0', emissiveIntensity: 0.4 });
  const hand = mat('#2a2522');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const f = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 24), face, Math.sin(a) * 1.12, 5.4, Math.cos(a) * 1.12);
    f.rotation.set(Math.PI / 2, a, 0, 'YXZ'); // 원판 축을 바깥(sin a, 0, cos a)으로
    g.add(f);
    const h1 = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.04), hand, Math.sin(a) * 1.17, 5.55, Math.cos(a) * 1.17);
    h1.rotation.y = a;
    g.add(h1);
    const h2 = mesh(new THREE.BoxGeometry(0.32, 0.06, 0.04), hand, Math.sin(a) * 1.17 + Math.cos(a) * 0.14, 5.4, Math.cos(a) * 1.17 - Math.sin(a) * 0.14);
    h2.rotation.y = a;
    g.add(h2);
  }
  const roof = mesh(new THREE.ConeGeometry(1.9, 2.2, 4), mat('#7a3a2e'), 0, 7.75, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const cap = mesh(new THREE.ConeGeometry(1.2, 1.2, 4), mat('#f7fbff', { roughness: 1 }), 0, 8.25, 0);
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  return g;
}

function pine(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8), mat('#6b4428'), 0, 0.3, 0));
  [[1.0, 1.4, 1.0], [0.75, 1.2, 1.9], [0.45, 1.0, 2.7]].forEach(([r, h, y]) => g.add(mesh(new THREE.ConeGeometry(r!, h!, 10), mat('#2f6b4a'), 0, y!, 0)));
  return g;
}

/**
 * 사람 가로등: 눈 바닥 ~ 등불 가운데 = 요정 키 × 7. 기둥은 굵기를 따로(지름 = 요정 키 × 0.2) 정해 가늘고 높게.
 * 받침 · 가는 기둥 · 장식 고리 · 등불 상자(빛나는 유리) · 눈 얹힌 갓
 */
export function townLamp(): THREE.Group {
  const g = new THREE.Group();
  const iron = mat('#2f3340', { roughness: 0.6, metalness: 0.3 });
  const top = TOWN.lampLight;
  const r = TOWN.lampPoleDiameter / 2;
  g.add(mesh(new THREE.CylinderGeometry(r * 2.2, r * 2.8, 0.55, 12), iron, 0, 0.275, 0)); // 받침
  g.add(mesh(new THREE.CylinderGeometry(r * 0.8, r, top - 0.9, 10), iron, 0, 0.55 + (top - 0.9 - 0.55) / 2 + 0.275, 0));
  const ring = mesh(new THREE.TorusGeometry(r * 2, r * 0.35, 6, 14), iron, 0, top - 0.75, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const glass = mat('#fff1c2', { emissive: '#ffd98a', emissiveIntensity: 1.3 });
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), glass, 0, top, 0));
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), iron, x, top, z));
  const cap = mesh(new THREE.ConeGeometry(0.42, 0.34, 4), iron, 0, top + 0.5, 0);
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  const snow = mesh(new THREE.ConeGeometry(0.3, 0.16, 4), mat('#f7fbff', { roughness: 1 }), 0, top + 0.62, 0);
  snow.rotation.y = Math.PI / 4;
  g.add(snow);
  return g;
}

function build(p: Prop, models: Models, lampLights: { n: number }): THREE.Object3D {
  switch (p.kind) {
    case 'sleigh': return scaled(sleigh(), 1.8); // 산타 썰매: 산타(사람 어른)가 앉을 크기
    case 'snowPile': return scaled(snowPile(2.2), ((p.r ?? 2.2) / 2.2) * 1.25); // 썰매 앞이 처박힌 눈둑
    case 'santa': return scaled(santa(), 2.05); // 사람 어른: 요정 키의 약 4배
    case 'clockTower': return scaled(clockTower(), 2.5); // 집(약 12)보다 높은 랜드마크
    case 'tree': return kenneyProp(models, 'treeDecorated', 3.4) ?? scaled(tree(), 2.6); // 마을 트리 약 7.8(공방 지붕보다 조금 높게)
    case 'pine': return kenneyProp(models, p.x + p.z > 0 ? 'treeSnowB' : 'treeSnowA', 5.4) ?? scaled(pine(), 3.4);
    case 'cabin': {
      // 집 모양은 회전 전 기준(앞 = +z)으로 만들고, 배치 때 rotY로 돌린다. 통나무는 중간 밝기 갈색으로
      const cells = p.cells ?? 2;
      return buildCabin(models, { depth: cells, wreath: true, scale: KENNEY_HOUSE_SCALE, tint: '#d8c2ad' }) ?? house(2 * KENNEY_HOUSE_SCALE, cells * KENNEY_HOUSE_SCALE);
    }
    case 'bench': return townBench(models);
    case 'workshop': {
      // 요정 공방: 요정 크기 통나무집(문 = 요정 키의 약 2.1배), 창은 따뜻한 노랑, 통나무는 중간 밝기 갈색
      const ws = buildCabin(models, { depth: 2, wreath: true, scale: WORKSHOP.scale, knob: WORKSHOP.knob, warm: '#ffd463', tint: '#dcc4ae' }) ?? house(2 * WORKSHOP.scale, 2 * WORKSHOP.scale);
      const sign = createWorkshopSign();
      sign.position.set(-WORKSHOP.scale / 2, WORKSHOP.scale * 0.93, 1.2 * WORKSHOP.scale + 0.25);
      const g = new THREE.Group();
      g.add(ws, sign);
      return g;
    }
    case 'workbench': {
      const g = createWorkbench(WORKBENCH.w, WORKBENCH.d, WORKBENCH.h);
      return g;
    }
    case 'shed': return createShed(p.w ?? 3.4, p.d ?? 2.4);
    case 'lamp': {
      const g = townLamp();
      const pool = warmPool(1.6);
      pool.position.y = 0.003;
      g.add(pool);
      // 빛은 세 개까지만(저사양 기기). 높아진 등불에서 바닥까지 닿게
      if (lampLights.n++ < 3) {
        const light = new THREE.PointLight('#ffd98a', 14, 13, 1.6);
        light.position.y = TOWN.lampLight;
        g.add(light);
      }
      return g;
    }
  }
}

/** 사람 벤치: 앉는 면 = 요정 어깨~정수리, 폭 = 요정 키 × 3.6(폭과 높이 배율을 따로) */
export function townBench(models: Models): THREE.Object3D {
  const k = models.clone('bench');
  if (!k) return bench(TOWN.benchWidth, 0.64 * BENCH_SCALE.z, TOWN.benchSeat);
  k.scale.set(BENCH_SCALE.x, BENCH_SCALE.y, BENCH_SCALE.z);
  return k;
}

function scaled<T extends THREE.Object3D>(o: T, k: number): T {
  o.scale.multiplyScalar(k);
  return o;
}

export function createPlaza(models: Models = Models.none(), detail: Detail = 'normal'): THREE.Group {
  const root = new THREE.Group();
  const w = PLAZA_BOUNDS.maxX - PLAZA_BOUNDS.minX;
  const d = PLAZA_BOUNDS.maxZ - PLAZA_BOUNDS.minZ;

  // 다져진 광장 바닥(밝은 크림빛 눈)과 그 바깥의 푹 쌓인 눈밭(조금 더 푸르다): 화면 끝에 빈 공간이 보이지 않게
  const groundMat = mat('#fbf8f2', { roughness: 0.95 });
  const ground = mesh(new THREE.BoxGeometry(w, 0.4, d), groundMat, 0, -0.2, 0);
  ground.userData.flat = true;
  root.add(ground);
  const apronMat = mat('#e6edf6', { roughness: 1 });
  const apron = mesh(new THREE.PlaneGeometry(w + 80, d + 80), apronMat, 0, 0.001, 0);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.userData.flat = true;
  root.add(apron);

  // 광장 가장자리 낮은 눈둑(경계가 화면에서 보이게)
  const rim = mat('#e6edf7', { roughness: 1 });
  root.add(mesh(new THREE.BoxGeometry(w, 0.3, 0.4), rim, 0, 0.15, PLAZA_BOUNDS.minZ));
  root.add(mesh(new THREE.BoxGeometry(w, 0.3, 0.4), rim, 0, 0.15, PLAZA_BOUNDS.maxZ));
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.3, d), rim, PLAZA_BOUNDS.minX, 0.15, 0));
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.3, d), rim, PLAZA_BOUNDS.maxX, 0.15, 0));

  // 눈결(Poly Haven Snow 02)은 불러오는 대로 입힌다. 실패하면 단색 그대로
  void applySnowSurface([{ mat: groundMat, w, d }, { mat: apronMat, w: w + 80, d: d + 80 }], import.meta.env.BASE_URL, detail);
  root.add(createPlazaDressing(models, import.meta.env.BASE_URL, detail));

  const lampLights = { n: 0 };
  for (const p of PLAZA_PROPS) {
    const o = build(p, models, lampLights);
    o.position.x = p.x;
    o.position.z = p.z;
    if (p.rotY) o.rotation.y += p.rotY;
    o.name = p.id;
    // 사람 크기의 큰 물체: 요정을 가리면 잠시 흐리게(game/occlusionFade)
    if (FADEABLE.has(p.kind)) o.userData.fadeable = true;
    root.add(o);
  }
  return root;
}
