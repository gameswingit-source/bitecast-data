// Maryland DNR: recent trout stockings (the JSON feed behind dnr.maryland.gov's stocking table).
// Posted after each day's stocking, not in advance.

import { getJson, item } from '../lib.mjs';

export const kind = 'reports';
export const source = 'https://dnr.maryland.gov/fisheries/pages/trout/stocking.aspx';

export async function collect() {
  const rows = await getJson('https://webapps02.dnr.state.md.us/DNRTroutStockingAPI/api/RecentStockings');
  return rows
    .filter((r) => r.LOCATION && r.ActivityDate)
    .map((r) => item('MD', {
      water: r.LOCATION.trim(), county: r.County, date: String(r.ActivityDate).slice(0, 10), when: 'day',
      species: String(r.Species ?? '').split('/').map((s) => s.trim()).filter(Boolean),
      count: +r.NumOfFish || undefined, detail: r.RegulationDetails || undefined,
    }));
}
