// 旧カウンター関連コードを削除し TODO 実装へ置換
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');

let todos = load();

render();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  todos.push({
    id: crypto.randomUUID(),
    text,
    done: false
  });
  input.value = '';
  persist();
  render();
});

function toggle(id) {
  const t = todos.find(t => t.id === id);
  if (t) {
    t.done = !t.done;
    persist();
    render();
  }
}

function removeTodo(id) {
  todos = todos.filter(t => t.id !== id);
  persist();
  render();
}

function render() {
  if (!todos.length) {
    list.innerHTML = '<li class="empty">まだ何もありません</li>';
    return;
  }
  list.innerHTML = todos.map(t => `
    <li class="item ${t.done ? 'done' : ''}">
      <label>
        <input type="checkbox" ${t.done ? 'checked' : ''} data-action="toggle" data-id="${t.id}">
        <span class="text">${escapeHtml(t.text)}</span>
      </label>
      <button class="del" data-action="del" data-id="${t.id}" aria-label="削除">×</button>
    </li>
  `).join('');
}

list.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.getAttribute('data-id');
  if (!id) return;
  const action = target.getAttribute('data-action');
  if (action === 'toggle') {
    toggle(id);
  } else if (action === 'del') {
    removeTodo(id);
  }
});

list.addEventListener('change', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.action === 'toggle') {
    const id = target.dataset.id;
    if (id) toggle(id);
  }
});

function persist() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function load() {
  try {
    const raw = localStorage.getItem('todos');
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
