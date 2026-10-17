// Screens with unsent, debounced saves (count taps, stock taps) register a flush
// function here so sign-out can send them BEFORE the session is cleared. Without
// this, a count tapped less than a second before "Sign out" was dropped, and the
// count came back as "0 of N" on the next login.
const flushers = new Set();

export function registerFlusher(fn) {
  flushers.add(fn);
  return () => { flushers.delete(fn); };
}

export async function flushAll() {
  await Promise.allSettled([...flushers].map((fn) => Promise.resolve().then(fn)));
}
