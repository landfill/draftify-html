/**
 * E2E fixture — 의존성 0의 Todo SPA (ID-12).
 *
 * - 라우트 2개: `/`(할 일 목록), `/stats`(통계) — history 라우팅 (SPA fallback 검증)
 * - 어노테이션 부착 대상 4개 이상: #new-todo, #add-todo, #todo-count, #filter-all, #filter-done …
 * - 상태에 따라 텍스트가 바뀌는 요소 1개: #todo-count ("할 일 N개 남음") — T5 재탐색 AC용
 */
import "./style.css";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let seq = 4;
const todos: Todo[] = [
  { id: 1, text: "주간 보고 작성", done: false },
  { id: 2, text: "목업 리뷰 요청", done: true },
  { id: 3, text: "배포 체크리스트 확인", done: false },
];
let filter: "all" | "done" = "all";

const app = document.getElementById("app")!;

function navigate(path: string): void {
  history.pushState(null, "", path);
  render();
}

function remaining(): number {
  return todos.filter((t) => !t.done).length;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function header(current: string): HTMLElement {
  const head = el("header");
  head.append(el("h1", {}, "Todo 목업"));
  const nav = el("nav");
  const home = el("a", { href: "/", id: "nav-home", class: current === "/" ? "active" : "" }, "할 일");
  const stats = el("a", { href: "/stats", id: "nav-stats", class: current === "/stats" ? "active" : "" }, "통계");
  for (const link of [home, stats]) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.getAttribute("href")!);
    });
  }
  nav.append(home, stats);
  head.append(nav);
  return head;
}

function todoView(): HTMLElement {
  const view = el("div");

  const row = el("div", { class: "row" });
  const input = el("input", { id: "new-todo", type: "text", placeholder: "할 일 입력", "aria-label": "할 일 입력" });
  const add = el("button", { id: "add-todo", type: "button" }, "추가");
  add.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    todos.push({ id: seq++, text, done: false });
    render();
  });
  row.append(input, add);
  view.append(row);

  // 상태에 따라 텍스트가 바뀌는 요소 (T5 재탐색 AC용)
  view.append(el("p", { id: "todo-count" }, `할 일 ${remaining()}개 남음`));

  const list = el("ul", { id: "todo-list" });
  for (const todo of todos) {
    const item = el("li", { class: todo.done ? "done" : "", "data-todo-id": String(todo.id) });
    const toggle = el("button", { type: "button", "aria-label": `완료 토글: ${todo.text}` }, todo.done ? "↩" : "✓");
    toggle.addEventListener("click", () => {
      todo.done = !todo.done;
      render();
    });
    const remove = el("button", { type: "button", "aria-label": `삭제: ${todo.text}` }, "삭제");
    remove.addEventListener("click", () => {
      todos.splice(todos.indexOf(todo), 1);
      render();
    });
    item.append(toggle, el("span", { class: "todo-text" }, todo.text), remove);
    list.append(item);
  }
  view.append(list);
  return view;
}

function statsView(): HTMLElement {
  const view = el("div");
  const card = el("div", { class: "stats-card" });
  const done = todos.filter((t) => t.done).length;
  const shown = filter === "all" ? todos.length : done;
  card.append(
    el("p", { id: "stats-line" }, `전체 ${todos.length}개 · 완료 ${done}개 · 표시 ${shown}개`),
  );
  const filters = el("div", { class: "filters" });
  const all = el("button", { id: "filter-all", type: "button", class: filter === "all" ? "active" : "" }, "전체 보기");
  const doneBtn = el("button", { id: "filter-done", type: "button", class: filter === "done" ? "active" : "" }, "완료만 보기");
  all.addEventListener("click", () => { filter = "all"; render(); });
  doneBtn.addEventListener("click", () => { filter = "done"; render(); });
  filters.append(all, doneBtn);
  card.append(filters);
  view.append(card);
  return view;
}

function render(): void {
  const path = location.pathname;
  app.textContent = "";
  const wrap = el("div", { class: "wrap" });
  wrap.append(header(path), path === "/stats" ? statsView() : todoView());
  app.append(wrap);
}

window.addEventListener("popstate", render);
render();
