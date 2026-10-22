
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Clock3,
  ClipboardList,
  CalendarDays,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

import { useLanguage } from "../LanguageProvider";
import { createClient } from "../../lib/supabase/client";

type DashboardStats = {
  totalStudents: number;
  totalHours: number;
  activeTasks: number;
  totalSessions: number;
};

type QueryIssue = {
  name: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export default function StatsCards() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalHours: 0,
    activeTasks: 0,
    totalSessions: 0,
  });

  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<QueryIssue[]>([]);
  const [roleInfo, setRoleInfo] = useState("لم يتم الفحص بعد");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setIssues([]);

    const supabase = createClient();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setIssues([
          {
            name: "Authentication",
            message: authError.message,
            code: authError.code,
          },
        ]);
        return;
      }

      if (!user) {
        setRoleInfo("لا توجد جلسة مستخدم");
        setIssues([
          {
            name: "Authentication",
            message: "No authenticated user session found.",
          },
        ]);
        return;
      }

      // Role lookup is diagnostic only. RLS remains enforced by Supabase.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setRoleInfo("تعذر قراءة الدور");
        setIssues((current) => [
          ...current,
          {
            name: "Profile lookup",
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
          },
        ]);
      } else {
        setRoleInfo(
          profile
            ? `role=${profile.role}, active=${profile.is_active}`
            : "لا يوجد profile مطابق للمستخدم الحالي"
        );
      }

      const [
        studentsResult,
        tasksResult,
        sessionsResult,
        hoursResult,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),

        supabase
          .from("sessions")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("students")
          .select("total_hours"),
      ]);

      const nextIssues: QueryIssue[] = [];

      const collectError = (
        name: string,
        error: {
          message: string;
          code?: string;
          details?: string;
          hint?: string;
        } | null
      ) => {
        if (!error) return;

        nextIssues.push({
          name,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      };

      collectError("Students query", studentsResult.error);
      collectError("Tasks query", tasksResult.error);
      collectError("Sessions query", sessionsResult.error);
      collectError("Hours query", hoursResult.error);

      setStats({
        totalStudents: studentsResult.error
          ? 0
          : studentsResult.count ?? 0,
        activeTasks: tasksResult.error
          ? 0
          : tasksResult.count ?? 0,
        totalSessions: sessionsResult.error
          ? 0
          : sessionsResult.count ?? 0,
        totalHours: hoursResult.error
          ? 0
          : (hoursResult.data ?? []).reduce(
              (sum, student) =>
                sum + Number(student.total_hours ?? 0),
              0
            ),
      });

      setIssues((current) => [...current, ...nextIssues]);

      if (nextIssues.length > 0) {
        console.error("Dashboard query diagnostics:", nextIssues);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      setIssues([
        {
          name: "Unexpected error",
          message,
        },
      ]);

      console.error("Dashboard statistics error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const cards = [
    {
      title: isArabic ? "إجمالي الطلاب" : "Total Students",
      value: stats.totalStudents,
      description: isArabic ? "الطلاب المسجلون" : "Registered students",
      icon: Users,
      color: "blue",
    },
    {
      title: isArabic ? "إجمالي الساعات" : "Total Hours",
      value: stats.totalHours,
      description: isArabic
        ? "الساعات المسجلة للطلاب"
        : "Hours recorded for students",
      icon: Clock3,
      color: "purple",
    },
    {
      title: isArabic ? "المهام النشطة" : "Active Tasks",
      value: stats.activeTasks,
      description: isArabic ? "المهام المتاحة" : "Available tasks",
      icon: ClipboardList,
      color: "orange",
    },
    {
      title: isArabic ? "إجمالي الجلسات" : "Total Sessions",
      value: stats.totalSessions,
      description: isArabic ? "جلسات الفرع" : "Branch sessions",
      icon: CalendarDays,
      color: "green",
    },
  ];

  return (
    <section
      className="stats-grid"
      dir={isArabic ? "rtl" : "ltr"}
      aria-busy={loading}
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article className="stat-card" key={card.title}>
            <div className="stat-card-top">
              <div className={`stat-icon ${card.color}`}>
                <Icon size={22} />
              </div>

              <span className="stat-trend" aria-hidden="true">
                <ArrowUpRight size={16} />
              </span>
            </div>

            <p className="stat-title">{card.title}</p>

            <h2 className="stat-value">
              {loading
                ? "—"
                : card.value.toLocaleString(
                    isArabic ? "ar-EG" : "en-US"
                  )}
            </h2>

            <p className="stat-description">
              {loading
                ? isArabic
                  ? "جارٍ تحميل البيانات..."
                  : "Loading data..."
                : issues.some((issue) =>
                    issue.name.toLowerCase().includes(
                      card.color === "orange"
                        ? "tasks"
                        : card.color === "blue" ||
                            card.color === "purple"
                          ? "students"
                          : "sessions"
                    )
                  )
                  ? isArabic
                    ? "تعذر تحميل هذه البيانات"
                    : "Could not load this data"
                  : card.description}
            </p>
          </article>
        );
      })}

      {issues.length > 0 && (
        <div
          className="stats-error"
          role="alert"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <p>
            {isArabic
              ? "تفاصيل مشكلة تحميل البيانات:"
              : "Data loading diagnostics:"}
          </p>

          <p>
            {isArabic ? "حالة الدور: " : "Role status: "}
            {roleInfo}
          </p>

          {issues.map((issue, index) => (
            <div key={`${issue.name}-${index}`}>
              <strong>{issue.name}</strong>
              <p>{issue.message}</p>
              {issue.code && <p>Code: {issue.code}</p>}
              {issue.details && <p>Details: {issue.details}</p>}
              {issue.hint && <p>Hint: {issue.hint}</p>}
            </div>
          ))}

          <button
            type="button"
            className="language-toggle"
            onClick={() => void loadStats()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading
              ? isArabic
                ? "جارٍ المحاولة..."
                : "Retrying..."
              : isArabic
                ? "إعادة المحاولة"
                : "Retry"}
          </button>
        </div>
      )}
    </section>
  );
}
