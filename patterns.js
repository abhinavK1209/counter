// Pattern + preset catalogue for Fourlog.
// Pure data: builds the one-click quick sets, the map of pattern/date
// suggestions (code -> human label), and the curated "try next" ordering.
// Exposes everything on window.FOURLOG_PATTERNS so app.js can consume it
// without a build step (works when index.html is opened directly via file://).
(() => {
  "use strict";

  const padTwo = (number) => String(number).padStart(2, "0");

  function makeRange(start, end) {
    const direction = start <= end ? 1 : -1;
    const size = Math.abs(end - start) + 1;
    return Array.from({ length: size }, (_, index) =>
      String(start + index * direction).padStart(4, "0"),
    );
  }

  const presets = {
    repeats: Array.from({ length: 10 }, (_, digit) => String(digit).repeat(4)),
    sequences: [
      "0123", "1234", "2345", "3456", "4567", "5678", "6789",
      "9876", "8765", "7654", "6543", "5432", "4321", "3210",
    ],
    years: makeRange(1950, 2026),
    keypad: ["1234", "4321", "2580", "0852", "1379", "9731", "1470", "0741", "1590", "0951", "2468", "8642"],
  };

  const suggestions = new Map();

  function tag(codes, label) {
    for (const code of codes) suggestions.set(code, label);
  }

  tag(
    ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999"],
    "Repeated digit",
  );
  tag(
    ["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210"],
    "Straight sequence",
  );
  tag(
    ["2580", "0852", "1470", "0741", "3690", "0963", "1379", "9731", "1397", "7931", "1590", "0951", "3570", "0753", "2468", "8642"],
    "Keypad shape",
  );
  tag(
    ["1212", "2121", "1313", "3131", "2323", "3232", "4545", "5454", "5656", "6565", "6767", "7676"],
    "Alternating pair",
  );
  tag(
    ["1001", "2002", "3003", "4004", "5005", "6006", "7007", "8008", "9009", "1221", "1331", "1441", "1551", "1661", "1771", "1881", "1991"],
    "Mirror pattern",
  );
  tag(
    ["1236", "3214", "1478", "7412", "3698", "9632", "7894", "9876", "4569", "6541", "1593", "3571", "1793", "3971", "7531", "9513"],
    "Keypad walk",
  );
  tag(
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
  tag(alternatingPairs, "Alternating pair");
  tag(mirroredPairs, "Mirror pattern");
  tag(doublePairs, "Double pair");
  tag(
    ["0001", "1000", "1112", "2111", "2223", "3222", "3334", "4333", "4445", "5444", "5556", "6555", "6667", "7666", "7778", "8777", "8889", "9888"],
    "Near repeat",
  );

  const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= monthLengths[month - 1]; day += 1) {
      const monthDay = `${padTwo(month)}${padTwo(day)}`;
      const dayMonth = `${padTwo(day)}${padTwo(month)}`;
      suggestions.set(monthDay, "MM/DD date");
      suggestions.set(
        dayMonth,
        dayMonth === monthDay ? "Date (either format)" : "DD/MM date",
      );
    }
  }
  for (let year = 1900; year <= 2026; year += 1) {
    suggestions.set(String(year), "Four-digit year");
  }
  for (let month = 1; month <= 12; month += 1) {
    for (let year = 0; year <= 99; year += 1) {
      const code = `${padTwo(month)}${padTwo(year)}`;
      const existingLabel = suggestions.get(code);
      suggestions.set(
        code,
        existingLabel?.toLowerCase().includes("date") ? "MM/YY or date" : "MM/YY",
      );
    }
  }
  for (let firstDay = 1; firstDay <= 31; firstDay += 1) {
    for (let secondDay = 1; secondDay <= 31; secondDay += 1) {
      suggestions.set(`${padTwo(firstDay)}${padTwo(secondDay)}`, "DD/DD pair");
    }
  }
  for (let firstMonth = 1; firstMonth <= 12; firstMonth += 1) {
    for (let secondMonth = 1; secondMonth <= 12; secondMonth += 1) {
      suggestions.set(`${padTwo(firstMonth)}${padTwo(secondMonth)}`, "MM/MM · DD/DD");
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
  tag(tripleDigits, "Triple digit");
  tag(allDoublePairs, "Double pair");

  const skipSequences = [];
  for (const step of [2, 3]) {
    for (let start = 0; start + step * 3 <= 9; start += 1) {
      const sequence = Array.from({ length: 4 }, (_, index) => start + index * step).join("");
      skipSequences.push(sequence, [...sequence].reverse().join(""));
    }
  }
  tag(skipSequences, "Skip-count sequence");

  const consecutiveNumberPairs = [];
  for (let number = 0; number < 99; number += 1) {
    consecutiveNumberPairs.push(
      `${padTwo(number)}${padTwo(number + 1)}`,
      `${padTwo(number + 1)}${padTwo(number)}`,
    );
  }
  tag(consecutiveNumberPairs, "Consecutive number pair");

  const roundEndings = Array.from(
    { length: 100 },
    (_, number) => `${padTwo(number)}00`,
  );
  tag(roundEndings, "Round-number ending");

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
  tag(keypadWalks, "Keypad walk");

  // Curated codes surface first in the "try next" strip; the rest follow in
  // insertion order. The Set dedupes the curated head against the full keys.
  const suggestionOrder = [...new Set([
    "0000", "0131", "3101", "0112", "1201", "3131",
    "0626", "1234", "2580", "1212", "2424", "1225",
    "1001", "0126", "0704",
    "1122", "1226",
    "0214", "1112", "1231",
    "7890", "1379", "2002", "2323", "3690", "1031",
    "1111", "4321", "0852", "2121", "1221", "1236",
    "2222", "0123", "1478", "1313", "2112", "8901",
    "7771", "9000", "3344", "6699", "0246", "8642",
    "0369", "9630", "3435", "6564", "1254", "2365",
    "2541", "6987", "4200", "9900",
    ...suggestions.keys(),
  ])];

  window.FOURLOG_PATTERNS = { presets, suggestions, suggestionOrder };
})();
