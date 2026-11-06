// Sestaví web/flowers.js z návrhů květin v této složce.
// Pojmenování souborů: <druh>-<fáze>.svg (tulipan-1.svg) nebo s barevnou variantou
// <druh>-<varianta>-<fáze>.svg (tulipan-zluty-1.svg).
// Každý návrh má plátno 960×960 a rostlina stojí na zemi v bodě (480, 805).
// Spuštění (ve složce web):  node kvetiny/sestav.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const KIND = { tulipan: 'tulip', kopretina: 'daisy', slunecnice: 'sunflower', levandule: 'lavender', strom: 'tree', kvitek: 'dot' };

const art = {};
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
  const m = file.match(/^([a-z]+)(?:-([a-z]+))?-(\d)\.svg$/);
  if (!m || !KIND[m[1]]) { console.warn('přeskakuji', file); continue; }
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const inner = src
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\s+id=("[^"]*"|'[^']*')/g, '') // v zahradě je každá rostlina víckrát, id by se opakovala
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*\n\s*/g, '')
    .trim();
  if (/<script|on[a-z]+=|href=|<image/i.test(inner)) throw new Error(`${file}: návrh smí obsahovat jen tvary`);
  const key = m[2] ? `${KIND[m[1]]}:${m[2]}` : KIND[m[1]];
  (art[key] ||= [])[Number(m[3]) - 1] = inner;
}

const out = `// VYGENEROVÁNO z web/kvetiny/*.svg (node kvetiny/sestav.js). Neupravovat ručně.
window.FLOWER_ART = ${JSON.stringify(art, null, 0)};
`;
fs.writeFileSync(path.join(dir, '..', 'flowers.js'), out);
console.log('flowers.js:', Object.entries(art).map(([k, v]) => `${k} ${v.filter(Boolean).length} fáze`).join(', '));
