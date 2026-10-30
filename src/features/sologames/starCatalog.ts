export interface Constellation { name: string; points: readonly (readonly [number, number])[] }

// Authored outlines, followed by a fixed catalogue of unique geometric paths.
// The catalogue seed is fixed: saved level IDs always refer to the same drawing.
const OUTLINES: [string, string][] = [
  ['Una falce di luna', '68,12 42,16 24,36 22,62 40,82 68,88 48,66 44,40 68,12'],
  ['Un raggio di sole', '50,12 60,34 84,26 72,50 88,70 62,68 50,88 38,68 12,70 28,50 16,26 40,34 50,12'],
  ['Un lampo', '58,12 24,54 48,54 36,88 80,40 54,40 58,12'],
  ['Un diamante', '28,24 72,24 88,44 50,86 12,44 28,24 38,44 50,86 62,44 72,24 12,44 88,44'],
  ['Vette lontane', '12,80 34,24 52,58 68,16 88,80 12,80 34,24 42,40 28,40'],
  ['Un abete', '50,12 26,38 38,38 18,62 40,62 40,86 60,86 60,62 82,62 62,38 74,38 50,12'],
  ['Un pesciolino', '16,50 38,28 64,30 80,50 88,32 88,68 80,50 64,70 38,72 16,50'],
  ['Ali di farfalla', '50,36 28,14 12,30 22,50 12,72 30,86 50,62 70,86 88,72 78,50 88,30 72,14 50,36 50,62'],
  ['Un fiore', '50,34 34,14 18,30 30,50 18,70 38,82 50,66 64,84 84,66 68,50 84,30 68,14 50,34 50,88'],
  ['Una foglia', '20,82 18,52 36,22 82,14 80,46 60,72 20,82 48,52 82,14'],
  ['Una tazza calda', '18,38 66,38 66,70 54,84 30,84 18,70 18,38 66,38 86,42 86,62 66,66 66,38 42,38 34,24 42,12'],
  ['Un regalo', '16,42 84,42 84,82 16,82 16,42 50,42 50,82 50,42 28,30 28,14 44,16 50,42 56,16 74,14 74,30 50,42'],
  ['Una lettera', '12,26 88,26 88,78 12,78 12,26 50,56 88,26 88,78 62,54 50,56 38,54 12,78'],
  ['Una corona', '18,72 12,28 36,46 50,12 64,46 88,28 82,72 18,72 24,86 76,86 82,72'],
  ['Un ombrello', '14,46 24,24 50,12 76,24 86,46 62,40 50,46 38,40 14,46 50,46 50,76 62,88 76,76'],
  ['Un razzo', '40,62 30,36 50,12 70,36 60,62 40,62 22,80 24,54 36,48 40,62 50,88 60,62 76,80 76,54 64,48'],
  ['Un aeroplano', '50,12 58,42 86,58 86,70 58,60 58,78 72,86 50,82 28,86 42,78 42,60 14,70 14,58 42,42 50,12'],
  ['In automobile', '14,72 14,46 28,42 38,24 66,24 78,46 88,52 88,72 14,72 28,72 28,86 42,86 42,72 66,72 66,86 80,86 80,72'],
  ['Il nostro treno', '26,18 74,18 82,34 82,70 66,82 34,82 18,70 18,34 26,18 26,48 74,48 74,18 74,48 50,48 50,18'],
  ['Un’ancora', '50,12 36,24 50,36 64,24 50,12 50,76 28,64 16,46 16,68 50,88 84,68 84,46 72,64 50,76'],
  ['Un faro', '30,84 38,38 62,38 70,84 30,84 38,38 28,38 50,12 72,38 62,38 62,54 38,54'],
  ['Un castello', '14,84 14,32 26,32 26,18 40,18 40,32 60,32 60,18 74,18 74,32 86,32 86,84 60,84 60,60 40,60 40,84 14,84'],
  ['Un ponte', '12,76 12,40 26,40 26,20 26,40 50,58 74,40 74,20 74,40 88,40 88,76 74,76 74,40 50,58 26,40 26,76 12,76'],
  ['Una chiave', '18,24 38,12 56,24 56,44 38,56 18,44 18,24 38,56 64,82 78,68 88,78 74,88 64,82'],
  ['Un lucchetto', '24,42 24,24 38,12 62,12 76,24 76,42 86,42 86,86 14,86 14,42 24,42 76,42 50,42 50,66'],
  ['Una nota musicale', '38,68 22,68 14,80 30,88 42,80 42,30 82,14 82,64 66,64 58,76 74,84 86,76 86,28 42,44'],
  ['Le cuffie', '18,68 18,36 34,16 66,16 82,36 82,68 68,82 68,48 82,48 82,36 66,16 34,16 18,36 18,48 32,48 32,82 18,68'],
  ['Una macchina fotografica', '12,34 32,34 40,20 60,20 68,34 88,34 88,82 12,82 12,34 32,34 32,58 50,74 68,58 50,42 32,58'],
  ['Un libro aperto', '50,30 30,18 12,22 12,76 30,72 50,84 70,72 88,76 88,22 70,18 50,30 50,84'],
  ['Una matita', '20,68 64,16 84,36 40,88 14,88 20,68 40,88 30,78 74,26 64,16'],
  ['Una sveglia', '50,24 74,34 84,58 74,78 50,88 26,78 16,58 26,34 50,24 50,58 70,58 50,58 50,24 30,12 14,28 26,34 74,34 86,28 70,12 50,24'],
  ['Una campana', '18,68 30,54 30,32 50,14 70,32 70,54 82,68 18,68 38,68 38,82 62,82 62,68'],
  ['Una candela', '32,88 32,44 68,44 68,88 32,88 32,44 50,44 38,28 50,12 62,28 50,44'],
  ['Un gelato', '26,46 18,30 30,16 50,12 70,16 82,30 74,46 26,46 50,88 74,46 26,46 64,64 50,88'],
  ['Una mela', '50,32 30,22 14,40 20,70 38,88 50,80 62,88 80,70 86,40 70,22 50,32 50,12 70,16 50,32'],
  ['Una pera', '42,28 42,12 58,12 58,28 72,46 84,68 72,84 50,88 28,84 16,68 28,46 42,28'],
  ['Una fragola', '18,34 32,18 50,26 68,18 82,34 76,58 50,88 24,58 18,34 50,44 82,34 50,26 50,12'],
  ['Due ciliegie', '50,14 30,46 14,52 14,72 30,86 46,72 46,52 30,46 50,14 70,46 54,52 54,72 70,86 86,72 86,52 70,46'],
  ['Una carota', '24,34 66,34 40,88 24,34 44,34 30,12 50,26 64,12 56,34 66,34'],
  ['Un fungo', '12,50 22,28 50,12 78,28 88,50 12,50 40,50 34,86 66,86 60,50'],
  ['Una fetta di pizza', '18,24 50,12 82,24 50,88 18,24 28,42 72,42 82,24'],
  ['Una torta', '16,86 16,48 30,58 44,48 58,58 72,48 84,58 84,86 16,86 16,48 84,48 84,34 16,34 16,48 50,48 50,12'],
  ['Un gatto', '20,36 20,12 40,28 60,28 80,12 80,36 88,58 72,82 50,88 28,82 12,58 20,36'],
  ['Un coniglietto', '32,46 22,14 34,12 50,40 66,12 78,14 68,46 82,64 70,84 30,84 18,64 32,46'],
  ['Un cagnolino', '28,26 12,40 12,68 28,58 28,26 72,26 88,40 88,68 72,58 72,26 72,74 50,88 28,74 28,58'],
  ['Una civetta', '20,24 36,34 50,24 64,34 80,24 86,60 70,84 50,72 30,84 14,60 20,24 50,50 80,24'],
  ['Una tartaruga', '28,34 44,24 66,34 76,50 88,38 88,62 76,50 66,72 44,82 28,72 16,82 12,68 24,58 24,46 12,34 16,20 28,34 44,52 66,34'],
  ['Una lumachina', '12,82 28,66 28,38 44,20 68,20 82,38 82,62 66,76 46,66 40,48 54,36 68,48 62,60 46,66 66,76 88,82 12,82'],
  ['Una balena', '12,50 28,30 56,28 72,44 86,30 80,54 88,70 70,62 50,80 28,76 12,62 12,50 28,50 28,30 50,28 50,12 66,18'],
  ['Un granchio', '26,50 12,34 12,14 28,30 26,50 42,40 58,40 74,50 72,30 88,14 88,34 74,50 74,72 58,84 42,84 26,72 26,50'],
];

// Compare undirected edges, not names or traversal order. Translation, scale,
// quarter turns, and reflection cannot turn a drawing into a supposedly new one.
export function drawingFingerprint(points: Constellation['points']): string {
  const transforms = [
    (x: number, y: number) => [x, y], (x: number, y: number) => [-x, y],
    (x: number, y: number) => [x, -y], (x: number, y: number) => [-x, -y],
    (x: number, y: number) => [y, x], (x: number, y: number) => [-y, x],
    (x: number, y: number) => [y, -x], (x: number, y: number) => [-y, -x],
  ];
  return transforms.map(transform => {
    const transformed = points.map(([x, y]) => transform(x, y));
    const minX = Math.min(...transformed.map(p => p[0]));
    const minY = Math.min(...transformed.map(p => p[1]));
    const size = Math.max(...transformed.map(p => p[0])) - minX || 1;
    const height = Math.max(...transformed.map(p => p[1])) - minY || 1;
    const scale = Math.max(size, height);
    const vertices = transformed.map(([x, y]) => `${Math.round((x - minX) / scale * 10000)},${Math.round((y - minY) / scale * 10000)}`);
    return [...new Set(vertices.slice(1).map((v, i) => [vertices[i], v].sort().join(':')))].sort().join('|');
  }).sort()[0];
}

function seededRandom(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function additionalConstellations(existing: readonly Constellation[]): Constellation[] {
  const added: Constellation[] = [];
  const seen = new Set(existing.map(sky => drawingFingerprint(sky.points)));
  const add = (sky: Constellation) => {
    const fingerprint = drawingFingerprint(sky.points);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint); added.push(sky); return true;
  };
  for (const [name, path] of OUTLINES) {
    add({ name, points: path.split(' ').map(pair => pair.split(',').map(Number) as [number, number]) });
  }
  const random = seededRandom(20261018);
  const regions = ['dell’aurora', 'del crepuscolo', 'del silenzio', 'dei sogni', 'della notte', 'del vento', 'dell’orizzonte', 'della cometa', 'della galassia', 'del firmamento'];
  const crosses = (a: number, b: number, c: number, d: number) => {
    const side = (p: number, q: number, r: number) => (q % 4 - p % 4) * (Math.floor(r / 4) - Math.floor(p / 4)) - (Math.floor(q / 4) - Math.floor(p / 4)) * (r % 4 - p % 4);
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  };
  // Self-avoiding walks on a generous grid keep the numbered targets separated.
  // Once generated, these are a fixed catalogue, not fresh random drawings per render.
  for (let attempt = 0; added.length < 200 && attempt < 20000; attempt++) {
    const length = 7 + Math.floor(random() * 9);
    const cells = [Math.floor(random() * 16)];
    while (cells.length < length) {
      const last = cells[cells.length - 1];
      const x = last % 4, y = Math.floor(last / 4);
      const neighbours = Array.from({ length: 16 }, (_, i) => i).filter(i => !cells.includes(i)
        && Math.max(Math.abs(i % 4 - x), Math.abs(Math.floor(i / 4) - y)) === 1
        && !cells.slice(1).some((end, edge) => crosses(last, i, cells[edge], end)));
      if (!neighbours.length) break;
      cells.push(neighbours[Math.floor(random() * neighbours.length)]);
    }
    if (cells.length !== length) continue;
    const number = added.length - OUTLINES.length;
    const first = cells[0], last = cells[cells.length - 1];
    if (random() < 0.35 && Math.max(Math.abs(first % 4 - last % 4), Math.abs(Math.floor(first / 4) - Math.floor(last / 4))) === 1
      && !cells.slice(1).some((end, edge) => crosses(last, first, cells[edge], end))) cells.push(first);
    add({ name: `Sentiero ${regions[number % regions.length]} ${Math.floor(number / regions.length) + 1}`, points: cells.map(i => [14 + i % 4 * 24, 14 + Math.floor(i / 4) * 24]) });
  }
  if (added.length !== 200) throw new Error('Catalogo delle stelle incompleto');
  return added;
}
