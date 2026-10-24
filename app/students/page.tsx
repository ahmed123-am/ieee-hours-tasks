"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Users,
  Clock3,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Mail,
  UsersRound,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Student = {
  id: string;
  full_name: string;
  email: string;
  committee: string | null;
  total_hours: number | string | null;
  created_at: string;
};

type StudentForm = {
  full_name: string;
  email: string;
  committee: string;
};

const emptyForm: StudentForm = {
  full_name: "",
  email: "",
  committee: "",
};

export default function StudentsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const supabase = useMemo(() => createClient(), []);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [canManage, setCanManage] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setStudents([]);
      setError(
        t(
          "جلسة تسجيل الدخول غير موجودة أو انتهت. سجّل الدخول مرة أخرى.",
          "Your session is missing or expired. Please sign in again."
        )
      );
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("students")
      .select("id, full_name, email, committee, total_hours, created_at")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Students load error:", queryError);
      setError(queryError.message);
      setStudents([]);
    } else {
      setStudents((data ?? []) as Student[]);
    }

    setLoading(false);
  }, [supabase, isArabic]);

  const checkAccess = useCallback(async () => {
    setCheckingAccess(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Student page auth error:", authError);
      setCanManage(false);
      setCheckingAccess(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active, role_approved, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    // Diagnostic information appears in the browser DevTools Console.
    console.info("STUDENTS ACCESS CHECK", {
      userId: user.id,
      email: user.email,
      profile,
      profileError: profileError?.message ?? null,
    });

    const allowed =
      !profileError &&
      profile?.is_active === true &&
      (
        ["admin", "secretary"].includes(profile.role) ||
        (
          profile.role === "board" &&
          profile.role_approved === true &&
          profile.approval_status === "approved"
        )
      );

    setCanManage(allowed);
    setCheckingAccess(false);

    if (profileError) {
      console.error("Profile lookup failed:", profileError);
      setError(
        t(
          "تعذر قراءة صلاحيات الحساب من جدول profiles: ",
          "Could not read account permissions from profiles: "
        ) + profileError.message
      );
    } else if (!profile) {
      setError(
        t(
          "لا يوجد ملف صلاحيات لهذا الحساب في profiles.",
          "No permissions profile exists for this account."
        )
      );
    } else if (!allowed) {
      setError(
        t(
          "الحساب غير نشط أو لا يملك صلاحية إدارة الطلاب.",
          "This account is inactive or cannot manage students."
        )
      );
    }
  }, [supabase, isArabic]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      await checkAccess();
      if (!cancelled) {
        await loadStudents();
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [checkAccess, loadStudents]);

  const committees = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => student.committee?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !normalizedSearch ||
        student.full_name.toLowerCase().includes(normalizedSearch) ||
        student.email.toLowerCase().includes(normalizedSearch) ||
        (student.committee ?? "").toLowerCase().includes(normalizedSearch);

      const matchesCommittee =
        committeeFilter === "all" || student.committee === committeeFilter;

      return matchesSearch && matchesCommittee;
    });
  }, [students, search, committeeFilter]);

  const totalHours = students.reduce(
    (sum, student) => sum + Number(student.total_hours ?? 0),
    0
  );

  function openAddModal() {
    setEditingStudent(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(student: Student) {
    setEditingStudent(student);
    setForm({
      full_name: student.full_name,
      email: student.email,
      committee: student.committee ?? "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(
        t(
          "جلسة تسجيل الدخول غير صالحة. سجّل الدخول مرة أخرى.",
          "Your login session is invalid. Please sign in again."
        )
      );
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active, role_approved, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    console.info("STUDENT SAVE DIAGNOSTICS", {
      userId: user.id,
      email: user.email,
      profile,
      profileError: profileError?.message ?? null,
    });

    const canSaveStudent =
      profile?.is_active === true &&
      (
        ["admin", "secretary"].includes(profile.role) ||
        (
          profile.role === "board" &&
          profile.role_approved === true &&
          profile.approval_status === "approved"
        )
      );

    if (profileError || !profile || !canSaveStudent) {
      setError(
        profileError
          ? `${t("تعذر التحقق من الصلاحيات: ", "Could not verify permissions: ")}${profileError.message}`
          : t(
              "هذا الحساب غير مصرح له بإضافة أو تعديل الطلاب.",
              "This account is not authorized to add or edit students."
            )
      );
      setCanManage(false);
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      committee: form.committee.trim() || null,
    };

    if (!payload.full_name || !payload.email) {
      setError(t("الاسم والبريد الإلكتروني مطلوبان.", "Name and email are required."));
      setSaving(false);
      return;
    }

    const result = editingStudent
      ? await supabase
          .from("students")
          .update(payload)
          .eq("id", editingStudent.id)
          .select("id")
      : await supabase.from("students").insert(payload).select("id");

    if (result.error) {
      console.error("Student save error:", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        userId: user.id,
        profile,
      });

      setError(
        `${result.error.message}${
          result.error.code ? ` (code: ${result.error.code})` : ""
        }`
      );
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setForm(emptyForm);
    setSuccess(
      editingStudent
        ? t("تم تحديث بيانات الطالب بنجاح.", "Student updated successfully.")
        : t("تمت إضافة الطالب بنجاح.", "Student added successfully.")
    );

    await loadStudents();
    setSaving(false);
  }

  async function handleDelete(student: Student) {
    if (!canManage) return;

    const confirmed = window.confirm(
      t(
        `هل أنت متأكد من حذف الطالب ${student.full_name}؟`,
        `Delete student ${student.full_name}?`
      )
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", student.id);

    if (deleteError) {
      console.error("Student delete error:", deleteError);
      setError(deleteError.message);
      return;
    }

    setSuccess(t("تم حذف الطالب.", "Student deleted."));
    await loadStudents();
  }

  return (
    <main className="space-y-6 p-4 md:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-400">IEEE NDETI</p>
          <h1 className="text-2xl font-bold">
            {t("إدارة الطلاب", "Students Management")}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t(
              "عرض بيانات الطلاب وساعات المشاركة.",
              "Manage student records and participation hours."
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          disabled={!canManage || checkingAccess}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          {t("إضافة طالب", "Add Student")}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {t("إجمالي الطلاب", "Total Students")}
            </span>
            <Users className="text-blue-400" size={22} />
          </div>
          <p className="mt-4 text-3xl font-bold">{students.length}</p>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {t("إجمالي ساعات المشاركة", "Total Participation Hours")}
            </span>
            <Clock3 className="text-purple-400" size={22} />
          </div>
          <p className="mt-4 text-3xl font-bold">
            {totalHours.toLocaleString(isArabic ? "ar-EG" : "en-US")}
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
              placeholder={t(
                "ابحث بالاسم أو البريد أو اللجنة...",
                "Search name, email, or committee..."
              )}
              className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-3 text-sm outline-none focus:border-blue-500 ${
                isArabic ? "pr-10 pl-4" : "pl-10 pr-4"
              }`}
            />
          </div>

          <select
            value={committeeFilter}
            onChange={(event) => setCommitteeFilter(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">{t("كل اللجان", "All Committees")}</option>
            {committees.map((committee) => (
              <option value={committee} key={committee}>
                {committee}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadStudents()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("تحديث", "Refresh")}
          </button>
        </div>

        {error && (
          <div
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
            role="status"
          >
            {success}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th className="px-3 py-4 font-medium">{t("الطالب", "Student")}</th>
                <th className="px-3 py-4 font-medium">{t("اللجنة", "Committee")}</th>
                <th className="px-3 py-4 font-medium">{t("الساعات", "Hours")}</th>
                <th className="px-3 py-4 font-medium">{t("تاريخ التسجيل", "Registered")}</th>
                {canManage && (
                  <th className="px-3 py-4 font-medium">{t("الإجراءات", "Actions")}</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    {t("جارٍ تحميل الطلاب...", "Loading students...")}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    {t("لا يوجد طلاب مطابقون للبحث.", "No matching students found.")}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="transition hover:bg-slate-800/50">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                          <UsersRound size={19} />
                        </div>
                        <div>
                          <p className="font-semibold">{student.full_name}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Mail size={12} />
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs">
                        {student.committee || t("غير محدد", "Not assigned")}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {Number(student.total_hours ?? 0).toLocaleString(
                        isArabic ? "ar-EG" : "en-US"
                      )}
                    </td>
                    <td className="px-3 py-4 text-slate-400">
                      {student.created_at
                        ? new Date(student.created_at).toLocaleDateString(
                            isArabic ? "ar-EG" : "en-US"
                          )
                        : "—"}
                    </td>
                    {canManage && (
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(student)}
                            title={t("تعديل", "Edit")}
                            className="rounded-lg border border-slate-700 p-2 text-blue-300 hover:bg-blue-500/10"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(student)}
                            title={t("حذف", "Delete")}
                            className="rounded-lg border border-slate-700 p-2 text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          {t("عدد النتائج:", "Results:")} {filteredStudents.length}
        </p>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 id="student-modal-title" className="text-xl font-bold">
                {editingStudent
                  ? t("تعديل بيانات الطالب", "Edit Student")
                  : t("إضافة طالب جديد", "Add New Student")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                aria-label={t("إغلاق", "Close")}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="student-name" className="mb-2 block text-sm text-slate-300">
                  {t("الاسم الكامل", "Full Name")}
                </label>
                <input
                  id="student-name"
                  value={form.full_name}
                  onChange={(event) =>
                    setForm({ ...form, full_name: event.target.value })
                  }
                  required
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="student-email" className="mb-2 block text-sm text-slate-300">
                  {t("البريد الإلكتروني", "Email")}
                </label>
                <input
                  id="student-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  required
                  maxLength={254}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="student-committee"
                  className="mb-2 block text-sm text-slate-300"
                >
                  {t("اللجنة", "Committee")}
                </label>
                <input
                  id="student-committee"
                  value={form.committee}
                  onChange={(event) =>
                    setForm({ ...form, committee: event.target.value })
                  }
                  maxLength={100}
                  placeholder={t("مثال: Web Development", "e.g. Web Development")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <p
                  className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {t("إلغاء", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !canManage || checkingAccess}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving
                    ? t("جارٍ الحفظ...", "Saving...")
                    : editingStudent
                      ? t("حفظ التعديلات", "Save Changes")
                      : t("إضافة الطالب", "Add Student")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
