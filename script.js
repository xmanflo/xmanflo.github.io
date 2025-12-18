/* ============================
   THE IDEA BANK – CORE LOGIC
   ============================ */

const $ = id => document.getElementById(id);

/* ---------- STATE ---------- */
let state = {
  notes: JSON.parse(localStorage.getItem('ideaBankNotes')) || [],
  folders: JSON.parse(localStorage.getItem('ideaBankFolders')) || ['All'],
  activeNoteId: null,
  theme: localStorage.getItem('ideaBankTheme') || 'light'
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
  $('deleteBtn').onclick = deleteNote;
  $('toggleTheme').onclick = toggleTheme;
  $('globalSearch').oninput = searchNotes;
  $('editor').oninput = saveCurrentNote;
  $('noteTitle').oninput = saveCurrentNote;
}

/* ---------- NOTES ---------- */
function createNote() {
  const note = {
    id: Date.now(),
    title: 'Untitled note',
    content: '',
    folder: 'All',
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
  $('noteMeta').textContent = `Last edited: ${new Date(note.updated).toLocaleString()}`;
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

function deleteNote() {
  if (!state.activeNoteId) return;

  state.notes = state.notes.filter(n => n.id !== state.activeNoteId);
  state.activeNoteId = null;

  $('noteTitle').value = '';
  $('editor').innerHTML = '';
  $('noteMeta').textContent = 'Note deleted';

  persist();
  renderNotes();
}

/* ---------- RENDER ---------- */
function renderNotes(filtered = null) {
  const list = $('notesList');
  list.innerHTML = '';

  const notes = filtered || state.notes;

  notes.forEach(note => {
    const li = document.createElement('li');
    li.textContent = note.title;
    li.onclick = () => loadNote(note.id);
    list.appendChild(li);
  });
}

function renderFolders() {
  const list = $('folderList');
  list.innerHTML = '';

  state.folders.forEach(folder => {
    const li = document.createElement('li');
    li.textContent = folder;
    list.appendChild(li);
  });
}

/* ---------- SEARCH ---------- */
function searchNotes(e) {
  const q = e.target.value.toLowerCase();

  const filtered = state.notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q)
  );

  renderNotes(filtered);
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
