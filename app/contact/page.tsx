import {
  generateInformationPageMetadata,
  LumiScoreInformationRoute,
} from '@/app/components/LumiScoreInformationRoute';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return generateInformationPageMetadata('contact');
}

export default function ContactPage() {
  return <LumiScoreInformationRoute pageKey="contact" />;
}
