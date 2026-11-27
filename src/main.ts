// 시작점: 주소로 장면을 고른다.
//   (기본)      이야기 모드: 0장 프롤로그부터 6장 끝까지 한 번에(저장 칸 "story"에서 지금 장을 연다, game/story.ts)
//   ?play&test  이야기 모드 시험 · ?test(chapter 없이) 광장 시험 장면(요정 1명)
//   ?chapter=0  0장 선물 분류(한 기기 2인)
//   ?chapter=1  1장 우편함 골목 → 유나네 앞마당 찾기(한 기기 2인)
//   ?chapter=2  2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 (로컬 2인: 1P WASD+E, 2P 방향키+Enter)
//   ?chapter=3  3장 공방 옆문 → 울타리 샛길 → 민재네 마당: 공 던져 받기와 콩이(한 기기 2인)
//   ?chapter=5  5장 광장: 단체사진·빈 양말·가방 열기 → 스노글로브 → 6장 건네기(?chapter=6은 6장부터)
//   ?chapter=4  4장 담장길 → 할머니네 정원: 전선·발전기·스위치 둘(한 기기 2인). &solo = 1인 연습(저장 따로)
//   ?host       여러 기기 이야기 모드: 방 만들기(이 기기가 방장). ?chapter=N&host는 그 장만(개발용, 2장 제외)
//   ?join=CODE  여러 기기: 초대 링크로 참가(방장이 연 장을 따라간다)
//   &emu        Firebase 에뮬레이터(개발·자동 시험)
import { Models } from './scene/models';
import { browserStorage, CheckpointStore } from './save/store';

const q = new URLSearchParams(location.search);
const chapter = q.get('chapter');
/** 이야기 모드: ?chapter가 없고, 광장 시험 장면(?test만)이 아니다 */
const storyMode = chapter === null && (!q.has('test') || q.has('play'));
/** 여러 기기(2장 개발 주소는 따로: game/chapter2Net) */
const teamMode = (q.has('host') || q.has('join')) && chapter !== '2';

// 모델을 먼저 불러온다. 실패한 모델은 기본 도형으로 대신하고 게임은 그대로 시작한다.
const loading = document.createElement('div');
loading.id = 'loading';
loading.setAttribute('role', 'status');
loading.textContent = '불러오는 중…';
loading.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:700 22px system-ui,sans-serif;z-index:50';
document.body.appendChild(loading);

type Opts = import('./game/story').StoryOptions;
async function startPage(models: Models, page: number, opts?: Opts): Promise<void> {
  if (page === 0) (await import('./game/chapter0')).startChapter0(models, opts);
  else if (page === 1) (await import('./game/chapter1')).startChapter1(models, opts);
  else if (page === 2) (await import('./game/chapter2')).startChapter2(models, opts);
  else if (page === 3) (await import('./game/chapter3')).startChapter3(models, opts);
  else if (page === 4) (await import('./game/chapter4')).startChapter4(models, opts);
  else (await import('./game/finale')).startFinale(models, page === 6 ? 6 : 5, opts);
}

void Models.load().then(async (models) => {
  if (models.failed.length) console.warn('모델을 불러오지 못해 기본 도형으로 대신합니다:', models.failed.join(', '));
  (window as unknown as Record<string, unknown>).__lastgiftModels = { failed: [...models.failed] };
  if (teamMode) {
    loading.remove();
    const { hostTeam, joinTeam } = await import('./net/team');
    const { normalizeRoomCode } = await import('./net/signaling');
    const emu = q.has('emu');
    const keep = ['emu', 'test', 'noshadow'].filter((k) => q.has(k)).map((k) => `&${k}`).join('');
    const start = q.has('host')
      ? await hostTeam({ emu, mode: chapter === null ? 'story' : `ch${chapter}`, inviteSearch: (code) => `?join=${code}${keep}` })
      : await joinTeam(normalizeRoomCode(q.get('join') ?? ''), emu);
    if (!start) return;
    const story = chapter === null;
    const page = start.page ?? (story ? (new CheckpointStore(browserStorage()).load(start.net.roomId)?.chapterId ?? 0) : Number(chapter));
    await startPage(models, page, { story, roomId: start.net.roomId, net: start.net });
    return;
  }
  if (chapter === '0') (await import('./game/chapter0')).startChapter0(models);
  else if (chapter === '1') (await import('./game/chapter1')).startChapter1(models);
  else if (chapter === '2') (await import('./game/chapter2')).startChapter2(models);
  else if (chapter === '3') (await import('./game/chapter3')).startChapter3(models);
  else if (chapter === '4') (await import('./game/chapter4')).startChapter4(models);
  else if (chapter === '5' || chapter === '6') (await import('./game/finale')).startFinale(models, chapter === '5' ? 5 : 6);
  else if (storyMode) {
    const { STORY_ROOM } = await import('./game/story');
    const opts = { story: true, roomId: STORY_ROOM };
    const at = new CheckpointStore(browserStorage()).load(STORY_ROOM)?.chapterId ?? 0;
    await startPage(models, at, opts);
  } else (await import('./game/plaza')).startPlaza(models);
  loading.remove();
});
