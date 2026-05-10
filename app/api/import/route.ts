import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

interface ImportSummary {
  measurements:        { inserted: number; skipped: number };
  daily_temperatures:  { inserted: number; skipped: number };
  feed_logs:           { inserted: number; skipped: number };
  errors: string[];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminId = userId;  // historical name kept below

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const service = createServiceClient();
  const summary: ImportSummary = {
    measurements:       { inserted: 0, skipped: 0 },
    daily_temperatures: { inserted: 0, skipped: 0 },
    feed_logs:          { inserted: 0, skipped: 0 },
    errors: [],
  };

  // Build name → id maps
  const { data: locations } = await service.from("locations").select("id, name");
  const locByName: Record<string, string> = {};
  for (const l of locations ?? []) locByName[(l.name || "").trim()] = l.id;

  const { data: turkeys } = await service.from("turkeys").select("id, tag, location_id").is("deleted_at", null);
  const turkeyByLocAndTag: Record<string, string> = {};
  for (const t of turkeys ?? []) turkeyByLocAndTag[`${t.location_id}::${(t.tag || "").trim()}`] = t.id;

  // Helpers to coerce cell values
  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const int = (v: any): number | null => {
    const n = num(v);
    return n === null ? null : Math.round(n);
  };
  const dateStr = (v: any): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split("T")[0];
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  };

  // === MEASUREMENTS ===
  const wsM = wb.getWorksheet("Μετρήσεις");
  if (wsM) {
    const headerRow = wsM.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      headers[String(cell.value).trim()] = colNumber;
    });

    for (let r = 2; r <= wsM.rowCount; r++) {
      const row = wsM.getRow(r);
      const get = (label: string) => row.getCell(headers[label] ?? 0).value;

      const date     = dateStr(get("Ημ/νία"));
      const locName  = String(get("Κελί") ?? "").trim();
      const tag      = String(get("Ζώο") ?? "").trim();
      if (!date || !locName || !tag) { summary.measurements.skipped++; continue; }

      const locId = locByName[locName];
      if (!locId) { summary.errors.push(`Μετρήσεις γρ.${r}: άγνωστο κελί "${locName}"`); summary.measurements.skipped++; continue; }
      const turkeyId = turkeyByLocAndTag[`${locId}::${tag}`];
      if (!turkeyId) { summary.errors.push(`Μετρήσεις γρ.${r}: άγνωστο ζώο "${tag}" στο "${locName}"`); summary.measurements.skipped++; continue; }

      const { error } = await service.from("measurements").insert({
        turkey_id: turkeyId,
        location_id: locId,
        measured_at: date,
        weight_kg:              num(get("Βάρος (kg)")),
        temperature_celsius:    num(get("Θερμοκρασία (°C)")),
        metatarsus_length_mm:   num(get("Μήκος μεταταρσίου (mm)")),
        metatarsus_diameter_mm: num(get("Διάμ. μεταταρσίου (mm)")),
        chest_width_mm:         num(get("Εύρος στήθους (mm)")),
        keel_length_mm:         num(get("Μήκος τρόπιδας (mm)")),
        body_length_mm:         num(get("Μήκος σώματος (mm)")),
        notes: String(get("Σημειώσεις") ?? "") || null,
        recorded_by: adminId,
      });
      if (error) { summary.errors.push(`Μετρήσεις γρ.${r}: ${error.message}`); summary.measurements.skipped++; }
      else summary.measurements.inserted++;
    }
  }

  // === DAILY TEMPERATURES ===
  const wsD = wb.getWorksheet("Ημερήσιες");
  if (wsD) {
    const headerRow = wsD.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => { headers[String(cell.value).trim()] = colNumber; });

    for (let r = 2; r <= wsD.rowCount; r++) {
      const row = wsD.getRow(r);
      const get = (label: string) => row.getCell(headers[label] ?? 0).value;

      const date    = dateStr(get("Ημ/νία"));
      const locName = String(get("Κελί") ?? "").trim();
      if (!date || !locName) { summary.daily_temperatures.skipped++; continue; }
      const locId = locByName[locName];
      if (!locId) { summary.errors.push(`Ημερήσιες γρ.${r}: άγνωστο κελί "${locName}"`); summary.daily_temperatures.skipped++; continue; }

      const { error } = await service.from("daily_temperatures").upsert({
        location_id: locId,
        recorded_on: date,
        temp_min:     num(get("Ελάχιστη °C")),
        temp_max:     num(get("Μέγιστη °C")),
        temp_morning: num(get("Πρωί °C")),
        temp_midday:  num(get("Μεσημέρι °C")),
        temp_evening: num(get("Απόγευμα °C")),
        humidity:     int(get("Υγρασία %")),
        mortality:    int(get("Νεκρά")) ?? 0,
        sick_count:   int(get("Άρρωστα")) ?? 0,
        notes:        String(get("Σημειώσεις") ?? "") || null,
        recorded_by:  adminId,
      }, { onConflict: "location_id,recorded_on" });
      if (error) { summary.errors.push(`Ημερήσιες γρ.${r}: ${error.message}`); summary.daily_temperatures.skipped++; }
      else summary.daily_temperatures.inserted++;
    }
  }

  // === FEED LOGS ===
  const wsF = wb.getWorksheet("Ζύγιση Τροφής");
  if (wsF) {
    const headerRow = wsF.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => { headers[String(cell.value).trim()] = colNumber; });

    for (let r = 2; r <= wsF.rowCount; r++) {
      const row = wsF.getRow(r);
      const get = (label: string) => row.getCell(headers[label] ?? 0).value;

      const week    = int(get("Εβδομάδα"));
      const date    = dateStr(get("Ημ/νία"));
      const locName = String(get("Κελί") ?? "").trim();
      if (!week || !date || !locName) { summary.feed_logs.skipped++; continue; }
      const locId = locByName[locName];
      if (!locId) { summary.errors.push(`Ζύγιση Τροφής γρ.${r}: άγνωστο κελί "${locName}"`); summary.feed_logs.skipped++; continue; }

      const { error } = await service.from("feed_logs").upsert({
        location_id:      locId,
        feeder_label:     String(get("Ταΐστρα") ?? "main").trim() || "main",
        week_number:      week,
        week_start_date:  date,
        weight_before_kg: num(get("Πριν (kg)")),
        feed_added_kg:    num(get("+ Τροφή (kg)")),
        weight_after_kg:  num(get("Μετά (kg)")),
        bird_count:       int(get("Αρ. ζώων")),
        avg_weight_kg:    num(get("Μ.Ο. βάρος")),
        weight_gain_kg:   num(get("Αύξηση")),
        notes:            String(get("Σχόλια") ?? "") || null,
        recorded_by:      adminId,
      }, { onConflict: "location_id,feeder_label,week_number" });
      if (error) { summary.errors.push(`Ζύγιση Τροφής γρ.${r}: ${error.message}`); summary.feed_logs.skipped++; }
      else summary.feed_logs.inserted++;
    }
  }

  return NextResponse.json(summary);
}
