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
