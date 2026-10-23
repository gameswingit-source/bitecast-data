// Washington Department of Fish and Wildlife: every fish release (data.wa.gov dataset 6fex-3r7d):
// trout, kokanee, salmon and steelhead, with the hatchery, life stage and numbers, for this year so
// far. Hatchery salmon releases into rivers are kept, since anglers follow those runs too.

import { getJson, item, title } from '../lib.mjs';

export const kind = 'reports';
export const source = 'https://data.wa.gov/d/6fex-3r7d';

const STAGE = { Legals: 'catchable size', Fry: 'fry', Fingerling: 'fingerlings', Yearling: 'yearlings', Zero: 'young of the year', Adult: 'adults' };

export async function collect() {
  // This year so far (and the last 60 days, so early January still shows December).
  const since = [`${new Date().getFullYear()}-01-01`, new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)].sort()[0];
  const rows = await getJson(`https://data.wa.gov/resource/6fex-3r7d.json?$limit=20000&$where=release_start_date>='${since}'&$order=release_start_date DESC`);
  return rows
    .filter((r) => r.release_location && r.release_start_date && r.species)
    .map((r) => {
      // "LANGLOIS LK (KING)": the water, then its county in parentheses.
      const loc = String(r.release_location).replace(/\s*\([^)]*\)\s*$/, '').replace(/\bLK\b/g, 'Lake').replace(/\bCR\b/g, 'Creek').replace(/\bR\b/g, 'River');
      return item('WA', {
        water: title(loc), county: String(r.county ?? '').trim(), date: String(r.release_start_date).slice(0, 10), when: 'day',
        species: [r.species], count: +r.number_released || undefined,
        detail: [STAGE[r.lifestage] ?? (r.lifestage || '').toLowerCase(), r.facility && `from ${title(r.facility)}`].filter(Boolean).join(' · ') || undefined,
      });
    });
}
