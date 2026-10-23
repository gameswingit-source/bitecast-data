// Checks every agency and stocking link in the directory and prints the ones that don't load.
// Usage: node tools/check-links.mjs
import { DIRECTORY } from '../src/directory.mjs';

const check = async (url) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (link check)' } });
    return r.status;
  } catch (e) {
    return e.name === 'AbortError' ? 'timeout' : 'error';
  } finally {
    clearTimeout(t);
  }
};

const jobs = Object.entries(DIRECTORY).flatMap(([st, d]) => [[st, 'home', d.home], [st, 'stocking', d.stocking]]);
const results = [];
for (let i = 0; i < jobs.length; i += 8)
  results.push(...(await Promise.all(jobs.slice(i, i + 8).map(async ([st, k, u]) => [st, k, u, await check(u)]))));
const bad = results.filter((r) => r[3] !== 200);
for (const [st, k, u, s] of bad) console.log(`${st} ${k} ${s} ${u}`);
console.log(`${results.length - bad.length}/${results.length} links OK`);
