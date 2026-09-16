'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../data/books';

const STORAGE_KEY = 'lumiscore-wanted';

function readGuestWanted(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function workIdFromStoredId(value: string): string | null {
  const match = /^work-(\d+)$/.exec(value);
  return match?.[1] ?? null;
}

export async function migrateGuestWantToReadFromLocal(
  signal?: AbortSignal,
): Promise<boolean> {
  const guestIds = readGuestWanted().flatMap((id) => {
    const workId = workIdFromStoredId(id);
    return workId ? [workId] : [];
  });
  if (guestIds.length === 0) return false;

  const migration = await fetch('/api/book-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workIds: guestIds }),
    signal,
  });
  if (!migration.ok) return false;
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

export function useWantToRead(authenticated: boolean, books: readonly Book[]) {
  const [wanted, setWanted] = useState<Set<string>>(new Set());
  const migrated = useRef(false);
  const workIds = books.flatMap((book) => book.workId ? [book.workId] : []);
  const workIdKey = [...new Set(workIds)].sort((a, b) => Number(a) - Number(b)).join(',');

  useEffect(() => {
    if (!authenticated) {
      const frame = requestAnimationFrame(() => setWanted(new Set(readGuestWanted())));
      return () => cancelAnimationFrame(frame);
    }

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
      setWanted((current) => {
        const next = new Set(current);
        for (const book of books) {
          if (!book.workId) continue;
          if (payload.statuses?.[book.workId] === 'want_to_read') next.add(book.id);
          else next.delete(book.id);
        }
        return next;
      });
    };
    void load().catch(() => undefined);
    return () => controller.abort();
  }, [authenticated, workIdKey, books]);

  const toggleWanted = useCallback((book: Book) => {
    const wasWanted = wanted.has(book.id);
    setWanted((current) => {
      const next = new Set(current);
      if (wasWanted) next.delete(book.id); else next.add(book.id);
      if (!authenticated || !book.workId) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });

    if (authenticated && book.workId) {
      void fetch(`/api/books/${book.workId}/status`, {
        method: wasWanted ? 'DELETE' : 'PUT',
        headers: wasWanted ? undefined : { 'Content-Type': 'application/json' },
        body: wasWanted ? undefined : JSON.stringify({ status: 'want_to_read' }),
      }).then((response) => {
        if (!response.ok) throw new Error('Status update failed.');
      }).catch(() => {
        setWanted((current) => {
          const next = new Set(current);
          if (wasWanted) next.add(book.id); else next.delete(book.id);
          return next;
        });
      });
    }
  }, [authenticated, wanted]);

  return { wanted, toggleWanted };
}
