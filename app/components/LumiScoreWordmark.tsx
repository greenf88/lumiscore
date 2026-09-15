'use client';

import { useLumiScoreLocale } from './LumiScoreLocale';

export function LumiScoreWordmark() {
  const { t } = useLumiScoreLocale();
  return (
    <a className="wordmark" href="/" aria-label={t('common.lumiscoreHome')}>
      <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Lumi<span>Score</span></span>
    </a>
  );
}
