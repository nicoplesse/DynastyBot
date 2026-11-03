import { api, type CatalogItem } from './api';
import { bondsOf, characterOf, herdApi, pendingCount, sexSymbol, type HerdDino } from './herd';
import { ExternalLink, LinkedText } from './HerdLinks';
import './titan.css';

// Your own Tyrannotitan are named after Elden Ring demigods, so they get a menu in that spirit:
// gold hairlines, diamond rules, roman numerals and the profile's own words as item lore.

const dayFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDay = (value: string) => dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00`));
const numerals: Array<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function roman(value: number) {
  let rest = value;
  let out = '';
  for (const [step, glyph] of numerals) while (rest >= step) { rest -= step; out += glyph; }
  return out || '0';
}

// Profile › Physical Dimorphism and the official summary, quoted verbatim.
const bySex = {
  female: { role: 'Bache', greeting: '“Female Tyrannotitan, known as sows, greet other Tyrannotitan by dipping their head briefly, then raising it high and shaking their neck quietly.”' },
  male: { role: 'Keiler', greeting: '“Male Tyrannotitan, known as boars, greet other Tyrannotitan by dipping their heads low and then shaking their heads rapidly with a deep rumble.”' },
};
const lore = [
  { text: '“Tyrannotitan are nocturnal apex predators known for their brutal aggression and hunting methods - often dousing themselves entirely in the blood of their prey or rivals.”', source: 'Kurzbeschreibung' },
  { text: '“They can often be heard before they are seen - broadcasting loud, haunting calls throughout the night in their search for prey.”', source: 'Kurzbeschreibung' },
];

// "Other details" carry subspecies and eyes under several spellings; the rest is the lineage.
const subspeciesLabel = /unterart|subspecies/i;
const eyesLabel = /augen|eye/i;
const extraValue = (dino: HerdDino, label: RegExp) => dino.genetics?.extra.find(item => label.test(item.label))?.value || '';
const lineageOf = (dino: HerdDino) => (dino.genetics?.extra || []).filter(item => !subspeciesLabel.test(item.label) && !eyesLabel.test(item.label));
const byName = (a: HerdDino, b: HerdDino) => a.name.localeCompare(b.name, 'de');

const Rule = ({ small = false }: { small?: boolean }) => <div className={`er-rule${small ? ' small' : ''}`} aria-hidden="true"><i /></div>;
const Corners = () => <><i className="er-corner tl" /><i className="er-corner tr" /><i className="er-corner bl" /><i className="er-corner br" /></>;

function Portrait({ dino, playable }: { dino: HerdDino; playable?: CatalogItem }) {
  if (dino.photo) return <img src={herdApi.fileUrl(dino, dino.photo)} alt={dino.name} loading="lazy" />;
  if (playable?.cover) return <img className="er-fallback" src={api.imageUrl(playable.id, playable.cover.file)} alt="" loading="lazy" />;
  return <span className="er-initial">{dino.name.charAt(0)}</span>;
}

const sexLine = (dino: HerdDino) => dino.sex ? `${sexSymbol(dino.sex)} ${bySex[dino.sex].role}` : 'Geschlecht offen';
const bloodlineLine = (dino: HerdDino) => dino.genetics?.bloodlines.length ? <>Blutlinie <b>{dino.genetics.bloodlines.join(', ')}</b></> : <>ohne Blutlinie</>;

// My Dinos overview: all your living Tyrannotitan in one hall, cards like item entries.
export function TitanHall({ dinos, playable }: { dinos: HerdDino[]; playable?: CatalogItem }) {
  const females = dinos.filter(dino => dino.sex === 'female').length;
  const males = dinos.filter(dino => dino.sex === 'male').length;
  return <section className="er er-hall" aria-label="Tyrannotitan">
    <Corners />
    <header className="er-hall-head">
      <span className="er-kicker"><i className="er-grace" aria-hidden="true" />{playable?.classification.label?.toUpperCase() || 'TYRANNOTITAN'}</span>
      <h2>Tyrannotitan</h2>
      <p className="er-sub">Halbgötter der Herde{(females || males) ? ` · ${[females && `♀ ${females}`, males && `♂ ${males}`].filter(Boolean).join(' · ')}` : ''}</p>
      <div className="er-count"><span>TITANEN</span><strong>{roman(dinos.length)}</strong></div>
      {playable && <a className="er-link er-hall-profile" href={`#/profiles/${playable.id}`}>Profil ›</a>}
    </header>
    <Rule />
    <div className="er-hall-grid">{[...dinos].sort(byName).map(dino => <TitanCard key={dino.id} dino={dino} playable={playable} />)}</div>
  </section>;
}

function TitanCard({ dino, playable }: { dino: HerdDino; playable?: CatalogItem }) {
  const g = dino.genetics;
  const pending = pendingCount(dino);
  return <a className="er-card" href={`#/herd/${dino.id}`} aria-label={`${dino.name} öffnen`}>
    <figure className="er-portrait">
      <Portrait dino={dino} playable={playable} />
      {!dino.photo && <span className="er-portrait-note">Kein Bild</span>}
      {pending > 0 && <span className="er-pending">{pending} zu lesen</span>}
    </figure>
    <div className="er-card-body">
      <span className="er-kicker">{sexLine(dino).toUpperCase()}</span>
      <h3>{dino.name}</h3>
      <p className="er-epithet">{bloodlineLine(dino)}</p>
      <Rule small />
      <dl className="er-stats">
        <div><dt>Dominant</dt><dd>{g?.skins.dominant.join(', ') || '—'}</dd></div>
        <div><dt>Rezessiv</dt><dd>{g?.skins.recessive.join(', ') || '—'}</dd></div>
        {g?.mutations.length ? <div className="mutation"><dt>Mutation</dt><dd>{g.mutations.map(item => item.name).join(', ')}</dd></div> : null}
      </dl>
      {(dino.proofs.mutation || dino.proofs.nesting) && <p className="er-card-proofs">{dino.proofs.mutation && <span>◆ Mutations-Beweis</span>}{dino.proofs.nesting && <span>◆ Nest-Beweis</span>}</p>}
    </div>
  </a>;
}

function Section({ index, title, children, className }: { index: number; title: string; children: React.ReactNode; className?: string }) {
  return <section className={`er-section${className ? ` ${className}` : ''}`}>
    <header className="er-section-head"><span>{roman(index)}</span><h2>{title}</h2></header>
    {children}
  </section>;
}

// The detail page of one Tyrannotitan; the editing panels fold away below it.
export function TitanFile({ dino, playable, onOpenPhoto, onAddPhoto }: { dino: HerdDino; playable?: CatalogItem; onOpenPhoto: () => void; onAddPhoto: () => void }) {
  const g = dino.genetics;
  const bonds = bondsOf(dino);
  const character = characterOf(dino);
  const lineage = lineageOf(dino);
  const subspecies = extraValue(dino, subspeciesLabel);
  const eyes = extraValue(dino, eyesLabel);
  const attributes: Array<[string, React.ReactNode]> = [
    ['Geschlecht', dino.sex ? sexLine(dino) : <i>offen</i>],
    ['Blutlinie', g?.bloodlines.length ? g.bloodlines.join(', ') : <i>keine</i>],
    ['Unterart', subspecies || <i>offen</i>],
    ['Augen', eyes || <i>offen</i>],
    ['Im Register seit', formatDay(dino.createdAt)],
    ['Bindungen', bonds.length ? bonds.map(bond => bond.name).join(', ') : <i>keine</i>],
  ];
  const quotes = [...(dino.sex ? [{ text: bySex[dino.sex].greeting, source: 'Physical Dimorphism' }] : []), ...lore];
  return <article className={`er er-file${dino.diedAt ? ' fallen' : ''}`} aria-label={`${dino.name}, Tyrannotitan`}>
    <Corners />
    <header className="er-file-head">
      <span className="er-kicker"><i className="er-grace" aria-hidden="true" />MY DINO · TYRANNOTITAN</span>
      <span className="er-kicker">{playable?.classification.label?.toUpperCase() || ''}</span>
    </header>

    <div className="er-hero">
      <figure className={`er-plate${dino.photo ? '' : ' empty'}`}>
        <button type="button" onClick={dino.photo ? onOpenPhoto : onAddPhoto} aria-label={dino.photo ? 'Foto groß öffnen' : 'Foto hinzufügen'}><Portrait dino={dino} playable={playable} /></button>
        {!dino.photo && <span className="er-portrait-note">Kein Bild · unter „Bearbeiten“ hinzufügen</span>}
        {dino.diedAt && <div className="er-felled"><strong>GEFALLEN</strong><span>{formatDay(dino.diedAt)}</span></div>}
        <Corners />
      </figure>
      <div className="er-ident">
        <span className="er-kicker">{sexLine(dino).toUpperCase()}</span>
        <h1>{dino.name}</h1>
        <p className="er-epithet">{bloodlineLine(dino)}{playable && <> · <a className="er-link" href={`#/profiles/${playable.id}`}>Tyrannotitan-Profil ›</a></>}</p>
        <Rule />
        <dl className="er-attrs">{attributes.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {(dino.proofs.mutation || dino.proofs.nesting) && <p className="er-proofs">{dino.proofs.nesting && <ExternalLink className="er-link" url={dino.proofs.nesting}>Nest-Beweis ↗</ExternalLink>}{dino.proofs.mutation && <ExternalLink className="er-link" url={dino.proofs.mutation}>Mutations-Beweis ↗</ExternalLink>}</p>}
      </div>
    </div>

    <Section index={1} title="Erscheinung">
      <div className="er-slots">
        {g?.skins.dominant.map(skin => <div key={`d-${skin}`} className="er-slot dominant"><span>DOMINANT · SICHTBAR</span><strong>{skin}</strong><small>Der Skin, den man im Spiel sieht.</small></div>)}
        {g?.skins.recessive.map(skin => <div key={`r-${skin}`} className="er-slot recessive"><span>REZESSIV · VERBORGEN</span><strong>{skin}</strong><small>Unsichtbar, kann vererbt werden.</small></div>)}
        {g?.mutations.map(item => <div key={`m-${item.name}`} className="er-slot mutation"><span>MUTATION</span><strong>{item.name}</strong>{item.note && <small>{item.note}</small>}</div>)}
        {!g?.skins.dominant.length && !g?.skins.recessive.length && <p className="er-muted">Noch keine Skins eingetragen.</p>}
      </div>
    </Section>

    <Section index={2} title="Abstammung">
      {lineage.length ? <dl className="er-attrs er-lineage">{lineage.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd><LinkedText text={item.value} className="er-link" /></dd></div>)}</dl>
        : <p className="er-muted">Noch keine Eltern oder Herkunft eingetragen.</p>}
    </Section>

    <div className="er-split">
      <Section index={3} title="Bindungen & Wesen">
        {bonds.length > 0 && <ul className="er-bonds">{bonds.map((bond, index) => <li key={`${bond.name}-${index}`}>
          <strong>{bond.name}{bond.sex && <i> {sexSymbol(bond.sex)}</i>}</strong>
          <span>{[bond.kind, bond.status, bond.bloodline].filter(Boolean).join(' · ')}</span>
          {bond.note && <small>{bond.note}</small>}
        </li>)}</ul>}
        {character.traits.length > 0 && <p className="er-traits">{character.traits.join(' · ')}</p>}
        {character.text && <p className="er-lore">{character.text}</p>}
        {!bonds.length && !character.traits.length && !character.text && <p className="er-muted">Noch keine Bindungen oder Wesenszüge eingetragen.</p>}
      </Section>
      <Section index={4} title="Aus dem Profil">
        <ul className="er-quotes">{quotes.map(quote => <li key={quote.text}><blockquote>{quote.text}</blockquote><cite>Profil › {quote.source}</cite></li>)}</ul>
      </Section>
    </div>

    <footer className="er-foot"><span>Im Register seit {formatDay(dino.createdAt)} · zuletzt ergänzt {formatDay(dino.updatedAt)}</span><span>Neue Skins, Eltern oder Bindungen: <code>/aktualisiere {dino.name}</code></span></footer>
  </article>;
}
