// 旧カウンター関連コードを削除し TODO 実装へ置換
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const dueInput = document.getElementById('todo-due');
const priorityInput = document.getElementById('todo-priority');


let todos = load();

render();

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const due = dueInput.value || null; // 未入力は null
  const priority = priorityInput.value; // "high" | "mid" | "low"

  todos.push({
    id: crypto.randomUUID(),
    text,
    due,
    priority,
    done: false
  });

  input.value = '';
  dueInput.value = '';
  priorityInput.value = 'mid';

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

  // 1) スコア付け（動的）→ 2) 並び替え（score降順）→ 3) ランク付け
  const ranked = todos
    .map(t => ({ ...t, score: calcScore(t) }))
    .sort((a, b) => b.score - a.score);

  list.innerHTML = ranked.map((t, idx) => `
    <li class="item ${t.done ? 'done' : ''}">
      <span class="rank">#${idx + 1}</span>

      <label class="left">
        <input type="checkbox" ${t.done ? 'checked' : ''} data-action="toggle" data-id="${t.id}">
        <span class="text">${escapeHtml(t.text)}</span>
      </label>

      <span class="meta">
        <span class="due">${t.due ? `📅 ${t.due}` : '📅 なし'}</span>
        <span class="prio prio-${t.priority || 'mid'}">${priorityLabel(t.priority)}</span>
        <span class="score">Score:${t.score}</span>
      </span>

      <button class="del" data-action="del" data-id="${t.id}" aria-label="削除">×</button>
    </li>
  `).join('');
}


function priorityLabel(p) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '中';
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
    return Array.isArray(data)
  ? data.map(t => ({
      id: t.id ?? crypto.randomUUID(),
      text: String(t.text ?? ''),
      done: Boolean(t.done),
      due: t.due ?? null,
      priority: t.priority ?? 'mid',
    }))
  : [];
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

function priorityLabel(p) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '中';
}


function priorityPoints(p) {
  if (p === 'high') return 60;
  if (p === 'low') return 10;
  return 30; // mid
}

function daysUntil(dueStr) {
  if (!dueStr) return null;
  // 日付だけで比較（時刻のズレを避ける）
  const [y, m, d] = dueStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = due.getTime() - t0.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function urgencyPoints(dueStr) {
  const d = daysUntil(dueStr);
  if (d === null) return 0;

  if (d < 0) return 50;
  if (d === 0) return 45;
  if (d <= 3) return 40;
  if (d <= 7) return 30;
  if (d <= 14) return 20;
  if (d <= 30) return 10;
  return 0;
}

function calcScore(todo) {
  return priorityPoints(todo.priority) + urgencyPoints(todo.due);
}

