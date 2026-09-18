import {
  generateInformationPageMetadata,
  LumiScoreInformationRoute,
} from '@/app/components/LumiScoreInformationRoute';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return generateInformationPageMetadata('publishers');
}

export default function PublishersPage() {
  return <LumiScoreInformationRoute pageKey="publishers" />;
}
