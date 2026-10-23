// Pennsylvania Fish & Boat Commission: the trout stocking schedule (fbweb.pa.gov/TroutStocking),
// one request per county. Upcoming dates are published in advance.

import { countyNames, item, postJsonText, sleep, title, ymd } from '../lib.mjs';

export const kind = 'schedule';
export const source = 'https://fbweb.pa.gov/TroutStocking/';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function parse(html) {
  const out = [];
  for (const b of html.split(/class="row stocksDiv/).slice(1)) {
    const m = b.match(/data-mapatt="([^"]*)"/);
    if (!m) continue;
    const f = decode(m[1]).split('|');
    let date = '';
    let when = 'day';
    for (const v of f) {
      const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const us = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (iso) date = v;
      else if (us) [date, when] = [ymd(us[3], us[1], us[2]), 'week'];
      if (date) break;
    }
    if (!date) continue;
    const text = decode(b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    const species = [...new Set([...text.matchAll(/\b((?:Golden )?Rainbow|Brown|Brook|Tiger) Trout\b/g), ...b.matchAll(/>\s*((?:Golden )?Rainbow|Brown|Brook|Tiger)\s*<\/button>/g)].map((x) => x[1]))];
    const ll = text.match(/Lat & Long:\s*(-?[\d.]+),\s*(-?[\d.]+)/);
    const ti = f.findIndex((v) => /^\d{2}:\d{2}(:\d{2})?$/.test(v));
    out.push(item('PA', {
      water: f[0], county: f[1], date, when, species,
      section: f[2] && f[2] !== '0' ? `Section ${f[2]}` : undefined,
      detail: f[3] ? `${title(f[3])} to ${title(f[4])}` : undefined,
      meet: ti > 0 && f[ti - 1] ? `${f[ti - 1]}, ${f[ti].replace(/:00$/, '')}` : undefined,
      lat: ll ? +ll[1] : undefined, lon: ll ? +ll[2] : undefined,
    }));
  }
  return out;
}

export async function collect() {
  const all = [];
  for (const county of countyNames('PA')) {
    const html = await postJsonText('https://fbweb.pa.gov/TroutStocking/Home/Secondpage', { County: county, StartDate: '', EndDate: '', PageNumber: 1, Water: '', Season: '' });
    all.push(...parse(html));
    await sleep(400); // be gentle with the state's server
  }
  return all;
}
