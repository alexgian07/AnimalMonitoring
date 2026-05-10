"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { t } from "@/lib/i18n";

interface Task {
  id: string;
  day_of_week: number;
  time_slot: string | null;
  task_label: string;
  category: string | null;
  position: number;
}

const DAY_NAMES = ["Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο","Κυριακή"];

export default function TasksTemplateEditor() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [showAdd, setShowAdd] = useState<number | null>(null);   // day for new task
  const [newForm, setNewForm] = useState<Partial<Task>>({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch("/api/tasks-template");
    if (r.ok) setTasks(await r.json());
  }
  useEffect(() => { refresh(); }, []);

  async function startEdit(task: Task) {
    setEditingId(task.id);
    setEditForm({ ...task });
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    const r = await fetch("/api/tasks-template", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    });
    setBusy(false);
    if (r.ok) {
      setEditingId(null);
      setEditForm({});
      refresh();
    } else {
      const err = await r.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.tasksEditor.confirmDelete)) return;
    const r = await fetch(`/api/tasks-template?id=${id}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  async function handleAdd(day: number) {
    if (!newForm.task_label) return;
    setBusy(true);
    const r = await fetch("/api/tasks-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_of_week: day,
        time_slot:   newForm.time_slot,
        task_label:  newForm.task_label,
        category:    newForm.category,
        position:    newForm.position ?? 0,
      }),
    });
    setBusy(false);
    if (r.ok) {
      setShowAdd(null);
      setNewForm({});
      refresh();
    } else {
      const err = await r.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα");
    }
  }

  const inputClass = "bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-500";

  return (
    <div className="space-y-6">
      {DAY_NAMES.map((dayName, idx) => {
        const day = idx + 1;
        const dayTasks = tasks.filter(tk => tk.day_of_week === day).sort((a, b) => a.position - b.position);
        return (
          <div key={day} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">{dayName}</h3>
              <button
                onClick={() => { setShowAdd(day); setNewForm({ position: dayTasks.length + 1 }); }}
                className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-white px-2 py-1 rounded"
              >
                <Plus size={12} /> {t.tasksEditor.addTask}
              </button>
            </div>
            <div className="divide-y divide-gray-800/50">
              {dayTasks.length === 0 ? (
                <div className="px-5 py-3 text-xs text-gray-500 italic">{t.tasksEditor.noTasksDay}</div>
              ) : (
                dayTasks.map(tk => (
                  <div key={tk.id} className="px-5 py-2 flex items-center gap-3 text-sm">
                    {editingId === tk.id ? (
                      <>
                        <input value={editForm.time_slot ?? ""} onChange={e => setEditForm(f => ({ ...f, time_slot: e.target.value }))}
                          placeholder={t.tasksEditor.timeSlotPlaceholder}
                          className={`${inputClass} w-32 font-mono`} />
                        <input value={editForm.task_label ?? ""} onChange={e => setEditForm(f => ({ ...f, task_label: e.target.value }))}
                          className={`${inputClass} flex-1`} />
                        <input value={editForm.category ?? ""} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          placeholder={t.tasksEditor.category}
                          className={`${inputClass} w-24`} />
                        <input type="number" value={editForm.position ?? 0} onChange={e => setEditForm(f => ({ ...f, position: parseInt(e.target.value) }))}
                          className={`${inputClass} w-14`} />
                        <button onClick={saveEdit} disabled={busy} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-gray-400 hover:text-white"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500 font-mono w-32 shrink-0">{tk.time_slot ?? "—"}</span>
                        <span className="flex-1 text-gray-200">{tk.task_label}</span>
                        {tk.category && <span className="text-xs text-gray-500">{tk.category}</span>}
                        <button onClick={() => startEdit(tk)} className="text-gray-500 hover:text-white"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(tk.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                ))
              )}

              {showAdd === day && (
                <div className="px-5 py-2 flex items-center gap-3 text-sm bg-gray-800/30">
                  <input value={newForm.time_slot ?? ""} onChange={e => setNewForm(f => ({ ...f, time_slot: e.target.value }))}
                    placeholder={t.tasksEditor.timeSlotPlaceholder}
                    className={`${inputClass} w-32 font-mono`} />
                  <input value={newForm.task_label ?? ""} onChange={e => setNewForm(f => ({ ...f, task_label: e.target.value }))}
                    placeholder={t.tasksEditor.taskLabel}
                    className={`${inputClass} flex-1`} autoFocus />
                  <input value={newForm.category ?? ""} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                    placeholder={t.tasksEditor.category}
                    className={`${inputClass} w-24`} />
                  <input type="number" value={newForm.position ?? ""} onChange={e => setNewForm(f => ({ ...f, position: parseInt(e.target.value) }))}
                    placeholder="#"
                    className={`${inputClass} w-14`} />
                  <button onClick={() => handleAdd(day)} disabled={busy || !newForm.task_label} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"><Check size={14} /></button>
                  <button onClick={() => { setShowAdd(null); setNewForm({}); }} className="text-gray-400 hover:text-white"><X size={14} /></button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
