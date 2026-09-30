# MapLead Workspace

Desktop app for working MapLead Hunter CSV exports: hide columns, update lead statuses, take notes, copy rows, and open outreach links.

## Run

```bash
cd lead-workspace
npm install
npm run dev
```

## Build Windows app

```bash
npm run build:dir   # unpacked .exe in release/win-unpacked/
npm run build       # NSIS installer in release/
```

Run without installing: `release/win-unpacked/MapLead Workspace.exe`
## Shortcuts

| Key | Action |
|---|---|
| `j` / `k` | Next / previous lead |
| `c` | Copy active row (TSV) |
| `n` | Focus notes |
| `1`–`7` | Set status |
| `Esc` | Close drawer |

Progress (status, notes, hidden columns, filters) auto-saves into:

1. **The CSV itself** — `Status` / `Notes` columns are updated in place so the next open shows who was contacted  
2. **`yourfile.csv.maplead.json`** beside it — UI prefs + deleted rows

Watch for **Sheet saved** in the top bar after you change a status.
