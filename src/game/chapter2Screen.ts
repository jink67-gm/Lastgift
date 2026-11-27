// 2장 화면: 상태(SewingState)를 받아 그리기만 한다. 로컬 2인·방장·참가자가 모두 같은 화면을 쓴다.
// 참가자는 방장이 보낸 스냅샷을 그리므로 smooth=true로 위치를 부드럽게 따라간다.
import * as THREE from 'three';
import { gripPos, needsSwap, planAction, type SewingAction, type SewingState } from '../core/sewing';
import { CH2 } from '../data/chapter2';
import { ELF_LOOKS } from '../data/elves';
import { createChapter2, createStaminaBar, createSwapSign } from '../scene/chapter2';
import { createElfAvatar } from '../scene/elfAvatar';
import type { Models } from '../scene/models';
import { createGift, createTargetRing } from '../scene/gifts';

const CAMERA_YAW = Math.PI / 4;
const CAMERA_PITCH = Math.atan(1 / Math.SQRT2);
/** 화면 세로에 담는 월드 길이(m). 광장(16 m)보다 가까이 둬서 손잡이·문을 크게 본다 */
const VIEW_HEIGHT = 12;
const MAX_ELVES = 4;

export interface DrawOptions {
  frame: number;
  elapsed: number;
  /** 미리보기 고리를 보여 줄 요정들(로컬 2인은 둘 다, 네트워크는 나만) */
  previewFor: readonly string[];
  canPlay: boolean;
  /** 스냅샷을 그릴 때 위치를 부드럽게 따라간다 */
  smooth?: boolean;
}

export interface Chapter2Screen {
  /** 그리고, previewFor[0]의 지금 행동을 돌려준다(행동 버튼 그림용) */
  draw(s: SewingState, o: DrawOptions): SewingAction;
  toScreen(x: number, z: number): { x: number; y: number };
  /** 낮음: 해상도 절반(저사양) */
  setLow(low: boolean): void;
}

export function createChapter2Screen(host: HTMLElement, models: Models): Chapter2Screen {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2433');
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a4660', 1.5));
  const moon = new THREE.DirectionalLight('#ffffff', 1.2);
  moon.position.set(-8, 16, 6);
  scene.add(moon);
  const view = createChapter2();
  scene.add(view.root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camOffset = new THREE.Vector3(
    Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
    Math.sin(CAMERA_PITCH),
    Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
  ).multiplyScalar(40);
  const camTarget = new THREE.Vector3(2.5, 0, 9);

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    const viewH = aspect >= 1 ? VIEW_HEIGHT : VIEW_HEIGHT / Math.max(aspect, 0.6);
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const elves = Array.from({ length: MAX_ELVES }, (_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.visible = false;
    scene.add(e.root);
    return e;
  });
  const bars = elves.map(() => {
    const b = createStaminaBar();
    scene.add(b.group);
    return b;
  });
  const swapSigns = elves.map(() => {
    const s = createSwapSign();
    scene.add(s);
    return s;
  });
  const rings = elves.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  const crate = createGift('sewing');
  scene.add(crate);

  // 스냅샷을 부드럽게 따라가는 표시 위치
  const shown = new Map<string, { x: number; z: number; yaw: number }>();
  const follow = (key: string, x: number, z: number, yaw: number, k: number) => {
    const cur = shown.get(key);
    if (!cur || k >= 1 || Math.hypot(cur.x - x, cur.z - z) > 3) {
      const v = { x, z, yaw };
      shown.set(key, v);
      return v;
    }
    let dy = yaw - cur.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    cur.x += (x - cur.x) * k;
    cur.z += (z - cur.z) * k;
    cur.yaw += dy * k;
    return cur;
  };

  const v = new THREE.Vector3();
  return {
    setLow(low) {
      renderer.setPixelRatio(low ? 0.5 : Math.min(window.devicePixelRatio, 2));
      resize();
    },
    toScreen(x, z) {
      v.set(x, 0, z).project(camera);
      return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
    },
    draw(s, o) {
      const k = o.smooth ? 1 - Math.exp(-o.frame * 15) : 1;
      const c = s.crate;
      const cs = follow('crate', c.x, c.z, c.yaw, k);
      crate.position.set(cs.x, c.lifted ? 0.35 : c.place === 'stand' ? 0.47 : c.place === 'bench' ? 0.77 : 0, cs.z);
      crate.rotation.y = cs.yaw - Math.PI / 2;

      let mine: SewingAction = { kind: 'none' };
      elves.forEach((e, i) => {
        const p = s.players.find((q) => q.id === `p${i}`);
        const ring = rings[i]!;
        if (!p || !p.connected) {
          e.root.visible = false;
          bars[i]!.group.visible = false;
          swapSigns[i]!.visible = false;
          ring.visible = false;
          return;
        }
        const ps = follow(p.id, p.x, p.z, p.facing, k);
        e.root.visible = true;
        e.root.position.set(ps.x, 0, ps.z);
        e.root.rotation.y = ps.yaw;
        e.animate(o.elapsed, p.moving, { carry: p.holding !== null ? (s.crate.lifted ? 'heavy' : 'grip') : 'none', act: 0, tired: needsSwap(s, p) });
        bars[i]!.group.position.set(ps.x, 2.05, ps.z);
        bars[i]!.group.quaternion.copy(camera.quaternion);
        bars[i]!.set(p.stamina, needsSwap(s, p), p.holding !== null || p.stamina < 100);
        const sw = swapSigns[i]!;
        sw.visible = needsSwap(s, p);
        if (p.holding !== null) {
          const g = gripPos(cs, p.holding);
          sw.position.set(g.x, 1.5, g.z); // 꼬리 끝이 손잡이 위
        }
        // 미리보기 고리: 지금 행동하면 무엇을 하는지 그 대상에 표시
        const show = o.canPlay && o.previewFor.includes(p.id);
        const a: SewingAction = show ? planAction(s, p.id) : { kind: 'none' };
        if (p.id === o.previewFor[0]) mine = a;
        ring.visible = a.kind !== 'none' && a.kind !== 'release';
        if (a.kind === 'grab' || a.kind === 'handover') {
          const g = gripPos(cs, a.handle);
          ring.position.set(g.x, 0.03 + i * 0.005, g.z);
        } else if (a.kind === 'latch') ring.position.set(CH2.latch.x, 0.03, CH2.latch.z);
        else if (a.kind === 'door') ring.position.set(CH2.door.x, 0.03, CH2.door.z + 0.4);
        ring.scale.setScalar(0.8 + Math.sin(o.elapsed * 6) * 0.05);
      });

      const reveal = s.space === 'workshop' ? 'open' : s.door.open ? 'glimpse' : 'hidden';
      // 팀원이나 재봉틀이 통로·작업실 입구에 있으면 앞을 가리는 벽을 반투명하게(뒤의 친구도 계속 보인다)
      const inPassage = (z: number) => z < CH2.door.z + 0.7 && z > CH2.boundaryZ - 2;
      const seeThrough = s.players.some((p) => p.connected && inPassage(p.z)) || inPassage(c.z);
      view.update(o.frame, { doorOpen: s.door.open, latched: s.door.latched, reveal, delivered: s.delivered, timeSec: o.elapsed, seeThrough });

      // 카메라: 연결된 팀원 중심을 따라가되, 확정된 공간의 범위 안으로 자른다(뒤의 친구도 화면에 남는다)
      const live = s.players.filter((p) => p.connected);
      const cx = live.reduce((acc, p) => acc + p.x, 0) / Math.max(1, live.length);
      const cz = live.reduce((acc, p) => acc + p.z, 0) / Math.max(1, live.length);
      const b = CH2.camera[s.space];
      const tx = Math.max(b.minX, Math.min(b.maxX, cx));
      const tz = Math.max(b.minZ, Math.min(b.maxZ, cz));
      const kc = 1 - Math.exp(-o.frame * 4);
      camTarget.x += (tx - camTarget.x) * kc;
      camTarget.z += (tz - camTarget.z) * kc;
      camera.position.copy(camTarget).add(camOffset);
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
      return mine;
    },
  };
}
