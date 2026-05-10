import TasksTemplateEditor from "@/components/TasksTemplateEditor";
import { t } from "@/lib/i18n";

export default function TasksPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t.tasksEditor.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{t.tasksEditor.subtitle}</p>
      <TasksTemplateEditor />
    </div>
  );
}
