// 미니 요정: Quaternius Hooded Adventurer(CC0)를 꼬마 요정으로 꾸민다.
//   머리 1.75배·다리 짧게·몸통 통통하게, 옷 다시 칠하기, 후드 숨김, 눈 검정,
//   이마~눈썹 위까지 덮는 요정 모자(색 + 무늬로 네 요정 구분), 뾰족 귀.
// 원점은 발바닥 중심, 앞은 +z(기본 도형 요정과 같다). 키는 모자 빼고 약 1.1 m.
// 시제품: tools/prototypes/mini-elf-hooded.html
import * as THREE from 'three';
import type { ElfLook, HatPattern } from '../data/elves';
import { NO_POSE, type ElfPose } from './elf';
import type { ElfView } from './elf';
import type { Models } from './models';

/** 모자 뺀 키(m). 1280×720 교실 화면에서도 요정이 잘 보이게 */
const BODY_HEIGHT = 1.1;
/** 서 있는 동작(시제품에서 비교해 고른다) */
const IDLE_CLIP = 'Idle_Neutral'; // 'Idle'은 한쪽 다리에 무게를 싣고 다리를 꼬아 짝다리로 보였다

/** 부위별 색(메시 이름 → 재질 이름 → 색). null은 숨김 */
const PAINT: Record<string, Record<string, string | null>> = {
  Medieval_Head: { Black: '#111111', Brown: '#3a2414', White: '#8a5a2b', Skin: '#f1c9a5', DarkBrown: null },
  // 몸통 초록 · 허리띠 금색(몸통과 다리 사이 경계가 화면에서 읽히게)
  Medieval_Body: { Black: '#2f8a3e', DarkBrown: '#256b31', LightBrown: '#e2b23c', Skin: '#f1c9a5', Gold: '#f2c14e', Metal: '#f7f7f7' },
  Medieval_Legs: { Black: '#c8323c' },
  // 장화: 짙은 갈색(눈 위에서 발끝 윤곽이 또렷하게)
  Medieval_Feet: { LightBrown: '#f4f1ea', DarkBrown: '#2f7a3e' }, // 흰·초록 긴 양말(장화는 따로 신긴다)
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
/** 요정 장화 한 짝(원점 = 바닥 위 발목 아래, 앞 = +z). 길이 약 0.2 */
function elfBoot(): THREE.Group {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#5a3420', roughness: 0.7 });
  const sole = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.9 });
  const fur = new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e2b23c', metalness: 0.5, roughness: 0.4 });
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), leather);
  foot.scale.set(0.95, 0.7, 1.7);
  foot.position.set(0, 0.045, 0.03);
  g.add(foot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 12), leather);
  shaft.position.set(0, 0.09, -0.01);
  g.add(shaft);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 8, 14), fur);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0.14, -0.01);
  g.add(cuff);
  const toe = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 10), leather);
  toe.position.set(0, 0.06, 0.13);
  toe.rotation.x = Math.PI / 2 - 0.9; // 앞으로 나가다 위로 말린다
  g.add(toe);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), gold);
  bell.position.set(0, 0.1, 0.165);
  g.add(bell);
  const sl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.2), sole);
  sl.position.set(0, 0.009, 0.03);
  g.add(sl);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.008), gold);
  buckle.position.set(0, 0.075, 0.075);
  g.add(buckle);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

export function createMiniElf(models: Models, look: ElfLook, opts: { idle?: string } = {}): ElfView | null {
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
  for (const n of ['FootL', 'FootR']) findBone(model, n)?.scale.set(1.35, 0.62, 1.35); // 장화를 도톰하게
  findBone(model, 'Torso')?.scale.set(1.28, 0.85, 1.28);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(models.animations('elf').map((c) => [c.name.replace('CharacterArmature|', ''), c] as const));
  const action = (n: string) => {
    const c = clips.get(n);
    return c ? mixer.clipAction(c) : null;
  };
  const idle = action(opts.idle ?? IDLE_CLIP);
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
  const baseY = model.position.y;

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
    hat.name = 'elfHat'; // 키를 잴 때(모자 제외) 찾는다
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

  // 요정 장화: 발 뼈에 붙여 걸음을 따라간다. 갈색 가죽 + 위로 말린 앞코 + 흰 털 단 + 금 버클(발끝 윤곽이 눈 위에서 또렷하게)
  model.updateMatrixWorld(true);
  for (const side of ['L', 'R'] as const) {
    const foot = findBone(model, `Foot${side}`);
    if (!foot) continue;
    const fp = foot.getWorldPosition(new THREE.Vector3());
    const fs = foot.getWorldScale(new THREE.Vector3()).x;
    const fq = foot.getWorldQuaternion(new THREE.Quaternion()).invert();
    const boot = elfBoot();
    boot.scale.setScalar(1 / fs);
    foot.add(boot);
    // 발목 아래, 바닥에 닿게(서 있는 자세 기준 월드 위치로 맞춘다)
    boot.position.copy(foot.worldToLocal(new THREE.Vector3(fp.x, 0, fp.z + 0.035)));
    boot.quaternion.copy(fq);
  }

  // 발밑 그림자(바닥 위 위치를 읽기 쉽게)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  // 팔 뼈: 위팔을 Z축으로 돌리면 앞으로 든다(왼쪽 -, 오른쪽 +, 시제품 tools/prototypes/elf-arm-axes.html로 확인)
  const bones = {
    ul: findBone(model, 'UpperArmL'),
    ur: findBone(model, 'UpperArmR'),
    ll: findBone(model, 'LowerArmL'),
    lr: findBone(model, 'LowerArmR'),
  };
  // 애니메이션 믹서는 값이 바뀌지 않은 뼈는 다시 쓰지 않는다(서 있기처럼 팔이 거의 안 움직이는 동작).
  // 그러면 매 프레임 더한 회전이 쌓여 팔이 빙글빙글 돈다 → 더하기 전의 "깨끗한" 값을 저장해 두고 매 프레임 되돌린 뒤 더한다
  const armBones = [bones.ul, bones.ur, bones.ll, bones.lr].filter((b): b is THREE.Bone => !!b);
  const clean = armBones.map((b) => b.quaternion.clone());
  // 서 있는 동작의 팔 자세(만들 때 서 있기 동작으로 맞춰 둔 값). 물건을 들면 걷기의 팔 흔들기 대신 이 자세 위에 드는 각을 더한다
  const rest = armBones.map((b) => b.quaternion.clone());
  let holdW = 0;
  const zAxis = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Quaternion();
  const raise = (b: THREE.Object3D | null | undefined, a: number) => {
    if (b && a !== 0) b.quaternion.multiply(tmp.setFromAxisAngle(zAxis, a));
  };
  // 자세별 팔 목표(위팔 앞으로 든 각, 아래팔 굽힘, 옆으로 벌림): 가슴 앞에 안기 / 손잡이 높이로 앞 / 빈손
  // 가벼운 선물은 손을 가슴 아래(손목 높이 ≈ 키의 0.62)에 두고 물건 폭만큼 팔을 벌려 옆면을 감싼다
  // (머리 위나 얼굴 앞으로 들면 물건이 얼굴을 가린다)
  const ARMS: Record<ElfPose['carry'], [number, number, number]> = { none: [0, 0, 0], light: [0.5, 0.6, 0], grip: [0.45, 0.25, 0], heavy: [0.7, 0.35, 0] };
  /** 벌림 각 → 두 손목 사이(요정 크기 1 기준): 벌리지 않으면 0.34 m, 1 rad마다 0.23 m 넓어진다(위 자세에서 잰 값) */
  const spreadFor = (span: number) => Math.min(1.2, Math.max(0, (span + 0.04 - 0.34) / 0.23));
  const yAxis = new THREE.Vector3(0, 1, 0);
  const walk = action('Walk');
  let last = -1;
  let gait: 'idle' | 'run' | 'walk' = 'idle';
  let up = 0;
  let low = 0;
  let spread = 0;
  const actionOf = (g: typeof gait) => (g === 'run' ? run : g === 'walk' ? walk ?? run : idle);
  const wl = findBone(model, 'WristL');
  const wr = findBone(model, 'WristR');
  return {
    root,
    hands(l, r) {
      if (!wl || !wr) return false;
      wl.getWorldPosition(l);
      wr.getWorldPosition(r);
      return true;
    },
    animate(timeSec, isMoving, pose = NO_POSE) {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, timeSec - last));
      last = timeSec;
      // 걸음: 빈손·가벼운 짐은 달리기, 무거운 짐을 함께 들면 느린 걸음
      const want: typeof gait = !isMoving ? 'idle' : pose.carry === 'heavy' ? 'walk' : 'run';
      if (want !== gait) {
        const from = actionOf(gait);
        const to = actionOf(want);
        if (from && to && from !== to) {
          to.reset().play();
          from.crossFadeTo(to, 0.2, false);
        }
        gait = want;
      }
      if (walk) walk.timeScale = 0.65; // 무거운 짐: 보폭은 그대로, 발을 천천히
      armBones.forEach((b, i) => b.quaternion.copy(clean[i]!));
      mixer.update(dt);
      armBones.forEach((b, i) => clean[i]!.copy(b.quaternion));
      // 들고 있으면 팔을 흔들지 않는다(손이 물건에 붙어 있게)
      const holdK = 1 - Math.exp(-dt * 12);
      holdW += ((pose.carry === 'none' ? 0 : 1) - holdW) * holdK;
      if (holdW > 0.001) armBones.forEach((b, i) => b.quaternion.slerp(rest[i]!, holdW));
      // 팔: 목표 자세로 부드럽게(뼈는 매 프레임 동작 값으로 돌아오므로 그 위에 더한다)
      const [tu, tl, ts0] = ARMS[pose.carry];
      const ts = pose.carry === 'light' && pose.span ? spreadFor(pose.span) : ts0;
      const k = 1 - Math.exp(-dt * 10);
      up += (tu - up) * k;
      low += (tl - low) * k;
      spread += (ts - spread) * k;
      const reach = Math.sin(Math.PI * pose.act); // 집기·놓기: 아래 앞으로 손을 뻗는다
      const shake = pose.tired ? Math.sin(timeSec * 34) * 0.18 : 0; // 지쳐서 손을 턴다
      const u = up * (1 - reach) + 0.9 * reach;
      raise(bones.ul, -(u + shake));
      raise(bones.ur, u - shake);
      raise(bones.ll, -low);
      raise(bones.lr, low);
      // 큰 물건을 안을 때 팔을 옆으로 벌린다(든 뒤의 위팔 Y축)
      if (spread) {
        bones.ul?.quaternion.multiply(tmp.setFromAxisAngle(yAxis, -spread));
        bones.ur?.quaternion.multiply(tmp.setFromAxisAngle(yAxis, spread));
      }
      // 집을 때 살짝 웅크린다, 무거운 짐을 들면 몸이 조금 낮아진다
      model.position.y = baseY - reach * 0.09 - (pose.carry === 'heavy' ? 0.03 : 0);
    },
  };
}
