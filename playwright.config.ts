import { defineConfig, devices } from '@playwright/test';

// 빌드 결과(dist)를 vite preview로 열고 실제 Chromium에 입력을 보낸다.
//   chromium : 한 기기 시험(npm run test:e2e)
//   net      : 두~세 기기 시험. Firebase 에뮬레이터가 필요하다(npm run test:net)
const swiftshader = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      testDir: 'tests/e2e',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { args: swiftshader } },
    },
    {
      // 저사양 측정(npm run test:perf). 시험이 아니라 측정이라 기본 묶음에 넣지 않는다
      name: 'perf',
      testDir: 'tests/perf',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, launchOptions: { args: swiftshader } },
    },
    {
      // 장면 점검용 촬영(docs/screens/review/). 시험이 아니라 사람이 보는 화면 모음
      name: 'review',
      testDir: 'tests/review',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { args: swiftshader } },
    },
    {
      name: 'net',
      testDir: 'tests/e2e-net',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // 같은 컴퓨터 안의 브라우저끼리 WebRTC 직접 연결(내부 주소를 숨기지 않게)
        launchOptions: { args: [...swiftshader, '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
