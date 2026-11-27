"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Users,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../LanguageProvider";

type RecentStudent = {
  full_name: string;
  created_at: string | null;
};

type RecentSubmission = {
  reviewed_at: string | null;
  created_at: string | null;
};

type RecentSession = {
  title: string;
  starts_at: string | null;
  created_at: string | null;
};

type DashboardStats = {
  total_hours?: number | string | null;
};

type ActivitySummary = {
  studentCount: number;
  latestStudent: RecentStudent | null;
  approvedSubmissionCount: number;
  latestApprovedSubmission: RecentSubmission | null;
  totalHours: number;
  sessionCount: number;
  latestSession: RecentSession | null;
};

function formatDate(value: string | null, isArabic: boolean): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(isArabic ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function RecentActivity() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const supabase = useMemo(() => createClient(), []);

  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [studentsResult, submissionsResult, statsResult, sessionsResult] =
        await Promise.all([
          supabase
            .from("students")
            .select("full_name, created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("task_submissions")
            .select("reviewed_at, created_at", { count: "exact" })
            .eq("status", "approved")
            .order("reviewed_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1),
          supabase.rpc("get_dashboard_stats"),
          supabase
            .from("sessions")
            .select("title, starts_at, created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

      const queryError =
        studentsResult.error ??
        submissionsResult.error ??
        statsResult.error ??
        sessionsResult.error;

      if (queryError) throw queryError;

      const dashboardStats = statsResult.data as DashboardStats | null;

      setSummary({
        studentCount: studentsResult.count ?? 0,
        latestStudent: studentsResult.data?.[0] ?? null,
        approvedSubmissionCount: submissionsResult.count ?? 0,
        latestApprovedSubmission: submissionsResult.data?.[0] ?? null,
        totalHours: Number(dashboardStats?.total_hours ?? 0),
        sessionCount: sessionsResult.count ?? 0,
        latestSession: sessionsResult.data?.[0] ?? null,
      });
    } catch (loadError) {
      console.error("Recent activity load error:", loadError);
      setSummary(null);
      setError(
        isArabic
          ? "تعذر تحميل النشاط من قاعدة البيانات. اضغط تحديث للمحاولة مرة أخرى."
          : "Could not load activity from the database. Select Refresh to try again."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, isArabic]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const number = (value: number) =>
    value.toLocaleString(isArabic ? "ar-EG" : "en-US");

  const waitingText = t("جارٍ تحميل البيانات...", "Loading data...");
  const unavailableText = t("تعذر تحميل البيانات.", "Data could not be loaded.");
  const entries = [
    {
      title: t("إدارة الطلاب", "Student Management"),
      description: loading
        ? waitingText
        : error
          ? unavailableText
          : summary?.latestStudent
            ? t(
                "آخر طالب مسجل: " +
                  summary.latestStudent.full_name +
                  (formatDate(summary.latestStudent.created_at, true)
                    ? " · " + formatDate(summary.latestStudent.created_at, true)
                    : ""),
                "Latest student: " +
                  summary.latestStudent.full_name +
                  (formatDate(summary.latestStudent.created_at, false)
                    ? " · " + formatDate(summary.latestStudent.created_at, false)
                    : "")
              )
            : t("لا يوجد طلاب مسجلون حتى الآن.", "No students are registered yet."),
      metric: loading
        ? waitingText
        : error
          ? "—"
          : t(
              number(summary?.studentCount ?? 0) + " طالب",
              number(summary?.studentCount ?? 0) + " students"
            ),
      icon: Users,
      color: "blue",
    },
    {
      title: t("التسليمات المقبولة", "Approved Submissions"),
      description: loading
        ? waitingText
        : error
          ? unavailableText
          : summary?.latestApprovedSubmission
            ? t(
                "آخر اعتماد: " +
                  (formatDate(
                    summary.latestApprovedSubmission.reviewed_at ??
                      summary.latestApprovedSubmission.created_at,
                    true
                  ) ?? "—"),
                "Last approval: " +
                  (formatDate(
                    summary.latestApprovedSubmission.reviewed_at ??
                      summary.latestApprovedSubmission.created_at,
                    false
                  ) ?? "—")
              )
            : t(
                "لا توجد تسليمات مقبولة حتى الآن.",
                "No submissions have been approved yet."
              ),
      metric: loading
        ? waitingText
        : error
          ? "—"
          : t(
              number(summary?.approvedSubmissionCount ?? 0) + " تسليم",
              number(summary?.approvedSubmissionCount ?? 0) + " approved"
            ),
      icon: CheckCircle2,
      color: "green",
    },
    {
      title: t("متابعة الساعات", "Hours Tracking"),
      description: loading
        ? waitingText
        : error
          ? unavailableText
          : t(
              "إجمالي الساعات المسجلة في بيانات الفرع.",
              "Total hours recorded for the branch."
            ),
      metric: loading
        ? waitingText
        : error
          ? "—"
          : t(
              number(summary?.totalHours ?? 0) + " ساعة",
              number(summary?.totalHours ?? 0) + " hours"
            ),
      icon: Clock3,
      color: "purple",
    },
    {
      title: t("جلسات الفرع", "Branch Sessions"),
      description: loading
        ? waitingText
        : error
          ? unavailableText
          : summary?.latestSession
            ? t(
                "آخر جلسة: " +
                  summary.latestSession.title +
                  (formatDate(summary.latestSession.starts_at, true)
                    ? " · " + formatDate(summary.latestSession.starts_at, true)
                    : ""),
                "Latest session: " +
                  summary.latestSession.title +
                  (formatDate(summary.latestSession.starts_at, false)
                    ? " · " + formatDate(summary.latestSession.starts_at, false)
                    : "")
              )
            : t("لا توجد جلسات مسجلة حتى الآن.", "No sessions are recorded yet."),
      metric: loading
        ? waitingText
        : error
          ? "—"
          : t(
              number(summary?.sessionCount ?? 0) + " جلسة",
              number(summary?.sessionCount ?? 0) + " sessions"
            ),
      icon: CalendarDays,
      color: "orange",
    },
  ];

  return (
    <section
      className="activity-card"
      dir={isArabic ? "rtl" : "ltr"}
      aria-busy={loading}
    >
      <div className="section-heading">
        <div>
          <h2>{t("أحدث الأنشطة", "Recent Activity")}</h2>
          <p>
            {t(
              "ملخص مباشر من بيانات الفرع في قاعدة البيانات",
              "Live summary from the branch database"
            )}
          </p>
        </div>

        <button
          className="text-button inline-flex items-center gap-2"
          type="button"
          onClick={() => void loadActivity()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {t("تحديث", "Refresh")}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="activity-list">
        {entries.map((activity) => {
          const Icon = activity.icon;

          return (
            <article className="activity-item" key={activity.title}>
              <div className={"activity-icon " + activity.color}>
                <Icon size={19} />
              </div>

              <div className="activity-content">
                <h3>{activity.title}</h3>
                <p>{activity.description}</p>
              </div>

              <span className="activity-time">{activity.metric}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
