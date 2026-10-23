// Utah Division of Wildlife Resources: the fish stocking report (dwrapps.utah.gov), every species
// stocked this year with the water, county, count, average length and date.

import { getText, item, title, ymd } from '../lib.mjs';
import { cells, rows, tables } from '../html.mjs';

export const kind = 'reports';
export const source = 'https://dwrapps.utah.gov/fishstocking/Fish';

export async function collect() {
  const html = await getText(source);
  const table = tables(html).find((t) => /Date stocked/i.test(t));
  if (!table) throw new Error('Utah stocking table not found');
  const out = [];
  for (const r of rows(table).slice(1)) {
    const [water, county, species, quantity, length, date] = cells(r);
    const m = String(date ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!water || !m) continue;
    const inches = parseFloat(length);
    out.push(item('UT', {
      water: title(water), county: title(county), date: ymd(m[3], m[1], m[2]), when: 'day', species: [species],
      count: parseInt(String(quantity).replace(/,/g, ''), 10) || undefined,
      detail: inches ? `Average ${inches.toFixed(1)} in${inches >= 8 ? ' (catchable)' : ''}` : undefined,
    }));
  }
  return out;
}
