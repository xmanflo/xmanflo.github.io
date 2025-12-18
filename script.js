let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let trash = JSON.parse(localStorage.getItem('trash') || '[]');
let activeId = null;

const list = document.getElementById('notesList');
const titleInput = document.getElementById('noteTitle');
const editor = document.getElementById('editor');
const trashModal = document.getElementById('trashModal');

function save() {
  localStorage.setItem('notes', JSON.stringify(notes));
  localStorage.setItem('trash', JSON.stringify(trash));
}

function renderList() {
  list.innerHTML = '';
  notes.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item' + (n.id === activeId ? ' active' : '');
    div.textContent = n.title || 'Untitled';
    div.onclick = () => openNote(n.id);
    list.appendChild(div);
  });
}

function newNote() {
  const note = { id: Date.now(), title: '', body: '' };
  notes.unshift(note);
  activeId = note.id;
  save();
  renderList();
  loadNote(note);
}

function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  activeId = id;
  loadNote(note);
  renderList();
}

function loadNote(note) {
  titleInput.value = note.title;
  editor.innerHTML = marked.parse(note.body || '');
}

titleInput.oninput = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.title = titleInput.value;
  save();
  renderList();
};

editor.oninput = () => {
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.body = editor.innerText;
  save();
};

document.getElementById('newBtn').onclick = newNote;

document.getElementById('trashBtn').onclick = () => {
  trashModal.classList.remove('hidden');
  trashModal.innerHTML = `
    <div class="modal-content">
      <h3>Trash</h3>
      ${trash.map((n,i)=>`
        <div>
          ${n.title || 'Untitled'}
          <button onclick="restore(${i})">Restore</button>
          <button onclick="removeForever(${i})">Delete</button>
        </div>
      `).join('')}
      <button onclick="closeTrash()">Close</button>
    </div>`;
};

function restore(i) {
  notes.unshift(trash[i]);
  trash.splice(i,1);
  save();
  closeTrash();
  renderList();
}

function removeForever(i) {
  trash.splice(i,1);
  save();
  closeTrash();
}

function closeTrash() {
  trashModal.classList.add('hidden');
}

renderList();
