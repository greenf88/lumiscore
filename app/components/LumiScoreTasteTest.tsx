'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Book } from '../data/books';
import {
  TASTE_TEST_QUESTIONS,
  type TasteTestAnswers,
  type TasteTestChoice,
} from '@/lib/taste-test/config';
import {
  parseGuestTasteTestAnswers,
  serializeGuestTasteTestAnswers,
  TASTE_TEST_GUEST_STORAGE_KEY,
} from '@/lib/taste-test/guest-storage';
import {
  buildTasteProfile,
  getTasteProfileConfidenceCopy,
} from '@/lib/taste-test/profile';
import { BookCover, Footer, Header } from './LumiScoreHome';

type ServerState = {
  authenticated: boolean;
  answers: TasteTestAnswers;
  ratingCount: number;
  persistenceAvailable: boolean;
};

function answerPayload(answers: TasteTestAnswers) {
  return TASTE_TEST_QUESTIONS.flatMap(({ key }) => {
    const choice = answers[key];
    return choice ? [{ questionKey: key, choice }] : [];
  });
}

export function LumiScoreTasteTest({ books }: { books: Book[] }) {
  const booksById = useMemo(
    () => new Map(books.flatMap((book) => book.workId ? [[book.workId, book] as const] : [])),
    [books],
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<TasteTestAnswers>({});
  const [showResults, setShowResults] = useState(false);
  const [query, setQuery] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'local' | 'error'>('loading');
  const question = TASTE_TEST_QUESTIONS[questionIndex];
  const leftBook = booksById.get(question.leftWorkId);
  const rightBook = booksById.get(question.rightWorkId);
  const currentChoice = answers[question.key];
  const profile = useMemo(() => buildTasteProfile(answers, []), [answers]);
  const confidenceCopy = getTasteProfileConfidenceCopy(profile.confidence);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const persistAnswers = useCallback(async (nextAnswers: TasteTestAnswers) => {
    localStorage.setItem(TASTE_TEST_GUEST_STORAGE_KEY, serializeGuestTasteTestAnswers(nextAnswers));
    if (!authenticated) {
      setSaveStatus('local');
      return false;
    }
    setSaveStatus('saving');
    const response = await fetch('/api/taste-test', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answerPayload(nextAnswers) }),
    });
    if (!response.ok) {
      setSaveStatus('error');
      return false;
    }
    localStorage.removeItem(TASTE_TEST_GUEST_STORAGE_KEY);
    setSaveStatus('saved');
    return true;
  }, [authenticated]);

  useEffect(() => {
    const guestAnswers = parseGuestTasteTestAnswers(localStorage.getItem(TASTE_TEST_GUEST_STORAGE_KEY));
    let cancelled = false;
    void fetch('/api/taste-test', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Taste Test state unavailable.');
        const state = await response.json() as ServerState;
        if (cancelled) return;
        setAuthenticated(state.authenticated);
        const merged = state.authenticated ? { ...state.answers, ...guestAnswers } : guestAnswers;
        setAnswers(merged);
        setSaveStatus(state.authenticated ? 'idle' : 'local');
        if (state.authenticated && state.persistenceAvailable && Object.keys(guestAnswers).length > 0) {
          const response = await fetch('/api/taste-test', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answerPayload(merged) }),
          });
          if (!cancelled && response.ok) {
            localStorage.removeItem(TASTE_TEST_GUEST_STORAGE_KEY);
            setSaveStatus('saved');
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAnswers(guestAnswers);
        setSaveStatus('local');
      });
    return () => { cancelled = true; };
  }, []);

  const choose = (choice: TasteTestChoice) => {
    setAnswers((current) => {
      const next = { ...current, [question.key]: choice };
      localStorage.setItem(TASTE_TEST_GUEST_STORAGE_KEY, serializeGuestTasteTestAnswers(next));
      return next;
    });
    setSaveStatus(authenticated ? 'idle' : 'local');
  };

  const finish = async () => {
    if (profile.answeredCount !== TASTE_TEST_QUESTIONS.length) return;
    setShowResults(true);
    try {
      await persistAnswers(answers);
    } catch {
      setSaveStatus('error');
    }
  };

  if (!leftBook || !rightBook) {
    return (
      <main className="site-shell taste-test-shell">
        <Header onThemeToggle={toggleTheme} query={query} onQueryChange={setQuery} />
        <section className="taste-test-unavailable" role="status">
          <span className="eyebrow">TASTE TEST</span>
          <h1>The Taste Test is temporarily unavailable.</h1>
          <p>One or more catalog books could not be loaded. Please try again shortly.</p>
          <a className="primary-cta" href="/">Back to books <span>→</span></a>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell taste-test-shell">
      <Header onThemeToggle={toggleTheme} query={query} onQueryChange={setQuery} />
      <section className="taste-test-page" aria-labelledby="taste-test-title">
        {!showResults ? (
          <>
            <div className="taste-test-heading">
              <span className="eyebrow">TASTE TEST · {questionIndex + 1} / {TASTE_TEST_QUESTIONS.length}</span>
              <h1 id="taste-test-title">Which would you rather read?</h1>
              <p>You do not need to have read either book. Choose on instinct.</p>
              <div className="taste-progress" role="progressbar" aria-valuemin={1} aria-valuemax={10} aria-valuenow={questionIndex + 1} aria-label={`Question ${questionIndex + 1} of 10`}>
                <span style={{ width: `${((questionIndex + 1) / 10) * 100}%` }} />
              </div>
            </div>
            <fieldset className="taste-pair">
              <legend className="sr-only">Which would you rather read?</legend>
              {([
                ['left', leftBook],
                ['right', rightBook],
              ] as const).map(([choice, book]) => (
                <button key={choice} className={`taste-book-option${currentChoice === choice ? ' is-selected' : ''}`} type="button" aria-pressed={currentChoice === choice} onClick={() => choose(choice)}>
                  <BookCover book={book} label={`Cover of ${book.title}`} />
                  <span className="taste-book-copy"><strong>{book.title}</strong><span>{book.author}</span></span>
                  <span className="taste-choice-mark" aria-hidden="true">{currentChoice === choice ? '✓ Selected' : 'Choose'}</span>
                </button>
              ))}
              <button className={`taste-neither${currentChoice === 'neither' ? ' is-selected' : ''}`} type="button" aria-pressed={currentChoice === 'neither'} onClick={() => choose('neither')}>Neither / not sure</button>
            </fieldset>
            <div className="taste-controls">
              <button type="button" onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} disabled={questionIndex === 0}>← Previous</button>
              {questionIndex < 9 ? (
                <button className="taste-next" type="button" disabled={!currentChoice} onClick={() => setQuestionIndex((index) => Math.min(9, index + 1))}>Next →</button>
              ) : (
                <button className="taste-next" type="button" disabled={!currentChoice || profile.answeredCount !== 10} onClick={() => void finish()}>See my reading taste →</button>
              )}
            </div>
          </>
        ) : (
          <div className="taste-result">
            <span className="eyebrow">YOUR READING TASTE</span>
            <h1 id="taste-test-title">Your reading taste</h1>
            <p className="taste-result-summary">{profile.summary}</p>
            <p className="taste-confidence">
              <strong>{confidenceCopy.label}</strong>
              <span>{confidenceCopy.description}</span>
            </p>
            <p className="taste-save-status" role="status" aria-live="polite">
              {saveStatus === 'saving' ? 'Saving your Taste Test…' : saveStatus === 'saved' ? 'Saved to your LumiScore account.' : saveStatus === 'error' ? 'Saved on this device, but account sync is temporarily unavailable.' : !authenticated ? 'Saved on this device.' : ''}
            </p>
            <div className="taste-result-actions">
              <a className="primary-cta" href="/">See your recommendations <span>→</span></a>
              {!authenticated && <a className="taste-sign-in" href="/login?next=%2Ftaste-test">Sign in to save your profile</a>}
              <button type="button" onClick={() => { setQuestionIndex(0); setShowResults(false); }}>Take the test again</button>
            </div>
          </div>
        )}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
