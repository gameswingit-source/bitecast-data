// Vermont Fish & Wildlife: the fish stocking plan (anrweb.vt.gov). The trophy trout streams are
// planned by week; Vermont lists towns rather than counties, so towns are placed with Census data.

import { getText, item, townPoint } from '../lib.mjs';
import { cells, rows, tables } from '../html.mjs';

export const kind = 'planned';
export const source = 'https://anrweb.vt.gov/FWD/FW/FishStockingSchedule.aspx';

export async function collect() {
  const html = await getText(source);
  const year = +(html.match(/\b(20\d\d)\b[^<]{0,40}(?:stocking|plan)/i)?.[1] ?? new Date().getFullYear());
  const table = tables(html).find((t) => /Week of/i.test(t));
  if (!table) throw new Error('Vermont trophy trout table not found');
  const [head, ...body] = rows(table).map(cells);
  const speciesCols = head.map((h, i) => [i, h]).filter(([, h]) => /rainbow|brown|brook|tiger|trout/i.test(h) && !/total/i.test(h));
  const out = [];
  for (const r of body) {
    const [water, town, weeks] = r;
    if (!water || !weeks) continue;
    const species = speciesCols.filter(([i]) => +String(r[i]).replace(/,/g, '') > 0).map(([, h]) => h.replace(/^2YR\s*/i, '').replace(/ Trout$/i, ''));
    const p = await townPoint('VT', String(town).split(/[-,/]/)[0].trim());
    for (const w of weeks.matchAll(/(\d{1,2})\/(\d{1,2})/g)) {
      out.push(item('VT', {
        water, county: '', date: `${year}-${w[1].padStart(2, '0')}-${w[2].padStart(2, '0')}`, when: 'week', species,
        detail: `Trophy trout · Town of ${town}`, lat: p?.[0], lon: p?.[1],
      }));
    }
  }
  // Town points are approximate (the town centre), like county centres elsewhere.
  for (const i of out) if (i.lat != null) i.approx = true;
  return out;
}
