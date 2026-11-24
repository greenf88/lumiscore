'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createFormSubmissionLatch } from '@/lib/auth/form-submission';

export function useAuthFormSubmission() {
  const [latch] = useState(createFormSubmissionLatch);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // A native POST leaves this page. Returning through the browser's back/forward
    // cache must make the preserved form usable again, without resubmitting it.
    const reset = () => { latch.reset(); setPending(false); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, [latch]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (event.defaultPrevented) return;
    if (!latch.claim()) { event.preventDefault(); return; }
    setPending(true);
  }

  return { pending, onSubmit };
}
