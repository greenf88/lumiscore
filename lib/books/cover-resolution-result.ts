export type CoverSource = 'open_library' | 'google_books';

export type CoverResolutionState =
  | 'resolved'
  | 'confirmed_missing'
  | 'temporary_failure';

export type CoverSourceResolution = {
  source: CoverSource;
  sourceKey: string;
  state: CoverResolutionState;
  coverUrl: string | null;
};

export function resolvedCover(
  source: CoverSource,
  sourceKey: string,
  coverUrl: string,
): CoverSourceResolution {
  return { source, sourceKey, state: 'resolved', coverUrl };
}

export function unresolvedCover(
  source: CoverSource,
  sourceKey: string,
  state: Exclude<CoverResolutionState, 'resolved'>,
): CoverSourceResolution {
  return { source, sourceKey, state, coverUrl: null };
}
