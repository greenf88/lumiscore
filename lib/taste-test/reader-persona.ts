import type { RatingResultProfile } from './rating-result.ts';
import { topSupportedAffinities } from './result-presentation.ts';
import { GENRE_TRAITS } from './profile-policy.ts';
import type { Locale } from '../i18n/config.ts';

const portraits = {
  hobbit: ['Jij bent een echte hobbit', 'A true hobbit at heart', 'Een boek open, de wijde wereld in. Jouw avontuur begint tussen de bladzijden.', 'Open a book and step into another world. Your adventure starts between the pages.'],
  hannibal: ['Rustig aan, Hannibal', 'Easy there, Hannibal', 'Een duister verhaal, een raadsel en nog één hoofdstuk. Jij leest graag op het puntje van je stoel.', 'A dark story, a mystery and just one more chapter. You like reading on the edge of your seat.'],
  sleuth: ['Niets ontgaat jou, speurneus', 'Nothing gets past you, detective', 'Jij volgt de aanwijzingen. Het antwoord wacht vast in het volgende hoofdstuk.', 'You follow the clues. The answer must be in the next chapter.'],
  cosmic: ['Jouw verbeelding kent geen zwaartekracht', 'Your imagination defies gravity', 'Nieuwe werelden en grote ideeën: jij leest graag voorbij de horizon.', 'New worlds and big ideas: you like reading beyond the horizon.'],
  romantic: ['Jij leest met je hart', 'You read with your heart', 'Jij blijft voor de mensen, hun verlangens en alles wat hen bij elkaar brengt.', 'You stay for the people, their hopes and everything that brings them together.'],
  scholar: ['Nieuwsgierig? Jij noemt het lezen', 'Curiosity is your superpower', 'Een goed boek opent voor jou niet alleen een verhaal, maar ook een nieuw inzicht.', 'A good book opens up more than a story: it gives you a new way of seeing.'],
  storyweaver: ['Jij verzamelt andere levens', 'You collect other lives', 'Jij duikt in verhalen en komt boven met een nieuw perspectief.', 'You dive into stories and emerge with a new perspective.'],
} as const;

/** A playful reading character, never a personality diagnosis or random label.
 * Selection uses the same positive-evidence gates as the visible preference bars. */
export function readerPersona(profile: RatingResultProfile, locale: Locale) {
  const supported = topSupportedAffinities(profile);
  if (!supported.length) return null;
  const genre = supported.find(x => GENRE_TRAITS.has(x.trait))?.trait;
  const dark = supported.some(x => x.trait === 'dark');
  const id = genre === 'fantasy' ? 'hobbit' : genre === 'science_fiction' ? 'cosmic'
    : genre === 'thriller_mystery' ? dark ? 'hannibal' : 'sleuth'
    : genre === 'romance' ? 'romantic' : genre === 'nonfiction' ? 'scholar' : 'storyweaver';
  const words = portraits[id], nl = locale === 'nl';
  return { id, title: words[nl ? 0 : 1], description: words[nl ? 2 : 3],
    image: `/images/reading-personas/${id}.jpg` };
}
