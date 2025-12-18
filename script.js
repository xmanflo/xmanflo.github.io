/* =========================================
   THE IDEA BANK — iPhone Notes Style
   ========================================= */

const STORAGE_KEY = 'idea_bank_notes';
const TRASH_KEY = 'idea_bank_trash';

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let trash = JSON.parse(localStorage.getItem(TRASH_KEY)) || [];
let activeId = null;

/* DOM */
const notesList = document.getElementById('notesList');
const titleInput = document.getElementById('title');
const editor = document.getElementById('editor');
const status = document.getElementById('status');

document.getElementById('newNote').onclick = createNote;
document.getElementById('deleteNote').onclick = deleteNote;
document.getElementById('openTrash').onclick = openTrash;
document.getElementById('search').oninput = renderNotes;

titleInput.oninput = debounce(saveNote, 300);
editor.oninput = debounce(saveNote, 300);

/* ---------- INIT ---------- */
if (!notes.length) createNote();
else selectNote(notes[0].id);

/* ---------- CORE ---------- */
function createNote(){
  const note = {
    id: Date.now().toString(),
    title: '',
    body: '',
    updated: Date.now()
  };
  notes.unshift(note);
  activeId = note.id;
  saveAll();
  renderNotes();
  loadNote(note);
}

function saveNote(){
  const note = notes.find(n => n.id === activeId);
  if (!note) return;

  note.title = titleInput.value;
  note.body = editor.innerHTML;
  note.updated = Date.now();

  saveAll();
  status.textContent = 'Saved';
}

function deleteNote(){
  const note = notes.find(n => n.id === activeId);
  if (!note) return;

  if (!confirm('Move note to Trash?')) return;

  trash.unshift(note);
  notes = notes.filter(n => n.id !== activeId);
  activeId = notes[0]?.id || null;

  saveAll();
  renderNotes();

  if (activeId) loadNote(notes[0]);
  else clearEditor();
}

/* ---------- UI ---------- */
function renderNotes(){
  const q = document.getElementById('search').value.toLowerCase();
  notesList.innerHTML = '';

  notes
    .filter(n => (n.title + n.body).toLowerCase().includes(q))
    .sort((a,b) => b.updated - a.updated)
    .forEach(note => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `<strong>${note.title || 'Untitled'}</strong>`;
      li.onclick = () => selectNote(note.id);
      if (note.id === activeId) li.classList.add('active');
      notesList.appendChild(li);
    });
}

function selectNote(id){
  activeId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;
  loadNote(note);
  renderNotes();
}

function loadNote(note){
  titleInput.value = note.title || '';
  editor.innerHTML = note.body || '';
}

function clearEditor(){
  titleInput.value = '';
  editor.innerHTML = '';
}

/* ---------- TRASH ---------- */
function openTrash(){
  if (!trash.length) return alert('Trash is empty');

  const choice = prompt(
    trash.map((n,i)=>`${i+1}) ${n.title || 'Untitled'}`).join('\n') +
    '\n\nEnter number to restore or "d#" to delete forever'
  );

  if (!choice) return;

  if (choice.startsWith('d')){
    const i = parseInt(choice.slice(1)) - 1;
    trash.splice(i,1);
  } else {
    const i = parseInt(choice) - 1;
    notes.unshift(trash[i]);
    trash.splice(i,1);
  }

  saveAll();
  renderNotes();
}

/* ---------- STORAGE ---------- */
function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

/* ---------- UTILS ---------- */
function debounce(fn, delay){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), delay);
  };
}
