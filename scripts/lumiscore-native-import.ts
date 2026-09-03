import type { NativeSeedMetadata } from './lumiscore-native-seeds-nl.ts';

export function normalizeNativeIdentityPart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getNativeWorkIdentityKey(title: string, author: string): string {
  return `${normalizeNativeIdentityPart(title)}::${normalizeNativeIdentityPart(author)}`;
}

export function normalizeNativeIsbn13(value: string): string | null {
  const isbn = value.replace(/[\s-]/g, '');
  return /^97[89]\d{10}$/.test(isbn) ? isbn : null;
}

export type NativeImportableSeed = {
  title: string;
  author?: string;
  expectedOpenLibraryWorkId?: string;
  nativeMetadata?: NativeSeedMetadata;
};

export function assertNativeSeedIsSafe(seed: NativeImportableSeed): void {
  if (!seed.author || !seed.nativeMetadata) {
    throw new Error(`Native seed “${seed.title}” lacks verified metadata.`);
  }
  if (seed.expectedOpenLibraryWorkId) {
    throw new Error(`Native seed “${seed.title}” must not have an Open Library Work ID.`);
  }
  if (!normalizeNativeIsbn13(seed.nativeMetadata.isbn13)) {
    throw new Error(`Native seed “${seed.title}” has an invalid ISBN-13.`);
  }
}
