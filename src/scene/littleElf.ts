// 꼬마 요정: 사용자가 준 에셋(LittleElf.glb, 뼈대 17개, 동작 Idle·Walk·Carry·CarryWalk·Throw·Catch).
//   - 팀 옷(모자·목도리 = TeamCloth 재질)을 네 요정 색으로 칠하고, 모자에 무늬(줄·물방울·별·체크)를 입힌다(색만으로 구분하지 않는다).
//     원본에 UV가 없어서 머리 축을 중심으로 원통 UV를 만들어 붙인다(같은 형상은 한 번만).
//   - 모델에 없는 연출 동작(손 흔들기·손잡이 돌리기·물림·넘어지기)과 고개 숙이기·손 뻗기·지친 손 털기는 뼈를 돌려 만든다.
//   - 원점은 발바닥 중심, 앞은 +z(다른 요정과 같다). 모자 끝까지 키 ELF_TOTAL_HEIGHT.
// 시제품: tools/prototypes/little-elf.html
import * as THREE from 'three';
import type { ElfLook } from '../data/elves';
import { NO_POSE, type ElfPose, type ElfView } from './elf';
import { hatTexture } from './miniElf';
import type { Models } from './models';

/** 모자 끝까지 키(m). 예전 미니 요정(몸 1.1 m + 모자)과 비슷하게 */
export const ELF_TOTAL_HEIGHT = 1.42;

const X = new THREE.Vector3(1, 0, 0);
/** 가벼운 선물을 들 때 위팔을 내리는 각(라디안) */
const CARRY_LOWER = 0.55;
const Z = new THREE.Vector3(0, 0, 1);

/** 팀 옷 형상에 원통 UV(머리 축 기준)를 한 번 만들어 둔다 */
const uvDone = new WeakSet<THREE.BufferGeometry>();
function addClothUv(g: THREE.BufferGeometry): void {
  if (uvDone.has(g) || g.getAttribute('uv')) return;
  uvDone.add(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const h = bb.max.y - bb.min.y || 1;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = Math.atan2(pos.getX(i) - cx, pos.getZ(i) - cz) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

type Proc = 'Wave' | 'Interact' | 'HitRecieve' | 'Death';
const PROCS: readonly string[] = ['Wave', 'Interact', 'HitRecieve', 'Death'];

export function createLittleElf(models: Models, look: ElfLook): ElfView | null {
  const model = models.clone('littleElf');
  if (!model) return null;
  const root = new THREE.Group();
  root.add(model);

  // 칠하기: 팀 옷 = 요정 색 + 모자 무늬, 나머지는 원본 색(정점 색) 그대로
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.frustumCulled = false; // 뼈로 움직이는 모델: 처음 경계 상자로 잘려 사라지지 않게
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    m.material = mat;
    if (mat.name.startsWith('TeamCloth')) {
      addClothUv(m.geometry);
      const tex = hatTexture(look.hat, look.pattern, look.accent);
      tex.repeat.set(2, 1.5);
      mat.map = tex;
      mat.color.set('#ffffff');
    }
    mat.metalness = 0;
    mat.roughness = 0.85;
  });

  const bone = (n: string) => {
    let b: THREE.Bone | null = null;
    const want = n.replace(/\./g, '');
    model.traverse((o) => {
      if (!b && (o as THREE.Bone).isBone && o.name.replace(/\./g, '') === want) b = o as THREE.Bone;
    });
    return b as THREE.Bone | null;
  };
  const B = {
    hips: bone('Hips'),
    spine: bone('Spine'),
    head: bone('Head'),
    ul: bone('UpperArm.L'),
    ur: bone('UpperArm.R'),
    fl: bone('Forearm.L'),
    fr: bone('Forearm.R'),
    gl: bone('Grip.L'),
    gr: bone('Grip.R'),
  };

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(models.animations('littleElf').map((c) => [c.name, c] as const));
  const action = (n: string) => {
    const c = clips.get(n);
    return c ? mixer.clipAction(c) : null;
  };
  const A = { idle: action('Idle'), walk: action('Walk'), carry: action('Carry'), carryWalk: action('CarryWalk'), throw: action('Throw'), catch: action('Catch') };
  A.idle?.play();
  mixer.update(0.3);
  model.updateMatrixWorld(true);

  // 키를 맞추고 발바닥을 원점에
  let box = new THREE.Box3().setFromObject(model);
  model.scale.setScalar((ELF_TOTAL_HEIGHT / (box.max.y - box.min.y)) * model.scale.x);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  const baseY = model.position.y;

  // 발밑 그림자
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  // 인물 기준 축으로 뼈를 돌린다(뼈마다 축 방향이 달라도 같은 뜻: X = 앞으로 들기, Z = 옆으로 벌리기, Y = 비틀기)
  const _r = new THREE.Quaternion(), _p = new THREE.Quaternion(), _q = new THREE.Quaternion(), _a = new THREE.Vector3();
  const turn = (b: THREE.Object3D | null, axis: THREE.Vector3, angle: number) => {
    if (!b?.parent || Math.abs(angle) < 1e-5) return;
    model.getWorldQuaternion(_r);
    b.parent.getWorldQuaternion(_p);
    _a.copy(axis).applyQuaternion(_r).applyQuaternion(_p.invert());
    b.quaternion.premultiply(_q.setFromAxisAngle(_a, angle));
  };

  type Gait = 'idle' | 'walk' | 'carry' | 'carryWalk';
  let gait: Gait = 'idle';
  const actionOf = (g: Gait) => A[g] ?? A.idle;
  let clipOverride: THREE.AnimationAction | null = null;
  // 뼈로 만드는 연출 동작: 세기(0~1)를 부드럽게 올리고 내린다
  let proc: Proc | null = null;
  let procW = 0;
  let procFade = 0.25;
  let procT = 0;
  let procOnce = false;
  let procSpeed = 1;
  let lastProc: Proc | null = null;
  let lookDown = 0;
  let last = -1;
  let reachW = 0;
  let carryW = 0;

  const crossTo = (to: THREE.AnimationAction | null, from: THREE.AnimationAction | null, fade: number) => {
    if (!to || to === from) return;
    to.reset().play();
    if (from) from.crossFadeTo(to, fade, false);
  };

  const _l = new THREE.Vector3(), _rr = new THREE.Vector3();
  return {
    root,
    act(name, o = {}) {
      if (name === null) {
        if (clipOverride) crossTo(actionOf(gait), clipOverride, o.fade ?? 0.25);
        clipOverride = null;
        proc = null;
        procFade = o.fade ?? 0.25;
        return true;
      }
      if (PROCS.includes(name)) {
        if (proc !== name) procT = 0;
        proc = name as Proc;
        lastProc = proc;
        procFade = o.fade ?? 0.25;
        procOnce = !!o.once;
        procSpeed = o.speed ?? 1;
        return true;
      }
      const next = action(name);
      if (!next) return false;
      if (next === clipOverride) return true;
      next.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = true;
      next.timeScale = o.speed ?? 1;
      crossTo(next, clipOverride ?? actionOf(gait), o.fade ?? 0.2);
      clipOverride = next;
      return true;
    },
    look(down) {
      lookDown = Math.max(0, Math.min(1, down));
    },
    hands(l, r) {
      if (!B.gl || !B.gr) return false;
      B.gl.getWorldPosition(l);
      B.gr.getWorldPosition(r);
      return true;
    },
    carryFrame(pos, quat) {
      if (!B.gl || !B.gr) return false;
      B.gl.getWorldPosition(_l);
      B.gr.getWorldPosition(_rr);
      pos.addVectors(_l, _rr).multiplyScalar(0.5);
      // 방향: 요정이 보는 쪽(두 손 높이 차이만큼 옆으로 기운다)
      root.getWorldQuaternion(quat);
      const side = _a.subVectors(_l, _rr);
      const tilt = side.lengthSq() > 1e-8 ? Math.atan2(side.y, Math.hypot(side.x, side.z)) : 0;
      quat.multiply(_q.setFromAxisAngle(Z, -tilt));
      return true;
    },
    animate(timeSec, moving, pose: ElfPose = NO_POSE) {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, timeSec - last));
      last = timeSec;
      const holding = pose.carry !== 'none';
      const want: Gait = holding ? (moving ? 'carryWalk' : 'carry') : moving ? 'walk' : 'idle';
      if (want !== gait) {
        if (!clipOverride) crossTo(actionOf(want), actionOf(gait), 0.18);
        gait = want;
      }
      // 무거운 짐(함께 들기): 걸음을 천천히
      if (A.carryWalk) A.carryWalk.timeScale = pose.carry === 'heavy' ? 0.7 : 1;
      mixer.update(dt);

      // ── 뼈로 더하는 동작 ──
      // 연출 동작 세기
      const target = proc ? 1 : 0;
      const fadeK = 1 - Math.exp(-dt * (3 / Math.max(0.05, proc ? 0.18 : procFade)));
      procW += (target - procW) * fadeK;
      procT += dt * procSpeed;
      const w = procW;
      const kind = proc ?? lastProc;
      model.rotation.x = 0;
      model.position.y = baseY;
      if (w > 0.002 && kind) {
        if (kind === 'Wave') {
          // 오른팔을 옆으로 높이 들고 아래팔을 흔든다
          turn(B.ur, Z, -2.5 * w);
          turn(B.fr, Z, (-0.5 + Math.sin(procT * 9) * 0.45) * w);
        } else if (kind === 'Interact') {
          // 두 손을 앞으로 내밀어 손잡이를 돌리듯(빙글)
          const s = Math.sin(procT * 8), c = Math.cos(procT * 8);
          turn(B.ul, X, (-1.15 + s * 0.25) * w);
          turn(B.ur, X, (-1.15 + c * 0.25) * w);
          turn(B.fl, X, -0.5 * w);
          turn(B.fr, X, -0.5 * w);
          turn(B.spine, X, 0.12 * w);
        } else if (kind === 'HitRecieve') {
          // 깜짝: 몸을 뒤로 젖히고 두 팔을 살짝 든다(한 번)
          const k = procOnce ? Math.sin(Math.min(1, procT / 0.55) * Math.PI) : 1;
          turn(B.spine, X, -0.45 * w * k);
          turn(B.ul, Z, 0.6 * w * k);
          turn(B.ur, Z, -0.6 * w * k);
          if (procOnce && procT > 0.55) proc = null;
        } else if (kind === 'Death') {
          // 뒤로 털썩 넘어진다(일어날 때는 세기가 천천히 줄며 일어선다)
          const k = procOnce ? Math.min(1, procT / 0.45) : 1;
          model.rotation.x = -1.45 * w * k;
          model.position.y = baseY + 0.12 * w * k;
          turn(B.ul, Z, 0.9 * w * k);
          turn(B.ur, Z, -0.9 * w * k);
        }
      }
      // 가벼운 선물: 모델의 Carry는 가슴 높이로 들어 큰 머리 앞을 가린다 → 팔을 배 높이로 내린다(아래팔은 수평 유지)
      carryW += ((pose.carry === 'light' ? 1 : 0) - carryW) * (1 - Math.exp(-dt * 12));
      if (carryW > 0.01) {
        // 들고 걷기(CarryWalk)는 손이 조금 더 높아 더 내린다
        const lower = (CARRY_LOWER + (moving ? 0.3 : 0)) * carryW;
        turn(B.ul, X, lower);
        turn(B.ur, X, lower);
        const keep = moving ? 0.25 : 0.7; // 아래팔을 얼마나 수평으로 되돌리나
        turn(B.fl, X, -lower * keep);
        turn(B.fr, X, -lower * keep);
      }
      // 집기·놓기: 아래 앞으로 손을 뻗는다
      reachW += (Math.sin(Math.PI * pose.act) - reachW) * (1 - Math.exp(-dt * 20));
      if (reachW > 0.01 && !holding) {
        turn(B.ul, X, -0.8 * reachW);
        turn(B.ur, X, -0.8 * reachW);
        turn(B.spine, X, 0.18 * reachW);
      }
      // 지쳐서 손을 턴다
      if (pose.tired) {
        const sh = Math.sin(timeSec * 34) * 0.16;
        turn(B.ul, Z, sh);
        turn(B.ur, Z, -sh);
      }
      // 고개 숙이기(0 = 앞, 1 = 발밑)
      if (lookDown > 0.001) turn(B.head, X, 0.75 * lookDown);
    },
  };
}
