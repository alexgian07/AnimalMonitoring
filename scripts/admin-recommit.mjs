#!/usr/bin/env node
/* ADMIN re-commit — write a day's stored counts to its Google Sheet tab using the SERVICE ACCOUNT,
 * bypassing Clerk + the app's owner-only guard. For maintainer data-fixes: when counts are corrected
 * in Supabase for a session committed by ANOTHER researcher (or a half is owned by a different user),
 * the app won't let you commit it, so this pushes the corrected DB grid to the Sheet directly.
 *
 * LOCAL ADMIN ONLY. Reads secrets from .env.local. Can overwrite any tab, so never deploy/expose it.
 * Google Sheets keeps version history, so a bad write is recoverable there.
 *
 * Usage:  node scripts/admin-recommit.mjs <YYYY-MM-DD> <Π|Μ> <inside|free_range> [--write]
 *   (no --write = dry run: fetch + build rows + print a summary, but do NOT touch the Sheet)
 *
 * inside      → tab "<D-M> <Π|Μ>" in GSHEET_ID; the row for that half.
 * free_range  → tab "<D-M>" in GSHEET_ID_FREERANGE; assembles BOTH halves (ΠΡΩΙ + ΜΕΣΗΜΕΡΙ) from the
 *               DB, whoever owns them (the <Π|Μ> arg is ignored — the whole day tab is rewritten).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

function loadEnv(path) {
  let txt; try { txt = readFileSync(path, "utf8"); } catch { return; }
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("="); if (i < 0) continue;
    const key = line.slice(0, i).trim(); let val = line.slice(i + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(fileURLToPath(new URL("../.env.local", import.meta.url)));

// must match lib/ethogram/parser.ts + the existing tabs exactly
const BEHAVIOURS = [
  "Walking", "Standing", "Sitting", "Running", "Eating", "Drinking", "Grooming", "Preening",
  "Env. Pecking", "Agr.Pecking", "Feather Pecking", "Fighting", "Dust bathing", "Scratching",
  "Flapping", "Stretching", "Perching", "Strutting", "Tail fanning", "Wing dragging", "Gobbling",
  "Other vocalisation",
];
const FREE_BEHAVIOURS = [...BEHAVIOURS, "Foraging"]; // free-range adds a 23rd column
const CELLS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];

function insideRows(grid) {
  const rows = [["OBSERV.", "Cell", ...BEHAVIOURS]];
  for (let o = 0; o < 6; o++)
    for (let c = 0; c < 8; c++) {
      const counts = grid?.[o]?.[c] ?? [];
      const sum = counts.reduce((a, b) => a + (b || 0), 0);
      rows.push([o + 1, CELLS[c], ...counts.slice(0, 22).map((v) => (v ? v : "")), sum || ""]);
    }
  return rows;
}

function freeRangeDayRows(morning, lunch) {
  const rows = [["", "OBSERV.", ...FREE_BEHAVIOURS]];
  const block = (grid, label) => {
    for (let o = 0; o < 6; o++) {
      const counts = grid?.[o]?.[0] ?? FREE_BEHAVIOURS.map(() => 0);
      rows.push([o === 0 ? label : "", o + 1, ...counts.slice(0, 23).map((v) => (v ? v : ""))]);
    }
  };
  block(morning, "ΠΡΩΙ");
  rows.push([]);
  block(lunch, "ΜΕΣΗΜΕΡΙ");
  return rows;
}

const filled = (grid, cells) => {
  let n = 0;
  for (let o = 0; o < 6; o++) for (let c = 0; c < cells; c++)
    if ((grid?.[o]?.[c] ?? []).some((v) => v > 0)) n++;
  return n;
};

async function writeTab(sheets, spreadsheetId, tab, rows, guardCol) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  let sh = (meta.data.sheets ?? []).find((s) => s.properties?.title === tab);
  if (!sh) {
    const added = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    sh = { properties: { sheetId: added.data.replies?.[0]?.addSheet?.properties?.sheetId } };
  } else {
    const cur = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!${guardCol}1` })).data.values?.[0]?.[0];
    if (String(cur ?? "").trim().toUpperCase() !== "OBSERV.") throw new Error(`${guardCol}1 of "${tab}" is "${cur}", not "OBSERV." — refusing to overwrite`);
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!A1:Z100` });
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!A1`, valueInputOption: "RAW", requestBody: { values: rows } });
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ updateCells: {
      range: { sheetId: sh.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ note: `Admin data-fix re-commit · ${stamp}` }] }], fields: "note",
    } }] },
  });
}

async function main() {
  const [date, ampm, space, ...flags] = process.argv.slice(2);
  const write = flags.includes("--write");
  if (!date || !ampm || !space) { console.error("usage: admin-recommit <date> <Π|Μ> <inside|free_range> [--write]"); process.exit(1); }

  const [, m, d] = date.split("-");
  const dayName = `${+d}-${+m}`; // 2026-07-31 -> 31-7
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  if (space === "inside") {
    const tab = `${dayName} ${ampm}`;
    const { data: sess, error } = await supa.from("ethogram_sessions")
      .select("data, committed_by_name").eq("session_date", date).eq("time_of_day", ampm)
      .eq("space", "inside").eq("status", "committed").eq("sheet_tab", tab).maybeSingle();
    if (error) throw error;
    if (!sess) throw new Error(`no committed inside session for ${date} ${ampm} (tab "${tab}")`);
    const rows = insideRows(sess.data);
    console.log(`INSIDE tab "${tab}"  committed_by=${sess.committed_by_name ?? "?"}  cells_with_data=${filled(sess.data, 8)}/48`);
    if (!write) return console.log("DRY RUN — pass --write to push.");
    await writeTab(sheets, process.env.GSHEET_ID, tab, rows, "A");
    console.log(`✅ wrote "${tab}"`);
    return;
  }

  if (space === "free_range") {
    const tab = dayName;
    const { data: halves, error } = await supa.from("ethogram_sessions")
      .select("data, time_of_day, status, committed_by_name, updated_at")
      .eq("session_date", date).eq("space", "free_range").in("time_of_day", ["Π", "Μ"]);
    if (error) throw error;
    const pick = (tod) => (halves ?? []).filter((h) => h.time_of_day === tod)
      .sort((a, b) => (b.status === "committed") - (a.status === "committed") || (b.updated_at > a.updated_at ? 1 : -1))[0];
    const morn = pick("Π"), lun = pick("Μ");
    const rows = freeRangeDayRows(morn?.data ?? null, lun?.data ?? null);
    console.log(`FREE-RANGE tab "${tab}"`);
    console.log(`  ΠΡΩΙ    by=${morn?.committed_by_name ?? "?"} (${morn?.status ?? "—"})  obs_with_data=${filled(morn?.data, 1)}/6`);
    console.log(`  ΜΕΣΗΜΕΡΙ by=${lun?.committed_by_name ?? "?"} (${lun?.status ?? "—"})  obs_with_data=${filled(lun?.data, 1)}/6`);
    if (!write) return console.log("DRY RUN — pass --write to push.");
    if (!process.env.GSHEET_ID_FREERANGE) throw new Error("GSHEET_ID_FREERANGE not set");
    await writeTab(sheets, process.env.GSHEET_ID_FREERANGE, tab, rows, "B"); // free-range header: A1 blank, B1 = OBSERV.
    console.log(`✅ wrote "${tab}" (both halves)`);
    return;
  }

  throw new Error(`unknown space "${space}"`);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
