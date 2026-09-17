export function canShowSeriesDenominator(
  position: number,
  total: number | null,
): total is number {
  return total !== null && Number.isInteger(total) && total > 0 && position <= total;
}

export function canShowProgressDenominator(
  total: number | null,
): total is number {
  return total !== null && Number.isInteger(total) && total >= 0;
}
