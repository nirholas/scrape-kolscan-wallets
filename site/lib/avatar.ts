function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarFallbackStyle(seed: string) {
  const hash = hashSeed(seed || "user");
  const hue = hash % 360;
  const saturation = 62 + (hash % 14); // 62-75
  const lightness = 40 + ((hash >> 3) % 10); // 40-49

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    borderColor: `hsl(${hue} ${Math.max(50, saturation - 10)}% ${Math.max(28, lightness - 12)}%)`,
    color: "#ffffff",
  };
}