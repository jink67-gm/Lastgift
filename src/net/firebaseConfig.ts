// Lastgift 전용 Firebase 프로젝트의 웹 설정값.
// 값은 저장소에 넣지 않고 .env.local(Git에서 제외)에서 읽는다. 양식은 .env.example.
// 주의: 이 값은 빌드된 게임 파일에 들어가 브라우저에서 보이는 공개 정보다. 도용 방지는
//   ① 보안 규칙(database.rules.json) ② API 키 사용처 제한(Google Cloud 콘솔) ③ 무료 요금제 가 맡는다(README).
// 이 게임은 Realtime Database의 `lastgiftRooms/` 경로만 쓴다(시그널링 = 처음 소개만).
// 값이 비어 있으면 여러 기기 연결은 "설정 필요"로 멈추고, 한 기기에서 둘이 하기는 그대로 된다.
// 주소에 &emu를 붙이면 내 컴퓨터의 Firebase 에뮬레이터(auth 9099, database 9000)에 붙는다.

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId && firebaseConfig.appId);
}

/** 에뮬레이터용(실제 프로젝트와 섞이지 않게 demo- 프로젝트) */
export const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-lastgift.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000?ns=demo-lastgift-default-rtdb',
  projectId: 'demo-lastgift',
  appId: 'demo-app',
};

export const EMULATOR = { authUrl: 'http://127.0.0.1:9099', dbHost: '127.0.0.1', dbPort: 9000 };
