#!/usr/bin/env node
/* Diagnostic: print a spreadsheet's title + tab names. Usage: node scripts/list-tabs.mjs [sheetId]
 * (defaults to GSHEET_ID from .env.local). Read-only. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

const id = process.argv[2] || process.env.GSHEET_ID;
const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const sheets = google.sheets({ version: "v4", auth });
const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "properties.title,sheets.properties.title" });
console.log("id:   ", id);
console.log("local GSHEET_ID:", process.env.GSHEET_ID);
console.log("title:", meta.data.properties?.title);
console.log("tabs: ", (meta.data.sheets ?? []).map((s) => s.properties?.title).join(" | "));
