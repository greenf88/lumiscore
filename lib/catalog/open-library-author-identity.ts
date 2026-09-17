export type StoredOpenLibraryAuthor = {
  id: string;
  name: string;
  openLibraryId: string | null;
};

export type OpenLibraryAuthorIdentityDecision =
  | {
      action: 'create';
      author: null;
      conflict: null;
    }
  | {
      action: 'reuse';
      author: StoredOpenLibraryAuthor;
      conflict: null;
    }
  | {
      action: 'enrich';
      author: StoredOpenLibraryAuthor;
      conflict: null;
    }
  | {
      action: 'preserve_conflict';
      author: StoredOpenLibraryAuthor;
      conflict: {
        storedOpenLibraryId: string;
        incomingOpenLibraryId: string;
      };
    };

export function normalizeOpenLibraryAuthorId(
  value: string | null | undefined,
): string | null {
  const normalized = value
    ?.split('/')
    .filter(Boolean)
    .at(-1)
    ?.toUpperCase() ?? '';
  return /^OL\d+A$/.test(normalized) ? normalized : null;
}

export function decideOpenLibraryAuthorIdentity(input: {
  incomingOpenLibraryId: string;
  existingByIncomingId: StoredOpenLibraryAuthor | null;
  existingByName: StoredOpenLibraryAuthor | null;
}): OpenLibraryAuthorIdentityDecision {
  const incomingOpenLibraryId = normalizeOpenLibraryAuthorId(
    input.incomingOpenLibraryId,
  );
  if (!incomingOpenLibraryId) {
    throw new Error('A valid incoming Open Library Author ID is required.');
  }

  if (input.existingByIncomingId) {
    return {
      action: 'reuse',
      author: input.existingByIncomingId,
      conflict: null,
    };
  }

  const existing = input.existingByName;
  if (!existing) return { action: 'create', author: null, conflict: null };

  const storedOpenLibraryId = normalizeOpenLibraryAuthorId(
    existing.openLibraryId,
  );
  if (!storedOpenLibraryId) {
    return { action: 'enrich', author: existing, conflict: null };
  }
  if (storedOpenLibraryId === incomingOpenLibraryId) {
    return { action: 'reuse', author: existing, conflict: null };
  }

  return {
    action: 'preserve_conflict',
    author: existing,
    conflict: { storedOpenLibraryId, incomingOpenLibraryId },
  };
}
