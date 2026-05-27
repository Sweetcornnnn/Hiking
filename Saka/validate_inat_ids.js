const fs = require('fs');
const path = require('path');
const files = [
  { path: path.join(__dirname, 'src', 'data', 'curatedSpecies.ts'), label: 'app' },
  { path: path.join(__dirname, '..', 'SakaSaLikod', 'saka.ts'), label: 'backend' },
];
const regex = /scientific_name:\s*'([^']+)'[\s\S]*?inaturalist_id:\s*(\d+)/g;

async function searchTaxon(name) {
  const res = await fetch('https://api.inaturalist.org/v1/taxa?q=' + encodeURIComponent(name) + '&per_page=3');
  return res.json();
}

async function getTaxonById(id) {
  const res = await fetch('https://api.inaturalist.org/v1/taxa/' + id);
  return res.json();
}

(async () => {
  for (const f of files) {
    const text = fs.readFileSync(f.path, 'utf8');
    const entries = [];
    let m;
    while ((m = regex.exec(text))) {
      entries.push({ name: m[1], id: Number(m[2]) });
    }
    console.log('FILE', f.label, f.path, 'entries', entries.length);
    for (const e of entries) {
      const searchData = await searchTaxon(e.name);
      const top = searchData.results?.[0];
      const topId = top?.id || 'none';
      const topName = top?.name || 'none';
      const topCommon = top?.preferred_common_name || '';
      const topRank = top?.rank || '';

      const idData = await getTaxonById(e.id);
      const idTaxon = idData.results?.[0];
      const idName = idTaxon?.name || 'none';
      const idCommon = idTaxon?.preferred_common_name || '';
      const idRank = idTaxon?.rank || '';
      const idCorrect = idTaxon && (idName.toLowerCase() === e.name.toLowerCase() || idCommon.toLowerCase() === e.name.toLowerCase());

      const searchOk = topId === e.id;
      const idOk = !!idCorrect;
      console.log(
        idOk ? 'ID-OK' : 'ID-BAD',
        e.name,
        'seed', e.id,
        'taxon', idName,
        idCommon ? `(${idCommon})` : '',
        idRank || '',
        '| top', topId,
        topName,
        topCommon ? `(${topCommon})` : '',
        topRank || '',
        '| searchMatch', searchOk ? 'yes' : 'no'
      );
    }
  }
})();
