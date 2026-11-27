"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  X,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";

type Role = "admin" | "secretary" | "board" | "head" | "volunteer" | "student";
type NotificationKind = "task" | "session" | "review" | "submission";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  createdAt: string;
};

type TaskRow = {
  id: string;
  title: string;
  created_at: string;
  visibility: string | null;
};

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  created_at: string;
  status: string | null;
};

type SubmissionRow = {
  id: string;
  task_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note?: string | null;
};

const STAFF_ROLES: Role[] = ["admin", "secretary", "head"];
const MAX_ITEMS = 24;

function formatDate(value: string, isArabic: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationsMenu({
  userId,
  role,
  isArabic,
}: {
  userId: string | undefined;
  role: Role | undefined;
  isArabic: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const panelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [readStateLoaded, setReadStateLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const readStorageKey = userId ? `ieee-notifications-read:${userId}` : "";

  useEffect(() => {
    setReadStateLoaded(false);
    if (!readStorageKey) {
      setReadIds([]);
      return;
    }

    try {
      const stored = window.localStorage.getItem(readStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setReadIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setReadIds([]);
    } finally {
      setReadStateLoaded(true);
    }
  }, [readStorageKey]);

  const loadNotifications = useCallback(async () => {
    if (!userId || !role) return;

    setLoading(true);
    setError(false);

    try {
      const [tasksResult, sessionsResult, reviewsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, created_at, visibility")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("sessions")
          .select("id, title, starts_at, created_at, status")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(8),
        supabase
          .from("task_submissions")
          .select("id, task_id, status, created_at, review_note")
          .eq("student_id", userId)
          .in("status", ["approved", "rejected"])
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      let pendingSubmissions: SubmissionRow[] = [];
      let pendingError: unknown = null;

      if (STAFF_ROLES.includes(role)) {
        const pendingResult = await supabase
          .from("task_submissions")
          .select("id, task_id, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(8);

        pendingError = pendingResult.error;
        pendingSubmissions = (pendingResult.data ?? []) as SubmissionRow[];
      }

      const reviews = (reviewsResult.data ?? []) as SubmissionRow[];
      const tasks = (tasksResult.data ?? []) as TaskRow[];
      const sessions = (sessionsResult.data ?? []) as SessionRow[];
      const relatedTaskIds = Array.from(
        new Set([...reviews, ...pendingSubmissions].map((item) => item.task_id))
      );

      let relatedTasks: Array<{ id: string; title: string }> = [];
      if (relatedTaskIds.length > 0) {
        const relatedTasksResult = await supabase
          .from("tasks")
          .select("id, title")
          .in("id", relatedTaskIds);

        if (relatedTasksResult.error) {
          console.warn("Notification task details unavailable:", relatedTasksResult.error);
        } else {
          relatedTasks = relatedTasksResult.data ?? [];
        }
      }

      const taskNames = new Map(relatedTasks.map((task) => [task.id, task.title]));
      const nextItems: NotificationItem[] = [];

      for (const task of tasks) {
        if (!STAFF_ROLES.includes(role) && task.visibility !== "all") continue;

        nextItems.push({
          id: `task:${task.id}`,
          kind: "task",
          title: isArabic ? "مهمة جديدة" : "New task",
          description: task.title,
          href: "/tasks",
          createdAt: task.created_at,
        });
      }

      for (const session of sessions) {
        if (["cancelled", "canceled", "closed"].includes((session.status ?? "").toLowerCase())) continue;

        nextItems.push({
          id: `session:${session.id}`,
          kind: "session",
          title: isArabic ? "جلسة قادمة" : "Upcoming session",
          description: `${session.title} · ${formatDate(session.starts_at, isArabic)}`,
          href: "/sessions",
          createdAt: session.created_at,
        });
      }

      for (const submission of reviews) {
        const approved = submission.status === "approved";
        const taskName = taskNames.get(submission.task_id);

        nextItems.push({
          id: `review:${submission.id}:${submission.status}`,
          kind: "review",
          title: isArabic
            ? approved ? "تم قبول تسليمك" : "تم رفض تسليمك"
            : approved ? "Your submission was approved" : "Your submission was rejected",
          description: [taskName, submission.review_note].filter(Boolean).join(" · ") ||
            (isArabic ? "تم تحديث حالة تسليم المهمة." : "Your task submission was updated."),
          href: "/tasks",
          createdAt: submission.created_at,
        });
      }

      for (const submission of pendingSubmissions) {
        nextItems.push({
          id: `submission:${submission.id}`,
          kind: "submission",
          title: isArabic ? "تسليم جديد للمراجعة" : "Submission needs review",
          description: taskNames.get(submission.task_id) ??
            (isArabic ? "تم استلام تسليم مهمة جديد." : "A new task submission was received."),
          href: "/dashboard/submissions",
          createdAt: submission.created_at,
        });
      }

      nextItems.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setItems(nextItems.slice(0, MAX_ITEMS));

      const allFailed =
        Boolean(tasksResult.error) &&
        Boolean(sessionsResult.error) &&
        Boolean(reviewsResult.error) &&
        (!STAFF_ROLES.includes(role) || Boolean(pendingError));

      if (allFailed) {
        console.error("Notification queries failed:", {
          tasks: tasksResult.error,
          sessions: sessionsResult.error,
          reviews: reviewsResult.error,
          pending: pendingError,
        });
        setError(true);
      }
    } catch (loadError) {
      console.error("Load notifications error:", loadError);
      setError(true);
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [isArabic, role, supabase, userId]);

  useEffect(() => {
    if (!userId || !role) return;

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 45_000);

    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadNotifications, role, userId]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function saveReadIds(nextIds: string[]) {
    const bounded = nextIds.slice(-250);
    setReadIds(bounded);
    if (readStorageKey) {
      try {
        window.localStorage.setItem(readStorageKey, JSON.stringify(bounded));
      } catch (storageError) {
        console.warn("Could not save notification read state:", storageError);
      }
    }
  }

  function markRead(id: string) {
    if (!readIds.includes(id)) saveReadIds([...readIds, id]);
  }

  function markAllRead() {
    saveReadIds(Array.from(new Set([...readIds, ...items.map((item) => item.id)])));
  }

  const unreadCount = readStateLoaded
    ? items.reduce((count, item) => count + (readIds.includes(item.id) ? 0 : 1), 0)
    : 0;

  function iconFor(kind: NotificationKind) {
    if (kind === "session") return <CalendarDays size={18} />;
    if (kind === "review" || kind === "submission") return <ClipboardCheck size={18} />;
    return <ClipboardList size={18} />;
  }

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        className="notification-button"
        type="button"
        aria-label={isArabic ? `الإشعارات${unreadCount ? `، ${unreadCount} غير مقروء` : ""}` : `Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-controls="notification-panel"
        title={isArabic ? "الإشعارات" : "Notifications"}
        disabled={!userId}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void loadNotifications();
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-panel"
          id="notification-panel"
          role="dialog"
          aria-label={isArabic ? "قائمة الإشعارات" : "Notifications"}
          dir={isArabic ? "rtl" : "ltr"}
        >
          <header className="notification-panel-header">
            <div>
              <h2>{isArabic ? "الإشعارات" : "Notifications"}</h2>
              <p>
                {unreadCount > 0
                  ? isArabic ? `${unreadCount} إشعار غير مقروء` : `${unreadCount} unread`
                  : isArabic ? "آخر التحديثات على حسابك" : "Updates for your account"}
              </p>
            </div>
            <div className="notification-panel-actions">
              {unreadCount > 0 && (
                <button
                  className="notification-mark-read"
                  type="button"
                  onClick={markAllRead}
                  title={isArabic ? "تحديد الكل كمقروء" : "Mark all as read"}
                >
                  <Check size={16} />
                  <span>{isArabic ? "قراءة الكل" : "Read all"}</span>
                </button>
              )}
              <button
                className="notification-icon-action"
                type="button"
                aria-label={isArabic ? "تحديث الإشعارات" : "Refresh notifications"}
                onClick={() => void loadNotifications()}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "notification-refreshing" : ""} />
              </button>
              <button
                className="notification-icon-action"
                type="button"
                aria-label={isArabic ? "إغلاق الإشعارات" : "Close notifications"}
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <div className="notification-list" aria-live="polite">
            {loading && !loaded ? (
              <p className="notification-empty">
                {isArabic ? "جارٍ تحميل الإشعارات..." : "Loading notifications..."}
              </p>
            ) : error && items.length === 0 ? (
              <div className="notification-empty">
                <p>{isArabic ? "تعذر تحميل الإشعارات." : "Could not load notifications."}</p>
                <button type="button" onClick={() => void loadNotifications()}>
                  {isArabic ? "حاول مرة أخرى" : "Try again"}
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="notification-empty">
                {isArabic ? "لا توجد إشعارات جديدة حاليًا." : "There are no notifications right now."}
              </p>
            ) : (
              items.map((item) => {
                const unread = readStateLoaded && !readIds.includes(item.id);

                return (
                  <Link
                    className={`notification-item${unread ? " unread" : ""}`}
                    href={item.href}
                    key={item.id}
                    onClick={() => {
                      markRead(item.id);
                      setOpen(false);
                    }}
                  >
                    <span className={`notification-item-icon ${item.kind}`}>
                      {iconFor(item.kind)}
                    </span>
                    <span className="notification-item-copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt, isArabic)}</time>
                    </span>
                    {unread && <span className="notification-unread-dot" aria-label={isArabic ? "غير مقروء" : "Unread"} />}
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}

