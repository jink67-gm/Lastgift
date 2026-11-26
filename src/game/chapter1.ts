// 1장 · 유나의 첫 스케치북 — 04-4a: 돌 아치 → 우편함 골목 → 유나네 앞마당 찾기(명세서 §3.2, §5 1장).
//   ?chapter=1  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter).
//   두 선물(스케치북·색연필 통)을 나눠 들고, 빈손 요정은 지우의 그림 지도를 펴서(E) 생김새를 비교한다.
//   유나네 앞마당(낮은 담 안)에 들어서면 "찾았다". 망보기·현관 배달·유나 장면은 04-4b.
//   사람(유나·지우)은 사용자가 줄 에셋으로 넣는다(지금은 창가에 실루엣 자리).
import * as THREE from 'three';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createChapter1, planAction, step, CAMERA_YAW, type Ch1Action, type Ch1Event, type Ch1State } from '../core/chapter1';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import { chapter } from '../data/chapters';
import { CH1_BOUNDS, CH1_START, W, YARD, toLane } from '../data/chapter1';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { createChapter1Scene } from '../scene/chapter1';
import { createElfAvatar } from '../scene/elfAvatar';
import { createGift, createTargetRing } from '../scene/gifts';
import { createHoldTween, giftScale, holdSpan, placeOnGround, placeOnHands } from '../scene/hold';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createOutline } from '../scene/outline';
import { createSnowfall } from '../scene/snowfall';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { LocalRun } from '../session/localRun';
import type { ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createMapView } from '../ui/mapView';
import { createOffscreenMarks } from '../ui/offscreen';
import { createSettingsUi } from '../ui/settings';
import { toSewingInput } from './chapter2';

const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
const ELF_SCALE = 1.2;
/** 1장 화면 넓이 배율(광장 기준 구도 대비) */
const VIEW_K = 1.3;
const SIM_DT = 1 / 60;
const PLAYERS = ['p0', 'p1'] as const;
/** 처음 몇 초: 아치에서 골목 끝 유나네까지 한 화면(아치 사이로 물고기 우편함) */
const ESTABLISH = { ...W(20, 1.5), viewH: 36, sec: 3.4 };

export function chapter1Checkpoint(roomId: string) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId: 1 as const,
    savedRemainingMs: chapter(1).floorMs,
    completedChapters: [0] as 0[],
    memories: [] as never[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

function iconOf(a: Ch1Action): ActionIcon {
  if (a.kind === 'pick') return 'pick';
  if (a.kind === 'drop') return 'drop';
  if (a.kind === 'blocked') return 'blocked';
  if (a.kind === 'map') return a.open ? 'map' : 'mapClose';
  return 'none';
}

export function startChapter1(models: Models): void {
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const params = new URLSearchParams(location.search);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const space = createChapter1Scene(models, import.meta.env.BASE_URL, low ? 'low' : 'normal');
  setShadows(space.root, true);
  scene.add(space.root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const camTarget = new THREE.Vector3(ESTABLISH.x, 0, ESTABLISH.z);
  let viewH = reduceMotion ? 0 : ESTABLISH.viewH;
  let establish = reduceMotion || params.has('noestablish') ? 0 : ESTABLISH.sec;
  let aspect = 1;
  let snapCamera = false;
  function applyView(): void {
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  function resize(): void {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    if (viewH === 0) viewH = baseViewH(aspect);
    applyView();
  }
  window.addEventListener('resize', resize);
  resize();

  let state: Ch1State = createChapter1(PLAYERS);
  const events: Ch1Event[] = [];
  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);
  const kv = browserStorage();
  const settings = createSettingsUi(document, loadSettings(kv));
  const auto = new AutoQuality();
  let quality: Quality = low ? 'low' : effectiveQuality(settings.value.quality, null);
  const snow = createSnowfall(() => renderer.getPixelRatio());
  scene.add(snow.points);
  function applyQuality(): void {
    quality = low ? 'low' : effectiveQuality(settings.value.quality, auto.result);
    renderer.setPixelRatio(quality === 'low' ? 0.5 : Math.min(window.devicePixelRatio, 2));
    resize();
    light.setShadows(quality === 'normal' && !params.has('noshadow'), scene);
    snow.setCount(snowCount(quality, settings.value.reducedSnow));
  }
  settings.onChange((s) => {
    saveSettings(kv, s);
    applyQuality();
  });
  const marks = createOffscreenMarks(document, PLAYERS.length);
  const maps = createMapView(document, PLAYERS.length);

  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'dev-ch1', 'p0', chapter1Checkpoint('dev-ch1'));
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry') state = createChapter1(PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });
  if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });

  // 요정·선물
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.scale.multiplyScalar(ELF_SCALE);
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
  const gifts = new Map(
    CH1_START.items.map((g) => {
      const v = createGift(g.kind);
      v.scale.setScalar(giftScale(g.kind, ELF_SCALE));
      setShadows(v, true);
      scene.add(v);
      const span = holdSpan(v, ELF_SCALE);
      return [g.id, { v, span, outline: createOutline(v, 0.035) }] as const;
    }),
  );
  // 지도를 편 요정의 손에 든 종이 지도(작게 접힌 종이 + 빨간 길)
  const paperMaps = PLAYERS.map(() => {
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.36), new THREE.MeshStandardMaterial({ color: '#fffdf3', roughness: 1 }));
    sheet.position.y = 0.006;
    g.add(sheet);
    const road = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.3), new THREE.MeshBasicMaterial({ color: '#e0342f' }));
    road.position.y = 0.014;
    road.rotation.y = 0.5;
    g.add(road);
    g.rotation.x = -0.6;
    g.visible = false;
    scene.add(g);
    return g;
  });
  const holdTween = createHoldTween();
  const cf = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const fader = createOcclusionFader(scene, camera);
  const shown = new Map<string, { x: number; z: number; yaw: number }>();
  const follow = (id: string, x: number, z: number, yaw: number, k: number) => {
    let v = shown.get(id);
    if (!v || Math.hypot(v.x - x, v.z - z) > 3) {
      v = { x, z, yaw };
      shown.set(id, v);
      return v;
    }
    v.x += (x - v.x) * k;
    v.z += (z - v.z) * k;
    const d = Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw));
    v.yaw += d * k;
    return v;
  };
  const actAt = new Map<string, number>();
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let foundAt = -1;
  applyQuality();

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    const fq = auto.feed(raw);
    if (fq) applyQuality();
    const frame = Math.min(raw, 0.25);
    acc += frame;
    run.frame(now);
    const live = run.canPlay;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    const i2 = k2.sample();
    let inputs: Record<string, SewingInput> = live ? { p0: toSewingInput(i1), p1: toSewingInput(i2) } : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(state, inputs, SIM_DT);
      state = r.state;
      for (const e of r.events) {
        events.push(e);
        if (e.type === 'pick' || e.type === 'drop') actAt.set(e.playerId, elapsed);
        if (e.type === 'found') foundAt = elapsed;
      }
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    draw(frame);
  });

  function draw(frame: number): void {
    const kf = 1 - Math.exp(-frame * 22);
    let mine: Ch1Action = { kind: 'none' };
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      const ps = follow(p.id, p.x, p.z, p.facing, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      const held = state.items.find((it) => it.carriedBy === p.id);
      const since = elapsed - (actAt.get(p.id) ?? -9);
      e.animate(elapsed, p.moving, {
        carry: held || p.mapOpen ? 'light' : 'none',
        act: since >= 0 && since < 0.35 ? since / 0.35 : 0,
        tired: false,
        span: held ? gifts.get(held.id)!.span : p.mapOpen ? 0.42 / ELF_SCALE : undefined,
      });
      e.root.updateMatrixWorld(true);
      // 지도: 편 요정 손 위 종이 + 화면 아래 모서리 그림
      const pm = paperMaps[i]!;
      pm.visible = p.mapOpen;
      if (p.mapOpen) {
        placeOnHands(pm, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
        pm.rotateX(-0.6);
      }
      maps.set(i, p.mapOpen, ELF_LOOKS[i]!.hat);
      const a = run.canPlay ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (i === 0) mine = a;
      const ring = rings[i]!;
      const tgt = a.kind === 'pick' ? state.items.find((q) => q.id === a.itemId)! : null;
      ring.visible = tgt !== null;
      if (tgt) ring.position.set(tgt.x, 0.03 + i * 0.005, tgt.z);
      ring.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
    });
    for (const it of state.items) {
      const g = gifts.get(it.id)!;
      const idx = it.carriedBy ? state.players.findIndex((q) => q.id === it.carriedBy) : -1;
      if (idx >= 0) {
        const e = elves[idx]!;
        const ps = shown.get(state.players[idx]!.id)!;
        placeOnHands(g.v, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
      } else placeOnGround(g.v, it.x, it.z);
      holdTween.apply(it.id, g.v, idx >= 0, elapsed);
    }
    controls.update(iconOf(mine));
    space.update(elapsed);
    // 찾았을 때: 유나네 창가가 따뜻하게 한 번 숨쉰다
    if (foundAt >= 0) {
      const k = Math.max(0, 1 - (elapsed - foundAt) / 1.6);
      space.yunaPlaceholder.scale.setScalar(1 + 0.08 * Math.sin(k * Math.PI * 3) * k);
    }

    // 카메라: 처음엔 아치~유나네 한 화면 → 두 요정을 함께, 골목 끝(유나네) 쪽을 조금 앞세운다
    establish = Math.max(0, establish - frame);
    let want = { x: ESTABLISH.x, z: ESTABLISH.z, viewH: ESTABLISH.viewH };
    if (establish === 0) {
      want = frameFor(state.players.filter((p) => p.connected), goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      // 사람 크기 집 사이 골목: 광장보다 조금 넓게 보여 둘레(우편함·화분)가 함께 들어오게
      want = { ...want, x: held.x, z: held.z, viewH: want.viewH * VIEW_K };
    }
    const safe = touchDevice ? (0.1 * viewH) / Math.sin(CAMERA_PITCH) / Math.SQRT2 : 0;
    const tx = Math.max(CH1_BOUNDS.minX, Math.min(CH1_BOUNDS.maxX, want.x + safe));
    const tz = Math.max(CH1_BOUNDS.minZ, Math.min(CH1_BOUNDS.maxZ, want.z + safe));
    const k = snapCamera ? 1 : 1 - Math.exp(-frame * 3);
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
    for (const g of gifts.values()) g.outline.set(null);
    state.players.forEach((p, i) => {
      if (!run.canPlay || !p.connected) return;
      const a = planAction(state, p.id);
      if (a.kind === 'pick') {
        const o = gifts.get(a.itemId)!.outline;
        if (!o.group.visible) o.set(ELF_LOOKS[i]!.hat);
      }
    });
    snow.update(frame, camTarget.x, camTarget.z, viewH * 1.3);
    marks.update(
      state.players.map((p, i) => {
        const ps = shown.get(p.id) ?? p;
        const v = new THREE.Vector3(ps.x, 0.7 * ELF_SCALE, ps.z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight, color: ELF_LOOKS[i]!.hat };
      }),
      host.clientWidth,
      host.clientHeight,
    );
    const pts: THREE.Vector3[] = [];
    for (const p of state.players) if (p.connected) pts.push(new THREE.Vector3(p.x, 0.5 * ELF_SCALE, p.z), new THREE.Vector3(p.x, 1.05 * ELF_SCALE, p.z));
    fader.update(pts, frame);
    renderer.render(scene, camera);
  }

  /** 앞세워 보여 줄 곳: 골목 끝 유나네 담(아직 못 찾았으면), 찾았으면 앞마당 */
  function goalOf(): Pt | null {
    if (state.found) return W((YARD.front + YARD.back) / 2, 0);
    const far = Math.max(...state.players.map((p) => toLane(p).s));
    return far > 20 ? W(YARD.front - 2, 4) : null;
  }

  if (import.meta.env.DEV || params.has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      ch1: () => JSON.parse(JSON.stringify(state)) as Ch1State,
      ch1Events: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      maps: () => PLAYERS.map((_, i) => maps.isOpen(i)),
      lane: (x: number, z: number) => toLane({ x, z }),
      world: (s: number, t: number) => W(s, t),
      debugPlace: (id: string, s: number, t: number, facing = 0) => {
        const p = W(s, t);
        state = { ...state, players: state.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, facing } : q)) };
        snapCamera = true;
        establish = 0;
      },
      toScreen: (x: number, z: number, y = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
      camera: () => ({ target: { x: camTarget.x, z: camTarget.z }, viewH, aspect }),
    };
  }
}
