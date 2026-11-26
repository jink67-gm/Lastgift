// 산타: 사용자가 준 에셋(models/custom/santa.glb). 뼈 15개(Hips·Spine·Head·UpperArm/Forearm/Hand·Thigh/Shin/Foot),
// 동작은 Idle·ReceiveGift 둘뿐이라 걷기·손 흔들기·썰매 받치기·고개 숙이기는 뼈를 직접 돌려 얹는다(화면 전용, 판정과 무관).
// 회전은 모두 "인물 기준 축"(x 인물 왼쪽, y 위, z 앞)으로 준다: 뼈마다 다른 로컬 축을 몰라도 된다.
import * as THREE from 'three';
import type { ElfPose, ElfView } from './elf';
import type { Models } from './models';

/** 에셋 기준: 모자를 뺀 머리 꼭대기 높이(m) */
const ASSET_HEAD_TOP = 1.66;

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** 손 흔들기 각도(인물 기준 축, 라디안): 위팔 옆으로 들기·앞으로, 아래팔 세우기, 흔들기 폭, 손목 따라 흔들기,
 *  아래팔 비틀기(손바닥이 앞, 엄지가 몸 안쪽) */
const WAVE = { raise: -1.6, forward: 0.1, bend: -1.4, swing: 0.36, wrist: 0.2, twist: 1.57 };
const WAVE_RATE = 7.5;
const _q = new THREE.Quaternion();
const _p = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _a = new THREE.Vector3();

export function createSantaAsset(models: Models, height: number): ElfView | null {
  const model = models.clone('santa');
  if (!model) return null;
  const root = new THREE.Group();
  const scale = height / ASSET_HEAD_TOP;
  model.scale.setScalar(scale);
  root.add(model);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false; // 뼈로 움직이는 몸은 처음 상자 밖으로 나간다
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.metalness = 0;
  });

  // 발밑 그림자
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42 * scale, 24),
    new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  const bone = (n: string) => {
    let b: THREE.Object3D | undefined;
    model.traverse((o) => {
      if (!b && (o as THREE.Bone).isBone && o.name.replace(/[.]/g, '') === n.replace(/[.]/g, '')) b = o;
    });
    return b ?? null;
  };
  const B = {
    hips: bone('Hips'),
    spine: bone('Spine'),
    head: bone('Head'),
    ul: bone('UpperArm.L'),
    ur: bone('UpperArm.R'),
    fl: bone('Forearm.L'),
    fr: bone('Forearm.R'),
    hr: bone('Hand.R'),
    tl: bone('Thigh.L'),
    tr: bone('Thigh.R'),
    sl: bone('Shin.L'),
    sr: bone('Shin.R'),
  };

  const clean = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  for (const b of Object.values(B)) if (b) clean.set(b, { q: b.quaternion.clone(), p: b.position.clone() });

  /** 뼈를 인물 기준 축(axis)으로 angle만큼 더 돌린다 */
  const turn = (b: THREE.Object3D | null, axis: THREE.Vector3, angle: number) => {
    if (!b?.parent || angle === 0) return;
    model.getWorldQuaternion(_r);
    b.parent.getWorldQuaternion(_p);
    _a.copy(axis).applyQuaternion(_r).applyQuaternion(_p.invert());
    _q.setFromAxisAngle(_a, angle);
    b.quaternion.premultiply(_q);
  };

  const mixer = new THREE.AnimationMixer(model);
  const clips = models.animations('santa');
  const actions = new Map(clips.map((c) => [c.name, mixer.clipAction(c)]));
  const idle = actions.get('Idle');
  idle?.play();
  let current: THREE.AnimationAction | undefined = idle;
  /** 뼈로 만드는 연출 동작(에셋에 없는 것) */
  let proc: 'Wave' | null = null;
  let procT = 0;
  let lookDown = 0;
  let lastT: number | null = null;
  let stride = 0; // 걷기 위상
  let walkK = 0; // 걷기 섞임(0 서 있기 ~ 1 걷기)
  let holdK = 0; // 받치기 섞임
  let waveK = 0;

  const play = (a: THREE.AnimationAction | undefined, o: { once?: boolean; speed?: number; fade?: number } = {}) => {
    if (!a || a === current) return;
    a.reset();
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = !!o.once;
    a.timeScale = o.speed ?? 1;
    a.play();
    const fade = o.fade ?? 0.3;
    if (current) a.crossFadeFrom(current, fade, false);
    current = a;
  };

  return {
    root,
    act(clip, o) {
      if (clip === null) {
        proc = null;
        play(idle, o);
        return true;
      }
      if (clip === 'Wave') {
        if (proc !== 'Wave') procT = 0;
        proc = 'Wave';
        play(idle, o);
        return true;
      }
      const a = actions.get(clip);
      if (!a) return false;
      proc = null;
      play(a, o);
      return true;
    },
    look(down) {
      lookDown = THREE.MathUtils.clamp(down, 0, 1);
    },
    animate(t: number, moving: boolean, pose?: ElfPose) {
      const dt = lastT === null ? 0 : THREE.MathUtils.clamp(t - lastT, 0, 0.1);
      lastT = t;
      // 믹서는 값이 바뀌지 않은 뼈를 다시 쓰지 않는다 → 지난 프레임에 더하기 전 값으로 되돌린 뒤 믹서를 돌리고, 그 값을 다시 저장한다
      clean.forEach((c, b) => {
        b.quaternion.copy(c.q);
        b.position.copy(c.p);
      });
      mixer.update(dt);
      clean.forEach((c, b) => {
        c.q.copy(b.quaternion);
        c.p.copy(b.position);
      });
      const ease = (k: number, want: number, rate: number) => k + (want - k) * Math.min(1, dt * rate);
      const holding = pose?.carry === 'heavy' || pose?.carry === 'grip';
      walkK = ease(walkK, moving ? 1 : 0, 6);
      holdK = ease(holdK, holding ? 1 : 0, 4);
      waveK = ease(waveK, proc === 'Wave' ? 1 : 0, 5);
      if (moving) stride += dt * (holding ? 5.2 : 6.4);
      procT += dt;

      // 걷기: 다리를 앞뒤로, 무릎을 굽히고, 팔은 반대로 흔든다(무거운 걸 받치면 팔은 그대로)
      const s = Math.sin(stride);
      const c = Math.cos(stride);
      const w = walkK;
      if (w > 0.001) {
        turn(B.tl, X, -0.42 * s * w);
        turn(B.tr, X, 0.42 * s * w);
        turn(B.sl, X, 0.55 * Math.max(0, c) * w);
        turn(B.sr, X, 0.55 * Math.max(0, -c) * w);
        const arm = 0.32 * s * w * (1 - holdK);
        turn(B.ul, X, arm);
        turn(B.ur, X, -arm);
        turn(B.spine, Y_AXIS, 0.06 * s * w);
        if (B.hips) B.hips.position.y += (Math.abs(c) - 0.6) * 0.025 * w;
      }

      // 받치기: 두 팔을 앞으로 쭉, 손바닥은 위로 받치듯 팔꿈치를 조금 굽힌다. 몸은 살짝 뒤로 버틴다
      if (holdK > 0.001) {
        const k = holdK;
        turn(B.ul, X, -1.25 * k);
        turn(B.ur, X, -1.25 * k);
        turn(B.ul, Z, -0.18 * k);
        turn(B.ur, Z, 0.18 * k);
        turn(B.fl, X, -0.35 * k);
        turn(B.fr, X, -0.35 * k);
        turn(B.spine, X, -0.08 * k);
        if (B.hips) B.hips.position.y -= 0.03 * k;
      }

      // 손 흔들기(오른손, "안녕"): 위팔은 옆으로 어깨보다 조금 높이·조금 앞으로, 팔꿈치를 굽혀 아래팔을 세우고
      // 팔꿈치를 축으로 좌우로 흔든다(손은 늘 얼굴 옆·앞에 있어 머리·모자에 가리지 않는다)
      if (waveK > 0.001) {
        const k = waveK;
        const sw = Math.sin(procT * WAVE_RATE) * Math.min(1, procT * 3);
        turn(B.ur, Z, WAVE.raise * k);
        turn(B.ur, Y_AXIS, WAVE.forward * k);
        turn(B.fr, Z, (WAVE.bend + WAVE.swing * sw) * k);
        turn(B.hr, Z, WAVE.wrist * sw * k);
        // 아래팔을 제 길이 축(뼈의 +y)으로 비틀어 손바닥이 앞, 엄지가 몸 안쪽을 보게 한다
        const tw = WAVE.twist * k;
        if (B.fr && tw) B.fr.quaternion.multiply(_q.setFromAxisAngle(Y_AXIS, tw));
        turn(B.spine, Z, 0.04 * k);
        turn(B.head, Z, 0.06 * k);
      }

      // 고개 숙이기: 머리 먼저, 많이 숙이면 등도 조금
      if (lookDown > 0.001) {
        turn(B.spine, X, 0.18 * lookDown);
        turn(B.head, X, 0.42 * lookDown);
      }
    },
  };
}
