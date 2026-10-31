import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBookDescription} from './description-text.ts';
test('complete saved edition pagination/Lexile stubs are not synopses',()=>{
 for(const text of ['242 pages ; 22 cmHL620L Lexile','416 pages ; 21 cm720L Lexile','105 p. : ill. ; 20 cm.780L Lexile','89 pages : illustrations ; 21 cm.810L Lexile','345 pages ; 21 cm890L Lexile; Ages 12 and up.','xii, 336 pages : illustrations ; 22 cm820L Lexile','83 pages : illustrations, map ; 20 cm.650L Lexile; 650L Lexile','1 v. (unpaged) : col. ill. ; 22 x 27 cm.AD390L Lexile; AD390L Lexile','xii, 383 pages ; 24 cm.790L Lexile','First United States edition.\n\nIncludes bibliographical references and index.\n\nPublished November 7, 2023\n\nReprinted Three Times\n\nFifth Printing, October 2024'])assert.equal(normalizeBookDescription(text),null,text);
});
test('bibliographic words inside substantive story prose remain intact',()=>{
 for(const text of ['The missing pages of a diary lead a young reader into an investigation of her family history.','In this first edition of his memoir, a teacher recounts how his village rebuilt its school.','242 pages ; 22 cm.\n\nA child escapes an occupied town and must find someone who can shelter him.'])assert.equal(normalizeBookDescription(text),text);
});
