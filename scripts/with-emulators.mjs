// Firebase 에뮬레이터(인증 9099, 데이터베이스 9000)를 켜고 보안 규칙을 올린 뒤 명령을 실행한다.
//   node scripts/with-emulators.mjs <명령...>
// firebase emulators:exec 대신 쓰는 이유: 프록시가 있는 환경에서도 규칙 업로드가 로컬로만 가게 하려고.
// 필요: Java(데이터베이스 에뮬레이터), firebase-tools(devDependency).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'demo-lastgift';
const NS = `${PROJECT}-default-rtdb`;
const cmd = process.argv.slice(2);
if (!cmd.length) {
  console.error('usage: node scripts/with-emulators.mjs <command...>');
  process.exit(2);
}

function emulatorJar() {
  const dir = join(homedir(), '.cache', 'firebase', 'emulators');
  const find = () => (existsSync(dir) ? readdirSync(dir).filter((f) => /^firebase-database-emulator-.*\.jar$/.test(f)).sort().pop() : undefined);
  let jar = find();
  if (!jar) {
    spawnSync('npx', ['firebase', 'setup:emulators:database'], { stdio: 'inherit' });
    jar = find();
  }
  if (!jar) throw new Error('database emulator jar not found');
  return join(dir, jar);
}

function http(method, port, path, body) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { Authorization: 'Bearer owner' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitFor(port, path) {
  for (let i = 0; i < 120; i++) {
    try {
      await http('GET', port, path);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`emulator on ${port} did not start`);
}

const children = [];
// 각 에뮬레이터를 자기 프로세스 그룹으로 띄워, 끝낼 때 그 아래 프로세스까지 함께 끈다
const stopAll = () =>
  children.forEach((c) => {
    try {
      process.kill(-c.pid, 'SIGTERM');
    } catch {
      /* 이미 꺼짐 */
    }
  });
process.on('exit', stopAll);
process.on('SIGINT', () => process.exit(130));

const db = spawn('java', ['-jar', emulatorJar(), '--host', '127.0.0.1', '--port', '9000'], { stdio: 'ignore', detached: true });
children.push(db);
const firebaseBin = new URL('../node_modules/.bin/firebase', import.meta.url).pathname;
const auth = spawn(firebaseBin, ['emulators:start', '--only', 'auth', '--project', PROJECT], { stdio: 'ignore', detached: true });
children.push(auth);

await waitFor(9000, `/.json?ns=${NS}`);
await waitFor(9099, '/');
const rules = readFileSync(new URL('../database.rules.json', import.meta.url));
const put = await http('PUT', 9000, `/.settings/rules.json?ns=${NS}`, rules);
if (put.status !== 200) {
  console.error('failed to load rules:', put.status, put.data);
  process.exit(1);
}
console.log('emulators ready (auth 9099, database 9000), rules loaded');

const run = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: true });
run.on('exit', (code) => {
  stopAll();
  process.exit(code ?? 1);
});
