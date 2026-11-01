import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceDescriptionLocale } from './description-language.ts';

export const EN_COPY = 'A young reader discovers that the story of her family is not what she expected. With the help of a friend, she follows the clues through the city while the people around her try to keep their secrets. She must decide who she can trust and what the truth will mean for her future.';
export const NL_COPY = 'Een jonge lezer ontdekt dat het verhaal van haar familie anders is dan zij dacht. Met de hulp van een vriend volgt zij de aanwijzingen door de stad, terwijl de mensen om haar heen hun geheimen proberen te bewaren. Zij moet beslissen wie zij kan vertrouwen en wat de waarheid voor haar toekomst betekent.';

test('summary text language is independent from the edition, title and author', () => {
  assert.equal(sourceDescriptionLocale(EN_COPY), 'en');
  assert.equal(sourceDescriptionLocale(NL_COPY), 'nl');
  assert.equal(sourceDescriptionLocale('Play to be broadcast on the radio.'), null);
  assert.equal(sourceDescriptionLocale('Nederlandse tekst.'), null);
  assert.equal(sourceDescriptionLocale('The The The The The The The The The The The The'), null);
  assert.equal(sourceDescriptionLocale(EN_COPY + NL_COPY), null);
  assert.equal(sourceDescriptionLocale('Ein junger Mann entdeckt die Geschichte seiner Familie und sucht in der Stadt nach einer Antwort auf seine Fragen.'), null);
});
