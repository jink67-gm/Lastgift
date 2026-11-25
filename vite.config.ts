import { defineConfig } from 'vitest/config';

// LASTGIFT_NET=1 이면 Firebase 에뮬레이터가 필요한 시험(tests/net)만 돌린다(npm run test:net).
const NET = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.LASTGIFT_NET;

// GitHub Pages는 저장소 이름 아래 하위 경로(/lastgift/)에서 열린다.
// 상대 경로('./')로 빌드하면 저장소 이름이나 대소문자와 상관없이 같은 dist가 동작한다.
// 모델·음원은 코드에서 import.meta.env.BASE_URL을 앞에 붙여 불러온다.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // three.js 본체만 약 530 kB(gzip 약 130 kB)라 기본 경고 기준(500 kB)을 넘는다.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: NET ? ['tests/net/**/*.test.ts'] : ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
