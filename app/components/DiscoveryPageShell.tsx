'use client';
import { useState, type ReactNode } from 'react';
import { Header, Footer } from './LumiScoreHome';
import type { HeaderAuthState } from '@/lib/auth/header';
export function DiscoveryPageShell({ children, authState, path }: { children: ReactNode; authState: HeaderAuthState; path: string }) {
  const [query, setQuery] = useState('');
  const theme = () => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  };
  return <main className="site-shell"><Header query={query} onQueryChange={setQuery} onThemeToggle={theme} authState={authState} returnTo={path} />{children}<Footer onThemeToggle={theme} /></main>;
}
