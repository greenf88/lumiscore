import { cache } from 'react';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { LumiScoreMyBooks } from '@/app/components/LumiScoreMyBooks';
import type { MyBooksPageData } from '@/lib/supabase/book-status';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'My books — LumiScore',
  description: 'Manage your personal reading library on LumiScore.',
  canonicalPath: '/my-books',
  noIndex: true,
});

const load = cache(async (): Promise<MyBooksPageData> => {
  try {
    const { loadMyBooksPageData } = await import('@/lib/supabase/book-status');
    return await loadMyBooksPageData();
  } catch (error) {
    console.error('My Books load failed.', error);
    const { loadHeaderAuthState } = await import('@/lib/supabase/auth');
    const auth = await loadHeaderAuthState();
    return { authenticated: auth.authenticated, available: false, items: [] };
  }
});

export default async function MyBooksPage() {
  const data = await load();
  return (
    <>
      <LumiScoreMyBooks data={data} />
    </>
  );
}
