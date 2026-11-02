
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock3,
  Eye,
  X,
  MessageSquare,
} from "lucide-react";

import { createClient } from "../../../lib/supabase/client";
import { useLanguage } from "../../../components/LanguageProvider";

type SubmissionStatus = "pending" | "approved" | "rejected";

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  answer_text: string | null;
  external_url: string | null;
  file_path: string | null;
  status: SubmissionStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Task = {
  id: string;
  title: string;
  committee: string | null;
  hours: number | null;
};

type Student = {
  id: string;
  full_name: string;
  email: string;
  committee: string | null;
};

type SubmissionRow = {
  submission: Submission;
  task: Task | null;
  student: Student | null;
};

export default function SubmissionsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const canReview = ["head", "secretary", "admin"].includes(role);

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      pending: ["قيد المراجعة", "Pending"],
      approved: ["مقبول", "Approved"],
      rejected: ["مرفوض", "Rejected"],
    };

    const item = labels[status];
    return item ? t(item[0], item[1]) : status;
  };

  const statusStyle = (status: string) => {
    if (status === "approved") {
      return "bg-emerald-500/10 text-emerald-600";
    }

    if (status === "rejected") {
      return "bg-red-500/10 text-red-600";
    }

    return "bg-amber-500/10 text-amber-600";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Get logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          t("سجّل الدخول أولًا.", "Please sign in first.")
        );
      }

      // 2. Check user role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile?.is_active ||
        !["head", "secretary", "admin"].includes(profile.role)
      ) {
        throw new Error(
          t(
            "ليس لديك صلاحية مراجعة التسليمات.",
            "You are not authorized to review submissions."
          )
        );
      }

      setRole(profile.role);

      // 3. Load all submissions
      const { data: submissions, error: submissionsError } =
        await supabase
          .from("task_submissions")
          .select("*")
          .order("created_at", { ascending: false });

      if (submissionsError) {
        throw submissionsError;
      }

      const submissionList = (submissions ?? []) as Submission[];

      if (submissionList.length === 0) {
        setRows([]);
        return;
      }

      // 4. Collect task and student IDs
      const taskIds = [
        ...new Set(submissionList.map((item) => item.task_id)),
      ];

      const studentIds = [
        ...new Set(submissionList.map((item) => item.student_id)),
      ];

      // 5. Load tasks and student profiles
      const [
        { data: tasks, error: tasksError },
        { data: students, error: studentsError },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, committee, hours")
          .in("id", taskIds),

        supabase
          .from("profiles")
          .select("id, full_name, email, committee")
          .in("id", studentIds),
      ]);

      if (tasksError) {
        throw tasksError;
      }

      if (studentsError) {
        throw studentsError;
      }

      // 6. Create strongly typed maps
      const taskList = (tasks ?? []) as unknown as Task[];
      const studentList = (students ?? []) as unknown as Student[];

      const taskMap = new Map<string, Task>(
        taskList.map((task: Task) => [task.id, task])
      );

      const studentMap = new Map<string, Student>(
        studentList.map((student: Student) => [student.id, student])
      );

      // 7. Combine all data
      const nextRows: SubmissionRow[] = submissionList.map(
        (submission: Submission): SubmissionRow => ({
          submission,
          task: taskMap.get(submission.task_id) ?? null,
          student: studentMap.get(submission.student_id) ?? null,
        })
      );

      setRows(nextRows);
    } catch (err) {
      console.error("Load submissions error:", err);

      setError(
        err instanceof Error
          ? err.message
          : t(
              "حدث خطأ أثناء تحميل التسليمات.",
              "Failed to load submissions."
            )
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, isArabic]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter submissions
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        (row.student?.full_name ?? "").toLowerCase().includes(q) ||
        (row.student?.email ?? "").toLowerCase().includes(q) ||
        (row.task?.title ?? "").toLowerCase().includes(q);

      const matchesStatus =
        filter === "all" || row.submission.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, filter]);

  const pendingCount = rows.filter(
    (row) => row.submission.status === "pending"
  ).length;

  const approvedCount = rows.filter(
    (row) => row.submission.status === "approved"
  ).length;

  // Open uploaded file
  async function openFile(path: string) {
    setError("");

    const { data, error: fileError } = await supabase.storage
      .from("task-submissions")
      .createSignedUrl(path, 60);

    if (fileError || !data?.signedUrl) {
      setError(t("تعذر فتح الملف.", "Could not open the file."));
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  // Approve or reject submission
  async function handleReview(decision: "approved" | "rejected") {
    if (!selected || reviewing || !canReview) {
      return;
    }

    if (decision === "rejected" && !reviewNote.trim()) {
      setError(
        t(
          "اكتب سبب الرفض قبل إرسال القرار.",
          "Please provide a rejection reason."
        )
      );
      return;
    }

    const confirmed = window.confirm(
      decision === "approved"
        ? t(
            "هل أنت متأكد من قبول التسليم وإضافة الساعات للطالب؟",
            "Approve this submission and award the task hours?"
          )
        : t(
            "هل أنت متأكد من رفض هذا التسليم؟",
            "Are you sure you want to reject this submission?"
          )
    );

    if (!confirmed) {
      return;
    }

    setReviewing(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "review_task_submission",
        {
          p_submission_id: selected.submission.id,
          p_decision: decision,
          p_note: reviewNote.trim() || null,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!data?.success) {
        throw new Error(
          t("لم يتم تنفيذ المراجعة.", "Review was not completed.")
        );
      }

      setSuccess(
        decision === "approved"
          ? t(
              `تم قبول التسليم وإضافة ${data.hours_awarded} ساعة.`,
              `Submission approved. ${data.hours_awarded} hours awarded.`
            )
          : t("تم رفض التسليم.", "Submission rejected.")
      );

      setSelected(null);
      setReviewNote("");

      await loadData();
    } catch (err) {
      console.error("Review error:", err);

      setError(
        err instanceof Error
          ? err.message
          : t("حدث خطأ أثناء المراجعة.", "Review failed.")
      );
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main
      className="space-y-6 p-4 md:p-6"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-500">
            IEEE NDETI
          </p>

          <h1 className="text-2xl font-bold">
            {t("مراجعة تسليمات المهام", "Task Submissions Review")}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {t(
              "راجع أعمال الطلاب واعتمد الساعات المستحقة.",
              "Review student work and approve earned hours."
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          {t("تحديث", "Refresh")}
        </button>
      </header>

      {/* Statistics */}
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <MessageSquare className="text-blue-500" size={22} />

          <p className="mt-3 text-sm text-slate-500">
            {t("إجمالي التسليمات", "Total submissions")}
          </p>

          <p className="mt-2 text-3xl font-bold">{rows.length}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <Clock3 className="text-amber-500" size={22} />

          <p className="mt-3 text-sm text-slate-500">
            {t("قيد المراجعة", "Pending")}
          </p>

          <p className="mt-2 text-3xl font-bold">{pendingCount}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <CheckCircle2 className="text-emerald-500" size={22} />

          <p className="mt-3 text-sm text-slate-500">
            {t("تم قبولها", "Approved")}
          </p>

          <p className="mt-2 text-3xl font-bold">{approvedCount}</p>
        </article>
      </section>

      {/* Messages */}
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {success}
        </p>
      )}

      {/* Search and filter */}
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
              placeholder={t(
                "ابحث باسم الطالب أو المهمة...",
                "Search student or task..."
              )}
              className={`w-full rounded-xl border border-slate-300 bg-white py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 ${
                isArabic ? "pr-10 pl-4" : "pl-10 pr-4"
              }`}
            />
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">
              {t("كل التسليمات", "All submissions")}
            </option>
            <option value="pending">
              {t("قيد المراجعة", "Pending")}
            </option>
            <option value="approved">
              {t("مقبولة", "Approved")}
            </option>
            <option value="rejected">
              {t("مرفوضة", "Rejected")}
            </option>
          </select>
        </div>

        {/* Submissions table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500 dark:border-slate-700">
                <th className="px-3 py-4">
                  {t("الطالب", "Student")}
                </th>
                <th className="px-3 py-4">
                  {t("المهمة", "Task")}
                </th>
                <th className="px-3 py-4">
                  {t("اللجنة", "Committee")}
                </th>
                <th className="px-3 py-4">
                  {t("الساعات", "Hours")}
                </th>
                <th className="px-3 py-4">
                  {t("الحالة", "Status")}
                </th>
                <th className="px-3 py-4">
                  {t("الإجراء", "Action")}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-slate-500"
                  >
                    {t(
                      "جارٍ تحميل التسليمات...",
                      "Loading submissions..."
                    )}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-slate-500"
                  >
                    {t("لا توجد تسليمات.", "No submissions found.")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.submission.id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold">
                        {row.student?.full_name ??
                          t("طالب", "Student")}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {row.student?.email ??
                          row.submission.student_id}
                      </p>
                    </td>

                    <td className="px-3 py-4 font-medium">
                      {row.task?.title ??
                        t("مهمة محذوفة", "Deleted task")}
                    </td>

                    <td className="px-3 py-4">
                      {row.task?.committee ?? "—"}
                    </td>

                    <td className="px-3 py-4">
                      {row.task?.hours ?? 0}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${statusStyle(
                          row.submission.status
                        )}`}
                      >
                        {statusLabel(row.submission.status)}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(row);
                          setReviewNote(
                            row.submission.review_note ?? ""
                          );
                          setError("");
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        <Eye size={14} />
                        {t("عرض ومراجعة", "View & Review")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-blue-500">
                  {t("تفاصيل التسليم", "Submission details")}
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {selected.task?.title ?? t("مهمة", "Task")}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Student information */}
              <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                <p className="text-xs text-slate-500">
                  {t("الطالب", "Student")}
                </p>

                <p className="mt-1 font-semibold">
                  {selected.student?.full_name ?? "—"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {selected.student?.email ?? ""}
                </p>
              </div>

              {/* Text answer */}
              <div>
                <h3 className="mb-2 font-semibold">
                  {t("الإجابة النصية", "Text answer")}
                </h3>

                <div className="min-h-20 whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                  {selected.submission.answer_text ||
                    t(
                      "لم يرسل الطالب إجابة نصية.",
                      "No text answer submitted."
                    )}
                </div>
              </div>

              {/* Uploaded file */}
              {selected.submission.file_path && (
                <button
                  type="button"
                  onClick={() =>
                    void openFile(selected.submission.file_path!)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                  <FileText size={18} />
                  {t("فتح الملف المرفوع", "Open uploaded file")}
                  <ExternalLink size={15} />
                </button>
              )}

              {/* External link */}
              {selected.submission.external_url && (
                <a
                  href={selected.submission.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                  <ExternalLink size={17} />
                  {t("فتح الرابط الخارجي", "Open external link")}
                </a>
              )}

              {/* Review note */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  {t("ملاحظات المراجعة", "Review notes")}
                </label>

                <textarea
                  value={reviewNote}
                  onChange={(event) =>
                    setReviewNote(event.target.value)
                  }
                  rows={3}
                  disabled={selected.submission.status !== "pending"}
                  placeholder={t(
                    "اكتب ملاحظاتك أو سبب الرفض...",
                    "Write feedback or rejection reason..."
                  )}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              {/* Review actions */}
              {selected.submission.status === "pending" ? (
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={() => void handleReview("rejected")}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    <XCircle size={17} />
                    {reviewing
                      ? t("جارٍ التنفيذ...", "Processing...")
                      : t("رفض التسليم", "Reject")}
                  </button>

                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={() => void handleReview("approved")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <CheckCircle2 size={17} />
                    {reviewing
                      ? t("جارٍ التنفيذ...", "Processing...")
                      : t(
                          "قبول وإضافة الساعات",
                          "Approve & Award Hours"
                        )}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800">
                  {t(
                    "تمت مراجعة هذا التسليم بالفعل.",
                    "This submission has already been reviewed."
                  )}

                  <p className="mt-1">
                    {t("الحالة:", "Status:")}{" "}
                    {statusLabel(selected.submission.status)}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
