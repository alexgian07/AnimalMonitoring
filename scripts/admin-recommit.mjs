#!/usr/bin/env node
/* ADMIN re-commit — write a session's stored counts to its Google Sheet tab using the SERVICE
 * ACCOUNT, bypassing Clerk + the app's owner-only guard. This exists for maintainer data-fixes:
 * when counts are corrected in Supabase for a session committed by ANOTHER researcher, the app
 * won't let you re-commit it, so this pushes the corrected DB grid to the Sheet directly.
 *
 * LOCAL ADMIN ONLY. Reads secrets from .env.local. It can overwrite any tab, so never deploy/expose
 * it. Google Sheets keeps version history, so a bad write is recoverable there.
 *
 * Usage:  node scripts/admin-recommit.mjs <YYYY-MM-DD> <Π|Μ> <inside|free_range> [--write]
 *   (no --write = dry run: fetch + build rows + print a summary, but do NOT touch the Sheet)
 *
 * Currently supports `inside`. free_range (day tab with both halves) is a TODO when we wrap this
 * into the MCP server.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

// --- load .env.local (this is a standalone script; Next's env loader doesn't run) ---
function loadEnv(path) {
  let txt;
  try { txt = readFileSync(path, "utf8"); } catch { return; }
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(fileURLToPath(new URL("../.env.local", import.meta.url)));

// --- inside layout (must match lib/ethogram/parser.ts + the existing tabs exactly) ---
const BEHAVIOURS = [
  "Walking", "Standing", "Sitting", "Running", "Eating", "Drinking", "Grooming", "Preening",
  "Env. Pecking", "Agr.Pecking", "Feather Pecking", "Fighting", "Dust bathing", "Scratching",
  "Flapping", "Stretching", "Perching", "Strutting", "Tail fanning", "Wing dragging", "Gobbling",
  "Other vocalisation",
];
const CELLS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];

function insideRows(grid) {
  const rows = [["OBSERV.", "Cell", ...BEHAVIOURS]];
  for (let o = 0; o < 6; o++)
    for (let c = 0; c < 8; c++) {
      const counts = grid[o][c] ?? [];
      const sum = counts.reduce((a, b) => a + (b || 0), 0);
      rows.push([o + 1, CELLS[c], ...counts.slice(0, 22).map((v) => (v ? v : "")), sum || ""]);
    }
  return rows;
}

async function main() {
  const [date, ampm, space, ...flags] = process.argv.slice(2);
  const write = flags.includes("--write");
  if (!date || !ampm || !space) { console.error("usage: admin-recommit <date> <Π|Μ> <inside|free_range> [--write]"); process.exit(1); }
  if (space !== "inside") { console.error("only `inside` supported for now"); process.exit(1); }

  const dayName = (() => { const [, m, d] = date.split("-"); return `${+d}-${+m}`; })(); // 2026-07-31 -> 31-7
  const tab = `${dayName} ${ampm}`;

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sess, error } = await supa
    .from("ethogram_sessions")
    .select("data, status, sheet_tab, committed_by_name")
    .eq("session_date", date).eq("time_of_day", ampm).eq("space", space)
    .eq("status", "committed").eq("sheet_tab", tab).maybeSingle();
  if (error) throw error;
  if (!sess) throw new Error(`no committed ${space} session found for ${date} ${ampm} (tab "${tab}")`);

  const rows = insideRows(sess.data);
  const perch = [];
  for (let o = 0; o < 6; o++) for (let c = 0; c < 8; c++) { const v = sess.data[o][c][16]; if (v) perch.push(`${o + 1}·${c + 1}=${v}`); }
  console.log(`tab "${tab}"  committed_by=${sess.committed_by_name ?? "?"}  rows=${rows.length}`);
  console.log(`perching counts: ${perch.join(" ")}`);

  if (!write) { console.log("DRY RUN — pass --write to push to the Sheet."); return; }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GSHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const sh = (meta.data.sheets ?? []).find((s) => s.properties?.title === tab);
  if (!sh) {
    console.error(`looking for ${JSON.stringify(tab)}; available tabs:`,
      (meta.data.sheets ?? []).map((s) => JSON.stringify(s.properties?.title)).join(", "));
    throw new Error(`tab "${tab}" not found in the Sheet`);
  }
  const a1 = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A1` })).data.values?.[0]?.[0];
  if (String(a1 ?? "").trim().toUpperCase() !== "OBSERV.") throw new Error(`A1 of "${tab}" is "${a1}", not "OBSERV." — refusing to overwrite`);

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!A1:Z100` });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${tab}'!A1`, valueInputOption: "RAW", requestBody: { values: rows } });
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ updateCells: {
      range: { sheetId: sh.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ note: `Admin data-fix re-commit · ${stamp}` }] }], fields: "note",
    } }] },
  });
  console.log(`✅ wrote ${rows.length} rows to "${tab}"`);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
