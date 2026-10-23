// New York DEC: the current season's planned spring trout stocking (data.ny.gov, dataset d9y2-n436).
// Planned by month or week in words ("April - third week", "Mid May", "Spring"), not by day.

import { getJson, item, ymd } from '../lib.mjs';

export const kind = 'planned';
export const source = 'https://data.ny.gov/Recreation/Current-Season-Spring-Trout-Stocking/d9y2-n436';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ORD = { first: 1, second: 8, third: 15, fourth: 22, last: 22 };

/** "April - third week" -> the week of Apr 15; "Mid May" -> week of May 15; "Spring" -> April, season-long. */
function when(text, year) {
  const t = text.toLowerCase();
  const m = MONTHS.findIndex((x) => t.includes(x));
  if (m < 0) return /spring/.test(t) ? { date: ymd(year, 4, 1), when: 'month' } : null;
  const ord = Object.keys(ORD).find((k) => t.includes(`${k} week`));
  if (ord) return { date: ymd(year, m + 1, ORD[ord]), when: 'week' };
  if (/\bearly\b/.test(t)) return { date: ymd(year, m + 1, 1), when: 'week' };
  if (/\bmid\b/.test(t)) return { date: ymd(year, m + 1, 15), when: 'week' };
  if (/\blate\b/.test(t)) return { date: ymd(year, m + 1, 22), when: 'week' };
  return { date: ymd(year, m + 1, 1), when: 'month' };
}

export async function collect() {
  const rows = await getJson('https://data.ny.gov/resource/d9y2-n436.json?$limit=50000');
  // One entry per water and timing, with every species planned for it.
  const byKey = new Map();
  for (const r of rows) {
    const text = String(r.date ?? '').trim();
    const w = r.year && r.waterbody ? when(text, r.year) : null;
    if (!w) continue;
    const key = `${r.waterbody}|${r.county}|${text}`;
    let e = byKey.get(key);
    if (!e) {
      e = { water: r.waterbody, county: r.county, ...w, species: [], count: 0, detail: [text, r.town && `Town of ${r.town}`].filter(Boolean).join(' · ') };
      byKey.set(key, e);
    }
    const sp = String(r.species_name ?? '').replace(/ Trout$/i, '');
    if (sp && !e.species.includes(sp)) e.species.push(sp);
    e.count += +r.number || 0;
  }
  return [...byKey.values()].map((e) => item('NY', e));
}
