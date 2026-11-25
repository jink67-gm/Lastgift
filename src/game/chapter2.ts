// 2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 → 작업대 (명세서 §3.2, §5).
//   ?chapter=2            고르기 화면(한 기기에서 둘이 / 방 만들기 / 참가하기)
//   ?chapter=2&local      한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter)
//   ?chapter=2&host       방 만들기(이 기기가 방장)
//   ?chapter=2&join=CODE  초대 링크로 참가
//   &emu                  Firebase 에뮬레이터 사용(개발·자동 시험)
import { createSewing, step, type SewingEvent, type SewingInput, type SewingState } from '../core/sewing';
import { chapter } from '../data/chapters';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import type { Intent } from '../input/intent';
import { mergeIntents } from '../input/merge';
import { normalizeRoomCode } from '../net/signaling';
import { browserStorage, CheckpointStore } from '../save/store';
import { LocalRun } from '../session/localRun';
import { sewingIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createLobby } from '../ui/lobby';
import { createChapter2Screen } from './chapter2Screen';
import type { Models } from '../scene/models';

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
  return { move: i.move, actionDown: i.action.down, actionHeld: i.action.held };
}

export function startChapter2(models: Models): void {
  const q = new URLSearchParams(location.search);
  const emu = q.has('emu');
  if (q.has('local')) return startLocal(models);
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

/** 한 기기에서 둘이(로컬 2인) */
function startLocal(models: Models): void {
  const host = document.getElementById('game')!;
  const screen = createChapter2Screen(host, models);
  let sewing: SewingState = createSewing(LOCAL_PLAYERS);
  const events: SewingEvent[] = [];

  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);

  // 방이 따로라 0장 기록과 섞이지 않는다
  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'dev-ch2', 'p0', chapter2Checkpoint('dev-ch2'));
  run.attachVisibility(document);
  // 0초 → 재시도: 이 장의 임시 진행(상자 위치·문·공간)을 처음으로
  run.onEffect((e) => {
    if (e.type === 'retry') sewing = createSewing(LOCAL_PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });

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
    const live = run.canPlay && !sewing.delivered;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    const i2 = k2.sample();
    let inputs: Record<string, SewingInput> = live ? { p0: toSewingInput(i1), p1: toSewingInput(i2) } : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(sewing, inputs, SIM_DT);
      sewing = r.state;
      for (const e of r.events) {
        events.push(e);
        // 작업대에 바르게 내려놓으면 2장 완료(기억 2). 문·공간 이동은 체크포인트를 건드리지 않는다.
        if (e.type === 'delivered') run.dispatch({ type: 'completeChapter', at: now, chapterId: 2 });
      }
      // 행동은 첫 틱에서만 쓴다(같은 입력을 두 번 쓰지 않는다)
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    const mine = screen.draw(sewing, { frame, elapsed, previewFor: LOCAL_PLAYERS, canPlay: run.canPlay });
    controls.update(sewingIcon(mine.kind));
  });

  // 자동 검사용 창구(?test)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      sewing: () => JSON.parse(JSON.stringify(sewing)) as SewingState,
      sewingEvents: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => localStorage.getItem('lastgift.cp.v1.dev-ch2'),
      toScreen: (x: number, z: number) => screen.toScreen(x, z),
    };
  }
}
