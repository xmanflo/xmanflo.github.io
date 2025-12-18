/* ==================================
   THE IDEA BANK — CORE LOGIC v2
   Improved Trash System
   ================================== */

const $ = id => document.getElementById(id);

/* ---------- STATE ---------- */
let state = {
  notes: JSON.parse(localStorage.getItem('ideaBankNotes')) || [],
  folders: JSON.parse(localStorage.getItem('ideaBankFolders')) || ['All'],
  activeFolder: 'All',
  activeNoteId: null,
  theme: localStorage.getItem('ideaBankTheme') || 'light',
  showTrash: false
};

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  renderFolders();
  renderNotes();
  bindUI();
});

/* ---------- UI ---------- */
function bindUI() {
  $('newNoteBtn').onclick = createNote;
  $('deleteBtn').onclick = trashNote;
  $('toggleTheme').onclick = toggleTheme;
  $('globalSearch').oninput = searchNotes;
  $('editor').oninput = saveCurrentNote;
  $('noteTitle').oninput = saveCurrentNote;
  $('addFolderBtn').onclick = addFolder;
  $('openTrashBtn').onclick = toggleTrashView;
  $('tagsInput').onchange = updateTags;
}

/* ---------- NOTES ---------- */
function createNote() {
  const note = {
    id: Date.now(),
    title: 'Untitled note',
    content: '',
    folder: state.activeFolder,
    tags: [],
    trashed: false,
    updated: new Date().toISOString()
  };

  state.notes.unshift(note);
  state.activeNoteId = note.id;
  persist();
  renderNotes();
  loadNote(note.id);
}

function loadNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  state.activeNoteId = id;
  $('noteTitle').value = note.title;
  $('editor').innerHTML = note.content;
  $('tagsInput').value = note.tags.join(', ');
  $('noteMeta').textContent =
    note.trashed
      ? '🗑️ In Trash'
      : `Folder: ${note.folder} · Last edited: ${new Date(note.updated).toLocaleString()}`;
}

function saveCurrentNote() {
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note || note.trashed) return;

  note.title = $('noteTitle').value || 'Untitled note';
  note.content = $('editor').innerHTML;
  note.updated = new Date().toISOString();

  persist();
  renderNotes();
}

/* ---------- TRASH ---------- */
function trashNote() {
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note) return;

  if (!confirm('Move this note to Trash?')) return;

  note.trashed = true;
  state.activeNoteId = null;

  clearEditor();
  persist();
  renderNotes();
}

function restoreNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  note.trashed = false;
  persist();
  renderNotes();
}

function deleteForever(id) {
  if (!confirm('Delete permanently? This cannot be undone.')) return;

  state.notes = state.notes.filter(n => n.id !== id);
  persist();
  renderNotes();
}

function toggleTrashView() {
  state.showTrash = !state.showTrash;
  $('openTrashBtn').textContent = state.showTrash ? 'Back' : 'Trash';
  clearEditor();
  renderNotes();
}

/* ---------- FOLDERS ---------- */
function addFolder() {
  const name = prompt('Folder name');
  if (!name || state.folders.includes(name)) return;

  state.folders.push(name);
  persist();
  renderFolders();
}

function selectFolder(name) {
  state.activeFolder = name;
  state.showTrash = false;
  renderFolders();
  renderNotes();
}

function renderFolders() {
  const list = $('folderList');
  list.innerHTML = '';

  state.folders.forEach(folder => {
    const li = document.createElement('li');
    li.textContent = folder;
    li.onclick = () => selectFolder(folder);
    if (folder === state.activeFolder) li.classList.add('active');
    list.appendChild(li);
  });
}

/* ---------- TAGS ---------- */
function updateTags(e) {
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note || note.trashed) return;

  note.tags = e.target.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  persist();
}

/* ---------- SEARCH ---------- */
function searchNotes(e) {
  const q = e.target.value.toLowerCase();

  const filtered = state.notes.filter(n =>
    !n.trashed &&
    (n.title.toLowerCase().includes(q) ||
     n.content.toLowerCase().includes(q) ||
     n.tags.join(' ').toLowerCase().includes(q))
  );

  renderNotes(filtered);
}

/* ---------- RENDER NOTES ---------- */
function renderNotes(custom = null) {
  const list = $('notesList');
  list.innerHTML = '';

  let notes = custom || state.notes;

  notes = notes.filter(n =>
    state.showTrash ? n.trashed : !n.trashed
  );

  if (!state.showTrash && state.activeFolder !== 'All') {
    notes = notes.filter(n => n.folder === state.activeFolder);
  }

  if (!notes.length) {
    list.innerHTML = '<li style="opacity:.6">No notes</li>';
    return;
  }

  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = note.trashed ? 'trashed' : '';
    li.innerHTML = `
      <div>${note.title}</div>
      ${state.showTrash ? `
        <div style="display:flex; gap:6px">
          <button class="btn" onclick="restoreNote(${note.id})">Restore</button>
          <button class="btn danger" onclick="deleteForever(${note.id})">Delete</button>
        </div>
      ` : ''}
    `;
    if (!state.showTrash) li.onclick = () => loadNote(note.id);
    list.appendChild(li);
  });
}

/* ---------- UTIL ---------- */
function clearEditor() {
  $('noteTitle').value = '';
  $('editor').innerHTML = '';
  $('tagsInput').value = '';
  $('noteMeta').textContent = '';
}

/* ---------- THEME ---------- */
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  persist();
  applyTheme();
}

function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
}

/* ---------- STORAGE ---------- */
function persist() {
  localStorage.setItem('ideaBankNotes', JSON.stringify(state.notes));
  localStorage.setItem('ideaBankFolders', JSON.stringify(state.folders));
  localStorage.setItem('ideaBankTheme', state.theme);
}
