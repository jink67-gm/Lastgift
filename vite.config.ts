import { defineConfig } from 'vitest/config';

// GitHub Pages는 저장소 이름 아래 하위 경로(/lastgift/)에서 열린다.
// 상대 경로('./')로 빌드하면 저장소 이름이나 대소문자와 상관없이 같은 dist가 동작한다.
// 모델·음원은 코드에서 import.meta.env.BASE_URL을 앞에 붙여 불러온다.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
