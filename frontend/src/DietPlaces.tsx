import { useId } from 'react';
import './diet-places.css';

// My Dinos by diet. Herbivores sit under a fine botanical study, carnivores under a fossil skull
// drawn like a museum plate. Both drawings are generated from a few curves so they stay crisp.

type Point = [number, number];
const quad = (a: Point, c: Point, b: Point, t: number): Point => [0, 1].map(axis => (1 - t) ** 2 * a[axis] + 2 * (1 - t) * t * c[axis] + t * t * b[axis]) as Point;
const slope = (a: Point, c: Point, b: Point, t: number): Point => [0, 1].map(axis => 2 * (1 - t) * (c[axis] - a[axis]) + 2 * t * (b[axis] - c[axis])) as Point;
const leafShape = (length: number, width: number) => `M0 0Q${length * .42} ${-width} ${length} 0Q${length * .42} ${width} 0 0Z`;
const at = (x: number, y: number, angle: number) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`;

// A fern frond: leaflets in pairs along a curved rachis, shrinking towards the tip.
function Frond({ from, via, to, count, size, className = '' }: { from: Point; via: Point; to: Point; count: number; size: number; className?: string }) {
  const leaflets = Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1);
    const [x, y] = quad(from, via, to, t);
    const [dx, dy] = slope(from, via, to, t);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const length = size * (1 - t * .72);
    return [-1, 1].map(side => <g key={`${index}${side}`} transform={at(x, y, angle + side * 56)}>
      <path className="frond-leaflet" d={leafShape(length, length * .23)} />
      <path className="frond-rib" d={`M${length * .1} 0L${length * .86} 0`} />
    </g>);
  });
  return <g className={`frond ${className}`}><path className="botany-stem" d={`M${from}Q${via} ${to}`} />{leaflets}</g>;
}

function Leaf({ x, y, length, angle }: { x: number; y: number; length: number; angle: number }) {
  const width = length * .3;
  return <g transform={at(x, y, angle)}>
    <path className="botany-leaf" d={leafShape(length, width)} />
    <path className="botany-vein" d={`M0 0Q${length * .5} ${-width * .08} ${length * .94} 0`} />
    {[.22, .42, .62].map(t => <path key={t} className="botany-vein fine" d={`M${length * t} 0Q${length * (t + .06)} ${-width * .3} ${length * (t + .14)} ${-width * .6}M${length * t} 0Q${length * (t + .06)} ${width * .3} ${length * (t + .14)} ${width * .6}`} />)}
  </g>;
}

const fivefold = [0, 72, 144, 216, 288];
function Blossom({ x, y, r, turn = 0, fill }: { x: number; y: number; r: number; turn?: number; fill: string }) {
  const petal = `M0 0C${-r * .62} ${-r * .3} ${-r * .52} ${-r} 0 ${-r}C${r * .52} ${-r} ${r * .62} ${-r * .3} 0 0Z`;
  return <g transform={at(x, y, turn)}>
    {fivefold.map(angle => <path key={angle} className="petal" fill={fill} d={petal} transform={`rotate(${angle})`} />)}
    {fivefold.map(angle => <path key={`v${angle}`} className="petal-vein" d={`M0 ${-r * .2}Q${r * .04} ${-r * .5} 0 ${-r * .76}`} transform={`rotate(${angle})`} />)}
    <circle className="blossom-heart" r={r * .2} />
    {Array.from({ length: 9 }, (_, index) => { const angle = index * 40 * Math.PI / 180; return <circle key={index} className="stamen" cx={Math.cos(angle) * r * .33} cy={Math.sin(angle) * r * .33} r={r * .045} />; })}
  </g>;
}

function Bud({ x, y, size, angle }: { x: number; y: number; size: number; angle: number }) {
  return <g transform={at(x, y, angle)}>
    <path className="botany-stem" d={`M0 0L${size * 1.4} 0`} />
    <path className="bud" d={`M${size * 1.4} 0C${size * 1.6} ${-size * .55} ${size * 2.4} ${-size * .5} ${size * 2.6} 0C${size * 2.4} ${size * .5} ${size * 1.6} ${size * .55} ${size * 1.4} 0Z`} />
    <path className="botany-leaf sepal" d={`M${size * 1.4} 0Q${size * 1.7} ${-size * .5} ${size * 2} ${-size * .2}Q${size * 1.7} ${-size * .1} ${size * 1.4} 0Z`} />
  </g>;
}

function BotanicalPlate() {
  const id = useId().replace(/:/g, '');
  return <svg className="diet-art botany" viewBox="0 0 440 250" aria-hidden="true" shapeRendering="geometricPrecision">
    <defs>
      <linearGradient id={`${id}-rose`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#b9667f" /><stop offset=".55" stopColor="#e3a7ba" /><stop offset="1" stopColor="#f8e6ec" /></linearGradient>
      <linearGradient id={`${id}-lilac`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#8b6fae" /><stop offset=".6" stopColor="#c8b2e2" /><stop offset="1" stopColor="#f1eaf8" /></linearGradient>
      <linearGradient id={`${id}-cream`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#c99a55" /><stop offset=".6" stopColor="#f0d9a6" /><stop offset="1" stopColor="#fdf6e4" /></linearGradient>
    </defs>
    <Frond from={[452, 214]} via={[380, 120]} to={[318, 18]} count={12} size={24} className="far" />
    <Frond from={[446, 250]} via={[318, 182]} to={[176, 46]} count={17} size={33} />
    <path className="botany-stem" d="M446 236C392 198 356 160 330 72" />
    <path className="botany-stem" d="M360 168C328 150 296 128 268 98" />
    <Leaf x={352} y={160} length={50} angle={196} />
    <Leaf x={318} y={142} length={42} angle={142} />
    <Leaf x={340} y={112} length={36} angle={232} />
    <Bud x={300} y={120} size={9} angle={214} />
    <Blossom x={330} y={64} r={27} turn={8} fill={`url(#${id}-rose)`} />
    <Blossom x={266} y={94} r={20} turn={-18} fill={`url(#${id}-cream)`} />
    <Blossom x={388} y={128} r={16} turn={24} fill={`url(#${id}-lilac)`} />
  </svg>;
}

// Lateral view of a theropod skull: openings, interlocking recurved teeth and a few sutures.
const upperRow = (x: number) => 121 + (x - 40) * (15 / 260);
const lowerRow = (x: number) => 135 + (x - 40) * (14 / 260);
const tooth = (x: number, y: number, length: number, width: number, dir: 1 | -1) => `M${x - width / 2} ${y}Q${x - width * .12} ${y + dir * length * .56} ${x + width * .42} ${y + dir * length}Q${x + width * .28} ${y + dir * length * .44} ${x + width / 2} ${y}Z`;
const upperTeeth = Array.from({ length: 15 }, (_, index) => { const x = 48 + index * 16.5; return tooth(x, upperRow(x) - 1, index < 4 ? 15 + index * 2.5 : 24 - index * 1.05, 9.5 - index * .25, 1); });
const lowerTeeth = Array.from({ length: 13 }, (_, index) => { const x = 58 + index * 17.5; return tooth(x, lowerRow(x) + 1, index < 3 ? 10 + index * 2 : 15 - index * .6, 8 - index * .2, -1); });

function SkullPlate() {
  const id = useId().replace(/:/g, '');
  return <svg className="diet-art skull" viewBox="0 0 400 200" aria-hidden="true" shapeRendering="geometricPrecision">
    <defs>
      <linearGradient id={`${id}-bone`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efe7d6" stopOpacity=".16" /><stop offset="1" stopColor="#efe7d6" stopOpacity=".03" /></linearGradient>
      <linearGradient id={`${id}-enamel`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6f0e3" /><stop offset="1" stopColor="#b9aa8b" /></linearGradient>
    </defs>
    <path className="skull-bone" fill={`url(#${id}-bone)`} d="M30 134C72 142 134 148 202 151C262 153 322 151 364 147C370 158 360 170 338 174C278 178 200 174 132 166C82 160 46 150 30 134Z" />
    <ellipse className="skull-hole" cx="304" cy="160" rx="20" ry="5.5" transform="rotate(-2 304 160)" />
    {lowerTeeth.map(d => <path key={d} className="skull-tooth lower" fill={`url(#${id}-enamel)`} d={d} />)}
    <path className="skull-bone" fill={`url(#${id}-bone)`} d="M18 112C30 96 70 82 120 70C170 58 220 50 262 52C300 54 334 58 352 72C366 84 372 104 370 126L362 142C340 140 318 137 296 136C240 134 180 132 130 130C90 128 52 124 30 120Z" />
    <path className="skull-hole" d="M146 112C156 92 188 81 222 85C233 96 233 111 226 121C199 123 170 121 146 112Z" />
    <path className="skull-hole" d="M255 68C270 60 288 68 289 83C289 97 277 106 268 119C261 104 251 95 251 83C251 77 252 72 255 68Z" />
    <path className="skull-hole" d="M304 80C318 73 337 78 341 93C343 109 335 122 322 127C313 112 304 98 304 80Z" />
    <ellipse className="skull-hole" cx="58" cy="100" rx="12" ry="5.5" transform="rotate(-14 58 100)" />
    <path className="skull-line" d="M74 106C96 99 118 96 140 98M112 74C152 69 204 64 246 62M234 125C256 119 280 117 300 121M296 64C306 72 312 84 314 98M346 76C352 92 356 108 356 128M190 84C188 70 192 60 200 56" />
    {upperTeeth.map(d => <path key={d} className="skull-tooth" fill={`url(#${id}-enamel)`} d={d} />)}
  </svg>;
}

// A hairline with fine serrations, like the denticles along a theropod tooth.
function Serration() {
  const id = useId().replace(/:/g, '');
  return <svg className="diet-serration" width="100%" height="7" aria-hidden="true">
    <defs><pattern id={`${id}-dent`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 6.5L3.5 1.5L7 6.5" /></pattern></defs>
    <rect width="100%" height="7" fill={`url(#${id}-dent)`} />
  </svg>;
}

export function DietPlace({ diet, count, children }: { diet: 'herbivore' | 'carnivore'; count: number; children: React.ReactNode }) {
  const herbivore = diet === 'herbivore';
  return <section className={`diet-place ${herbivore ? 'herbivores' : 'carnivores'}`} aria-label={herbivore ? 'Deine Pflanzenfresser' : 'Deine Fleischfresser'}>
    {herbivore ? <BotanicalPlate /> : <SkullPlate />}
    <header className="diet-head">
      <span className="diet-count">{count} {count === 1 ? 'Dino' : 'Dinos'}</span>
      <h2>{herbivore ? 'Pflanzenfresser' : 'Fleischfresser'}</h2>
    </header>
    {herbivore ? <div className="diet-rule" aria-hidden="true" /> : <Serration />}
    <div className="diet-body">{children}</div>
  </section>;
}
