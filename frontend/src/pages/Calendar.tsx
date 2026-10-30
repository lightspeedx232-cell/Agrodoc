import { useEffect, useState } from "react";
import { tasksApi, type FarmTask, type TaskCreate } from "../lib/api";
import { Alert, PageHeader, Spinner } from "../components/ui";

const CATEGORIES = ["general", "sowing", "irrigation", "fertilization", "pest-control", "harvest", "soil", "weather", "other"];

const CATEGORY_EMOJI: Record<string, string> = {
  general: "📋", sowing: "🌱", irrigation: "💧", fertilization: "🌿",
  "pest-control": "🐛", harvest: "🌾", soil: "🏔️", weather: "🌦️", other: "📌",
};

export default function Calendar() {
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
  const [form, setForm] = useState<TaskCreate>({
    title: "", description: "", category: "general", due_date: "",
  });

  const load = () =>
    tasksApi.list()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await tasksApi.create({ ...form, due_date: form.due_date || undefined, description: form.description || undefined });
    setForm({ title: "", description: "", category: "general", due_date: "" });
    setShowForm(false);
    load();
  };

  const complete = async (id: number) => {
    await tasksApi.complete(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));
  };

  const remove = async (id: number) => {
    await tasksApi.remove(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const shown = tasks.filter(t =>
    filter === "all" ? true : filter === "pending" ? !t.completed : t.completed
  );

  const overdue = shown.filter(t => !t.completed && t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
  const upcoming = shown.filter(t => !t.completed && (!t.due_date || t.due_date >= new Date().toISOString().slice(0, 10)));
  const done = shown.filter(t => t.completed);

  if (loading) return <Spinner label="Loading tasks…" />;

  return (
    <div>
      <PageHeader title="Crop Calendar" subtitle="Manage farm tasks, reminders, and seasonal activities." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "+ Add task"}
        </button>
        <div className="ml-auto flex gap-1">
          {(["pending", "all", "done"] as const).map(f => (
            <button key={f} className={filter === f ? "btn-primary" : "btn-secondary"}
              onClick={() => setFilter(f)}>
              {f === "pending" ? "Pending" : f === "done" ? "Done" : "All"}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 p-6 space-y-3">
          <h2 className="font-bold text-brand-800">New task</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input required className="input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes (optional)</label>
              <textarea className="input" rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" type="submit">Save task</button>
        </form>
      )}

      {shown.length === 0 && (
        <Alert variant="info">No tasks yet. Add your first farm task above.</Alert>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <TaskGroup title="⚠️ Overdue" tasks={overdue} onComplete={complete} onDelete={remove} accent="red" />
      )}

      {/* Upcoming / pending */}
      {upcoming.length > 0 && (
        <TaskGroup title="📅 Upcoming" tasks={upcoming} onComplete={complete} onDelete={remove} accent="brand" />
      )}

      {/* Done */}
      {done.length > 0 && filter !== "pending" && (
        <TaskGroup title="✅ Completed" tasks={done} onComplete={complete} onDelete={remove} accent="green" />
      )}
    </div>
  );
}

function TaskGroup({ title, tasks, onComplete, onDelete, accent }: {
  title: string; tasks: FarmTask[];
  onComplete: (id: number) => void; onDelete: (id: number) => void;
  accent: "red" | "brand" | "green";
}) {
  const colors = {
    red: "border-red-200 bg-red-50",
    brand: "border-brand-200 bg-brand-50",
    green: "border-green-200 bg-green-50",
  };
  return (
    <div className="mb-5">
      <h3 className="mb-2 font-semibold text-brand-800">{title}</h3>
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${colors[accent]} ${t.completed ? "opacity-60" : ""}`}>
            <span className="text-xl mt-0.5">{CATEGORY_EMOJI[t.category] ?? "📋"}</span>
            <div className="flex-1">
              <p className={`font-medium text-brand-800 ${t.completed ? "line-through" : ""}`}>{t.title}</p>
              {t.description && <p className="text-sm text-brand-600">{t.description}</p>}
              {t.due_date && (
                <p className="text-xs text-brand-500">Due: {t.due_date}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {!t.completed && (
                <button className="btn-secondary py-1 px-2 text-xs" onClick={() => onComplete(t.id)}>
                  ✓ Done
                </button>
              )}
              <button className="btn-secondary py-1 px-2 text-xs text-red-600" onClick={() => onDelete(t.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
