// 0장 · 광장에 떨어진 선물 다섯 개: 그림 이름표를 보고 네 배달지 표식 아래로 나눈다(명세서 §4 0장, §5).
//   ?chapter=0  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter). 여러 기기 연결은 STEP 07 통합 때 붙인다.
// 새 시도면 먼저 프롤로그(단체사진·썰매 불시착, game/prologue.ts)를 튼다. 시험 모드(?test)는 &prologue가 있을 때만 튼다.
import { createHoldTween, giftScale, holdSpan, placeOnGround, placeOnHands } from '../scene/hold';
import * as THREE from 'three';
import { isAdmin } from '../ui/admin';
import { addHaze, createBackdrop } from '../scene/backdrop';
import { gripPos, needsSwap, type SewingInput } from '../core/sewing';
import { createSorting, planAction, step, type SortAction, type SortEvent, type SortState } from '../core/sorting';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { PLAZA_BOUNDS, PLAZA_DRESSING, PLAZA_PROPS } from '../data/plaza';
import { CH0, markerOf, SORT_GIFTS } from '../data/chapter0';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { createMarkers, createSkidTrails, createTag } from '../scene/chapter0';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { createStaminaBar, createSwapSign } from '../scene/chapter2';
import { createElfAvatar } from '../scene/elfAvatar';
import { createDoto, createKongi, createSanta } from '../scene/characters';
import { photoLineup, beatAt } from '../core/prologue';
import { createPrologue, type Prologue } from './prologue';
import { createGift, createTargetRing } from '../scene/gifts';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createOutline } from '../scene/outline';
import { createSnowfall } from '../scene/snowfall';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import { createSettingsUi } from '../ui/settings';
import { createOffscreenMarks } from '../ui/offscreen';
import { createPlaza, townBench, townLamp } from '../scene/plaza';
import { TOWN } from '../data/townScale';
import { LocalRun } from '../session/localRun';
import { createPlayMeter } from '../session/playMeter';
import { sfxEvent } from '../audio/sfx';
import type { TeamRun } from '../session/mirrorRun';
import { playerBack, playerGone } from '../core/presence';
import { IDLE_INTENT } from '../input/intent';
import { sewingIcon, type ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { toSewingInput } from './chapter2';
import { storyFor, type StoryOptions } from './story';

const CAMERA_YAW = Math.PI / 4;
// 내려다보는 각(땅 기준). 광장 너머 골목·지붕이 보이게 35.3°에서 낮췄다(비교 촬영: docs/screens/04-2-plaza).
// 시험 모드에서만 ?pitch=도(°)로 바꿔 비교할 수 있다. 좌우 축(yaw)은 그대로라 같은 키 = 같은 화면 방향.
const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
/** 처음 몇 초 광장 전체를 넓게 보여 주는 구도(배달지 네 곳과 썰매가 한 화면에) */
const ESTABLISH = { x: 0, z: -2, viewH: 26, sec: 3.2 }; // 둥근 광장 전체(가운데 트리·골목 넷·썰매)가 들어오게
const SIM_DT = 1 / 60;
/**
 * 요정 크기: 0장 화면에서 1.2배(모자 제외 키 약 1.32). 문(2.8)·벤치 좌판(1.0)·재봉틀 상자(0.6)와 견줘 정했다.
 * 시험 모드에서만 ?elf=배율로 바꿔 비교할 수 있다. 판정(충돌 반지름·손잡이 거리)은 그대로다.
 */
const ELF_SCALE = testParams.has('test') && testParams.get('elf') ? Number(testParams.get('elf')) : 1.2;
/** 시험 모드 느리게(동작을 여러 장으로 찍어 확인할 때). 1 = 평소 */
const TEST_SLOW = testParams.has('test') && testParams.get('slow') ? Number(testParams.get('slow')) : 1;
/** 시험 모드 확대(동작을 가까이서 확인할 때). 1 = 평소 */
const TEST_ZOOM = testParams.has('test') && testParams.get('zoom') ? Number(testParams.get('zoom')) : 1;
/** 가벼운 선물은 가슴에 두 손으로 안는다(머리 위로 들면 긴 모자 위에 떠 보였다, `scene/hold.ts`) */

function iconOf(a: SortAction): ActionIcon {
  if (a.kind === 'pick') return 'pick';
  if (a.kind === 'drop') return 'drop';
  if (a.kind === 'blocked') return 'blocked';
  if (a.kind === 'sewing') return a.sub.kind === 'none' ? 'none' : sewingIcon(a.sub.kind);
  return 'none';
}

export function startChapter0(models: Models, opts?: StoryOptions): void {
  const sto = storyFor(opts, 'dev-ch0');
  const net = opts?.net;
  const guest = net?.role === 'guest';
  /** 이 시도의 요정들(한 기기 둘, 여러 기기는 방장이 시작할 때 정한 2~4명) */
  const PLAYERS: readonly string[] = net ? net.slots : ['p0', 'p1'];
  /** 이 기기가 움직이는 요정 */
  const ME = net?.me ?? 'p0';
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 품질 설정에서 다시 정한다(applyQuality)
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // 실제 그림자: 터치 기기(태블릿·폰)는 작은 그림자 지도, ?noshadow면 끈다(발밑 원형 그림자는 남는다)
  const params = new URLSearchParams(location.search);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  // ?quality=low: 실시간 그림자·눈결·노멀맵을 뺀다(길·표식·골목은 색으로 그대로 보인다)
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const lowScene = low || loadSettings(browserStorage()).quality === 'low';
  const plaza = createPlaza(models, lowScene ? 'low' : 'normal');
  setShadows(plaza, true);
  scene.add(plaza);
  // 광장 너머: 1·3·4장과 같은 산·숲·하늘(광장과 둘레 집, 사진기 쪽 남동은 비운다).
  // 낮음: 광장은 집으로 둘러싸여 하늘이 조금만 보인다 → 먼 배경을 빼서 가볍게(낮음 0장 FPS가 반으로 떨어졌다)
  if (!lowScene) {
    scene.add(createBackdrop(models, { center: { x: 0, z: 0 }, forest: [16, 95], trees: 260, keepOut: (p) => Math.hypot(p.x, p.z) < 32 || (p.x + p.z > 10 && Math.hypot(p.x, p.z) < 70) }));
    addHaze(scene);
  }
  const markers = createMarkers();
  /**
   * 0장 끝 장면(다 나누면): 물고기 자루(유나네)에 가장 가까운 요정이 자루 앞으로 걸어가 두 손으로 들어 등에 메고(1.2초),
   * 모두 유나네 골목 쪽을 보고 몇 걸음 → 1장. 화면만(판정과 무관). 방장·참가자 모두 같은 상태에서 같은 요정을 고른다
   */
  let ending: { clock: number; carrier: number; from: { x: number; z: number }; slung: boolean } | null = null;
  const ENDING = { walk: 1.3, sling: 1.35, turn: 2.75, go: 3.2, next: 4.4 } as const;
  /** 자루에 넣은 시각(선물 id → 초): 자루로 옮겨 가는 이음이 끝난 뒤 숨긴다 */
  const sackedAt = new Map<string, number>();
  scene.add(markers.root);
  // 썰매에서 떨어진 물건이 미끄러진 자국: 자국 끝에 주울 물건이 있다
  const sleighAt = PLAZA_PROPS.find((p) => p.kind === 'sleigh')!;
  scene.add(createSkidTrails(sleighAt, [...SORT_GIFTS, CH0.crateStart]));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(40);
  // 움직임 줄이기를 고른 기기는 처음 넓은 구도 없이 바로 시작
  // 기기 설정(동작 줄이기) 또는 게임 설정 「움직임 줄이기」
  const reduceMotion = (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) || loadSettings(browserStorage()).noShake;
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

  // 개인 설정(그래픽 품질·눈발·FPS 표시): 이 기기에만 저장. ?quality=low는 시작 품질을 낮음으로 고정
  const kv = browserStorage();
  const settings = createSettingsUi(document, loadSettings(kv));
  const forcedLow = low;
  const auto = new AutoQuality();
  let quality: Quality = forcedLow ? 'low' : effectiveQuality(settings.value.quality, null);
  const snow = createSnowfall(() => renderer.getPixelRatio());
  scene.add(snow.points);
  function applyQuality(): void {
    const q = forcedLow ? 'low' : effectiveQuality(settings.value.quality, auto.result);
    quality = q;
    renderer.setPixelRatio(q === 'low' ? 0.5 : Math.min(window.devicePixelRatio, 2));
    resize();
    light.setShadows(q === 'normal' && !params.has('noshadow'), scene);
    snow.setCount(snowCount(q, settings.value.reducedSnow));
  }
  settings.onChange((s) => {
    saveSettings(kv, s);
    applyQuality();
  });
  const marks = createOffscreenMarks(document, PLAYERS.length);

  // 새 시도(0장): 프롤로그 연출 → 플레이. 이어 하기(체크포인트)·시간 초과 재시도면 프롤로그 없이 바로 플레이
  const makeRun = () => new LocalRun(new CheckpointStore(browserStorage()), hud, sto.roomId, 'p0');
  const run: TeamRun = net ? net.bindRun(hud, makeRun) : makeRun();
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry') sort = createSorting(PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });
  const wantPrologue = run.state.phase === 'cutscene' && (!testParams.has('test') || testParams.has('prologue'));
  if (run.state.phase === 'cutscene' && !wantPrologue) {
    run.dispatch({ type: 'savePhoto', at: performance.now(), photo: photoLineup(PLAYERS.map((_, i) => i)) });
    run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  }
  // 여러 기기: 끊긴 요정은 멈추고 손잡이·선물을 그 자리에 놓는다 / 참가자는 방장 사건으로 소리·연출을 시작한다
  // 플레이 기록(장별 조작 시간·FPS·기기) + FPS 표시
  const meter = createPlayMeter({ chapterId: 0, run, players: PLAYERS.length, role: net?.role ?? 'local', quality: () => quality, showFps: (f, q) => settings.setFps(f, q) });
  net?.onPresence((id, on) => (sort = on ? playerBack(sort, id) : playerGone(sort, id)));
  net?.onEvents((evs) => {
    for (const e of evs as SortEvent[]) onEvent(e);
  });

  // 모델
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
  const crateOutline = createOutline(crate, 0.06);
  const crateTag = createTag('tailor');
  scene.add(crateTag);
  const gifts = new Map(
    SORT_GIFTS.map((g) => {
      const v = createGift(g.kind);
      // 요정이 두 팔을 모아 가슴에 안을 수 있는 크기
      v.scale.setScalar(giftScale(g.kind, ELF_SCALE));
      setShadows(v, true);
      scene.add(v);
      const span = holdSpan(v, ELF_SCALE);
      const outline = createOutline(v, 0.035);
      const tag = createTag(g.dest);
      scene.add(tag);
      // 품에 안을 때 쓰는 크기(가로·세로·높이, 원점은 바닥 가운데). 윤곽을 붙이기 전에 잰다
      return [g.id, { v, tag, outline, span }] as const;
    }),
  );

  // 산타(썰매 앞쪽을 받친다)·도토(썰매 날을 살핀다)·콩이(프롤로그 사진에서만). 광장의 기본 도형 산타는 숨긴다
  const plainSanta = plaza.getObjectByName('santa');
  if (plainSanta) plainSanta.visible = false;
  const santa = createSanta(models);
  setShadows(santa.root, true, false);
  santa.root.userData.fadeable = true;
  scene.add(santa.root);
  const doto = createDoto(models);
  doto.root.scale.multiplyScalar(ELF_SCALE);
  setShadows(doto.root, true, false);
  scene.add(doto.root);
  const kongi = createKongi(models);
  kongi.root.visible = false;
  scene.add(kongi.root);
  const sleighObj = plaza.getObjectByName('sleigh')!;
  const sleighHeldTilt = 0.2;
  const placeCrew = () => {
    santa.root.position.set(CH0.santaHold.x, 0, CH0.santaHold.z);
    santa.root.rotation.set(0, CH0.santaHold.facing, 0);
    doto.root.position.set(CH0.dotoFix.x, 0, CH0.dotoFix.z);
    doto.root.rotation.set(0, CH0.dotoFix.facing, 0);
    doto.act?.('Interact');
    sleighObj.rotation.order = 'YZX';
    sleighObj.rotation.z = sleighHeldTilt;
  };

  // 프롤로그(새 시도일 때만)
  let prologue: Prologue | null = null;
  /** 플레이할 때만 보이는 것(대상 고리·체력 막대·교대 표시·이름표) */
  const playOnly = (on: boolean) => {
    for (const r of rings) r.visible = on && r.visible;
    for (const b of bars) b.group.visible = on;
    for (const w of swaps) w.visible = on && w.visible;
    for (const g of gifts.values()) g.tag.visible = on;
    crateTag.visible = on;
  };
  if (wantPrologue) {
    playOnly(false);
    const starts = sort.sewing.players.map((p) => ({ x: p.x, z: p.z, facing: p.facing }));
    prologue = createPrologue({
      scene,
      elves,
      slots: PLAYERS.map((_, i) => i),
      elfScale: ELF_SCALE,
      elfStarts: starts,
      santa,
      santaHold: CH0.santaHold,
      doto,
      dotoFix: CH0.dotoFix,
      kongi,
      sleigh: sleighObj,
      snowPile: plaza.getObjectByName('snowPile') ?? null,
      cargo: [
        { v: crate, to: { x: CH0.crateStart.x, z: CH0.crateStart.z, facing: CH0.crateStart.yaw - Math.PI / 2 }, heavy: true },
        ...SORT_GIFTS.map((g) => ({ v: gifts.get(g.id)!.v, to: { x: g.x, z: g.z, facing: 0 } })),
      ],
      tags: [{ obj: crateTag, y: 1.05 }, ...SORT_GIFTS.map((g) => ({ obj: gifts.get(g.id)!.tag, y: 0.95 }))],
      sleighHeldTilt,
      reduceMotion,
      storm: (k) => {
        light.setStorm(k * 0.9);
        const base = snowCount(quality, settings.value.reducedSnow);
        snow.setCount(Math.min(600, base * (1 + 1.6 * k)));
        snow.setStorm(k);
      },
      snowAround: (dt, x, z, r, y) => snow.update(dt, x, z, r, y),
      onPhoto: (photo) => run.dispatch({ type: 'savePhoto', at: performance.now(), photo }),
    });
    prologue.update(0, aspect);
  } else placeCrew();

  /** 화면 확인용(시험 모드만): 제자리에서 걷는 동작만 보이는 요정 */
  const runInPlace = new Set<string>();
  const holdTween = createHoldTween();
  /** 손에 든 선물 자리(두 손목 가운데·방향) */
  const cf = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const fader = createOcclusionFader(scene, camera);
  /** 요정별 마지막 손 동작(집기·놓기·잡기) 시각 */
  const actAt = new Map<string, number>();
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  applyQuality();
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    // 자동 품질: 시작 뒤 실제 프레임 시간을 보고 느리면 한 번 낮음으로
    meter.frame(raw);
    if (auto.feed(raw) && settings.value.quality === 'auto' && !forcedLow) applyQuality();
    const frame = Math.min(raw, 0.25) / TEST_SLOW;
    last = now;
    acc += frame;
    run.frame(now);
    const live = run.canPlay && !sort.complete;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    if (guest) {
      // 참가자: 입력만 보내고 방장 상태를 그린다
      net!.sendIntent(live ? i1 : IDLE_INTENT);
      sort = net!.remote<SortState>() ?? sort;
      elapsed += frame;
      acc = 0;
    }
    let inputs: Record<string, SewingInput> = net
      ? net.inputs(i1, live)
      : live
        ? { p0: toSewingInput(i1), p1: toSewingInput(k2.sample()) }
        : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(sort, inputs, SIM_DT);
      sort = r.state;
      for (const e of r.events) onEvent(e);
      net?.emit(r.events);
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    if (!guest) net?.publish(0, sort);
    if (prologue && !prologue.done) {
      prologue.update(frame, aspect);
      if (prologue.done) startPlay();
      else {
        renderer.render(scene, prologue.camera);
        prologue.afterRender(renderer.domElement);
        return;
      }
    } else if (prologue) {
      prologue.update(frame, aspect);
      if (prologue.closed) {
        prologue.dispose();
        prologue = null;
      }
    }
    draw(frame);
  });

  function onEvent(e: SortEvent): void {
    sfxEvent(e);
    events.push(e);
    // 집기·놓기·잡기·놓기·들어올리기: 그 요정의 손 뻗는 동작을 시작한다
    if (e.type === 'pick' || e.type === 'drop') actAt.set(e.playerId, elapsed);
    if (e.type === 'sewing' && (e.event.type === 'grab' || e.event.type === 'release')) actAt.set(e.event.playerId, elapsed);
    if (e.type === 'sewing' && e.event.type === 'lift') for (const q of sort.sewing.players) if (q.holding !== null) actAt.set(q.id, elapsed);
    if (e.type === 'sorted') markers.flash(e.dest, true);
    if (e.type === 'wrong') markers.flash(e.dest, false);
    // 다섯 물건이 모두 제자리 → 0장 완료(1장 최초 체크포인트 저장)
    if (e.type === 'complete') {
      run.dispatch({ type: 'completeChapter', at: performance.now(), chapterId: 0 });
      // 이야기 모드: 끝 장면(자루 메고 골목 쪽으로) 뒤 1장으로
      if (sto.story) window.setTimeout(() => sto.next(), ENDING.next * 1000);
    }
  }

  /** 프롤로그가 끝났다(또는 건너뛰었다): 산타·도토는 제자리, 팀 시계가 흐르고 광장 전체 구도부터 */
  function startPlay(): void {
    placeCrew();
    playOnly(true);
    if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
    establish = reduceMotion ? 0 : ESTABLISH.sec;
    viewH = reduceMotion ? baseViewH(aspect) : ESTABLISH.viewH;
    camTarget.set(ESTABLISH.x, 0, ESTABLISH.z);
    snapCamera = true;
    applyView();
  }

  // 화면에 보이는 위치: 판정(60 Hz 고정 틱) 위치를 부드럽게 따라간다 → 틱이 몰리거나 비는 프레임에 덜덜 떨리지 않는다
  const shown = new Map<string, { x: number; z: number; yaw: number }>();
  const follow = (id: string, x: number, z: number, yaw: number, k: number, snap = false) => {
    let v = shown.get(id);
    if (!v || snap || Math.hypot(v.x - x, v.z - z) > 3) {
      v = { x, z, yaw };
      shown.set(id, v);
      return v;
    }
    v.x += (x - v.x) * k;
    v.z += (z - v.z) * k;
    let d = yaw - v.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.yaw += d * k;
    return v;
  };
  const hl = new THREE.Vector3();
  const hr = new THREE.Vector3();

  function draw(frame: number): void {
    const sw = sort.sewing;
    const c = sw.crate;
    const kf = 1 - Math.exp(-frame * 22);
    const cs = follow('crate', c.x, c.z, c.yaw, kf, !c.lifted);

    let mine: SortAction = { kind: 'none' };
    // 두 손잡이를 든 요정의 손 높이(재봉틀을 손에 맞춰 띄운다)
    let handY = 0;
    let handN = 0;
    if (sort.complete && !ending) {
      const sack = markerOf('yuna');
      let best = 0;
      sw.players.forEach((p, i) => {
        const b = sw.players[best]!;
        if (p.connected && (!b.connected || Math.hypot(p.x - sack.x, p.z - sack.z) < Math.hypot(b.x - sack.x, b.z - sack.z))) best = i;
      });
      const b = shown.get(sw.players[best]!.id) ?? sw.players[best]!;
      ending = { clock: 0, carrier: best, from: { x: b.x, z: b.z }, slung: false };
    }
    if (ending) ending.clock += frame;
    sw.players.forEach((p, i) => {
      const e = elves[i]!;
      const ps = follow(p.id, p.x, p.z, p.facing, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      if (ending) {
        const t = ending.clock;
        const sack = markerOf('yuna');
        const mouth = PLAZA_DRESSING.alleyMouth;
        const toMouth = Math.atan2(mouth.x - ps.x, mouth.z - ps.z);
        let walking = false;
        if (i === ending.carrier) {
          // 자루 앞(자루에서 요정 쪽으로 0.8 m)까지 걸어가 자루를 본다 → 메기 → 골목 쪽으로 몇 걸음
          const f = ending.from;
          const d = Math.hypot(f.x - sack.x, f.z - sack.z) || 1;
          const gx = sack.x + ((f.x - sack.x) / d) * 0.8, gz = sack.z + ((f.z - sack.z) / d) * 0.8;
          const k = Math.min(1, t / ENDING.walk);
          const e2 = k * k * (3 - 2 * k);
          let x = f.x + (gx - f.x) * e2, z = f.z + (gz - f.z) * e2;
          walking = k < 1 && Math.hypot(gx - f.x, gz - f.z) > 0.2;
          let yaw = Math.atan2(sack.x - x, sack.z - z);
          if (!ending.slung && t >= ENDING.sling) {
            ending.slung = true;
            const obj = markers.sack('yuna');
            if (obj) e.backpack?.(obj, { sling: true });
          }
          if (t >= ENDING.go) {
            const g = Math.min(1.4, (t - ENDING.go) * 1.6);
            const a = Math.atan2(mouth.x - gx, mouth.z - gz);
            x = gx + Math.sin(a) * g;
            z = gz + Math.cos(a) * g;
            yaw = a;
            walking = g < 1.4;
          }
          e.root.position.set(x, 0, z);
          e.root.rotation.y = yaw;
        } else {
          // 다른 요정: 메는 친구를 보다가 골목 쪽으로 돈다
          const cx = elves[ending.carrier]!.root.position;
          e.root.rotation.y = t < ENDING.turn ? Math.atan2(cx.x - ps.x, cx.z - ps.z) : toMouth;
        }
        e.animate(elapsed, walking, { carry: 'none', act: 0, tired: false });
        bars[i]!.group.visible = false;
        swaps[i]!.visible = false;
        rings[i]!.visible = false;
        return;
      }
      const held = sort.items.find((it) => it.carriedBy === p.id);
      const since = elapsed - (actAt.get(p.id) ?? -9);
      e.animate(elapsed, p.moving || runInPlace.has(p.id), {
        carry: p.holding !== null ? (c.lifted ? 'heavy' : 'grip') : held ? 'light' : 'none',
        act: since >= 0 && since < 0.35 ? since / 0.35 : 0,
        tired: needsSwap(sw, p),
        span: held ? gifts.get(held.id)!.span : undefined,
      });
      e.root.updateMatrixWorld(true);
      if (p.holding !== null && c.lifted && e.hands?.(hl, hr)) {
        handY += (hl.y + hr.y) / 2;
        handN++;
      }
      bars[i]!.group.position.set(ps.x, 2.2 * ELF_SCALE, ps.z);
      bars[i]!.group.quaternion.copy(camera.quaternion);
      bars[i]!.set(p.stamina, needsSwap(sw, p), p.holding !== null || p.stamina < 100);
      swaps[i]!.visible = needsSwap(sw, p);
      if (p.holding !== null) {
        const g = gripPos({ ...c, x: cs.x, z: cs.z, yaw: cs.yaw }, p.holding);
        swaps[i]!.position.set(g.x, 1.5 * ELF_SCALE, g.z); // 꼬리 끝이 손잡이 위(요정 어깨 옆)
      }
      const a = run.canPlay ? planAction(sort, p.id) : ({ kind: 'none' } as const);
      if (p.id === ME) mine = a;
      const ring = rings[i]!;
      let at: { x: number; z: number } | null = null;
      if (a.kind === 'pick') at = sort.items.find((q) => q.id === a.itemId)!;
      else if (a.kind === 'sewing' && (a.sub.kind === 'grab' || a.sub.kind === 'handover')) at = gripPos(c, a.sub.handle);
      ring.visible = at !== null;
      if (at) ring.position.set(at.x, 0.03 + i * 0.005, at.z);
      ring.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
    });

    // 재봉틀: 들었으면 두 요정의 손 높이에 손잡이(상자 안 높이 0.38)가 오게
    const lift = c.lifted ? (handN ? Math.min(0.6, Math.max(0.12, handY / handN - 0.38)) : 0.35) : 0;
    crate.position.set(cs.x, lift, cs.z);
    crate.rotation.y = cs.yaw - Math.PI / 2;
    crateTag.visible = !sort.crateSorted;
    crateTag.position.set(cs.x, lift + 1.05, cs.z);

    // 가벼운 선물: 든 요정의 두 손 위에 얹는다. 손·몸통과 한 덩어리로 움직인다(`scene/hold.ts`)
    for (const it of sort.items) {
      const g = gifts.get(it.id)!;
      const idx = it.carriedBy ? sw.players.findIndex((q) => q.id === it.carriedBy) : -1;
      g.tag.visible = !it.sorted;
      if (idx >= 0) {
        const e = elves[idx]!;
        const ps = shown.get(sw.players[idx]!.id)!;
        placeOnHands(g.v, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
        // 이름표: 요정 머리 위
        g.tag.position.set(ps.x, 1.9 * ELF_SCALE, ps.z);
      } else {
        placeOnGround(g.v, it.x, it.z);
        g.tag.position.set(it.x, 0.95, it.z);
      }
      holdTween.apply(it.id, g.v, idx >= 0, elapsed);
      // 자루에 넣은 선물: 손에서 자루로 옮겨 가는 짧은 이음(0.25초)이 끝나면 자루 속으로(숨김)
      const inSack = it.sorted && markerOf(it.dest).sack;
      if (inSack && !sackedAt.has(it.id)) sackedAt.set(it.id, elapsed);
      if (!inSack) sackedAt.delete(it.id);
      g.v.visible = !(inSack && elapsed - sackedAt.get(it.id)! > 0.28);
    }
    for (const d of ['yuna', 'grandma'] as const) markers.fill(d, sort.items.filter((i) => i.sorted && i.dest === d).length);
    // 산타는 썰매 앞쪽을 받치고, 도토는 썰매 날을 살핀다
    santa.animate(elapsed, false, { carry: 'heavy', act: 0, tired: false });
    doto.animate(elapsed, false);
    controls.update(iconOf(mine));
    markers.update(frame);

    // 카메라(연출 가이드 §5): 처음엔 광장 전체 → 두 요정을 함께 담고, 들고 가는 짐의 목적지 쪽을 조금 앞세운다
    establish = Math.max(0, establish - frame);
    let want = { x: ESTABLISH.x, z: ESTABLISH.z, viewH: ESTABLISH.viewH };
    if (establish === 0) {
      want = frameFor(sw.players.filter((p) => p.connected), goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      want = { ...want, x: held.x, z: held.z };
      if (ending) {
        // 끝 장면: 자루를 메는 요정을 가까이(썰매·도토 뒤에 묻히지 않게), 출발하면 골목 쪽으로 조금 물러난다
        const cr = elves[ending.carrier]!.root.position;
        const go = Math.min(1, Math.max(0, (ending.clock - ENDING.go) / 1.2));
        const mouth = PLAZA_DRESSING.alleyMouth;
        want = { x: cr.x + (mouth.x - cr.x) * 0.25 * go, z: cr.z + (mouth.z - cr.z) * 0.25 * go, viewH: 6.5 + 4 * go };
      }
      if (TEST_ZOOM !== 1) {
        // 확대 확인: 1P 몸 가운데(키 절반 높이)를 화면 가운데에
        const p0 = sw.players[0]!;
        const lift = (0.6 * ELF_SCALE) / Math.tan(CAMERA_PITCH) / Math.SQRT2;
        want = { x: p0.x - lift, z: p0.z - lift, viewH: baseViewH(aspect) / TEST_ZOOM };
      }
    }
    // 광장 밖도 눈밭·울타리·골목·먼 마을이 채우므로 가장자리 가까이까지 따라간다
    // 터치 기기: 아래 모서리의 스틱·행동 버튼에 요정이 깔리지 않게 화면을 조금 아래로(요정이 화면에서 위쪽에) 둔다
    const safe = touchDevice ? (0.1 * viewH) / Math.sin(CAMERA_PITCH) / Math.SQRT2 : 0;
    const tx = Math.max(PLAZA_BOUNDS.minX + 2, Math.min(PLAZA_BOUNDS.maxX - 2, want.x + safe));
    const tz = Math.max(PLAZA_BOUNDS.minZ, Math.min(PLAZA_BOUNDS.maxZ - 2, want.z + safe));
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
    // 대상 윤곽: 지금 행동하면 집을 선물·잡을 재봉틀을 그 요정 모자 색으로(1P 먼저)
    for (const g of gifts.values()) g.outline.set(null);
    crateOutline.set(null);
    sw.players.forEach((p, i) => {
      if (!run.canPlay || !p.connected) return;
      const a = planAction(sort, p.id);
      const color = ELF_LOOKS[i]!.hat;
      if (a.kind === 'pick') {
        const o = gifts.get(a.itemId)!.outline;
        if (!o.group.visible) o.set(color);
      } else if (a.kind === 'sewing' && (a.sub.kind === 'grab' || a.sub.kind === 'handover') && !crateOutline.group.visible) crateOutline.set(color);
    });
    snow.update(frame, camTarget.x, camTarget.z, viewH * 1.3);
    // 화면 밖 친구: 화면 가장자리에 모자 색 표시
    marks.update(
      sw.players.map((p, i) => {
        const ps = shown.get(p.id) ?? p;
        const v = new THREE.Vector3(ps.x, 0.7 * ELF_SCALE, ps.z).project(camera);
        return p.connected ? { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight, color: ELF_LOOKS[i]!.hat } : { x: host.clientWidth / 2, y: host.clientHeight / 2, color: '#fff' };
      }),
      host.clientWidth,
      host.clientHeight,
    );
    // 사람 크기 집·울타리가 요정·짐을 가리면 그 물체만 잠시 흐리게
    const pts: THREE.Vector3[] = [];
    for (const p of sw.players) if (p.connected) pts.push(new THREE.Vector3(p.x, 0.5 * ELF_SCALE, p.z), new THREE.Vector3(p.x, 1.05 * ELF_SCALE, p.z));
    pts.push(new THREE.Vector3(c.x, 0.4, c.z));
    fader.update(pts, frame);
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

  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test') || isAdmin()) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      sorting: () => JSON.parse(JSON.stringify(sort)) as SortState,
      /** 시험(여러 기기 이어 붙이기): 방장이 이 장을 바로 마친 것으로(사건을 참가자에게도 보낸다) */
      debugWin: () => {
        const e: SortEvent = { type: 'complete' };
        sort = { ...sort, complete: true };
        onEvent(e);
        net?.emit([e]);
      },
      sortEvents: () => events.map((e) => JSON.parse(JSON.stringify(e))),
      run: () => ({ ...run.state }),
      playLog: () => meter.current(),
      /** 점검(시험만): 장면 직접(무엇이 무거운지 하나씩 숨겨 재기) */
      scene: () => scene,
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => localStorage.getItem('lastgift.cp.v1.dev-ch0'),
      /** 화면 비교 촬영용: 지금 카메라(바라보는 땅 위 점, 화면 높이 m, 각도) */
      /** 비율 확인용: 요정 키(발바닥~정수리, 모자 제외)와 사람 물건 치수 */
      measure: () => {
        const e = elves[0]!.root;
        const hats: THREE.Object3D[] = [];
        e.traverse((o) => o.name === 'elfHat' && hats.push(o));
        hats.forEach((h) => (h.visible = false));
        e.updateMatrixWorld(true);
        const box = new THREE.Box3();
        e.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.visible || o.userData.flat) return;
          let vis = true;
          for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) vis = false;
          if (!vis || (m.material as THREE.Material).transparent) return; // 발밑 원형 그림자 제외
          box.expandByObject(o, true);
        });
        hats.forEach((h) => (h.visible = true));
        const elf = box.max.y - Math.max(0, box.min.y);
        return { elf, feet: box.min.y, crown: box.max.y, ...TOWN, ratios: { benchSeat: TOWN.benchSeat / elf, door: TOWN.doorOpening / elf, knob: TOWN.doorKnob / elf, lamp: TOWN.lampLight / elf } };
      },
      /** 비율 확인용: 트리 남동쪽에 벤치·가로등을 같은 바닥 높이로 나란히 세운다(시험 모드만) */
      lineup: () => {
        const b = townBench(models);
        b.position.set(5, 0, 9);
        scene.add(b);
        const l = townLamp();
        l.position.set(5, 0, 5);
        scene.add(l);
      },
      faded: () => fader.faded(),
      /** 들기 자세 확인용: 요정마다 손목 높이·턱(머리 뼈) 높이·든 선물의 위아래·앞 거리(요정 기준) */
      holdInfo: () =>
        elves.map((e, i) => {
          const id = sort.sewing.players[i]!.id;
          const ps = shown.get(id)!;
          const l = new THREE.Vector3(), r = new THREE.Vector3();
          const ok = e.hands?.(l, r) ?? false;
          let chin: number | null = null;
          e.root.traverse((o) => {
            if (o.name === 'Head' && chin === null) chin = o.getWorldPosition(new THREE.Vector3()).y;
          });
          const it = sort.items.find((q) => q.carriedBy === id);
          const gv = it ? gifts.get(it.id)! : null;
          const fx = Math.sin(ps.yaw), fz = Math.cos(ps.yaw);
          const fwd = (x: number, z: number) => (x - ps.x) * fx + (z - ps.z) * fz;
          return {
            id,
            hands: ok ? { y: (l.y + r.y) / 2, fwd: fwd((l.x + r.x) / 2, (l.z + r.z) / 2), apart: l.distanceTo(r), l: l.toArray(), r: r.toArray() } : null,
            chin,
            gift:
              gv && it
                ? (() => {
                    const b = new THREE.Box3();
                    gv.v.updateMatrixWorld(true);
                    gv.v.traverse((o) => {
                      if ((o as THREE.Mesh).isMesh && o.parent?.name !== 'outline') b.expandByObject(o);
                    });
                    const mid = ok ? l.clone().add(r).multiplyScalar(0.5) : null;
                    return {
                      id: it.id,
                      across: gv.span * ELF_SCALE,
                      bottom: b.min.y,
                      top: b.max.y,
                      ahead: fwd((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2),
                      /** 선물 원점(바닥 가운데)이 두 손목 가운데에서 떨어진 거리 */
                      fromHands: mid ? gv.v.position.distanceTo(mid) : null,
                      origin: { x: gv.v.position.x, y: gv.v.position.y, z: gv.v.position.z },
                    };
                  })()
                : null,
          };
        }),
      /** 프롤로그 상태(시험): 시각·장면·끝남 */
      prologue: () => (prologue ? { t: prologue.t, beat: beatAt(prologue.t), done: prologue.done } : null),
      skipPrologue: () => prologue?.skip(),
      /** 인물 위치·보임(시험·화면 확인) */
      actors: () =>
        Object.fromEntries(
          ([['santa', santa.root], ['doto', doto.root], ['kongi', kongi.root]] as const).map(([n, o]) => {
            const p = o.getWorldPosition(new THREE.Vector3());
            const b = new THREE.Box3().setFromObject(o);
            return [n, { visible: o.visible, x: p.x, y: p.y, z: p.z, top: b.max.y, bottom: b.min.y }];
          }),
        ),
      /** 저장된 단체사진 구도(5장 재현용) */
      photo: () => run.state.photo,
      /** 화면 확인용(시험 모드만): 제자리에서 걷는 동작(카메라가 움직이지 않아 같은 자리에서 여러 장 찍을 수 있다) */
      debugRunInPlace: (id: string, on: boolean) => (on ? runInPlace.add(id) : runInPlace.delete(id)),
      /** 화면 확인용(시험 모드만): 요정 체력을 정한다 */
      debugStamina: (id: string, v: number) => {
        sort = { ...sort, sewing: { ...sort.sewing, players: sort.sewing.players.map((p) => (p.id === id ? { ...p, stamina: v } : p)) } };
      },
      camera: () => ({ target: { x: camTarget.x, z: camTarget.z }, viewH, aspect, yawDeg: (CAMERA_YAW * 180) / Math.PI, pitchDeg: (CAMERA_PITCH * 180) / Math.PI }),
      /** 화면 비교 촬영용(시험 모드에서만): 요정을 그 자리에 세우고 카메라를 바로 맞춘다 */
      debugPlace: (id: string, x: number, z: number, facing = 0) => {
        sort = { ...sort, sewing: { ...sort.sewing, players: sort.sewing.players.map((p) => (p.id === id ? { ...p, x, z, facing } : p)) } };
        snapCamera = true;
        establish = 0;
      },
      toScreen: (x: number, z: number, y = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
    };
  }
}
