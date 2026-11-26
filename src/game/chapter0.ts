// 0장 · 광장에 떨어진 선물 다섯 개: 그림 이름표를 보고 네 배달지 표식 아래로 나눈다(명세서 §4 0장, §5).
//   ?chapter=0  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter). 여러 기기 연결은 STEP 07 통합 때 붙인다.
// 프롤로그(단체사진·썰매 불시착)는 STEP 04-3에서 이 장 앞에 붙인다.
import * as THREE from 'three';
import { gripPos, needsSwap, type SewingInput } from '../core/sewing';
import { createSorting, planAction, step, type SortAction, type SortEvent, type SortState } from '../core/sorting';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { PLAZA_BOUNDS, PLAZA_DRESSING, PLAZA_PROPS } from '../data/plaza';
import { CH0, markerOf, SORT_GIFTS } from '../data/chapter0';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore } from '../save/store';
import { createMarkers, createSkidTrails, createTag } from '../scene/chapter0';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { createStaminaBar, createSwapSign } from '../scene/chapter2';
import { createElfAvatar } from '../scene/elfAvatar';
import { createGift, createTargetRing } from '../scene/gifts';
import type { Models } from '../scene/models';
import { createPlaza } from '../scene/plaza';
import { LocalRun } from '../session/localRun';
import { sewingIcon, type ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { toSewingInput } from './chapter2';

const CAMERA_YAW = Math.PI / 4;
// 내려다보는 각(땅 기준). 광장 너머 골목·지붕이 보이게 35.3°에서 낮췄다(비교 촬영: docs/screens/04-2-plaza).
// 시험 모드에서만 ?pitch=도(°)로 바꿔 비교할 수 있다. 좌우 축(yaw)은 그대로라 같은 키 = 같은 화면 방향.
const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
/** 처음 몇 초 광장 전체를 넓게 보여 주는 구도(배달지 네 곳과 썰매가 한 화면에) */
const ESTABLISH = { x: -2, z: -4, viewH: 22, sec: 3.2 }; // 썰매 뒤 골목과 두 집까지 들어오게 북쪽으로 조금
const SIM_DT = 1 / 60;
const PLAYERS = ['p0', 'p1'] as const;
const CARRY_Y = 1.55;

function iconOf(a: SortAction): ActionIcon {
  if (a.kind === 'pick') return 'pick';
  if (a.kind === 'drop') return 'drop';
  if (a.kind === 'blocked') return 'blocked';
  if (a.kind === 'sewing') return a.sub.kind === 'none' ? 'none' : sewingIcon(a.sub.kind);
  return 'none';
}

export function startChapter0(models: Models): void {
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // 실제 그림자: 터치 기기(태블릿·폰)는 작은 그림자 지도, ?noshadow면 끈다(발밑 원형 그림자는 남는다)
  const params = new URLSearchParams(location.search);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  // ?quality=low: 실시간 그림자·눈결·노멀맵을 뺀다(길·표식·골목은 색으로 그대로 보인다)
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const plaza = createPlaza(models, low ? 'low' : 'normal');
  setShadows(plaza, true);
  scene.add(plaza);
  const markers = createMarkers();
  scene.add(markers.root);
  // 썰매에서 떨어진 물건이 미끄러진 자국: 자국 끝에 주울 물건이 있다
  const sleighAt = PLAZA_PROPS.find((p) => p.kind === 'sleigh')!;
  scene.add(createSkidTrails(sleighAt, [...SORT_GIFTS, CH0.crateStart]));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(40);
  // 움직임 줄이기를 고른 기기는 처음 넓은 구도 없이 바로 시작
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const camTarget = new THREE.Vector3(ESTABLISH.x, 0, ESTABLISH.z);
  let viewH = reduceMotion ? 0 : ESTABLISH.viewH;
  let establish = reduceMotion ? 0 : ESTABLISH.sec;
  let aspect = 1;
  function applyView(): void {
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    aspect = w / Math.max(h, 1);
    if (viewH === 0) viewH = baseViewH(aspect);
    applyView();
  }
  window.addEventListener('resize', resize);
  resize();

  let sort: SortState = createSorting(PLAYERS);
  let snapCamera = false;
  const events: SortEvent[] = [];

  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);

  // 새 시도(0장). 프롤로그 연출은 아직 없으므로 바로 넘긴다(STEP 04-3)
  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'dev-ch0', 'p0');
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry') sort = createSorting(PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });
  if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });

  // 모델
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    setShadows(e.root, true, false);
    scene.add(e.root);
    return e;
  });
  const rings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  const bars = PLAYERS.map(() => {
    const b = createStaminaBar();
    scene.add(b.group);
    return b;
  });
  const swaps = PLAYERS.map(() => {
    const s = createSwapSign();
    scene.add(s);
    return s;
  });
  const crate = createGift('sewing');
  setShadows(crate, true);
  scene.add(crate);
  const crateTag = createTag('tailor');
  scene.add(crateTag);
  const gifts = new Map(
    SORT_GIFTS.map((g) => {
      const v = createGift(g.kind);
      v.scale.setScalar(1.6);
      setShadows(v, true);
      scene.add(v);
      const tag = createTag(g.dest);
      scene.add(tag);
      return [g.id, { v, tag }] as const;
    }),
  );

  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += frame;
    run.frame(now);
    const live = run.canPlay && !sort.complete;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    const i2 = k2.sample();
    let inputs: Record<string, SewingInput> = live ? { p0: toSewingInput(i1), p1: toSewingInput(i2) } : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(sort, inputs, SIM_DT);
      sort = r.state;
      for (const e of r.events) {
        events.push(e);
        if (e.type === 'sorted') markers.flash(e.dest, true);
        if (e.type === 'wrong') markers.flash(e.dest, false);
        // 다섯 물건이 모두 제자리 → 0장 완료(1장 최초 체크포인트 저장)
        if (e.type === 'complete') run.dispatch({ type: 'completeChapter', at: now, chapterId: 0 });
      }
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    draw(frame);
  });

  function draw(frame: number): void {
    const sw = sort.sewing;
    const c = sw.crate;
    crate.position.set(c.x, c.lifted ? 0.35 : 0, c.z);
    crate.rotation.y = c.yaw - Math.PI / 2;
    crateTag.visible = !sort.crateSorted;
    crateTag.position.set(c.x, (c.lifted ? 0.35 : 0) + 1.05, c.z);

    for (const it of sort.items) {
      const g = gifts.get(it.id)!;
      const carried = it.carriedBy !== null;
      const bob = carried ? Math.abs(Math.sin(elapsed * 14)) * 0.04 : 0;
      g.v.position.set(it.x, carried ? CARRY_Y + bob : 0, it.z);
      g.tag.visible = !it.sorted;
      g.tag.position.set(it.x, (carried ? CARRY_Y : 0) + 0.95, it.z);
    }

    let mine: SortAction = { kind: 'none' };
    sw.players.forEach((p, i) => {
      const e = elves[i]!;
      e.root.position.set(p.x, 0, p.z);
      e.root.rotation.y = p.facing;
      e.animate(elapsed, p.moving);
      bars[i]!.group.position.set(p.x, 1.95, p.z);
      bars[i]!.group.quaternion.copy(camera.quaternion);
      bars[i]!.set(p.stamina, needsSwap(sw, p), p.holding !== null || p.stamina < 100);
      swaps[i]!.visible = needsSwap(sw, p);
      if (p.holding !== null) {
        const g = gripPos(c, p.holding);
        swaps[i]!.position.set(g.x, 2.3, g.z);
      }
      const a = run.canPlay ? planAction(sort, p.id) : ({ kind: 'none' } as const);
      if (i === 0) mine = a;
      const ring = rings[i]!;
      let at: { x: number; z: number } | null = null;
      if (a.kind === 'pick') at = sort.items.find((q) => q.id === a.itemId)!;
      else if (a.kind === 'sewing' && (a.sub.kind === 'grab' || a.sub.kind === 'handover')) at = gripPos(c, a.sub.handle);
      ring.visible = at !== null;
      if (at) ring.position.set(at.x, 0.03 + i * 0.005, at.z);
      ring.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
    });
    controls.update(iconOf(mine));
    markers.update(frame);

    // 카메라(연출 가이드 §5): 처음엔 광장 전체 → 두 요정을 함께 담고, 들고 가는 짐의 목적지 쪽을 조금 앞세운다
    establish = Math.max(0, establish - frame);
    let want = { x: ESTABLISH.x, z: ESTABLISH.z, viewH: ESTABLISH.viewH };
    if (establish === 0) {
      want = frameFor(sw.players.filter((p) => p.connected), goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      want = { ...want, x: held.x, z: held.z };
    }
    // 광장 밖도 눈밭·울타리·골목·먼 마을이 채우므로 가장자리 가까이까지 따라간다
    const tx = Math.max(PLAZA_BOUNDS.minX + 2, Math.min(PLAZA_BOUNDS.maxX - 2, want.x));
    const tz = Math.max(PLAZA_BOUNDS.minZ, Math.min(PLAZA_BOUNDS.maxZ - 2, want.z));
    const k = snapCamera ? 1 : 1 - Math.exp(-frame * 3);
    // 넓히기는 빨리(친구가 화면 밖으로 나가지 않게), 좁히기는 천천히
    const kz = snapCamera ? 1 : 1 - Math.exp(-frame * (want.viewH > viewH ? 4 : 1.2));
    snapCamera = false;
    camTarget.x += (tx - camTarget.x) * k;
    camTarget.z += (tz - camTarget.z) * k;
    const nextH = viewH + (want.viewH - viewH) * kz;
    if (Math.abs(nextH - viewH) > 1e-3) {
      viewH = nextH;
      applyView();
    }
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget);
    light.follow(camTarget.x, camTarget.z, viewH * aspect, viewH / Math.sin(CAMERA_PITCH));
    renderer.render(scene, camera);
  }

  /** 지금 들고 가는 짐의 목적지(없으면 null) */
  function goalOf(): Pt | null {
    // 정리가 끝나면 다음 골목(우편함이 보이는 곳) 쪽을 조금 보여 준다
    if (sort.complete) return PLAZA_DRESSING.alleyMouth;
    const near = (p: Pt) => Math.hypot(p.x - PLAZA_DRESSING.alleyMouth.x, p.z - PLAZA_DRESSING.alleyMouth.z) < 12;
    const held = sort.items.find((i) => i.carriedBy !== null);
    if (held) return markerOf(held.dest);
    // 재봉틀 손잡이를 하나라도 잡으면 수선집 쪽을 미리 보여 준다
    if (!sort.crateSorted && sort.sewing.handles.some((h) => h !== null)) return markerOf('tailor');
    // 빈손으로 골목 가까이 오면 골목 안쪽(우편함)을 미리 보여 준다
    if (sort.sewing.players.some((p) => p.connected && near(p))) return PLAZA_DRESSING.alleyMouth;
    return null;
  }

  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      sorting: () => JSON.parse(JSON.stringify(sort)) as SortState,
      sortEvents: () => events.map((e) => JSON.parse(JSON.stringify(e))),
      run: () => ({ ...run.state }),
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => localStorage.getItem('lastgift.cp.v1.dev-ch0'),
      /** 화면 비교 촬영용: 지금 카메라(바라보는 땅 위 점, 화면 높이 m, 각도) */
      camera: () => ({ target: { x: camTarget.x, z: camTarget.z }, viewH, aspect, yawDeg: (CAMERA_YAW * 180) / Math.PI, pitchDeg: (CAMERA_PITCH * 180) / Math.PI }),
      /** 화면 비교 촬영용(시험 모드에서만): 요정을 그 자리에 세우고 카메라를 바로 맞춘다 */
      debugPlace: (id: string, x: number, z: number, facing = 0) => {
        sort = { ...sort, sewing: { ...sort.sewing, players: sort.sewing.players.map((p) => (p.id === id ? { ...p, x, z, facing } : p)) } };
        snapCamera = true;
        establish = 0;
      },
      toScreen: (x: number, z: number) => {
        const v = new THREE.Vector3(x, 0, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
    };
  }
}
