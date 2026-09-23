import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type ProfileSummary, type ImageRecord } from './api';
import { Explorer } from './Explorer';

type PendingImage = { key: string; file: File; label: string; preview: string };
type KeptImage = ImageRecord & { key: string };
type Dialog = { kind: 'replace' | 'delete'; name: string; id?: string };

const acceptedExtensions = /\.(png|jpe?g|webp)$/i;
const clipboardExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function pastedImages(clipboard: DataTransfer): File[] {
  return Array.from(clipboard.items)
    .filter(item => item.kind === 'file' && item.type in clipboardExtensions)
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) return null;
      const extension = clipboardExtensions[item.type];
      const validName = acceptedExtensions.test(file.name) &&
        (item.type !== 'image/jpeg' || /\.jpe?g$/i.test(file.name)) &&
        (item.type === 'image/jpeg' || file.name.toLowerCase().endsWith(`.${extension}`));
      return validName ? file : new File([file], `pasted-image-${Date.now()}-${index + 1}.${extension}`, { type: item.type });
    })
    .filter((file): file is File => file !== null);
}

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function sourceOffset(text: string, displayOffset: number) {
  let source = 0;
  let displayed = 0;
  while (source < text.length && displayed < displayOffset) {
    if (text[source] === '\r' && text[source + 1] === '\n') source++;
    source++;
    displayed++;
  }
  return source;
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/import');
  useEffect(() => {
    const update = () => setRoute(window.location.hash.replace(/^#/, '') || '/import');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (route.startsWith('/profiles') || route.startsWith('/ecosystems') || route.startsWith('/rules') || route.startsWith('/animals')) return <Explorer route={route} />;
  return <ImportApp />;
}

function ImportApp() {
  const [name, setName] = useState('');
  const [profile, setProfile] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [kept, setKept] = useState<KeptImage[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [imports, setImports] = useState<ProfileSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingImage[]>([]);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => { pendingRef.current.forEach(item => URL.revokeObjectURL(item.preview)); }, []);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, [dialog]);

  function handleDialogKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) { setDialog(null); return; }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
    if (!buttons.length) return;
    if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialogRef.current)) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
  }

  async function refresh() {
    try { setImports(await api.list()); setNotice(current => current?.type === 'error' ? null : current); }
    catch (error) { setNotice({ type: 'error', text: `Could not load imports: ${(error as Error).message}` }); }
    finally { setLoadingList(false); }
  }
  useEffect(() => { void refresh(); }, []);

  function clearForm() {
    pending.forEach(item => URL.revokeObjectURL(item.preview));
    setName(''); setProfile(''); setPending([]); setKept([]); setLoadedId(null);
    if (inputRef.current) inputRef.current.value = '';
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  const addFiles = useCallback((files: FileList | File[]) => {
    const all = Array.from(files);
    const valid = all.filter(file => acceptedExtensions.test(file.name) && ['image/png', 'image/jpeg', 'image/webp', ''].includes(file.type));
    if (valid.length !== all.length) setNotice({ type: 'error', text: 'Only PNG, JPG, JPEG and WEBP images are supported.' });
    setPending(previous => [...previous, ...valid.map(file => ({ key: crypto.randomUUID(), file, label: '', preview: URL.createObjectURL(file) }))]);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const images = event.clipboardData && pastedImages(event.clipboardData);
      if (!images?.length) return;
      event.preventDefault();
      addFiles(images);
      setNotice({ type: 'success', text: `${images.length} ${images.length === 1 ? 'image' : 'images'} added from clipboard.` });
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  function removePending(key: string) {
    setPending(previous => {
      const item = previous.find(image => image.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return previous.filter(image => image.key !== key);
    });
  }

  function pasteRaw(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (pastedImages(event.clipboardData).length) return;
    const pasted = event.clipboardData.getData('text/plain');
    if (!pasted) return;
    event.preventDefault();
    const start = sourceOffset(profile, event.currentTarget.selectionStart);
    const end = sourceOffset(profile, event.currentTarget.selectionEnd);
    setProfile(profile.slice(0, start) + pasted + profile.slice(end));
  }

  function changeRaw(displayValue: string) {
    const oldDisplay = profile.replace(/\r\n?/g, '\n');
    let prefix = 0;
    while (prefix < oldDisplay.length && prefix < displayValue.length && oldDisplay[prefix] === displayValue[prefix]) prefix++;
    let suffix = 0;
    while (suffix < oldDisplay.length - prefix && suffix < displayValue.length - prefix && oldDisplay[oldDisplay.length - 1 - suffix] === displayValue[displayValue.length - 1 - suffix]) suffix++;
    const start = sourceOffset(profile, prefix);
    const end = sourceOffset(profile, oldDisplay.length - suffix);
    setProfile(profile.slice(0, start) + displayValue.slice(prefix, displayValue.length - suffix) + profile.slice(end));
  }

  async function loadProfile(id: string) {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const detail = await api.get(id);
      pending.forEach(item => URL.revokeObjectURL(item.preview));
      setPending([]);
      setName(detail.manifest.name);
      setProfile(detail.profile);
      setKept(detail.manifest.images.map(image => ({ ...image, key: image.file })));
      setLoadedId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setNotice({ type: 'error', text: `Could not load profile: ${(error as Error).message}` }); }
    finally { setBusy(false); }
  }

  async function save(replace = false) {
    if (busy) return;
    if (!name.trim()) { setNotice({ type: 'error', text: 'Enter a playable name.' }); nameRef.current?.focus(); return; }
    if (!slugify(name)) { setNotice({ type: 'error', text: 'The playable name needs at least one Latin letter or number.' }); nameRef.current?.focus(); return; }
    if (!profile.length) { setNotice({ type: 'error', text: 'Paste the raw profile before saving.' }); return; }
    setBusy(true); setNotice(null);
    const form = new FormData();
    form.append('name', name);
    form.append('profile', new Blob([profile], { type: 'text/plain;charset=utf-8' }), 'profile.txt');
    form.append('replace', String(replace));
    form.append('sourceId', loadedId || '');
    form.append('retainedImages', JSON.stringify(kept.map(({ file, label }) => ({ file, label }))));
    form.append('imageMetadata', JSON.stringify(pending.map(({ label }) => ({ label }))));
    pending.forEach(item => form.append('images', item.file, item.file.name));
    try {
      const saved = await api.save(form);
      clearForm();
      setDialog(null);
      setNotice({ type: 'success', text: `${saved.name} successfully imported.` });
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setDialog({ kind: 'replace', name: name.trim() });
      else { setDialog(null); setNotice({ type: 'error', text: (error as Error).message }); }
    } finally { setBusy(false); }
  }

  async function deleteProfile(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.remove(id);
      if (loadedId === id) clearForm();
      setDialog(null);
      setNotice({ type: 'success', text: 'Profile deleted.' });
      await refresh();
    } catch (error) { setDialog(null); setNotice({ type: 'error', text: (error as Error).message }); }
    finally { setBusy(false); }
  }

  const imageCount = pending.length + kept.length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark" aria-hidden="true">D</div><div><strong>DYNASTY BOT</strong><span>REALISM ARCHIVE</span></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button className="nav-item active" aria-current="page" onClick={() => { window.location.hash = '#/import'; }}><span className="nav-symbol">↧</span> Import</button>
          <div className="nav-divider" />
          <button className="nav-item" onClick={() => { window.location.hash = '#/profiles'; }}><span className="nav-symbol">▤</span> Profiles</button>
          <button className="nav-item" onClick={() => { window.location.hash = '#/rules'; }}><span className="nav-symbol">≡</span> Rules</button>
          <button className="nav-item" disabled><span className="nav-symbol">◇</span> Playable Finder <span className="soon">Soon</span></button>
          <button className="nav-item" disabled><span className="nav-symbol">▢</span> Chat <span className="soon">Soon</span></button>
        </nav>
        <div className="sidebar-foot"><span className="status-dot" /> LOCAL ARCHIVE <small>Raw profiles stay on this device.</small></div>
      </aside>

      <main className="main-content">
        <div className="topline"><span>ARCHIVE / IMPORT</span><span>V0.1 · RAW COLLECTION</span></div>
        <div className="page-head"><div><div className="eyebrow">DYNASTY REALISM · DATA INTAKE</div><h1>Import Dynasty Profile</h1><p>Preserve the complete Discord profile and its images in your local archive.</p></div><div className="count-card"><strong>{imports.length}</strong><span>{imports.length === 1 ? 'Profile imported' : 'Profiles imported'}</span></div></div>
        {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

        <div className="content-grid">
          <section className="editor" aria-labelledby="profile-entry-title">
            <div className="section-heading"><div><span className="step">01</span><h2 id="profile-entry-title">Profile details</h2></div>{loadedId && <button type="button" className="text-button" onClick={() => { clearForm(); setNotice(null); }}>+ New import</button>}</div>
            {loadedId && <div className="edit-note">Editing <strong>{name}</strong>. Save will ask before replacing this import.</div>}
            <label className="field-label" htmlFor="playable-name">Playable Name <span className="required">*</span></label>
            <input id="playable-name" ref={nameRef} value={name} onChange={event => setName(event.target.value)} readOnly={!!loadedId} placeholder="e.g. Leedsichthys" autoComplete="off" />
            <div className="field-hint">Saved as <code>data/raw/{slugify(name) || 'playable-name'}/</code></div>

            <div className="field-top"><label className="field-label" htmlFor="raw-profile">Raw Profile <span className="required">*</span></label><span className="small-tag">ORIGINAL TEXT</span></div>
            <textarea id="raw-profile" value={profile} onChange={event => changeRaw(event.target.value)} onPaste={pasteRaw} placeholder="Paste the complete Dynasty Discord profile here..." spellCheck={false} />
            <div className="textarea-foot"><span>Saved exactly as entered. No formatting or processing.</span><strong>{profile.length.toLocaleString('en-US')} characters</strong></div>

            <div className="section-heading image-heading"><div><span className="step">02</span><h2>Profile Images</h2></div><span className="image-count">{imageCount} attached</span></div>
            <div className={`dropzone ${dragging ? 'dragging' : ''}`} role="group" aria-label="Profile image upload" tabIndex={0} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
              <div className="upload-icon" aria-hidden="true">↑</div><strong>Drop profile images here</strong><span>or choose files from your computer</span>
              <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>Choose images</button>
              <small>Paste copied images with Ctrl+V · PNG, JPG, JPEG, WEBP</small>
              <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden onChange={event => event.target.files && addFiles(event.target.files)} aria-label="Choose profile images" />
            </div>
            {imageCount > 0 && <div className="image-list" aria-label="Attached images">
              {kept.map(image => <ImageCard key={image.key} src={api.imageUrl(loadedId!, image.file)} filename={image.originalFileName} label={image.label} onLabel={label => setKept(items => items.map(item => item.key === image.key ? { ...item, label } : item))} onRemove={() => setKept(items => items.filter(item => item.key !== image.key))} />)}
              {pending.map(image => <ImageCard key={image.key} src={image.preview} filename={image.file.name} label={image.label} onLabel={label => setPending(items => items.map(item => item.key === image.key ? { ...item, label } : item))} onRemove={() => removePending(image.key)} />)}
            </div>}
            <div className="save-row"><div><strong>Ready to archive?</strong><span>Original text and image files will be stored locally.</span></div><button type="button" className="primary-button" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save Profile'} <span aria-hidden="true">→</span></button></div>
          </section>

          <aside className="imports-panel" aria-labelledby="imports-title"><div className="imports-head"><div><div className="eyebrow">YOUR LOCAL ARCHIVE</div><h2 id="imports-title">Imported Profiles</h2></div><span>{imports.length}</span></div>
            {loadingList ? <p className="list-state">Loading imports…</p> : imports.length === 0 ? <div className="empty-state"><div className="empty-icon">◎</div><strong>No profiles yet</strong><p>Your imported playables will appear here.</p></div> : <ul className="imports-list">{imports.map(item => <li key={item.id} className={loadedId === item.id ? 'selected' : ''}><button type="button" className="import-open" onClick={() => void loadProfile(item.id)} disabled={busy}><strong>{item.name}</strong><span>{item.imageCount} {item.imageCount === 1 ? 'image' : 'images'} <i>·</i> {formatDate(item.importedAt)}</span></button><button type="button" className="delete-button" aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`} onClick={() => setDialog({ kind: 'delete', name: item.name, id: item.id })} disabled={busy}>×</button></li>)}</ul>}
            <div className="imports-foot"><span className="status-dot" /> Stored in <code>data/raw/</code></div>
          </aside>
        </div>
      </main>

      {dialog && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDialog(null); }}><div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" tabIndex={-1} ref={dialogRef} onKeyDown={handleDialogKey}><div className="modal-icon">!</div><h2 id="dialog-title">{dialog.kind === 'replace' ? `${dialog.name} already exists.` : `Delete ${dialog.name}?`}</h2><p id="dialog-description">{dialog.kind === 'replace' ? 'Replacing will remove the current saved text and any images you removed from this import.' : 'This permanently removes the raw profile and all of its images from your local archive.'}</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDialog(null)} disabled={busy}>Cancel</button><button type="button" className={dialog.kind === 'delete' ? 'danger-button' : 'primary-button'} onClick={() => dialog.kind === 'replace' ? void save(true) : void deleteProfile(dialog.id!)} disabled={busy}>{dialog.kind === 'replace' ? 'Replace existing profile' : 'Delete profile'}</button></div></div></div>}
    </div>
  );
}

function ImageCard({ src, filename, label, onLabel, onRemove }: { src: string; filename: string; label: string; onLabel: (label: string) => void; onRemove: () => void }) {
  return <div className="image-card"><img src={src} alt="" /><div className="image-card-body"><strong title={filename}>{filename}</strong><input type="text" value={label} onChange={event => onLabel(event.target.value)} placeholder="Add a label (optional)" aria-label={`Label for ${filename}`} /></div><button type="button" onClick={onRemove} aria-label={`Remove ${filename}`} title="Remove image">×</button></div>;
}
