// Lastgift 전용 Firebase 프로젝트의 웹 설정값(비밀번호가 아니라 웹에 공개되는 정보).
// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"의 firebaseConfig 값을 넣는다.
// 이 게임은 Realtime Database의 `lastgiftRooms/` 경로만 쓴다(시그널링 = 처음 소개만).
// 방 정보 보호는 database.rules.json의 보안 규칙이 맡는다.
// 값이 비어 있으면 여러 기기 연결은 "설정 필요"로 멈추고, 한 기기에서 둘이 하기는 그대로 된다.
// 주소에 &emu를 붙이면 내 컴퓨터의 Firebase 에뮬레이터(auth 9099, database 9000)에 붙는다.

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
  appId: '',
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
