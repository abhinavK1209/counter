# Fourlog

A fast, local-first tracker for working through four-digit code guesses.

## Run it

Open `index.html` in a browser, or serve the folder with any simple static server.

For example, if Python is installed:

```powershell
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## What it does

- Logs individual codes, mixed lists, and inclusive ranges such as `0000-0200`
- Includes one-click sets for repeated digits, sequences, likely years, and keypad patterns
- Shows all 10,000 codes in an interactive map: green is logged, blank is still to do
- Pulses hundreds of pattern-based suggestions in amber, including keypad walks, mirrors, double pairs, repeats, and sequences
- Adds every valid calendar date in both MM/DD and DD/MM order, plus years from 1900–2026
- Includes all valid MM/YY combinations from `01/00` through `12/99`
- Includes independently chosen DD/DD pairs (`01/01–31/31`) and MM/MM pairs (`01/01–12/12`)
- Lets you click any map square to add or remove that exact code
- Pads short entries to four digits (`7` becomes `0007`)
- Prevents duplicate guesses
- Saves progress in the browser automatically
- Supports search, sorting, single-code removal, undo, export, and full reset

No account, server, build step, or dependency install is required.
