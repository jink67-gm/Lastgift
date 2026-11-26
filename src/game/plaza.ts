// 0장 광장(시험용): 요정 1명을 키보드 또는 터치로 움직이고 선물을 들고 놓는다(고정 회전 쿼터뷰).
import * as THREE from 'three';
import { applyAction, chooseTarget, planAction, type Action, type Item } from '../core/carry';
import { overlaps, type Collider } from '../core/collision';
import { stepPlayer, ELF_RADIUS, type PlayerState, type World } from '../core/player';
import { ELF_LOOKS } from '../data/elves';
import { PLAZA_GIFTS, SEWING_SIZE } from '../data/gifts';
import { ELF_SPAWN, PLAZA_BOUNDS, PLAZA_COLLIDERS } from '../data/plaza';
import { attachKeyboard, KeyState } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { createElfAvatar } from '../scene/elfAvatar';
import type { Models } from '../scene/models';
import { createGift, createTargetRing } from '../scene/gifts';
import { giftScale, holdShape, placeHeld, placeOnGround } from '../scene/hold';
import { createPlaza } from '../scene/plaza';
import { browserStorage, CheckpointStore } from '../save/store';
import { LocalRun } from '../session/localRun';
import { iconFor } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';

export function startPlaza(models: Models): void {
  const CAMERA_YAW = Math.PI / 4; // 게임 중 바뀌지 않는다
  const CAMERA_PITCH = Math.atan(1 / Math.SQRT2);
  const VIEW_HEIGHT = 12; // 화면 세로에 담기는 월드 길이(m). 가까이 둬서 요정·선물을 크게 본다
  const SIM_DT = 1 / 60; // 고정 틱
  const ME = 'p0';

  const host = document.getElementById('game');
  if (!host) throw new Error('#game 요소가 없습니다');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // ?quality=low: 해상도를 절반으로 그려 저사양 기기(와 자동 시험)의 부담을 줄인다
  renderer.setPixelRatio(new URLSearchParams(location.search).get('quality') === 'low' ? 0.5 : Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2433');
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a4660', 1.6));
  const moon = new THREE.DirectionalLight('#ffffff', 1.3);
  moon.position.set(-8, 16, 6);
  scene.add(moon);
  // ?quality=low: 눈결 없이(저사양·자동 시험)
  scene.add(createPlaza(models, new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'normal'));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const CAM_OFFSET = new THREE.Vector3(
    Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
    Math.sin(CAMERA_PITCH),
    Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
  ).multiplyScalar(40);
  const camTarget = new THREE.Vector3(ELF_SPAWN.x, 0, ELF_SPAWN.z);

  // 무거운 재봉틀 상자는 혼자 들 수 없으므로 길을 막는 충돌체가 된다.
  const sewing = PLAZA_GIFTS.find((g) => !g.light)!;
  const colliders: Collider[] = [
    ...PLAZA_COLLIDERS,
    { kind: 'box', x: sewing.x, z: sewing.z, hx: SEWING_SIZE.w / 2, hz: SEWING_SIZE.d / 2 },
  ];
  const world: World = { colliders, bounds: PLAZA_BOUNDS, cameraYaw: CAMERA_YAW };

  let player: PlayerState = { x: ELF_SPAWN.x, z: ELF_SPAWN.z, facing: 0, moving: false };
  let items: readonly Item[] = PLAZA_GIFTS.map((g) => ({
    id: g.id, x: g.x, z: g.z, light: g.light, carriedBy: null,
    ...(g.light ? {} : { reach: SEWING_SIZE.w / 2 }),
  }));
  const actionLog: Action[] = [];

  const elf = createElfAvatar(models, ELF_LOOKS[0]!);
  scene.add(elf.root);
  // 가벼운 선물은 요정이 가슴에 안을 수 있는 크기(0장과 같은 비율)
  const giftViews = new Map(
    PLAZA_GIFTS.map((g) => {
      const v = createGift(g.kind);
      if (g.light) v.scale.setScalar(giftScale(g.kind, 1));
      return [g.id, { v, shape: holdShape(g.kind, new THREE.Box3().setFromObject(v).getSize(new THREE.Vector3())) }] as const;
    }),
  );
  for (const { v } of giftViews.values()) scene.add(v);
  const ring = createTargetRing();
  scene.add(ring);

  const keys = new KeyState();
  attachKeyboard(window, keys);
  const controls = createControls(document);
  const hud = createHud(document);

  // 팀 시도: 아직 방·네트워크가 없으므로 이 기기 혼자 방장('local' 방)이다.
  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'local', ME);
  run.attachVisibility(document);
  run.dispatch({ type: 'start', at: performance.now() });
  // 공동 도입 연출은 아직 없으므로 바로 넘긴다(STEP 04에서 만든다).
  if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });

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

  const hl = new THREE.Vector3();
  const hr = new THREE.Vector3();
  function syncViews(timeSec: number): void {
    elf.root.position.set(player.x, 0, player.z);
    elf.root.rotation.y = player.facing;
    const held = items.find((i) => i.carriedBy === ME);
    elf.animate(timeSec, player.moving, { carry: held ? 'light' : 'none', act: 0, tired: false, span: held ? giftViews.get(held.id)!.shape.across : undefined });
    elf.root.updateMatrixWorld(true);
    for (const it of items) {
      const { v, shape } = giftViews.get(it.id)!;
      if (it.carriedBy === ME) {
        // 두 팔을 모아 가슴에 안고 간다(얼굴을 가리지 않게, 손이 옆면을 감싸게)
        const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
        const hands = elf.hands?.(hl, hr) ? { y: (hl.y + hr.y) / 2, fwd: ((hl.x + hr.x) / 2 - player.x) * fx + ((hl.z + hr.z) / 2 - player.z) * fz } : null;
        placeHeld(v, shape, { x: player.x, z: player.z, yaw: player.facing }, hands, 1);
      } else {
        placeOnGround(v, it.x, it.z);
      }
    }
    const target = items.some((i) => i.carriedBy === ME) ? null : chooseTarget(player, items);
    ring.visible = target !== null;
    if (target) {
      ring.position.x = target.x;
      ring.position.z = target.z;
      const s = target.light ? 1 : 1.9;
      const pulse = 1 + Math.sin(timeSec * 6) * 0.06;
      ring.scale.set(s * pulse, s * pulse, 1);
    }
  }

  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  renderer.setAnimationLoop((now) => {
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += frame;
    run.frame(now);
    const sampled = mergeIntents(keys.sample(), controls.touch.sample());
    // 일시중지·시간 초과·연출 중에는 입력을 버린다(재개 순간 밀린 입력이 튀지 않게).
    const intent = run.canPlay ? sampled : { move: { x: 0, y: 0 }, action: { down: false, held: false, up: false } };
    // 행동은 프레임당 한 번만 판정한다(같은 입력을 두 번 쓰지 않는다).
    if (intent.action.down) {
      const a = planAction(ME, player, items, colliders, PLAZA_BOUNDS);
      const next = applyAction(ME, items, a);
      if (a.kind !== 'none') actionLog.push(a);
      items = next;
    }
    while (acc >= SIM_DT) {
      player = stepPlayer(player, intent.move, SIM_DT, world);
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    syncViews(elapsed);
    controls.update(run.canPlay ? iconFor(planAction(ME, player, items, colliders, PLAZA_BOUNDS)) : 'none');
    placeCamera(frame);
    renderer.render(scene, camera);
  });

  // 자동 검사용 창구: 개발 서버이거나 주소에 ?test가 있을 때만 연다.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    const v = new THREE.Vector3();
    (window as unknown as Record<string, unknown>).__lastgift = {
      player: () => ({ ...player }),
      setPlayer: (x: number, z: number, facing?: number) => {
        player = { ...player, x, z, facing: facing ?? player.facing };
        camTarget.set(x, 0, z);
      },
      items: () => items.map((i) => ({ ...i })),
      actions: () => actionLog.map((a) => a.kind),
      touchMode: () => controls.touchMode,
      run: () => ({ ...run.state, remaining: Math.round(run.state.runningSince === null ? run.state.remainingMs : run.state.remainingMs - (performance.now() - run.state.runningSince)) }),
      runEffects: () => run.log.map((e) => e.type),
      /** 테스트용: 팀 시간을 ms만큼 바로 흘린다 */
      skipTime: (ms: number) => {
        if (run.state.runningSince !== null) run.state = { ...run.state, runningSince: run.state.runningSince - ms };
      },
      /** 바닥 위 한 점의 현재 화면 좌표(CSS px) */
      toScreen: (x: number, z: number) => {
        v.set(x, 0, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
      insideCollider: () => colliders.some((c) => overlaps(player, ELF_RADIUS - 1e-3, c)),
    };
  }
}
