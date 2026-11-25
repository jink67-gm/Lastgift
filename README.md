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

## 환경

Node.js 22 이상 · Vite 8.3.8 · TypeScript 7.0.2 · Three.js 0.187.0 · Vitest 5.1.1

## 폴더

```
src/core/      게임 규칙 (three.js를 쓰지 않는 순수 TS)
src/main.ts    화면 시작점
tests/unit/    규칙 테스트
```
