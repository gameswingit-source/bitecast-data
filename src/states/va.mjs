// Virginia DWR: the trout stocking schedule (dwr.virginia.gov). Stockings are posted as they happen
// and the coming month's are announced ahead, so this reads 30 days back to 6 weeks ahead.

import { getText, item, ymd } from '../lib.mjs';
import { cells, rows, tables } from '../html.mjs';

export const kind = 'reports';
export const source = 'https://dwr.virginia.gov/fishing/trout-stocking-schedule/';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const iso = (d) => d.toISOString().slice(0, 10);

export async function collect() {
  const from = iso(new Date(Date.now() - 30 * 864e5));
  const to = iso(new Date(Date.now() + 42 * 864e5));
  const html = await getText(`${source}?start_date=${from}&end_date=${to}`);
  const table = tables(html).find((t) => /date_stocked/.test(t));
  if (!table) throw new Error('Virginia stocking table not found');
  const out = [];
  for (const r of rows(table)) {
    const [date, locality, waterbody, category, species] = cells(r);
    const m = String(date ?? '').match(/([A-Za-z]+) (\d{1,2}), (\d{4})/);
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (!waterbody || month < 0) continue;
    const [water, note] = waterbody.split(/\s*\[/);
    out.push(item('VA', {
      water: water.trim(),
      // Virginia lists counties and independent cities; county centres place the stocking.
      county: String(locality ?? '').replace(/\s+County$/i, ''),
      date: ymd(m[3], month + 1, m[2]),
      when: 'day',
      species: String(species ?? '').split(';').map((s) => s.replace(/ Trout$/i, '').trim()).filter(Boolean),
      detail: [note && note.replace(/\]\s*$/, '').trim(), category ? `Category ${category}` : ''].filter(Boolean).join(' · ') || undefined,
    }));
  }
  return out;
}
