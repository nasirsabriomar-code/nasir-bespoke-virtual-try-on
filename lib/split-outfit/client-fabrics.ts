type PieceFabrics<T> = { jacket: T | null; trousers: T | null; shirt: T | null; waistcoat: T | null };

export function clearSplitFabrics<T extends { previewUrl: string }>(current: PieceFabrics<T>, revoke: (url: string) => void): PieceFabrics<T> {
  for (const fabric of Object.values(current)) {
    if (fabric) revoke(fabric.previewUrl);
  }
  return { jacket: null, trousers: null, shirt: null, waistcoat: null };
}
