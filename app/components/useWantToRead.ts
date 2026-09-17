'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../data/books';
import { isReadingStatus, type ReadingStatus } from '@/lib/collections/model';
import {
  GUEST_WANTED_STORAGE_KEY,
  getGuestWantedWorkIds,
  getGuestWantedStorageId,
  parseGuestWantedIds,
  toggleGuestWantedId,
} from '@/lib/collections/guest-want-to-read';

export function readGuestWantedFromLocalStorage(): string[] {
  return parseGuestWantedIds(localStorage.getItem(GUEST_WANTED_STORAGE_KEY));
}

export async function migrateGuestWantToReadFromLocal(
  signal?: AbortSignal,
): Promise<boolean> {
  const guestIds = getGuestWantedWorkIds(readGuestWantedFromLocalStorage());
  if (guestIds.length === 0) return false;

  const migration = await fetch('/api/book-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workIds: guestIds }),
    signal,
  });
  if (!migration.ok) return false;
  localStorage.removeItem(GUEST_WANTED_STORAGE_KEY);
  return true;
}

export function useWantToRead(authenticated: boolean, books: readonly Book[]) {
  const [wanted, setWanted] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Map<string, ReadingStatus>>(new Map());
  const wantedRef = useRef<Set<string>>(new Set());
  const migrated = useRef(false);
  const workIds = books.flatMap((book) => book.workId ? [book.workId] : []);
  const workIdKey = [...new Set(workIds)].sort((a, b) => Number(a) - Number(b)).join(',');

  useEffect(() => {
    if (authenticated) return;
    const restore = () => {
      const restored = new Set(readGuestWantedFromLocalStorage());
      wantedRef.current = restored;
      setWanted(restored);
      setStatuses(new Map());
    };
    restore();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GUEST_WANTED_STORAGE_KEY) restore();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;

    const controller = new AbortController();
    const load = async () => {
      if (!migrated.current) {
        migrated.current = true;
        await migrateGuestWantToReadFromLocal(controller.signal);
      }
      if (!workIdKey) return;
      const response = await fetch(`/api/book-status?workIds=${encodeURIComponent(workIdKey)}`, {
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { statuses?: Record<string, string> };
      setStatuses((current) => {
        const next = new Map(current);
        for (const book of books) {
          if (!book.workId) continue;
          const status = payload.statuses?.[book.workId];
          if (isReadingStatus(status)) next.set(book.workId, status);
          else next.delete(book.workId);
        }
        return next;
      });
      setWanted((current) => {
        const next = new Set(current);
        for (const book of books) {
          if (!book.workId) continue;
          const storageId = getGuestWantedStorageId(book);
          if (payload.statuses?.[book.workId] === 'want_to_read') next.add(storageId);
          else next.delete(storageId);
        }
        wantedRef.current = next;
        return next;
      });
    };
    void load().catch(() => undefined);
    return () => controller.abort();
  }, [authenticated, workIdKey, books]);

  const toggleWanted = useCallback((book: Book) => {
    const existingStatus = book.workId ? statuses.get(book.workId) : null;
    if (authenticated && existingStatus && existingStatus !== 'want_to_read') return;

    const storageId = getGuestWantedStorageId(book);
    const wasWanted = wantedRef.current.has(storageId);
    const nextWanted = toggleGuestWantedId(wantedRef.current, storageId);
    wantedRef.current = nextWanted;
    setWanted(nextWanted);
    if (!authenticated || !book.workId) {
      localStorage.setItem(GUEST_WANTED_STORAGE_KEY, JSON.stringify([...nextWanted]));
    }

    if (authenticated && book.workId) {
      setStatuses((current) => {
        const next = new Map(current);
        if (wasWanted) next.delete(book.workId!);
        else next.set(book.workId!, 'want_to_read');
        return next;
      });
      void fetch(`/api/books/${book.workId}/status`, {
        method: wasWanted ? 'DELETE' : 'PUT',
        headers: wasWanted ? undefined : { 'Content-Type': 'application/json' },
        body: wasWanted ? undefined : JSON.stringify({ status: 'want_to_read' }),
      }).then((response) => {
        if (!response.ok) throw new Error('Status update failed.');
      }).catch(() => {
        setStatuses((current) => {
          const next = new Map(current);
          if (wasWanted) next.set(book.workId!, 'want_to_read');
          else next.delete(book.workId!);
          return next;
        });
        setWanted((current) => {
          const next = new Set(current);
          if (wasWanted) next.add(storageId); else next.delete(storageId);
          wantedRef.current = next;
          return next;
        });
      });
    }
  }, [authenticated, statuses]);

  return { wanted, statuses, toggleWanted };
}
