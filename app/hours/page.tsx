
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Search,
  RefreshCw,
  Trophy,
  Users,
  Download,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Student = {
  id: string;
  full_name: string;
  email: string;
  committee: string | null;
  total_hours: number | string | null;
};

type HoursStats = {
  total_students: number;
  total_hours: number;
  average_hours: number;
};

const initialStats: HoursStats = {
  total_students: 0,
  total_hours: 0,
  average_hours: 0,
};

export default function HoursPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const supabase = useMemo(() => createClient(), []);

  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<HoursStats>(initialStats);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableError, setTableError] = useState("");
  const [search, setSearch] = useState("");

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    setTableError("");

    try {
      // الإحصائيات العامة تأتي من RPC ولا تحتاج قراءة جدول الطلاب مباشرة.
      const statsResult = await supabase.rpc("get_dashboard_stats");

      if (statsResult.error) {
        throw statsResult.error;
      }

      const data = statsResult.data;

      if (!data) {
        throw new Error("No statistics returned from Supabase.");
      }

      setStats({
        total_students: Number(data.total_students ?? 0),
        total_hours: Number(data.total_hours ?? 0),
        average_hours: Number(data.average_hours ?? 0),
      });

      // بيانات الطلاب التفصيلية تظل خاضعة لصلاحيات RLS الحالية.
      const studentsResult = await supabase
        .from("students")
        .select("id, full_name, email, committee, total_hours")
        .order("total_hours", { ascending: false });

      if (studentsResult.error) {
        console.error("Students table access:", studentsResult.error);
        setStudents([]);
        setTableError(studentsResult.error.message);
      } else {
        setStudents((studentsResult.data ?? []) as Student[]);
      }
    } catch (err) {
      console.error("Hours page statistics error:", err);

      setError(
        err instanceof Error
          ? err.message
          : t("تعذر تحميل الإحصائيات.", "Could not load statistics.")
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, isArabic]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter(
      (student) =>
        !q ||
        student.full_name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        (student.committee ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // نستخدم الإجمالي القادم من Supabase في الحسابات العامة.
  const totalHours = stats.total_hours;
  const averageHours = stats.average_hours;

  function exportCSV() {
    const rows = [
      [
        t("الاسم", "Name"),
        t("البريد الإلكتروني", "Email"),
        t("اللجنة", "Committee"),
        t("الساعات", "Hours"),
      ],
      ...filteredStudents.map((student) => [
        student.full_name,
        student.email,
        student.committee ?? "",
        String(Number(student.total_hours ?? 0)),
      ]),
    ];

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
        .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ieee-student-hours.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main
      className="space-y-6 p-4 md:p-6"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
            IEEE NDETI
          </p>

          <h1 className="text-2xl font-bold">
            {t("الساعات والتقارير", "Hours & Reports")}
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t(
              "متابعة ساعات المشاركة وترتيب الطلاب.",
              "Track participation hours and student rankings."
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCSV}
            disabled={loading || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={17} />
            {t("تصدير CSV", "Export CSV")}
          </button>

          <button
            type="button"
            onClick={() => void loadStudents()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            {t("تحديث", "Refresh")}
          </button>
        </div>
      </header>

      {error && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          <p className="font-semibold">
            {t("خطأ في تحميل الإحصائيات:", "Statistics error:")}
          </p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900/70 dark:shadow-none p-5">
          <Users className="text-blue-600 dark:text-blue-400" size={23} />

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t("عدد الطلاب", "Total Students")}
          </p>

          <p className="mt-2 text-3xl font-bold">
            {loading
              ? "—"
              : stats.total_students.toLocaleString(
                  isArabic ? "ar-EG" : "en-US"
                )}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900/70 dark:shadow-none p-5">
          <Clock3
            className="text-purple-700 dark:text-purple-400"
            size={23}
          />

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t("إجمالي الساعات", "Total Hours")}
          </p>

          <p className="mt-2 text-3xl font-bold">
            {loading
              ? "—"
              : totalHours.toLocaleString(
                  isArabic ? "ar-EG" : "en-US"
                )}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900/70 dark:shadow-none p-5">
          <Trophy
            className="text-amber-700 dark:text-amber-400"
            size={23}
          />

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {t("متوسط ساعات الطالب", "Average Hours per Student")}
          </p>

          <p className="mt-2 text-3xl font-bold">
            {loading
              ? "—"
              : averageHours.toLocaleString(
                  isArabic ? "ar-EG" : "en-US",
                  { maximumFractionDigits: 2 }
                )}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-sm dark:bg-slate-900/70 dark:shadow-none p-4">
        <div className="relative">
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
              "ابحث بالاسم أو الإيميل أو اللجنة...",
              "Search by name, email, or committee..."
            )}
            className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent py-3 outline-none focus:border-blue-500 ${
              isArabic ? "pr-10 pl-4" : "pl-10 pr-4"
            }`}
          />
        </div>

        {tableError && (
          <p
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
            role="status"
          >
            {t(
              "الإحصائيات العامة ظاهرة، لكن عرض تفاصيل الطلاب غير متاح لهذا الحساب بسبب الصلاحيات.",
              "General statistics are available, but student details are restricted for this account."
            )}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-4 text-start">#</th>

                <th className="px-3 py-4 text-start">
                  {t("الطالب", "Student")}
                </th>

                <th className="px-3 py-4 text-start">
                  {t("اللجنة", "Committee")}
                </th>

                <th className="px-3 py-4 text-start">
                  {t("الساعات", "Hours")}
                </th>

                <th className="px-3 py-4 text-start">
                  {t("النسبة من الإجمالي", "Share of Total")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    {t("جارٍ تحميل البيانات...", "Loading data...")}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    {tableError
                      ? t(
                          "لا تتوفر صلاحية عرض بيانات الطلاب.",
                          "You do not have permission to view student details."
                        )
                      : t("لا توجد نتائج.", "No results found.")}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const hours = Number(student.total_hours ?? 0);

                  const share =
                    totalHours > 0 ? (hours / totalHours) * 100 : 0;

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-4 font-semibold text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-3 py-4">
                        <p className="font-semibold">{student.full_name}</p>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {student.email}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        {student.committee ||
                          t("غير محدد", "Not assigned")}
                      </td>

                      <td className="px-3 py-4 font-bold">
                        {hours.toLocaleString(
                          isArabic ? "ar-EG" : "en-US"
                        )}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${Math.min(share, 100)}%`,
                              }}
                            />
                          </div>

                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {t("عدد النتائج:", "Results:")} {filteredStudents.length}
        </p>
      </section>
    </main>
  );
}
