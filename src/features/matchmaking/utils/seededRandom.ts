function hashString(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function seededValue(seed: number, ...parts: Array<string | number>): number {
  const combined = [seed, ...parts].join("|");
  const hashed = hashString(combined) || 1;
  let state = hashed;

  state += 0x6d2b79f5;
  let t = Math.imul(state ^ (state >>> 15), state | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
