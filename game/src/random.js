// v9 final: the same seeded streams keep the harbor, the boats and the new missions identical on every load.
// random.js — a seeded RNG keeps the city, traffic and missions
// identical on every load. Each system draws from its own stream,
// all of them derived from the single world seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let mix = Math.imul(a ^ (a >>> 15), 1 | a);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// A small hash of a string, for deriving per-system seeds from one seed.
export function hashSeed(text) {
  let acc = 2166136261;
  for (let i = 0; i < text.length; i++) {
    acc ^= text.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return acc >>> 0;
}
