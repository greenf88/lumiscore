import { tasteVector, type TasteVector } from './traits.ts';

export const TASTE_TEST_VERSION = 'taste_test_v1';
export type TasteTestChoice = 'left' | 'right' | 'neither';
export type TasteTestAnchor = { workId: string; title: string; author: string; traits: TasteVector; seriesKey?: string };

function anchor(workId: string, title: string, author: string, traits: Partial<TasteVector>, seriesKey?: string): TasteTestAnchor {
  return { workId, title, author, traits: tasteVector(traits), seriesKey };
}

export const TASTE_TEST_ANCHORS: Record<string, TasteTestAnchor> = {
  '1': anchor('1', 'Project Hail Mary', 'Andy Weir', { science_fiction: 1, speculative: .8, fast_paced: .8, idea_driven: .9, accessible: .75, worldbuilding: .45 }),
  '3': anchor('3', 'Pride and Prejudice', 'Jane Austen', { classic: 1, literary: .85, romance: .8, character_driven: .9, slow_burn: .55, complex: .45 }),
  '6': anchor('6', 'The Hobbit', 'J.R.R. Tolkien', { fantasy: 1, classic: .8, worldbuilding: .9, accessible: .75, uplifting: .55, fast_paced: .55 }, 'middle-earth'),
  '7': anchor('7', 'The Lord of the Rings', 'J.R.R. Tolkien', { fantasy: 1, classic: .85, speculative: .7, worldbuilding: 1, slow_burn: .7, complex: .8 }, 'middle-earth'),
  '8': anchor('8', 'Dune', 'Frank Herbert', { science_fiction: 1, speculative: 1, worldbuilding: 1, complex: .9, idea_driven: .85, slow_burn: .55, dark: .45 }, 'dune'),
  '13': anchor('13', 'The Alchemist', 'Paulo Coelho', { literary: .5, speculative: .45, uplifting: 1, idea_driven: .75, accessible: .9, character_driven: .45 }),
  '36': anchor('36', 'The Catcher in the Rye', 'J. D. Salinger', { classic: .9, literary: 1, character_driven: 1, slow_burn: .65, dark: .35, accessible: .65 }),
  '40': anchor('40', 'Crime and Punishment', 'Fyodor Dostoevsky', { classic: 1, literary: 1, dark: 1, slow_burn: .85, character_driven: .9, idea_driven: .85, complex: .9 }),
  '48': anchor('48', 'The Girl with the Dragon Tattoo', 'Stieg Larsson', { thriller_mystery: 1, contemporary: .8, dark: .9, fast_paced: .75, complex: .55, character_driven: .65 }),
  '49': anchor('49', 'Gone Girl', 'Gillian Flynn', { thriller_mystery: 1, contemporary: 1, dark: .95, fast_paced: .75, character_driven: .8, complex: .55 }),
  '50': anchor('50', 'The Da Vinci Code', 'Dan Brown', { thriller_mystery: .9, contemporary: .75, fast_paced: 1, accessible: .9, idea_driven: .5 }),
  '53': anchor('53', 'And Then There Were None', 'Agatha Christie', { thriller_mystery: 1, classic: .9, dark: .7, fast_paced: .75, accessible: .8, idea_driven: .35 }),
  '78': anchor('78', 'Sapiens', 'Yuval Noah Harari', { nonfiction: 1, contemporary: .8, idea_driven: 1, accessible: .65, complex: .65 }),
  '82': anchor('82', 'Educated', 'Tara Westover', { nonfiction: 1, contemporary: 1, character_driven: 1, literary: .6, dark: .55, uplifting: .55, accessible: .75 }),
  '102': anchor('102', 'The Hunger Games', 'Suzanne Collins', { science_fiction: .6, speculative: 1, contemporary: .8, dark: .65, fast_paced: 1, accessible: .95, character_driven: .65, worldbuilding: .65 }, 'the-hunger-games'),
  '104': anchor('104', 'The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid', { contemporary: 1, literary: .55, romance: .75, character_driven: 1, accessible: .85, uplifting: .35, dark: .35 }),
  '105': anchor('105', 'Normal People', 'Sally Rooney', { contemporary: 1, literary: .9, romance: .65, character_driven: 1, slow_burn: .7, dark: .35, accessible: .65 }),
  '107': anchor('107', 'Atomic Habits', 'James Clear', { nonfiction: 1, contemporary: 1, idea_driven: .75, accessible: 1, uplifting: .7, fast_paced: .5 }),
  '113': anchor('113', 'The Midnight Library', 'Matt Haig', { contemporary: 1, speculative: .75, literary: .55, uplifting: .75, character_driven: .8, accessible: .85, dark: .35 }),
  '143': anchor('143', 'Eragon', 'Christopher Paolini', { fantasy: 1, speculative: .7, worldbuilding: .9, fast_paced: .75, accessible: .9, character_driven: .65 }, 'inheritance-cycle'),
};

export const TASTE_TEST_QUESTIONS = [
  { key: 'fantasy-or-science-fiction', leftWorkId: '143', rightWorkId: '8' },
  { key: 'worldbuilding-or-literary-realism', leftWorkId: '7', rightWorkId: '36' },
  { key: 'dark-thriller-or-classic-romance', leftWorkId: '49', rightWorkId: '3' },
  { key: 'speculative-action-or-uplifting-fable', leftWorkId: '102', rightWorkId: '13' },
  { key: 'idea-driven-or-character-driven', leftWorkId: '1', rightWorkId: '105' },
  { key: 'crime-thriller-or-romantic-drama', leftWorkId: '48', rightWorkId: '104' },
  { key: 'practical-or-big-picture-nonfiction', leftWorkId: '107', rightWorkId: '78' },
  { key: 'classic-mystery-or-modern-speculative', leftWorkId: '53', rightWorkId: '113' },
  { key: 'complex-classic-or-accessible-thriller', leftWorkId: '40', rightWorkId: '50' },
  { key: 'memoir-or-classic-fantasy', leftWorkId: '82', rightWorkId: '6' },
] as const;

export type TasteTestQuestionKey = (typeof TASTE_TEST_QUESTIONS)[number]['key'];
export type TasteTestAnswers = Partial<Record<TasteTestQuestionKey, TasteTestChoice>>;
export const TASTE_TEST_WORK_IDS = [...new Set(TASTE_TEST_QUESTIONS.flatMap(({ leftWorkId, rightWorkId }) => [leftWorkId, rightWorkId]))];

export function isTasteTestChoice(value: unknown): value is TasteTestChoice {
  return value === 'left' || value === 'right' || value === 'neither';
}

export function isTasteTestQuestionKey(value: unknown): value is TasteTestQuestionKey {
  return TASTE_TEST_QUESTIONS.some(({ key }) => key === value);
}
