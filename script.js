/* Knowledge Vault — upgraded
   Features:
   - local-first notes with attachments + trash
   - realtime collaboration via Firebase Firestore (optional — configure below)
   - PDF.js viewer integration (open attached PDFs in modal)
   - export/import of full vault
   - modern UI wiring, theme, PWA friendly
*/

/* =========================
   CONFIG — add your Firebase config here to enable realtime
   If you don't add config, app remains local-only (localStorage).
   To use Firebase:
     1. create project at console.firebase.google.com
     2. enable Firestore (in test mode or secure rules)
     3. copy the firebaseConfig below (apiKey etc.)
   ========================= */
const FIREBASE_ENABLED = false; // flip to true after pasting your config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
/* =========================
   Optional: Supabase notes:
   If you prefer Supabase Realtime, you can replace the Firebase block
   with a Supabase client and subscribe to changes on the notes table.
   ========================= */

/* =========================
   END CONFIG
   ========================= */

const LS_KEY = 'kv_notes_v3';
const LS_FOLDERS = 'kv_folders_v3';
const LS_TAGS = 'kv_tags_v3';
const LS_THEME = 'kv_theme_v3';
const LS_TRASH = 'kv_trash_v3';

let notes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
let folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]');
let tags = JSON.parse(localStorage.getItem(LS_TAGS) || '[]');
let trash = JSON.parse(localStorage.getItem(LS_TRASH) || '[]');
let activeNoteId = null;

// DOM
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
const toggleThemeBtn = document.getElementById('toggleTheme');
const openTrashBtn = document.getElementById('openTrashBtn');
const exportVaultBtn = document.getElementById('exportVaultBtn');
const importVaultBtn = document.getElementById('importVaultBtn');
const importVaultFile = document.getElementById('importVaultFile');
const openPdfBtn = document.getElementById('openPdfBtn');

const pdfModal = document.getElementById('pdfModal');
const pdfContainer = document.getElementById('pdfContainer');
const pdfCloseBtn = document.getElementById('closePdfBtn') || document.querySelector('#closePdfBtn');
const pdfAnnotateBtn = document.getElementById('pdfAnnotateBtn');
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
const syncIndicator = document.getElementById('syncIndicator') || { textContent: 'Local' };

// Firebase placeholders
let firebaseApp = null;
let firestore = null;
let unsubscribes = [];

// init
function init(){
  if (!folders.length) {
    folders = [{ id: 'inbox', name: 'Inbox' }];
    localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  }
  renderFolders();
  renderTags();
  renderNotesList();
  applyTheme();
  attachHandlers();
  if (notes.length) activeNoteId = notes[0].id;
  displayActiveNote();
  highlightActive();

  if (FIREBASE_ENABLED) initFirebase();
}
init();

// ================= STORAGE HELPERS =================
function saveAll(){
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
  localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  localStorage.setItem(LS_TAGS, JSON.stringify(tags));
  localStorage.setItem(LS_TRASH, JSON.stringify(trash));
  showSaved();
  // push to remote if configured
  if (FIREBASE_ENABLED) syncNoteToRemote();
}
function showSaved(){
  saveIndicator.textContent = 'Saved';
  setTimeout(()=> saveIndicator.textContent = '', 1200);
}
function showSyncing(){ syncIndicator.textContent = 'Syncing...'; }
function showSynced(){ syncIndicator.textContent = 'Synced'; setTimeout(()=> syncIndicator.textContent = 'Local', 1200); }

// ================= UI RENDER =================
function renderNotesList(filter=''){
  const list = notes.slice();
  const sortBy = sortSelect.value;
  if (sortBy === 'modified') list.sort((a,b)=> b.updated - a.updated);
  else list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  const q = filter.trim().toLowerCase();
  notesList.innerHTML = '';
  for (const n of list){
    if (n.deleted) continue;
    if (q){
      const hay = [n.title, n.body, (n.tags||[]).join(' '), (n.folderName||'')].join(' ').toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const li = document.createElement('li');
    li.dataset.id = n.id;
    li.innerHTML = `<div>
      <strong>${escapeHTML(n.title || 'Untitled')}</strong>
      <div style="font-size:12px;color:var(--muted)">${escapeHTML((n.preview||n.body||'').slice(0,80))}</div>
    </div>
    <div style="text-align:right; font-size:12px; color:var(--muted)">${escapeHTML(n.folderName || 'Inbox')}</div>`;
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
    el.onclick = ()=> { filterByFolder(f.id); };
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
    if (f.data.startsWith('data:image') || f.data.startsWith('data:video') ){
      const img = document.createElement('img');
      img.src = f.data;
      img.style.maxWidth = '160px';
      img.title = f.name;
      filePreview.appendChild(img);
      // click to open larger in new tab
      img.onclick = ()=> { const w=window.open(''); w.document.write(`<img src="${f.data}" style="max-width:100%"/>`); };
    } else if (f.name && f.name.toLowerCase().endsWith('.pdf')){
      const p = document.createElement('div');
      p.className = 'file-pdf';
      p.textContent = `PDF: ${f.name}`;
      p.onclick = ()=> openPdfData(f);
      filePreview.appendChild(p);
    } else {
      const p = document.createElement('div');
      p.textContent = f.name || 'file';
      filePreview.appendChild(p);
    }
  }
}

// highlight selected in sidebar
function highlightActive(){
  Array.from(notesList.children).forEach(li=>{
    li.classList.toggle('active', li.dataset.id == activeNoteId);
  });
}

// ================= CRUD =================
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
    updated: Date.now(),
    deleted: false
  };
  notes.unshift(n);
  activeNoteId = n.id;
  saveAll();
  renderNotesList(globalSearch.value);
  renderFolders(); displayActiveNote(); highlightActive();
}

function deleteActiveNote(){
  if (!activeNoteId) return;
  const n = notes.find(x=> x.id===activeNoteId);
  if (!n) return;
  // move to trash (soft delete)
  n.deleted = true;
  n.updated = Date.now();
  trash.unshift(n);
  notes = notes.filter(x=> x.id !== activeNoteId);
  activeNoteId = notes[0]?.id || null;
  saveAll();
  renderNotesList(globalSearch.value);
  displayActiveNote();
  highlightActive();
}

function permanentlyDelete(id){
  // remove from trash
  trash = trash.filter(t=> t.id !== id);
  saveAll();
}

function restoreFromTrash(id){
  const t = trash.find(x=> x.id === id);
  if (!t) return;
  t.deleted = false;
  notes.unshift(t);
  trash = trash.filter(x=> x.id !== id);
  saveAll();
  renderNotesList(globalSearch.value);
}

/* displayActiveNote shows current note in editor */
function displayActiveNote(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n){
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

// ================= EVENTS =================
function attachHandlers(){
  newNoteBtn.onclick = () => createNote();
  deleteBtn.onclick = ()=> { if(confirm('Delete this note? (moves to Trash)')) deleteActiveNote(); };
  exportBtn.onclick = exportActiveNote;
  addFolderBtn.onclick = addFolder;
  addTagBtn.onclick = addTag;
  fileInput.onchange = handleFileUpload;
  noteTitle.oninput = debounce(autoSaveActive, 300);
  noteBody.oninput = debounce(autoSaveActive, 600);
  tagsInput.onchange = applyTagsToActive;
  folderAssign.onchange = applyFolderToActive;
  globalSearch.oninput = debounce(runSearch, 250);
  sortSelect.onchange = ()=> renderNotesList(globalSearch.value);
  summaryBtn.onclick = ()=> alert('AI summary placeholder — tell me if you want me to wire OpenAI or another provider.');
  toggleThemeBtn.onclick = toggleThemeMode;
  openTrashBtn.onclick = openTrash;
  exportVaultBtn.onclick = exportVault;
  importVaultBtn.onclick = ()=> importVaultFile.click();
  importVaultFile.onchange = handleImportFile;
  openPdfBtn.onclick = ()=> { alert('Open PDF: click an attached PDF in file preview to open it.'); };

  // pdf modal controls
  pdfCloseBtn && (pdfCloseBtn.onclick = ()=> closePdfModal());
  pdfAnnotateBtn && (pdfAnnotateBtn.onclick = ()=> addPdfAnnotation());
  pdfDownloadBtn && (pdfDownloadBtn.onclick = ()=> downloadOpenPdf());
}

// auto save
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

// tags/folders
function applyTagsToActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  const arr = tagsInput.value.split(',').map(s=> s.trim()).filter(Boolean);
  n.tags = arr;
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

// ================= FILE UPLOADS =================
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
function toBase64(file){ return new Promise(res=>{
  const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(file);
});}

// ================= SEARCH =================
function runSearch(){ const q = globalSearch.value || ''; renderNotesList(q); }
function filterByFolder(folderId){
  const f = folders.find(x=> x.id === folderId);
  if (!f) return;
  // show only notes in folder
  const filtered = notes.filter(n => (n.folderId || 'inbox') === folderId && !n.deleted);
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

// ================= EXPORT / IMPORT =================
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

function exportVault(){
  const payload = { notes, folders, tags, trash, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `knowledge_vault_export_${(new Date().toISOString().slice(0,19)).replace(/[:T]/g,'_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(e){
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try {
      const data = JSON.parse(r.result);
      if (data.notes) notes = data.notes.concat(notes);
      if (data.folders) folders = data.folders.concat(folders);
      if (data.tags) tags = Array.from(new Set([...tags, ...data.tags]));
      saveAll();
      renderFolders(); renderTags(); renderNotesList();
      alert('Import complete');
    } catch (err){
      alert('Import failed: invalid JSON');
    }
  };
  r.readAsText(f);
  e.target.value = '';
}

// ================= TRASH =================
function openTrash(){
  const list = trash.slice();
  if (!list.length) return alert('Trash is empty');
  // simple dialog listing items
  const pick = prompt('Trash items:\n' + list.map((t,i)=> `${i+1}) ${t.title||'Untitled'} (${new Date(t.updated).toLocaleString()})`).join('\n') + '\n\nType number to restore, or prefix "d" to permanently delete (e.g. d2):');
  if (!pick) return;
  if (pick.startsWith('d')){
    const idx = parseInt(pick.slice(1)) - 1;
    const id = list[idx]?.id;
    if (id) { permanentlyDelete(id); alert('Deleted permanently'); }
  } else {
    const idx = parseInt(pick) - 1;
    const id = list[idx]?.id;
    if (id) { restoreFromTrash(id); alert('Restored'); }
  }
}

// ================= PDF.js integration =================
let openedPdf = null; // {name, dataUrl}
async function openPdfData(fileObj){
  // fileObj: {name, data}
  openedPdf = fileObj;
  if (!openedPdf) return;
  // show modal
  pdfModal.setAttribute('aria-hidden', 'false');
  pdfModal.style.display = 'flex';
  pdfContainer.innerHTML = '';
  // load with pdf.js
  const loadingTask = window.pdfjsLib.getDocument({ data: atob(openedPdf.data.split(',')[1]) });
  const pdf = await loadingTask.promise;
  for (let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    pdfContainer.appendChild(canvas);
  }
}
function closePdfModal(){
  pdfModal.setAttribute('aria-hidden', 'true');
  pdfModal.style.display = 'none';
  pdfContainer.innerHTML = '';
  openedPdf = null;
}
function addPdfAnnotation(){
  if (!openedPdf) return alert('Open a PDF first');
  const text = prompt('Add a quick note/annotation for this PDF page:');
  if (!text) return;
  // attach annotation to active note (simple)
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return alert('Select a note first to attach annotation');
  n.annotations = n.annotations || [];
  n.annotations.push({ pdf: openedPdf.name, note: text, time: Date.now() });
  n.updated = Date.now();
  saveAll();
  alert('Annotation saved to note');
}
function downloadOpenPdf(){
  if (!openedPdf) return;
  const a = document.createElement('a');
  a.href = openedPdf.data;
  a.download = openedPdf.name || 'file.pdf';
  a.click();
}

// ================= REMOTE SYNC (FIREBASE) =================
async function initFirebase(){
  if (!FIREBASE_ENABLED) return;
  try {
    // load firebase scripts dynamically
    await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js');
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firestore = firebase.firestore();
    setupRealtimeListeners();
    console.log('Firebase initialized');
  } catch (e){
    console.error('Firebase init failed', e);
    alert('Firebase init failed — check console and your config.');
  }
}
function loadScript(src){ return new Promise((res, rej)=> {
  const s = document.createElement('script');
  s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
});}

function setupRealtimeListeners(){
  // push local notes to remote collection 'notes' and subscribe to remote updates
  const coll = firestore.collection('notes');

  // push local initial set if remote empty (simple strategy)
  coll.get().then(snapshot=>{
    if (snapshot.empty){
      // write local notes to remote
      notes.forEach(n=>{
        coll.doc(n.id).set(n).catch(e=>console.warn('push failed', e));
      });
    }
  });

  // subscribe to changes
  const unsub = coll.onSnapshot(snapshot=>{
    showSyncing();
    snapshot.docChanges().forEach(change=>{
      const data = change.doc.data();
      if (change.type === 'added' || change.type === 'modified'){
        // merge remote into local if newer
        const local = notes.find(x=> x.id === data.id);
        if (!local){
          notes.push(data);
        } else if ((data.updated || 0) > (local.updated || 0)){
          Object.assign(local, data);
        }
      } else if (change.type === 'removed'){
        notes = notes.filter(x=> x.id !== data.id);
      }
    });
    saveAll();
    renderNotesList(globalSearch.value);
    showSynced();
  }, err => console.error('remote snapshot', err));
  unsubscribes.push(unsub);
}

function syncNoteToRemote(){
  if (!FIREBASE_ENABLED || !firestore) return;
  showSyncing();
  const coll = firestore.collection('notes');
  notes.forEach(n=>{
    coll.doc(n.id).set(n).catch(e=> console.warn('remote write error', e));
  });
  showSynced();
}

// helper to stop remote listeners (not used now)
function teardownRemote(){
  unsubscribes.forEach(u=> typeof u === 'function' && u());
  unsubscribes = [];
}

// ================= UTILITIES =================
function escapeHTML(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function debounce(fn, t=200){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t); }; }

// theme
function applyTheme(){
  const t = localStorage.getItem(LS_THEME);
  if (t === 'dark') document.body.classList.add('dark');
}
function toggleThemeMode(){
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem(LS_THEME, isDark);
}

// ================= INIT UI small helpers =================
document.addEventListener('DOMContentLoaded', ()=> {
  // set active note if missing
  if (!activeNoteId && notes[0]) activeNoteId = notes[0].id;
  displayActiveNote();
  highlightActive();
});

// expose for debugging
window.kv = { notes, folders, tags, trash, saveAll, syncNoteToRemote };

/* End of script.js */
