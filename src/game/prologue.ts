// 프롤로그 연출(명세서 §4 0장 첫 문단): 시간표(core/prologue.ts)에 맞춰 사진기·인물·썰매·선물·눈을 움직인다.
// 0장 장면(광장·요정·선물·산타·도토)을 그대로 쓰고, 끝나면 모두 0장 플레이 시작 자리에 놓인다(건너뛰어도 같다).
// 판정(선물 분류·충돌)과 무관하다. 팀 시계는 run의 'cutscene' 동안 멈춰 있다.
import * as THREE from 'three';
import { ease, PROLOGUE, photoLineup, seg, type PhotoSetup } from '../core/prologue';
import { placeOnHands } from '../scene/hold';
import type { DogView } from '../scene/characters';
import type { ElfView } from '../scene/elf';
import { createPrologueUi, type PrologueUi } from '../ui/prologueUi';

const P = PROLOGUE;
const C = P.crash;
const F = P.flight;

export interface Spot {
  x: number;
  z: number;
  facing: number;
}

export interface PrologueCast {
  scene: THREE.Scene;
  elves: ElfView[];
  /** 요정 자리 번호(모자) */
  slots: number[];
  elfScale: number;
  /** 0장 플레이 시작 자리 */
  elfStarts: Spot[];
  santa: ElfView;
  santaHold: Spot;
  doto: ElfView;
  dotoFix: Spot;
  kongi: DogView;
  sleigh: THREE.Object3D;
  snowPile: THREE.Object3D | null;
  /** 썰매에서 흩어져 떨어질 물건(선물 넷 + 재봉틀 상자)과 떨어질 자리 */
  cargo: { v: THREE.Object3D; to: Spot; heavy?: boolean }[];
  /** 그림 이름표(cargo와 같은 순서, 떨어진 자리 위 높이 y). 연출 끝에 하나씩 나타난다 */
  tags: { obj: THREE.Object3D; y: number }[];
  /** 썰매를 받치면 앞이 덜 처박힌다(받친 뒤 기울기) */
  sleighHeldTilt: number;
  reduceMotion: boolean;
  /** 눈보라 세기(0~1): 조명·눈송이 수 */
  storm(k: number): void;
  /** 눈송이를 사진기 둘레로(y: 눈 상자 바닥 높이, 하늘 장면) */
  snowAround(dt: number, x: number, z: number, r: number, y?: number): void;
  /** 사진을 찍은 순간(구도 저장) */
  onPhoto(p: PhotoSetup): void;
}

export interface Prologue {
  readonly camera: THREE.PerspectiveCamera;
  /** 연출 시각(초) */
  readonly t: number;
  /** 0장 플레이로 넘어가도 된다 */
  readonly done: boolean;
  readonly photo: PhotoSetup;
  update(dt: number, aspect: number): void;
  /** 화면을 그린 직후 부른다(셔터 순간의 화면을 사진 카드에 담는다) */
  afterRender(canvas: HTMLCanvasElement): void;
  skip(): void;
  /** 플레이 화면이 다 밝아졌다(이제 화면 장치를 치워도 된다) */
  readonly closed: boolean;
  /** 화면 장치를 치운다 */
  dispose(): void;
}

/** 둥근 빛 점 그림(별빛·눈 튀김) */
function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, inner);
  r.addColorStop(0.35, outer);
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 밤하늘 둥근 지붕(위는 짙은 남색, 지평선은 옅은 청회색) + 별 */
function skyDome(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(190, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const top = new THREE.Color('#0b1430');
  const horizon = new THREE.Color('#5d6f96');
  const col: number[] = [];
  const p = geo.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 190;
    const c = horizon.clone().lerp(top, Math.min(1, Math.max(0, y * 1.6)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -10;
  g.add(dome);
  const starPos: number[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.25 + rnd() * 1.1;
    starPos.push(Math.cos(a) * Math.cos(e) * 180, Math.sin(e) * 180, Math.sin(a) * Math.cos(e) * 180);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff7d6', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
  stars.name = 'stars';
  stars.renderOrder = -9;
  g.add(stars);
  g.name = 'prologueSky';
  return g;
}

/** 포물선: a에서 b로, 꼭대기 높이 h */
function arc(a: THREE.Vector3, b: THREE.Vector3, h: number, u: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(a, b, u);
  out.y += 4 * h * u * (1 - u);
  return out;
}

/** 이차 베지어(a → c 쪽으로 휘어 → b) */
function bezierArc(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, u: number, out: THREE.Vector3): THREE.Vector3 {
  const v = 1 - u;
  out.set(v * v * a.x + 2 * v * u * c.x + u * u * b.x, v * v * a.y + 2 * v * u * c.y + u * u * b.y, v * v * a.z + 2 * v * u * c.z + u * u * b.z);
  return out;
}

export function createPrologue(cast: PrologueCast): Prologue {
  const scene = cast.scene;
  const photo = photoLineup(cast.slots);
  const ui: PrologueUi = createPrologueUi(document);
  const camera = new THREE.PerspectiveCamera(photo.camera.fov, 16 / 9, 0.1, 500);
  const sky = skyDome();
  scene.add(sky);

  // 썰매·눈더미 처음(처박힌) 모습
  const sleigh = cast.sleigh;
  const sleighBase = { pos: sleigh.position.clone(), rot: sleigh.rotation.clone() };
  sleigh.rotation.order = 'YZX'; // 굴림(x) → 끄덕임(z) → 방향(y)
  const pileScale = cast.snowPile ? cast.snowPile.scale.clone() : null;

  // 별빛: 머리 + 꼬리(지나온 자리 24개)
  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,226,140,0.85)');
  const streak = new THREE.Group();
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.scale.setScalar(10);
  streak.add(head);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, color: '#ffd98a' }));
  halo.scale.setScalar(26);
  streak.add(halo);
  const TRAIL = 40;
  const trail: THREE.Sprite[] = [];
  for (let i = 0; i < TRAIL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(7.5 * (1 - i / (TRAIL * 1.15)));
    streak.add(s);
    trail.push(s);
  }
  /** 별빛 자리(구간 비율 k): 하늘 멀리서 썰매 길 처음까지, 살짝 휘며 */
  const streakAt = (k: number, out: THREE.Vector3) => {
    out.lerpVectors(STREAK_FROM, STREAK_TO, ease(Math.min(1, Math.max(0, k))));
    out.y += Math.sin(Math.min(1, Math.max(0, k)) * Math.PI) * 8;
    return out;
  };
  streak.visible = false;
  scene.add(streak);

  // 눈 튀김(부딪힐 때·도토가 눈을 털 때)
  const N = 180;
  const puffPos = new Float32Array(N * 3);
  const puffVel = new Float32Array(N * 3);
  const puffLife = new Float32Array(N);
  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
  const puffs = new THREE.Points(
    puffGeo,
    new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(240,246,255,0.9)'), size: 0.5, transparent: true, depthWrite: false, color: '#ffffff' }),
  );
  puffs.frustumCulled = false;
  scene.add(puffs);
  let puffNext = 0;
  const burst = (x: number, y: number, z: number, n: number, speed: number, spread = 1) => {
    for (let k = 0; k < n; k++) {
      const i = puffNext++ % N;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      puffPos.set([x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread], i * 3);
      puffVel.set([Math.cos(a) * speed * (0.4 + Math.random()), up * speed * 1.2, Math.sin(a) * speed * (0.4 + Math.random())], i * 3);
      puffLife[i] = 0.7 + Math.random() * 0.6;
    }
  };
  for (let i = 0; i < N; i++) puffPos[i * 3 + 1] = -100;

  // 썰매 길: 하늘(별빛 끝)에서 내려와 광장을 미끄러져 눈더미에 코를 박는다
  const end = sleighBase.pos.clone();
  // 남서쪽 하늘에서 광장 위로 낮게 들어와(공방·집 위를 지나지 않는다) 동쪽으로 미끄러진다
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-46, 30, 24),
    new THREE.Vector3(-24, 15, 12),
    new THREE.Vector3(-10, 4.2, 1.5),
    new THREE.Vector3(-2.8, 0.55, -5.0),
    end.clone(),
  ]);
  // 별빛은 북서쪽 높은 하늘에서 남서쪽으로 하늘을 가로지른다(사진기 오른쪽 위 → 왼쪽 아래)
  const STREAK_FROM = new THREE.Vector3(-70, 80, -90);
  const STREAK_TO = path.getPointAt(0);

  // 짐칸(썰매 뒤쪽) 자리: 물건·요정이 튀어나오는 곳
  const cargoAt = new THREE.Vector3(end.x - 1.4, 1.9, end.z);
  const cargoFrom = cast.cargo.map(() => cargoAt.clone());
  const tmpV = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  // 인물 자리
  const santaSeat = new THREE.Vector3(end.x - 1.5, 0.85, end.z);
  // 산타는 썰매 남쪽으로 내려선다(받치는 자리 바로 옆, 북쪽은 유나네 골목 표식 쪽이라 비운다)
  const santaHop = new THREE.Vector3(end.x + 1.0, 0, end.z + 2.4);
  // 도토는 썰매 꼬리 남쪽 눈 속에서 튀어나온다(산타와 떨어지고, 사진기가 가운데 트리 가지 속에 들어가지 않게)
  // 도토가 눈 속에서 튀어나오는 곳: 썰매 꼬리 서쪽 빈 눈밭(썰매·산타·트리 사이는 좁아 사진기 앞을 가렸다) → 썰매 날 고치는 자리로 걸어간다
  const dotoPop = new THREE.Vector3(end.x - 3.6, 0, end.z + 0.6);
  /** 튀어나와 눈을 털 때 보는 쪽(사진기 쪽, 서쪽) */
  const DOTO_POP_FACING = -1.15;
  const dotoFix = new THREE.Vector3(cast.dotoFix.x, 0, cast.dotoFix.z);

  let t = 0;
  let done = false;
  let photoSaved = false;
  let shake = 0;
  let impacted = false;
  const landed = cast.elves.map(() => false);
  let last = { santa: '', doto: '' };
  let lastT = 0;
  let afterDim = 1;

  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const setCam = (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
    camPos.set(px, py, pz);
    camTgt.set(tx, ty, tz);
  };

  const savePhoto = () => {
    if (photoSaved) return;
    photoSaved = true;
    cast.onPhoto(photo);
  };

  const place = (v: ElfView | DogView, x: number, y: number, z: number, facing: number) => {
    v.root.position.set(x, y, z);
    v.root.rotation.set(0, facing, 0);
  };
  const santaAct = (clip: string | null, o?: { once?: boolean }) => {
    const key = `${clip}${o?.once ? '!' : ''}`;
    if (last.santa === key) return;
    last.santa = key;
    cast.santa.act?.(clip, o);
  };
  const dotoAct = (clip: string | null, o?: { once?: boolean }) => {
    const key = `${clip}${o?.once ? '!' : ''}`;
    if (last.doto === key) return;
    last.doto = key;
    cast.doto.act?.(clip, o);
  };

  // ── ① 썰매 비행 ──────────────────────────────
  // 하늘 길: 광장 동쪽 높은 데서 남쪽 하늘을 지나 서쪽으로 돌다가, 눈보라에 흔들려 북서쪽으로 기울며 떨어진다(하얗게 → 땅).
  // 마을 위 25~35 m: 내려다보면 불 켜진 광장·트리·집들이 보인다
  const flightPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(56, 31, -4),
    new THREE.Vector3(36, 29, 17),
    new THREE.Vector3(12, 28, 28),
    new THREE.Vector3(-12, 28, 27),
    new THREE.Vector3(-31, 30, 13),
    new THREE.Vector3(-41, 33, -6),
    new THREE.Vector3(-38, 30, -26),
    new THREE.Vector3(-26, 19, -40),
  ]);
  /** 썰매 안 자리(썰매 모형 단위, 앞 = +x, 남쪽 옆 = +z): 산타 좌석 면, 요정 발판, 도토 맨 앞 */
  // 요정·도토는 바닥에 실은 선물 상자 위에 올라서서(바닥 + 0.14) 옆판 너머로 마을을 본다
  const SEAT = { santa: new THREE.Vector3(-0.66, 0.72, 0), elves: 0.5, floor: 0.66, doto: new THREE.Vector3(0.86, 0.66, 0) };
  const qFace = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // 인물 앞(+z) → 썰매 앞(+x)
  const qTmp = new THREE.Quaternion();
  const sleighQ = new THREE.Quaternion();
  const cf = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  /** 썰매에 태운다: 썰매 모형 단위 자리 → 월드, 썰매 방향 + 인물 방향(yaw, 썰매 앞 기준) */
  const ride = (v: ElfView, local: THREE.Vector3, yaw = 0) => {
    v.root.position.copy(local).applyMatrix4(sleigh.matrixWorld);
    v.root.quaternion.copy(sleighQ).multiply(qFace).multiply(qTmp.setFromAxisAngle(tmpA.set(0, 1, 0), yaw));
  };
  // 남쪽 날에서 튀어 나가는 나사(금색 작은 공)
  const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#e0b64e', metalness: 0.7, roughness: 0.3 }));
  bolt.visible = false;
  scene.add(bolt);
  const boltVel = new THREE.Vector3();
  let boltOut = false;
  let runnerSouth: THREE.Object3D | null = null;
  sleigh.traverse((o) => {
    if (o.name === 'runnerSouth') runnerSouth = o;
  });
  const runnerRot = runnerSouth ? (runnerSouth as THREE.Object3D).rotation.clone() : null;
  let flightDone = false;

  /** 썰매 비행 장면(t < F.end) */
  function flight(dt: number): void {
    savePhoto();
    cast.kongi.root.visible = false;
    // 바람: 처음엔 잔잔(눈발 조금) → 눈보라
    const gustK = ease(seg(t, [F.gust[0] - 0.6, F.gust[0] + 0.8]));
    cast.storm(0.72 + 0.28 * gustK); // 밤(눈보라 조명이 어둡다) + 바람
    const stars = sky.getObjectByName('stars') as THREE.Points | undefined;
    if (stars) (stars.material as THREE.PointsMaterial).opacity = 0.85 - 0.5 * gustK;

    // 썰매: 하늘 길을 따라(앞 = 진행 방향), 돌 때 안쪽으로 기울고, 눈보라에 흔들리고, 떨어질 때 머리를 숙이며 구른다
    const u = Math.min(0.999, Math.max(0, t / F.end)); // 시작 직후 t가 잠깐 음수(어둡게 시작)
    const p = flightPath.getPointAt(u, tmpB);
    const tan = flightPath.getTangentAt(u, tmpV);
    const h = Math.hypot(tan.x, tan.z);
    const yaw = Math.atan2(-tan.z, tan.x);
    const ahead = flightPath.getTangentAt(Math.min(0.999, u + 0.04), tmpA);
    const turnRate = Math.atan2(ahead.x * tan.z - ahead.z * tan.x, ahead.x * tan.x + ahead.z * tan.z);
    const shakeK = gustK * (1 - ease(seg(t, F.dive)) * 0.3);
    const dive = ease(seg(t, F.dive));
    const roll = -turnRate * 3 + Math.sin(t * 11) * 0.12 * shakeK + Math.sin(t * 4.3) * 0.08 * shakeK + dive * Math.sin(t * 5) * 0.45;
    const nose = Math.atan2(tan.y, h) * 0.8 + Math.sin(t * 7.7) * 0.06 * shakeK - dive * 0.35;
    sleigh.visible = true;
    sleigh.position.copy(p).add(tmpA.set(0, Math.sin(t * 1.6) * 0.3, 0));
    sleigh.rotation.set(roll, yaw, nose, 'YZX');
    sleigh.updateMatrixWorld(true);
    sleigh.getWorldQuaternion(sleighQ);
    if (cast.snowPile) cast.snowPile.visible = false;

    // 산타: 좌석에 앉아 앞을 본다(눈보라에 고개를 움츠린다)
    cast.santa.root.visible = true;
    santaAct('Sit');
    ride(cast.santa, SEAT.santa);
    cast.santa.look?.(0.15 * gustK);
    cast.santa.animate(t, false);

    // 요정들: 발판에 나란히 서서 선물을 안고 마을을 내려다본다 → 눈보라에 깜짝(움찔) → 떨어질 때 매달린다
    const n = cast.elves.length;
    cast.elves.forEach((e, i) => {
      const z = n > 1 ? -0.42 + (0.84 * i) / (n - 1) : 0;
      e.root.visible = true;
      e.root.scale.setScalar(cast.elfScale);
      // 모두 마을 쪽(썰매 안쪽 옆, +z)으로 조금 돌아 내려다본다
      ride(e, tmpV.set(SEAT.elves, SEAT.floor, z), -0.35 - 0.3 * (z + 0.42));
      e.look?.(t < F.gust[0] ? 0.55 : 0.1);
      if (t >= F.gust[0] && e.root.userData.startled !== true) {
        e.root.userData.startled = true;
        e.act?.('HitRecieve', { once: true });
      }
      if (t >= F.dive[0] && e.root.userData.cling !== true) {
        e.root.userData.cling = true;
        e.act?.('HitRecieve');
      }
      // 손에 안은 선물(재봉틀 상자는 짐칸 아래라 안 보인다)
      const g = cast.cargo[i + 1];
      e.animate(t, false, { carry: g ? 'light' : 'none', act: 0, tired: false });
      if (g) {
        g.v.visible = true;
        e.root.updateMatrixWorld(true);
        placeOnHands(g.v, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, { x: e.root.position.x, z: e.root.position.z, yaw: 0 }, cast.elfScale);
      }
    });
    cast.cargo.forEach((g, i) => {
      if (i === 0 || i > n) g.v.visible = false;
    });

    // 도토: 맨 앞에서 고글을 쓰고 길잡이 → 나사가 튀어 나가면 남쪽(뒤쪽 아래) 날을 돌아본다
    const d = cast.doto;
    d.root.visible = true;
    d.root.scale.setScalar(cast.elfScale);
    const lookBack = ease(seg(t, [F.bolt, F.bolt + 0.5]));
    ride(d, SEAT.doto, -2.2 * lookBack);
    d.look?.(0.35 * lookBack);
    if (t >= F.bolt && d.root.userData.alarm !== true) {
      d.root.userData.alarm = true;
      dotoAct('HitRecieve', { once: true });
    }
    d.animate(t, false);

    // 나사: 남쪽 날 가운데에서 튀어 나가 뒤로 떨어진다(반짝), 그 뒤로 그 날이 덜컹거린다
    if (t >= F.bolt) {
      if (!boltOut) {
        boltOut = true;
        bolt.visible = true;
        bolt.position.set(-0.2, 0.06, 0.62).applyMatrix4(sleigh.matrixWorld);
        // 썰매 뒤쪽·바깥(남쪽)·위로 튄다
        boltVel.set(-6, 3, 2.5).applyQuaternion(sleighQ);
        burst(bolt.position.x, bolt.position.y, bolt.position.z, 12, 2.4, 0.3);
      }
      boltVel.y -= 9.8 * dt;
      bolt.position.addScaledVector(boltVel, dt);
      bolt.rotation.x += dt * 20;
      if (runnerSouth && runnerRot) {
        const rs = runnerSouth as THREE.Object3D;
        rs.rotation.set(runnerRot.x + Math.sin(t * 38) * 0.06, runnerRot.y, runnerRot.z + Math.sin(t * 29) * 0.05);
      }
    }

    // 화면: 처음 검은 데서 밝아지고, 끝에 하얀 눈보라 속으로
    ui.dim(1 - ease(seg(t, [0, 0.8])));
    ui.flash(ease(seg(t, [F.white[0], F.end])));

    // 사진기(구간마다 한 컷). 썰매 기준 자리는 방향(yaw)만 따른다(기울기·흔들림은 따라가지 않아 화면이 안정)
    const yf = (lx: number, ly: number, lz: number, out: THREE.Vector3) => {
      const k = 1.8; // 광장 썰매 배율
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      return out.set(sleigh.position.x + (lx * c + lz * sn) * k, sleigh.position.y + ly * k, sleigh.position.z + (-lx * sn + lz * c) * k);
    };
    let fov = 44;
    if (t < F.wide[1]) {
      // 높은 데서: 썰매가 밤하늘을 가로지르고 아래로 불 켜진 마을
      const k = ease(seg(t, F.wide));
      setCam(16, 39, 50, 42 - 20 * k, 28 - 2 * k, 4 + 16 * k);
      fov = 46;
    } else if (t < F.ride[1]) {
      // 썰매 옆(바깥쪽)에서: 썰매 너머 아래로 마을. 조금씩 앞으로 밀며
      const k = ease(seg(t, F.ride));
      yf(0.9 - 0.6 * k, 1.9, -3.6, camPos);
      yf(0.1, 0.55, 0.2, camTgt);
      fov = 42;
    } else if (t < F.gust[1]) {
      // 눈보라: 마을 쪽 썰매 날 가까이 낮게(나사가 튀어 나가는 것이 보이게), 흔들린다
      yf(0.5, 0.15, 3.6, camPos);
      yf(-0.3, 0.3, 0.6, camTgt);
      const j = 0.06 * (cast.reduceMotion ? 0 : 1);
      camPos.add(tmpA.set((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j));
      fov = 46;
    } else {
      // 떨어진다: 뒤 위에서 머리를 숙인 썰매를 따라간다
      yf(-4.4, 2.6, -1.2, camPos);
      yf(3.0, -1.2, 0.2, camTgt);
      fov = 50;
    }
    camera.fov = fov;
  }

  /** 비행이 끝났다: 땅 장면을 위해 인물·썰매를 되돌린다(불시착 장면이 다시 놓는다) */
  function endFlight(): void {
    flightDone = true;
    bolt.visible = false;
    if (runnerSouth && runnerRot) (runnerSouth as THREE.Object3D).rotation.copy(runnerRot);
    if (cast.snowPile) cast.snowPile.visible = true;
    santaAct(null);
    cast.santa.root.visible = false;
    cast.doto.root.visible = false;
    dotoAct(null);
    cast.elves.forEach((e) => {
      e.act?.(null);
      e.look?.(0);
      e.root.visible = false;
      e.root.quaternion.identity();
    });
    for (const g of cast.cargo) g.v.visible = false;
    sleigh.visible = false;
  }

  /** 시각 t의 장면을 놓는다 */
  function pose(dt: number): void {
    if (t < F.end) {
      flight(dt);
      return;
    }
    if (!flightDone) endFlight();
    ui.finder(false, false);
    ui.card(0, 0);
    // 하얀 눈보라가 걷히며 땅의 광장(③). 끝에 어둡게
    if (t < C.impact) ui.flash(1 - ease(seg(t, [F.end, F.white[1]])));
    ui.dim(ease(seg(t, P.fadeOut)));

    // ── ② 땅: 눈보라 → 별빛 → 썰매 불시착 ──
    cast.kongi.root.visible = false;
    const storm = t < C.calm[0] ? 1 : 1 - 0.85 * ease(seg(t, C.calm));
    cast.storm(storm);
    const stars = sky.getObjectByName('stars') as THREE.Points | undefined;
    if (stars) (stars.material as THREE.PointsMaterial).opacity = 0.25 + 0.6 * (1 - storm);

    // 별빛
    const ks = seg(t, C.streak);
    streak.visible = ks > 0 && t < C.sleigh[0] + 0.6;
    if (streak.visible) {
      // 썰매가 나타나면 별빛은 썰매를 따라가며 사그라든다
      const sp = t < C.sleigh[0] ? streakAt(ks, tmpA) : tmpA.copy(sleigh.position).add(tmpV.set(0, 1.2, 0));
      head.position.copy(sp);
      halo.position.copy(sp);
      const dur = C.streak[1] - C.streak[0];
      trail.forEach((s, i) => streakAt(ks - (i + 1) * (0.012 / dur) * 6, s.position));
      const fade = t < C.sleigh[0] ? Math.min(1, ks * 6) : 1 - seg(t, [C.sleigh[0], C.sleigh[0] + 0.6]);
      (head.material as THREE.SpriteMaterial).opacity = fade;
      (halo.material as THREE.SpriteMaterial).opacity = 0.35 * fade;
      trail.forEach((s, i) => ((s.material as THREE.SpriteMaterial).opacity = 0.75 * (1 - i / TRAIL) * fade * (i / TRAIL < ks * 4 ? 1 : 0)));
    }

    // 썰매
    const kf = seg(t, C.sleigh);
    if (t < C.sleigh[0]) {
      sleigh.visible = false;
    } else if (kf < 1) {
      sleigh.visible = true;
      const u = 1 - Math.pow(1 - kf, 1.5);
      const p = path.getPointAt(u, tmpB);
      const tan = path.getTangentAt(Math.min(0.999, u), tmpV);
      sleigh.position.copy(p);
      const h = Math.hypot(tan.x, tan.z);
      const yaw = Math.atan2(-tan.z, tan.x);
      const nose = Math.atan2(tan.y, h) * 0.8;
      const settle = seg(kf, [0.85, 1]);
      sleigh.rotation.set(Math.sin(t * 17) * 0.12 * (1 - kf), yaw * (1 - settle) + sleighBase.rot.y * settle, nose * (1 - settle) + sleighBase.rot.z * settle, 'YZX');
    } else {
      sleigh.visible = true;
      sleigh.position.copy(end);
      // 산타가 받치면 앞이 조금 들린다
      const hold = ease(seg(t, C.santaHold));
      const tilt = sleighBase.rot.z + (cast.sleighHeldTilt - sleighBase.rot.z) * hold;
      const after = seg(t, [C.impact, C.impact + 0.5]);
      const wobble = Math.sin(after * Math.PI * 3) * 0.06 * (1 - after);
      sleigh.rotation.set(wobble, sleighBase.rot.y, tilt, 'YZX');
    }
    if (!impacted && t >= C.impact) {
      impacted = true;
      burst(end.x + 2.6, 0.8, end.z, 110, 3.2, 1.6);
      burst(end.x, 0.4, end.z + 1.2, 40, 2.2, 3);
      if (!cast.reduceMotion) shake = 1;
    }
    // 부딪히는 순간 눈 구름이 하얗게 일었다 가라앉는다
    if (t >= C.impact) ui.flash(0.55 * (1 - ease(seg(t, [C.impact, C.impact + 0.9]))));
    // 그림 이름표: 사진기가 선물들을 훑을 때 하나씩 톡
    cast.tags.forEach((g, i) => {
      const s0 = C.tags[0] + i * 0.4;
      const k = seg(t, [s0, s0 + 0.35]);
      g.obj.visible = k > 0;
      if (!g.obj.visible) return;
      const base = (g.obj.userData.baseScale as THREE.Vector3 | undefined) ?? g.obj.scale.clone();
      g.obj.userData.baseScale = base;
      const pop = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + 0.35 * Math.sin(k * Math.PI)) : 1;
      g.obj.scale.copy(base).multiplyScalar(Math.max(0.01, pop));
      const to = cast.cargo[i]!.to;
      g.obj.position.set(to.x, g.y, to.z);
    });
    if (cast.snowPile && pileScale) {
      const k = seg(t, [C.impact, C.impact + 0.7]);
      const squash = t < C.impact ? 1 : 1 - 0.3 * Math.sin(k * Math.PI) * (1 - k * 0.5);
      cast.snowPile.scale.set(pileScale.x * (1 + (1 - squash) * 0.5), pileScale.y * squash, pileScale.z * (1 + (1 - squash) * 0.5));
    }

    // 물건: 짐칸에서 튀어나와 흩어진다
    cast.cargo.forEach((g, i) => {
      const s0 = C.gifts[0] + i * 0.12;
      const dur = g.heavy ? 0.7 : 0.95;
      const k = seg(t, [s0, s0 + dur]);
      g.v.visible = t >= s0;
      if (!g.v.visible) return;
      const to = tmpA.set(g.to.x, 0, g.to.z);
      arc(cargoFrom[i]!, to, g.heavy ? 1.2 : 3.2 + (i % 3) * 0.6, ease(k) * 0.3 + k * 0.7, g.v.position);
      const spin = (1 - k) * (2 + i);
      g.v.rotation.set(g.heavy ? 0 : spin * 1.3, g.to.facing + spin, g.heavy ? 0 : spin * 0.7);
      if (k >= 1 && g.v.userData.puffed !== true) {
        g.v.userData.puffed = true;
        burst(g.to.x, 0.1, g.to.z, g.heavy ? 26 : 10, g.heavy ? 1.6 : 1.0, 0.6);
      }
    });

    // 요정들: 짐칸에서 튕겨 나가 눈밭에 쓰러진다 → (정적) → 하나씩 일어나 두리번거린다
    cast.elves.forEach((e, i) => {
      const s0 = C.elves[0] + i * 0.25;
      const k = seg(t, [s0, s0 + 0.85]);
      const spot = cast.elfStarts[i]!;
      const rise = C.elfUp[0] + i * 0.7;
      e.look?.(0);
      if (t < s0) {
        e.root.visible = false;
        return;
      }
      e.root.visible = true;
      // 썰매(트리 북동)에서 트리 남쪽 시작 자리로: 곧게 날면 트리 가지를 뚫고 지나가므로 트리 동쪽으로 돌아 떨어진다
      bezierArc(tmpB.set(end.x - 0.8, 2.1, end.z + 0.4), tmpV.set(6.6, 4.6, 1.4), tmpA.set(spot.x, 0, spot.z), k, e.root.position);
      // 공중제비는 떨어지기 직전에 끝나고, 닿기 직전부터 쓰러지는 동작
      const spin = Math.min(1, k / 0.75);
      // 쓰러져 있다 일어나 두리번거리는 동안은 사진기(남동쪽) 쪽을 보고, 사진기가 산타에게 간 뒤 시작 방향으로 돈다
      const toCam = 0.35 + (i % 2 ? 0.4 : -0.35);
      const back = ease(seg(t, [C.santaUp[0] + 0.6, C.santaUp[0] + 1.6]));
      let yaw = toCam + (spot.facing - toCam) * back;
      if (k >= 0.75 && !landed[i]) {
        landed[i] = true;
        e.act?.('Death', { once: true, speed: 1.6 });
      }
      if (k >= 1 && e.root.userData.puffed !== true) {
        e.root.userData.puffed = true;
        burst(spot.x, 0.1, spot.z, 14, 1.0, 0.6);
      }
      if (t >= rise) {
        if (e.root.userData.rose !== true) {
          e.root.userData.rose = true;
          // 쓰러진 자세에서 앉고 → 쪼그려 앉고 → 선다(뼈 동작 GetUp, 없는 모델은 천천히 풀기)
          if (!e.act?.('GetUp', { once: true })) e.act?.(null, { fade: 1.1 });
        }
        // 일어나서 두리번(왼쪽·오른쪽을 본다) → 시작 방향
        const u = seg(t, [rise + 0.9, C.elfUp[1] + 0.4]);
        yaw += Math.sin(u * Math.PI * 2) * 0.7 * (1 - u);
        e.look?.(0.25 * Math.sin(Math.min(1, (t - rise) / 0.9) * Math.PI));
      }
      e.root.rotation.set(k < 1 ? spin * Math.PI * 2 : 0, yaw, 0);
      e.animate(t, false);
    });

    // 산타: 썰매 안에서 일어나 → 북동쪽으로 내려서서 → 손 흔들기(무사) → 썰매 앞을 받친다
    const santa = cast.santa;
    santa.look?.(0);
    if (t < C.santaUp[0]) santa.root.visible = false;
    else {
      santa.root.visible = true;
      const toCam = Math.atan2(camPos.x - santaHop.x, camPos.z - santaHop.z);
      if (t < C.santaOut[0]) {
        const k = ease(seg(t, C.santaUp));
        // 모자가 먼저 쑥, 어리둥절하게 고개를 저으며 일어선다
        place(santa, santaSeat.x, -2.6 + (santaSeat.y + 2.6) * k, santaSeat.z, 0.4 + Math.sin(t * 5) * 0.25 * (1 - k));
        santaAct(null);
        santa.look?.(0.35 * (1 - k));
      } else if (t < C.santaWave[0]) {
        const k = seg(t, C.santaOut);
        arc(santaSeat, santaHop, 1.0, ease(k), santa.root.position);
        santa.root.rotation.set(0, 0.4 + (toCam - 0.4) * ease(k), 0);
        santaAct(null);
      } else if (t < C.santaHold[0]) {
        place(santa, santaHop.x, 0, santaHop.z, toCam);
        santaAct('Wave');
      } else {
        const k = ease(seg(t, C.santaHold));
        const h = cast.santaHold;
        place(santa, santaHop.x + (h.x - santaHop.x) * k, 0, santaHop.z + (h.z - santaHop.z) * k, toCam + (h.facing - toCam) * k);
        santaAct(null);
      }
      const holding = t >= C.santaHold[0] + 0.3;
      santa.animate(t, t >= C.santaHold[0] && t < C.santaHold[1] - 0.3, { carry: holding ? 'heavy' : 'none', act: 0, tired: false });
    }

    // 도토: 눈더미에서 쑥 → 몸을 부르르 털고 → 썰매 날 앞으로 가 살핀다
    const doto = cast.doto;
    if (t < C.dotoUp[0]) doto.root.visible = false;
    else {
      doto.root.visible = true;
      const s = cast.elfScale;
      doto.root.scale.setScalar(s);
      if (t < C.dotoShake[0]) {
        const k = ease(seg(t, C.dotoUp));
        place(doto, dotoPop.x, -1.4 * s * (1 - k), dotoPop.z, DOTO_POP_FACING);
        dotoAct(null);
        doto.animate(t, false);
      } else if (t < C.dotoWalk[0]) {
        const k = seg(t, C.dotoShake);
        place(doto, dotoPop.x, Math.abs(Math.sin(k * Math.PI * 6)) * 0.05, dotoPop.z, DOTO_POP_FACING + Math.sin(t * 38) * 0.4 * (1 - k));
        if (Math.floor(lastT * 10) !== Math.floor(t * 10)) burst(dotoPop.x, 1.2 * s, dotoPop.z, 5, 1.6, 0.5);
        doto.animate(t, false);
      } else {
        const k = seg(t, C.dotoWalk);
        const dx = dotoFix.x - dotoPop.x;
        const dz = dotoFix.z - dotoPop.z;
        const walking = k < 1;
        const facing = walking ? Math.atan2(dx, dz) : cast.dotoFix.facing;
        place(doto, dotoPop.x + dx * k, 0, dotoPop.z + dz * k, facing);
        if (walking) dotoAct(null);
        else dotoAct('Interact');
        doto.animate(t, walking);
      }
    }

    // 사진기: 장면마다 한 컷, 컷 사이는 부드럽게 옮긴다
    const shot = shotAt(t, ks);
    setCam(shot.p.x, shot.p.y, shot.p.z, shot.q.x, shot.q.y, shot.q.z);
    camera.fov = shot.fov;
  }

  type Shot = { p: THREE.Vector3; q: THREE.Vector3; fov: number };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const elfMid = () => {
    const m = V(0, 0, 0);
    cast.elfStarts.forEach((s) => m.add(V(s.x, 0, s.z)));
    return m.multiplyScalar(1 / Math.max(1, cast.elfStarts.length));
  };
  const SKY0 = V(-34, 18, -12);
  /** 컷 목록: 시작 시각, 앞 컷에서 옮겨 오는 시간, 그 시각의 사진기 */
  const SHOTS: { at: number; blend: number; get: (t: number, ks: number) => Shot }[] = [
    // 폭풍 전 고요: 아무도 없는 광장(썰매 자리)을 보다가 하늘로 고개를 든다
    {
      at: F.end,
      blend: 0,
      get: (t) => {
        const k = ease(seg(t, C.quiet));
        return { p: V(15, 3.4, 13).lerp(V(10, 1.8, 10), k), q: V(1, 1.2, -4).lerp(SKY0, k), fov: 54 };
      },
    },
    // 별빛을 반쯤 따라간다
    { at: C.streak[0], blend: 0, get: (_t, ks) => ({ p: V(10, 1.8, 10), q: SKY0.clone().lerp(streakAt(ks, V(0, 0, 0)), 0.55 * Math.min(1, ks * 3)), fov: 54 }) },
    // 내려오는 썰매를 가운데에 두고 따라간다(조금 앞서 본다)
    {
      at: C.sleigh[0],
      blend: 0,
      get: (t) => {
        const k = ease(seg(t, C.sleigh));
        const ahead = path.getPointAt(Math.min(1, 1 - Math.pow(1 - seg(t, C.sleigh), 1.5) + 0.08), V(0, 0, 0));
        const from = SKY0.clone().lerp(streakAt(1, V(0, 0, 0)), 0.55);
        return { p: V(10, 1.8, 10).lerp(V(10.5, 5.2, 7.5), k), q: from.lerp(ahead, ease(Math.min(1, seg(t, C.sleigh) * 3))), fov: 54 - 10 * k };
      },
    },
    // 부딪힘: 썰매와 흩어지는 짐
    { at: C.impact, blend: 0, get: () => ({ p: V(10.5, 5.2, 7.5), q: end.clone(), fov: 44 }) },
    // 눈 구름이 가라앉는 동안 쓰러진 요정들에게 낮게, 천천히 다가간다
    {
      at: C.settle[0] - 0.3,
      blend: 1.4,
      get: (t) => {
        const m = elfMid();
        const k = ease(seg(t, [C.settle[0], C.elfUp[1]]));
        const up = ease(seg(t, C.elfUp));
        // 누워 있을 때는 바짝, 일어나면 한 걸음 물러나 둘 다 머리끝까지 들어오게
        const p = m.clone().add(V(1.6, 0.55, 3.4).lerp(V(1.0, 0.5, 2.3), k)).add(V(0.4, 0.4, 1.6).multiplyScalar(up));
        return { p, q: m.clone().add(V(0, 0.25 + 0.55 * up, 0)), fov: 40 };
      },
    },
    // 산타: 썰매 안에서 모자가 쑥 → 일어나 내려서 손을 흔든다
    {
      at: C.santaUp[0],
      blend: 0.9,
      get: () => ({ p: V(10.5, 3.2, -0.6), q: cast.santa.root.position.clone().add(V(0, 2.6, 0)), fov: 44 }),
    },
    // 내려선 산타가 손을 흔든다: 오른쪽으로 비켜서서(가로등 lampA가 산타 앞을 가리지 않게) 조금 더 가까이
    {
      at: C.santaOut[1] - 0.3,
      blend: 0.9,
      get: () => ({ p: V(11.2, 3.0, -4.2), q: santaHop.clone().add(V(0, 2.5, 0)), fov: 44 }),
    },
    // 도토: 눈더미에서 튀어나와 눈을 털고 썰매 날로
    {
      at: C.dotoUp[0] + 0.2,
      blend: 0, // 바로 끊어 넘긴다(산타 컷에서 옮겨 가면 사진기가 썰매를 뚫고 지나갔다)
      get: () => {
        const d = cast.doto.root.position;
        // 남서쪽에 고정한 사진기(썰매를 비스듬히): 도토가 썰매 꼬리 서쪽 눈에서 튀어나와 → 썰매 날로 걸어가는 것을 한 화면에.
        // 뒤로 썰매 옆면과 (썰매 너머) 산타, 트리는 사진기 오른쪽 뒤라 화면 밖.
        // 예전(남쪽·동남쪽, 도토를 따라감)에는 트리 가지·장식 공·화단 턱·산타 다리가 화면 앞을 크게 가렸다
        void d;
        return { p: V(end.x - 6.4, 1.6, end.z + 3.4), q: V(end.x - 2.6, 0.8, end.z + 1.25), fov: 38 };
      },
    },
    // 산타가 썰매를 받치는 동안 물러나며 흩어진 선물(이름표)을 훑고 광장 전체로
    {
      at: C.santaHold[0],
      blend: 1.2,
      get: (t) => {
        const k = ease(seg(t, [C.santaHold[0], P.fadeOut[1]]));
        return { p: V(10.5, 5.5, 6.5).lerp(V(12.5, 11, 12.5), k), q: V(4, 1.2, -4.5).lerp(V(2.5, 0.6, -2.2), k), fov: 44 };
      },
    },
  ];
  function shotAt(t: number, ks: number): Shot {
    let i = 0;
    while (i + 1 < SHOTS.length && t >= SHOTS[i + 1]!.at) i++;
    const cur = SHOTS[i]!.get(t, ks);
    const sh = SHOTS[i]!;
    if (i > 0 && sh.blend > 0 && t < sh.at + sh.blend) {
      const prev = SHOTS[i - 1]!.get(t, ks);
      const k = ease((t - sh.at) / sh.blend);
      cur.p.lerpVectors(prev.p, cur.p, k);
      cur.q.lerpVectors(prev.q, cur.q, k);
      cur.fov = prev.fov + (cur.fov - prev.fov) * k;
    }
    return cur;
  }

  function updatePuffs(dt: number): void {
    for (let i = 0; i < N; i++) {
      if (puffLife[i]! <= 0) continue;
      puffLife[i] = puffLife[i]! - dt;
      const k = i * 3;
      puffVel[k + 1] = puffVel[k + 1]! - 6 * dt;
      puffPos[k] = puffPos[k]! + puffVel[k]! * dt;
      puffPos[k + 1] = Math.max(0.05, puffPos[k + 1]! + puffVel[k + 1]! * dt);
      puffPos[k + 2] = puffPos[k + 2]! + puffVel[k + 2]! * dt;
      if (puffLife[i]! <= 0) puffPos[k + 1] = -100;
    }
    puffGeo.attributes.position!.needsUpdate = true;
  }

  /** 끝 모습(플레이 시작 자리)으로 놓는다 */
  function finish(): void {
    if (!flightDone) endFlight();
    t = P.end;
    savePhoto();
    sleigh.visible = true;
    sleigh.position.copy(end);
    sleigh.rotation.set(0, sleighBase.rot.y, cast.sleighHeldTilt, 'YZX');
    if (cast.snowPile && pileScale) cast.snowPile.scale.copy(pileScale);
    cast.cargo.forEach((g) => {
      g.v.visible = true;
      g.v.position.set(g.to.x, 0, g.to.z);
      g.v.rotation.set(0, g.to.facing, 0);
    });
    cast.elves.forEach((e, i) => {
      const s = cast.elfStarts[i]!;
      e.root.visible = true;
      place(e, s.x, 0, s.z, s.facing);
      e.look?.(0);
      e.act?.(null);
    });
    cast.santa.root.visible = true;
    place(cast.santa, cast.santaHold.x, 0, cast.santaHold.z, cast.santaHold.facing);
    cast.santa.look?.(0);
    santaAct(null);
    cast.doto.root.visible = true;
    cast.doto.root.scale.setScalar(cast.elfScale);
    place(cast.doto, cast.dotoFix.x, 0, cast.dotoFix.z, cast.dotoFix.facing);
    dotoAct('Interact');
    cast.tags.forEach((g, i) => {
      g.obj.visible = true;
      const base = g.obj.userData.baseScale as THREE.Vector3 | undefined;
      if (base) g.obj.scale.copy(base);
      g.obj.position.set(cast.cargo[i]!.to.x, g.y, cast.cargo[i]!.to.z);
    });
    cast.kongi.root.visible = false;
    streak.visible = false;
    for (let i = 0; i < N; i++) puffLife[i] = 0;
    puffs.visible = false;
    cast.storm(0);
    ui.finder(false, false);
    ui.flash(0);
    ui.card(0, 0);
    ui.dim(1);
    afterDim = 1;
    done = true;
  }

  return {
    camera,
    get t() {
      return t;
    },
    get done() {
      return done;
    },
    get closed() {
      return done && afterDim <= 0;
    },
    photo,
    update(dt, aspect) {
      camera.aspect = aspect;
      if (done) {
        // 플레이 화면이 깜깜한 데서 밝아진다
        afterDim = Math.max(0, afterDim - dt / 0.45);
        ui.dim(afterDim);
        return;
      }
      lastT = t;
      t += dt;
      if (t >= P.end) {
        finish();
        return;
      }
      pose(dt);
      updatePuffs(dt);
      // 흔들림(부딪힌 순간, 흔들림 줄이기 설정이면 없음)
      shake = Math.max(0, shake - dt * 1.8);
      const sh = shake * shake * 0.35;
      camera.position.copy(camPos).add(tmpV.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
      camera.lookAt(camTgt);
      camera.updateProjectionMatrix();
      cast.snowAround(dt, camTgt.x, camTgt.z, 16, t < F.end ? Math.max(0, Math.min(camPos.y, camTgt.y) - 6) : 0);
    },
    afterRender() {
      // 예전 첫 연출(단체사진 → 사진 카드)에서 셔터 순간 화면을 카드에 담던 자리. 지금은 할 일 없음
    },
    skip() {
      if (!done) finish();
    },
    dispose() {
      ui.dispose();
      scene.remove(sky, streak, puffs);
      sky.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}
