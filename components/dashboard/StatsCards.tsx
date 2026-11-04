"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Clock3,
  ClipboardList,
  CalendarDays,
  RefreshCw,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../LanguageProvider";

type DashboardStats = {
  total_students: number;
  total_hours: number;
  active_tasks: number;
  total_sessions: number;
  average_hours: number;
  total_session_hours: number;
};

const initialStats: DashboardStats = {
  total_students: 0,
  total_hours: 0,
  active_tasks: 0,
  total_sessions: 0,
  average_hours: 0,
  total_session_hours: 0,
};

export default function StatsCards() {
  const [supabase] = useState(() => createClient());
  const { language } = useLanguage();
  const ar = language === "ar";

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: statsError } = await supabase.rpc(
        "get_dashboard_stats"
      );

      if (statsError) throw statsError;

      if (!data) {
        throw new Error("No statistics returned from Supabase.");
      }

      setStats({
        total_students: Number(data.total_students ?? 0),
        total_hours: Number(data.total_hours ?? 0),
        active_tasks: Number(data.active_tasks ?? 0),
        total_sessions: Number(data.total_sessions ?? 0),
        average_hours: Number(data.average_hours ?? 0),
        total_session_hours: Number(data.total_session_hours ?? 0),
      });
    } catch (err) {
      console.error("Dashboard statistics error:", err);

      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر تحميل الإحصائيات."
            : "Could not load statistics."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, ar]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const cards = [
    {
      title: ar ? "إجمالي الطلاب" : "Total Students",
      value: stats.total_students,
      description: ar ? "عدد الطلاب المسجلين" : "Registered students",
      icon: Users,
      color: "blue",
    },
    {
      title: ar ? "إجمالي الساعات" : "Total Hours",
      value: stats.total_hours,
      description: ar ? "الساعات المكتسبة" : "Earned hours",
      icon: Clock3,
      color: "green",
    },
    {
      title: ar ? "المهام النشطة" : "Active Tasks",
      value: stats.active_tasks,
      description: ar ? "المهام المنشورة" : "Published tasks",
      icon: ClipboardList,
      color: "purple",
    },
    {
      title: ar ? "إجمالي الجلسات" : "Total Sessions",
      value: stats.total_sessions,
      description: ar ? "الجلسات المسجلة" : "Recorded sessions",
      icon: CalendarDays,
      color: "orange",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {ar ? "الإحصائيات العامة" : "General Statistics"}
        </h2>

        <button
          type="button"
          onClick={() => void loadStats()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)] disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          {ar ? "تحديث" : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-semibold">
            {ar ? "حدث خطأ أثناء تحميل الإحصائيات" : "Statistics loading error"}
          </p>

          <p className="mt-1 break-words">{error}</p>

          <button
            type="button"
            onClick={() => void loadStats()}
            className="mt-3 font-semibold underline"
          >
            {ar ? "حاول مرة أخرى" : "Try again"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="stat-card rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {card.title}
                  </p>

                  <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">
                    {loading ? "—" : card.value.toLocaleString(ar ? "ar-EG" : "en-US")}
                  </p>

                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {card.description}
                  </p>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    card.color === "blue"
                      ? "bg-blue-100 text-blue-700"
                      : card.color === "green"
                        ? "bg-green-100 text-green-700"
                        : card.color === "purple"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-orange-100 text-orange-700"
                  }`}
                >
                  <Icon size={23} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}