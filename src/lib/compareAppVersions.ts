export function compareAppVersions(a: string, b: string): number {
  const v1 = a.split(".").map(Number);
  const v2 = b.split(".").map(Number);

  const length = Math.max(v1.length, v2.length);

  for (let i = 0; i < length; i++) {
    const part1 = v1[i] ?? 0;
    const part2 = v2[i] ?? 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}
