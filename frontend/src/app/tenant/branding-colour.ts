// Readable preview text for the six-digit colours accepted by the tenant contract.
export function brandingInk(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return '#17263a';
  const channels = [1, 3, 5]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function colourContrast(a: string, b: string): number {
  const light = (c: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(c)) return 1;
    const v = [1, 3, 5]
      .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  };
  const x = light(a),
    y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
