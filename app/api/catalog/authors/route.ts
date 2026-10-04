import { NextResponse, type NextRequest } from 'next/server';
import { normalizeCatalogSearchQuery } from '@/lib/books/catalog-search';
export async function GET(request: NextRequest) {
  const q = normalizeCatalogSearchQuery(request.nextUrl.searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json({ authors: [] });
  try {
    const { supabase } = await import('@/lib/supabase/client');
    const { data, error } = await supabase.from('authors').select('id,name')
      .ilike('name', `%${q.replace(/[\\%_]/g, '\\$&')}%`).order('name').order('id').limit(20);
    if (error) throw error;
    return NextResponse.json({ authors: (data ?? []).map(a => ({ id: String(a.id), name: a.name })) });
  } catch { return NextResponse.json({ error: 'Author search unavailable.' }, { status: 503 }); }
}
