type PieceFabric = {
  file: File;
  previewUrl: string;
} | null;

export type SplitPieceFabrics = {
  jacket: PieceFabric;
  trousers: PieceFabric;
  shirt: PieceFabric;
  waistcoat: PieceFabric;
};
