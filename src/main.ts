// 광장 장면: 요정 1명을 키보드로 움직인다(고정 회전 쿼터뷰).
import * as THREE from 'three';
import { stepPlayer, ELF_RADIUS, type PlayerState, type World } from './core/player';
import { overlaps } from './core/collision';
import { ELF_LOOKS } from './data/elves';
import { ELF_SPAWN, PLAZA_BOUNDS, PLAZA_COLLIDERS } from './data/plaza';
import { attachKeyboard, KeyState } from './input/keyboard';
import { createElf } from './scene/elf';
import { createPlaza } from './scene/plaza';

const CAMERA_YAW = Math.PI / 4; // 게임 중 바뀌지 않는다
const CAMERA_PITCH = Math.atan(1 / Math.SQRT2);
const VIEW_HEIGHT = 16; // 화면 세로에 담기는 월드 길이(m)
const SIM_DT = 1 / 60; // 고정 틱

const host = document.getElementById('game');
if (!host) throw new Error('#game 요소가 없습니다');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b2433');
scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a4660', 1.6));
const moon = new THREE.DirectionalLight('#ffffff', 1.3);
moon.position.set(-8, 16, 6);
scene.add(moon);
scene.add(createPlaza());

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const CAM_OFFSET = new THREE.Vector3(
  Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
  Math.sin(CAMERA_PITCH),
  Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
).multiplyScalar(40);
const camTarget = new THREE.Vector3(ELF_SPAWN.x, 0, ELF_SPAWN.z);

const world: World = { colliders: PLAZA_COLLIDERS, bounds: PLAZA_BOUNDS, cameraYaw: CAMERA_YAW };
let player: PlayerState = { x: ELF_SPAWN.x, z: ELF_SPAWN.z, facing: 0, moving: false };
const elf = createElf(ELF_LOOKS[0]!);
scene.add(elf.root);

const keys = new KeyState();
attachKeyboard(window, keys);

function resize(): void {
  const w = host!.clientWidth;
  const h = host!.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / Math.max(h, 1);
  // 세로 화면에서도 좌우가 너무 좁아지지 않게 짧은 변 기준으로 맞춘다.
  const viewH = aspect >= 1 ? VIEW_HEIGHT : VIEW_HEIGHT / Math.max(aspect, 0.6);
  camera.left = (-viewH * aspect) / 2;
  camera.right = (viewH * aspect) / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function placeCamera(dt: number): void {
  const k = 1 - Math.exp(-dt * 6);
  camTarget.x += (player.x - camTarget.x) * k;
  camTarget.z += (player.z - camTarget.z) * k;
  camera.position.copy(camTarget).add(CAM_OFFSET);
  camera.lookAt(camTarget);
}

let last = performance.now();
let acc = 0;
let elapsed = 0;
renderer.setAnimationLoop((now) => {
  const frame = Math.min((now - last) / 1000, 0.25);
  last = now;
  acc += frame;
  const intent = keys.sample();
  while (acc >= SIM_DT) {
    player = stepPlayer(player, intent.move, SIM_DT, world);
    acc -= SIM_DT;
    elapsed += SIM_DT;
  }
  elf.root.position.set(player.x, 0, player.z);
  elf.root.rotation.y = player.facing;
  elf.animate(elapsed, player.moving);
  placeCamera(frame);
  renderer.render(scene, camera);
});

// 자동 검사용 창구: 개발 서버이거나 주소에 ?test가 있을 때만 연다.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
  const v = new THREE.Vector3();
  (window as unknown as Record<string, unknown>).__lastgift = {
    player: () => ({ ...player }),
    setPlayer: (x: number, z: number) => {
      player = { ...player, x, z };
      camTarget.set(x, 0, z);
    },
    /** 바닥 위 한 점의 현재 화면 좌표(CSS px) */
    toScreen: (x: number, z: number) => {
      v.set(x, 0, z).project(camera);
      return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
    },
    insideCollider: () => PLAZA_COLLIDERS.some((c) => overlaps(player, ELF_RADIUS - 1e-3, c)),
    colliders: PLAZA_COLLIDERS,
    bounds: PLAZA_BOUNDS,
  };
}
