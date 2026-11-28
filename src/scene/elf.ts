// 직접 제작한 요정 모델(기본 도형). 키 약 1 m, 원점은 발바닥 중심, 앞은 +z.
import * as THREE from 'three';
import type { ElfLook, HatPattern } from '../data/elves';

function hatTexture(base: string, pattern: HatPattern, accent: string): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  g.fillStyle = accent;
  switch (pattern) {
    case 'stripes':
      for (let y = 8; y < size; y += 32) g.fillRect(0, y, size, 12);
      break;
    case 'dots':
      for (let y = 12; y < size; y += 28)
        for (let x = (y / 28) % 2 ? 14 : 0; x < size; x += 28) {
          g.beginPath();
          g.arc(x, y, 6, 0, Math.PI * 2);
          g.fill();
        }
      break;
    case 'stars':
      for (let y = 16; y < size; y += 36)
        for (let x = (y / 36) % 2 ? 20 : 2; x < size; x += 40) star(g, x, y, 9);
      break;
    case 'checks':
      for (let y = 0; y < size; y += 16)
        for (let x = (y / 16) % 2 ? 16 : 0; x < size; x += 32) g.fillRect(x, y, 16, 16);
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/**
 * 요정 자세(화면 전용, 판정과 무관):
 * - carry: 'light' 가벼운 선물을 두 손 위에 얹어 가슴 앞에 / 'grip' 무거운 짐 손잡이를 잡고 섬 / 'heavy' 함께 들고 감(느린 걸음)
 * - act: 집기·놓기·잡기 동작 진행(0~1, 0이면 없음) — 살짝 웅크렸다 손을 뻗는다
 * - tired: 체력 25% 이하로 들고 있음 — 팔이 떨린다(손을 턴다)
 */
export interface ElfPose {
  carry: 'none' | 'light' | 'grip' | 'heavy';
  act: number;
  tired: boolean;
  /** 손 위에 얹은 물건의 가로 폭(요정 크기 1 기준 m). 두 손이 물건 바닥 아래에 오게 손 사이를 맞춘다 */
  span?: number;
  /** 앉기(1장 숨기): 무릎을 굽혀 몸을 낮추고 앞으로 숙인다 */
  crouch?: boolean;
}

export const NO_POSE: ElfPose = { carry: 'none', act: 0, tired: false };

export interface ElfView {
  root: THREE.Group;
  /** 걷기 동작을 갱신한다(pose 생략 = 빈손) */
  animate(timeSec: number, moving: boolean, pose?: ElfPose): void;
  /** 두 손목의 월드 위치(손에 든 물건을 손 위에 얹는다). 손 뼈가 없는 기본 도형 요정은 false */
  hands?(l: THREE.Vector3, r: THREE.Vector3): boolean;
  /**
   * 손에 든 물건 자리: 두 손목 가운데(pos)와 방향(quat: +x 요정 왼쪽, +y 손바닥 위, +z 몸 앞).
   * 두 손 높이 차이와 몸통 기울기를 그대로 따라가 걸을 때 물건이 손·몸과 함께 움직인다. 손 뼈가 없으면 false
   */
  carryFrame?(pos: THREE.Vector3, quat: THREE.Quaternion): boolean;
  /**
   * 연출용: 이름 있는 동작(Wave·Interact·Roll·HitRecieve 등)을 튼다. null이면 걷기·서 있기로 돌아간다.
   * once: 한 번만 하고 마지막 자세에 멈춘다. 없는 동작이면 false
   */
  act?(clip: string | null, o?: { once?: boolean; speed?: number; fade?: number }): boolean;
  /** 연출용: 고개를 숙인다(0 = 앞, 1 = 발밑을 본다) */
  look?(down: number): void;
  /**
   * 등에 메는 자루(배달 자루). obj를 요정에게 붙여 등 위에 둔다. sling이면 지금 자리(땅)에서 두 손으로 들어
   * 어깨 너머로 넘겨 메는 동작(약 1.2초)을 한 뒤 멘다. null이면 내려놓는다(떼어 낸 물건을 돌려준다). 없으면 false
   */
  backpack?(obj: THREE.Object3D | null, o?: { sling?: boolean }): THREE.Object3D | null | false;
}

export function createElf(look: ElfLook): ElfView {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 걸을 때 위아래로 흔들리는 부분
  root.add(body);

  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

  // 발밑 그림자(바닥 위 위치를 읽기 쉽게)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 24),
    new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.25, 8), mat('#3b3f4a'));
  const legR = legL.clone();
  legL.position.set(-0.1, 0.125, 0);
  legR.position.set(0.1, 0.125, 0);
  root.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.2, 6, 12), mat('#5a8f4e'));
  torso.position.y = 0.45;
  body.add(torso);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.03, 6, 20), mat('#4a2e1a'));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.4;
  body.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), mat('#f3cfb0'));
  head.position.y = 0.78;
  body.add(head);

  // 얼굴 방향 표시: 코와 두 눈(앞 +z)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#e8a888'));
  nose.position.set(0, 0.77, 0.19);
  const eyeMat = mat('#22252c');
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.07, 0.82, 0.17);
  eyeR.position.set(0.07, 0.82, 0.17);
  body.add(nose, eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.05, 0.16, 8);
  const earL = new THREE.Mesh(earGeo, mat('#f3cfb0'));
  const earR = earL.clone();
  earL.position.set(-0.2, 0.8, 0);
  earL.rotation.z = Math.PI / 2.4;
  earR.position.set(0.2, 0.8, 0);
  earR.rotation.z = -Math.PI / 2.4;
  body.add(earL, earR);

  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.21, 0.5, 20, 1, true),
    new THREE.MeshStandardMaterial({ map: hatTexture(look.hat, look.pattern, look.accent), roughness: 0.9, side: THREE.DoubleSide }),
  );
  hat.position.set(0, 1.12, -0.03);
  hat.rotation.x = -0.18;
  body.add(hat);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 20), mat('#f4f4f4'));
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.88;
  body.add(brim);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#f4f4f4'));
  pom.position.set(0, 1.36, -0.08);
  body.add(pom);

  return {
    root,
    animate(t, moving, pose = NO_POSE) {
      const slow = pose.carry === 'heavy' ? 0.6 : 1;
      const swing = moving ? Math.sin(t * 14 * slow) : 0;
      legL.position.z = swing * 0.08;
      legR.position.z = -swing * 0.08;
      body.position.y = (moving ? Math.abs(Math.sin(t * 14 * slow)) * 0.04 : 0) - Math.sin(Math.PI * pose.act) * 0.1;
    },
  };
}
