import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Catalog, type CatalogItem } from './api';
import { bondsOf, characterOf, herdApi, isDeceased, isDiscordUrl, pendingCount, sexSymbol, type HerdBond, type HerdCharacter, type HerdDino, type HerdGenetics } from './herd';
import { DietPlace } from './DietPlaces';
import { ExternalLink, LinkedText } from './HerdLinks';
import { TitanFile, TitanHall } from './TitanFile';
import { TyloCatalog, TyloFile } from './TyloFile';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './herd.css';

// Your own Tylosaurus get the photo-ID file instead of the standard hero, your Tyrannotitan the Elden Ring hall.
const hasIdFile = (dino: HerdDino) => dino.playableId === 'tylosaurus';
const isTitan = (dino: HerdDino) => dino.playableId === 'tyrannotitan';

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const imageName = /\.(png|jpe?g|webp)$/i;

function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
const diedLabel = (dino: HerdDino) => dino.diedAt ? `† Died ${formatDate(`${dino.diedAt}T12:00:00`)}` : '';
const germanDate = (value: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
// Days between joining the herd (createdAt) and death; the hatch day itself is not recorded.
function herdDays(dino: HerdDino) {
  const days = Math.round((Date.parse(`${dino.diedAt}T12:00:00`) - Date.parse(`${dino.createdAt.slice(0, 10)}T12:00:00`)) / 86400000);
  return days >= 0 ? days : null;
}
function playableMap(catalog: Catalog | null) { return new Map((catalog?.profiles || []).map(profile => [profile.id, profile])); }
const byName = (a: HerdDino, b: HerdDino) => a.name.localeCompare(b.name, 'de');

// Your dinos by species, so two or more of one kind stand together. Variants of one profile
// (Spinosaurus freshwater / saltwater …) count as one species; the link only fits a single playable.
interface SpeciesGroup { key: string; name: string; profileId: string | null; dinos: HerdDino[] }
function speciesGroups(dinos: HerdDino[], playables: Map<string, CatalogItem>) {
  const groups = new Map<string, SpeciesGroup>();
  for (const dino of dinos) {
    const playable = dino.playableId ? playables.get(dino.playableId) : undefined;
    const key = playable?.variant?.parentId || playable?.id || '';
    const group = groups.get(key) || { key, name: playable?.variant?.parentName || playable?.name || 'Playable unknown', profileId: playable?.id || null, dinos: [] };
    if (group.profileId !== (playable?.id || null)) group.profileId = null;
    group.dinos.push(dino);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(group => ({ ...group, dinos: group.dinos.sort(byName) }));
}
const sexTally = (dinos: HerdDino[]) => (['female', 'male'] as const).map(sex => [sex, dinos.filter(dino => dino.sex === sex).length] as const).filter(([, count]) => count).map(([sex, count]) => `${sexSymbol(sex)} ${count}`).join(' · ');

// "My Dinos": your own dinosaurs. Screenshots are stored raw; the /aktualisiere skill in Claude reads
// them and fills bloodlines, skins and mutations. Links, photo and corrections are edited here.
export function HerdPage({ route }: { route: string }) {
  const id = route.split('/')[2] || null;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => { api.catalog().then(setCatalog).catch(() => setCatalog({ schemaVersion: 1, generatedAt: '', count: 0, profiles: [] })); }, []);
  if (!catalog) return <PageLoading label="Loading your dinos…" />;
  return id ? <HerdDetail id={id} catalog={catalog} /> : <HerdOverview catalog={catalog} />;
}

// "Friedhof": dead dinos leave My Dinos and rest here with all their data, newest grave first.
export function CemeteryPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [dead, setDead] = useState<HerdDino[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => setCatalog({ schemaVersion: 1, generatedAt: '', count: 0, profiles: [] }));
    herdApi.list().then(list => setDead(list.filter(isDeceased).sort((a, b) => b.diedAt!.localeCompare(a.diedAt!) || a.name.localeCompare(b.name, 'de')))).catch(cause => setError((cause as Error).message));
  }, []);
  const playables = useMemo(() => playableMap(catalog), [catalog]);
  if (error) return <PageError message={error} />;
  if (!dead || !catalog) return <PageLoading label="Loading the cemetery…" />;
  return <>
    <ExplorerTopline section="MY DINOS / FRIEDHOF" count={`${dead.length} ${dead.length === 1 ? 'GRAB' : 'GRÄBER'}`} />
    <header className="directory-head cemetery-head"><div><div className="eyebrow">DYNASTY REALISM · IN MEMORIAM</div><h1>Friedhof</h1><p>Hier ruhen deine verstorbenen Dinos. Bloodlines, Skins, Beweise und Screenshots bleiben erhalten.</p></div><div className="directory-actions"><button type="button" className="secondary-button" onClick={() => go('/herd')}>← My Dinos</button><div className="archive-metric cemetery-metric"><strong>{dead.length}</strong><span>{dead.length === 1 ? 'Grab' : 'Gräber'}</span></div></div></header>
    {dead.length ? <section className="cemetery-grid" aria-label="Verstorbene Dinos">{dead.map(dino => <Grave key={dino.id} dino={dino} playable={dino.playableId ? playables.get(dino.playableId) : undefined} />)}</section>
      : <div className="catalog-empty"><strong>Noch keine Gräber</strong><p>Alle deine Dinos leben.</p></div>}
  </>;
}

function Grave({ dino, playable }: { dino: HerdDino; playable?: CatalogItem }) {
  const days = herdDays(dino);
  const g = dino.genetics;
  return <button type="button" className="grave" onClick={() => go(`/herd/${dino.id}`)}>
    <div className="grave-image"><DinoImage dino={dino} playable={playable} /><div className="card-scrim" /></div>
    <div className="grave-body">
      <span className="grave-cross" aria-hidden="true">†</span>
      <h2>{dino.name}{dino.sex && <span className={`herd-sex ${dino.sex}`} title={dino.sex}>{sexSymbol(dino.sex)}</span>}</h2>
      <div className="grave-playable">{playable ? playable.name : 'Playable unbekannt'}</div>
      <div className="grave-date">† {germanDate(`${dino.diedAt}T12:00:00`)}</div>
      {days != null && <div className="grave-span">{days === 0 ? 'Am ersten Tag in deiner Herde gestorben' :`${days} ${days === 1 ? 'Tag' : 'Tage'} in deiner Herde`} · seit {germanDate(dino.createdAt)}</div>}
      {g && (g.bloodlines.length > 0 || g.skins.dominant.length > 0) && <div className="grave-genes">{g.bloodlines.map(item => <span key={item} className="herd-chip bloodline">{item}</span>)}{g.skins.dominant.map(item => <span key={item} className="herd-chip dominant">{item}</span>)}{g.mutations.map(item => <span key={item.name} className="herd-chip mutation">{item.name}</span>)}</div>}
    </div>
  </button>;
}

function HerdOverview({ catalog }: { catalog: Catalog }) {
  const [dinos, setDinos] = useState<HerdDino[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const playables = useMemo(() => playableMap(catalog), [catalog]);
  const refresh = useCallback(() => herdApi.list().then(list => { setDinos(list); if (!list.length) setImportOpen(true); }).catch(cause => setError((cause as Error).message)), []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (error) return <PageError message={error} />;
  if (!dinos) return <PageLoading label="Loading your dinos…" />;
  const living = dinos.filter(dino => !isDeceased(dino)); // the dead rest in the Friedhof
  const dead = dinos.filter(isDeceased);
  const needle = query.trim().toLowerCase();
  const filtered = living.filter(dino => {
    if (!needle) return true;
    const g = dino.genetics;
    const playable = dino.playableId ? playables.get(dino.playableId) : null;
    return [dino.name, playable?.name || '', ...(playable?.aliases || []), ...(g ? [...g.bloodlines, ...g.skins.dominant, ...g.skins.recessive, ...g.mutations.map(item => item.name)] : []), ...bondsOf(dino).map(bond => bond.name), ...characterOf(dino).traits].join(' ').toLowerCase().includes(needle);
  });
  const pending = dinos.filter(dino => pendingCount(dino) > 0);
  // Tylosaurus have their own catalogue band on top, Tyrannotitan their hall below it. The rest live
  // by diet on the flower meadow or in the bone pit; a species with two or more dinos gets a heading there.
  const tylos = filtered.filter(hasIdFile);
  const titans = filtered.filter(isTitan);
  const rest = filtered.filter(dino => !hasIdFile(dino) && !isTitan(dino));
  const dietOf = (dino: HerdDino) => (dino.playableId && playables.get(dino.playableId)?.classification.diet) || '';
  const herbivores = rest.filter(dino => dietOf(dino) === 'Herbivore');
  const carnivores = rest.filter(dino => dietOf(dino) === 'Carnivore');
  const unsorted = rest.filter(dino => !['Herbivore', 'Carnivore'].includes(dietOf(dino))).sort(byName);
  const card = (dino: HerdDino, grouped = false) => <HerdCard key={dino.id} dino={dino} playable={dino.playableId ? playables.get(dino.playableId) : undefined} grouped={grouped} />;
  const bySpecies = (list: HerdDino[]) => {
    const groups = speciesGroups(list, playables);
    const singles = groups.filter(group => group.dinos.length === 1).flatMap(group => group.dinos);
    return <>
      {groups.filter(group => group.dinos.length > 1).map(group => <section key={group.key} className="herd-species" aria-label={group.name}>
        <header className="herd-species-head"><h2>{group.name}</h2><span>{group.dinos.length} dinos{sexTally(group.dinos) && ` · ${sexTally(group.dinos)}`}</span>{group.profileId && <a href={`#/profiles/${group.profileId}`}>Profile →</a>}</header>
        <div className="herd-grid">{group.dinos.map(dino => card(dino, true))}</div>
      </section>)}
      {singles.length > 0 && <div className="herd-grid">{singles.map(dino => card(dino))}</div>}
    </>;
  };
  return <>
    <ExplorerTopline section="MY DINOS" count={`${living.length} ${living.length === 1 ? 'DINO' : 'DINOS'}`} />
    <header className="directory-head"><div><div className="eyebrow">DYNASTY REALISM · YOUR HERD</div><h1>My Dinos</h1><p>Bloodlines, skins, mutations and proof for every dino you own. Screenshots stay stored exactly as imported.</p></div><div className="directory-actions"><button type="button" className="primary-button" onClick={() => setImportOpen(open => !open)} aria-expanded={importOpen}>{importOpen ? 'Close import' : '+ Import screenshots'}</button><div className="archive-metric"><strong>{living.length}</strong><span>{living.length === 1 ? 'dino' : 'dinos'} in your herd</span></div></div></header>
    {importOpen && <HerdImport catalog={catalog} dinos={dinos} onSaved={() => void refresh()} />}
    {pending.length > 0 && <SkillHint dinos={pending} />}
    {living.length > 0 && <section className="filter-bar herd-filter" aria-label="Filter dinos"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, playable, bloodline, skin, mutation or bond…" aria-label="Search your dinos" /></label></section>}
    {living.length === 0 ? null : filtered.length ? <div className="herd-sections">
      {tylos.length > 0 && <TyloCatalog dinos={tylos} />}
      {titans.length > 0 && <TitanHall dinos={titans} playable={playables.get('tyrannotitan')} />}
      {herbivores.length > 0 && <DietPlace diet="herbivore" count={herbivores.length}>{bySpecies(herbivores)}</DietPlace>}
      {carnivores.length > 0 && <DietPlace diet="carnivore" count={carnivores.length}>{bySpecies(carnivores)}</DietPlace>}
      {unsorted.length > 0 && <section className="herd-species" aria-label="Playable not set">
        <header className="herd-species-head"><h2>Playable not set</h2><span>run /aktualisiere to read it</span></header>
        <div className="herd-grid">{unsorted.map(dino => card(dino))}</div>
      </section>}
    </div> : <div className="catalog-empty"><strong>No matching dinos</strong><p>Try another name, skin or mutation.</p></div>}
    {dead.length > 0 && <button type="button" className="cemetery-link" onClick={() => go('/friedhof')}><span aria-hidden="true">†</span><div><strong>Friedhof</strong><small>{dead.map(dino => dino.name).join(' · ')}</small></div><b>{dead.length} {dead.length === 1 ? 'Grab' : 'Gräber'} →</b></button>}
  </>;
}

function SkillHint({ dinos }: { dinos: HerdDino[] }) {
  const total = dinos.reduce((sum, dino) => sum + pendingCount(dino), 0);
  return <div className="herd-skill-hint" role="status">
    <span className="herd-skill-icon" aria-hidden="true">⟳</span>
    <div><strong>{total} {total === 1 ? 'screenshot waits' : 'screenshots wait'} to be read</strong><p>{dinos.map(dino => `${dino.name} (${pendingCount(dino)})`).join(' · ')}</p></div>
    <code title="Type this in Claude: it asks which dino to update and fills in the details">/aktualisiere</code>
  </div>;
}

// Picks images from a drop, the file dialog or Ctrl+V while it is on screen.
function ImageDrop({ files, onFiles, label, hint }: { files: File[]; onFiles: (files: File[]) => void; label: string; hint: string }) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = useCallback((list: FileList | File[]) => {
    const valid = Array.from(list).filter(file => imageTypes.has(file.type) || imageName.test(file.name))
      .map((file, index) => imageName.test(file.name) ? file : new File([file], `pasted-${Date.now()}-${index + 1}.png`, { type: file.type }));
    if (valid.length) onFiles([...files, ...valid]);
  }, [files, onFiles]);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const images = Array.from(event.clipboardData?.files || []).filter(file => imageTypes.has(file.type));
      if (!images.length) return;
      event.preventDefault();
      add(images);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [add]);
  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  return <div>
    <div className={`dropzone herd-drop ${dragging ? 'dragging' : ''}`} role="group" aria-label={label} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }}>
      <div className="upload-icon" aria-hidden="true">↑</div><strong>{label}</strong><span>{hint}</span>
      <button type="button" className="secondary-button" onClick={() => input.current?.click()}>Choose images</button>
      <small>Paste with Ctrl+V · PNG, JPG, WEBP</small>
      <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden onChange={event => { if (event.target.files) add(event.target.files); event.target.value = ''; }} />
    </div>
    {files.length > 0 && <div className="herd-thumbs">{files.map((file, index) => <figure key={previews[index]}><img src={previews[index]} alt="" /><button type="button" aria-label={`Remove ${file.name}`} onClick={() => onFiles(files.filter((_, at) => at !== index))}>×</button></figure>)}</div>}
  </div>;
}

function PhotoPick({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="herd-photo-pick">
    {preview ? <img src={preview} alt="" /> : <span aria-hidden="true">◐</span>}
    <div><strong>Photo</strong><small>A nice shot of the dino (optional)</small></div>
    <button type="button" className="secondary-button" onClick={() => input.current?.click()}>{file ? 'Change' : 'Choose photo'}</button>
    {file && <button type="button" className="text-button" onClick={() => onFile(null)}>Remove</button>}
    <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden onChange={event => { onFile(event.target.files?.[0] || null); event.target.value = ''; }} />
  </div>;
}

function PlayableSelect({ catalog, value, onChange, id }: { catalog: Catalog; value: string; onChange: (value: string) => void; id: string }) {
  const sorted = [...catalog.profiles].sort((a, b) => a.name.localeCompare(b.name));
  return <select id={id} value={value} onChange={event => onChange(event.target.value)}><option value="">Unknown – let /aktualisiere read it</option>{sorted.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>;
}

function HerdImport({ catalog, dinos, onSaved }: { catalog: Catalog; dinos: HerdDino[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [playable, setPlayable] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [mutationProof, setMutationProof] = useState('');
  const [nestingProof, setNestingProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const existing = dinos.find(dino => !isDeceased(dino) && dino.name.trim().toLowerCase() === name.trim().toLowerCase()); // a dead namesake gets a successor
  useEffect(() => { if (existing?.playableId) setPlayable(existing.playableId); }, [existing?.id]);
  async function save() {
    if (!name.trim()) { setNotice({ type: 'error', text: 'Enter the name of your dino.' }); return; }
    if (!screenshots.length && !photo && !mutationProof.trim() && !nestingProof.trim()) { setNotice({ type: 'error', text: 'Add at least one screenshot, a photo or a proof link.' }); return; }
    setBusy(true); setNotice(null);
    const form = new FormData();
    form.append('name', name.trim());
    if (playable) form.append('playableId', playable);
    screenshots.forEach(file => form.append('screenshots', file, file.name));
    if (photo) form.append('photo', photo, photo.name);
    if (mutationProof.trim()) form.append('mutationProof', mutationProof.trim());
    if (nestingProof.trim()) form.append('nestingProof', nestingProof.trim());
    try {
      const saved = await herdApi.upload(form);
      setNotice({ type: 'success', text: screenshots.length ? `${screenshots.length} ${screenshots.length === 1 ? 'screenshot' : 'screenshots'} saved raw for ${saved.name}. Type /aktualisiere in Claude to read them.` : `Saved for ${saved.name}.` });
      setName(''); setPlayable(''); setScreenshots([]); setPhoto(null); setMutationProof(''); setNestingProof('');
      onSaved();
    } catch (error) { setNotice({ type: 'error', text: (error as Error).message }); }
    finally { setBusy(false); }
  }
  return <section className="herd-import" aria-labelledby="herd-import-title">
    <div className="section-heading"><div><span className="step">↧</span><h2 id="herd-import-title">Import screenshots</h2></div><span className="small-tag">STORED RAW</span></div>
    {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
    <div className="herd-import-fields">
      <label><span>Dino name <b className="required">*</b></span><input value={name} onChange={event => setName(event.target.value)} list="herd-names" placeholder="e.g. Malekit" autoComplete="off" /><datalist id="herd-names">{dinos.filter(dino => !isDeceased(dino)).map(dino => <option key={dino.id} value={dino.name} />)}</datalist><small>{existing ? <>Adds to <b>{existing.name}</b> ({existing.screenshots.length} screenshots so far)</> : name.trim() ? 'New dino' : 'An existing name adds the screenshots to that dino'}</small></label>
      <label><span>Playable</span><PlayableSelect id="herd-playable" catalog={catalog} value={playable} onChange={setPlayable} /><small>Optional. The skill can also read it from the screenshot.</small></label>
    </div>
    <ImageDrop files={screenshots} onFiles={setScreenshots} label="Drop screenshots here" hint="Bloodline, skin and mutation screens, nest or Discord posts" />
    <PhotoPick file={photo} onFile={setPhoto} />
    <div className="herd-import-fields herd-import-links">
      <label><span>Mutation proof <i>optional</i></span><input type="url" value={mutationProof} onChange={event => setMutationProof(event.target.value)} placeholder="https://discord.com/channels/…" /><small>{existing?.proofs.mutation ? 'Already linked – a new link replaces it' : 'Discord message that proves the mutation'}</small></label>
      <label><span>Nesting proof <i>optional</i></span><input type="url" value={nestingProof} onChange={event => setNestingProof(event.target.value)} placeholder="https://discord.com/channels/…" /><small>{existing?.proofs.nesting ? 'Already linked – a new link replaces it' : 'Link to the nest or hatching post'}</small></label>
    </div>
    <div className="save-row"><div><strong>Saved exactly as captured</strong><span>Then type <code>/aktualisiere</code> in Claude and pick the dino.</span></div><button type="button" className="primary-button" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'} <span aria-hidden="true">→</span></button></div>
  </section>;
}

function Chips({ items, kind }: { items: string[]; kind: string }) {
  return <span className="herd-chips">{items.map(item => <span key={item} className={`herd-chip ${kind}`}>{item}</span>)}</span>;
}

// The genetics at a glance; used on cards, the detail page and the profile strip.
export function GeneticsRows({ genetics, proofs, full = false }: { genetics: HerdGenetics | null; proofs?: HerdDino['proofs']; full?: boolean }) {
  if (!genetics) return <p className="herd-empty-genetics">Not read yet – run <code>/aktualisiere</code> in Claude.</p>;
  const rows: Array<[string, React.ReactNode]> = [];
  if (genetics.bloodlines.length || full) rows.push(['Bloodlines', genetics.bloodlines.length ? <Chips items={genetics.bloodlines} kind="bloodline" /> : <i>none</i>]);
  if (genetics.skins.dominant.length || full) rows.push(['Dominant', genetics.skins.dominant.length ? <Chips items={genetics.skins.dominant} kind="dominant" /> : <i>none</i>]);
  if (genetics.skins.recessive.length || full) rows.push(['Recessive', genetics.skins.recessive.length ? <Chips items={genetics.skins.recessive} kind="recessive" /> : <i>none</i>]);
  if (genetics.mutations.length || full) rows.push(['Mutations', genetics.mutations.length ? <span className="herd-chips">{genetics.mutations.map(item => <span key={item.name} className="herd-chip mutation" title={item.note || undefined}>{item.name}{full && item.note && <small> · {item.note}</small>}</span>)}{proofs?.mutation && <ExternalLink className="herd-proof-mini" url={proofs.mutation} title="Mutation proof">proof ↗</ExternalLink>}</span> : <i>none</i>]);
  if (full) genetics.extra.forEach(item => rows.push([item.label, <LinkedText text={item.value} />]));
  return <dl className="herd-genetics">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

const bondLabel = (bond: HerdBond) => [`${bond.name}${bond.sex ? ` ${sexSymbol(bond.sex)}` : ''}`, bond.status || bond.kind].filter(Boolean).join(' · ');

// One line for cards and the profile strip: the first bond, and how many more there are.
function BondLine({ dino }: { dino: HerdDino }) {
  const bonds = bondsOf(dino);
  if (!bonds.length) return null;
  return <p className="herd-bond-line" title={bonds.map(bondLabel).join('\n')}><span aria-hidden="true">♥</span>{bondLabel(bonds[0])}{bonds.length > 1 && <i> +{bonds.length - 1}</i>}</p>;
}

function DinoImage({ dino, playable }: { dino: HerdDino; playable?: CatalogItem }) {
  if (dino.photo) return <img src={herdApi.fileUrl(dino, dino.photo)} alt={dino.name} loading="lazy" />;
  if (playable?.cover) return <img className="herd-fallback" src={api.imageUrl(playable.id, playable.cover.file)} alt="" loading="lazy" />;
  return <span className="herd-initial">{dino.name.charAt(0)}</span>;
}

// Under a species heading the playable line only names a variant (Spinosaurus (Saltwater) …).
function HerdCard({ dino, playable, grouped = false }: { dino: HerdDino; playable?: CatalogItem; grouped?: boolean }) {
  const pending = pendingCount(dino);
  const playableLine = !grouped ? playable ? playable.name : 'Playable unknown' : playable?.variant ? playable.name : '';
  return <button type="button" className={`herd-card${isDeceased(dino) ? ' deceased' : ''}`} onClick={() => go(`/herd/${dino.id}`)}>
    <div className="herd-card-image"><DinoImage dino={dino} playable={playable} /><div className="card-scrim" />{isDeceased(dino) ? <span className="herd-died">{diedLabel(dino)}</span> : !dino.photo && <span className="herd-no-photo">No photo yet</span>}{pending > 0 && <span className="herd-pending">{pending} to read</span>}</div>
    <div className="herd-card-body">
      <div className="herd-card-title"><h2>{dino.name}{dino.sex && <span className={`herd-sex ${dino.sex}`} title={dino.sex}>{sexSymbol(dino.sex)}</span>}</h2><span aria-hidden="true">↗</span></div>
      {playableLine && <div className="herd-card-playable">{playableLine}</div>}
      <GeneticsRows genetics={dino.genetics} proofs={dino.proofs} />
      <BondLine dino={dino} />
      {(dino.proofs.mutation || dino.proofs.nesting) && <div className="herd-proof-flags">{dino.proofs.mutation && <span>✓ Mutation proof</span>}{dino.proofs.nesting && <span>✓ Nesting proof</span>}</div>}
    </div>
  </button>;
}

const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
const splitPair = (line: string, separator: RegExp) => { const [head, ...rest] = line.split(separator); return [head.trim(), rest.join(' ').trim()]; };

function HerdDetail({ id, catalog }: { id: string; catalog: Catalog }) {
  const [dino, setDino] = useState<HerdDino | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newShots, setNewShots] = useState<File[]>([]);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const tools = useRef<HTMLDetailsElement>(null);
  const playables = useMemo(() => playableMap(catalog), [catalog]);
  useEffect(() => { setDino(null); herdApi.get(id).then(setDino).catch(cause => setError((cause as Error).message)); window.scrollTo(0, 0); }, [id]);
  if (error) return <PageError message={error} />;
  if (!dino) return <PageLoading label="Loading dino…" />;
  const playable = dino.playableId ? playables.get(dino.playableId) : undefined;
  const pending = pendingCount(dino);

  async function run(action: () => Promise<HerdDino>, success: string) {
    setBusy(true); setNotice(null);
    try { setDino(await action()); setNotice({ type: 'success', text: success }); return true; }
    catch (cause) { setNotice({ type: 'error', text: (cause as Error).message }); return false; }
    finally { setBusy(false); }
  }
  async function upload() {
    const form = new FormData();
    form.append('id', dino!.id);
    newShots.forEach(file => form.append('screenshots', file, file.name));
    if (newPhoto) form.append('photo', newPhoto, newPhoto.name);
    const count = newShots.length;
    if (await run(() => herdApi.upload(form), count ? `${count} ${count === 1 ? 'screenshot' : 'screenshots'} saved raw. Type /aktualisiere in Claude to read them.` : 'Photo saved.')) { setNewShots([]); setNewPhoto(null); }
  }
  async function remove() {
    setBusy(true);
    try { await herdApi.remove(dino!.id); go('/herd'); }
    catch (cause) { setNotice({ type: 'error', text: (cause as Error).message }); setBusy(false); setConfirmDelete(false); }
  }
  const idFile = hasIdFile(dino);
  const titan = isTitan(dino);
  const openTools = () => {
    if (!tools.current) return;
    tools.current.open = true;
    (tools.current.querySelector('.herd-photo-pick') || tools.current).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  // On an ID file or a titan page the editing panels fold away below it.
  const foldTools = (children: React.ReactNode) => idFile || titan
    ? <details ref={tools} className="tf-tools"><summary>{idFile ? 'Akte bearbeiten' : 'Bearbeiten'} <small>Genetik, Bindungen, Foto und Screenshots</small></summary><div className="tf-tools-body">{children}</div></details>
    : children;
  const openPhoto = () => dino.photo && setLightbox(herdApi.fileUrl(dino, dino.photo));

  return <>
    <ExplorerTopline section="MY DINOS / DETAIL" count={dino.name.toUpperCase()} />
    {isDeceased(dino) ? <button className="back-link" type="button" onClick={() => go('/friedhof')}>← Friedhof</button> : <button className="back-link" type="button" onClick={() => go('/herd')}>← All my dinos</button>}
    <article className="herd-detail">
      {idFile ? <TyloFile dino={dino} playable={playable} onOpenPhoto={openPhoto} onAddPhoto={openTools} />
        : titan ? <TitanFile dino={dino} playable={playable} onOpenPhoto={openPhoto} onAddPhoto={openTools} /> : <header className="herd-hero">
        <button type="button" className="herd-hero-image" onClick={() => dino.photo && setLightbox(herdApi.fileUrl(dino, dino.photo))} disabled={!dino.photo} aria-label={dino.photo ? 'Open photo' : 'No photo yet'}><DinoImage dino={dino} playable={playable} />{!dino.photo && <span className="herd-no-photo">No photo yet</span>}</button>
        <div className="herd-hero-copy">
          <div className="profile-kicker">MY DINO{playable?.classification.label ? ` · ${playable.classification.label}` : ''}</div>
          <h1>{dino.name}{dino.sex && <span className={`herd-sex ${dino.sex}`} title={dino.sex}>{sexSymbol(dino.sex)}</span>}</h1>
          <p className="herd-hero-playable">{playable ? <a href={`#/profiles/${playable.id}`}>{playable.name} profile →</a> : 'Playable not set yet'}</p>
          {isDeceased(dino) && <p className="herd-hero-died">{diedLabel(dino)}</p>}
          <div className="herd-hero-proofs">
            {dino.proofs.mutation ? <ExternalLink className="herd-proof" url={dino.proofs.mutation}><b>Mutation proof</b><span>{isDiscordUrl(dino.proofs.mutation) ? 'Discord ↗' : 'Open ↗'}</span></ExternalLink> : <span className="herd-proof missing"><b>Mutation proof</b><span>not linked</span></span>}
            {dino.proofs.nesting ? <ExternalLink className="herd-proof" url={dino.proofs.nesting}><b>Nesting proof</b><span>{isDiscordUrl(dino.proofs.nesting) ? 'Discord ↗' : 'Open ↗'}</span></ExternalLink> : <span className="herd-proof missing"><b>Nesting proof</b><span>not linked</span></span>}
          </div>
          <p className="herd-hero-meta">{dino.screenshots.length} {dino.screenshots.length === 1 ? 'screenshot' : 'screenshots'}{pending > 0 && <> · <b>{pending} waiting for /aktualisiere</b></>} · updated {formatDate(dino.updatedAt)}</p>
        </div>
      </header>}
      {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

      {foldTools(<>
      <section className="herd-panel">
        <div className="herd-panel-head"><h2>Genetics &amp; proof</h2>{!editing && <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Edit</button>}</div>
        {editing ? <HerdEditor dino={dino} catalog={catalog} busy={busy} onCancel={() => setEditing(false)} onSave={async patch => { if (await run(() => herdApi.update(dino.id, patch), 'Changes saved.')) setEditing(false); }} /> : <>
          <GeneticsRows genetics={dino.genetics} proofs={dino.proofs} full />
          {dino.notes && <p className="herd-notes"><LinkedText text={dino.notes} /></p>}
          {dino.genetics && <p className="herd-foot">Read from screenshots on {formatDate(dino.genetics.updatedAt)}. Check against the screenshots below.</p>}
        </>}
      </section>

      <BondsPanel dino={dino} busy={busy} onSave={patch => run(() => herdApi.update(dino.id, patch), 'Bonds and character saved.')} />

      <section className="herd-panel">
        <div className="herd-panel-head"><h2>Screenshots</h2><span className="small-tag">STORED RAW · NEVER CHANGED</span></div>
        {dino.screenshots.length ? <div className="herd-shots">{[...dino.screenshots].reverse().map(shot => <figure key={shot.file} className={shot.processedAt ? '' : 'pending'}>
          <button type="button" onClick={() => setLightbox(herdApi.fileUrl(dino, shot.file))}><img src={herdApi.fileUrl(dino, shot.file)} alt={`Screenshot from ${formatDate(shot.addedAt)}`} loading="lazy" /></button>
          <figcaption><span>{shot.processedAt ? `✓ read ${formatDate(shot.processedAt)}` : '⟳ waiting for /aktualisiere'}</span><small>added {formatDate(shot.addedAt)}</small>
            {shot.transcript && <details><summary>Text read</summary><pre>{shot.transcript}</pre></details>}
            <button type="button" className="text-button danger" disabled={busy} onClick={() => { if (window.confirm('Remove this screenshot from the dino? The file is deleted.')) void run(() => herdApi.removeFile(dino.id, shot.file), 'Screenshot removed.'); }}>Remove</button>
          </figcaption>
        </figure>)}</div> : <p className="herd-empty-genetics">No screenshots yet.</p>}
        <div className="herd-add">
          <ImageDrop files={newShots} onFiles={setNewShots} label="Add screenshots" hint="New bloodline, skin or mutation screens" />
          <PhotoPick file={newPhoto} onFile={setNewPhoto} />
          {dino.photo && !newPhoto && <button type="button" className="text-button danger" disabled={busy} onClick={() => void run(() => herdApi.removeFile(dino.id, dino.photo!), 'Photo removed.')}>Remove current photo</button>}
          {(newShots.length > 0 || newPhoto) && <div className="save-row"><div><strong>Ready to add?</strong><span>Files are stored exactly as captured.</span></div><button type="button" className="primary-button" disabled={busy} onClick={() => void upload()}>{busy ? 'Saving…' : 'Save files'} <span aria-hidden="true">→</span></button></div>}
        </div>
      </section>
      </>)}

      <div className="herd-danger"><button type="button" className="text-button danger" onClick={() => setConfirmDelete(true)}>Delete {dino.name}…</button></div>
    </article>
    {confirmDelete && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirmDelete(false); }}><div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="herd-delete-title"><div className="modal-icon">!</div><h2 id="herd-delete-title">Delete {dino.name}?</h2><p>This removes the dino, its photo and all {dino.screenshots.length} raw screenshots from <code>data/herd/{dino.id}/</code>.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button><button type="button" className="danger-button" onClick={() => void remove()} disabled={busy}>Delete dino</button></div></div></div>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setLightbox(null)}><button type="button" aria-label="Close image" onClick={() => setLightbox(null)}>×</button><img src={lightbox} alt="Full size" /></div>}
  </>;
}

function HerdEditor({ dino, catalog, busy, onSave, onCancel }: { dino: HerdDino; catalog: Catalog; busy: boolean; onSave: (patch: Parameters<typeof herdApi.update>[1]) => void; onCancel: () => void }) {
  const g = dino.genetics;
  const [name, setName] = useState(dino.name);
  const [playable, setPlayable] = useState(dino.playableId || '');
  const [sex, setSex] = useState(dino.sex || '');
  const [diedAt, setDiedAt] = useState(dino.diedAt || '');
  const [bloodlines, setBloodlines] = useState(g?.bloodlines.join('\n') || '');
  const [dominant, setDominant] = useState(g?.skins.dominant.join('\n') || '');
  const [recessive, setRecessive] = useState(g?.skins.recessive.join('\n') || '');
  const [mutations, setMutations] = useState(g?.mutations.map(item => item.note ? `${item.name} — ${item.note}` : item.name).join('\n') || '');
  const [extra, setExtra] = useState(g?.extra.map(item => `${item.label}: ${item.value}`).join('\n') || '');
  const [mutationProof, setMutationProof] = useState(dino.proofs.mutation);
  const [nestingProof, setNestingProof] = useState(dino.proofs.nesting);
  const [notes, setNotes] = useState(dino.notes);
  function submit() {
    const genetics = {
      bloodlines: lines(bloodlines),
      skins: { dominant: lines(dominant), recessive: lines(recessive) },
      mutations: lines(mutations).map(line => { const [name, note] = splitPair(line, /\s+[—–-]\s+/); return { name, note }; }),
      extra: lines(extra).map(line => { const [label, value] = splitPair(line, /:\s*/); return { label, value }; }),
    };
    const empty = !genetics.bloodlines.length && !genetics.skins.dominant.length && !genetics.skins.recessive.length && !genetics.mutations.length && !genetics.extra.length;
    onSave({ name, playableId: playable || null, sex: (sex || null) as HerdDino['sex'], diedAt, notes, proofs: { mutation: mutationProof, nesting: nestingProof }, genetics: empty && !g ? null : genetics });
  }
  return <form className="herd-editor" onSubmit={event => { event.preventDefault(); submit(); }}>
    <div className="herd-editor-grid four">
      <label><span>Name</span><input value={name} onChange={event => setName(event.target.value)} required /></label>
      <label><span>Playable</span><PlayableSelect id="herd-edit-playable" catalog={catalog} value={playable} onChange={setPlayable} /></label>
      <label><span>Sex</span><select value={sex} onChange={event => setSex(event.target.value)}><option value="">Unknown</option><option value="female">♀ Female</option><option value="male">♂ Male</option></select></label>
      <label><span>Died on <small>empty = alive</small></span><input type="date" value={diedAt} onChange={event => setDiedAt(event.target.value)} /></label>
    </div>
    <div className="herd-editor-grid">
      <label><span>Bloodlines <small>one per line</small></span><textarea value={bloodlines} onChange={event => setBloodlines(event.target.value)} rows={3} /></label>
      <label><span>Dominant skins <small>one per line</small></span><textarea value={dominant} onChange={event => setDominant(event.target.value)} rows={3} /></label>
      <label><span>Recessive skins <small>one per line</small></span><textarea value={recessive} onChange={event => setRecessive(event.target.value)} rows={3} /></label>
    </div>
    <div className="herd-editor-grid two">
      <label><span>Mutations <small>“Name — note”, one per line</small></span><textarea value={mutations} onChange={event => setMutations(event.target.value)} rows={3} /></label>
      <label><span>Other details <small>“Label: value”, one per line</small></span><textarea value={extra} onChange={event => setExtra(event.target.value)} rows={3} /></label>
    </div>
    <div className="herd-editor-grid two">
      <label><span>Mutation proof <small>Discord message link</small></span><input type="url" value={mutationProof} onChange={event => setMutationProof(event.target.value)} placeholder="https://discord.com/channels/…" /></label>
      <label><span>Nesting proof <small>link</small></span><input type="url" value={nestingProof} onChange={event => setNestingProof(event.target.value)} placeholder="https://discord.com/channels/…" /></label>
    </div>
    <label className="herd-editor-notes"><span>Notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} /></label>
    <div className="herd-editor-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

// Bonds (pair bonds, harem, family …) and character, for playables with a social life.
function BondsPanel({ dino, busy, onSave }: { dino: HerdDino; busy: boolean; onSave: (patch: { bonds: HerdBond[]; character: HerdCharacter }) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const bonds = bondsOf(dino);
  const character = characterOf(dino);
  const empty = !bonds.length && !character.traits.length && !character.text;
  return <section className="herd-panel">
    <div className="herd-panel-head"><h2>Bonds &amp; character</h2>{!editing && <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Edit</button>}</div>
    {editing ? <BondsEditor dino={dino} busy={busy} onCancel={() => setEditing(false)} onSave={async patch => { if (await onSave(patch)) setEditing(false); }} />
      : empty ? <p className="herd-empty-genetics">No bonds or character noted yet.</p> : <>
        {bonds.length > 0 && <ul className="herd-bonds">{bonds.map((bond, index) => <li key={`${bond.name}-${index}`}>
          <strong>{bond.name}{bond.sex && <span className={`herd-sex ${bond.sex}`} title={bond.sex}>{sexSymbol(bond.sex)}</span>}</strong>
          {bond.kind && <span className="herd-chip bond">{bond.kind}</span>}{bond.status && <span className="herd-bond-status">{bond.status}</span>}{bond.bloodline && <span className="herd-chip bloodline">{bond.bloodline}</span>}
          {bond.note && <small>{bond.note}</small>}
        </li>)}</ul>}
        {(character.traits.length > 0 || character.text) && <dl className="herd-genetics herd-character">
          {character.traits.length > 0 && <div><dt>Traits</dt><dd><Chips items={character.traits} kind="trait" /></dd></div>}
          {character.text && <div><dt>Character</dt><dd><LinkedText text={character.text} /></dd></div>}
        </dl>}
      </>}
  </section>;
}

const bondKinds = ['Bindung', 'Lebenspartner', 'Harem', 'Familie', 'Freund'];
const bondStatuses = ['bondet gerade', 'fest', 'beendet'];

function BondsEditor({ dino, busy, onSave, onCancel }: { dino: HerdDino; busy: boolean; onSave: (patch: { bonds: HerdBond[]; character: HerdCharacter }) => void; onCancel: () => void }) {
  const character = characterOf(dino);
  const [bonds, setBonds] = useState<HerdBond[]>(bondsOf(dino));
  const [traits, setTraits] = useState(character.traits.join('\n'));
  const [text, setText] = useState(character.text);
  const change = (index: number, field: keyof HerdBond, value: string) => setBonds(list => list.map((bond, at) => at === index ? { ...bond, [field]: field === 'sex' ? (value || null) : value } : bond));
  return <form className="herd-editor" onSubmit={event => { event.preventDefault(); onSave({ bonds: bonds.filter(bond => bond.name.trim()), character: { traits: lines(traits), text } }); }}>
    <div className="herd-bond-rows">
      {bonds.map((bond, index) => <div key={index} className="herd-bond-row">
        <label><span>Name</span><input value={bond.name} onChange={event => change(index, 'name', event.target.value)} placeholder="e.g. Kamoda Fern" /></label>
        <label><span>Sex</span><select value={bond.sex || ''} onChange={event => change(index, 'sex', event.target.value)}><option value="">Unknown</option><option value="female">♀ Female</option><option value="male">♂ Male</option></select></label>
        <label><span>Kind</span><input value={bond.kind} onChange={event => change(index, 'kind', event.target.value)} list="herd-bond-kinds" /></label>
        <label><span>Status</span><input value={bond.status} onChange={event => change(index, 'status', event.target.value)} list="herd-bond-statuses" /></label>
        <label className="half"><span>Bloodline</span><input value={bond.bloodline || ''} onChange={event => change(index, 'bloodline', event.target.value)} placeholder="e.g. The Endless Depths" /></label>
        <label className="wide"><span>Note</span><input value={bond.note} onChange={event => change(index, 'note', event.target.value)} placeholder="Skin, how you met …" /></label>
        <button type="button" className="text-button danger" onClick={() => setBonds(list => list.filter((_, at) => at !== index))} aria-label={`Remove bond ${bond.name || index + 1}`}>Remove</button>
      </div>)}
      <button type="button" className="secondary-button" onClick={() => setBonds(list => [...list, { name: '', sex: null, kind: 'Bindung', status: '', bloodline: '', note: '' }])}>+ Add bond</button>
      <datalist id="herd-bond-kinds">{bondKinds.map(kind => <option key={kind} value={kind} />)}</datalist>
      <datalist id="herd-bond-statuses">{bondStatuses.map(status => <option key={status} value={status} />)}</datalist>
    </div>
    <div className="herd-editor-grid two">
      <label><span>Traits <small>one per line</small></span><textarea value={traits} onChange={event => setTraits(event.target.value)} rows={3} /></label>
      <label><span>Character <small>free text</small></span><textarea value={text} onChange={event => setText(event.target.value)} rows={3} /></label>
    </div>
    <div className="herd-editor-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

// Small collapsed bar on a playable's profile: which of your dinos are this playable.
export function HerdStrip({ playableId }: { playableId: string }) {
  const [dinos, setDinos] = useState<HerdDino[]>([]);
  useEffect(() => { setDinos([]); herdApi.list(playableId).then(setDinos).catch(() => setDinos([])); }, [playableId]);
  if (!dinos.length) return null;
  return <details className="herd-strip">
    <summary><span className="herd-strip-mark" aria-hidden="true">◆</span><span>Your {dinos.length === 1 ? 'dino' : 'dinos'}</span><b>{dinos.map(dino => `${dino.name}${dino.sex ? ` ${sexSymbol(dino.sex)}` : ''}${isDeceased(dino) ? ' †' : ''}`).join(', ')}</b><i aria-hidden="true">▾</i></summary>
    <div className="herd-strip-list">{dinos.map(dino => <div key={dino.id} className="herd-strip-item">
      <div className="herd-strip-photo">{dino.photo ? <img src={herdApi.fileUrl(dino, dino.photo)} alt="" loading="lazy" /> : <span>{dino.name.charAt(0)}</span>}</div>
      <div className="herd-strip-body"><a href={`#/herd/${dino.id}`}><strong>{dino.name}</strong> open →</a><GeneticsRows genetics={dino.genetics} proofs={dino.proofs} /><BondLine dino={dino} />{dino.proofs.nesting && <ExternalLink className="herd-proof-mini" url={dino.proofs.nesting}>nesting proof ↗</ExternalLink>}</div>
    </div>)}</div>
  </details>;
}
