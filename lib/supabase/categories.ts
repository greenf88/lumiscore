import type { PublicCategory } from '../catalog/discovery';
import { supabase } from './client';
export async function loadPublicCategories(): Promise<PublicCategory[]> {
  const { data, error } = await supabase.from('catalog_categories').select('id,label_nl,label_en').order('id');
  if (error) throw error;
  return (data ?? []).map(c => ({ id: String(c.id), nl: String(c.label_nl), en: String(c.label_en) }));
}
