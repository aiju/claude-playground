// Keeps the timing editor's edits: the current value of every timing, and a
// log of every edit, so edits can be undone (also after a reload) and the
// original values recovered by undoing the log backwards.
//
// On the published page they live in the page's own shared database (the
// artifact's `db` capability), where Claude can read them; anywhere else,
// in this browser's localStorage. Either way there are two kinds of
// document:
//   timing/state    { rev, at, values }   values: every unit (see edits.js)
//   log/c0000, ...  { entries }           the log, in order, ~100 per chunk
// An entry is { seq, at, kind, of, label, t, changes: [{ id, before, after }] }.
// kind is 'edit', 'undo' or 'redo'; undo and redo are logged like edits,
// with `of` naming the edit they undo or redo. t is the song time the edit
// is about.

import { getValues, setValues, setUnit } from './edits.js';

const CHUNK = 100, CHUNK_BYTES = 150000;
const LOCAL_KEY = 'heart-sutra-timing-edits';
const chunkId = i => `c${String(i).padStart(4, '0')}`;

// ---------------------------------------------------------------- backends

async function dbBackend(db) {
  const state = db.doc('timing/state');
  const retry = async fn => {
    try { return await fn(); } catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 500 + Math.random() * 1000)); return fn(); }
      throw e;
    }
  };
  return {
    kind: 'db',
    async load() {
      const snap = await retry(() => state.get());
      const log = await retry(() => db.collection('log').get());
      const chunks = log.docs.filter(d => /^c\d{4}$/.test(d.id)).map(d => [...(d.data().entries || [])]);
      return { state: snap.exists ? snap.data() : null, chunks };
    },
    async writeChunk(i, entries) { await retry(() => db.collection('log').doc(chunkId(i)).set({ entries })); },
    async writeState(s) { await retry(() => state.set(s)); },
    watch(fn) {
      return state.onSnapshot(s => { if (s.exists && !s.metadata.hasPendingWrites) fn(s.data()); }, () => {});
    },
  };
}

function localBackend() {
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };
  const write = patch => {
    const all = { ...read(), ...patch };
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch (e) { throw { code: 'local', message: e.message }; }
  };
  return {
    kind: 'local',
    async load() { const all = read(); return { state: all.state || null, chunks: all.chunks || [] }; },
    async writeChunk(i, entries) { const chunks = read().chunks || []; chunks[i] = entries; write({ chunks }); },
    async writeState(s) { write({ state: s }); },
    watch() { return () => {}; },
  };
}

// ---------------------------------------------------------------- the edit history

export class EditStore {
  constructor() {
    this.backend = null;
    this.chunks = [];            // the log, as stored
    this.entries = [];           // the log, flat
    this.undoStack = [];         // seqs of edits that can be undone, oldest first
    this.redoStack = [];
    this.rev = 0;
    this.status = 'Connecting…';
    this.error = null;
    this.onChange = () => {};    // after anything changes the values (undo, redo, another tab)
    this.onStatus = () => {};
    this._dirty = new Set();
    this._saving = null;
    this._again = false;
  }

  // Picks the database if the page has one, and lays its values over the
  // ones in the source files.
  async open() {
    let db = null;
    if (window.claude && window.claude.use) {
      try { db = await window.claude.use('db'); } catch { db = null; }
    }
    this.backend = db ? await dbBackend(db) : localBackend();
    this.fellBack = !db && !!(window.claude && window.claude.use);
    try {
      await this._load(await this.backend.load());
    } catch (e) {
      this.backend = localBackend();
      this.fellBack = true;
      this.error = `Couldn't read the database (${e.code || e.message}); keeping edits in this browser`;
      await this._load(await this.backend.load());
    }
    this.backend.watch(s => { if (s.rev > this.rev) this._reload(); });
    this._setStatus();
  }

  async _reload() {
    await this._load(await this.backend.load());
    this.onChange(null);
    this._setStatus('Updated with edits made elsewhere');
  }

  async _load({ state, chunks }) {
    this.chunks = chunks.filter(Boolean);
    this.entries = this.chunks.flat();
    this.rev = state ? state.rev || 0 : 0;
    if (state && state.values) setValues(state.values);
    this.undoStack = []; this.redoStack = [];
    for (const e of this.entries) this._track(e);
  }

  _track(e) {
    if (e.kind === 'edit') { this.undoStack.push(e.seq); this.redoStack = []; }
    else if (e.kind === 'undo') { this.undoStack = this.undoStack.filter(s => s !== e.of); this.redoStack.push(e.of); }
    else if (e.kind === 'redo') { this.redoStack = this.redoStack.filter(s => s !== e.of); this.undoStack.push(e.of); }
  }

  entry(seq) { return this.entries.find(e => e.seq === seq); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get nextUndo() { return this.canUndo ? this.entry(this.undoStack[this.undoStack.length - 1]) : null; }
  get nextRedo() { return this.canRedo ? this.entry(this.redoStack[this.redoStack.length - 1]) : null; }

  // An edit the editor has already applied: changes is [{ id, before, after }].
  commit(label, changes, t) {
    changes = changes.filter(c => JSON.stringify(c.before) !== JSON.stringify(c.after));
    if (!changes.length) return null;
    return this._append({ kind: 'edit', label, t, changes });
  }

  undo() {
    const e = this.nextUndo;
    if (!e) return null;
    for (const c of e.changes) setUnit(c.id, c.before);
    this._append({ kind: 'undo', of: e.seq, label: e.label, t: e.t, changes: e.changes.map(c => ({ id: c.id, before: c.after, after: c.before })) });
    this.onChange(e);
    return e;
  }

  redo() {
    const e = this.nextRedo;
    if (!e) return null;
    for (const c of e.changes) setUnit(c.id, c.after);
    this._append({ kind: 'redo', of: e.seq, label: e.label, t: e.t, changes: e.changes });
    this.onChange(e);
    return e;
  }

  _append(fields) {
    const e = { seq: (this.entries.length ? this.entries[this.entries.length - 1].seq : 0) + 1, at: new Date().toISOString(), ...fields };
    this.entries.push(e);
    this._track(e);
    let i = this.chunks.length - 1;
    if (i < 0 || this.chunks[i].length >= CHUNK || JSON.stringify(this.chunks[i]).length > CHUNK_BYTES) this.chunks[++i] = [];
    this.chunks[i].push(e);
    this._dirty.add(i);
    this.rev = e.seq;
    this.save();
    return e;
  }

  // Writes what changed, one write at a time; edits made meanwhile go in
  // the next round.
  save() {
    if (this._saving) { this._again = true; return this._saving; }
    this._setStatus('Saving…');
    this._saving = (async () => {
      do {
        this._again = false;
        const dirty = [...this._dirty];
        this._dirty.clear();
        try {
          for (const i of dirty) await this.backend.writeChunk(i, this.chunks[i]);
          await this.backend.writeState({ rev: this.rev, at: new Date().toISOString(), values: getValues() });
          this.error = null;
        } catch (e) {
          dirty.forEach(i => this._dirty.add(i));
          this.error = `Not saved (${(e && (e.code || e.message)) || 'error'}); will try again with the next edit`;
          break;
        }
      } while (this._again);
      this._saving = null;
      this._setStatus();
    })();
    return this._saving;
  }

  _setStatus(note) {
    const n = this.entries.filter(e => e.kind === 'edit').length;
    const where = this.backend.kind === 'db' ? 'Saved in the page\'s database' : 'Saved in this browser only';
    this.status = this.error || note || (this._saving ? 'Saving…' : `${where} · ${n} edit${n === 1 ? '' : 's'}`);
    this.onStatus(this.status);
  }

  // Everything, for a download: the current values and the whole log.
  exportJSON() {
    return JSON.stringify({ rev: this.rev, at: new Date().toISOString(), values: getValues(), log: this.entries }, null, 1);
  }
}
