// 미니 요정: Quaternius Hooded Adventurer(CC0)를 꼬마 요정으로 꾸민다.
//   머리 1.75배·다리 짧게·몸통 통통하게, 옷 다시 칠하기, 후드 숨김, 눈 검정,
//   이마~눈썹 위까지 덮는 요정 모자(색 + 무늬로 네 요정 구분), 뾰족 귀.
// 원점은 발바닥 중심, 앞은 +z(기본 도형 요정과 같다). 키는 모자 빼고 약 1.1 m.
// 시제품: tools/prototypes/mini-elf-hooded.html
import * as THREE from 'three';
import type { ElfLook, HatPattern } from '../data/elves';
import type { ElfView } from './elf';
import type { Models } from './models';

/** 모자 뺀 키(m). 1280×720 교실 화면에서도 요정이 잘 보이게 */
const BODY_HEIGHT = 1.1;

/** 부위별 색(메시 이름 → 재질 이름 → 색). null은 숨김 */
const PAINT: Record<string, Record<string, string | null>> = {
  Medieval_Head: { Black: '#111111', Brown: '#3a2414', White: '#8a5a2b', Skin: '#f1c9a5', DarkBrown: null },
  Medieval_Body: { Black: '#2f8a3e', DarkBrown: '#256b31', LightBrown: '#7a4a24', Skin: '#f1c9a5', Gold: '#f2c14e', Metal: '#f7f7f7' },
  Medieval_Legs: { Black: '#c8323c' },
  Medieval_Feet: { LightBrown: '#8a5a32', DarkBrown: '#5a3620' },
};

function hatTexture(base: string, pattern: HatPattern, accent: string): THREE.CanvasTexture {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, n, n);
  g.fillStyle = accent;
  if (pattern === 'stripes') for (let y = 0; y < n; y += 48) g.fillRect(0, y, n, 18);
  if (pattern === 'dots')
    for (let y = 16; y < n; y += 40)
      for (let x = (y / 40) % 2 ? 20 : 0; x < n; x += 40) {
        g.beginPath();
        g.arc(x, y, 9, 0, 7);
        g.fill();
      }
  if (pattern === 'stars')
    for (let y = 24; y < n; y += 52)
      for (let x = (y / 52) % 2 ? 30 : 4; x < n; x += 60) {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 ? 6 : 14;
          g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.fill();
      }
  if (pattern === 'checks') for (let y = 0; y < n; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < n; x += 64) g.fillRect(x, y, 32, 32);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

/** 끝이 위로 솟았다 옆·뒤로 휘어 늘어지는 요정 모자(미터, 원점 = 털 테두리 가운데) */
function elfHat(look: ElfLook): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.17, -0.01),
    new THREE.Vector3(0.02, 0.32, -0.05),
    new THREE.Vector3(0.08, 0.41, -0.13),
    new THREE.Vector3(0.16, 0.4, -0.22),
    new THREE.Vector3(0.22, 0.31, -0.25),
  ]);
  const N = 40;
  const R = 0.17;
  const tube = new THREE.TubeGeometry(curve, N, R, 24, false);
  const pos = tube.attributes.position!;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rad = 0.155 * Math.pow(1 - t, 0.85) + 0.012;
    curve.getPointAt(t, c);
    for (let j = 0; j <= 24; j++) {
      const k = i * 25 + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rad / R).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  tube.computeVertexNormals();
  g.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ map: hatTexture(look.hat, look.pattern, look.accent), roughness: 0.9, side: THREE.DoubleSide })));
  const fur = new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 1 });
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.045, 10, 28), fur);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.01;
  g.add(brim);
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 2), fur);
  pom.position.copy(curve.getPointAt(1)).add(new THREE.Vector3(0, -0.03, -0.01));
  g.add(pom);
  return g;
}

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let b: THREE.Bone | null = null;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name === name) b = o as THREE.Bone;
  });
  return b;
}

const inHead = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === 'Medieval_Head') return true;
  return false;
};

/** 모델이 없으면 null(호출하는 쪽이 기본 도형 요정을 쓴다) */
export function createMiniElf(models: Models, look: ElfLook): ElfView | null {
  const model = models.clone('elf');
  if (!model) return null;
  const root = new THREE.Group();
  root.add(model);

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    m.material = mat;
    m.castShadow = false;
    if (m.name.includes('Sword')) {
      m.visible = false;
      return;
    }
    let p: THREE.Object3D | null = m;
    while (p && !PAINT[p.name]) p = p.parent;
    const table = p ? PAINT[p.name] : undefined;
    if (table && mat.name in table) {
      const col = table[mat.name];
      if (col === null) m.visible = false;
      else mat.color.set(col!);
    }
    mat.metalness = 0;
    mat.roughness = 0.85;
  });

  // 비율: 머리 크게, 다리·발 짧게, 몸통 통통하게(동작은 뼈 크기를 건드리지 않는다)
  findBone(model, 'Head')?.scale.setScalar(1.75);
  for (const n of ['UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR']) findBone(model, n)?.scale.set(1.25, 0.52, 1.25);
  for (const n of ['FootL', 'FootR']) findBone(model, n)?.scale.set(1.1, 0.55, 1.1);
  findBone(model, 'Torso')?.scale.set(1.18, 0.85, 1.18);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(models.animations('elf').map((c) => [c.name.replace('CharacterArmature|', ''), c] as const));
  const action = (n: string) => {
    const c = clips.get(n);
    return c ? mixer.clipAction(c) : null;
  };
  const idle = action('Idle');
  const run = action('Run');
  idle?.play();
  mixer.update(0.5);
  model.updateMatrixWorld(true);

  // 키를 맞추고 발바닥을 원점에
  let box = new THREE.Box3().setFromObject(model);
  const k = BODY_HEIGHT / (box.max.y - box.min.y);
  model.scale.setScalar(k * model.scale.x);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  // 모자·귀: 눈썹과 머리 크기를 실제로 재서 붙인다. 머리 뼈에 붙여 동작 중에도 따라간다
  const head = findBone(model, 'Head');
  if (head) {
    const measure = (pred: (o: THREE.Object3D) => boolean) => {
      const b = new THREE.Box3();
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.visible && pred(o)) b.union(new THREE.Box3().setFromObject(o));
      });
      return b;
    };
    const matName = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.Material).name;
    const brow = measure((o) => inHead(o) && matName(o) === 'Brown');
    const headB = measure((o) => inHead(o) && (matName(o) === 'Skin' || matName(o) === 'White'));
    const size = headB.getSize(new THREE.Vector3());
    const ws = head.getWorldScale(new THREE.Vector3()).x;
    const hp = head.getWorldPosition(new THREE.Vector3());
    const hatK = ((Math.max(size.x, size.z) / 2) * 1.02) / 0.158;
    const qInv = head.getWorldQuaternion(new THREE.Quaternion()).invert();
    const hat = elfHat(look);
    hat.scale.setScalar(hatK / ws);
    head.add(hat);
    hat.position.copy(head.worldToLocal(new THREE.Vector3(hp.x, brow.max.y + 0.005 + 0.035 * hatK, (headB.min.z + headB.max.z) / 2 - 0.01)));
    hat.quaternion.copy(qInv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, 0)));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#f1c9a5', roughness: 0.85 }));
      ear.scale.setScalar(1 / ws);
      head.add(ear);
      ear.position.copy(head.worldToLocal(new THREE.Vector3(hp.x + sx * 0.15, hp.y + (headB.max.y - hp.y) * 0.35 - 0.05, hp.z)));
      ear.quaternion.copy(qInv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -sx * 1.2)));
    }
  }

  // 발밑 그림자(바닥 위 위치를 읽기 쉽게)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  let last = -1;
  let moving = false;
  return {
    root,
    animate(timeSec, isMoving) {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, timeSec - last));
      last = timeSec;
      if (isMoving !== moving && idle && run) {
        // 걷기·서기 전환은 짧게 섞는다
        const from = isMoving ? idle : run;
        const to = isMoving ? run : idle;
        to.reset().play();
        from.crossFadeTo(to, 0.15, false);
        moving = isMoving;
      }
      mixer.update(dt);
    },
  };
}
