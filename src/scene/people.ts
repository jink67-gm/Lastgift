// 사람(민재·식구, 나중에 유나·지우·할머니·마을 아이들): 사용자가 인물 에셋(glb)을 한꺼번에 줄 때까지 쓰는 임시 모형.
// 머리·몸통·팔(위팔·아래팔)·다리를 따로 움직이는 기본 도형이다. 장면 코드는 PersonView만 쓰므로,
// 에셋이 오면 createPerson 안에서 glb를 불러 같은 PersonView를 돌려주면 된다(장면 코드는 그대로).
// 치수: 요정 키 1.1 = 약 45 cm(data/townScale) → 1단위 ≈ 41 cm. 원점 = 발바닥 가운데, 앞 = +z.
import * as THREE from 'three';
import type { Models } from './models';

export type PersonRole = 'minjae' | 'mom' | 'dad';

/** 키(게임 단위): 민재(3~4학년, 약 1.35 m), 엄마(약 1.62 m), 아빠(약 1.75 m) */
export const PERSON_HEIGHT: Record<PersonRole, number> = { minjae: 3.3, mom: 3.95, dad: 4.27 };

const LOOKS: Record<PersonRole, { coat: string; pants: string; hair: string; hat?: string; scarf?: string }> = {
  // 민재: 파란 패딩 + 노란 털모자(축구공과 어울리게)
  minjae: { coat: '#2f6fd0', pants: '#3b3f4a', hair: '#2a1d14', hat: '#f0b429', scarf: '#d23a3a' },
  mom: { coat: '#c95a7a', pants: '#4a4f5c', hair: '#3a2418', scarf: '#f2efe6' },
  dad: { coat: '#3f7a52', pants: '#2f333c', hair: '#1e1a18', hat: '#6a4a3a' },
};

/** 팔 하나의 자세 */
export type ArmPose = 'down' | 'wave' | 'beckon' | 'reach' | 'hold' | 'hug' | 'pet';

export interface PersonPose {
  /** 걷기(위상이 흐르는 동안 다리·팔을 흔든다). 0 = 서 있다 */
  walk: number;
  /** 쪼그려 앉기(0~1) */
  crouch: number;
  /** 고개 숙이기(0~1, 음수면 든다) */
  look: number;
  armL: ArmPose;
  armR: ArmPose;
}

export const STAND: PersonPose = { walk: 0, crouch: 0, look: 0, armL: 'down', armR: 'down' };

export interface PersonView {
  root: THREE.Group;
  height: number;
  /** 자세를 놓는다(t: 장면 시각, 흔들기·걷기 위상) */
  pose(p: PersonPose, t: number): void;
  /** 오른손·왼손 끝(월드): 물그릇·담요를 손에 들릴 때 */
  hand(side: 'L' | 'R', out: THREE.Vector3): THREE.Vector3;
}

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

export function createPerson(_models: Models, role: PersonRole): PersonView {
  const H = PERSON_HEIGHT[role];
  const L = LOOKS[role];
  const k = H / 4; // 비율 단위
  const child = role === 'minjae';
  const root = new THREE.Group();
  const coat = mat(L.coat);
  const pants = mat(L.pants);
  const skin = mat('#f1c9a5');
  const boots = mat('#3a2a22');

  const legLen = (child ? 1.55 : 1.75) * k;
  const hips = new THREE.Group();
  hips.position.y = legLen;
  root.add(hips);
  // 다리: 엉덩이에서 아래로(허벅지 + 정강이 + 신발)
  const legs = ([-1, 1] as const).map((sx) => {
    const thigh = new THREE.Group();
    thigh.position.set(sx * 0.2 * k, 0, 0);
    hips.add(thigh);
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * k, legLen * 0.38, 4, 10), pants);
    t.position.y = -legLen * 0.25;
    thigh.add(t);
    const knee = new THREE.Group();
    knee.position.y = -legLen * 0.5;
    thigh.add(knee);
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.14 * k, legLen * 0.36, 4, 10), pants);
    s.position.y = -legLen * 0.24;
    knee.add(s);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.3 * k, 0.2 * k, 0.46 * k), boots);
    boot.position.set(0, -legLen * 0.5 + 0.1 * k, 0.06 * k);
    knee.add(boot);
    return { thigh, knee };
  });
  // 몸통(패딩: 둥근 상자) + 목도리
  const torsoLen = (child ? 1.25 : 1.35) * k;
  const torso = new THREE.Group();
  hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * k, torsoLen * 0.55, 6, 14), coat);
  body.scale.set(1, 1, 0.78);
  body.position.y = torsoLen * 0.5;
  torso.add(body);
  if (L.scarf) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3 * k, 0.09 * k, 8, 18), mat(L.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = torsoLen * 0.98;
    torso.add(scarf);
  }
  // 머리: 얼굴 + 머리카락 + (모자) + 두 눈
  const neck = new THREE.Group();
  neck.position.y = torsoLen * 1.02;
  torso.add(neck);
  const headR = (child ? 0.36 : 0.32) * k;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), skin);
  head.position.y = headR * 1.05;
  neck.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(L.hair));
  hair.position.y = headR * 1.08;
  hair.rotation.x = -0.25;
  neck.add(hair);
  if (L.hat) {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(L.hat));
    hat.position.y = headR * 1.25;
    neck.add(hat);
    if (child) {
      const pom = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.3, 10, 8), mat('#ffffff'));
      pom.position.y = headR * 2.35;
      neck.add(pom);
    }
  }
  const eyeM = mat('#1b1b1b');
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.11, 8, 6), eyeM);
    eye.position.set(sx * headR * 0.36, headR * 1.12, headR * 0.92);
    neck.add(eye);
  }
  // 팔: 어깨에서 아래로(위팔 + 아래팔 + 장갑)
  const armLen = (child ? 1.15 : 1.25) * k;
  const arms = ([-1, 1] as const).map((sx) => {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.5 * k, torsoLen * 0.88, 0);
    torso.add(sh);
    const u = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * k, armLen * 0.36, 4, 10), coat);
    u.position.y = -armLen * 0.24;
    sh.add(u);
    const el = new THREE.Group();
    el.position.y = -armLen * 0.5;
    sh.add(el);
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 * k, armLen * 0.32, 4, 10), coat);
    f.position.y = -armLen * 0.22;
    el.add(f);
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.14 * k, 10, 8), mat(child ? '#d23a3a' : '#5a5f6c'));
    mitt.position.y = -armLen * 0.48;
    el.add(mitt);
    const tip = new THREE.Object3D();
    tip.position.y = -armLen * 0.52;
    el.add(tip);
    return { sh, el, tip };
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55 * k, 20), new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== shadow) o.castShadow = true;
  });

  /** 팔 자세: 어깨 회전(x 앞뒤, z 옆) + 팔꿈치 굽힘(x). sx: -1 왼팔(인물 기준 +x가 왼쪽) */
  const ARM = (a: ArmPose, t: number, sx: number): [number, number, number] => {
    const side = sx; // 옆으로 들기 방향(z축 회전 부호: 오른팔 -x 쪽은 음수)
    switch (a) {
      case 'wave':
        return [-0.2, side * 2.5, 0];
      case 'beckon':
        return [-1.3, side * 0.25, -1.1 - 0.5 * Math.max(0, Math.sin(t * 6))];
      case 'reach':
        return [-1.25, side * 0.1, -0.15];
      case 'hold':
        return [-0.7, side * 0.1, -1.2];
      case 'hug':
        return [-1.0, -side * 0.5, -1.4];
      case 'pet':
        return [-1.0 + 0.12 * Math.sin(t * 7), side * 0.1, -0.35];
      default:
        return [0, side * 0.08, -0.1];
    }
  };
  const hand = new THREE.Vector3();
  return {
    root,
    height: H,
    pose(p, t) {
      // 걷기: 다리·팔 흔들기와 몸 출렁
      const w = p.walk > 0 ? 1 : 0;
      const ph = p.walk * Math.PI * 2;
      const c = Math.max(0, Math.min(1, p.crouch));
      legs.forEach((g, i) => {
        const s = Math.sin(ph + i * Math.PI) * 0.55 * w;
        g.thigh.rotation.x = -s - 1.6 * c;
        g.knee.rotation.x = Math.max(0, -Math.sin(ph + i * Math.PI)) * 0.7 * w + 2.4 * c;
      });
      hips.position.y = legLen * (1 - 0.52 * c) + Math.abs(Math.cos(ph)) * 0.05 * k * w;
      torso.rotation.x = 0.35 * c;
      neck.rotation.x = 0.45 * p.look - 0.2 * c;
      arms.forEach((g, i) => {
        const sx = i === 0 ? -1 : 1;
        const a = sx < 0 ? p.armR : p.armL; // 인물의 오른팔은 -x(앞에서 보면 화면 왼쪽)
        let [rx, rz, el] = ARM(a, t, sx);
        if (a === 'down' && w) rx += Math.sin(ph + (i === 0 ? Math.PI : 0)) * 0.45;
        g.sh.rotation.set(rx, 0, rz);
        // 손 흔들기: 팔꿈치를 축으로 좌우
        g.el.rotation.set(el, 0, a === 'wave' ? Math.sin(t * 8) * 0.45 : 0);
        if (a === 'wave') g.el.rotation.x = 0;
      });
    },
    hand(side, out) {
      root.updateMatrixWorld(true);
      return (side === 'R' ? arms[0]! : arms[1]!).tip.getWorldPosition(out ?? hand);
    },
  };
}
