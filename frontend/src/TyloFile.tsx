import type { CatalogItem } from './api';
import { bondsOf, characterOf, familyOf, herdApi, isDiscordUrl, linkHref, sexSymbol, type HerdBond, type HerdDino, type HerdOffspring, type HerdSibling } from './herd';
import './tylo-file.css';

// A Tylosaurus of your own gets a photo-ID file in the style of orca catalogues: catalogue number,
// identifying marks, a pedigree (mates and the calves under their mothers) and a dated chronicle.

const dayFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
const formatDay = (value: string) => value ? dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '';
const mateKind = /partner|gefährt|bindung|harem|mate/i;
const ended = /beendet|getrennt|vorbei/i;
const deceased = /verstorben|gestorben|tot\b|†/i;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Profile › Physical Dimorphism, Overview, Nesting and Group Limits, quoted verbatim.
const bySex = {
  male: { role: 'Bulle', subspecies: 'Bullen: proriger, kansasensis oder rex', dimorphism: '“Males, known as bulls, are thinner and smaller than females, with a pointed fin jutting from their tail.”' },
  female: { role: 'Kuh', subspecies: 'Kühe: nepaeolicus', dimorphism: '“Females, known as cows, are thicker than males, with large, smooth tails.”' },
};
const quotes = [
  { text: '“Tylosaurus form temporary bonds, and males may court with multiple females.”', source: 'Overview' },
  { text: '“After successful courtship, bulls return to their rovers or matriline, and cows return to their matriline - or form a new one on their own.”', source: 'Nesting' },
  { text: '“Offspring must take the name of their mother\'s bloodline.”', source: 'Group Limits' },
];

type SketchNote = { from: [number, number]; to: [number, number]; title: string; text: string; anchor?: 'start' | 'end' };
const sketchNotes: Record<'male' | 'female', SketchNote[]> = {
  male: [
    { from: [464, 60], to: [480, 30], title: 'SPITZE SCHWANZFLOSSE', text: 'Kennzeichen der Bullen' },
    { from: [32, 101], to: [40, 44], title: 'SCHNAUZE', text: 'rammt Felsen bei Stress und Balz' },
    { from: [252, 142], to: [252, 198], title: 'SCHLANKER KÖRPER', text: 'dünner und kleiner als die Kühe' },
  ],
  female: [
    { from: [270, 64], to: [282, 30], title: 'KRÄFTIGER KÖRPER', text: 'dicker als die Bullen' },
    { from: [574, 132], to: [540, 196], title: 'GROSSER, GLATTER SCHWANZ', text: 'ohne Spitzflosse', anchor: 'end' },
  ],
};
const notesFor = (sex: HerdDino['sex']) => sketchNotes[sex === 'female' ? 'female' : 'male'];

export function TyloSketch({ sex, faint = false }: { sex: HerdDino['sex']; faint?: boolean }) {
  const cow = sex === 'female';
  return <svg className={`tf-sketch${faint ? ' faint' : ''}`} viewBox="0 0 640 232" role="img" aria-label={`Skizze eines Tylosaurus-${cow ? 'Kuh' : 'Bullen'}, linke Seite`}>
    <g transform={cow ? 'translate(0 106) scale(1 1.16) translate(0 -106)' : undefined}>
      <path className="tf-body" d="M20 106C30 100 52 92 84 88C118 84 150 80 186 76C236 70 292 72 344 80C392 87 436 96 478 101C494 103 506 104 518 104L552 80C556 88 552 98 544 106L604 142C576 136 546 124 520 116C488 114 446 118 404 122C356 130 300 140 248 140C200 140 160 132 126 122C96 117 60 114 20 106Z" />
      {!cow && <path className="tf-body" d="M428 94C440 84 452 70 466 56C466 72 470 88 474 100Z" />}
      <path className="tf-fin" d="M136 124C150 140 160 158 182 172C176 154 172 138 164 125Z" />
      <path className="tf-fin" d="M332 128C344 140 352 152 368 160C364 148 360 136 352 130Z" />
      <path className="tf-detail" d="M22 106C50 104 80 104 118 100" />
      <path className="tf-lateral" d="M126 103C220 106 330 108 470 108" />
      <circle className="tf-eye" cx="100" cy="93" r="2.6" />
    </g>
    {!faint && notesFor(sex).map(note => <Note key={note.title} {...note} />)}
  </svg>;
}

function Note({ from, to, title, text, anchor = 'start' }: SketchNote) {
  const x = anchor === 'end' ? to[0] - 6 : to[0] + 6;
  const y = to[1] - 3;
  return <g className="tf-note">
    <circle cx={from[0]} cy={from[1]} r="2.4" />
    <path d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}`} />
    <text x={x} y={y} textAnchor={anchor}><tspan className="tf-note-title">{title}</tspan><tspan x={x} dy="14">{text}</tspan></text>
  </g>;
}

// Bathymetric contour lines behind the catalogue head.
function Contours() {
  return <svg className="tf-contours" viewBox="0 0 800 170" preserveAspectRatio="none" aria-hidden="true">
    {Array.from({ length: 7 }, (_, index) => {
      const y = 18 + index * 22;
      return <path key={index} d={`M0 ${y + 14}C140 ${y - 8} 250 ${y + 34} 410 ${y + 10}S660 ${y - 12} 800 ${y + 16}`} />;
    })}
  </svg>;
}

function Node({ sex, name, caption, unknown = false, focus = false, small = false, gone = false }: { sex: HerdDino['sex']; name: string; caption?: string; unknown?: boolean; focus?: boolean; small?: boolean; gone?: boolean }) {
  const shape = sex || 'unsexed';
  return <div className={['tf-node', shape, unknown && 'unknown', focus && 'focus', small && 'small', gone && 'gone'].filter(Boolean).join(' ')}>
    <span className="tf-glyph" aria-hidden="true"><b>{unknown ? '?' : name.charAt(0).toUpperCase()}</b></span>
    <strong>{name}{gone && <i title="verstorben"> †</i>}</strong>
    {caption && <small>{caption}</small>}
  </div>;
}

function Sibling({ sibling }: { sibling: HerdSibling }) {
  const role = sibling.sex === 'male' ? 'Bruder' : sibling.sex === 'female' ? 'Schwester' : 'Geschwister';
  return <li className="tf-sibling"><Node sex={sibling.sex} name={sibling.name} caption={[role, sibling.status].filter(Boolean).join(' · ')} small gone={deceased.test(sibling.status)} /></li>;
}

function Calf({ calf }: { calf: HerdOffspring }) {
  const caption = [calf.clutch && `Gelege ${calf.clutch}`, calf.born && `geb. ${formatDay(calf.born)}`, calf.status].filter(Boolean).join(' · ');
  return <li><Node sex={calf.sex} name={calf.name} caption={caption || undefined} small gone={deceased.test(calf.status)} /></li>;
}

// The mother's bloodline as a water column around her and her calves: they all carry its name.
function Lineage({ bloodline, children }: { bloodline?: string; children: React.ReactNode }) {
  if (!bloodline) return <>{children}</>;
  return <div className="tf-lineage">
    <span className="tf-lineage-name"><i aria-hidden="true">≋</i><small>BLOODLINE</small><b>{bloodline}</b></span>
    {children}
    <small className="tf-lineage-foot">Die Kälber tragen den Namen der Mutter</small>
  </div>;
}

function Pedigree({ dino }: { dino: HerdDino }) {
  const family = familyOf(dino);
  const mates = bondsOf(dino).filter(bond => mateKind.test(bond.kind));
  const orphans = family.offspring.filter(calf => !mates.some(mate => same(mate.name, calf.mother)));
  const mateRole = (bond: HerdBond, index: number) => `× ${index + 1}. ${bond.sex === 'male' ? 'Partner' : 'Partnerin'}`;
  const calvesOf = (mate: HerdBond) => family.offspring.filter(calf => same(calf.mother, mate.name));
  // Siblings stand beside the dino under the shared parents: half before, half after.
  const siblings = family.siblings || [];
  const before = siblings.slice(0, Math.floor(siblings.length / 2));
  const after = siblings.slice(before.length);
  return <div className="tf-tree-scroll">
    <div className="tf-tree">
      <div className="tf-parents">
        <Node sex="female" name={family.mother || 'Mutter'} caption={family.mother ? 'Mutter' : 'noch offen'} unknown={!family.mother} small />
        <span className="tf-couple" aria-hidden="true" />
        <Node sex="male" name={family.father || 'Vater'} caption={family.father ? 'Vater' : 'noch offen'} unknown={!family.father} small />
      </div>
      <ul className="tf-branch" aria-label={`Stammbaum von ${dino.name}`}>
        {before.map(sibling => <Sibling key={sibling.name} sibling={sibling} />)}
        <li className="tf-root">
          <Node sex={dino.sex} name={dino.name} caption={family.catalogId || undefined} focus />
          {(mates.length > 0 || orphans.length > 0) && <ul>
            {mates.map((mate, index) => {
              const calves = calvesOf(mate);
              return <li key={`${mate.name}-${index}`} className={ended.test(mate.status) ? 'tf-ended' : undefined}>
                <span className="tf-pairing">{mateRole(mate, index)}</span>
                <Lineage bloodline={mate.bloodline}>
                  <Node sex={mate.sex} name={mate.name} caption={mate.status || mate.note || undefined} />
                  <ul>{calves.length ? calves.map(calf => <Calf key={calf.name} calf={calf} />) : <li className="tf-pending"><Node sex={null} name="Kälber folgen" unknown small /></li>}</ul>
                </Lineage>
              </li>;
            })}
            {orphans.length > 0 && <li>
              <span className="tf-pairing">Mutter offen</span>
              <Node sex="female" name="unbekannt" caption="keiner Partnerin zugeordnet" unknown />
              <ul>{orphans.map(calf => <Calf key={calf.name} calf={calf} />)}</ul>
            </li>}
          </ul>}
        </li>
        {after.map(sibling => <Sibling key={sibling.name} sibling={sibling} />)}
      </ul>
      {!mates.length && !orphans.length && <p className="tf-tree-empty">Noch keine Partnerin eingetragen.</p>}
    </div>
  </div>;
}

function Section({ index, title, aside, children, className }: { index: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`tf-section${className ? ` ${className}` : ''}`}>
    <header className="tf-section-head"><span>{index}</span><h2>{title}</h2>{aside && <div className="tf-section-aside">{aside}</div>}</header>
    {children}
  </section>;
}

// Behaviour as a field researcher notes it: the traits as a short ethogram, the free text as a field note.
function Behaviour({ dino, catalogId }: { dino: HerdDino; catalogId: string }) {
  const { traits, text } = characterOf(dino);
  if (!traits.length && !text) return <p className="tf-muted">Noch keine Verhaltensnotizen. Beobachtungen: <code>/aktualisiere {dino.name}</code> oder unter „Akte bearbeiten“.</p>;
  return <div className={`tf-behaviour${traits.length && text ? '' : ' single'}`}>
    {traits.length > 0 && <ol className="tf-ethogram" aria-label="Wesenszüge">{traits.map((trait, index) => <li key={trait}><span>{String(index + 1).padStart(2, '0')}</span><b>{trait}</b></li>)}</ol>}
    {text && <figure className="tf-fieldnote"><blockquote>{text}</blockquote><figcaption>Feldnotiz · {catalogId} {dino.name}</figcaption></figure>}
  </div>;
}

function Proof({ url, label }: { url: string; label: string }) {
  const discord = isDiscordUrl(url);
  return <a href={linkHref(url)} title={url} {...(discord ? {} : { target: '_blank', rel: 'noreferrer' })}>{label} ↗</a>;
}

const catalogOrder = (a: HerdDino, b: HerdDino) => (familyOf(a).catalogId || '~').localeCompare(familyOf(b).catalogId || '~', 'de', { numeric: true }) || a.name.localeCompare(b.name, 'de');
const familyLine = (dino: HerdDino, mates: HerdBond[]) => {
  const { offspring } = familyOf(dino);
  // Clutches are numbered across all mates, so the highest number is the count so far.
  const clutches = Math.max(0, ...offspring.map(calf => calf.clutch || 0));
  return [`${mates.length} ${dino.sex === 'female' ? 'Partner' : mates.length === 1 ? 'Partnerin' : 'Partnerinnen'}`, clutches > 0 && `${clutches} Gelege`, `${offspring.length} ${offspring.length === 1 ? 'Kalb' : 'Kälber'}`].filter(Boolean).join(' · ');
};

// My Dinos overview: your Tylosaurus as entries of the photo-ID catalogue, by catalogue number.
export function TyloCatalog({ dinos }: { dinos: HerdDino[] }) {
  return <section className="tf tf-catalog" aria-label="Photo-ID-Katalog Tylosaurus">
    <header className="tf-head">
      <Contours />
      <div className="tf-head-copy"><span>PHOTO-ID-KATALOG · TYLOSAURUS</span><strong>Küsten &amp; offene See</strong></div>
      <div className="tf-head-id"><span>IM KATALOG</span><strong>{String(dinos.length).padStart(2, '0')}</strong></div>
      <div className="tf-ruler" aria-hidden="true" />
    </header>
    {[...dinos].sort(catalogOrder).map(dino => <TyloEntry key={dino.id} dino={dino} />)}
  </section>;
}

function TyloEntry({ dino }: { dino: HerdDino }) {
  const family = familyOf(dino);
  const sexInfo = dino.sex ? bySex[dino.sex] : null;
  const mates = bondsOf(dino).filter(bond => mateKind.test(bond.kind));
  const catalogId = family.catalogId || 'TY–';
  const latest = [...family.log].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const { traits } = characterOf(dino);
  const g = dino.genetics;
  const facts: Array<[string, React.ReactNode]> = [
    ['Unterart', family.subspecies || <i>offen</i>],
    ['Bloodline', g?.bloodlines.length ? g.bloodlines.join(', ') : <i>keine eingetragen</i>],
    ['Familie', familyLine(dino, mates)],
    ['Letzte Sichtung', latest ? <>{formatDay(latest.date)}<small>{latest.text}</small></> : <i>noch keine</i>],
  ];
  return <a className="tf-entry" href={`#/herd/${dino.id}`} aria-label={`ID-Akte ${catalogId} ${dino.name} öffnen`}>
    <figure className={`tf-plate${dino.photo ? '' : ' empty'}`}>
      {dino.photo ? <img src={herdApi.fileUrl(dino, dino.photo)} alt={dino.name} loading="lazy" /> : <span className="tf-plate-empty"><TyloSketch sex={dino.sex} faint /><span><b>ID-Foto folgt</b></span></span>}
      <i className="tf-crop tl" /><i className="tf-crop tr" /><i className="tf-crop bl" /><i className="tf-crop br" />
      <figcaption><span>{catalogId} · {dino.name.toUpperCase()}</span><span>{dino.photo ? 'ID-FOTO' : 'KEIN FOTO'}</span></figcaption>
    </figure>
    <div className="tf-entry-body">
      <div className="tf-kicker">KATALOG-NR. {catalogId}{sexInfo ? ` · ${sexInfo.role.toUpperCase()}` : ''}</div>
      <h2>{dino.name}{dino.sex && <span className={`tf-sex ${dino.sex}`} title={dino.sex}>{sexSymbol(dino.sex)}</span>}</h2>
      <p className="tf-epithet">{mates.length ? `${dino.sex === 'female' ? 'Partnerin' : 'Partner'} von ${mates.map(mate => mate.name).join(', ')}` : 'noch ungebunden'}</p>
      {traits.length > 0 && <p className="tf-entry-traits">{traits.join(' · ')}</p>}
      <dl className="tf-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <span className="tf-entry-open">ID-Akte öffnen →</span>
    </div>
  </a>;
}

export function TyloFile({ dino, playable, onOpenPhoto, onAddPhoto }: { dino: HerdDino; playable?: CatalogItem; onOpenPhoto: () => void; onAddPhoto: () => void }) {
  const family = familyOf(dino);
  const sexInfo = dino.sex ? bySex[dino.sex] : null;
  const g = dino.genetics;
  const mates = bondsOf(dino).filter(bond => mateKind.test(bond.kind));
  const others = bondsOf(dino).filter(bond => !mateKind.test(bond.kind));
  const origin = family.origin || (family.mother || family.father ? [family.mother, family.father].filter(Boolean).join(' × ') : '');
  const catalogId = family.catalogId || 'TY–';
  const facts: Array<[string, React.ReactNode, string?]> = [
    ['Geschlecht', sexInfo ? `${sexSymbol(dino.sex)} ${sexInfo.role}` : <i>offen</i>],
    ['Unterart', family.subspecies || <i>offen</i>, family.subspecies ? undefined : sexInfo?.subspecies],
    ['Herkunft', origin || <i>offen</i>],
    ['Bloodline', g?.bloodlines.length ? g.bloodlines.join(', ') : <i>keine eingetragen</i>],
    ['Im Register seit', formatDay(dino.createdAt)],
    ['Familie', familyLine(dino, mates)],
    ...(dino.diedAt ? [['Verstorben', `† ${formatDay(dino.diedAt)}`] as [string, string]] : []),
  ];
  return <article className="tf" aria-label={`ID-Akte ${dino.name}`}>
    <header className="tf-head">
      <Contours />
      <div className="tf-head-copy"><span>PHOTO-ID-KATALOG · TYLOSAURUS</span><strong>Küsten &amp; offene See</strong></div>
      <div className="tf-head-id"><span>KATALOG-NR.</span><strong>{catalogId}</strong></div>
      <div className="tf-ruler" aria-hidden="true" />
    </header>

    <div className="tf-hero">
      <figure className={`tf-plate${dino.photo ? '' : ' empty'}`}>
        {dino.photo
          ? <button type="button" onClick={onOpenPhoto} aria-label="Foto groß öffnen"><img src={herdApi.fileUrl(dino, dino.photo)} alt={dino.name} /></button>
          : <button type="button" onClick={onAddPhoto} className="tf-plate-empty"><TyloSketch sex={dino.sex} faint /><span><b>ID-Foto folgt</b><small>Foto unter „Akte bearbeiten“ hinzufügen</small></span></button>}
        <i className="tf-crop tl" /><i className="tf-crop tr" /><i className="tf-crop bl" /><i className="tf-crop br" />
        <figcaption><span>{catalogId} · {dino.name.toUpperCase()}</span><span>{dino.photo ? 'ID-FOTO' : 'KEIN FOTO'}</span></figcaption>
      </figure>
      <div className="tf-ident">
        <div className="tf-kicker">MY DINO · {playable?.name.toUpperCase() || 'TYLOSAURUS'}{sexInfo ? `-${sexInfo.role.toUpperCase()}` : ''}</div>
        <h1>{dino.name}{dino.sex && <span className={`tf-sex ${dino.sex}`} title={dino.sex}>{sexSymbol(dino.sex)}</span>}</h1>
        <p className="tf-epithet">{playable ? <a href={`#/profiles/${playable.id}`}>{playable.name}</a> : 'Tylosaurus'}{sexInfo && `-${sexInfo.role}`} · {mates.length ? `${dino.sex === 'female' ? 'Partnerin' : 'Partner'} von ${mates.map(mate => mate.name).join(', ')}` : 'noch ungebunden'}</p>
        <dl className="tf-facts">{facts.map(([label, value, hint]) => <div key={label}><dt>{label}</dt><dd>{value}{hint && <small>{hint}</small>}</dd></div>)}</dl>
        {(dino.proofs.nesting || dino.proofs.mutation) && <p className="tf-proofs">{dino.proofs.nesting && <Proof url={dino.proofs.nesting} label="Nest-Beweis" />}{dino.proofs.mutation && <Proof url={dino.proofs.mutation} label="Mutations-Beweis" />}</p>}
      </div>
    </div>

    <Section index="01" title="Erkennungsmerkmale" className="tf-marks">
      <div className="tf-marks-grid">
        <figure className="tf-sketch-frame"><TyloSketch sex={dino.sex} /><ul className="tf-note-list">{notesFor(dino.sex).map(note => <li key={note.title}><b>{note.title}</b>{note.text}</li>)}</ul><figcaption>Feldskizze, linke Seite{sexInfo && <> · <q>{sexInfo.dimorphism.slice(1, -1)}</q></>}</figcaption></figure>
        <div className="tf-tags">
          {g?.skins.dominant.map(skin => <div key={`d-${skin}`} className="tf-tag dominant"><span>DOMINANT · SICHTBAR</span><strong>{skin}</strong><small>Der Skin, den man im Spiel sieht.</small></div>)}
          {g?.skins.recessive.map(skin => <div key={`r-${skin}`} className="tf-tag recessive"><span>REZESSIV · VERDECKT</span><strong>{skin}</strong><small>Unsichtbar, kann an Kälber weitergegeben werden.</small></div>)}
          {g?.mutations.map(item => <div key={`m-${item.name}`} className="tf-tag mutation"><span>MUTATION</span><strong>{item.name}</strong>{item.note && <small>{item.note}</small>}</div>)}
          {!g?.skins.dominant.length && !g?.skins.recessive.length && <p className="tf-muted">Noch keine Skins eingetragen.</p>}
        </div>
      </div>
    </Section>

    <Section index="02" title="Verhalten &amp; Wesen" aside={<span className="tf-legend">FELDBEOBACHTUNG</span>}>
      <Behaviour dino={dino} catalogId={catalogId} />
    </Section>

    <Section index="03" title="Stammbaum" aside={<span className="tf-legend"><span><i className="tf-key male" />Bulle</span><span><i className="tf-key female" />Kuh</span><span><i className="tf-key unsexed" />offen</span></span>}>
      <Pedigree dino={dino} />
      <p className="tf-tree-note">Kälber hängen unter ihrer Mutter: Sie tragen ihren Bloodline-Namen und wachsen in ihrer Matrilinie auf.</p>
      {others.length > 0 && <p className="tf-others"><span>Weitere Bindungen</span>{others.map(bond => `${bond.name}${bond.sex ? ` ${sexSymbol(bond.sex)}` : ''}${bond.kind ? ` · ${bond.kind}` : ''}`).join('  ·  ')}</p>}
    </Section>

    <div className="tf-split">
      <Section index="04" title="Sichtungsprotokoll">
        {family.log.length ? <ol className="tf-log">{family.log.map((entry, index) => <li key={`${entry.date}-${index}`}><time dateTime={entry.date}>{formatDay(entry.date)}</time><p>{entry.text}{entry.place && <small> · {entry.place}</small>}</p></li>)}</ol>
          : <p className="tf-muted">Noch keine Einträge.</p>}
      </Section>
      <Section index="05" title="Aus dem Profil">
        <ul className="tf-quotes">{quotes.map(quote => <li key={quote.source}><blockquote>{quote.text}</blockquote><cite>Profil › {quote.source}</cite></li>)}</ul>
      </Section>
    </div>

    <footer className="tf-foot"><span>Akte geführt seit {formatDay(dino.createdAt)} · zuletzt ergänzt {formatDay(dino.updatedAt)}</span><span>Neue Kälber, Partnerinnen, Sichtungen oder Verhalten: <code>/aktualisiere {dino.name}</code></span></footer>
  </article>;
}
