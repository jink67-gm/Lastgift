// 2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 → 작업대 (명세서 §3.2, §5).
//   ?chapter=2            고르기 화면(한 기기에서 둘이 / 방 만들기 / 참가하기)
//   ?chapter=2&local      한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter)
//   ?chapter=2&host       방 만들기(이 기기가 방장)
//   ?chapter=2&join=CODE  초대 링크로 참가
//   &emu                  Firebase 에뮬레이터 사용(개발·자동 시험)
import { createSewing, step, type SewingEvent, type SewingInput, type SewingState } from '../core/sewing';
import { isAdmin } from '../ui/admin';
import { chapter } from '../data/chapters';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import type { Intent } from '../input/intent';
import { mergeIntents } from '../input/merge';
import { normalizeRoomCode } from '../net/signaling';
import { browserStorage, CheckpointStore } from '../save/store';
import { LocalRun } from '../session/localRun';
import type { TeamRun } from '../session/mirrorRun';
import { playerBack, playerGone } from '../core/presence';
import { IDLE_INTENT } from '../input/intent';
import { sewingIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createLobby } from '../ui/lobby';
import { createChapter2Screen } from './chapter2Screen';
import type { Models } from '../scene/models';
import { storyFor, type StoryOptions } from './story';
import { createClipView, type ClipView } from '../ui/memories';
import { createPlayMeter } from '../session/playMeter';
import { sfxEvent } from '../audio/sfx';
import { AutoQuality, effectiveQuality, type Quality } from '../core/quality';
import { loadSettings, saveSettings } from '../save/store';
import { createSettingsUi } from '../ui/settings';

const SIM_DT = 1 / 60;
const LOCAL_PLAYERS = ['p0', 'p1'] as const;

/** 2장 최초 체크포인트(개발용 장 바로 열기) */
export function chapter2Checkpoint(roomId: string) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId: 2 as const,
    savedRemainingMs: chapter(2).floorMs,
    completedChapters: [0, 1] as (0 | 1)[],
    memories: [1] as 1[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

export function toSewingInput(i: Intent): SewingInput {
  return { move: i.move, actionDown: i.action.down, actionHeld: i.action.held, crouch: !!i.crouch };
}

export function startChapter2(models: Models, opts?: StoryOptions): void {
  const q = new URLSearchParams(location.search);
  const emu = q.has('emu');
  // 이야기 모드(한 기기)·?chapter=2&local
  if (opts?.story || opts?.net || q.has('local')) return startLocal(models, opts);
  if (q.has('host')) {
    void import('./chapter2Net').then((m) => m.startHost(emu, models));
    return;
  }
  const join = q.get('join');
  if (join) {
    void import('./chapter2Net').then((m) => m.startGuest(normalizeRoomCode(join), emu, models));
    return;
  }
  // 고르기 화면
  const lobby = createLobby(document);
  const go = (extra: string) => {
    const u = new URL(location.href);
    u.search = `?chapter=2${extra}${emu ? '&emu' : ''}${q.has('test') ? '&test' : ''}`;
    location.href = u.toString();
  };
  lobby.showChooser({
    onLocal: () => go('&local'),
    onHost: () => go('&host'),
    onJoin: (code) => go(`&join=${normalizeRoomCode(code)}`),
  });
}

/** 한 기기에서 둘이(로컬 2인) · 이야기 모드 여러 기기(opts.net: 방장 판정, 참가자는 그리기만) */
function startLocal(models: Models, opts?: StoryOptions): void {
  const sto = storyFor(opts, 'dev-ch2');
  const net = opts?.net;
  const guest = net?.role === 'guest';
  const PLAYERS: readonly string[] = net ? net.slots : LOCAL_PLAYERS;
  const host = document.getElementById('game')!;
  const screen = createChapter2Screen(host, models);
  let sewing: SewingState = createSewing(PLAYERS);
  const events: SewingEvent[] = [];

  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);

  // 방이 따로라 0장 기록과 섞이지 않는다
  const makeRun = () => new LocalRun(new CheckpointStore(browserStorage()), hud, sto.roomId, 'p0', sto.story ? undefined : chapter2Checkpoint(sto.roomId));
  const run: TeamRun = net ? net.bindRun(hud, makeRun) : makeRun();
  run.attachVisibility(document);
  // 0초 → 재시도: 이 장의 임시 진행(상자 위치·문·공간)을 처음으로
  run.onEffect((e) => {
    if (e.type === 'retry') sewing = createSewing(PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });
  // 여러 기기: 끊긴 요정은 손잡이를 놓는다 / 참가자는 방장 사건으로 끝 장면을 시작한다
  net?.onPresence((id, on) => (sewing = on ? playerBack(sewing, id) : playerGone(sewing, id)));
  // 그래픽 품질(자동·낮음·보통: 2장은 해상도만) · FPS 표시 · 플레이 기록
  const kv = browserStorage();
  const settings = createSettingsUi(document, loadSettings(kv));
  const auto = new AutoQuality();
  const forcedLow = new URLSearchParams(location.search).get('quality') === 'low';
  let quality: Quality = forcedLow ? 'low' : effectiveQuality(settings.value.quality, null);
  const applyQuality = () => {
    quality = forcedLow ? 'low' : effectiveQuality(settings.value.quality, auto.result);
    screen.setLow(quality === 'low');
  };
  settings.onChange((v) => {
    saveSettings(kv, v);
    applyQuality();
  });
  applyQuality();
  const meter = createPlayMeter({ chapterId: 2, run, players: PLAYERS.length, role: net?.role ?? 'local', quality: () => quality, showFps: (f, q) => settings.setFps(f, q) });
  net?.onEvents((evs) => {
    for (const e of evs as SewingEvent[]) onEvent(e);
  });

  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let deliveredAt = -1;
  let clip: ClipView | null = null;
  let clipDone = false;
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    const frame = Math.min(raw, 0.25);
    last = now;
    meter.frame(raw);
    if (auto.feed(raw)) applyQuality();
    acc += frame;
    run.frame(now);
    const live = run.canPlay && !sewing.delivered;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    if (guest) {
      // 참가자: 입력만 보내고 방장 상태를 그린다
      net!.sendIntent(live ? i1 : IDLE_INTENT);
      sewing = net!.remote<SewingState>() ?? sewing;
      // 사건을 놓쳤어도(잠깐 끊김) 방장 상태로 끝 장면을 시작한다
      if (sewing.delivered && deliveredAt < 0) onEvent({ type: 'delivered' } as SewingEvent);
      elapsed += frame;
      acc = 0;
    }
    let inputs: Record<string, SewingInput> = net
      ? net.inputs(i1, live)
      : live
        ? { p0: toSewingInput(i1), p1: toSewingInput(k2.sample()) }
        : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(sewing, inputs, SIM_DT);
      sewing = r.state;
      for (const e of r.events) onEvent(e);
      net?.emit(r.events);
      // 행동은 첫 틱에서만 쓴다(같은 입력을 두 번 쓰지 않는다)
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    if (!guest) net?.publish(2, sewing);
    // 끝: 재봉틀을 내려놓고 잠깐 뒤 → 빨간 코트 장면(영상 또는 손그림) → 이야기 모드면 3장으로
    if (deliveredAt >= 0 && !clip && !clipDone && elapsed - deliveredAt > 1.8) clip = createClipView(document, { file: 'ch2-red-coat.mp4', base: import.meta.env.BASE_URL, duration: 7 });
    if (clip && clip.update(frame)) {
      clip.dispose();
      clip = null;
      clipDone = true;
      sto.next();
    }
    const mine = screen.draw(sewing, { frame, elapsed, previewFor: net ? [net.me] : LOCAL_PLAYERS, canPlay: run.canPlay, smooth: guest });
    controls.update(sewingIcon(mine.kind));
  });

  function onEvent(e: SewingEvent): void {
    sfxEvent(e);
    events.push(e);
    // 작업대에 바르게 내려놓으면 2장 완료(기억 2). 문·공간 이동은 체크포인트를 건드리지 않는다.
    if (e.type === 'delivered' && deliveredAt < 0) {
      run.dispatch({ type: 'completeChapter', at: performance.now(), chapterId: 2 });
      deliveredAt = elapsed;
    }
  }

  // 자동 검사용 창구(?test)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test') || isAdmin()) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      sewing: () => JSON.parse(JSON.stringify(sewing)) as SewingState,
      sewingEvents: () => events.map((e) => ({ ...e })),
      clip: () => (clip ? { t: clip.t, mode: clip.mode() } : clipDone ? 'done' : null),
      skipClip: () => clip?.skip(),
      /** 시험(여러 기기 이어 붙이기): 방장이 이 장을 바로 마친 것으로(사건을 참가자에게도 보낸다) */
      debugWin: () => {
        const e = { type: 'delivered' } as SewingEvent;
        sewing = { ...sewing, delivered: true };
        onEvent(e);
        net?.emit([e]);
      },
      run: () => ({ ...run.state }),
      playLog: () => meter.current(),
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => localStorage.getItem('lastgift.cp.v1.dev-ch2'),
      toScreen: (x: number, z: number) => screen.toScreen(x, z),
    };
  }
}
