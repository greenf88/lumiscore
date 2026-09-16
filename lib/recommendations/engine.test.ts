import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { TASTE_TEST_WORK_IDS } from '../taste-test/config.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import {
  calculatePersonalMatch,
  calculateDisplayedMatchScore,
  calculateMatchConfidence,
  calculateQualityPrior,
  getMatchPresentation,
  recommendBooks,
  type RecommendationCandidate,
} from './engine.ts';
import { getTopTraitOverlaps } from './explanations.ts';

function candidate(workId: string, title: string, author: string, traits: Parameters<typeof tasteVector>[0], score: number | null = null, ratingsCount = 0): RecommendationCandidate {
  const book: Book = { id: `work-${workId}`, source: 'supabase', workId, title, author, score, ratingsCount, match: null, cover: 'orbit' };
  return { book, traits: tasteVector(traits), metadataConfidence: .9, coverageLevel: 'rich' };
}

const duneProfile = buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, []);

test('already-rated books are excluded', () => {
  const results = recommendBooks({ candidates: [candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 })], profile: duneProfile, ratedWorkIds: new Set(['8']) });
  assert.deepEqual(results, []);
});

test('a Taste Test anchor is excluded even when it has the highest raw similarity', () => {
  const anchor = candidate('102', 'The Hunger Games', 'Suzanne Collins', {
    science_fiction: 1,
    speculative: 1,
    fast_paced: 1,
  });
  const remaining = candidate('9001', 'A Different Future', 'Other Author', {
    science_fiction: .5,
    romance: 1,
  });
  const baseline = recommendBooks({
    candidates: [anchor, remaining],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  const filtered = recommendBooks({
    candidates: [anchor, remaining],
    profile: duneProfile,
    ratedWorkIds: new Set(),
    excludedWorkIds: new Set(TASTE_TEST_WORK_IDS),
  });

  assert.equal(baseline[0].book.workId, '102');
  assert.ok(baseline[0].personalMatch > baseline[1].personalMatch);
  assert.deepEqual(filtered.map(({ book }) => book.workId), ['9001']);
});

test('both selected and unselected Taste Test choices are excluded', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'left' }, []);
  const results = recommendBooks({
    candidates: [
      candidate('143', 'Eragon', 'Christopher Paolini', { fantasy: 1 }),
      candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 }),
      candidate('9002', 'Outside the Test', 'Other Author', { fantasy: .8 }),
    ],
    profile,
    ratedWorkIds: new Set(),
    excludedWorkIds: new Set(TASTE_TEST_WORK_IDS),
  });

  assert.deepEqual(results.map(({ book }) => book.workId), ['9002']);
});

test('answering neither does not make either Taste Test choice recommendable', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'neither' }, []);
  const results = recommendBooks({
    candidates: [
      candidate('143', 'Eragon', 'Christopher Paolini', { fantasy: 1 }),
      candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 }),
      candidate('9003', 'Outside the Test', 'Other Author', { literary: 1 }),
    ],
    profile,
    ratedWorkIds: new Set(),
    excludedWorkIds: new Set(TASTE_TEST_WORK_IDS),
  });

  assert.deepEqual(results.map(({ book }) => book.workId), ['9003']);
});

test('Taste Test exclusions leave non-anchor scoring and ranking unchanged', () => {
  const candidates = [
    candidate('9010', 'First', 'A', { science_fiction: 1, worldbuilding: 1 }, 8, 20),
    candidate('9011', 'Second', 'B', { science_fiction: .8, idea_driven: 1 }, 7, 10),
    candidate('9012', 'Third', 'C', { romance: 1 }, 9, 30),
  ];
  const input = { candidates, profile: duneProfile, ratedWorkIds: new Set<string>(), limit: 3 };

  assert.deepEqual(
    recommendBooks(input),
    recommendBooks({ ...input, excludedWorkIds: new Set(TASTE_TEST_WORK_IDS) }),
  );
});

test('recommendation limit is filled after Taste Test works are excluded', () => {
  const tasteTestWorkIds = new Set<string>(TASTE_TEST_WORK_IDS);
  const remaining = Array.from({ length: 12 }, (_, index) => candidate(
    String(9100 + index),
    `Remaining ${index + 1}`,
    `Author ${index + 1}`,
    { science_fiction: 1, worldbuilding: 1 - index / 20 },
  ));
  const results = recommendBooks({
    candidates: [
      candidate('1', 'Project Hail Mary', 'Andy Weir', { science_fiction: 1 }),
      candidate('102', 'The Hunger Games', 'Suzanne Collins', { science_fiction: 1 }),
      ...remaining,
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
    excludedWorkIds: tasteTestWorkIds,
    limit: 10,
  });

  assert.equal(results.length, 10);
  assert.ok(results.every(({ book }) => !tasteTestWorkIds.has(book.workId!)));
});

test('a stronger profile match ranks above a weaker match', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'Space', 'A', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'Romance', 'B', { romance: 1 }),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  assert.equal(results[0].book.workId, '1');
});

test('unrated candidates receive a neutral quality prior', () => {
  assert.equal(calculateQualityPrior(null, 0), .55);
  assert.ok(calculateQualityPrior(10, 1) < .7);
});

test('one global ten does not dominate a much stronger personal match', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'Strong match', 'A', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'Weak global hit', 'B', { romance: 1 }, 10, 1),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  assert.equal(results[0].book.title, 'Strong match');
});

test('recommendations and match percentages are deterministic', () => {
  const input = {
    candidates: [candidate('10', 'A', 'A', { speculative: 1 }), candidate('11', 'B', 'B', { science_fiction: 1 })],
    profile: duneProfile,
    ratedWorkIds: new Set<string>(),
  };
  assert.deepEqual(recommendBooks(input), recommendBooks(input));
});

test('era-only candidate has low match confidence and no precise score', () => {
  const result = recommendBooks({
    candidates: [{
      ...candidate('10', 'Old book', 'A', { classic: 1 }),
      metadataConfidence: .3,
      coverageLevel: 'era_only',
    }],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  })[0];
  assert.equal(result.matchConfidence, 'low');
  assert.equal(result.matchScore, null);
  assert.equal(result.matchLabel, 'Early match');
});

test('candidate and user evidence both influence match confidence', () => {
  assert.equal(calculateMatchConfidence({
    candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'HIGH',
  }), 'high');
  assert.equal(calculateMatchConfidence({
    candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'LOW',
  }), 'low');
});

test('only rich metadata plus sufficient user evidence receives an exact percentage', () => {
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'MEDIUM',
  }), { matchScore: 86, matchLabel: null, matchConfidence: 'medium' });
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'LOW',
  }), { matchScore: null, matchLabel: 'Strong match', matchConfidence: 'low' });
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }), { matchScore: null, matchLabel: 'Strong match', matchConfidence: 'medium' });
});

test('display calibration lifts credible midrange matches without reaching 100', () => {
  const mediumTopThree = [.55, .53, .51].map((personalSimilarity) =>
    calculateDisplayedMatchScore({
      personalSimilarity,
      userConfidence: 'MEDIUM',
    }));

  assert.deepEqual(mediumTopThree, [70, 68, 67]);
  assert.ok(mediumTopThree.every((score, index) =>
    index === 0 || mediumTopThree[index - 1] >= score));
  assert.equal(calculateDisplayedMatchScore({
    personalSimilarity: .55,
    userConfidence: 'HIGH',
  }), 71);
  assert.equal(calculateDisplayedMatchScore({
    personalSimilarity: 1,
    userConfidence: 'HIGH',
  }), 96);
  assert.equal(calculateDisplayedMatchScore({
    personalSimilarity: 0,
    userConfidence: 'HIGH',
  }), 0);
});

test('partial metadata uses deterministic qualitative match thresholds', () => {
  assert.equal(getMatchPresentation({
    personalSimilarity: .75, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Strong match');
  assert.equal(getMatchPresentation({
    personalSimilarity: .5, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Good match');
  assert.equal(getMatchPresentation({
    personalSimilarity: .49, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Possible match');
});

test('none coverage receives no user-facing match label', () => {
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .9, candidateCoverage: 'none', metadataConfidence: 0, userConfidence: 'HIGH',
  }), { matchScore: null, matchLabel: null, matchConfidence: 'low' });
});

test('zero trait overlap never receives a fabricated match indicator', () => {
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: 0, candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'HIGH',
  }), { matchScore: null, matchLabel: null, matchConfidence: 'high' });
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: 0, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'MEDIUM',
  }), { matchScore: null, matchLabel: null, matchConfidence: 'medium' });
  assert.equal(getMatchPresentation({
    personalSimilarity: 0, candidateCoverage: 'era_only', metadataConfidence: .4, userConfidence: 'LOW',
  }).matchLabel, 'Early match');
});

test('quality and exploration affect ranking but never inflate personal match', () => {
  const lowQuality = candidate('21', 'Low quality', 'A', { science_fiction: 1 }, 1, 100);
  const highQuality = candidate('22', 'High quality', 'B', { science_fiction: 1 }, 10, 100);
  const [first, second] = recommendBooks({
    candidates: [lowQuality, highQuality],
    profile: { ...duneProfile, confidence: 'MEDIUM' },
    ratedWorkIds: new Set(),
    limit: 2,
  });
  assert.equal(first.matchScore, second.matchScore);
  assert.notEqual(first.rankingScore, second.rankingScore);
  assert.equal(first.matchScore, calculateDisplayedMatchScore({
    personalSimilarity: first.personalMatch,
    userConfidence: 'MEDIUM',
  }));
  assert.notEqual(first.rankingScore, first.personalMatch);
});

test('displayed exact percentages remain monotonic after final ranking', () => {
  const profile = {
    ...duneProfile,
    vector: tasteVector({ science_fiction: 1 }),
    confidence: 'HIGH' as const,
  };
  const results = recommendBooks({
    candidates: [
      candidate('9300', 'Quality-supported match', 'A', {
        science_fiction: .9,
        romance: .4359,
      }, 10, 100),
      candidate('9301', 'Slightly closer match', 'B', {
        science_fiction: .95,
        romance: .3122,
      }, 1, 100),
    ],
    profile,
    ratedWorkIds: new Set(),
    limit: 2,
  });

  assert.equal(results[0].book.workId, '9300');
  assert.ok(results[0].personalMatch < results[1].personalMatch);
  assert.ok(results[0].matchScore! >= results[1].matchScore!);
});

test('diversity reranking avoids filling the first results with one author', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'A1', 'Same Author', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'A2', 'Same Author', { science_fiction: 1, worldbuilding: 1 }),
      candidate('3', 'Other', 'Other Author', { science_fiction: .9, idea_driven: .8 }),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
    limit: 2,
  });
  assert.equal(new Set(results.map(({ book }) => book.author)).size, 2);
});

test('explanations contain only meaningful traits that genuinely overlap', () => {
  const profile = {
    ...duneProfile,
    vector: tasteVector({
      science_fiction: 1,
      worldbuilding: .8,
      literary: .9,
    }),
  };
  const traits = tasteVector({
    science_fiction: 1,
    worldbuilding: .8,
    romance: 1,
  });
  const [result] = recommendBooks({
    candidates: [candidate('1', 'Space', 'A', traits)],
    profile,
    ratedWorkIds: new Set(),
  });
  const overlaps = getTopTraitOverlaps(profile.vector, traits);
  assert.deepEqual(overlaps.map(({ trait }) => trait), [
    'science_fiction',
    'worldbuilding',
  ]);
  assert.match(result.explanation, /science fiction/);
  assert.match(result.explanation, /immersive worlds/);
  assert.doesNotMatch(result.explanation, /relationship-driven|literary/);
});

test('recommendations fabricate no explanation when trustworthy overlap is absent', () => {
  const [result] = recommendBooks({
    candidates: [candidate('2', 'Romance', 'B', { romance: 1 })],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });

  assert.equal(result.personalMatch, 0);
  assert.equal(result.explanation, '');
});

test('insufficient candidate metadata suppresses explanations', () => {
  const result = recommendBooks({
    candidates: [{
      ...candidate('3', 'Thin evidence', 'C', { science_fiction: 1 }),
      metadataConfidence: .59,
      coverageLevel: 'partial',
    }],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  })[0];

  assert.equal(result.explanation, '');
});

test('Taste Test anchor identity has no ranking bonus', async () => {
  const base = candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 });
  const withoutSeries = recommendBooks({
    candidates: [base], profile: duneProfile, ratedWorkIds: new Set(),
  })[0];
  const withSeries = recommendBooks({
    candidates: [{ ...base, seriesKey: 'taste-test-anchor' }], profile: duneProfile, ratedWorkIds: new Set(),
  })[0];
  assert.equal(withoutSeries.rankingScore, withSeries.rankingScore);
  const engineSource = await readFile(new URL('./engine.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(engineSource, /TASTE_TEST_ANCHORS|anchorWorkIds/);
});

test('Taste Test-only evidence produces the same detail match as recommendation presentation', () => {
  const profile = buildTasteProfile({
    'fantasy-or-science-fiction': 'right',
    'worldbuilding-or-literary-realism': 'left',
    'speculative-action-or-uplifting-fable': 'left',
    'idea-driven-or-character-driven': 'left',
    'classic-mystery-or-modern-speculative': 'right',
  }, []);
  const detailCandidate = candidate('9901', 'Verified science fiction', 'A', {
    science_fiction: 1,
    speculative: .8,
    worldbuilding: .9,
    idea_driven: .8,
  });
  const detail = calculatePersonalMatch({
    profile,
    candidate: detailCandidate,
    workId: '9901',
    locale: 'en',
  });
  const recommendation = recommendBooks({
    candidates: [detailCandidate],
    profile,
    ratedWorkIds: new Set(),
    locale: 'en',
  })[0];

  assert.equal(profile.ratingCount, 0);
  assert.equal(profile.confidence, 'MEDIUM');
  assert.deepEqual(
    {
      matchScore: detail.matchScore,
      matchLabel: detail.matchLabel,
      matchConfidence: detail.matchConfidence,
      explanation: detail.explanation,
    },
    {
      matchScore: recommendation.matchScore,
      matchLabel: recommendation.matchLabel,
      matchConfidence: recommendation.matchConfidence,
      explanation: recommendation.explanation,
    },
  );
});

test('detail match explanation is localized and grounded in real overlap', () => {
  const profile = buildTasteProfile({
    'fantasy-or-science-fiction': 'right',
    'worldbuilding-or-literary-realism': 'left',
    'speculative-action-or-uplifting-fable': 'left',
    'idea-driven-or-character-driven': 'left',
    'classic-mystery-or-modern-speculative': 'right',
  }, []);
  const detailCandidate = candidate('9902', 'Werelden', 'A', {
    science_fiction: 1,
    worldbuilding: 1,
  });
  const english = calculatePersonalMatch({ profile, candidate: detailCandidate, workId: '9902', locale: 'en' });
  const dutch = calculatePersonalMatch({ profile, candidate: detailCandidate, workId: '9902', locale: 'nl' });

  assert.match(english.explanation, /science fiction|immersive worlds/);
  assert.match(dutch.explanation, /sciencefiction|meeslepende werelden/);
  assert.doesNotMatch(dutch.explanation, /romantiek|non-fictie/);
});

test('insufficient book metadata never fabricates a detail match', () => {
  const result = calculatePersonalMatch({
    profile: duneProfile,
    candidate: {
      traits: tasteVector({}),
      metadataConfidence: 0,
      coverageLevel: 'none',
    },
    workId: '9903',
    locale: 'en',
  });

  assert.equal(result.matchScore, null);
  assert.equal(result.matchLabel, null);
  assert.equal(result.explanation, '');
});
