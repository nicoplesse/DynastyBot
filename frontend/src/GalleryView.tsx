import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, type Catalog, type CatalogItem } from './api';
import { herdApi, isDeceased, sexSymbol, type HerdDino } from './herd';
import { galleryApi, galleryFileUrl, type GalleryImage, type GalleryPatch } from './gallery';
import { ExplorerTopline, PageError, PageLoading } from './ui';
import './gallery.css';

// "Galerie": every own image in data/gallery/. Each one can say which of your dinos it shows, which
// species and whether it is a background (landscape, mood). Dino photos and evidence photos of kills only
// point at gallery images, so an image stays here even when it is a dino's face.
type View = 'all' | 'open' | 'backgrounds' | 'used';
const views: Array<{ id: View; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'open', label: 'Nicht eingeordnet' },
  { id: 'backgrounds', label: 'Hintergründe' },
  { id: 'used', label: 'Profil- & Belegfotos' },
];
const inView: Record<View, (image: GalleryImage) => boolean> = {
  all: () => true,
  open: image => !image.classified,
  backgrounds: image => image.background,
  used: image => image.uses.length > 0,
};
const imageFile = /\.(png|jpe?g|webp)$/i;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const isImage = (file: File) => imageTypes.has(file.type) || imageFile.test(file.name);
const germanDate = (value: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const fileSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de');
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

function routeFilters(route: string) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  const view = params.get('view') as View | null;
  return { view: view && view in inView ? view : 'all' as View, dino: params.get('dino') || '', species: params.get('species') || '' };
}

export function GalleryPage({ route }: { route: string }) {
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [dinos, setDinos] = useState<HerdDino[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => routeFilters(route));
  const [open, setOpen] = useState<{ file: string; order: string[] } | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  // A link like #/gallery?dino=aller (from My Dinos) sets the filters.
  useEffect(() => { setFilters(routeFilters(route)); }, [route]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.view !== 'all') params.set('view', filters.view);
    if (filters.dino) params.set('dino', filters.dino);
    if (filters.species) params.set('species', filters.species);
    const query = params.toString();
    window.history.replaceState(null, '', `#/gallery${query ? `?${query}` : ''}`);
  }, [filters]);

  const reload = useCallback(() => galleryApi.list().then(result => { setImages(result.images); setError(''); }).catch(cause => setError((cause as Error).message)), []);
  const reloadDinos = useCallback(() => herdApi.list().then(setDinos).catch(() => setDinos([])), []);
  useEffect(() => {
    void reload();
    void reloadDinos();
    api.catalog().then(setCatalog).catch(() => setCatalog({ schemaVersion: 1, generatedAt: '', count: 0, profiles: [] }));
  }, [reload, reloadDinos]);
  // Images saved into the folder by hand show up when you come back to the window.
  useEffect(() => {
    const focus = () => { void reload(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [reload]);

  const upload = useCallback(async (list: File[]) => {
    const files = list.filter(isImage).map((file, index) => imageFile.test(file.name) ? file : new File([file], `eingefuegt-${Date.now()}-${index + 1}.png`, { type: file.type }));
    if (!files.length) { setNotice({ type: 'error', text: 'Nur PNG-, JPG- und WEBP-Bilder gehen in die Galerie.' }); return; }
    setUploading(true); setNotice(null);
    try {
      const added = await galleryApi.upload(files);
      await reload();
      setNotice({ type: 'success', text: `${added.length} ${added.length === 1 ? 'Bild' : 'Bilder'} in data/gallery/ gespeichert. Ordne ${added.length === 1 ? 'es' : 'sie'} gleich ein.` });
      setOpen({ file: added[0].file, order: added.map(image => image.file) });
    } catch (cause) { setNotice({ type: 'error', text: (cause as Error).message }); }
    finally { setUploading(false); }
  }, [reload]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []).filter(isImage);
      if (!files.length) return;
      event.preventDefault();
      void upload(files);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [upload]);

  const dinoById = useMemo(() => new Map(dinos.map(dino => [dino.id, dino])), [dinos]);
  const playables = useMemo(() => new Map((catalog?.profiles || []).map(profile => [profile.id, profile])), [catalog]);
  if (error && !images) return <PageError message={error} />;
  if (!images || !catalog) return <PageLoading label="Galerie wird geladen…" />;

  const scoped = images.filter(image => (!filters.dino || image.dinos.includes(filters.dino)) && (!filters.species || image.species.includes(filters.species)));
  const shown = scoped.filter(inView[filters.view]);
  const unclassified = images.filter(image => !image.classified);
  const backgrounds = images.filter(image => image.background);
  // A background image of the day lies behind the heading.
  const backdrop = backgrounds.length ? backgrounds[Math.floor(Date.now() / 86400000) % backgrounds.length] : null;
  const tally = (pick: (image: GalleryImage) => string[]) => {
    const counts = new Map<string, number>();
    images.forEach(image => pick(image).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
    return counts;
  };
  const dinoCounts = tally(image => image.dinos);
  const speciesCounts = tally(image => image.species);
  const dinoOptions = [...new Set([...dinoCounts.keys(), filters.dino].filter(Boolean))].map(id => ({ id, name: dinoById.get(id)?.name || id })).sort(byName);
  const speciesOptions = [...new Set([...speciesCounts.keys(), filters.species].filter(Boolean))].map(id => ({ id, name: playables.get(id)?.name || id })).sort(byName);
  const setFilter = (patch: Partial<typeof filters>) => setFilters(current => ({ ...current, ...patch }));
  const openImage = (file: string, order = shown.map(image => image.file)) => setOpen({ file, order });
  const current = open ? images.find(image => image.file === open.file) : undefined;
  const replace = (image: GalleryImage) => setImages(list => list && list.map(item => item.file === image.file ? image : item));

  return <div
    className="gal-page"
    onDragEnter={event => { if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); dragDepth.current += 1; setDragging(true); }}
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
    onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
    onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); dragDepth.current = 0; setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}
  >
    <ExplorerTopline section="GALERIE" count={`${images.length} ${images.length === 1 ? 'BILD' : 'BILDER'}`} />
    <header className={`directory-head gal-head${backdrop ? ' has-backdrop' : ''}`} style={backdrop ? { '--gal-backdrop': `url("${galleryFileUrl(backdrop.file)}")` } as CSSProperties : undefined}>
      <div>
        <div className="eyebrow">DYNASTY REALISM · DEINE BILDER</div>
        <h1>Galerie</h1>
        <p>Alle deine Bilder an einem Ort. Sag bei jedem, welcher Dino, welche Spezies oder ob es ein Hintergrund ist. Profilbilder deiner Dinos zeigen nur hierher.</p>
        <p className="gal-folder">Ordner <code>data/gallery/</code> · Bilder, die du selbst dort hineinlegst, erscheinen hier als „nicht eingeordnet“. <button type="button" className="text-button" onClick={() => { void reload(); setNotice({ type: 'success', text: 'Ordner neu eingelesen.' }); }}>↻ Neu einlesen</button></p>
      </div>
      <div className="directory-actions">
        <button type="button" className="primary-button" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? 'Speichert…' : '+ Bilder hinzufügen'}</button>
        <div className="archive-metric"><strong>{images.length}</strong><span>{images.length === 1 ? 'Bild' : 'Bilder'} in der Galerie</span></div>
      </div>
      <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden onChange={event => { if (event.target.files) void upload(Array.from(event.target.files)); event.target.value = ''; }} />
    </header>

    {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Meldung schließen">×</button></div>}

    {unclassified.length > 0 && <div className="gal-triage" role="status">
      <span className="gal-triage-icon" aria-hidden="true">◌</span>
      <div><strong>{unclassified.length} {unclassified.length === 1 ? 'Bild wartet' : 'Bilder warten'} auf Einordnung</strong><p>Du siehst {unclassified.length === 1 ? 'es' : 'sie'} trotzdem in der Galerie. Einordnen geht Bild für Bild.</p></div>
      <button type="button" className="secondary-button" onClick={() => openImage(unclassified[0].file, unclassified.map(image => image.file))}>Jetzt einordnen →</button>
    </div>}

    {images.length > 0 && <section className="gal-filters" aria-label="Galerie filtern">
      <div className="gal-views" role="tablist" aria-label="Ansicht">
        {views.map(view => {
          const count = scoped.filter(inView[view.id]).length;
          return <button key={view.id} type="button" role="tab" aria-selected={filters.view === view.id} className={`${filters.view === view.id ? 'active' : ''}${view.id === 'open' && count ? ' attention' : ''}`} onClick={() => setFilter({ view: view.id })}>{view.label}<b>{count}</b></button>;
        })}
      </div>
      <label className="gal-select"><span>Dino</span><select value={filters.dino} onChange={event => setFilter({ dino: event.target.value })}><option value="">Alle Dinos</option>{dinoOptions.map(option => <option key={option.id} value={option.id}>{option.name} ({dinoCounts.get(option.id) || 0})</option>)}</select></label>
      <label className="gal-select"><span>Spezies</span><select value={filters.species} onChange={event => setFilter({ species: event.target.value })}><option value="">Alle Spezies</option>{speciesOptions.map(option => <option key={option.id} value={option.id}>{option.name} ({speciesCounts.get(option.id) || 0})</option>)}</select></label>
    </section>}

    {images.length === 0 ? <button type="button" className="dropzone gal-empty" onClick={() => input.current?.click()}>
      <div className="upload-icon" aria-hidden="true">↑</div><strong>Noch keine Bilder</strong><span>Zieh Bilder hierher, füg sie mit Strg+V ein oder leg sie in <code>data/gallery/</code>.</span>
    </button> : shown.length ? <div className="gal-grid">
      {shown.map(image => <GalleryTile key={image.file} image={image} dinoById={dinoById} playables={playables} onOpen={() => openImage(image.file)} />)}
    </div> : <div className="catalog-empty"><strong>Keine Bilder für diese Auswahl</strong><p><button type="button" className="text-button" onClick={() => setFilters({ view: 'all', dino: '', species: '' })}>Filter zurücksetzen</button></p></div>}

    {dragging && <div className="gal-dropping" aria-hidden="true"><div><span>↑</span><strong>Loslassen, um die Bilder in die Galerie zu legen</strong><small>Sie landen in data/gallery/ und warten dann auf Einordnung.</small></div></div>}

    {open && current && <GalleryDetail
      key={current.file}
      image={current}
      order={open.order.filter(file => images.some(image => image.file === file))}
      images={images}
      dinos={dinos}
      dinoById={dinoById}
      playables={playables}
      profiles={catalog.profiles}
      onGo={file => setOpen(state => state && { ...state, file })}
      onClose={() => setOpen(null)}
      onSaved={replace}
      onPhoto={async (dinoId, photo) => {
        const dino = await herdApi.update(dinoId, { photo });
        setDinos(list => list.map(item => item.id === dino.id ? dino : item));
        await reload();
      }}
      onDeleted={async (file, order) => {
        const at = order.indexOf(file);
        const next = order.filter(item => item !== file)[Math.min(at, order.length - 2)];
        await reload();
        await reloadDinos();
        setOpen(next ? { file: next, order: order.filter(item => item !== file) } : null);
        setNotice({ type: 'success', text: 'Bild gelöscht.' });
      }}
    />}
  </div>;
}

function tileTitle(image: GalleryImage, dinoById: Map<string, HerdDino>, playables: Map<string, CatalogItem>) {
  const dinoNames = image.dinos.map(id => dinoById.get(id)?.name || id);
  const speciesNames = image.species.map(id => playables.get(id)?.name || id);
  const title = image.caption || dinoNames.join(' · ') || speciesNames.join(' · ') || (image.background ? 'Hintergrund' : 'Nicht eingeordnet');
  const sub = [image.caption ? dinoNames.join(' · ') : '', image.caption || dinoNames.length ? speciesNames.join(' · ') : ''].filter(Boolean).join(' — ');
  return { title, sub };
}

function GalleryTile({ image, dinoById, playables, onOpen }: { image: GalleryImage; dinoById: Map<string, HerdDino>; playables: Map<string, CatalogItem>; onOpen: () => void }) {
  const { title, sub } = tileTitle(image, dinoById, playables);
  const photoOf = image.uses.filter(use => use.kind === 'photo').map(use => use.dinoName);
  const events = image.uses.filter(use => use.kind === 'event');
  return <button type="button" className={`gal-tile${image.classified ? '' : ' open'}`} onClick={onOpen} title={image.file}>
    <img src={galleryFileUrl(image.file)} alt={title} loading="lazy" />
    <div className="gal-tile-flags">
      {!image.classified && <span className="new">Nicht eingeordnet</span>}
      {photoOf.length > 0 && <span className="photo" title={`Profilbild von ${photoOf.join(', ')}`}>★ Profilbild</span>}
      {events.length > 0 && <span className="event" title={events.map(use => `${use.dinoName}: ${use.subject}`).join('\n')}>⚑ Beleg</span>}
      {image.background && <span className="background">Hintergrund</span>}
    </div>
    <div className="gal-tile-caption"><strong>{title}</strong>{sub && <small>{sub}</small>}</div>
  </button>;
}

interface DetailProps {
  image: GalleryImage; order: string[]; images: GalleryImage[]; dinos: HerdDino[]; dinoById: Map<string, HerdDino>;
  playables: Map<string, CatalogItem>; profiles: CatalogItem[];
  onGo: (file: string) => void; onClose: () => void; onSaved: (image: GalleryImage) => void;
  onPhoto: (dinoId: string, photo: string | null) => Promise<void>; onDeleted: (file: string, order: string[]) => Promise<void>;
}

function GalleryDetail({ image, order, images, dinos, dinoById, playables, profiles, onGo, onClose, onSaved, onPhoto, onDeleted }: DetailProps) {
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' });
  const [caption, setCaption] = useState(image.caption);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDead, setShowDead] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const at = order.indexOf(image.file);
  const previous = at > 0 ? order[at - 1] : null;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
  // The next unclassified image: further along this run first, then anywhere in the gallery.
  const nextOpen = [...order.slice(at + 1), ...images.map(item => item.file)].find(file => file !== image.file && images.find(item => item.file === file && !item.classified)) || null;

  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (confirmDelete) setConfirmDelete(false); else onClose(); return; }
      if (editing(event.target)) return;
      if (event.key === 'ArrowLeft' && previous) { event.preventDefault(); onGo(previous); }
      if (event.key === 'ArrowRight' && next) { event.preventDefault(); onGo(next); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [confirmDelete, previous, next, onGo, onClose]);

  async function save(patch: GalleryPatch) {
    const optimistic = { ...image, ...patch };
    onSaved({ ...optimistic, classified: optimistic.dinos.length > 0 || optimistic.species.length > 0 || optimistic.background });
    setStatus({ kind: 'saving' });
    try { onSaved(await galleryApi.update(image.file, patch)); setStatus({ kind: 'saved' }); }
    catch (cause) { onSaved(image); setStatus({ kind: 'error', text: (cause as Error).message }); }
  }
  function toggleDino(dino: HerdDino) {
    const has = image.dinos.includes(dino.id);
    const patch: GalleryPatch = { dinos: has ? image.dinos.filter(id => id !== dino.id) : [...image.dinos, dino.id] };
    // Picking a dino brings its species along; taking it away leaves the species, the image may still show one.
    if (!has && dino.playableId && !image.species.includes(dino.playableId)) patch.species = [...image.species, dino.playableId];
    void save(patch);
  }
  async function photo(dinoId: string, value: string | null, text: string) {
    setStatus({ kind: 'saving' });
    try { await onPhoto(dinoId, value); setStatus({ kind: 'saved', text }); }
    catch (cause) { setStatus({ kind: 'error', text: (cause as Error).message }); }
  }
  async function remove() {
    setStatus({ kind: 'saving' });
    try { await galleryApi.remove(image.file); await onDeleted(image.file, order); }
    catch (cause) { setStatus({ kind: 'error', text: (cause as Error).message }); setConfirmDelete(false); }
  }
  const saveCaption = () => { if (caption.trim() !== image.caption) void save({ caption: caption.trim() }); };

  const living = dinos.filter(dino => !isDeceased(dino)).sort(byName);
  const dead = dinos.filter(isDeceased).sort(byName);
  const shownDead = dead.filter(dino => showDead || image.dinos.includes(dino.id));
  const missingDinos = image.dinos.filter(id => !dinoById.has(id));
  const freeProfiles = profiles.filter(profile => !image.species.includes(profile.id)).sort(byName);
  const ref = `gallery/${image.file}`;
  const pictured = image.dinos.map(id => dinoById.get(id)).filter((dino): dino is HerdDino => !!dino);
  const events = image.uses.filter(use => use.kind === 'event');
  const { title } = tileTitle(image, dinoById, playables);

  return <div className="gal-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="gal-detail" role="dialog" aria-modal="true" aria-label={`Bild: ${title}`} tabIndex={-1} ref={dialog}>
      <div className="gal-stage">
        <img src={galleryFileUrl(image.file)} alt={title} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
        {previous && <button type="button" className="gal-nav prev" onClick={() => onGo(previous)} aria-label="Vorheriges Bild">‹</button>}
        {next && <button type="button" className="gal-nav next" onClick={() => onGo(next)} aria-label="Nächstes Bild">›</button>}
        {order.length > 1 && at >= 0 && <span className="gal-position">{at + 1} / {order.length}</span>}
      </div>

      <aside className="gal-panel">
        <div className="gal-panel-head">
          <div><span className={`gal-state ${image.classified ? 'done' : 'open'}`}>{image.classified ? '✓ Eingeordnet' : '◌ Nicht eingeordnet'}</span>
            <span className={`gal-save ${status.kind}`} role="status">{status.kind === 'saving' ? 'Speichert…' : status.kind === 'saved' ? `✓ ${status.text || 'Gespeichert'}` : status.kind === 'error' ? `! ${status.text}` : ''}</span></div>
          <button type="button" className="gal-close" onClick={onClose} aria-label="Schließen">×</button>
        </div>

        <label className="gal-field"><span>Titel <i>optional</i></span>
          <input value={caption} onChange={event => setCaption(event.target.value)} onBlur={saveCaption} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveCaption(); } }} placeholder="z. B. Allers Jagd auf den Spino" maxLength={200} />
        </label>

        <section className="gal-section" aria-labelledby="gal-dinos-title">
          <h3 id="gal-dinos-title">Welcher Dino?</h3>
          {dinos.length ? <div className="gal-dino-chips">
            {[...living, ...shownDead].map(dino => {
              const selected = image.dinos.includes(dino.id);
              return <button key={dino.id} type="button" className={`gal-dino-chip${selected ? ' selected' : ''}${isDeceased(dino) ? ' dead' : ''}`} aria-pressed={selected} onClick={() => toggleDino(dino)} title={dino.playableId ? playables.get(dino.playableId)?.name : undefined}>
                <span className="gal-avatar">{dino.photo ? <img src={herdApi.fileUrl(dino, dino.photo)} alt="" loading="lazy" /> : dino.name.charAt(0)}</span>
                <span>{isDeceased(dino) && '† '}{dino.name}{dino.sex && <i>{sexSymbol(dino.sex)}</i>}</span>
                {selected && <b aria-hidden="true">✓</b>}
              </button>;
            })}
            {missingDinos.map(id => <button key={id} type="button" className="gal-dino-chip selected gone" onClick={() => void save({ dinos: image.dinos.filter(item => item !== id) })} title="Diesen Dino gibt es nicht mehr – zum Entfernen klicken"><span className="gal-avatar">?</span><span>{id}</span><b aria-hidden="true">×</b></button>)}
          </div> : <p className="gal-hint">Noch keine eigenen Dinos. Leg sie unter <a href="#/herd">My Dinos</a> an.</p>}
          {dead.length > 0 && dead.length > shownDead.length && <button type="button" className="text-button gal-more" onClick={() => setShowDead(true)}>† Verstorbene zeigen ({dead.length - shownDead.length})</button>}
        </section>

        <section className="gal-section" aria-labelledby="gal-species-title">
          <h3 id="gal-species-title">Welche Spezies?</h3>
          <div className="gal-species">
            {image.species.map(id => <span key={id} className="gal-species-chip">{playables.get(id)?.name || id}<button type="button" onClick={() => void save({ species: image.species.filter(item => item !== id) })} aria-label={`${playables.get(id)?.name || id} entfernen`}>×</button></span>)}
            <select className="gal-species-add" value="" onChange={event => { if (event.target.value) void save({ species: [...image.species, event.target.value] }); }} aria-label="Spezies hinzufügen">
              <option value="">+ Spezies hinzufügen</option>
              {freeProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </div>
          <p className="gal-hint">Wählst du einen Dino, kommt seine Spezies von selbst dazu. Beute oder andere Tiere im Bild fügst du hier hinzu.</p>
        </section>

        <section className="gal-section">
          <button type="button" role="switch" aria-checked={image.background} className={`gal-switch${image.background ? ' on' : ''}`} onClick={() => void save({ background: !image.background })}>
            <span className="gal-switch-track" aria-hidden="true"><span /></span>
            <span><strong>Hintergrund</strong><small>Landschaft oder Stimmung, ohne bestimmten Dino im Mittelpunkt</small></span>
          </button>
        </section>

        {(pictured.length > 0 || image.uses.length > 0) && <section className="gal-section" aria-labelledby="gal-uses-title">
          <h3 id="gal-uses-title">Profilbild</h3>
          <ul className="gal-uses">
            {pictured.map(dino => dino.photo === ref
              ? <li key={dino.id} className="current"><span>★ Profilbild von <a href={`#/herd/${dino.id}`}>{dino.name}</a></span><button type="button" className="text-button" onClick={() => void photo(dino.id, null, `Nicht mehr Profilbild von ${dino.name}`)}>Lösen</button></li>
              : <li key={dino.id}><button type="button" className="secondary-button" onClick={() => void photo(dino.id, ref, `Profilbild von ${dino.name}`)}>★ Als Profilbild von {dino.name}</button>{dino.photo && <small>Das bisherige bleibt in der Galerie.</small>}</li>)}
            {image.uses.filter(use => use.kind === 'photo' && !pictured.some(dino => dino.id === use.dinoId)).map(use => <li key={use.dinoId} className="current"><span>★ Profilbild von <a href={`#/herd/${use.dinoId}`}>{use.dinoName}</a></span></li>)}
            {events.map(use => <li key={`${use.dinoId}-${use.date}-${use.subject}`} className="event"><span>⚑ Belegfoto: <a href={`#/herd/${use.dinoId}`}>{use.dinoName}</a> · {use.subject}{use.date && `, ${germanDate(`${use.date}T12:00:00`)}`}</span></li>)}
          </ul>
          {!pictured.length && !image.uses.some(use => use.kind === 'photo') && <p className="gal-hint">Wähl oben einen Dino, um das Bild zu seinem Profilbild zu machen.</p>}
        </section>}

        {nextOpen && <button type="button" className="primary-button gal-next-open" onClick={() => onGo(nextOpen)}>Nächstes nicht eingeordnete →</button>}

        <dl className="gal-info">
          <div><dt>Datei</dt><dd><code>{image.file}</code></dd></div>
          <div><dt>Auflösung</dt><dd>{size ? `${size.width} × ${size.height}` : '…'}</dd></div>
          <div><dt>Größe</dt><dd>{fileSize(image.size)}</dd></div>
          <div><dt>Hinzugefügt</dt><dd>{germanDate(image.addedAt)}</dd></div>
          {image.originalFileName && image.originalFileName !== image.file && <div><dt>Ursprünglich</dt><dd>{image.originalFileName}</dd></div>}
        </dl>
        <div className="gal-actions">
          <a className="text-button" href={galleryFileUrl(image.file)} target="_blank" rel="noreferrer">Original öffnen ↗</a>
          {confirmDelete ? <div className="gal-confirm" role="alert">
            <p>Wirklich löschen? Die Datei verschwindet aus <code>data/gallery/</code>.{image.uses.length > 0 && <> Der Verweis bei {[...new Set(image.uses.map(use => use.dinoName))].join(', ')} wird entfernt.</>}</p>
            <div><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Abbrechen</button><button type="button" className="danger-button" onClick={() => void remove()}>Löschen</button></div>
          </div> : <button type="button" className="text-button danger" onClick={() => setConfirmDelete(true)}>Bild löschen…</button>}
        </div>
        <p className="gal-keys">← → blättern · Esc schließen · Änderungen speichern sofort</p>
      </aside>
    </div>
  </div>;
}
