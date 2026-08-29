const fs = require('fs');
const path = require('path');

const dir = __dirname;
const projectRoot = path.resolve(dir, '..');
const candidates = [];
for (let i = 1; i <= 6; i++) {
  candidates.push(path.join(dir, 'batch_0' + i + '.json'));
  candidates.push(path.join(dir, 'batch0' + i + '.json'));
  candidates.push(path.join(projectRoot, 'batch_0' + i + '.json'));
  candidates.push(path.join(projectRoot, 'batch0' + i + '.json'));
}

let allCards = [];
const missing = [];

for (let i = 1; i <= 6; i++) {
  let fp;
  for (const p of candidates.filter(p => p.endsWith('batch0' + i + '.json') || p.endsWith('batch_0' + i + '.json'))) {
    if (fs.existsSync(p)) { fp = p; break; }
  }
  if (!fp) {
    missing.push('batch0' + i + '.json');
    continue;
  }
  const f = path.basename(fp);
  let data = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '').trim();
  let arr;
  try {
    arr = JSON.parse(data);
  } catch (e) {
    const open = data.indexOf('[');
    const close = data.lastIndexOf(']');
    if (open === -1 || close === -1 || close < open) {
      console.error('PARSE ERROR in ' + f + ' (no JSON array found): ' + e.message);
      continue;
    }
    try {
      arr = JSON.parse(data.slice(open, close + 1));
      console.log(f + ': recovered array from surrounding text (fences/prose stripped)');
    } catch (e2) {
      console.error('PARSE ERROR in ' + f + ': ' + e2.message);
      continue;
    }
  }
  if (!Array.isArray(arr)) {
    console.error(f + ' parsed but is not a JSON array');
    continue;
  }
  allCards = allCards.concat(arr);
  console.log(f + ': ' + arr.length + ' cards OK');
}

if (missing.length) {
  console.error('MISSING files (run these batches in Gemini first): ' + missing.join(', '));
}

const expected = 120;
const ids = allCards.map(c => c.id);
const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
const uniqueIds = new Set(ids).size;

console.log('---');
console.log('Total cards parsed: ' + allCards.length + ' / ' + expected);
console.log('Unique IDs: ' + uniqueIds);
if (dupes.length) console.log('DUPLICATE IDs: ' + dupes.join(', '));
const missingIds = [];
for (let i = 1001; i <= 1120; i++) if (!ids.includes(i)) missingIds.push(i);
if (missingIds.length) console.log('MISSING IDs: ' + missingIds.join(', '));

if (allCards.length === expected && uniqueIds === expected && missingIds.length === 0) {
  fs.writeFileSync(path.join(dir, 'mapped_cards.json'), JSON.stringify(allCards, null, 2));
  console.log('WROTE mapped_cards.json — all 120 cards accounted for.');
} else {
  console.log('NOT writing mapped_cards.json until all 120 cards are present and unique.');
  process.exit(1);
}
