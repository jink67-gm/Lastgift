# 자정의 마지막 선물

초등학교 3~6학년용 2~4인 협동 3D 브라우저 게임. 기획 기준은 `LAST_GIFT_SPEC.md` 버전 2.1.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm install` | 의존성 설치 (버전은 `package-lock.json`에 고정) |
| `npm run dev` | 개발 서버 |
| `npm test` | 게임 규칙 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | 타입 검사 후 `dist/` 생성 (GitHub Pages 배포용) |
| `npm run preview` | 빌드 결과를 로컬에서 열기 |
| `npm run test:e2e` | 빌드 후 실제 Chromium에서 키보드·두 손가락 터치 테스트 (Playwright) |

## 지금 할 수 있는 것

- 눈 광장에서 요정 1명을 WASD 또는 방향키로 움직인다. 위·아래·좌·우는 화면 기준이다.
- 한글 입력 상태에서도 동작한다(물리 키 위치 `event.code`로 판정).
- 썰매·산타·트리·집·벤치·가로등에 막히고 벽을 따라 미끄러진다. 광장 밖으로 나가지 않는다.
- 태블릿: 화면 왼쪽 아무 곳에 손가락을 대고 끌면 스틱, 오른쪽 아래 둥근 버튼이 행동. 두 손가락을 동시에 쓸 수 있다.
- E 키 또는 행동 버튼으로 가까운 선물(노란 고리 표시)을 들고, 다시 누르면 앞에 내려놓는다.
  무거운 재봉틀 상자는 혼자 들 수 없다(두 손 그림이 뜬다).
- 지금 누르면 일어날 일은 글 대신 그림으로 보여 준다(키보드: 화면 위 [E]+그림, 터치: 행동 버튼 안 그림).
- 주소 끝에 `?test`를 붙이면 자동 검사용 창구(`window.__lastgift`)가 열린다.

## 환경

Node.js 22 이상 · Vite 8.3.8 · TypeScript 7.0.2 · Three.js 0.187.0 · Vitest 5.1.1

## 폴더

```
src/core/      게임 규칙 (three.js를 쓰지 않는 순수 TS): 화면→바닥 방향, 충돌, 이동, 들기·놓기
src/input/     키보드·터치 → Intent(입력 장치와 무관한 의도), 둘을 합치는 merge
src/data/      광장 배치, 선물 5개, 요정 모자 4종
src/ui/        터치 스틱·행동 버튼, 행동 그림(SVG)
src/scene/     three.js 모델(직접 제작 기본 도형)
src/main.ts    화면 시작점, 고정 틱(60Hz) 루프
tests/unit/    규칙 테스트 (Vitest)
tests/e2e/     실제 브라우저 테스트 (Playwright)
```
