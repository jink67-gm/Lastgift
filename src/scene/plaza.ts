// 광장 소품. Kenney 모델(CC0)이 있으면 그것으로, 없으면 기본 도형으로 그린다. 배치는 src/data/plaza.ts를 따른다.
// 썰매·눈더미·산타·시계탑은 아직 직접 만든 기본 도형이다.
import * as THREE from 'three';
import { PLAZA_BOUNDS, PLAZA_PROPS, type Prop } from '../data/plaza';
import { buildCabin, kenneyProp } from './kenney';
import { Models } from './models';

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
  const wallH = 2.4;
  g.add(mesh(new THREE.BoxGeometry(w, wallH, d), mat('#c9a27a'), 0, wallH / 2, 0));
  const roof = mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), mat('#7a3a2e'), 0, wallH + 0.7, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w + 0.6, 1.4, d + 0.6);
  g.add(roof);
  const snowCap = mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), mat('#f7fbff', { roughness: 1 }), 0, wallH + 1.25, 0);
  snowCap.rotation.y = Math.PI / 4;
  snowCap.scale.set((w + 0.6) * 0.45, 0.6, (d + 0.6) * 0.45);
  g.add(snowCap);
  // 카메라 쪽(+z, +x) 벽에 문과 창
  g.add(mesh(new THREE.BoxGeometry(0.9, 1.5, 0.06), mat('#5a3620'), -w * 0.2, 0.75, d / 2 + 0.03));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), mat('#ffe6a0', { emissive: '#ffcc66', emissiveIntensity: 0.5 }), w * 0.22, 1.4, d / 2 + 0.03));
  return g;
}

function bench(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#7d5233');
  g.add(mesh(new THREE.BoxGeometry(w, 0.1, d), wood, 0, 0.45, 0));
  g.add(mesh(new THREE.BoxGeometry(w, 0.4, 0.08), wood, 0, 0.75, -d / 2 + 0.04));
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.45, d * 0.9), mat('#2f3340'), x, 0.22, 0));
  g.add(mesh(new THREE.BoxGeometry(w, 0.06, d), mat('#f7fbff', { roughness: 1 }), 0, 0.53, 0)); // 소복한 눈
  return g;
}

function lamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), mat('#2f3340'), 0, 1.3, 0));
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), mat('#fff1c2', { emissive: '#ffd98a', emissiveIntensity: 1.2 }), 0, 2.75, 0));
  const light = new THREE.PointLight('#ffd98a', 6, 6, 1.6);
  light.position.y = 2.6;
  g.add(light);
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

function build(p: Prop, models: Models, lampLights: { n: number }): THREE.Object3D {
  switch (p.kind) {
    case 'sleigh': return sleigh();
    case 'snowPile': return snowPile(p.r ?? 2);
    case 'santa': return santa();
    case 'clockTower': return clockTower();
    case 'tree': return kenneyProp(models, 'treeDecorated') ?? tree();
    case 'pine': return kenneyProp(models, p.x + p.z > 0 ? 'treeSnowB' : 'treeSnowA') ?? pine();
    case 'cabin': {
      // 집 모양은 회전 전 기준(앞 = +z)으로 만들고, 배치 때 rotY로 돌린다
      const cells = p.cells ?? 3;
      return buildCabin(models, { depth: cells, wreath: true }) ?? house(4.4, cells * 2 + 0.4);
    }
    case 'bench': return kenneyProp(models, 'bench', 1.25) ?? bench(p.w ?? 2, p.d ?? 0.6); // 앉는 높이 약 0.45 m
    case 'lamp': {
      const k = kenneyProp(models, 'lantern', 1.5); // 높이 약 2.6 m
      if (!k) return lamp();
      // 빛은 세 개까지만(저사양 기기)
      if (lampLights.n++ < 3) {
        const light = new THREE.PointLight('#ffd98a', 6, 6, 1.6);
        light.position.y = 1.6; // 랜턴 안(1.5배 안쪽 좌표)
        (k as THREE.Object3D).add(light);
      }
      return k;
    }
  }
}

export function createPlaza(models: Models = Models.none()): THREE.Group {
  const root = new THREE.Group();
  const w = PLAZA_BOUNDS.maxX - PLAZA_BOUNDS.minX;
  const d = PLAZA_BOUNDS.maxZ - PLAZA_BOUNDS.minZ;

  const ground = mesh(new THREE.BoxGeometry(w, 0.4, d), mat('#eef3fb', { roughness: 0.95 }), 0, -0.2, 0);
  root.add(ground);

  // 광장 가장자리 낮은 눈둑(경계가 화면에서 보이게)
  const rim = mat('#dfe7f4', { roughness: 1 });
  root.add(mesh(new THREE.BoxGeometry(w, 0.3, 0.4), rim, 0, 0.15, PLAZA_BOUNDS.minZ));
  root.add(mesh(new THREE.BoxGeometry(w, 0.3, 0.4), rim, 0, 0.15, PLAZA_BOUNDS.maxZ));
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.3, d), rim, PLAZA_BOUNDS.minX, 0.15, 0));
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.3, d), rim, PLAZA_BOUNDS.maxX, 0.15, 0));

  const lampLights = { n: 0 };
  for (const p of PLAZA_PROPS) {
    const o = build(p, models, lampLights);
    o.position.x = p.x;
    o.position.z = p.z;
    if (p.rotY) o.rotation.y += p.rotY;
    o.name = p.id;
    root.add(o);
  }
  return root;
}
