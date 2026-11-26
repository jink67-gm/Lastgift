// 시작점: 주소로 장면을 고른다.
//   (기본)      광장 시험 장면(요정 1명)
//   ?chapter=0  0장 선물 분류(한 기기 2인)
//   ?chapter=1  1장 우편함 골목 → 유나네 앞마당 찾기(한 기기 2인)
//   ?chapter=2  2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 (로컬 2인: 1P WASD+E, 2P 방향키+Enter)
//   ?chapter=3  3장 공방 옆문 → 울타리 샛길 → 민재네 마당: 공 던져 받기와 콩이(한 기기 2인)
//   ?chapter=4  4장 담장길 → 할머니네 정원: 전선·발전기·스위치 둘(한 기기 2인). &solo = 1인 연습(저장 따로)
import { Models } from './scene/models';

const chapter = new URLSearchParams(location.search).get('chapter');

// 모델을 먼저 불러온다. 실패한 모델은 기본 도형으로 대신하고 게임은 그대로 시작한다.
const loading = document.createElement('div');
loading.id = 'loading';
loading.setAttribute('role', 'status');
loading.textContent = '불러오는 중…';
loading.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:700 22px system-ui,sans-serif;z-index:50';
document.body.appendChild(loading);

void Models.load().then(async (models) => {
  if (models.failed.length) console.warn('모델을 불러오지 못해 기본 도형으로 대신합니다:', models.failed.join(', '));
  (window as unknown as Record<string, unknown>).__lastgiftModels = { failed: [...models.failed] };
  if (chapter === '0') (await import('./game/chapter0')).startChapter0(models);
  else if (chapter === '1') (await import('./game/chapter1')).startChapter1(models);
  else if (chapter === '2') (await import('./game/chapter2')).startChapter2(models);
  else if (chapter === '3') (await import('./game/chapter3')).startChapter3(models);
  else if (chapter === '4') (await import('./game/chapter4')).startChapter4(models);
  else (await import('./game/plaza')).startPlaza(models);
  loading.remove();
});
