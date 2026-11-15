type Kind = 'metadata' | 'content' | 'config' | 'strings' | 'assets';
export function readActivityPackage(activityRoot: string, libraryRoot: string): {
  files: Array<{ file: string; kind: Kind }>;
  diagnostics: Array<{ file: string; kind: Kind; message: string }>;
};
