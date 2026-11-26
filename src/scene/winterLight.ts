// 밝은 겨울 밤 조명(연출 가이드 §6): 눈의 밝은 면은 크림색, 그늘은 옅은 청회색, 사람 사는 곳은 살구색.
// - 하늘빛(청회색)이 그늘을 채우고, 따뜻한 주광 하나가 실제 그림자를 만든다(그림자는 화면을 따라다닌다).
// - 발밑 원형 그림자는 그대로 둔다(그림자를 끈 저사양에서도 위치가 보이게).
import * as THREE from 'three';

export interface WinterLight {
  /** 화면 중심과 화면 크기(m)에 맞춰 그림자 범위를 옮긴다 */
  follow(x: number, z: number, viewW: number, viewH: number): void;
  /** 실시간 그림자 켜고 끄기(품질 설정). 재질을 다시 만들도록 장면을 넘긴다 */
  setShadows(on: boolean, scene: THREE.Object3D): void;
  /** 눈보라 밤(프롤로그): 0 = 평소 밝은 겨울 밤, 1 = 어둡고 푸른 눈보라 */
  setStorm(k: number): void;
}

const KEY_DIR = new THREE.Vector3(-5, 14, 7).normalize().multiplyScalar(30);

export function createWinterLight(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: { shadows: boolean; mapSize: number }): WinterLight {
  const bgDay = new THREE.Color('#223049');
  const bgStorm = new THREE.Color('#0a1020');
  scene.background = bgDay.clone();
  // 그늘은 옅은 청회색: 바닥 반사색을 밝게 해 그늘이 요정 실루엣보다 먼저 눈에 띄지 않게
  const hemi = new THREE.HemisphereLight('#c8d6f0', '#98a6c2', 1.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff0db', 2.5);
  scene.add(key);
  scene.add(key.target);
  let shadowsOn = false;
  const configure = (on: boolean) => {
    shadowsOn = on;
    renderer.shadowMap.enabled = on;
    key.castShadow = on;
    if (on) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      key.shadow.mapSize.set(opts.mapSize, opts.mapSize);
      key.shadow.bias = -0.0006;
      key.shadow.normalBias = 0.03;
      key.shadow.radius = 3;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 80;
      // 그림자 세기를 낮춘다(요정의 작은 실루엣보다 그림자가 먼저 보이지 않게)
      (key.shadow as THREE.LightShadow & { intensity?: number }).intensity = 0.62;
    }
  };
  configure(opts.shadows);
  let lastR = 0;
  return {
    setStorm(k) {
      const t = Math.min(1, Math.max(0, k));
      (scene.background as THREE.Color).copy(bgDay).lerp(bgStorm, t);
      hemi.intensity = 1.55 - 0.85 * t;
      hemi.color.set('#c8d6f0').lerp(new THREE.Color('#7f93c4'), t);
      key.intensity = 2.5 - 1.7 * t;
    },
    setShadows(on, root) {
      if (on === shadowsOn) return;
      configure(on);
      lastR = 0;
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
      });
    },
    follow(x, z, viewW, viewH) {
      key.position.set(x + KEY_DIR.x, KEY_DIR.y, z + KEY_DIR.z);
      key.target.position.set(x, 0, z);
      if (!shadowsOn) return;
      // 화면 대각선만큼(+ 키 큰 소품 그림자 여유) 덮는다. 크기가 조금 바뀔 때마다 다시 계산하지 않게 1 m 단위로
      const r = Math.ceil(Math.hypot(viewW, viewH) * 0.6 + 3);
      if (r !== lastR) {
        lastR = r;
        const c = key.shadow.camera;
        c.left = -r;
        c.right = r;
        c.top = r;
        c.bottom = -r;
        c.updateProjectionMatrix();
      }
    },
  };
}

/** 그림자를 던지고 받는 물체 표시(바닥·표식처럼 평평한 것은 받기만) */
export function setShadows(root: THREE.Object3D, cast: boolean, receive = true): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = cast && !o.userData.flat && !o.userData.noCast;
      o.receiveShadow = receive;
    }
  });
}

/** 따뜻한 빛 웅덩이 텍스처(가운데 살구색 → 가장자리 투명) */
let poolTex: THREE.CanvasTexture | null = null;
export function warmPoolTexture(): THREE.CanvasTexture {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,190,120,0.75)');
  grad.addColorStop(0.5, 'rgba(255,175,105,0.32)');
  grad.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

/** 바닥에 까는 따뜻한 빛 웅덩이(반지름 r m) */
export function warmPool(r: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshBasicMaterial({ map: warmPoolTexture(), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.userData.flat = true;
  return m;
}
