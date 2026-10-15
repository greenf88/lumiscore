/** Presentation only. Callers supply the existing privacy-filtered display value. */
export function CoverScoreBadge({ score, presentation = 'card' }: { score: string; presentation?: string }) {
  return (
    <span className={`score-badge${presentation === 'detail' ? ' detail-score-badge' : ''} cover-rating-badge`}
      role="img" aria-label={`LumiScore ${score}`}>
      <strong aria-hidden="true">{score}</strong>
      <small aria-hidden="true">LumiScore</small>
    </span>
  );
}
