// --- Theme Toggle ---
document.getElementById("toggleTheme").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark"));
};

if (localStorage.getItem("theme") === "true") {
  document.body.classList.add("dark");
}

// --- Notes System ---
let notes = JSON.parse(localStorage.getItem("notes") || "[]");
let activeNote = null;

function saveNotes() {
  localStorage.setItem("notes", JSON.stringify(notes));
}

// Create new note
document.getElementById("newNoteBtn").onclick = () => {
  const newNote = {
    id: Date.now(),
    title: "",
    body: "",
    tags: [],
    files: []
  };
  notes.push(newNote);
  activeNote = newNote.id;
  displayNote();
  saveNotes();
};

// Display selected note
function displayNote() {
  const note = notes.find(n => n.id === activeNote);
  if (!note) return;

  document.getElementById("noteTitle").value = note.title;
  document.getElementById("noteBody").value = note.body;
  renderFiles(note.files);
}

// Auto-save fields
document.getElementById("noteTitle").oninput =
document.getElementById("noteBody").oninput = () => {
  const note = notes.find(n => n.id === activeNote);
  if (!note) return;

  note.title = document.getElementById("noteTitle").value;
  note.body = document.getElementById("noteBody").value;
  saveNotes();
};

// File uploads → Base64 storage
document.getElementById("fileInput").onchange = async function() {
  const note = notes.find(n => n.id === activeNote);
  if (!note) return;

  for (const file of this.files) {
    const url = await fileToBase64(file);
    note.files.push({ name: file.name, data: url });
  }
  saveNotes();
  renderFiles(note.files);
};

function renderFiles(files) {
  const div = document.getElementById("filePreview");
  div.innerHTML = "";
  files.forEach(f => {
    if (f.data.startsWith("data:image")) {
      const img = document.createElement("img");
      img.src = f.data;
      div.appendChild(img);
    }
  });
}

// Convert file → Base64
function fileToBase64(file) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.readAsDataURL(file);
  });
}
