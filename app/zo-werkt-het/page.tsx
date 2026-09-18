import {
  generateInformationPageMetadata,
  LumiScoreInformationRoute,
} from '@/app/components/LumiScoreInformationRoute';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return generateInformationPageMetadata('howItWorks');
}

export default function HowItWorksPage() {
  return <LumiScoreInformationRoute pageKey="howItWorks" />;
}
