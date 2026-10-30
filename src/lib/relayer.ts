// relayer: the site's data layer, modelled on the Adobe Client Data Layer.
// An array you push items into, plus a deep-merged state and event listeners.
// Pure module: no astro:* imports, so `node --test` can load it directly.
//
// Items:
//   { ...data }                          merged into the state       → relayer:change
//   { event, eventInfo?, ...data }       event; data merged          → relayer:event, <event>, relayer:change if data
//   function (relayer) {}                called once, then removed from the array
//   { on, handler, scope?, path? }       addEventListener, queueable before load; removed from the array
//   { off, handler? }                    removeEventListener; removed from the array

export const CHANGE = 'relayer:change';
export const EVENT = 'relayer:event';

export type State = Record<string, unknown>;
export type Scope = 'past' | 'future' | 'all';
export type ListenerOptions = { scope?: Scope; path?: string };
export type Handler = (this: Relayer, item: State) => void;
export type Relayer = unknown[] & {
  getState(path?: string): unknown;
  addEventListener(type: string, handler: Handler, options?: ListenerOptions): void;
  removeEventListener(type: string, handler?: Handler): void;
};
type Logger = Pick<Console, 'warn' | 'error'>;
type Listener = { type: string; handler: Handler; path?: string };

declare global {
  interface Window {
    relayer?: unknown[];
  }
}

const isObj = (v: unknown): v is State => v !== null && typeof v === 'object' && !Array.isArray(v);

function copy<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return v;
  }
}

function get(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split('.')) {
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

// True when `data` sets or deletes `path`, or deletes one of its parents.
function touches(data: State | undefined, path: string): boolean {
  let cur: unknown = data;
  for (const key of path.split('.')) {
    if (!isObj(cur) || !(key in cur)) return false;
    cur = cur[key];
    if (cur === null || cur === undefined) return true;
  }
  return true;
}

// Objects merge key by key, arrays and primitives replace, null/undefined delete.
// Values structuredClone can't copy (functions, symbols, DOM nodes) are skipped.
function merge(target: State, source: State, path: string, log: Logger): State {
  for (const [k, v] of Object.entries(source)) {
    if (v === null || v === undefined) {
      delete target[k];
    } else if (isObj(v)) {
      target[k] = merge(isObj(target[k]) ? target[k] : {}, v, `${path}${k}.`, log);
    } else {
      try {
        target[k] = structuredClone(v);
      } catch {
        log.warn("[relayer] skipped a value that can't be copied:", path + k, v);
      }
    }
  }
  return target;
}

// The part of an item that goes into the state: everything except event and eventInfo.
function dataOf(item: State): State | undefined {
  const { event, eventInfo, ...data } = item;
  return Object.keys(data).length ? data : undefined;
}

// Event names an item fires, in ACDL order.
function firedBy(item: State): string[] {
  if (typeof item.event !== 'string') return [CHANGE];
  const names = [EVENT, item.event];
  if (dataOf(item)) names.push(CHANGE);
  return names;
}

// Turns `w.relayer` (created here if missing) into a relayer. Items pushed before this
// runs are processed in order. Safe to call twice: push is only wrapped once.
export function installRelayer(w: { relayer?: unknown[] }, log: Logger = console): Relayer {
  const dl = (w.relayer ??= []) as Relayer;
  if (typeof dl.getState === 'function') return dl;

  const state: State = {};
  const origPush = dl.push;
  let listeners: Listener[] = [];

  function call(l: Listener, item: State): void {
    if (!firedBy(item).includes(l.type)) return;
    if (l.path && !touches(dataOf(item), l.path)) return;
    try {
      l.handler.call(dl, copy(item));
    } catch (err) {
      log.error(`[relayer] a "${l.type}" listener threw:`, err);
    }
  }

  function on(type: string, handler: Handler, { scope = 'all', path }: ListenerOptions = {}): void {
    const l: Listener = { type, handler, path };
    if (scope !== 'future') for (const past of [...dl]) call(l, past as State);
    if (scope === 'past') return;
    const dupe = listeners.some((x) => x.type === type && x.handler === handler && x.path === path);
    if (!dupe) listeners.push(l);
  }

  function off(type: string, handler?: Handler): void {
    listeners = listeners.filter((l) => l.type !== type || (handler && l.handler !== handler));
  }

  // Processes one item. Returns true when it belongs in the array (data and events).
  function apply(item: unknown): boolean {
    try {
      if (typeof item === 'function') {
        item.call(dl, dl);
        return false;
      }
      if (!isObj(item)) throw new TypeError('not a plain object');
      if (typeof item.on === 'string' && typeof item.handler === 'function') {
        on(item.on, item.handler as Handler, { scope: item.scope as Scope, path: item.path as string });
        return false;
      }
      if (typeof item.off === 'string') {
        off(item.off, item.handler as Handler | undefined);
        return false;
      }
      if ('event' in item && typeof item.event !== 'string') throw new TypeError('event must be a string');
      const data = dataOf(item);
      if (data) merge(state, data, '', log);
      origPush.call(dl, item);
      for (const l of [...listeners]) call(l, item);
      return true;
    } catch (err) {
      log.error('[relayer] ignored an invalid push:', item, err);
      return false;
    }
  }

  dl.getState = (path?: string) => (path ? copy(get(state, path)) : copy(state));
  dl.addEventListener = on;
  dl.removeEventListener = off;
  dl.push = (...items: unknown[]) => {
    items.forEach(apply);
    return dl.length;
  };

  const queued = dl.splice(0);
  queued.forEach(apply);
  return dl;
}
