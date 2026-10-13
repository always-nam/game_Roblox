import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, composePhrase, STEPS_PER_BAR, BARS_PER_PHRASE } from '../../src/music.js';

test('장소마다 곡이 있다: 메인·다락방·대청마루·장터·공방', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['attic', 'autumn', 'summer', 'title', 'winter']);
});

test('같은 곡·같은 악절이면 항상 같은 악보(순수 함수)', () => {
  for (const name of Object.keys(TRACKS)) assert.deepEqual(composePhrase(name, 0), composePhrase(name, 2));
});

test('홀짝 악절은 선율이 달라 반복이 덜 단조롭다', () => {
  const a = composePhrase('title', 0).filter((e) => e.inst === 'box').map((e) => e.midi).join();
  const b = composePhrase('title', 1).filter((e) => e.inst === 'box').map((e) => e.midi).join();
  assert.notEqual(a, b);
});

test('선율은 그 곡의 5음계 안의 음만 쓴다', () => {
  for (const [name, tr] of Object.entries(TRACKS)) {
    for (const e of composePhrase(name, 1).filter((x) => x.inst === tr.lead && x.vel > 0.35 && x.dur >= tr.melodyEvery)) {
      const deg = (((e.midi - tr.root) % 12) + 12) % 12;
      const okScale = tr.scale.includes(deg);
      const okChord = tr.prog.some((ch) => ch.some((c) => (((c % 12) + 12) % 12) === deg));
      assert.ok(okScale || okChord, `${name}: ${e.midi}`);
    }
  }
});

test('모든 음은 악절 안에 있고, 길이와 세기가 올바르다', () => {
  for (const name of Object.keys(TRACKS)) {
    const ev = composePhrase(name, 3);
    assert.ok(ev.length > 20, `${name}: ${ev.length}개`);
    for (const e of ev) {
      assert.ok(e.step >= 0 && e.step < STEPS_PER_BAR * BARS_PER_PHRASE);
      assert.ok(e.dur > 0 && e.vel > 0 && e.vel <= 1);
    }
    for (let i = 1; i < ev.length; i++) assert.ok(ev[i].step >= ev[i - 1].step);
  }
});

test('가을 장터에만 장구 소리가 있고, 템포는 장터가 가장 빠르고 공방이 가장 느리다', () => {
  assert.ok(composePhrase('autumn', 0).some((e) => e.inst === 'kung'));
  assert.ok(!composePhrase('winter', 0).some((e) => e.inst === 'kung'));
  const bpms = Object.fromEntries(Object.entries(TRACKS).map(([k, v]) => [k, v.bpm]));
  assert.equal(Math.max(...Object.values(bpms)), bpms.autumn);
  assert.equal(Math.min(...Object.values(bpms)), bpms.winter);
});
