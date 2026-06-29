const STORAGE_KEY = "fourlog-guesses-v2";
const LEGACY_STORAGE_KEY = "fourlog-guesses-v1";
const PAGE_SIZE = 96;
const VISIBLE_PATTERN_PICKS = 24;

const state = {
  guesses: loadGuesses(),
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

const presets = {
  repeats: Array.from({ length: 10 }, (_, digit) => String(digit).repeat(4)),
  sequences: [
    "0123", "1234", "2345", "3456", "4567", "5678", "6789",
    "9876", "8765", "7654", "6543", "5432", "4321", "3210",
  ],
  years: makeRange(1950, 2026),
  keypad: ["1234", "4321", "2580", "0852", "1379", "9731", "1470", "0741", "1590", "0951", "2468", "8642"],
};

const patternSuggestions = new Map();

function suggest(codes, label) {
  for (const code of codes) patternSuggestions.set(code, label);
}

suggest(
  ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"],
  "Repeated digit",
);
suggest(
  ["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210"],
  "Straight sequence",
);
suggest(
  ["2580", "0852", "1470", "0741", "3690", "0963", "1379", "9731", "1397", "7931", "1590", "0951", "3570", "0753", "2468", "8642"],
  "Keypad shape",
);
suggest(
  ["1212", "2121", "1313", "3131", "2323", "3232", "4545", "5454", "5656", "6565", "6767", "7676"],
  "Alternating pair",
);
suggest(
  ["1001", "2002", "3003", "4004", "5005", "6006", "7007", "8008", "9009", "1221", "1331", "1441", "1551", "1661", "1771", "1881", "1991"],
  "Mirror pattern",
);
suggest(
  ["1236", "3214", "1478", "7412", "3698", "9632", "7894", "9876", "4569", "6541", "1593", "3571", "1793", "3971", "7531", "9513"],
  "Keypad walk",
);
suggest(
  ["7890", "8901", "9012", "2109", "1098", "0987"],
  "Wraparound sequence",
);

const digits = Array.from({ length: 10 }, (_, number) => String(number));
const alternatingPairs = [];
const mirroredPairs = [];
const doublePairs = [];
for (const first of digits) {
  for (const second of digits) {
    if (first === second) continue;
    alternatingPairs.push(`${first}${second}${first}${second}`);
    mirroredPairs.push(`${first}${second}${second}${first}`);
  }
}
for (let digit = 0; digit < 9; digit += 1) {
  const next = digit + 1;
  doublePairs.push(`${digit}${digit}${next}${next}`, `${next}${next}${digit}${digit}`);
}
suggest(alternatingPairs, "Alternating pair");
suggest(mirroredPairs, "Mirror pattern");
suggest(doublePairs, "Double pair");
suggest(
  ["0001", "1000", "1112", "2111", "2223", "3222", "3334", "4333", "4445", "5444", "5556", "6555", "6667", "7666", "7778", "8777", "8889", "9888"],
  "Near repeat",
);

const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const padTwo = (number) => String(number).padStart(2, "0");
for (let month = 1; month <= 12; month += 1) {
  for (let day = 1; day <= monthLengths[month - 1]; day += 1) {
    const monthDay = `${padTwo(month)}${padTwo(day)}`;
    const dayMonth = `${padTwo(day)}${padTwo(month)}`;
    patternSuggestions.set(monthDay, "MM/DD date");
    patternSuggestions.set(
      dayMonth,
      dayMonth === monthDay ? "Date (either format)" : "DD/MM date",
    );
  }
}
for (let year = 1900; year <= 2026; year += 1) {
  patternSuggestions.set(String(year), "Four-digit year");
}
for (let month = 1; month <= 12; month += 1) {
  for (let year = 0; year <= 99; year += 1) {
    const code = `${padTwo(month)}${padTwo(year)}`;
    const existingLabel = patternSuggestions.get(code);
    patternSuggestions.set(
      code,
      existingLabel?.toLowerCase().includes("date") ? "MM/YY or date" : "MM/YY",
    );
  }
}
for (let firstDay = 1; firstDay <= 31; firstDay += 1) {
  for (let secondDay = 1; secondDay <= 31; secondDay += 1) {
    patternSuggestions.set(
      `${padTwo(firstDay)}${padTwo(secondDay)}`,
      "DD/DD pair",
    );
  }
}
for (let firstMonth = 1; firstMonth <= 12; firstMonth += 1) {
  for (let secondMonth = 1; secondMonth <= 12; secondMonth += 1) {
    patternSuggestions.set(
      `${padTwo(firstMonth)}${padTwo(secondMonth)}`,
      "MM/MM · DD/DD",
    );
  }
}

const tripleDigits = [];
const allDoublePairs = [];
for (const repeated of digits) {
  for (const other of digits) {
    if (repeated === other) continue;
    for (let position = 0; position < 4; position += 1) {
      const code = Array(4).fill(repeated);
      code[position] = other;
      tripleDigits.push(code.join(""));
    }
    allDoublePairs.push(`${repeated}${repeated}${other}${other}`);
  }
}
suggest(tripleDigits, "Triple digit");
suggest(allDoublePairs, "Double pair");

const skipSequences = [];
for (const step of [2, 3]) {
  for (let start = 0; start + step * 3 <= 9; start += 1) {
    const sequence = Array.from({ length: 4 }, (_, index) => start + index * step).join("");
    skipSequences.push(sequence, [...sequence].reverse().join(""));
  }
}
suggest(skipSequences, "Skip-count sequence");

const consecutiveNumberPairs = [];
for (let number = 0; number < 99; number += 1) {
  consecutiveNumberPairs.push(
    `${padTwo(number)}${padTwo(number + 1)}`,
    `${padTwo(number + 1)}${padTwo(number)}`,
  );
}
suggest(consecutiveNumberPairs, "Consecutive number pair");

const roundEndings = Array.from(
  { length: 100 },
  (_, number) => `${padTwo(number)}00`,
);
suggest(roundEndings, "Round-number ending");

const keypadPositions = new Map([
  ["1", [0, 0]], ["2", [1, 0]], ["3", [2, 0]],
  ["4", [0, 1]], ["5", [1, 1]], ["6", [2, 1]],
  ["7", [0, 2]], ["8", [1, 2]], ["9", [2, 2]],
  ["0", [1, 3]],
]);
const keypadNeighbors = new Map(
  [...keypadPositions].map(([digit, [x, y]]) => [
    digit,
    [...keypadPositions]
      .filter(([, [nextX, nextY]]) => Math.abs(nextX - x) + Math.abs(nextY - y) === 1)
      .map(([neighbor]) => neighbor),
  ]),
);
const keypadWalks = [];
function collectKeypadWalks(path) {
  if (path.length === 4) {
    keypadWalks.push(path.join(""));
    return;
  }
  for (const next of keypadNeighbors.get(path.at(-1))) {
    if (!path.includes(next)) collectKeypadWalks([...path, next]);
  }
}
for (const digit of keypadPositions.keys()) collectKeypadWalks([digit]);
suggest(keypadWalks, "Keypad walk");

const suggestionOrder = [...new Set([
  "7771", "9000", "3344", "6699", "0246", "8642",
  "0369", "9630", "3435", "6564", "1254", "2365",
  "2541", "6987", "4200", "9900",
  "0000", "0131", "3101", "0112", "1201", "3131",
  "0626", "1234", "2580", "1212", "2424", "1225",
  "1001", "0126", "0704",
  "1122", "1226",
  "0214", "1112", "1231",
  "7890", "1379", "2002", "2323", "3690", "1031",
  "1111", "4321", "0852", "2121", "1221", "1236",
  "2222", "0123", "1478", "1313", "2112", "8901",
  ...patternSuggestions.keys(),
])];

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

function isValidCode(code) {
  return typeof code === "string" && /^\d{4}$/.test(code);
}

function makeRange(start, end) {
  const direction = start <= end ? 1 : -1;
  const size = Math.abs(end - start) + 1;
  return Array.from({ length: size }, (_, index) => String(start + index * direction).padStart(4, "0"));
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
      if (Math.abs(end - start) > 9999) {
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

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.guesses));
}

function addCodes(codes, label = "guesses") {
  const existing = new Set(state.guesses);
  const unique = [...new Set(codes)].filter((code) => isValidCode(code) && !existing.has(code));

  if (!unique.length) {
    showToast(`Nothing new — ${label} already logged`, false);
    return 0;
  }

  state.guesses.push(...unique);
  state.lastBatch = unique;
  state.visibleCount = PAGE_SIZE;
  save();
  render();
  showToast(`${unique.length.toLocaleString()} ${unique.length === 1 ? "guess" : "guesses"} added`, true);
  return unique.length;
}

function removeCode(code) {
  const index = state.guesses.indexOf(code);
  if (index === -1) return;
  state.guesses.splice(index, 1);
  state.lastBatch = [];
  save();
  render();
  showToast(`${code} removed`, false);
}

function drawNumberMap() {
  const canvas = elements.map;
  const suggestionCanvas = elements.suggestionMap;
  const size = canvas.clientWidth || 1000;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.round(size * ratio);

  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
    suggestionCanvas.width = pixels;
    suggestionCanvas.height = pixels;
  }

  const context = canvas.getContext("2d");
  const cell = pixels / 100;
  const gap = Math.max(0.65 * ratio, cell * 0.12);
  const logged = new Set(state.guesses);

  context.clearRect(0, 0, pixels, pixels);
  context.fillStyle = "#d9d4cb";

  for (let number = 0; number < 10000; number += 1) {
    const row = Math.floor(number / 100);
    const column = number % 100;
    const code = String(number).padStart(4, "0");
    context.fillStyle = logged.has(code) ? "#28a466" : "#d9d4cb";
    context.fillRect(
      column * cell + gap / 2,
      row * cell + gap / 2,
      Math.max(1, cell - gap),
      Math.max(1, cell - gap),
    );
  }

  const suggestionContext = suggestionCanvas.getContext("2d");
  suggestionContext.clearRect(0, 0, pixels, pixels);
  suggestionContext.fillStyle = "#f4c542";
  for (const code of patternSuggestions.keys()) {
    if (logged.has(code)) continue;
    const number = Number(code);
    const row = Math.floor(number / 100);
    const column = number % 100;
    suggestionContext.fillRect(
      column * cell + gap / 2,
      row * cell + gap / 2,
      Math.max(1, cell - gap),
      Math.max(1, cell - gap),
    );
  }
}

function getMapCode(event) {
  const bounds = elements.map.getBoundingClientRect();
  const x = Math.max(0, Math.min(bounds.width - 1, event.clientX - bounds.left));
  const y = Math.max(0, Math.min(bounds.height - 1, event.clientY - bounds.top));
  const column = Math.floor((x / bounds.width) * 100);
  const row = Math.floor((y / bounds.height) * 100);
  return {
    code: String(row * 100 + column).padStart(4, "0"),
    x,
    y,
  };
}

function showMapTooltip(event) {
  const { code, x, y } = getMapCode(event);
  const isDone = state.guesses.includes(code);
  const suggestionType = patternSuggestions.get(code);
  elements.mapTooltipCode.textContent = code;
  elements.mapTooltipStatus.textContent = isDone ? "Logged" : suggestionType || "To do";
  elements.mapTooltipStatus.classList.toggle("is-done", isDone);
  elements.mapTooltipStatus.classList.toggle("is-suggested", !isDone && Boolean(suggestionType));
  elements.mapTooltip.hidden = false;

  const tooltipWidth = 112;
  const left = Math.min(x + 14, elements.mapWrap.clientWidth - tooltipWidth - 8);
  const top = Math.max(8, y - 58);
  elements.mapTooltip.style.transform = `translate(${left}px, ${top}px)`;
}

function renderSuggestions() {
  const logged = new Set(state.guesses);
  const untried = suggestionOrder.filter((code) => !logged.has(code));
  const next = untried
    .slice(0, VISIBLE_PATTERN_PICKS)
    .map((code) => [code, patternSuggestions.get(code)]);
  elements.suggestionRemaining.textContent = untried.length.toLocaleString();

  elements.suggestionList.replaceChildren(
    ...next.map(([code, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-card";
      button.innerHTML = `<strong>${code}</strong><span>${label}</span>`;
      button.setAttribute("aria-label", `Mark suggested code ${code} as tried`);
      button.addEventListener("click", () => addCodes([code], "suggestion"));
      return button;
    }),
  );

  if (!next.length) {
    const complete = document.createElement("p");
    complete.className = "suggestions-complete";
    complete.textContent = "All pattern picks tried — nicely done.";
    elements.suggestionList.append(complete);
  }
}

function getFilteredGuesses() {
  const query = elements.search.value.replace(/\D/g, "");
  const items = [...state.guesses];

  if (elements.sort.value === "asc") items.sort();
  if (elements.sort.value === "desc") items.sort().reverse();
  if (elements.sort.value === "recent") items.reverse();

  return query ? items.filter((code) => code.includes(query)) : items;
}

function render() {
  const total = state.guesses.length;
  const percentage = (total / 10000) * 100;
  elements.count.textContent = total.toLocaleString();
  elements.remaining.textContent = (10000 - total).toLocaleString();
  elements.percent.textContent = `${percentage < 0.1 && total ? "<0.1" : percentage.toFixed(1)}%`;
  elements.progress.style.width = `${percentage}%`;
  elements.mapDone.textContent = total.toLocaleString();
  elements.mapTodo.textContent = (10000 - total).toLocaleString();
  drawNumberMap();
  renderSuggestions();

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
  elements.empty.hidden = total > 0;
  elements.grid.hidden = total === 0;
  elements.loadMore.hidden = visible.length >= filtered.length;

  if (noResults) {
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "No matching code.";
    elements.empty.querySelector("p").textContent = "Try a different search.";
    elements.empty.querySelector("span").textContent = "—";
  } else {
    elements.empty.querySelector("h3").textContent = "No guesses logged yet.";
    elements.empty.querySelector("p").textContent = "Try a range above or add a quick set to get moving.";
    elements.empty.querySelector("span").textContent = "0000";
  }

  document.querySelectorAll("[data-preset]").forEach((button) => {
    const set = presets[button.dataset.preset];
    button.disabled = set.every((code) => state.guesses.includes(code));
    button.querySelector(".quick-arrow").textContent = button.disabled ? "✓" : "+";
  });
}

function showToast(text, canUndo) {
  clearTimeout(state.toastTimer);
  elements.toastText.textContent = text;
  elements.undo.hidden = !canUndo;
  elements.toast.classList.add("show");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4500);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const { codes, errors } = parseInput(elements.input.value);

  if (!elements.input.value.trim()) {
    elements.message.textContent = "Type a code or range first.";
    elements.input.focus();
    return;
  }
  if (errors.length) {
    elements.message.textContent = `Couldn’t read: ${errors.slice(0, 3).join(", ")}`;
    return;
  }

  const added = addCodes(codes, "codes");
  elements.message.textContent = added ? "" : "Every code in that entry is already logged.";
  if (added) elements.input.value = "";
  elements.input.focus();
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.querySelector("strong").textContent.toLowerCase();
    addCodes(presets[button.dataset.preset], name);
  });
});

elements.search.addEventListener("input", () => {
  elements.search.value = elements.search.value.replace(/\D/g, "");
  state.visibleCount = PAGE_SIZE;
  render();
});

elements.sort.addEventListener("change", () => {
  state.visibleCount = PAGE_SIZE;
  render();
});

elements.loadMore.addEventListener("click", () => {
  state.visibleCount += PAGE_SIZE;
  render();
});

elements.undo.addEventListener("click", () => {
  if (!state.lastBatch.length) return;
  const batch = new Set(state.lastBatch);
  const count = state.lastBatch.length;
  state.guesses = state.guesses.filter((code) => !batch.has(code));
  state.lastBatch = [];
  save();
  render();
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
  addCodes(defaults, "default progress");
});

elements.clear.addEventListener("click", () => elements.clearDialog.showModal());
elements.confirmClear.addEventListener("click", () => {
  state.guesses = [];
  state.lastBatch = [];
  save();
  render();
  showToast("Your log is clear", false);
});

elements.map.addEventListener("pointermove", showMapTooltip);
elements.map.addEventListener("pointerleave", () => {
  elements.mapTooltip.hidden = true;
});
elements.map.addEventListener("click", (event) => {
  const { code } = getMapCode(event);
  if (state.guesses.includes(code)) {
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
  if (event.key === "/" && document.activeElement !== elements.input && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === "Escape") {
    elements.search.value = "";
    render();
  }
});

render();
