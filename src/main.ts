// 시작점: 주소로 장면을 고른다.
//   (기본)      0장 광장 시험 장면
//   ?chapter=2  2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 (로컬 2인: 1P WASD+E, 2P 방향키+Enter)
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
  if (chapter === '2') (await import('./game/chapter2')).startChapter2(models);
  else (await import('./game/plaza')).startPlaza(models);
  loading.remove();
});
