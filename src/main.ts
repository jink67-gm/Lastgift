// 시작점: 주소로 장면을 고른다.
//   (기본)      0장 광장 시험 장면
//   ?chapter=2  2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 (로컬 2인: 1P WASD+E, 2P 방향키+Enter)
const chapter = new URLSearchParams(location.search).get('chapter');

if (chapter === '2') {
  void import('./game/chapter2').then((m) => m.startChapter2());
} else {
  void import('./game/plaza').then((m) => m.startPlaza());
}
