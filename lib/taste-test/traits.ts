export const TASTE_TRAITS = [
  'fantasy', 'science_fiction', 'speculative', 'literary', 'romance',
  'thriller_mystery', 'nonfiction', 'classic', 'contemporary', 'dark',
  'uplifting', 'fast_paced', 'slow_burn', 'worldbuilding', 'character_driven',
  'idea_driven', 'accessible', 'complex',
] as const;

export type TasteTrait = (typeof TASTE_TRAITS)[number];
export type TasteVector = Record<TasteTrait, number>;

export const TRAIT_LABELS: Record<TasteTrait, string> = {
  fantasy: 'fantasy', science_fiction: 'science fiction', speculative: 'speculative ideas',
  literary: 'literary writing', romance: 'relationship-driven stories',
  thriller_mystery: 'thrillers and mysteries', nonfiction: 'nonfiction',
  classic: 'classic literature', contemporary: 'contemporary stories',
  dark: 'darker stories', uplifting: 'hopeful stories', fast_paced: 'fast-paced plots',
  slow_burn: 'slow-burn storytelling', worldbuilding: 'immersive worlds',
  character_driven: 'character-focused stories', idea_driven: 'thought-provoking ideas',
  accessible: 'accessible storytelling', complex: 'complex narratives',
};

export function emptyTasteVector(): TasteVector {
  return Object.fromEntries(TASTE_TRAITS.map((trait) => [trait, 0])) as TasteVector;
}

export function tasteVector(values: Partial<TasteVector>): TasteVector {
  const vector = emptyTasteVector();
  for (const trait of TASTE_TRAITS) {
    const value = values[trait];
    vector[trait] = Number.isFinite(value) ? Number(value) : 0;
  }
  return vector;
}

export function normalizeTasteVector(vector: TasteVector): TasteVector {
  const magnitude = Math.sqrt(TASTE_TRAITS.reduce((sum, trait) => sum + vector[trait] ** 2, 0));
  if (magnitude === 0) return emptyTasteVector();
  return tasteVector(Object.fromEntries(TASTE_TRAITS.map((trait) => [trait, vector[trait] / magnitude])));
}

export function cosineTasteSimilarity(left: TasteVector, right: TasteVector): number {
  const leftMagnitude = Math.sqrt(TASTE_TRAITS.reduce((sum, trait) => sum + left[trait] ** 2, 0));
  const rightMagnitude = Math.sqrt(TASTE_TRAITS.reduce((sum, trait) => sum + right[trait] ** 2, 0));
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  const dot = TASTE_TRAITS.reduce((sum, trait) => sum + left[trait] * right[trait], 0);
  return Math.max(-1, Math.min(1, dot / (leftMagnitude * rightMagnitude)));
}
