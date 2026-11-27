import { defineConfig, devices } from '@playwright/test';

// 배포된 GitHub Pages 주소를 실제로 연다(로컬 서버 없음). 실행: npm run test:deploy
// 실제 Firebase(시그널링)를 쓰므로 방이 하나 만들어진다(3시간 뒤 만료).
const swiftshader = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
export default defineConfig({
  testDir: 'tests/deploy',
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: process.env.LASTGIFT_URL ?? 'https://jink67-gm.github.io/Lastgift/',
    trace: 'off',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: [...swiftshader, '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] },
  },
});
