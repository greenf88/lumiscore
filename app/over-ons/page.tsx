import {
  generateInformationPageMetadata,
  LumiScoreInformationRoute,
} from '@/app/components/LumiScoreInformationRoute';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return generateInformationPageMetadata('about');
}

export default function AboutPage() {
  return <LumiScoreInformationRoute pageKey="about" />;
}
