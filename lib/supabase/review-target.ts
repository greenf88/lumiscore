// Fail closed when a review environment has no verified separate database.
export function isProductionBackedReview(environment: {
  deploymentEnvironment?: string; nodeEnvironment?: string; supabaseUrl?: string | null;
}): boolean {
  const review = environment.deploymentEnvironment === 'preview' || environment.nodeEnvironment !== 'production';
  if (!review) return false;
  try { return new URL(environment.supabaseUrl ?? '').hostname === 'qvplwejffhjvxaypmjut.supabase.co'; }
  catch { return true; }
}
