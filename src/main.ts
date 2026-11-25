// 프로젝트 뼈대 확인용 최소 장면: 고정 쿼터뷰 카메라로 빈 눈 광장을 보여 준다.
// 요정·입력·충돌은 다음 작업에서 붙인다.
import * as THREE from 'three';

const CAMERA_YAW = Math.PI / 4; // 고정 회전 쿼터뷰(45°). 게임 중에는 바뀌지 않는다.
const CAMERA_PITCH = Math.atan(1 / Math.SQRT2); // 약 35.3°, 등각 투영에 가까운 내려다보기
const VIEW_HEIGHT = 18; // 화면 세로에 담길 월드 길이(m)

const host = document.getElementById('game');
if (!host) throw new Error('#game 요소가 없습니다');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b2433');

// 직교 카메라: 멀리 있는 물체도 같은 크기로 보여 손잡이·공·스위치 판단이 쉽다.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const dist = 40;
camera.position.set(
  Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH) * dist,
  Math.sin(CAMERA_PITCH) * dist,
  Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH) * dist,
);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a4660', 1.6));
const moon = new THREE.DirectionalLight('#ffffff', 1.4);
moon.position.set(-8, 16, 6);
scene.add(moon);

// 눈 광장 바닥 30 × 20 m
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(30, 0.4, 20),
  new THREE.MeshStandardMaterial({ color: '#eef3fb', roughness: 0.95 }),
);
ground.position.y = -0.2;
scene.add(ground);

// 방향 확인용 표시: 광장 중앙의 작은 기둥(높이 1 m = 요정 키 기준)
const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(0.15, 0.15, 1, 12),
  new THREE.MeshStandardMaterial({ color: '#c8323c' }),
);
marker.position.y = 0.5;
scene.add(marker);

function resize(): void {
  const w = host!.clientWidth;
  const h = host!.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / Math.max(h, 1);
  camera.left = (-VIEW_HEIGHT * aspect) / 2;
  camera.right = (VIEW_HEIGHT * aspect) / 2;
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => renderer.render(scene, camera));

// 자동 검사용(개발 모드에서만): 장면이 실제로 그려졌는지 확인한다.
if (import.meta.env.DEV) {
  (window as unknown as { __lastgift: unknown }).__lastgift = { ready: true, cameraYaw: CAMERA_YAW };
}
