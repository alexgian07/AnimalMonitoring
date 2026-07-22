/* Google Sheets access for the ethogram commit.
 * Credentials come from the GOOGLE_CREDENTIALS env var (the full service-account.json
 * contents). The target spreadsheet must be a NATIVE Google Sheet shared with the
 * service account's client_email as Editor. */
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

function auth() {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS is not set on the server");
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: SCOPES });
}

function sheetsClient() {
  return google.sheets({ version: "v4", auth: auth() });
}

export class TabExistsError extends Error {
  code = "TAB_EXISTS";
  constructor(tab: string) { super(`Tab "${tab}" already exists in the spreadsheet`); }
}

export class TabShapeError extends Error {
  code = "TAB_SHAPE_MISMATCH";
  constructor(tab: string) { super(`Tab "${tab}" doesn't look like an ethogram tab — refusing to replace it`); }
}

export type Row = (string | number)[];

/* Add a new tab named `tabName` and write `rows` starting at A1. Refuses if a tab
 * with that name already exists (never overwrites existing data). If `note` is given,
 * it is attached as a cell note on A1 (records who committed) without altering A1's value. */
export async function commitDay(spreadsheetId: string, tabName: string, rows: Row[], note?: string) {
  const sheets = sheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (titles.includes(tabName)) throw new TabExistsError(tabName);

  const added = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });
  const sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  if (note && sheetId != null) {
    // updateCells with fields:"note" sets only the note — the A1 value is untouched.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
            rows: [{ values: [{ note }] }],
            fields: "note",
          },
        }],
      },
    });
  }

  return { tab: tabName, rowsWritten: rows.length };
}

/* Whether a tab with this name currently exists in the spreadsheet. */
export async function tabExists(spreadsheetId: string, tabName: string): Promise<boolean> {
  const sheets = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  return (meta.data.sheets ?? []).some((s) => s.properties?.title === tabName);
}

/* Replace an EXISTING app-created tab's data with `rows` (the guarded correction path). Verifies
 * the tab looks like an ethogram tab (A1 == "OBSERV.") before clearing + rewriting, and throws
 * TabShapeError otherwise so we never clobber an unrelated sheet. If the tab has since vanished,
 * falls back to creating it fresh. Google Sheets' built-in version history is the undo safety net. */
export async function replaceTab(spreadsheetId: string, tabName: string, rows: Row[], note?: string) {
  const sheets = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const sheet = (meta.data.sheets ?? []).find((s) => s.properties?.title === tabName);
  if (!sheet?.properties) return commitDay(spreadsheetId, tabName, rows, note); // gone → create fresh
  const sheetId = sheet.properties.sheetId!;

  // shape guard: only overwrite something that actually looks like our template
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'!A1` });
  const a1 = String(cur.data.values?.[0]?.[0] ?? "").trim().toUpperCase();
  if (a1 !== "OBSERV.") throw new TabShapeError(tabName);

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tabName}'!A1:Z100` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  if (note) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
            rows: [{ values: [{ note }] }],
            fields: "note",
          },
        }],
      },
    });
  }

  return { tab: tabName, rowsWritten: rows.length, replaced: true };
}
