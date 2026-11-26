// 프롤로그·0장에 나오는 인물: 산타, 도토(썰매 정비공 요정), 콩이(유기견).
// 산타는 사용자가 준 에셋(scene/santa.ts)을 쓰고, 없으면 요정 뼈대로 만든 산타로 대신한다.
// 도토는 요정과 같은 뼈대 모델(Quaternius Hooded Adventurer, CC0)을 비율·색·소품만 바꿔 쓴다(같은 그림체, 같은 동작 이름).
// 콩이는 Quaternius Shiba Inu(CC0)를 다시 칠하고 줄였다. 모델이 없으면 기본 도형으로 대신한다. 판정과 무관.
import * as THREE from 'three';
import { createElf, type ElfView } from './elf';
import { createRigged, elfBuild, pointyHat, type RigBuild, type RigCtx } from './miniElf';
import type { Models } from './models';
import { createSantaAsset } from './santa';
import { ELF_LOOKS } from '../data/elves';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** 얼굴 앞 가운데(인물 기준) */
function faceFront(c: RigCtx, up: number, inset = 0): THREE.Vector3 {
  const f = c.face;
  const size = f.getSize(new THREE.Vector3());
  return new THREE.Vector3((f.min.x + f.max.x) / 2, f.min.y + size.y * up, f.max.z - inset);
}

// ── 산타 ───────────────────────────────────────────────
/** 산타 키(모자 제외). 사람 어른: 0장 요정(1.32)의 약 3.3배 */
export const SANTA_HEIGHT = 4.3;

const SANTA_BUILD: RigBuild = {
  height: SANTA_HEIGHT,
  head: 1.08,
  legs: [1.12, 0.95],
  feet: [1.15, 1],
  torso: [1.42, 1.02, 1.5], // 둥근 배
  abdomen: [1.35, 1, 1.55],
  paint: {
    // Brown = 눈·눈썹(어둡게 해야 눈이 읽힌다), White = 머리카락(흰머리)
    Medieval_Head: { Black: '#111111', Brown: '#2b2522', White: '#eeeeee', Skin: '#f1c9a5', DarkBrown: null },
    // Metal(어깨 가시 장식)은 숨긴다
    // DarkBrown = 목둘레·옷깃 → 흰 털
    Medieval_Body: { Black: '#c42b30', DarkBrown: '#f2f0ea', Brown: '#f7f7f4', LightBrown: '#2a1d14', Skin: '#f1c9a5', Gold: '#e2b23c', Metal: null },
    Medieval_Legs: { Black: '#b3262e' },
    Medieval_Feet: { LightBrown: '#1e1a18', DarkBrown: '#1e1a18' },
  },
  hat: () => pointyHat('#c42b30', null, '#ffffff'),
  hatTilt: -0.1,
  hatLift: 0.1,
  ears: false,
  boots: false,
  shadowR: 1.0,
  extra(c) {
    const head = c.bone('Head');
    if (!head) return;
    const size = c.face.getSize(new THREE.Vector3());
    const w = Math.max(size.x, 0.1);
    const white = std('#f8f8f6', { roughness: 1 });
    // 턱수염: 입 아래부터 가슴까지 늘어진 둥근 흰 수염(눈·코는 보이게)
    const beard = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, 18, 14), white);
    beard.scale.set(1.05, 1.2, 0.6);
    c.attach(head, beard, faceFront(c, -0.14, w * 0.2));
    // 콧수염 두 갈래
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.055, w * 0.2, 4, 8), white);
      c.attach(head, m, faceFront(c, 0.22, -w * 0.02).add(new THREE.Vector3(sx * w * 0.12, 0, 0)), new THREE.Euler(0, 0, sx * 1.25));
    }
    // 빨간 코
    const nose = new THREE.Mesh(new THREE.SphereGeometry(w * 0.065, 10, 8), std('#e7967f'));
    c.attach(head, nose, faceFront(c, 0.3, -w * 0.05));
  },
};

/** 기본 도형 산타(모델이 없을 때) */
function plainSanta(): ElfView {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(0, y, z);
    g.add(o);
    return o;
  };
  const s = SANTA_HEIGHT / 2.1;
  add(new THREE.CylinderGeometry(0.42 * s, 0.55 * s, 1.1 * s, 16), std('#c42b30'), 0.55 * s);
  add(new THREE.SphereGeometry(0.3 * s, 16, 12), std('#f1c9a5'), 1.38 * s);
  const beard = add(new THREE.ConeGeometry(0.28 * s, 0.5 * s, 14), std('#f8f8f8'), 1.15 * s, 0.15 * s);
  beard.rotation.x = Math.PI;
  add(new THREE.ConeGeometry(0.3 * s, 0.55 * s, 16), std('#c42b30'), 1.8 * s, -0.03 * s);
  return { root, animate() {} };
}

/** 산타: 사용자 에셋이 있으면 그것을, 없으면 요정 뼈대 산타, 그것도 없으면 기본 도형 */
export function createSanta(models: Models): ElfView {
  return createSantaAsset(models, SANTA_HEIGHT) ?? createRigged(models, SANTA_BUILD, { idle: 'Idle_Neutral' }) ?? plainSanta();
}

// ── 도토: 썰매를 고치는 나이 든 정비공 요정 ───────────────
/** 가죽 비행 모자 + 이마 위 고글(원점 = 테두리 가운데, 머리 반지름 0.158 기준) */
function aviatorCap(): THREE.Group {
  const g = new THREE.Group();
  const leather = std('#7a4a2a', { roughness: 0.75 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.172, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), leather);
  dome.scale.set(1, 0.95, 1.05);
  g.add(dome);
  // 귀덮개
  for (const sx of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), leather);
    flap.scale.set(0.35, 1.25, 0.95);
    flap.position.set(sx * 0.168, -0.05, -0.01);
    g.add(flap);
  }
  // 고글: 띠 + 두 렌즈(이마 위)
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.176, 0.016, 6, 32), std('#2f2a26'));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.05;
  g.add(band);
  const rim = std('#c9a24a', { metalness: 0.5, roughness: 0.4 });
  const glass = std('#9fd3f0', { roughness: 0.2, emissive: '#5aa8d8', emissiveIntensity: 0.25 });
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 18), rim);
    ring.rotation.x = Math.PI / 2 - 0.35;
    ring.position.set(sx * 0.062, 0.075, 0.155);
    g.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 18), glass);
    lens.position.set(sx * 0.062, 0.082, 0.177);
    lens.rotation.x = -0.35;
    g.add(lens);
  }
  return g;
}

/** 큰 렌치(원점 = 손잡이 끝, 길이 방향 +y) */
function wrench(): THREE.Group {
  const g = new THREE.Group();
  const steel = std('#b9c0c9', { metalness: 0.6, roughness: 0.35 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.018), steel);
  handle.position.y = 0.12;
  g.add(handle);
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 6, 12, Math.PI * 1.4), steel);
  jaw.position.y = 0.27;
  jaw.rotation.z = Math.PI * 0.8;
  g.add(jaw);
  return g;
}

const DOTO_BUILD: RigBuild = {
  ...elfBuild(ELF_LOOKS[0]!),
  height: 1.2, // 꼬마 요정들보다 조금 크다(나이 든 정비공)
  head: 1.62,
  torso: [1.38, 0.88, 1.38],
  paint: {
    Medieval_Head: { Black: '#111111', Brown: '#2b2522', White: '#a7a7a7', Skin: '#eec3a0', DarkBrown: null },
    // 주황 작업복 + 갈색 공구 허리띠
    Medieval_Body: { Black: '#d07a2a', DarkBrown: '#a85e1f', LightBrown: '#5a3a1e', Skin: '#eec3a0', Gold: '#c9c9c9', Metal: null },
    Medieval_Legs: { Black: '#4b5563' },
    Medieval_Feet: { LightBrown: '#d9d2c3', DarkBrown: '#4b5563' },
  },
  hat: aviatorCap,
  hatTilt: -0.12,
  shadowR: 0.38,
  extra(c) {
    const head = c.bone('Head');
    if (head) {
      const w = Math.max(c.face.getSize(new THREE.Vector3()).x, 0.1);
      // 회색 콧수염(덥수룩하게)
      const gray = std('#d6d6d6', { roughness: 1 });
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.045, w * 0.16, 4, 8), gray);
        c.attach(head, m, faceFront(c, 0.24, -w * 0.02).add(new THREE.Vector3(sx * w * 0.1, 0, 0)), new THREE.Euler(0, 0, sx * 1.25));
      }
    }
    // 오른손에 렌치
    const wr = c.bone('WristR');
    if (wr) {
      const p = wr.getWorldPosition(new THREE.Vector3());
      const w = wrench();
      w.name = 'dotoWrench';
      c.attach(wr, w, p.add(new THREE.Vector3(0, -0.02, 0.02)), new THREE.Euler(Math.PI, 0, 0));
    }
  },
};

export function createDoto(models: Models): ElfView {
  return createRigged(models, DOTO_BUILD) ?? createElf({ slot: 0, hat: '#7a4a2a', pattern: 'checks', accent: '#d07a2a' });
}

// ── 콩이(유기견) ─────────────────────────────────────────
export interface DogView {
  root: THREE.Group;
  /** Gallop·Walk·Idle·Idle_2_HeadLow 등. 없으면 false */
  play(clip: string, o?: { speed?: number; fade?: number }): boolean;
  update(dt: number): void;
  /** 꼬리 흔들기 세기(0~1) */
  wag(amount: number): void;
  /** 코를 땅에 대고 달리기(0~1): 목을 숙여 머리를 낮춘다 */
  nose(amount: number): void;
}

/** 콩이 크기: 머리 꼭대기 약 1.15(0장 요정 키 1.32보다 조금 작다). 사람 기준 시바견(약 45 cm) */
const DOG_SCALE = 0.37;

export function createKongi(models: Models): DogView {
  const model = models.clone('dog');
  const root = new THREE.Group();
  if (!model) {
    // 기본 도형: 주황 몸 + 말린 꼬리
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), std('#d9822b'));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.45;
    root.add(body);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 12, Math.PI * 1.5), std('#f6ead8'));
    tail.position.set(-0.5, 0.65, 0);
    root.add(tail);
    return { root, play: () => false, update() {}, wag() {}, nose() {} };
  }
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
    const fix = (mat: THREE.MeshStandardMaterial) => {
      const c = mat.clone();
      c.metalness = 0;
      c.roughness = 0.9;
      if (c.name === 'Main') c.color.set('#d9822b'); // 주황 털
      else if (c.name === 'Main_Light') c.color.set('#f6ead8'); // 크림색 배·볼·꼬리 끝
      else if (c.name === 'Eyes_White') c.color.set('#ffffff');
      return c;
    };
    m.material = Array.isArray(src) ? src.map(fix) : fix(src);
    m.castShadow = true;
  });
  model.scale.multiplyScalar(DOG_SCALE);
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(models.animations('dog').filter((c) => c.name.startsWith('AnimalArmature|')).map((c) => [c.name.replace('AnimalArmature|', ''), c] as const));
  let cur: THREE.AnimationAction | null = null;
  let tail: THREE.Bone[] = [];
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone && /^Tail\d$/.test(o.name)) tail.push(o as THREE.Bone);
  });
  tail = tail.sort((a, b) => a.name.localeCompare(b.name));
  const tailClean = tail.map((b) => b.quaternion.clone());
  const necks = ['Neck1', 'Neck2'].map((n) => model.getObjectByName(n) as THREE.Bone | undefined).filter((b): b is THREE.Bone => !!b);
  const neckClean = necks.map((b) => b.quaternion.clone());
  let noseDown = 0;
  const qRoot = new THREE.Quaternion(), qPar = new THREE.Quaternion(), qCur = new THREE.Quaternion(), qRot = new THREE.Quaternion();
  const ax = new THREE.Vector3();
  let wag = 0;
  let t = 0;
  const play = (name: string, o: { speed?: number; fade?: number } = {}) => {
    const c = clips.get(name);
    if (!c) return false;
    const a = mixer.clipAction(c);
    a.timeScale = o.speed ?? 1;
    if (a === cur) return true;
    a.reset().play();
    if (cur) cur.crossFadeTo(a, o.fade ?? 0.2, false);
    cur = a;
    return true;
  };
  play('Idle');
  // 발바닥을 바닥에
  mixer.update(0.3);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.6, 1.25, 1);
  shadow.position.y = 0.01;
  root.add(shadow);
  return {
    root,
    play,
    update(dt) {
      t += dt;
      tail.forEach((b, i) => b.quaternion.copy(tailClean[i]!));
      necks.forEach((b, i) => b.quaternion.copy(neckClean[i]!));
      mixer.update(dt);
      tail.forEach((b, i) => tailClean[i]!.copy(b.quaternion));
      necks.forEach((b, i) => neckClean[i]!.copy(b.quaternion));
      // 코를 땅에: 개 기준 옆 축(+x)으로 목을 앞아래로 숙인다
      if (noseDown > 0.001) {
        root.updateMatrixWorld(true);
        root.getWorldQuaternion(qRoot);
        ax.set(1, 0, 0).applyQuaternion(qRoot);
        qRot.setFromAxisAngle(ax, 0.42 * noseDown);
        for (const b of necks) {
          b.getWorldQuaternion(qCur).premultiply(qRot);
          b.parent!.getWorldQuaternion(qPar);
          b.quaternion.copy(qPar.invert().multiply(qCur));
          b.updateMatrixWorld(true);
        }
      }
      if (wag > 0.001) {
        const q = new THREE.Quaternion();
        tail.forEach((b, i) => b.quaternion.multiply(q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 16 - i * 0.6) * 0.35 * wag)));
      }
    },
    wag(a) {
      wag = Math.max(0, Math.min(1, a));
    },
    nose(a) {
      noseDown = Math.max(0, Math.min(1, a));
    },
  };
}
