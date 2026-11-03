type PieceFabrics<T> = { jacket: T | null; trousers: T | null; shirt: T | null; waistcoat: T | null };

export function clearSplitFabrics<T extends { previewUrl: string }>(current: PieceFabrics<T>, revoke: (url: string) => void): PieceFabrics<T> {
  for (const fabric of Object.values(current)) {
    if (fabric) revoke(fabric.previewUrl);
  }
  return { jacket: null, trousers: null, shirt: null, waistcoat: null };
}

/** Only independently stored fabrics own preview URLs; linked previews borrow the jacket. */
export function effectiveSplitFabrics<T>(stored: PieceFabrics<T>, linked: boolean): PieceFabrics<T> {
  return linked ? { ...stored, trousers: stored.jacket } : stored;
}

export function fabricAssignmentCounts(fabrics: PieceFabrics<unknown>, hasWaistcoat: boolean) {
  const pieces = [fabrics.jacket, fabrics.trousers, fabrics.shirt, ...(hasWaistcoat ? [fabrics.waistcoat] : [])];
  const uploaded = pieces.filter(Boolean).length;
  return { total: pieces.length, uploaded, reference: pieces.length - uploaded };
}
