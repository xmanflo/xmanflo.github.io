/* Knowledge Vault - improved script
   - fixed new note, folder click, search
   - folders/tags CRUD UI basics
   - file attachments (stored base64)
   - PWA friendly localStorage usage
*/

const LS_KEY = 'kv_notes_v2';
const LS_FOLDERS = 'kv_folders_v2';
const LS_TAGS = 'kv_tags_v2';
const LS_THEME = 'kv_theme_v2';

let notes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
let folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]');
let tags = JSON.parse(localStorage.getItem(LS_TAGS) || '[]');
let activeNoteId = null;

// DOM refs
const newNoteBtn = document.getElementById('newNoteBtn');
const notesList = document.getElementById('notesList');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const folderListEl = document.getElementById('folderList');
const tagListEl = document.getElementById('tagList');
const addFolderBtn = document.getElementById('addFolderBtn');
const addTagBtn = document.getElementById('addTagBtn');
const tagsInput = document.getElementById('tagsInput');
const folderAssign = document.getElementById('folderAssign');
const globalSearch = document.getElementById('globalSearch');
const deleteBtn = document.getElementById('deleteBtn');
const exportBtn = document.getElementById('exportBtn');
const saveIndicator = document.getElementById('saveIndicator');
const sortSelect = document.getElementById('sortSelect');
const summaryBtn = document.getElementById('summaryBtn');
const toggleTheme = document.getElementById('toggleTheme');

// --- Initialization ---
function init(){
  // ensure default folder ("Inbox")
  if (!folders.length) {
    folders = [{ id: 'inbox', name: 'Inbox' }];
    localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  }
  renderFolders();
  renderTags();
  renderNotesList();
  applyTheme();
  attachHandlers();
  // restore last opened note
  if (notes.length) { activeNoteId = notes[0].id; displayActiveNote(); }
}
init();

// --- Storage helpers ---
function saveAll(){
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
  localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  localStorage.setItem(LS_TAGS, JSON.stringify(tags));
  showSaved();
}
function showSaved(){
  saveIndicator.textContent = 'Saved';
  setTimeout(()=> saveIndicator.textContent = '', 1000);
}

// --- UI rendering ---
function renderNotesList(filter = '') {
  const list = notes.slice();
  const sortBy = sortSelect.value;
  if (sortBy === 'modified') list.sort((a,b)=> b.updated - a.updated);
  else list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  const q = filter.trim().toLowerCase();
  notesList.innerHTML = '';
  for (const n of list){
    if (q) {
      // search in title, body, tags, folder
      const hay = [n.title, n.body, (n.tags||[]).join(' '), (n.folderName||'')].join(' ').toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const li = document.createElement('li');
    li.dataset.id = n.id;
    li.innerHTML = `
      <div>
        <strong>${escapeHTML(n.title || 'Untitled')}</strong>
        <div style="font-size:12px;color:var(--muted)">${escapeHTML(n.preview || (n.body||'').slice(0,80))}</div>
      </div>
      <div style="text-align:right; font-size:12px; color:var(--muted)">${n.folderName || 'Inbox'}</div>
    `;
    li.onclick = ()=> { activeNoteId = n.id; displayActiveNote(); highlightActive(); };
    if (n.id === activeNoteId) li.classList.add('active');
    notesList.appendChild(li);
  }
}

function renderFolders(){
  folderListEl.innerHTML = '';
  folderAssign.innerHTML = '';
  for (const f of folders){
    const el = document.createElement('li');
    el.textContent = f.name;
    el.onclick = ()=> { filterByFolder(f.id) };
    folderListEl.appendChild(el);

    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    folderAssign.appendChild(opt);
  }
}

function renderTags(){
  tagListEl.innerHTML = '';
  for (const t of tags){
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = t;
    span.onclick = ()=> { globalSearch.value = t; runSearch(); };
    tagListEl.appendChild(span);
  }
}

function renderFilesInPreview(files){
  filePreview.innerHTML = '';
  for (const f of files || []){
    if (!f || !f.data) continue;
    if (f.data.startsWith('data:image')) {
      const img = document.createElement('img');
      img.src = f.data;
      img.style.maxWidth = '160px';
      img.title = f.name;
      filePreview.appendChild(img);
    } else {
      const p = document.createElement('div');
      p.textContent = f.name;
      filePreview.appendChild(p);
    }
  }
}

function highlightActive(){
  Array.from(notesList.children).forEach(li=>{
    li.classList.toggle('active', li.dataset.id == activeNoteId);
  });
}

// --- CRUD operations ---
function createNote(){
  const n = {
    id: Date.now().toString(),
    title: '',
    body: '',
    tags: [],
    files: [],
    folderId: folders[0]?.id || 'inbox',
    folderName: folders[0]?.name || 'Inbox',
    created: Date.now(),
    updated: Date.now()
  };
  notes.unshift(n);
  activeNoteId = n.id;
  saveAll();
  renderNotesList(globalSearch.value);
  renderFolders(); displayActiveNote(); highlightActive();
}

function deleteActiveNote(){
  if (!activeNoteId) return;
  notes = notes.filter(n=> n.id !== activeNoteId);
  activeNoteId = notes[0]?.id || null;
  saveAll();
  renderNotesList(globalSearch.value);
  displayActiveNote();
  highlightActive();
}

function displayActiveNote(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) {
    noteTitle.value = '';
    noteBody.value = '';
    renderFilesInPreview([]);
    document.getElementById('noteMeta').textContent = 'No note selected';
    return;
  }
  noteTitle.value = n.title || '';
  noteBody.value = n.body || '';
  tagsInput.value = (n.tags||[]).join(',');
  folderAssign.value = n.folderId || folders[0]?.id;
  renderFilesInPreview(n.files || []);
  document.getElementById('noteMeta').textContent = `Updated: ${new Date(n.updated).toLocaleString()}`;
}

// --- Event wiring ---
function attachHandlers(){
  newNoteBtn.onclick = () => createNote();
  deleteBtn.onclick = ()=> { if(confirm('Delete this note?')) deleteActiveNote(); };
  exportBtn.onclick = exportActiveNote;
  addFolderBtn.onclick = addFolder;
  addTagBtn.onclick = addTag;
  fileInput.onchange = handleFileUpload;
  noteTitle.oninput = autoSaveActive;
  noteBody.oninput = autoSaveActive;
  tagsInput.onchange = applyTagsToActive;
  folderAssign.onchange = applyFolderToActive;
  globalSearch.oninput = debounce(runSearch, 250);
  sortSelect.onchange = ()=> renderNotesList(globalSearch.value);
  summaryBtn.onclick = ()=> alert('AI summary placeholder — I can integrate an API if you want.');
  toggleTheme.onclick = toggleThemeMode;
}

// --- Helpers ---
function autoSaveActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  n.title = noteTitle.value;
  n.body = noteBody.value;
  n.updated = Date.now();
  n.preview = (n.body||'').slice(0,120);
  saveAll();
  renderNotesList(globalSearch.value);
  document.getElementById('noteMeta').textContent = `Updated: ${new Date(n.updated).toLocaleString()}`;
}

function applyTagsToActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  const arr = tagsInput.value.split(',').map(s=> s.trim()).filter(Boolean);
  n.tags = arr;
  // add to global tags list
  arr.forEach(t=> { if (!tags.includes(t)) tags.push(t); });
  saveAll();
  renderTags();
  renderNotesList(globalSearch.value);
}

function applyFolderToActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  const f = folders.find(x=> x.id === folderAssign.value);
  if (!f) return;
  n.folderId = f.id; n.folderName = f.name; n.updated = Date.now();
  saveAll(); renderNotesList(globalSearch.value);
}

async function handleFileUpload(e){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) { alert('Select or create a note first'); return; }
  const files = Array.from(e.target.files || []);
  for (const file of files){
    const data = await toBase64(file);
    n.files = n.files || [];
    n.files.push({ name: file.name, data });
  }
  n.updated = Date.now();
  saveAll();
  renderFilesInPreview(n.files);
  renderNotesList(globalSearch.value);
  e.target.value = '';
}

function addFolder(){
  const name = prompt('New folder name:');
  if (!name) return;
  const id = Date.now().toString();
  folders.push({ id, name });
  localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  renderFolders();
}

function addTag(){
  const t = prompt('New tag:');
  if (!t) return;
  if (!tags.includes(t)) tags.push(t);
  localStorage.setItem(LS_TAGS, JSON.stringify(tags));
  renderTags();
}

// --- Search logic ---
function runSearch(){
  const q = globalSearch.value || '';
  renderNotesList(q);
}
function filterByFolder(folderId){
  // set search box to folder:folderName (internal) or just filter list
  const f = folders.find(x=> x.id === folderId);
  if (!f) return;
  // quick UI highlight: show only notes in folder
  const filtered = notes.filter(n => (n.folderId || 'inbox') === folderId);
  notesList.innerHTML = '';
  for (const n of filtered) {
    const li = document.createElement('li');
    li.dataset.id = n.id;
    li.innerHTML = `<div><strong>${escapeHTML(n.title||'Untitled')}</strong>
      <div style="font-size:12px;color:var(--muted)">${escapeHTML((n.body||'').slice(0,80))}</div></div>
      <div style="font-size:12px;color:var(--muted)">${n.folderName||''}</div>`;
    li.onclick = ()=> { activeNoteId = n.id; displayActiveNote(); highlightActive(); };
    if (n.id === activeNoteId) li.classList.add('active');
    notesList.appendChild(li);
  }
}

// --- Export note ---
function exportActiveNote(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return alert('No note selected');
  const blob = new Blob([JSON.stringify(n, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${(n.title||'note').replace(/\s+/g,'_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Utilities ---
function toBase64(file){ return new Promise(res=>{
  const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(file);
});}
function escapeHTML(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function debounce(fn, t=200){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t); }; }

// --- Theme management ---
function applyTheme(){
  const t = localStorage.getItem(LS_THEME);
  if (t === 'dark') document.body.classList.add('dark');
}
function toggleThemeMode(){
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem(LS_THEME, isDark);
}

// --- init helper show active note on start ---
document.addEventListener('DOMContentLoaded', ()=> {
  // ensure UI shows current active note after DOM ready
  if (!activeNoteId && notes[0]) activeNoteId = notes[0].id;
  displayActiveNote();
  highlightActive();
});

// Expose small helpers for console debugging
window.kv = { notes, folders, tags, saveAll };
