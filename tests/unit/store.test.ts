import { describe, expect, it } from 'vitest';
import { createRun, toCheckpoint } from '../../src/core/run';
import { CheckpointStore, checkpointKey, DEFAULT_SETTINGS, loadSettings, saveSettings, type KeyValue } from '../../src/save/store';

class MemoryKV implements KeyValue {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('CheckpointStore', () => {
  it('저장한 체크포인트를 같은 방에서 그대로 읽는다', () => {
    const kv = new MemoryKV();
    const store = new CheckpointStore(kv);
    const cp = toCheckpoint(createRun('run-1', 'room-A', 3));
    expect(store.save(cp)).toEqual({ ok: true });
    expect(store.load('room-A')).toEqual(cp);
  });

  it('방마다 따로 저장해 섞이지 않는다', () => {
    const kv = new MemoryKV();
    const store = new CheckpointStore(kv);
    store.save({ ...toCheckpoint(createRun('run-1', 'room-A', 1)), chapterId: 3 });
    store.save({ ...toCheckpoint(createRun('run-2', 'room-B', 2)), chapterId: 1 });
    expect(store.load('room-A')?.chapterId).toBe(3);
    expect(store.load('room-B')?.chapterId).toBe(1);
    expect(store.load('room-C')).toBeNull();
  });

  it('쓰기 실패(저장 공간 가득)는 예외 대신 결과로 알린다', () => {
    const kv = new MemoryKV();
    kv.failWrites = true;
    const store = new CheckpointStore(kv);
    expect(store.save(toCheckpoint(createRun('r', 'room-A', 1)))).toEqual({ ok: false, error: 'writeFailed' });
  });

  it('저장소를 쓸 수 없는 환경에서도 게임은 계속된다', () => {
    const store = new CheckpointStore(null);
    expect(store.save(toCheckpoint(createRun('r', 'room-A', 1)))).toEqual({ ok: false, error: 'unavailable' });
    expect(store.load('room-A')).toBeNull();
  });

  it('깨진 값·다른 버전·다른 방 기록은 읽지 않는다', () => {
    const kv = new MemoryKV();
    const store = new CheckpointStore(kv);
    kv.setItem(checkpointKey('room-A'), '{not json');
    expect(store.load('room-A')).toBeNull();
    kv.setItem(checkpointKey('room-A'), JSON.stringify({ ...toCheckpoint(createRun('r', 'room-A', 1)), schemaVersion: 99 }));
    expect(store.load('room-A')).toBeNull();
    kv.setItem(checkpointKey('room-A'), JSON.stringify(toCheckpoint(createRun('r', 'room-Z', 1))));
    expect(store.load('room-A')).toBeNull();
  });
});

describe('개인 설정', () => {
  it('팀 체크포인트와 다른 키에 저장한다', () => {
    const kv = new MemoryKV();
    saveSettings(kv, { ...DEFAULT_SETTINGS, muted: true });
    new CheckpointStore(kv).save(toCheckpoint(createRun('r', 'room-A', 1)));
    expect(kv.data.size).toBe(2);
    expect(loadSettings(kv).muted).toBe(true);
  });

  it('모르는 값은 무시하고 기본값을 쓴다', () => {
    const kv = new MemoryKV();
    kv.setItem('lastgift.settings.v1', JSON.stringify({ muted: 'yes', largeText: true, extra: 1 }));
    expect(loadSettings(kv)).toEqual({ ...DEFAULT_SETTINGS, largeText: true });
  });
});
