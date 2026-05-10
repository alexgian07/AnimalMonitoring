import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = await createServerClient();

  const [
    locationsRes,
    turkeysRes,
    measurementsRes,
    cullsRes,
    dailyRes,
    feedRes,
  ] = await Promise.all([
    sb.from("locations").select("*").order("position"),
    sb.from("turkeys").select("*, locations(name)").is("deleted_at", null),
    sb.from("measurements").select("*, turkeys(tag), locations(name)").is("deleted_at", null).order("measured_at"),
    sb.from("culls").select("*, turkeys(tag), locations(name)").is("deleted_at", null).order("culled_at"),
    sb.from("daily_temperatures").select("*, locations(name)").is("deleted_at", null).order("recorded_on"),
    sb.from("feed_logs").select("*, locations(name)").is("deleted_at", null).order("week_number"),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Animal Monitoring";
  wb.created = new Date();

  // ============ ΚΕΛΙΑ ============
  const wsLoc = wb.addWorksheet("Κελιά");
  wsLoc.columns = [
    { header: "Όνομα",          key: "name",        width: 14 },
    { header: "Περιγραφή",      key: "description", width: 24 },
    { header: "Θέση",           key: "position",    width: 8  },
    { header: "Πλευρά",         key: "side",        width: 10 },
  ];
  for (const r of locationsRes.data ?? []) wsLoc.addRow(r);
  wsLoc.getRow(1).font = { bold: true };

  // ============ ΓΑΛΟΠΟΥΛΕΣ ============
  const wsTk = wb.addWorksheet("Γαλοπούλες");
  wsTk.columns = [
    { header: "Ετικέτα",     key: "tag",        width: 12 },
    { header: "Κελί",        key: "loc",        width: 12 },
    { header: "Φύλο",        key: "sex",        width: 8  },
    { header: "Γέννηση",     key: "birth_date", width: 12 },
    { header: "Κατάσταση",   key: "status",     width: 10 },
    { header: "Σημειώσεις",  key: "notes",      width: 30 },
  ];
  for (const r of turkeysRes.data ?? []) {
    wsTk.addRow({ ...r, loc: r.locations?.name ?? "" });
  }
  wsTk.getRow(1).font = { bold: true };

  // ============ ΜΕΤΡΗΣΕΙΣ ============
  const wsM = wb.addWorksheet("Μετρήσεις");
  wsM.columns = [
    { header: "Ημ/νία",                 key: "measured_at",            width: 12 },
    { header: "Κελί",                   key: "loc",                    width: 12 },
    { header: "Ζώο",                    key: "tag",                    width: 12 },
    { header: "Βάρος (kg)",             key: "weight_kg",              width: 12 },
    { header: "Θερμοκρασία (°C)",       key: "temperature_celsius",    width: 14 },
    { header: "Μήκος μεταταρσίου (mm)", key: "metatarsus_length_mm",   width: 14 },
    { header: "Διάμ. μεταταρσίου (mm)", key: "metatarsus_diameter_mm", width: 14 },
    { header: "Εύρος στήθους (mm)",     key: "chest_width_mm",         width: 14 },
    { header: "Μήκος τρόπιδας (mm)",    key: "keel_length_mm",         width: 14 },
    { header: "Μήκος σώματος (mm)",     key: "body_length_mm",         width: 14 },
    { header: "Σημειώσεις",             key: "notes",                  width: 30 },
  ];
  for (const r of measurementsRes.data ?? []) {
    wsM.addRow({ ...r, tag: r.turkeys?.tag ?? "", loc: r.locations?.name ?? "" });
  }
  wsM.getRow(1).font = { bold: true };

  // ============ ΣΦΑΓΕΣ ============
  const wsC = wb.addWorksheet("Σφαγές");
  wsC.columns = [
    { header: "Ημ/νία",      key: "culled_at",       width: 12 },
    { header: "Κελί",        key: "loc",             width: 12 },
    { header: "Ζώο",         key: "tag",             width: 12 },
    { header: "Βάρος (kg)",  key: "weight_at_cull",  width: 12 },
    { header: "Λόγος",       key: "reason",          width: 12 },
    { header: "Σημειώσεις",  key: "notes",           width: 30 },
  ];
  for (const r of cullsRes.data ?? []) {
    wsC.addRow({ ...r, tag: r.turkeys?.tag ?? "", loc: r.locations?.name ?? "" });
  }
  wsC.getRow(1).font = { bold: true };

  // ============ ΗΜΕΡΗΣΙΕΣ ΘΕΡΜΟΚΡΑΣΙΕΣ ============
  const wsD = wb.addWorksheet("Ημερήσιες");
  wsD.columns = [
    { header: "Ημ/νία",       key: "recorded_on",  width: 12 },
    { header: "Κελί",         key: "loc",          width: 12 },
    { header: "Ελάχιστη °C",  key: "temp_min",     width: 10 },
    { header: "Μέγιστη °C",   key: "temp_max",     width: 10 },
    { header: "Πρωί °C",      key: "temp_morning", width: 10 },
    { header: "Μεσημέρι °C",  key: "temp_midday",  width: 10 },
    { header: "Απόγευμα °C",  key: "temp_evening", width: 10 },
    { header: "Υγρασία %",    key: "humidity",     width: 10 },
    { header: "Νεκρά",        key: "mortality",    width: 8  },
    { header: "Άρρωστα",      key: "sick_count",   width: 8  },
    { header: "Σημειώσεις",   key: "notes",        width: 30 },
  ];
  for (const r of dailyRes.data ?? []) {
    wsD.addRow({ ...r, loc: r.locations?.name ?? "" });
  }
  wsD.getRow(1).font = { bold: true };

  // ============ ΖΥΓΙΣΗ ΤΡΟΦΗΣ ============
  const wsF = wb.addWorksheet("Ζύγιση Τροφής");
  wsF.columns = [
    { header: "Εβδομάδα",      key: "week_number",      width: 8  },
    { header: "Ημ/νία",        key: "week_start_date",  width: 12 },
    { header: "Κελί",          key: "loc",              width: 12 },
    { header: "Ταΐστρα",       key: "feeder_label",     width: 10 },
    { header: "Πριν (kg)",     key: "weight_before_kg", width: 10 },
    { header: "+ Τροφή (kg)",  key: "feed_added_kg",    width: 12 },
    { header: "Μετά (kg)",     key: "weight_after_kg",  width: 10 },
    { header: "Κατανάλωση",    key: "consumption_kg",   width: 12 },
    { header: "Αρ. ζώων",      key: "bird_count",       width: 10 },
    { header: "Μ.Ο. βάρος",    key: "avg_weight_kg",    width: 10 },
    { header: "Σύνολο σμήν.",  key: "total_flock_kg",   width: 12 },
    { header: "Αύξηση",        key: "weight_gain_kg",   width: 10 },
    { header: "Σχόλια",        key: "notes",            width: 30 },
  ];
  for (const r of feedRes.data ?? []) {
    wsF.addRow({ ...r, loc: r.locations?.name ?? "" });
  }
  wsF.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `animal-monitoring-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
