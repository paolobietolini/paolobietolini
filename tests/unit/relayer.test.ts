import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installRelayer, CHANGE, EVENT, type Relayer } from '../../src/lib/relayer.ts';

// A fresh fake `window` per test, with warnings captured instead of printed.
function load(window: { relayer?: unknown[] } = {}) {
  const errors: unknown[][] = [];
  const log = (...a: unknown[]) => void errors.push(a);
  const logger = { error: log, warn: log };
  installRelayer(window, logger);
  return { dl: window.relayer as Relayer, errors, rerun: () => installRelayer(window, logger) };
}

test('pushes deep-merge into the state', () => {
  const { dl } = load();
  dl.push({ page: { type: 'post', lang: 'en' } });
  dl.push({ page: { lang: 'it' }, user: { id: 1 } });
  assert.deepEqual(dl.getState(), { page: { type: 'post', lang: 'it' }, user: { id: 1 } });
});

test('keys after a nested object stay at the top level', () => {
  const { dl } = load();
  dl.push({ page: { type: 'post' }, site: 'pb' });
  assert.deepEqual(dl.getState(), { page: { type: 'post' }, site: 'pb' });
});

test('null or undefined deletes a key', () => {
  const { dl } = load();
  dl.push({ page: { type: 'post', lang: 'en' }, user: { id: 1 } });
  dl.push({ page: { lang: undefined }, user: null });
  assert.deepEqual(dl.getState(), { page: { type: 'post' } });
});

test('event and eventInfo are not kept in the state', () => {
  const { dl } = load();
  dl.push({ event: 'page_view', eventInfo: { id: 'x' }, page: { type: 'home' } });
  assert.deepEqual(dl.getState(), { page: { type: 'home' } });
  assert.equal(dl.length, 1, 'the event itself stays in the array');
});

test('arrays replace instead of merging', () => {
  const { dl } = load();
  dl.push({ content: { tags: ['ga4', 'gtm'] } });
  dl.push({ content: { tags: ['c'] } });
  assert.deepEqual(dl.getState(), { content: { tags: ['c'] } });
});

test('items pushed before the script loads are processed', () => {
  const { dl } = load({ relayer: [{ page: { type: 'home' } }] });
  assert.deepEqual(dl.getState(), { page: { type: 'home' } });
});

test('push returns the new length and keeps data items in the array', () => {
  const { dl } = load();
  assert.equal(dl.push({ a: 1 }, { b: 2 }), 2);
  assert.deepEqual([...dl], [{ a: 1 }, { b: 2 }]);
});

test('function items run with the relayer as argument and this, then leave the array', () => {
  const { dl } = load();
  let arg: unknown;
  let self: unknown;
  dl.push(function (this: unknown, r: unknown) { arg = r; self = this; }, { a: 1 });
  assert.equal(arg, dl);
  assert.equal(self, dl);
  assert.deepEqual([...dl], [{ a: 1 }]);
});

test('bad items are logged, removed from the array, and never thrown', () => {
  const { dl, errors } = load();
  dl.push({ page: { type: 'post' } });
  assert.doesNotThrow(() => dl.push(null, 'x', [1], { event: 42 }));
  assert.equal(dl.length, 1);
  assert.equal(errors.length, 4);
  dl.push({ cb() {}, page: { el: Symbol('s') } });
  assert.doesNotThrow(() => dl.getState());
  assert.deepEqual(dl.getState(), { page: { type: 'post' } });
});

test('getState takes a dot path', () => {
  const { dl } = load();
  dl.push({ page: { type: 'post', meta: { lang: 'en' } } });
  assert.equal(dl.getState('page.meta.lang'), 'en');
  assert.deepEqual(dl.getState('page.meta'), { lang: 'en' });
  assert.equal(dl.getState('page.nope.deeper'), undefined);
});

test('an event push fires the event, relayer:event and, with data, relayer:change', () => {
  const { dl } = load();
  const seen: string[] = [];
  let payload: unknown;
  let self: unknown;
  dl.addEventListener('click', function (this: unknown, item) { seen.push('click'); payload = item; self = this; });
  dl.addEventListener(EVENT, () => seen.push(EVENT));
  dl.addEventListener(CHANGE, () => seen.push(CHANGE));
  dl.push({ event: 'click', eventInfo: { id: 'cta' }, ui: { last: 'cta' } });
  assert.deepEqual(seen.sort(), [CHANGE, EVENT, 'click'].sort());
  assert.deepEqual(payload, { event: 'click', eventInfo: { id: 'cta' }, ui: { last: 'cta' } });
  assert.equal(self, dl);
  assert.deepEqual(dl.getState(), { ui: { last: 'cta' } });

  seen.length = 0;
  dl.push({ event: 'click', eventInfo: { id: 'nav' } });
  assert.deepEqual(seen.sort(), [EVENT, 'click'].sort(), 'no data, no change');

  seen.length = 0;
  dl.push({ page: { type: 'home' } });
  assert.deepEqual(seen, [CHANGE], 'data only fires change');
});

test('listener payloads are copies', () => {
  const { dl } = load();
  dl.addEventListener(CHANGE, (item) => { (item.page as { type: string }).type = 'mutated'; });
  const pushed = { page: { type: 'post' } };
  dl.push(pushed);
  assert.equal(pushed.page.type, 'post');
  assert.equal(dl.getState('page.type'), 'post');
});

test('scope all replays past items and catches new ones; past only replays; future only new', () => {
  const { dl } = load();
  dl.push({ event: 'click', eventInfo: { n: 1 } });
  const got = { all: [] as unknown[], past: [] as unknown[], future: [] as unknown[] };
  dl.addEventListener('click', (i) => got.all.push(i.eventInfo));
  dl.addEventListener('click', (i) => got.past.push(i.eventInfo), { scope: 'past' });
  dl.addEventListener('click', (i) => got.future.push(i.eventInfo), { scope: 'future' });
  dl.push({ event: 'click', eventInfo: { n: 2 } });
  assert.deepEqual(got, { all: [{ n: 1 }, { n: 2 }], past: [{ n: 1 }], future: [{ n: 2 }] });
});

test('path limits a listener to pushes that touch that path, including deleting a parent', () => {
  const { dl } = load();
  let calls = 0;
  dl.addEventListener(CHANGE, () => calls++, { path: 'page.lang' });
  dl.push({ user: { id: 1 } });
  dl.push({ page: { type: 'post' } });
  assert.equal(calls, 0);
  dl.push({ page: { lang: 'it' } });
  dl.push({ page: null });
  assert.equal(calls, 2);
});

test('removeEventListener removes one handler, or every handler for a type', () => {
  const { dl } = load();
  let a = 0;
  let b = 0;
  const ha = () => a++;
  dl.addEventListener('click', ha);
  dl.addEventListener('click', () => b++);
  dl.removeEventListener('click', ha);
  dl.push({ event: 'click' });
  assert.deepEqual([a, b], [0, 1]);
  dl.removeEventListener('click');
  dl.push({ event: 'click' });
  assert.deepEqual([a, b], [0, 1]);
});

test('registering the same listener twice has no effect', () => {
  const { dl } = load();
  let calls = 0;
  const h = () => calls++;
  dl.addEventListener('click', h, { scope: 'future' });
  dl.addEventListener('click', h, { scope: 'future' });
  dl.push({ event: 'click' });
  assert.equal(calls, 1);
});

test('listeners can be queued with push({ on }) before the script loads', () => {
  const calls: unknown[] = [];
  const handler = (i: Record<string, unknown>) => void calls.push(i.eventInfo);
  const { dl } = load({ relayer: [{ event: 'click', eventInfo: { n: 1 } }, { on: 'click', handler }] });
  dl.push({ event: 'click', eventInfo: { n: 2 } });
  assert.deepEqual(calls, [{ n: 1 }, { n: 2 }]);
  assert.deepEqual([...dl].map((i) => (i as { eventInfo: unknown }).eventInfo), [{ n: 1 }, { n: 2 }], 'on-items leave the array');
  dl.push({ off: 'click', handler });
  dl.push({ event: 'click', eventInfo: { n: 3 } });
  assert.equal(calls.length, 2);
});

test('a throwing listener is logged and does not stop other listeners or the push', () => {
  const { dl, errors } = load();
  let ran = false;
  dl.addEventListener(CHANGE, () => { throw new Error('boom'); });
  dl.addEventListener(CHANGE, () => { ran = true; });
  assert.doesNotThrow(() => dl.push({ a: 1 }));
  assert.ok(ran);
  assert.equal(dl.getState('a'), 1);
  assert.equal(errors.length, 1);
});

test('loading the script twice does not process pushes twice', () => {
  const { dl, rerun } = load();
  rerun();
  let calls = 0;
  dl.push(() => { calls++; });
  assert.equal(calls, 1);
});

test('getState returns a copy', () => {
  const { dl } = load();
  dl.push({ page: { type: 'post' } });
  const s = dl.getState() as { page: { type: string } };
  s.page.type = 'changed';
  assert.equal((dl.getState() as { page: { type: string } }).page.type, 'post');
});
