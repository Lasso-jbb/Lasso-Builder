/**
 * Gemning af samtalen i et stille øjeblik (C4): saveCache serialiserer hele samtalen (med datasæt), så den skal ikke
 * køre ved hver ændring. request() lægger én gemning i kø til browseren er ledig (requestIdleCallback, ellers efter
 * 1 s); flere request() før da giver stadig kun én gemning. markDirty() husker en ændring uden at planlægge en gemning
 * (fx kun den aktive fane), som flush() så tager med. flush() gemmer med det samme, hvis der venter noget (pagehide,
 * fanen skjult). Ren logik uden DOM, så den kan testes i node.
 */
export interface IdleScheduler {
  schedule: (fn: () => void) => unknown;
  cancel: (handle: unknown) => void;
}

export interface IdleSave {
  request: () => void;
  markDirty: () => void;
  flush: () => void;
  cancel: () => void;
}

/** Ledig tid: requestIdleCallback med 1 s som øvre grænse, ellers setTimeout 1 s (Safari). */
export function browserIdle(timeout = 1000): IdleScheduler {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  if (typeof w.requestIdleCallback === "function" && typeof w.cancelIdleCallback === "function") {
    return { schedule: (fn) => w.requestIdleCallback!(fn, { timeout }), cancel: (h) => w.cancelIdleCallback!(h as number) };
  }
  return { schedule: (fn) => setTimeout(fn, timeout), cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
}

export function createIdleSave(save: () => void, scheduler: IdleScheduler = browserIdle()): IdleSave {
  let handle: unknown = null;
  let dirty = false;
  const run = () => {
    handle = null;
    dirty = false;
    save();
  };
  return {
    request() {
      dirty = true;
      if (handle === null) handle = scheduler.schedule(run);
    },
    markDirty() {
      dirty = true;
    },
    flush() {
      if (handle !== null) scheduler.cancel(handle);
      handle = null;
      if (dirty) run();
    },
    cancel() {
      if (handle !== null) scheduler.cancel(handle);
      handle = null;
      dirty = false;
    },
  };
}
