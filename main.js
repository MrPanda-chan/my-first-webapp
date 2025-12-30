/* =========================
 * TODO v4 (DB Sync via Supabase)
 * - Quick: list_id方式（認証なし）
 * - Future: Auth + RLS でSaaS化へ移行可能
 * ========================= */

const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const dueInput = document.getElementById('todo-due');
const priorityInput = document.getElementById('todo-priority');

/* ===== Supabase Config（ここだけ埋める） ===== */
const SUPABASE_URL = 'https://dogqjaalrcusqexgxwxs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rTBBna8DON_D4vpfpHGx1w_pXJLKoqG';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===== list_id（認証なしの境界） ===== */
const LIST_ID_KEY = 'todo_list_id_v4';
const listId = getOrCreateListId();

/* ===== Local cache ===== */
const LOCAL_TODOS_KEY = 'todos_v4_cache';
let todos = loadLocal();

/* date: 空なら yyyy/mm/dd を“見えない”状態にする */
function syncDueHasValue() {
  if (dueInput.value) dueInput.classList.add('has-value');
  else dueInput.classList.remove('has-value');
}
dueInput.addEventListener('change', syncDueHasValue);
syncDueHasValue();

/* 起動：キャッシュ即表示 → DBで上書き */
bootstrap();

async function bootstrap() {
  render(); // 体感速度
  const remote = await dbSelectTodos();
  if (remote) {
    todos = remote;
    persistLocal();
    render();
  }
}

/* ===== Submit: INSERT(=UPSERT) ===== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const todo = {
    id: crypto.randomUUID(),
    list_id: listId,
    text,
    due: dueInput.value || null,
    priority: normalizePriority(priorityInput.value),
    done: false,
  };

  // 即反映
  todos.push(todo);
  clearComposer();
  persistLocal();
  render();

  // DB保存
  const ok = await dbUpsert(todo);
  if (!ok) console.warn('[DB] upsert failed (kept local cache)');
});

function clearComposer() {
  input.value = '';
  dueInput.value = '';
  priorityInput.value = 'mid';
  syncDueHasValue();
}

/* ===== Delete: DELETE ===== */
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="del"]');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  // 即反映
  todos = todos.filter(x => x.id !== id);
  persistLocal();
  render();

  await dbDelete(id);
});

/* ===== Toggle: UPDATE(=UPSERT) ===== */
list.addEventListener('change', async (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.dataset.action !== 'toggle') return;

  const id = el.dataset.id;
  if (!id) return;

  const t = todos.find(x => x.id === id);
  if (!t) return;

  // 即反映
  t.done = !t.done;
  persistLocal();
  render();

  await dbUpsert(t);
});

/* =========================
 * DB functions
 * ========================= */
async function dbSelectTodos() {
  try {
    const { data, error } = await sb
      .from('todos')
      .select('id, list_id, text, due, priority, done, created_at')
      .eq('list_id', listId);

    if (error) {
      console.warn('[DB] select error:', error.message);
      return null;
    }
    return Array.isArray(data) ? data.map(normalizeTodo) : [];
  } catch (err) {
    console.warn('[DB] select exception:', err);
    return null;
  }
}

async function dbUpsert(todo) {
  try {
    const payload = {
      id: todo.id,
      list_id: listId,
      text: String(todo.text ?? ''),
      due: todo.due || null,
      priority: normalizePriority(todo.priority),
      done: Boolean(todo.done),
    };

    const { error } = await sb
      .from('todos')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[DB] upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[DB] upsert exception:', err);
    return false;
  }
}

async function dbDelete(id) {
  try {
    const { error } = await sb
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('list_id', listId);

    if (error) console.warn('[DB] delete error:', error.message);
  } catch (err) {
    console.warn('[DB] delete exception:', err);
  }
}

/* =========================
 * Render
 * ========================= */
function render() {
  if (!todos.length) {
    list.innerHTML = '<li class="empty">まだ何もありません</li>';
    return;
  }

  const ranked = todos
    .map(t => ({ ...t, score: calcScore(t) }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1; // doneは下
      return b.score - a.score; // score降順
    });

  list.innerHTML = ranked.map((t) => `
    <li class="item ${t.done ? 'done' : ''}">
      <label class="left">
        <input type="checkbox" ${t.done ? 'checked' : ''} data-action="toggle" data-id="${t.id}">
        <span class="text">${escapeHtml(t.text)}</span>
      </label>

      <span class="meta">
        <span class="badge">
          <span aria-hidden="true">📅</span>
          <span>${t.due ? t.due : 'なし'}</span>
        </span>

        <span class="badge badge--prio">${priorityLabel(t.priority)}</span>
        <span class="badge badge--score">Score ${t.score}</span>
      </span>

      <button class="del" data-action="del" data-id="${t.id}" aria-label="削除">×</button>
    </li>
  `).join('');
}

/* =========================
 * Local cache
 * ========================= */
function persistLocal() {
  localStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(todos));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_TODOS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(normalizeTodo) : [];
  } catch {
    return [];
  }
}

/* =========================
 * Helpers
 * ========================= */
function getOrCreateListId() {
  const v = localStorage.getItem(LIST_ID_KEY);
  if (v) return v;
  const id = crypto.randomUUID();
  localStorage.setItem(LIST_ID_KEY, id);
  return id;
}

function normalizeTodo(t) {
  return {
    id: t.id ?? crypto.randomUUID(),
    list_id: t.list_id ?? listId,
    text: String(t.text ?? ''),
    due: t.due ?? null,
    priority: normalizePriority(t.priority),
    done: Boolean(t.done),
  };
}

function normalizePriority(p) {
  if (p === 'high' || p === 'mid' || p === 'low') return p;
  return 'mid';
}

function escapeHtml(str) {
  return String(str)
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

/* ===== scoring ===== */
function priorityPoints(p) {
  if (p === 'high') return 60;
  if (p === 'low') return 10;
  return 30;
}

function daysUntil(dueStr) {
  if (!dueStr) return null;

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
