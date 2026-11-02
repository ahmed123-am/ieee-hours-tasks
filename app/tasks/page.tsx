
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
  Send,
  Upload,
  ExternalLink,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Role =
  | "admin"
  | "secretary"
  | "board"
  | "head"
  | "volunteer"
  | "student";

type TaskStatus = "draft" | "published" | "closed";
type TaskVisibility = "all" | "selected_heads";
type SubmissionStatus = "pending" | "approved" | "rejected";

type Committee =
  | "CORE"
  | "HR"
  | "PR"
  | "LOGISTICS"
  | "PROGRAMMING"
  | "MEDIA";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  visibility: TaskVisibility;
  committee: Committee | null;
  hours: number | null;
  created_at: string;
  created_by?: string;
};

type TaskForm = {
  title: string;
  description: string;
  hours: string;
  status: TaskStatus;
  visibility: TaskVisibility;
  committee: Committee | "";
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

const committees: Committee[] = [
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

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function TasksPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<
    Record<string, Submission>
  >({});

  const [role, setRole] = useState<Role | null>(null);
  const [studentCommittee, setStudentCommittee] =
    useState<Committee | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);

  const [submissionTask, setSubmissionTask] = useState<Task | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [existingSubmission, setExistingSubmission] =
    useState<Submission | null>(null);

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const canManage = role === "admin" || role === "secretary";
  const canSubmit = role !== null;

  const committeeLabel = (committee: string | null) =>
    committee ?? t("غير محددة", "Not specified");

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      draft: ["مسودة", "Draft"],
      published: ["نشطة", "Published"],
      closed: ["مغلقة", "Closed"],
    };
    const label = labels[status];
    return label ? t(label[0], label[1]) : status;
  };

  const submissionStatusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      pending: ["قيد المراجعة", "Pending review"],
      approved: ["مقبول", "Approved"],
      rejected: ["مرفوض", "Rejected"],
    };
    const label = labels[status];
    return label ? t(label[0], label[1]) : status;
  };

  const submissionStatusStyle = (status: string) => {
    if (status === "approved") {
      return "bg-emerald-500/10 text-emerald-400";
    }
    if (status === "rejected") {
      return "bg-red-500/10 text-red-400";
    }
    return "bg-amber-500/10 text-amber-400";
  };

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

  const loadStudentSubmissions = useCallback(
    async (userId: string) => {
      const { data, error: submissionError } = await supabase
        .from("task_submissions")
        .select("*")
        .eq("student_id", userId);

      if (submissionError) {
        console.error("Load submissions error:", submissionError);
        setError(submissionError.message);
        return;
      }

      const mapped: Record<string, Submission> = {};

      for (const item of (data ?? []) as Submission[]) {
        mapped[item.task_id] = item;
      }

      setSubmissions(mapped);
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        if (!cancelled) {
          setError(t("سجّل الدخول أولًا.", "Please sign in first."));
          setLoading(false);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active, committee")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile || !profile.is_active) {
        if (!cancelled) {
          setError(
            t(
              "لا يمكن تحميل بيانات حسابك أو أن الحساب غير مفعل.",
              "Could not load your profile or your account is inactive."
            )
          );
          setLoading(false);
        }
        return;
      }

      const currentRole = profile.role as Role;

      if (!cancelled) setRole(currentRole);

      let committee = profile.committee ?? null;

      // Students may have their committee stored only in the students table.
      if (currentRole === "student" && !committee) {
        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("committee")
          .ilike("email", user.email ?? "")
          .maybeSingle();

        if (studentError) {
          console.error("Student committee error:", studentError);
        }
        committee = student?.committee ?? null;
      }

      if (!cancelled) {
        setStudentCommittee(committee as Committee | null);
      }

      // Every active account loads its own submissions, not students only.
      await loadStudentSubmissions(user.id);

      if (!cancelled) await loadTasks();
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [supabase, loadTasks, loadStudentSubmissions, isArabic]);

  const visibleTasks = useMemo(() => {
    let result = tasks;

    // Every signed-in role can solve published tasks available to participants.
    // Drafts/closed tasks remain visible to task managers only.
    if (!canManage) {
      result = result.filter(
        (task) => task.status === "published" && task.visibility === "all"
      );
    }

    const q = search.trim().toLowerCase();

    return result.filter((task) => {
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        (task.committee ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    tasks,
    canManage,
    role,
    studentCommittee,
    search,
    statusFilter,
  ]);

  function openAdd() {
    setEditingTask(null);
    setForm({
      ...emptyForm,
      committee: studentCommittee ?? "",
    });
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

  async function handleTaskSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;

    const hours = Number(form.hours);

    if (!form.title.trim() || !Number.isFinite(hours) || hours <= 0) {
      setError(
        t(
          "أدخل اسم المهمة وعدد ساعات صحيحًا.",
          "Enter a title and valid hours."
        )
      );
      return;
    }

    if (!form.committee) {
      setError(t("اختر اللجنة الخاصة بالمهمة.", "Select the task committee."));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(t("سجّل الدخول مرة أخرى.", "Please sign in again."));
      }

      const taskData = {
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
            .update(taskData)
            .eq("id", editingTask.id)
            .select()
        : await supabase
            .from("tasks")
            .insert({ ...taskData, created_by: user.id })
            .select();

      if (result.error) throw new Error(result.error.message);

      if (!result.data || result.data.length === 0) {
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
          ? t("تم تعديل المهمة بنجاح.", "Task updated successfully.")
          : t("تمت إضافة المهمة بنجاح.", "Task added successfully.")
      );

      await loadTasks();
    } catch (err) {
      console.error("Save task error:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء الحفظ.", "An error occurred while saving.")
      );
    } finally {
      setSaving(false);
    }
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

  function openSubmission(task: Task) {
    const previous = submissions[task.id] ?? null;

    setSubmissionTask(task);
    setExistingSubmission(previous);
    setAnswerText(previous?.answer_text ?? "");
    setExternalUrl(previous?.external_url ?? "");
    setSubmissionFile(null);
    setError("");
    setSuccess("");
  }

  function closeSubmission() {
    if (submitting) return;
    setSubmissionTask(null);
    setExistingSubmission(null);
    setAnswerText("");
    setExternalUrl("");
    setSubmissionFile(null);
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submissionTask || !canSubmit || submitting) return;

    if (
      existingSubmission &&
      existingSubmission.status !== "pending"
    ) {
      setError(
        t(
          "لا يمكن تعديل تسليم تمت مراجعته بالفعل.",
          "A reviewed submission cannot be edited."
        )
      );
      return;
    }

    if (!answerText.trim() && !externalUrl.trim() && !submissionFile) {
      setError(
        t(
          "أضف إجابة نصية أو ملفًا أو رابطًا واحدًا على الأقل.",
          "Add text, a file, or an external link."
        )
      );
      return;
    }

    if (externalUrl.trim()) {
      try {
        const parsedUrl = new URL(externalUrl.trim());
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        setError(t("الرابط الذي أدخلته غير صحيح.", "Please enter a valid URL."));
        return;
      }
    }

    if (submissionFile) {
      if (!ALLOWED_TYPES.includes(submissionFile.type)) {
        setError(
          t(
            "نوع الملف غير مدعوم. ارفع PDF أو صورة JPG أو PNG أو WEBP.",
            "Unsupported file. Upload PDF, JPG, PNG, or WEBP."
          )
        );
        return;
      }

      if (submissionFile.size > MAX_FILE_SIZE) {
        setError(
          t("حجم الملف أكبر من 10 ميجابايت.", "File size exceeds 10 MB.")
        );
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          t("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", "Please sign in again.")
        );
      }

      let filePath = existingSubmission?.file_path ?? null;

      if (submissionFile) {
        const extension =
          submissionFile.name.split(".").pop()?.toLowerCase() || "file";

        const newPath = `${user.id}/${submissionTask.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("task-submissions")
          .upload(newPath, submissionFile, {
            upsert: false,
            contentType: submissionFile.type,
          });

        if (uploadError) {
          throw new Error(
            `${t("فشل رفع الملف:", "File upload failed:")} ${uploadError.message}`
          );
        }

        filePath = newPath;
      }

      const payload = {
        task_id: submissionTask.id,
        student_id: user.id,
        answer_text: answerText.trim() || null,
        external_url: externalUrl.trim() || null,
        file_path: filePath,
      };

      if (existingSubmission) {
        const { error: updateError } = await supabase
          .from("task_submissions")
          .update(payload)
          .eq("id", existingSubmission.id)
          .eq("status", "pending");

        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from("task_submissions")
          .insert({ ...payload, status: "pending" });

        if (insertError) throw new Error(insertError.message);
      }

      await loadStudentSubmissions(user.id);

      setSuccess(t("تم إرسال المهمة بنجاح.", "Task submitted successfully."));
      setSubmissionTask(null);
      setExistingSubmission(null);
      setAnswerText("");
      setExternalUrl("");
      setSubmissionFile(null);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء إرسال المهمة.", "An error occurred while submitting.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openSubmittedFile(filePath: string) {
    const { data, error: fileError } = await supabase.storage
      .from("task-submissions")
      .createSignedUrl(filePath, 60 * 10);

    if (fileError || !data?.signedUrl) {
      setError(
        fileError?.message ?? t("تعذر فتح الملف.", "Could not open the file.")
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
          <p className="mb-1 text-sm font-medium text-blue-400">
            IEEE NDETI
          </p>

          <h1 className="text-2xl font-bold">
            {canManage
              ? t("إدارة المهام", "Tasks Management")
              : t("المهام", "Tasks")}
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            {canSubmit
              ? t(
                  "تابع مهام لجنتك وسلّم أعمالك للحصول على ساعات المشاركة.",
                  "View your committee tasks and submit your work to earn hours."
                )
              : t(
                  "تابع المهام وساعات المشاركة.",
                  "Manage tasks and participation hours."
                )}
          </p>

          {canSubmit && studentCommittee && (
            <p className="mt-2 text-sm text-blue-400">
              {t("لجنتك:", "Your committee:")} {studentCommittee}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadTasks()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <ClipboardList size={22} className="text-blue-400" />
          <p className="mt-3 text-sm text-slate-400">
            {t("عدد المهام", "Number of tasks")}
          </p>
          <p className="mt-2 text-3xl font-bold">{visibleTasks.length}</p>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <Clock3 size={22} className="text-purple-400" />
          <p className="mt-3 text-sm text-slate-400">
            {t("إجمالي الساعات المحددة", "Total assigned hours")}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {visibleTasks.reduce(
              (sum, task) => sum + Number(task.hours ?? 0),
              0
            )}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
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
              className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-3 outline-none focus:border-blue-500 ${
                isArabic ? "pr-10 pl-4" : "pl-10 pr-4"
              }`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          >
            <option value="all">{t("كل الحالات", "All statuses")}</option>
            <option value="draft">{t("مسودة", "Draft")}</option>
            <option value="published">{t("نشطة", "Published")}</option>
            <option value="closed">{t("مغلقة", "Closed")}</option>
          </select>
        </div>

        {error && (
          <p
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
            role="status"
          >
            {success}
          </p>
        )}

        {canSubmit && !studentCommittee && !loading && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            {t(
              "لم يتم العثور على لجنتك في بيانات الطلاب. تواصل مع السكرتير لتحديث بياناتك.",
              "Your committee was not found. Contact the secretary to update your student record."
            )}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="py-10 text-center text-slate-400">
              {t("جارٍ تحميل المهام...", "Loading tasks...")}
            </p>
          ) : visibleTasks.length === 0 ? (
            <p className="py-10 text-center text-slate-400 md:col-span-2 xl:col-span-3">
              {t("لا توجد مهام متاحة حاليًا.", "No tasks available right now.")}
            </p>
          ) : (
            visibleTasks.map((task) => {
              const submission = submissions[task.id];

              return (
                <article
                  key={task.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                      <ClipboardList size={21} />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        task.status === "published"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : task.status === "draft"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {statusLabel(task.status)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-bold">{task.title}</h2>

                  <p className="mt-2 min-h-12 whitespace-pre-wrap text-sm text-slate-400">
                    {task.description ||
                      t("لا يوجد وصف للمهمة.", "No task description.")}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-lg bg-slate-800 px-3 py-2">
                      <Clock3 size={13} className="mr-1 inline" />
                      {task.hours ?? 0} {t("ساعة", "hours")}
                    </span>

                    <span className="rounded-lg bg-slate-800 px-3 py-2">
                      {committeeLabel(task.committee)}
                    </span>
                  </div>

                  {canSubmit && submission && (
                    <div className="mt-4 rounded-xl border border-slate-800 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-400">
                          {t("حالة التسليم", "Submission status")}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${submissionStatusStyle(
                            submission.status
                          )}`}
                        >
                          {submissionStatusLabel(submission.status)}
                        </span>
                      </div>

                      {submission.review_note && (
                        <p className="mt-3 text-sm text-slate-300">
                          {t("ملاحظة المراجع:", "Reviewer note:")}{" "}
                          {submission.review_note}
                        </p>
                      )}

                      {submission.file_path && (
                        <button
                          type="button"
                          onClick={() =>
                            void openSubmittedFile(submission.file_path!)
                          }
                          className="mt-3 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                        >
                          <Eye size={15} />
                          {t("عرض الملف المرسل", "View submitted file")}
                        </button>
                      )}
                    </div>
                  )}

                  {canSubmit && (
                    <div className="mt-5 border-t border-slate-800 pt-4">
                      {submission?.status === "approved" ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                          <CheckCircle2 size={17} />
                          {t(
                            "تم قبول المهمة وإضافة الساعات.",
                            "Task approved and hours awarded."
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openSubmission(task)}
                          disabled={task.status !== "published"}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send size={17} />
                          {submission
                            ? t("عرض / تعديل التسليم", "View / Edit submission")
                            : t("تسليم المهمة", "Submit task")}
                        </button>
                      )}
                    </div>
                  )}

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

                  {role === "head" && (
                    <div className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
                      {t(
                        "يمكنك مراجعة تسليمات الطلاب من صفحة مراجعة التسليمات.",
                        "You can review student submissions from the Submissions page."
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Add/Edit task modal */}
      {modalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 id="task-modal-title" className="text-xl font-bold">
                {editingTask
                  ? t("تعديل المهمة", "Edit Task")
                  : t("إضافة مهمة جديدة", "Add New Task")}
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

            <form onSubmit={handleTaskSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  {t("اسم المهمة", "Task title")}
                </label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  required
                  maxLength={150}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  {t("الوصف", "Description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  {t("اللجنة", "Committee")}
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="">
                    {t("اختر اللجنة", "Select committee")}
                  </option>
                  {committees.map((committee) => (
                    <option key={committee} value={committee}>
                      {committee}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="draft">{t("مسودة", "Draft")}</option>
                  <option value="published">{t("نشطة", "Published")}</option>
                  <option value="closed">{t("مغلقة", "Closed")}</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="all">
                    {t("متاحة للطلاب", "Available to students")}
                  </option>
                  <option value="selected_heads">
                    {t("مخصصة لرؤساء اللجان", "For committee heads")}
                  </option>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
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
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving
                    ? t("جارٍ الحفظ...", "Saving...")
                    : t("حفظ", "Save")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Student submission modal */}
      {submissionTask && canSubmit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-modal-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-blue-400">
                  {t("تسليم المهمة", "Task submission")}
                </p>
                <h2
                  id="submission-modal-title"
                  className="mt-1 text-xl font-bold"
                >
                  {submissionTask.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {t("الساعات:", "Hours:")} {submissionTask.hours ?? 0}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSubmission}
                disabled={submitting}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {existingSubmission &&
              existingSubmission.status !== "pending" && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  {t(
                    "هذا التسليم تمت مراجعته ولا يمكن تعديله.",
                    "This submission has already been reviewed and cannot be edited."
                  )}
                </div>
              )}

            <form onSubmit={handleSubmission} className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <FileText size={17} />
                  {t("الإجابة النصية", "Text answer")}
                </label>
                <textarea
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  rows={5}
                  disabled={
                    submitting ||
                    (!!existingSubmission &&
                      existingSubmission.status !== "pending")
                  }
                  placeholder={t(
                    "اكتب إجابتك أو اشرح ما أنجزته...",
                    "Write your answer or describe what you completed..."
                  )}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Upload size={17} />
                  {t("رفع ملف PDF أو صورة", "Upload PDF or image")}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  disabled={
                    submitting ||
                    (!!existingSubmission &&
                      existingSubmission.status !== "pending")
                  }
                  onChange={(event) =>
                    setSubmissionFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {t(
                    "الحد الأقصى 10 ميجابايت. الأنواع المدعومة: PDF و JPG و PNG و WEBP.",
                    "Maximum 10 MB. Supported: PDF, JPG, PNG, WEBP."
                  )}
                </p>
                {submissionFile && (
                  <p className="mt-2 text-sm text-emerald-400">
                    {t("الملف المختار:", "Selected file:")}{" "}
                    {submissionFile.name}
                  </p>
                )}
                {existingSubmission?.file_path && !submissionFile && (
                  <p className="mt-2 text-sm text-slate-400">
                    {t(
                      "يوجد ملف مرفق بالفعل. اختر ملفًا جديدًا لاستبداله.",
                      "A file is already attached. Choose a new file to replace it."
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <ExternalLink size={17} />
                  {t("رابط خارجي", "External link")}
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  disabled={
                    submitting ||
                    (!!existingSubmission &&
                      existingSubmission.status !== "pending")
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              {existingSubmission?.review_note && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                  <p className="text-sm font-semibold text-slate-300">
                    {t("ملاحظة المراجع", "Reviewer note")}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {existingSubmission.review_note}
                  </p>
                </div>
              )}

              {error && (
                <p
                  className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={closeSubmission}
                  disabled={submitting}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
                >
                  {t("إغلاق", "Close")}
                </button>

                {(!existingSubmission ||
                  existingSubmission.status === "pending") && (
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
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
