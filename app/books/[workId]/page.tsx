import { permanentRedirect } from 'next/navigation';

type BookPageProps = {
  params: Promise<{ workId: string }>;
};

export default async function BookPage({ params }: BookPageProps) {
  const { workId } = await params;
  permanentRedirect(`/book/${encodeURIComponent(workId)}`);
}
