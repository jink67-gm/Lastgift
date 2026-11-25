// Firebase 웹 설정값(비밀번호가 아니라 웹에 공개되는 정보). 〈수학 대륙〉과 같은 프로젝트를 쓰고,
// 이 게임은 Realtime Database의 `lastgiftRooms/` 경로만 쓴다(시그널링 = 처음 소개만).
// 방 정보 보호는 database.rules.json의 보안 규칙이 맡는다.
// 주소에 ?emu를 붙이면 내 컴퓨터의 Firebase 에뮬레이터(auth 9099, database 9000)에 붙는다.

export const firebaseConfig = {
  apiKey: 'AIzaSyDTpPAsTDtixREVzB65N0vtGj0Ky6G98Xs',
  authDomain: 'math-continent.firebaseapp.com',
  databaseURL: 'https://math-continent-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'math-continent',
  appId: '1:71439535639:web:015a4be34945f74fce1652',
};

/** 에뮬레이터용(실제 프로젝트와 섞이지 않게 demo- 프로젝트) */
export const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-lastgift.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000?ns=demo-lastgift-default-rtdb',
  projectId: 'demo-lastgift',
  appId: 'demo-app',
};

export const EMULATOR = { authUrl: 'http://127.0.0.1:9099', dbHost: '127.0.0.1', dbPort: 9000 };
