"use strict";

const STORAGE_KEY = "fourlog-guesses-v2";
const LEGACY_STORAGE_KEY = "fourlog-guesses-v1";
const PAGE_SIZE = 96;
const TOTAL_CODES = 10000;

// Pattern catalogue lives in patterns.js (loaded first). Fall back to empty
// structures so the app still boots if that script is missing.
const { presets, suggestions: patternSuggestions, suggestionOrder } =
  window.FOURLOG_PATTERNS || { presets: {}, suggestions: new Map(), suggestionOrder: [] };

const state = {
  guesses: loadGuesses(),
  loggedSet: null, // cache of `guesses` as a Set, rebuilt on mutation
  visibleCount: PAGE_SIZE,
  lastBatch: [],
  toastTimer: null,
};

const elements = {
  form: document.querySelector("#guessForm"),
  input: document.querySelector("#guessInput"),
  message: document.querySelector("#formMessage"),
  count: document.querySelector("#loggedCount"),
  remaining: document.querySelector("#remainingCount"),
  percent: document.querySelector("#coveragePercent"),
  progress: document.querySelector("#progressFill"),
  grid: document.querySelector("#codeGrid"),
  empty: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"),
  loadMore: document.querySelector("#loadMoreButton"),
  toast: document.querySelector("#toast"),
  toastText: document.querySelector("#toastText"),
  undo: document.querySelector("#undoButton"),
  export: document.querySelector("#exportButton"),
  mergeDefault: document.querySelector("#mergeDefaultButton"),
  clear: document.querySelector("#clearButton"),
  clearDialog: document.querySelector("#clearDialog"),
  confirmClear: document.querySelector("#confirmClearButton"),
  map: document.querySelector("#numberMap"),
  suggestionMap: document.querySelector("#suggestionMap"),
  mapWrap: document.querySelector("#mapCanvasWrap"),
  mapDone: document.querySelector("#mapDoneCount"),
  mapTodo: document.querySelector("#mapTodoCount"),
  mapTooltip: document.querySelector("#mapTooltip"),
  mapTooltipCode: document.querySelector("#mapTooltipCode"),
  mapTooltipStatus: document.querySelector("#mapTooltipStatus"),
  suggestionList: document.querySelector("#suggestionList"),
  suggestionRemaining: document.querySelector("#suggestionRemaining"),
};

const presetButtons = [...document.querySelectorAll("[data-preset]")];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isValidCode(code) {
  return typeof code === "string" && /^\d{4}$/.test(code);
}

function makeRange(start, end) {
  const direction = start <= end ? 1 : -1;
  const size = Math.abs(end - start) + 1;
  return Array.from({ length: size }, (_, index) =>
    String(start + index * direction).padStart(4, "0"),
  );
}

function parseInput(value) {
  const tokens = value.trim().split(/[\s,;]+/).filter(Boolean);
  const codes = [];
  const errors = [];

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
    const codeMatch = token.match(/^\d{1,4}$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Math.abs(end - start) > TOTAL_CODES - 1) {
        errors.push(token);
      } else {
        codes.push(...makeRange(start, end));
      }
    } else if (codeMatch) {
      codes.push(token.padStart(4, "0"));
    } else {
      errors.push(token);
    }
  }

  return { codes, errors };
}

// ---------------------------------------------------------------------------
// Persistence + state mutation
// ---------------------------------------------------------------------------

function loadGuesses() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) return stored.filter(isValidCode);

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    const seeded = [...new Set([
      ...(window.FOURLOG_DEFAULT_GUESSES || []),
      ...(Array.isArray(legacy) ? legacy : []),
    ])].filter(isValidCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [...(window.FOURLOG_DEFAULT_GUESSES || [])].filter(isValidCode);
  }
}

function loggedSet() {
  if (!state.loggedSet) state.loggedSet = new Set(state.guesses);
  return state.loggedSet;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.guesses));
  } catch {
    showToast("Couldn’t save — browser storage is full or blocked", false);
  }
}

// Replace the guess list and refresh everything that depends on the data.
function commit({ lastBatch = [] } = {}) {
  state.loggedSet = null;
  state.lastBatch = lastBatch;
  state.visibleCount = PAGE_SIZE;
  save();
  renderAll();
}

// Add codes; returns the number actually added (after dedupe + validation).
function addCodes(codes, label = "guesses") {
  const existing = loggedSet();
  const unique = [...new Set(codes)].filter(
    (code) => isValidCode(code) && !existing.has(code),
  );

  if (!unique.length) {
    showToast(`Nothing new — ${label} already logged`, false);
    return 0;
  }

  state.guesses.push(...unique);
  commit({ lastBatch: unique });
  showToast(
    `${unique.length.toLocaleString()} ${unique.length === 1 ? "guess" : "guesses"} added`,
    true,
  );
  return unique.length;
}

function removeCode(code) {
  const index = state.guesses.indexOf(code);
  if (index === -1) return;
  state.guesses.splice(index, 1);
  commit();
  showToast(`${code} removed`, false);
}

// ---------------------------------------------------------------------------
// Number map (canvas)
// ---------------------------------------------------------------------------

function drawNumberMap() {
  const canvas = elements.map;
  const suggestionCanvas = elements.suggestionMap;
  if (!canvas || !suggestionCanvas) return;

  const size = canvas.clientWidth || 1000;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.round(size * ratio);

  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
    suggestionCanvas.width = pixels;
    suggestionCanvas.height = pixels;
  }

  const cell = pixels / 100;
  const gap = Math.max(0.65 * ratio, cell * 0.12);
  const inner = Math.max(1, cell - gap);
  const logged = loggedSet();

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, pixels, pixels);
  for (let number = 0; number < TOTAL_CODES; number += 1) {
    const code = String(number).padStart(4, "0");
    context.fillStyle = logged.has(code) ? "#28a466" : "#d9d4cb";
    context.fillRect(
      (number % 100) * cell + gap / 2,
      Math.floor(number / 100) * cell + gap / 2,
      inner,
      inner,
    );
  }

  const suggestionContext = suggestionCanvas.getContext("2d");
  suggestionContext.clearRect(0, 0, pixels, pixels);
  suggestionContext.fillStyle = "#f4c542";
  for (const code of patternSuggestions.keys()) {
    if (logged.has(code)) continue;
    const number = Number(code);
    suggestionContext.fillRect(
      (number % 100) * cell + gap / 2,
      Math.floor(number / 100) * cell + gap / 2,
      inner,
      inner,
    );
  }
}

function getMapCode(event) {
  const bounds = elements.map.getBoundingClientRect();
  const x = Math.max(0, Math.min(bounds.width - 1, event.clientX - bounds.left));
  const y = Math.max(0, Math.min(bounds.height - 1, event.clientY - bounds.top));
  const column = Math.floor((x / bounds.width) * 100);
  const row = Math.floor((y / bounds.height) * 100);
  return { code: String(row * 100 + column).padStart(4, "0"), x, y };
}

function showMapTooltip(event) {
  const { code, x, y } = getMapCode(event);
  const isDone = loggedSet().has(code);
  const suggestionType = patternSuggestions.get(code);
  elements.mapTooltipCode.textContent = code;
  elements.mapTooltipStatus.textContent = isDone ? "Logged" : suggestionType || "To do";
  elements.mapTooltipStatus.classList.toggle("is-done", isDone);
  elements.mapTooltipStatus.classList.toggle("is-suggested", !isDone && Boolean(suggestionType));
  elements.mapTooltip.hidden = false;

  const tooltipWidth = 112;
  const maxLeft = elements.mapWrap.clientWidth - tooltipWidth - 8;
  const left = Math.max(8, Math.min(x + 14, maxLeft));
  const top = Math.max(8, y - 58);
  elements.mapTooltip.style.transform = `translate(${left}px, ${top}px)`;
}

// ---------------------------------------------------------------------------
// Rendering — split so view-only changes (search / sort / paging) never pay
// for a full 10,000-cell canvas repaint or suggestion rebuild.
// ---------------------------------------------------------------------------

function renderStats() {
  const total = state.guesses.length;
  const remaining = TOTAL_CODES - total;
  const percentage = (total / TOTAL_CODES) * 100;
  elements.count.textContent = total.toLocaleString();
  elements.remaining.textContent = remaining.toLocaleString();
  elements.percent.textContent = `${percentage < 0.1 && total ? "<0.1" : percentage.toFixed(1)}%`;
  elements.progress.style.width = `${percentage}%`;
  elements.mapDone.textContent = total.toLocaleString();
  elements.mapTodo.textContent = remaining.toLocaleString();
}

function renderSuggestions() {
  const logged = loggedSet();
  const untried = suggestionOrder.filter((code) => !logged.has(code));
  elements.suggestionRemaining.textContent = untried.length.toLocaleString();

  const cards = untried.slice(0, 12).map((code) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-card";
    button.innerHTML = `<strong>${code}</strong><span>${patternSuggestions.get(code)}</span>`;
    button.setAttribute("aria-label", `Mark suggested code ${code} as tried`);
    button.addEventListener("click", () => addCodes([code], "suggestion"));
    return button;
  });

  elements.suggestionList.replaceChildren(...cards);
  if (!cards.length) {
    const complete = document.createElement("p");
    complete.className = "suggestions-complete";
    complete.textContent = "All pattern picks tried — nicely done.";
    elements.suggestionList.append(complete);
  }
}

function getFilteredGuesses() {
  const query = elements.search.value.replace(/\D/g, "");
  const items = [...state.guesses];

  switch (elements.sort.value) {
    case "asc": items.sort(); break;
    case "desc": items.sort().reverse(); break;
    case "recent": items.reverse(); break;
    default: break;
  }

  return query ? items.filter((code) => code.includes(query)) : items;
}

function renderList() {
  const total = state.guesses.length;
  const filtered = getFilteredGuesses();
  const visible = filtered.slice(0, state.visibleCount);

  elements.grid.replaceChildren(
    ...visible.map((code) => {
      const button = document.createElement("button");
      button.className = "code-chip";
      button.type = "button";
      button.textContent = code;
      button.title = `Remove ${code}`;
      button.setAttribute("aria-label", `Remove code ${code}`);
      button.addEventListener("click", () => removeCode(code));
      return button;
    }),
  );

  const noResults = total > 0 && filtered.length === 0;
  elements.grid.hidden = total === 0;
  elements.loadMore.hidden = visible.length >= filtered.length;
  elements.empty.hidden = total > 0 && !noResults;

  if (noResults) {
    elements.empty.querySelector("h3").textContent = "No matching code.";
    elements.empty.querySelector("p").textContent = "Try a different search.";
    elements.empty.querySelector("span").textContent = "—";
  } else {
    elements.empty.querySelector("h3").textContent = "No guesses logged yet.";
    elements.empty.querySelector("p").textContent =
      "Try a range above or add a quick set to get moving.";
    elements.empty.querySelector("span").textContent = "0000";
  }
}

function renderPresetButtons() {
  const logged = loggedSet();
  for (const button of presetButtons) {
    const set = presets[button.dataset.preset] || [];
    const done = set.length > 0 && set.every((code) => logged.has(code));
    button.disabled = done;
    const arrow = button.querySelector(".quick-arrow");
    if (arrow) arrow.textContent = done ? "✓" : "+";
  }
}

// Full refresh: call after any change to state.guesses.
function renderAll() {
  renderStats();
  drawNumberMap();
  renderSuggestions();
  renderPresetButtons();
  renderList();
}

function showToast(text, canUndo) {
  clearTimeout(state.toastTimer);
  elements.toastText.textContent = text;
  elements.undo.hidden = !canUndo;
  elements.toast.classList.add("show");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4500);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!elements.input.value.trim()) {
    elements.message.textContent = "Type a code or range first.";
    elements.input.focus();
    return;
  }

  const { codes, errors } = parseInput(elements.input.value);
  if (errors.length) {
    elements.message.textContent = `Couldn’t read: ${errors.slice(0, 3).join(", ")}`;
    return;
  }

  const added = addCodes(codes, "codes");
  elements.message.textContent = added ? "" : "Every code in that entry is already logged.";
  if (added) elements.input.value = "";
  elements.input.focus();
});

for (const button of presetButtons) {
  button.addEventListener("click", () => {
    const name = button.querySelector("strong")?.textContent.toLowerCase() || "set";
    addCodes(presets[button.dataset.preset] || [], name);
  });
}

elements.search.addEventListener("input", () => {
  elements.search.value = elements.search.value.replace(/\D/g, "");
  state.visibleCount = PAGE_SIZE;
  renderList();
});

elements.sort.addEventListener("change", () => {
  state.visibleCount = PAGE_SIZE;
  renderList();
});

elements.loadMore.addEventListener("click", () => {
  state.visibleCount += PAGE_SIZE;
  renderList();
});

elements.undo.addEventListener("click", () => {
  if (!state.lastBatch.length) return;
  const batch = new Set(state.lastBatch);
  const count = state.lastBatch.length;
  state.guesses = state.guesses.filter((code) => !batch.has(code));
  commit();
  showToast(`Undid ${count.toLocaleString()} ${count === 1 ? "guess" : "guesses"}`, false);
});

elements.export.addEventListener("click", () => {
  if (!state.guesses.length) {
    showToast("Nothing to export yet", false);
    return;
  }
  const blob = new Blob([[...state.guesses].sort().join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `fourlog-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Log exported as a text file", false);
});

elements.mergeDefault.addEventListener("click", () => {
  const defaults = window.FOURLOG_DEFAULT_GUESSES || [];
  if (!defaults.length) {
    showToast("Default progress is unavailable", false);
    return;
  }
  const added = addCodes(defaults, "default progress");
  if (added) {
    showToast(
      `Merged ${added.toLocaleString()} ${added === 1 ? "code" : "codes"} from default progress`,
      true,
    );
  }
});

elements.clear.addEventListener("click", () => elements.clearDialog.showModal());
elements.confirmClear.addEventListener("click", () => {
  state.guesses = [];
  commit();
  showToast("Your log is clear", false);
});

elements.map.addEventListener("pointermove", showMapTooltip);
elements.map.addEventListener("pointerleave", () => {
  elements.mapTooltip.hidden = true;
});
elements.map.addEventListener("click", (event) => {
  const { code } = getMapCode(event);
  if (loggedSet().has(code)) {
    removeCode(code);
  } else {
    addCodes([code], "code");
  }
  showMapTooltip(event);
});

let mapResizeFrame;
window.addEventListener("resize", () => {
  cancelAnimationFrame(mapResizeFrame);
  mapResizeFrame = requestAnimationFrame(drawNumberMap);
});

document.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  const inField = active === elements.input || active === elements.search;

  if (event.key === "/" && !inField && !elements.clearDialog.open) {
    event.preventDefault();
    elements.search.focus();
    return;
  }

  // Escape clears the search only while the search box itself is focused, so it
  // never wipes the field mid-edit elsewhere or fights the dialog's own Escape.
  if (event.key === "Escape" && active === elements.search && elements.search.value) {
    elements.search.value = "";
    state.visibleCount = PAGE_SIZE;
    renderList();
  }
});

renderAll();
