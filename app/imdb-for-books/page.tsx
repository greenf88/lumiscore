import { generateInformationPageMetadata, LumiScoreInformationRoute } from '@/app/components/LumiScoreInformationRoute';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return generateInformationPageMetadata('imdbComparison');
}

export default function ImdbComparisonPage() {
  return <LumiScoreInformationRoute pageKey="imdbComparison" />;
}
