/* =========================================================
   The Idea Bank — Clean Stable Build
   Local-first Notes + PWA + PDF.js + Vault Export
   ========================================================= */

/* ========== CONFIG ========== */
const FIREBASE_ENABLED = false;

/* ========== STORAGE KEYS ========== */
const LS_NOTES = 'ib_notes_v1';
const LS_FOLDERS = 'ib_folders_v1';
const LS_TAGS = 'ib_tags_v1';
const LS_TRASH = 'ib_trash_v1';
const LS_THEME = 'ib_theme_v1';

/* ========== STATE ========== */
let notes = JSON.parse(localStorage.getItem(LS_NOTES) || '[]');
let folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]');
let tags = JSON.parse(localStorage.getItem(LS_TAGS) || '[]');
let trash = JSON.parse(localStorage.getItem(LS_TRASH) || '[]');
let activeNoteId = null;
let openedPdf = null;

/* ========== DOM ========== */
const $ = id => document.getElementById(id);

const el = {
  newNoteBtn: $('newNoteBtn'),
  notesList: $('notesList'),
  noteTitle: $('noteTitle'),
  editor: $('editor'),
  folderList: $('folderList'),
  folderAssign: $('folderAssign'),
  tagList: $('tagList'),
  tagsInput: $('tagsInput'),
  globalSearch: $('globalSearch'),
  deleteBtn: $('deleteBtn'),
  exportBtn: $('exportBtn'),
  saveIndicator: $('saveIndicator'),
  sortSelect: $('sortSelect'),
  toggleTheme: $('toggleTheme'),
  addFolderBtn: $('addFolderBtn'),
  addTagBtn: $('addTagBtn'),
  openTrashBtn: $('openTrashBtn'),
  exportVaultBtn: $('exportVaultBtn'),
  importVaultBtn: $('importVaultBtn'),
  importVaultFile: $('importVaultFile'),
  fileInput: $('fileInput'),
  filePreview: $('filePreview'),
  noteMeta: $('noteMeta'),
  pdfModal: $('pdfModal'),
  pdfContainer: $('pdfContainer'),
  closePdfBtn: $('closePdfBtn'),
  pdfAnnotateBtn: $('pdfAnnotateBtn'),
  pdfDownloadBtn: $('pdfDownloadBtn')
};

/* ========== INIT ========== */
function init() {
  if (!folders.length) folders = [{ id: 'inbox', name: 'Inbox' }];
  if (!notes.length) createNote();

  activeNoteId = notes[0]?.id || null;

  applyTheme();
  bindEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

/* ========== STORAGE ========== */
function saveAll() {
  localStorage.setItem(LS_NOTES, JSON.stringify(notes));
  localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  localStorage.setItem(LS_TAGS, JSON.stringify(tags));
  localStorage.setItem(LS_TRASH, JSON.stringify(trash));
  if (el.saveIndicator) {
    el.saveIndicator.textContent = 'Saved';
    setTimeout(() => el.saveIndicator.textContent = '', 800);
  }
}

/* ========== RENDER ========== */
function renderAll() {
  renderFolders();
  renderTags();
  renderNotes();
  renderActiveNote();
}

function renderNotes(filter = '') {
  if (!el.notesList) return;
  el.notesList.innerHTML = '';

  const sorted = [...notes].sort((a, b) =>
    el.sortSelect?.value === 'title'
      ? (a.title || '').localeCompare(b.title || '')
      : b.updated - a.updated
  );

  const q = filter.toLowerCase();

  sorted.forEach(n => {
    if (n.deleted) return;
    if (q && !(`${n.title} ${n.bodyText}`.toLowerCase().includes(q))) return;

    const li = document.createElement('li');
    li.className = n.id === activeNoteId ? 'active' : '';
    li.innerHTML = `<strong>${escape(n.title || 'Untitled')}</strong>`;
    li.onclick = () => {
      activeNoteId = n.id;
      renderActiveNote();
      renderNotes(el.globalSearch?.value || '');
    };
    el.notesList.appendChild(li);
  });
}

function renderFolders() {
  el.folderList.innerHTML = '';
  el.folderAssign.innerHTML = '';

  folders.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f.name;
    el.folderList.appendChild(li);

    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    el.folderAssign.appendChild(opt);
  });
}

function renderTags() {
  el.tagList.innerHTML = '';
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = t;
    span.onclick = () => {
      el.globalSearch.value = t;
      renderNotes(t);
    };
    el.tagList.appendChild(span);
  });
}

function renderActiveNote() {
  const n = notes.find(n => n.id === activeNoteId);
  if (!n) return;

  el.noteTitle.value = n.title || '';
  el.editor.innerHTML = n.body || '';
  el.tagsInput.value = (n.tags || []).join(',');
  el.folderAssign.value = n.folderId || 'inbox';
  el.noteMeta.textContent = `Updated ${new Date(n.updated).toLocaleString()}`;

  renderFiles(n.files || []);
}

/* ========== CRUD ========== */
function createNote() {
  const note = {
    id: Date.now().toString(),
    title: '',
    body: '',
    bodyText: '',
    tags: [],
    files: [],
    folderId: 'inbox',
    created: Date.now(),
    updated: Date.now(),
    deleted: false
  };
  notes.unshift(note);
  activeNoteId = note.id;
  saveAll();
}

function deleteNote() {
  const i = notes.findIndex(n => n.id === activeNoteId);
  if (i === -1) return;
  trash.unshift(notes[i]);
  notes.splice(i, 1);
  activeNoteId = notes[0]?.id || null;
  saveAll();
  renderAll();
}

/* ========== EVENTS ========== */
function bindEvents() {
  el.newNoteBtn.onclick = () => {
    createNote();
    renderAll();
  };

  el.deleteBtn.onclick = () => {
    if (confirm('Move note to Trash?')) deleteNote();
  };

  el.noteTitle.oninput = debounce(saveActiveNote, 300);
  el.editor.oninput = debounce(saveActiveNote, 500);

  el.tagsInput.onchange = () => {
    const n = notes.find(n => n.id === activeNoteId);
    if (!n) return;
    n.tags = el.tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    tags = [...new Set([...tags, ...n.tags])];
    saveAll();
    renderTags();
  };

  el.globalSearch.oninput = debounce(e =>
    renderNotes(e.target.value), 300);

  el.toggleTheme.onclick = toggleTheme;
}

/* ========== SAVE ACTIVE ========== */
function saveActiveNote() {
  const n = notes.find(n => n.id === activeNoteId);
  if (!n) return;

  n.title = el.noteTitle.value;
  n.body = el.editor.innerHTML;
  n.bodyText = strip(el.editor.innerHTML);
  n.updated = Date.now();

  saveAll();
  renderNotes(el.globalSearch?.value || '');
}

/* ========== FILES ========== */
function renderFiles(files) {
  el.filePreview.innerHTML = '';
  files.forEach(f => {
    const div = document.createElement('div');
    div.textContent = f.name;
    el.filePreview.appendChild(div);
  });
}

/* ========== UTIL ========== */
function debounce(fn, d = 300) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), d);
  };
}

function escape(str = '') {
  return str.replace(/[&<>]/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s])
  );
}

function strip(html = '') {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

/* ========== THEME ========== */
function applyTheme() {
  if (localStorage.getItem(LS_THEME) === 'dark')
    document.body.classList.add('dark');
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(
    LS_THEME,
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

/* ========== DEBUG ========== */
window.ideaBank = { notes, folders, tags, trash };
