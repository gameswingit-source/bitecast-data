// New Jersey Fish & Wildlife: the trout stocking schedule tables (NJDEP ArcGIS), joined to the
// stocked lakes' and streams' points for names and locations. Dates are published in advance.

import { getJson, item, ymd } from '../lib.mjs';

export const kind = 'schedule';
export const source = 'https://dep.nj.gov/njfw/fishing/freshwater/trout-stocking-information/';

const B = 'https://mapsdep.nj.gov/arcgis/rest/services/Features/Environmental_admin/MapServer';
const q = (layer) => getJson(`${B}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`).then((j) => (j.features ?? []).map((f) => f.attributes));

export async function collect() {
  const [lakeSched, streamSched, lakes, streams] = await Promise.all([q(37), q(38), q(33), q(34)]);
  const lakeById = new Map(lakes.map((l) => [l.LAKE_ID, l]));
  const streamById = new Map(streams.map((s) => [s.STREAM_ID, s]));
  const out = [];
  const add = (rows, byId, idField, nameField) => {
    for (const r of rows) {
      const w = byId.get(r[idField]);
      const m = String(r.DATES ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!w || !m) continue;
      out.push(item('NJ', {
        water: w[nameField] || w.GNIS_NAME, date: ymd(m[3], m[1], m[2]), when: 'day', species: ['Rainbow'],
        count: r.NUM_TROUT || undefined, detail: r.PERIOD ? `${r.PERIOD.charAt(0)}${r.PERIOD.slice(1).toLowerCase()} stocking` : undefined,
        lat: w.LATDD, lon: w.LONDD,
      }));
    }
  };
  add(lakeSched, lakeById, 'LAKE_ID', 'WATERBODY');
  add(streamSched, streamById, 'STREAM_ID', 'NAME');
  return out;
}
