"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Clock3,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string | null;
  hours: number | null;
  created_at: string;
};

type TaskForm = {
  title: string;
  description: string;
  hours: string;
  status: string;
  visibility: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  hours: "1",
  status: "active",
  visibility: "all",
};

export default function TasksPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [canManage, setCanManage] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);

  const t = (ar: string, en: string) => isArabic ? ar : en;

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Load tasks error:", queryError);
      setError(queryError.message);
      setTasks([]);
    } else {
      setTasks((data ?? []) as Task[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        if (!cancelled) {
          setError(t("سجّل الدخول أولًا.", "Please sign in first."));
          setLoading(false);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setCanManage(
          !profileError &&
          !!profile?.is_active &&
          ["admin", "secretary"].includes(profile.role)
        );
      }

      if (!cancelled) await loadTasks();
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [supabase, loadTasks, isArabic]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  function openAdd() {
    setEditingTask(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      hours: String(task.hours ?? 1),
      status: task.status,
      visibility: task.visibility ?? "all",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;

    const hours = Number(form.hours);

    if (!form.title.trim() || !Number.isFinite(hours) || hours <= 0) {
      setError(t("أدخل اسم المهمة وعدد ساعات صحيحًا.", "Enter a title and valid hours."));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      hours,
      status: form.status,
      visibility: form.visibility,
    };

    const result = editingTask
      ? await supabase.from("tasks").update(payload).eq("id", editingTask.id)
      : await supabase.from("tasks").insert(payload);

    if (result.error) {
      console.error("Save task error:", result.error);
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSuccess(
      editingTask
        ? t("تم تعديل المهمة.", "Task updated.")
        : t("تمت إضافة المهمة.", "Task added.")
    );

    await loadTasks();
    setSaving(false);
  }

  async function handleDelete(task: Task) {
    if (!canManage) return;

    const confirmed = window.confirm(
      t(`هل تريد حذف المهمة "${task.title}"؟`, `Delete "${task.title}"?`)
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess(t("تم حذف المهمة.", "Task deleted."));
    await loadTasks();
  }

  return (
    <main className="space-y-6 p-4 md:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-400">IEEE NDETI</p>
          <h1 className="text-2xl font-bold">
            {t("إدارة المهام", "Tasks Management")}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t("أنشئ المهام وحدد ساعاتها ومدى إتاحتها.", "Create tasks and configure hours and visibility.")}
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={!canManage}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Plus size={18} />
          {t("إضافة مهمة", "Add Task")}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <ClipboardList size={22} className="text-blue-400" />
          <p className="mt-3 text-sm text-slate-400">
            {t("إجمالي المهام الظاهرة", "Visible Tasks")}
          </p>
          <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <Clock3 size={22} className="text-purple-400" />
          <p className="mt-3 text-sm text-slate-400">
            {t("إجمالي الساعات المحددة", "Total Assigned Hours")}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {tasks.reduce((sum, task) => sum + Number(task.hours ?? 0), 0)}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isArabic ? "right-3" : "left-3"}`}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ابحث عن مهمة...", "Search tasks...")}
              className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-3 outline-none focus:border-blue-500 ${isArabic ? "pr-10 pl-4" : "pl-10 pr-4"}`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          >
            <option value="all">{t("كل الحالات", "All statuses")}</option>
            <option value="active">{t("نشطة", "Active")}</option>
            <option value="completed">{t("مكتملة", "Completed")}</option>
            <option value="inactive">{t("غير نشطة", "Inactive")}</option>
          </select>

          <button
            type="button"
            onClick={() => void loadTasks()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("تحديث", "Refresh")}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
            {success}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="py-10 text-center text-slate-400">
              {t("جارٍ تحميل المهام...", "Loading tasks...")}
            </p>
          ) : filteredTasks.length === 0 ? (
            <p className="py-10 text-center text-slate-400 md:col-span-2 xl:col-span-3">
              {t("لا توجد مهام مطابقة.", "No matching tasks found.")}
            </p>
          ) : (
            filteredTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <ClipboardList size={21} />
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${
                    task.status === "active"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-slate-800 text-slate-300"
                  }`}>
                    {task.status}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold">{task.title}</h2>
                <p className="mt-2 min-h-12 whitespace-pre-wrap text-sm text-slate-400">
                  {task.description || t("لا يوجد وصف للمهمة.", "No task description.")}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-lg bg-slate-800 px-3 py-2">
                    <Clock3 size={13} className="mr-1 inline" />
                    {task.hours ?? 0} {t("ساعة", "hours")}
                  </span>
                  <span className="rounded-lg bg-slate-800 px-3 py-2">
                    {task.visibility ?? "—"}
                  </span>
                </div>

                {canManage && (
                  <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/10"
                    >
                      <Pencil size={15} />
                      {t("تعديل", "Edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                      {t("حذف", "Delete")}
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 id="task-modal-title" className="text-xl font-bold">
                {editingTask ? t("تعديل المهمة", "Edit Task") : t("إضافة مهمة جديدة", "Add New Task")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="mb-2 block text-sm text-slate-300">
                  {t("اسم المهمة", "Task title")}
                </label>
                <input
                  id="task-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                  maxLength={150}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="task-description" className="mb-2 block text-sm text-slate-300">
                  {t("الوصف", "Description")}
                </label>
                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="task-hours" className="mb-2 block text-sm text-slate-300">
                  {t("الساعات المستحقة", "Awarded hours")}
                </label>
                <input
                  id="task-hours"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={form.hours}
                  onChange={(event) => setForm({ ...form, hours: event.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="task-status" className="mb-2 block text-sm text-slate-300">
                  {t("الحالة", "Status")}
                </label>
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="active">{t("نشطة", "Active")}</option>
                  <option value="completed">{t("مكتملة", "Completed")}</option>
                  <option value="inactive">{t("غير نشطة", "Inactive")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="task-visibility" className="mb-2 block text-sm text-slate-300">
                  {t("الإتاحة", "Visibility")}
                </label>
                <select
                  id="task-visibility"
                  value={form.visibility}
                  onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="all">{t("متاحة للجميع", "Everyone")}</option>
                  <option value="heads">{t("رؤساء اللجان", "Committee heads")}</option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
                >
                  {t("إلغاء", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !canManage}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? t("جارٍ الحفظ...", "Saving...") : t("حفظ", "Save")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}