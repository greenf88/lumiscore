import type { TasteTrait } from './traits.ts';

// Evidence gates, not claims of predictive accuracy or human validation.
export const PROFILE_POLICY = {
  minimumTraitConfidence: .6,
  ratingPriorMass: 3,
  minimumPreferenceSupport: 3,
  minimumPositiveSupport: 3,
  minimumPreferenceScore: 60,
  minimumArchetypeContentWorks: 5,
  minimumContentCoverage: .5,
  highContentWorks: 10,
  highHybridContentWorks: 5,
  minimumGuestChoices: 5,
  mediumGuestAnswered: 7,
  mediumGuestSelected: 3,
} as const;
export const ERA_TRAITS = new Set<TasteTrait>(['classic', 'contemporary']);
export const GENRE_TRAITS = new Set<TasteTrait>(['fantasy','science_fiction','literary','romance','thriller_mystery','nonfiction']);
export const ARCHETYPE_TRAITS = {fantasy:'worldbuilder',thriller_mystery:'sleuth',science_fiction:'explorer',romance:'connector'} as const;
