// ===== DOM参照 =====
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const dueInput = document.getElementById('todo-due');
const priorityInput = document.getElementById('todo-priority');

// ===== 状態 =====
let todos = load();
render();

// ===== 追加 =====
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const due = dueInput.value || null;          // 未入力は null
  const priority = priorityInput.value || 'mid'; // "high" | "mid" | "low"

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

// ===== 完了トグル =====
function toggle(id) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  persist();
  render();
}

// ===== 削除 =====
function removeTodo(id) {
  todos = todos.filter(x => x.id !== id);
  persist();
  render();
}

// ===== 描画 =====
function render() {
  if (!todos.length) {
    list.innerHTML = '<li class="empty">まだ何もありません</li>';
    return;
  }

  // スコア付け → doneは下へ → score降順
  const ranked = todos
    .map(t => ({ ...t, score: calcScore(t) }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.score - a.score;
    });

  // rank番号は表示しない（並び順だけ反映）
  list.innerHTML = ranked.map((t) => `
    <li class="item ${t.done ? 'done' : ''}">
      <label class="left">
        <input type="checkbox"
          ${t.done ? 'checked' : ''}
          data-action="toggle"
          data-id="${t.id}">
        <span class="text">${escapeHtml(t.text)}</span>
      </label>

      <span class="meta">
        <span class="due">${t.due ? `📅 ${t.due}` : '📅 なし'}</span>
        <span class="prio prio-${t.priority || 'mid'}">${priorityLabel(t.priority)}</span>
        <span class="score" aria-label="スコア">Score ${t.score}</span>
      </span>

      <button class="del" data-action="del" data-id="${t.id}" aria-label="削除">×</button>
    </li>
  `).join('');
}

// ===== 重要度ラベル =====
function priorityLabel(p) {
  if (p === 'high') return '高';
  if (p === 'low') return '低';
  return '中';
}

// ===== イベント委譲 =====
// 削除：click（ボタンだけ拾う）
list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="del"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (id) removeTodo(id);
});

// 完了：change（checkboxだけ拾う）
// ※ click側でtoggleしない → 二重実行を完全に防ぐ
list.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.dataset.action !== 'toggle') return;
  const id = el.dataset.id;
  if (id) toggle(id);
});

// ===== 永続化 =====
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
          priority: (t.priority === 'high' || t.priority === 'mid' || t.priority === 'low') ? t.priority : 'mid',
        }))
      : [];
  } catch {
    return [];
  }
}

// ===== XSS対策 =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ===== スコア計算 =====
function priorityPoints(p) {
  if (p === 'high') return 60;
  if (p === 'low') return 10;
  return 30; // mid
}

function daysUntil(dueStr) {
  if (!dueStr) return null;

  // 日付だけで比較（時刻ズレ防止）
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
