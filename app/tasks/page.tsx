
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Clock3,
  Upload,
  Link as LinkIcon,
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Committee =
  | "CORE"
  | "HR"
  | "PR"
  | "LOGISTICS"
  | "PROGRAMMING"
  | "MEDIA";

type TaskStatus = "draft" | "published" | "closed";
type TaskVisibility = "all" | "selected_heads";

type SubmissionStatus = "pending" | "approved" | "rejected";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  visibility: TaskVisibility;
  hours: number | null;
  committee: Committee | null;
  created_at: string;
  created_by?: string;
};

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  answer_text: string | null;
  external_url: string | null;
  file_path: string | null;
  status: SubmissionStatus;
  review_note: string | null;
  created_at: string;
};

type TaskForm = {
  title: string;
  description: string;
  hours: string;
  status: TaskStatus;
  visibility: TaskVisibility;
  committee: Committee | "";
};

const COMMITTEES: Committee[] = [
  "CORE",
  "HR",
  "PR",
  "LOGISTICS",
  "PROGRAMMING",
  "MEDIA",
];

const emptyForm: TaskForm = {
  title: "",
  description: "",
  hours: "1",
  status: "published",
  visibility: "all",
  committee: "",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function TasksPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<
    Record<string, Submission>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [studentCommittee, setStudentCommittee] =
    useState<Committee | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [form, setForm] = useState<TaskForm>(emptyForm);

  const [answerText, setAnswerText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const canManage = ["admin", "secretary"].includes(role);

  const canReview = [
    "admin",
    "secretary",
    "head",
  ].includes(role);

  const committeeLabel = (committee: string | null) => {
    if (!committee) return t("غير محددة", "Not assigned");

    const labels: Record<string, [string, string]> = {
      CORE: ["الإدارة", "CORE"],
      HR: ["الموارد البشرية", "HR"],
      PR: ["العلاقات العامة", "PR"],
      LOGISTICS: ["اللوجستيات", "LOGISTICS"],
      PROGRAMMING: ["البرمجة", "PROGRAMMING"],
      MEDIA: ["الميديا", "MEDIA"],
    };

    const item = labels[committee];

    return item ? t(item[0], item[1]) : committee;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      draft: ["مسودة", "Draft"],
      published: ["نشطة", "Published"],
      closed: ["مغلقة", "Closed"],
      pending: ["قيد المراجعة", "Pending"],
      approved: ["مقبول", "Approved"],
      rejected: ["مرفوض", "Rejected"],
    };

    const item = labels[status];

    return item ? t(item[0], item[1]) : status;
  };

  const statusStyle = (status: string) => {
    if (status === "published" || status === "approved") {
      return "bg-emerald-500/10 text-emerald-400";
    }

    if (status === "draft" || status === "pending") {
      return "bg-amber-500/10 text-amber-400";
    }

    if (status === "rejected") {
      return "bg-red-500/10 text-red-400";
    }

    return "bg-slate-500/10 text-slate-400";
  };

  const loadUser = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        t("سجّل الدخول أولًا.", "Please sign in first.")
      );
    }

    setUserId(user.id);

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role, is_active, committee")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile?.is_active) {
      throw new Error(
        t(
          "حسابك غير مفعل أو لا يمكن قراءة بياناته.",
          "Your account is inactive or profile could not be loaded."
        )
      );
    }

    setRole(profile.role);

    const { data: student } = await supabase
      .from("students")
      .select("committee")
      .ilike("email", user.email ?? "")
      .maybeSingle();

    setStudentCommittee(
      (student?.committee as Committee | null) ?? null
    );

    return user.id;
  }, [supabase, isArabic]);

  const loadTasks = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) throw queryError;

    setTasks((data ?? []) as Task[]);
  }, [supabase]);

  const loadSubmissions = useCallback(
    async (currentUserId: string) => {
      const { data, error: queryError } = await supabase
        .from("task_submissions")
        .select("*")
        .eq("student_id", currentUserId);

      if (queryError) {
        console.error("Load submissions:", queryError);
        return;
      }

      const mapped: Record<string, Submission> = {};

      (data ?? []).forEach((item) => {
        mapped[item.task_id] = item as Submission;
      });

      setSubmissions(mapped);
    },
    [supabase]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const currentUserId = userId || await loadUser();

      await loadTasks();
      await loadSubmissions(currentUserId);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء تحميل البيانات.", "Failed to load data.")
      );
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    loadUser,
    loadTasks,
    loadSubmissions,
    isArabic,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        task.status === statusFilter;

      const visibleToStudent =
        role !== "student" ||
        (
          task.status === "published" &&
          task.visibility === "all" &&
          !!studentCommittee &&
          task.committee === studentCommittee
        );

      return (
        matchesSearch &&
        matchesStatus &&
        visibleToStudent
      );
    });
  }, [
    tasks,
    search,
    statusFilter,
    role,
    studentCommittee,
  ]);

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
      committee: task.committee ?? "",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleTaskSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManage || saving) return;

    const hours = Number(form.hours);

    if (
      !form.title.trim() ||
      !Number.isFinite(hours) ||
      hours <= 0 ||
      !form.committee
    ) {
      setError(
        t(
          "أدخل اسم المهمة والساعات وحدد اللجنة.",
          "Enter a title, valid hours, and select a committee."
        )
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Authentication required");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        hours,
        status: form.status,
        visibility: form.visibility,
        committee: form.committee,
      };

      const result = editingTask
        ? await supabase
            .from("tasks")
            .update(payload)
            .eq("id", editingTask.id)
            .select()
        : await supabase
            .from("tasks")
            .insert({
              ...payload,
              created_by: user.id,
            })
            .select();

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          t(
            "لم يتم حفظ المهمة. راجع صلاحيات قاعدة البيانات.",
            "Task was not saved. Check database permissions."
          )
        );
      }

      setModalOpen(false);

      setSuccess(
        editingTask
          ? t("تم تعديل المهمة.", "Task updated.")
          : t("تمت إضافة المهمة.", "Task created.")
      );

      await loadTasks();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء حفظ المهمة.", "Failed to save task.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task: Task) {
    if (!canManage) return;

    const confirmed = window.confirm(
      t(
        `هل تريد حذف المهمة "${task.title}"؟`,
        `Delete "${task.title}"?`
      )
    );

    if (!confirmed) return;

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

  function openSubmission(task: Task) {
    setSelectedTask(task);

    const existing = submissions[task.id];

    setAnswerText(existing?.answer_text ?? "");
    setExternalUrl(existing?.external_url ?? "");
    setSelectedFile(null);

    setError("");
    setSuccess("");
    setSubmitModalOpen(true);
  }

  async function handleSubmission(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedTask || submitting || !userId) return;

    if (
      !answerText.trim() &&
      !externalUrl.trim() &&
      !selectedFile &&
      !submissions[selectedTask.id]?.file_path
    ) {
      setError(
        t(
          "اكتب إجابة أو أضف ملفًا أو رابطًا واحدًا على الأقل.",
          "Provide an answer, file, or external link."
        )
      );
      return;
    }

    if (externalUrl.trim()) {
      try {
        const parsed = new URL(externalUrl.trim());

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        setError(
          t("الرابط غير صحيح.", "Please enter a valid URL.")
        );
        return;
      }
    }

    if (selectedFile) {
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setError(
          t(
            "الملفات المسموحة PDF أو JPG أو PNG أو WEBP.",
            "Allowed files: PDF, JPG, PNG, WEBP."
          )
        );
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(
          t(
            "الحد الأقصى لحجم الملف 10 ميجابايت.",
            "Maximum file size is 10 MB."
          )
        );
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const existing = submissions[selectedTask.id];

      if (existing && existing.status !== "pending") {
        throw new Error(
          t(
            "لا يمكن تعديل تسليم تمت مراجعته.",
            "A reviewed submission cannot be edited."
          )
        );
      }

      let filePath = existing?.file_path ?? null;

      if (selectedFile) {
        const extension =
          selectedFile.name.split(".").pop()?.toLowerCase() || "file";

        const path =
          `${userId}/${selectedTask.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("task-submissions")
          .upload(path, selectedFile, {
            upsert: false,
            contentType: selectedFile.type,
          });

        if (uploadError) throw uploadError;

        filePath = path;
      }

      const payload = {
        task_id: selectedTask.id,
        student_id: userId,
        answer_text: answerText.trim() || null,
        external_url: externalUrl.trim() || null,
        file_path: filePath,
        status: "pending" as const,
        updated_at: new Date().toISOString(),
      };

      const result = existing
        ? await supabase
            .from("task_submissions")
            .update({
              answer_text: payload.answer_text,
              external_url: payload.external_url,
              file_path: payload.file_path,
              updated_at: payload.updated_at,
            })
            .eq("id", existing.id)
            .eq("status", "pending")
        : await supabase
            .from("task_submissions")
            .insert(payload);

      if (result.error) throw result.error;

      setSuccess(
        t(
          "تم إرسال المهمة بنجاح.",
          "Your work was submitted successfully."
        )
      );

      setSubmitModalOpen(false);

      await loadSubmissions(userId);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء إرسال المهمة.", "Submission failed.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openSubmissionFile(path: string) {
    const { data, error: fileError } = await supabase.storage
      .from("task-submissions")
      .createSignedUrl(path, 60);

    if (fileError || !data?.signedUrl) {
      setError(
        t(
          "تعذر فتح الملف. راجع صلاحيات التخزين.",
          "Could not open file. Check storage permissions."
        )
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main
      className="space-y-6 p-4 md:p-6"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-500">
            IEEE NDETI
          </p>

          <h1 className="text-2xl font-bold">
            {t("إدارة المهام", "Tasks Management")}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {t(
              "تابع المهام وسلّم أعمالك واحصل على ساعات المشاركة.",
              "Explore tasks, submit your work, and earn participation hours."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            {t("تحديث", "Refresh")}
          </button>

          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
            >
              <Plus size={18} />
              {t("إضافة مهمة", "Add Task")}
            </button>
          )}
        </div>
      </header>

      {role === "student" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          {studentCommittee
            ? t(
                `لجنتك: ${committeeLabel(studentCommittee)}. ستظهر لك المهام الخاصة بلجنتك فقط.`,
                `Your committee: ${committeeLabel(studentCommittee)}. Only your committee tasks are shown.`
              )
            : t(
                "لم يتم ربط حسابك بلجنة بعد. تواصل مع الإدارة.",
                "Your account is not assigned to a committee yet. Contact the administration."
              )}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <ClipboardList size={22} className="text-blue-500" />
          <p className="mt-3 text-sm text-slate-500">
            {t("عدد المهام", "Total Tasks")}
          </p>
          <p className="mt-2 text-3xl font-bold">{filteredTasks.length}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <Clock3 size={22} className="text-purple-500" />
          <p className="mt-3 text-sm text-slate-500">
            {t("إجمالي الساعات المحددة", "Total Task Hours")}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {filteredTasks.reduce(
              (sum, task) => sum + Number(task.hours ?? 0),
              0
            )}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                isArabic ? "right-3" : "left-3"
              }`}
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ابحث عن مهمة...", "Search tasks...")}
              className={`w-full rounded-xl border border-slate-300 bg-white py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 ${
                isArabic ? "pr-10 pl-4" : "pl-10 pr-4"
              }`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">{t("كل الحالات", "All statuses")}</option>
            <option value="draft">{t("مسودة", "Draft")}</option>
            <option value="published">{t("نشطة", "Published")}</option>
            <option value="closed">{t("مغلقة", "Closed")}</option>
          </select>
        </div>

        {error && (
          <p
            className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            role="status"
          >
            {success}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="py-10 text-center text-slate-500 md:col-span-3">
              {t("جارٍ تحميل المهام...", "Loading tasks...")}
            </p>
          ) : filteredTasks.length === 0 ? (
            <p className="py-10 text-center text-slate-500 md:col-span-3">
              {t("لا توجد مهام متاحة.", "No tasks available.")}
            </p>
          ) : (
            filteredTasks.map((task) => {
              const submission = submissions[task.id];

              return (
                <article
                  key={task.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                      <ClipboardList size={21} />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs ${statusStyle(task.status)}`}
                    >
                      {statusLabel(task.status)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-bold">
                    {task.title}
                  </h2>

                  <p className="mt-2 min-h-12 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
                    {task.description ||
                      t("لا يوجد وصف للمهمة.", "No task description.")}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Clock3 size={13} className="mr-1 inline" />
                      {task.hours ?? 0} {t("ساعة", "hours")}
                    </span>

                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {committeeLabel(task.committee)}
                    </span>
                  </div>

                  {role === "student" && (
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                      {submission ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-500">
                              {t("حالة التسليم", "Submission status")}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs ${statusStyle(submission.status)}`}
                            >
                              {statusLabel(submission.status)}
                            </span>
                          </div>

                          {submission.review_note && (
                            <p className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                              {submission.review_note}
                            </p>
                          )}

                          {submission.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => openSubmission(task)}
                              className="w-full rounded-xl border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                            >
                              {t("تعديل التسليم", "Edit submission")}
                            </button>
                          )}
                        </div>
                      ) : task.status === "published" ? (
                        <button
                          type="button"
                          onClick={() => openSubmission(task)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                        >
                          <Send size={16} />
                          {t("تسليم المهمة", "Submit Work")}
                        </button>
                      ) : (
                        <p className="text-center text-sm text-slate-400">
                          {t("التسليم غير متاح.", "Submission unavailable.")}
                        </p>
                      )}
                    </div>
                  )}

                  {canManage && (
                    <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => openEdit(task)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      >
                        <Pencil size={15} />
                        {t("تعديل", "Edit")}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(task)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={15} />
                        {t("حذف", "Delete")}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {modalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                {editingTask
                  ? t("تعديل المهمة", "Edit Task")
                  : t("إضافة مهمة جديدة", "Add New Task")}
              </h2>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm">
                  {t("اسم المهمة", "Task title")}
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  required
                  maxLength={150}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  {t("الوصف", "Description")}
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  {t("اللجنة المسؤولة", "Assigned committee")}
                </label>

                <select
                  value={form.committee}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      committee: event.target.value as Committee | "",
                    })
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">
                    {t("اختر اللجنة", "Select committee")}
                  </option>

                  {COMMITTEES.map((committee) => (
                    <option key={committee} value={committee}>
                      {committeeLabel(committee)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  {t("الساعات المستحقة", "Awarded hours")}
                </label>

                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={form.hours}
                  onChange={(event) =>
                    setForm({ ...form, hours: event.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  {t("الحالة", "Status")}
                </label>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as TaskStatus,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="draft">{t("مسودة", "Draft")}</option>
                  <option value="published">{t("نشطة", "Published")}</option>
                  <option value="closed">{t("مغلقة", "Closed")}</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  {t("الإتاحة", "Visibility")}
                </label>

                <select
                  value={form.visibility}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      visibility: event.target.value as TaskVisibility,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="all">
                    {t("طلاب اللجنة", "Committee students")}
                  </option>

                  <option value="selected_heads">
                    {t("رؤساء اللجان", "Committee heads")}
                  </option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700"
                >
                  {t("إلغاء", "Cancel")}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving
                    ? t("جارٍ الحفظ...", "Saving...")
                    : t("حفظ المهمة", "Save Task")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {submitModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-blue-500">
                  {t("تسليم المهمة", "Task submission")}
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {selectedTask.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                disabled={submitting}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmission} className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText size={17} />
                  {t("الإجابة النصية", "Text answer")}
                </label>

                <textarea
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  rows={5}
                  maxLength={15000}
                  placeholder={t(
                    "اكتب إجابتك أو اشرح ما قمت بتنفيذه...",
                    "Write your answer or describe your work..."
                  )}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Upload size={17} />
                  {t("رفع ملف أو صورة", "Upload file or image")}
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-500 dark:border-slate-700">
                  <Upload size={25} className="mb-2 text-blue-500" />

                  <span className="text-sm font-medium">
                    {selectedFile
                      ? selectedFile.name
                      : t(
                          "اضغط لاختيار PDF أو صورة",
                          "Choose PDF or image"
                        )}
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    PDF, JPG, PNG, WEBP — 10 MB max
                  </span>

                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                    className="hidden"
                  />
                </label>

                {submissions[selectedTask.id]?.file_path && !selectedFile && (
                  <p className="mt-2 text-xs text-slate-500">
                    {t(
                      "يوجد ملف مرفوع بالفعل. اختر ملفًا جديدًا لاستبداله.",
                      "An existing file is attached. Choose another file to replace it."
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <LinkIcon size={17} />
                  {t("رابط خارجي", "External link")}
                </label>

                <input
                  type="url"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                {t(
                  "يمكنك استخدام طريقة واحدة أو أكثر من طرق التسليم. ستتم مراجعة عملك قبل إضافة الساعات.",
                  "You can use one or more submission methods. Your work will be reviewed before hours are awarded."
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700"
                >
                  {t("إلغاء", "Cancel")}
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting
                    ? t("جارٍ الإرسال...", "Submitting...")
                    : t("إرسال التسليم", "Submit work")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
