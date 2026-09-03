#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const db = JSON.parse(fs.readFileSync(path.join(DIR, 'card_database.json'), 'utf8'));

const BANNED = [
  /\bplaneswalker\b/i,
  /\btrample\b/i,
  /\bphasing\b/i,
  /\bmana dork\b/i,
  /\bdominaria\b/i,
  /\bphyrexia\b/i,
  /\bzendikar\b/i,
  /\bravnica\b/i,
  /\binnistrad\b/i,
  /\bkamigawa\b/i
];

let pass = 0, fail = 0, warn = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS ' + name);
  } else {
    fail++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}
function note(name, detail) {
  warn++;
  console.log('WARN ' + name + (detail ? ' — ' + detail : ''));
}

const authored = db.filter(c => c.type !== 'Land' && (c.text || c.flavor));
const withText = authored.filter(c => c.text);
const withFlavor = authored.filter(c => c.flavor);

check('I1 authored non-land have at least one of text/flavor', authored.length > 0);

const bannedHits = [];
for (const c of authored) {
  const blob = ((c.text || '') + ' ' + (c.flavor || ''));
  for (const re of BANNED) {
    if (re.test(blob)) bannedHits.push(c.id + ':' + re);
  }
}
check('I2 no banned existing-game vocabulary', bannedHits.length === 0, bannedHits.slice(0, 8).join(', '));

const creatureHits = withText.filter(c => /\bcreature\b/i.test(c.text)).map(c => c.id);
check('I3 rules text does not say creature', creatureHits.length === 0, creatureHits.join(', '));

const emptyFlavor = withFlavor.filter(c => !String(c.flavor).trim());
check('I4 flavor strings are non-empty', emptyFlavor.length === 0, emptyFlavor.map(c => c.id).join(', '));

const longFlavor = [];
const shortFlavor = [];
for (const c of withFlavor) {
  const n = String(c.flavor).trim().split(/\s+/).filter(Boolean).length;
  if (n > 16) longFlavor.push(c.id + ':' + n + 'w');
  if (n < 4) shortFlavor.push(c.id + ':' + n + 'w');
}
if (longFlavor.length) note('I5 flavor over 16 words (tentative cap)', longFlavor.slice(0, 12).join(', ') + (longFlavor.length > 12 ? ' …+' + (longFlavor.length - 12) : ''));
else check('I5 flavor within 16-word cap', true);
if (shortFlavor.length) note('I6 flavor under 4 words (tentative floor)', shortFlavor.slice(0, 12).join(', '));
else check('I6 flavor at least 4 words', true);

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed, ' + warn + ' warned.');
if (fail > 0) {
  console.log('IDENTITY VALIDATION FAILED');
  process.exit(1);
}
console.log('IDENTITY VALIDATION PASSED');
