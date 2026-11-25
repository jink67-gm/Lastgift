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

export interface ElfView {
  root: THREE.Group;
  /** 걷기 동작을 갱신한다 */
  animate(timeSec: number, moving: boolean): void;
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
    animate(t, moving) {
      const swing = moving ? Math.sin(t * 14) : 0;
      legL.position.z = swing * 0.08;
      legR.position.z = -swing * 0.08;
      body.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.04 : 0;
    },
  };
}
