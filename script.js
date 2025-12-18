/* ==================================
   THE IDEA BANK – FULL CORE LOGIC
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

/* ---------- UI BINDINGS ---------- */
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
    `Folder: ${note.folder} · Last edited: ${new Date(note.updated).toLocaleString()}`;
}

function saveCurrentNote() {
  const note = state.notes.find(n => n.id === state.activeNoteId);
  if (!note) return;

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

  note.trashed = true;
  state.activeNoteId = null;

  $('noteTitle').value = '';
  $('editor').innerHTML = '';
  $('tagsInput').value = '';
  $('noteMeta').textContent = 'Moved to Trash';

  persist();
  renderNotes();
}

function toggleTrashView() {
  state.showTrash = !state.showTrash;
  $('openTrashBtn').textContent = state.showTrash ? 'Back' : 'Trash';
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
  if (!note) return;

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

  if (state.activeFolder !== 'All' && !state.showTrash) {
    notes = notes.filter(n => n.folder === state.activeFolder);
  }

  notes.forEach(note => {
    const li = document.createElement('li');
    li.textContent = note.title;
    li.onclick = () => loadNote(note.id);
    list.appendChild(li);
  });
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
