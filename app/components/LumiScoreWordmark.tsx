'use client';

import { LocaleLink } from './LumiScoreLocale';

import { useLumiScoreLocale } from './LumiScoreLocale';

export function LumiScoreWordmark() {
  const { t } = useLumiScoreLocale();
  return (
    <LocaleLink className="wordmark" href="/" aria-label={t('common.lumiscoreHome')}>
      <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Lumi<span>Score</span></span>
    </LocaleLink>
  );
}
