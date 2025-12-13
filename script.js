/* Knowledge Vault — v1 upgraded
   Features included:
   - Local-first notes (title + rich content in contenteditable)
   - Attachments (images, PDFs, files stored as base64 inside note objects)
   - Folder + Tag system
   - Trash bin (soft delete, restore, permanent delete)
   - Export / Import vault JSON (includes base64 file data)
   - PDF viewer using PDF.js + simple annotation (text notes saved to note.annotations)
   - PWA-ready (service worker) and manifest
   - Optional realtime (Firebase or Supabase) placeholders (FIREBASE_ENABLED false by default)
   - Modern UI wiring, search indexing, autosave
*/

/* ===== CONFIG: ENABLE REALTIME =====
   To enable Firebase realtime:
     1) Set FIREBASE_ENABLED = true
     2) Paste your firebaseConfig object below
     3) Make sure Firestore is enabled in your Firebase project

   Or implement Supabase realtime by replacing the Firebase block where indicated.
*/
const FIREBASE_ENABLED = false;
const firebaseConfig = {
  // paste your Firebase config here
  apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: ""
};

/* ===== END CONFIG ===== */

const LS_KEY = 'kv_vault_v1';
const LS_FOLDERS = 'kv_vault_folders_v1';
const LS_TAGS = 'kv_vault_tags_v1';
const LS_TRASH = 'kv_vault_trash_v1';
const LS_THEME = 'kv_vault_theme_v1';

let notes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
let folders = JSON.parse(localStorage.getItem(LS_FOLDERS) || '[]');
let tags = JSON.parse(localStorage.getItem(LS_TAGS) || '[]');
let trash = JSON.parse(localStorage.getItem(LS_TRASH) || '[]');
let activeNoteId = null;

/* DOM refs */
const newNoteBtn = document.getElementById('newNoteBtn');
const notesList = document.getElementById('notesList');
const noteTitle = document.getElementById('noteTitle');
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
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const editor = document.getElementById('editor');
const openPdfBtn = document.getElementById('openPdfBtn');
const pdfModal = document.getElementById('pdfModal');
const pdfContainer = document.getElementById('pdfContainer');
const pdfCloseBtn = document.getElementById('closePdfBtn');
const pdfAnnotateBtn = document.getElementById('pdfAnnotateBtn');
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
const syncIndicator = document.getElementById('syncIndicator') || { textContent: 'Local' };

/* Init */
function init(){
  if (!folders.length) {
    folders = [{ id:'inbox', name:'Inbox' }];
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

  if (FIREBASE_ENABLED) initFirebase(); // placeholder
}
init();

/* Storage helpers */
function saveAll(){
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
  localStorage.setItem(LS_FOLDERS, JSON.stringify(folders));
  localStorage.setItem(LS_TAGS, JSON.stringify(tags));
  localStorage.setItem(LS_TRASH, JSON.stringify(trash));
  showSaved();
  if (FIREBASE_ENABLED) syncAllToRemote(); // placeholder hook
}
function showSaved(){ saveIndicator.textContent = 'Saved'; setTimeout(()=> saveIndicator.textContent = '', 1000); }

/* UI render */
function renderNotesList(filter=''){
  const list = notes.slice();
  const sortBy = sortSelect.value;
  if (sortBy === 'modified') list.sort((a,b)=>b.updated - a.updated);
  else list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  const q = (filter||'').trim().toLowerCase();
  notesList.innerHTML = '';
  for (const n of list){
    if (n.deleted) continue;
    if (q){
      const hay = [n.title, n.bodyText || '', (n.tags||[]).join(' '), n.folderName||''].join(' ').toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const li = document.createElement('li');
    li.dataset.id = n.id;
    li.innerHTML = `<div>
      <strong>${escapeHTML(n.title||'Untitled')}</strong>
      <div style="font-size:12px;color:var(--muted)">${escapeHTML((n.preview || (stripHTML(n.body||'')).slice(0,120)) || '')}</div>
    </div>
    <div style="text-align:right; font-size:12px; color:var(--muted)">${escapeHTML(n.folderName||'Inbox')}</div>`;
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
    opt.value = f.id; opt.textContent = f.name;
    folderAssign.appendChild(opt);
  }
}

function renderTags(){
  tagListEl.innerHTML = '';
  for (const t of tags){
    const span = document.createElement('span');
    span.className = 'tag'; span.textContent = t;
    span.onclick = ()=> { globalSearch.value = t; runSearch(); };
    tagListEl.appendChild(span);
  }
}

function renderFilesInPreview(files){
  filePreview.innerHTML = '';
  for (const f of files || []){
    if (!f || !f.data) continue;
    if (f.data.startsWith('data:image') || f.data.startsWith('data:video')){
      const img = document.createElement('img'); img.src = f.data; img.title = f.name;
      filePreview.appendChild(img);
      img.onclick = ()=> { const w=window.open(''); w.document.write(`<img src="${f.data}" style="max-width:100%"/>`); };
    } else if (f.name && f.name.toLowerCase().endsWith('.pdf')){
      const p = document.createElement('div'); p.className='file-pdf'; p.textContent = `PDF: ${f.name}`;
      p.onclick = ()=> openPdfData(f);
      filePreview.appendChild(p);
    } else {
      const p = document.createElement('div'); p.textContent = f.name || 'file';
      filePreview.appendChild(p);
    }
  }
}

function highlightActive(){
  Array.from(notesList.children).forEach(li=>{
    li.classList.toggle('active', li.dataset.id == activeNoteId);
  });
}

/* CRUD */
function createNote(){
  const n = {
    id: Date.now().toString(),
    title: '',
    body: '',
    bodyText: '',
    preview: '',
    tags: [],
    files: [],
    annotations: [],
    folderId: folders[0]?.id || 'inbox',
    folderName: folders[0]?.name || 'Inbox',
    created: Date.now(),
    updated: Date.now(),
    deleted: false
  };
  notes.unshift(n); activeNoteId = n.id;
  saveAll(); renderNotesList(globalSearch.value); renderFolders(); displayActiveNote(); highlightActive();
}

function deleteActiveNote(){
  if (!activeNoteId) return;
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  // soft delete -> trash
  n.deleted = true; n.updated = Date.now();
  trash.unshift(n);
  notes = notes.filter(x=> x.id !== activeNoteId);
  activeNoteId = notes[0]?.id || null;
  saveAll(); renderNotesList(globalSearch.value); displayActiveNote(); highlightActive();
}

function permanentlyDelete(id){
  trash = trash.filter(t=> t.id !== id);
  saveAll();
}
function restoreFromTrash(id){
  const t = trash.find(x=> x.id === id);
  if (!t) return;
  t.deleted = false; notes.unshift(t);
  trash = trash.filter(x=> x.id !== id);
  saveAll(); renderNotesList(globalSearch.value);
}

function displayActiveNote(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n){
    noteTitle.value = ''; editor.innerHTML = ''; renderFilesInPreview([]); document.getElementById('noteMeta').textContent='No note selected';
    return;
  }
  noteTitle.value = n.title || '';
  editor.innerHTML = n.body || '';
  tagsInput.value = (n.tags||[]).join(',');
  folderAssign.value = n.folderId || folders[0]?.id;
  renderFilesInPreview(n.files || []);
  document.getElementById('noteMeta').textContent = `Updated: ${new Date(n.updated).toLocaleString()}`;
}

/* Events wiring */
function attachHandlers(){
  newNoteBtn.onclick = createNote;
  deleteBtn.onclick = ()=> { if(confirm('Delete this note? (moves to Trash)')) deleteActiveNote(); };
  exportBtn.onclick = exportActiveNote;
  addFolderBtn.onclick = addFolder;
  addTagBtn.onclick = addTag;
  fileInput.onchange = handleFileUpload;
  noteTitle.oninput = debounce(autoSaveActive, 300);
  editor.addEventListener('input', debounce(autoSaveActive, 600));
  tagsInput.onchange = applyTagsToActive;
  folderAssign.onchange = applyFolderToActive;
  globalSearch.oninput = debounce(runSearch, 250);
  sortSelect.onchange = ()=> renderNotesList(globalSearch.value);
  summaryBtn.onclick = ()=> alert('AI summary placeholder — I can wire OpenAI if you want.');
  toggleThemeBtn.onclick = toggleThemeMode;
  openTrashBtn.onclick = openTrash;
  exportVaultBtn.onclick = exportVault;
  importVaultBtn.onclick = ()=> importVaultFile.click();
  importVaultFile.onchange = handleImportFile;
  pdfCloseBtn && (pdfCloseBtn.onclick = ()=> closePdfModal());
  pdfAnnotateBtn && (pdfAnnotateBtn.onclick = ()=> addPdfAnnotation());
  pdfDownloadBtn && (pdfDownloadBtn.onclick = ()=> downloadOpenPdf());
  // toolbar buttons
  document.querySelectorAll('.tool').forEach(btn=>{
    btn.onclick = ()=> applyEditorCommand(btn.dataset.cmd);
  });
}

/* Autosave */
function autoSaveActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  n.title = noteTitle.value;
  n.body = editor.innerHTML;
  n.bodyText = stripHTML(n.body);
  n.preview = (n.bodyText||'').slice(0,200);
  n.updated = Date.now();
  saveAll();
  renderNotesList(globalSearch.value);
  document.getElementById('noteMeta').textContent = `Updated: ${new Date(n.updated).toLocaleString()}`;
}

/* Tags / folders */
function applyTagsToActive(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return;
  const arr = tagsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  n.tags = arr;
  arr.forEach(t=>{ if (!tags.includes(t)) tags.push(t); });
  saveAll();
  renderTags(); renderNotesList(globalSearch.value);
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
  folders.push({ id, name }); localStorage.setItem(LS_FOLDERS, JSON.stringify(folders)); renderFolders();
}
function addTag(){
  const t = prompt('New tag:');
  if (!t) return;
  if (!tags.includes(t)) tags.push(t);
  localStorage.setItem(LS_TAGS, JSON.stringify(tags)); renderTags();
}

/* File uploads */
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
  saveAll(); renderFilesInPreview(n.files); renderNotesList(globalSearch.value);
  e.target.value = '';
}
function toBase64(file){ return new Promise(res=>{ const r=new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(file); }); }

/* Search & filtering */
function runSearch(){ renderNotesList(globalSearch.value); }
function filterByFolder(folderId){
  const f = folders.find(x=> x.id === folderId); if (!f) return;
  const filtered = notes.filter(n=> (n.folderId || 'inbox') === folderId && !n.deleted);
  notesList.innerHTML = '';
  for (const n of filtered){
    const li = document.createElement('li'); li.dataset.id = n.id;
    li.innerHTML = `<div><strong>${escapeHTML(n.title||'Untitled')}</strong>
      <div style="font-size:12px;color:var(--muted)">${escapeHTML((n.preview||stripHTML(n.body||'')).slice(0,80))}</div></div>
      <div style="font-size:12px;color:var(--muted)">${n.folderName||''}</div>`;
    li.onclick = ()=> { activeNoteId = n.id; displayActiveNote(); highlightActive(); };
    if (n.id === activeNoteId) li.classList.add('active');
    notesList.appendChild(li);
  }
}

/* Export / Import */
function exportActiveNote(){
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return alert('No note selected');
  const blob = new Blob([JSON.stringify(n, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${(n.title||'note').replace(/\s+/g,'_')}.json`; a.click();
  URL.revokeObjectURL(url);
}
function exportVault(){
  const payload = { notes, folders, tags, trash, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `knowledge_vault_export_${(new Date().toISOString().slice(0,19)).replace(/[:T]/g,'_')}.json`; a.click();
  URL.revokeObjectURL(url);
}
function handleImportFile(e){
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ()=> {
    try {
      const data = JSON.parse(r.result);
      if (data.notes) notes = data.notes.concat(notes);
      if (data.folders) folders = data.folders.concat(folders);
      if (data.tags) tags = Array.from(new Set([...tags, ...(data.tags||[])]));
      saveAll(); renderFolders(); renderTags(); renderNotesList();
      alert('Import complete');
    } catch (err) {
      alert('Import failed: invalid JSON');
    }
  };
  r.readAsText(f); e.target.value = '';
}

/* Trash UI (simple prompt-based) */
function openTrash(){
  if (!trash.length) return alert('Trash is empty');
  const list = trash.slice();
  const pick = prompt('Trash items:\n' + list.map((t,i)=> `${i+1}) ${t.title||'Untitled'} (${new Date(t.updated).toLocaleString()})`).join('\n') + '\n\nType number to restore, or prefix "d" to permanently delete (e.g. d2):');
  if (!pick) return;
  if (pick.startsWith('d')){
    const idx = parseInt(pick.slice(1)) - 1; const id = list[idx]?.id; if (id){ permanentlyDelete(id); alert('Deleted permanently'); }
  } else {
    const idx = parseInt(pick) - 1; const id = list[idx]?.id; if (id){ restoreFromTrash(id); alert('Restored'); }
  }
}

/* PDF.js integration */
let openedPdf = null;
async function openPdfData(fileObj){
  openedPdf = fileObj; if (!openedPdf) return;
  pdfModal.setAttribute('aria-hidden','false'); pdfModal.style.display='flex'; pdfContainer.innerHTML='';
  // load via pdf.js (data url -> binary)
  try {
    const raw = atob(openedPdf.data.split(',')[1]);
    const loadingTask = window.pdfjsLib.getDocument({ data: raw });
    const pdf = await loadingTask.promise;
    for (let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height; canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      pdfContainer.appendChild(canvas);
    }
  } catch (err){
    console.error('PDF open error', err); alert('Unable to open PDF (maybe corrupted)');
  }
}
function closePdfModal(){ pdfModal.setAttribute('aria-hidden','true'); pdfModal.style.display='none'; pdfContainer.innerHTML=''; openedPdf=null; }
function addPdfAnnotation(){
  if (!openedPdf) return alert('Open a PDF first');
  const text = prompt('PDF annotation text:');
  if (!text) return;
  const n = notes.find(x=> x.id === activeNoteId);
  if (!n) return alert('Select a note to attach annotation');
  n.annotations = n.annotations || []; n.annotations.push({ pdf: openedPdf.name, note: text, time: Date.now() });
  n.updated = Date.now(); saveAll(); alert('Annotation saved to note');
}
function downloadOpenPdf(){ if (!openedPdf) return; const a=document.createElement('a'); a.href = openedPdf.data; a.download = openedPdf.name || 'file.pdf'; a.click(); }

/* Rich editor commands */
function applyEditorCommand(cmd){
  if (cmd === 'insertImage'){
    // create a temporary file input
    const f = document.createElement('input'); f.type='file'; f.accept='image/*'; f.onchange = async ()=> {
      const file = f.files[0]; if (!file) return;
      const data = await toBase64(file);
      document.execCommand('insertImage', false, data);
      // attach image into note.files as well
      const n = notes.find(x=> x.id === activeNoteId);
      if (n){ n.files = n.files || []; n.files.push({ name: file.name, data }); n.updated = Date.now(); saveAll(); renderFilesInPreview(n.files); }
    }; f.click();
    return;
  }
  if (cmd === 'bold') document.execCommand('bold');
  if (cmd === 'italic') document.execCommand('italic');
  if (cmd === 'ul') document.execCommand('insertUnorderedList');
}

/* Utilities */
function toBase64(file){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
function escapeHTML(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function stripHTML(html){ const tmp = document.createElement('div'); tmp.innerHTML = html || ''; return tmp.textContent || tmp.innerText || ''; }
function debounce(fn, t=200){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t); }; }

/* Theme */
function applyTheme(){ const t = localStorage.getItem(LS_THEME); if (t==='dark') document.body.classList.add('dark'); }
function toggleThemeMode(){ document.body.classList.toggle('dark'); const t = document.body.classList.contains('dark') ? 'dark' : 'light'; localStorage.setItem(LS_THEME, t); }

/* Simple placeholders for remote sync (Firebase) */
async function initFirebase(){
  // This function is a stub. To enable:
  // 1) include Firebase scripts (compat) dynamically
  // 2) initialize app with firebaseConfig
  // 3) subscribe to Firestore collection and merge changes into local notes
  console.warn('Firebase realtime not initialized. Set FIREBASE_ENABLED=true and provide firebaseConfig to enable.');
}
function syncAllToRemote(){ /* placeholder to push local changes to remote */ }

/* Init UI after DOM ready */
document.addEventListener('DOMContentLoaded', ()=> {
  if (!notes.length) createNote();
  if (!activeNoteId && notes[0]) activeNoteId = notes[0].id;
  displayActiveNote(); highlightActive();
});

/* Expose small debug object */
window.kv = { notes, folders, tags, trash, saveAll };
