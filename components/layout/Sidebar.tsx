
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Clock3,
  CalendarDays,
  Settings,
  GraduationCap,
  X,
} from "lucide-react";

import { useLanguage } from "../LanguageProvider";

type AccountRole =
  | "admin"
  | "secretary"
  | "board"
  | "head"
  | "volunteer"
  | "student";

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: AccountRole;
  committee: string | null;
};

type NavigationItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
};

export default function Sidebar() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load user profile");
        }

        const data = await response.json();
        const userProfile = data.profile ?? data;

        const validRoles: AccountRole[] = [
          "admin",
          "secretary",
          "board",
          "head",
          "volunteer",
          "student",
        ];

        if (
          !userProfile ||
          !validRoles.includes(userProfile.role)
        ) {
          throw new Error("Invalid profile");
        }

        if (!cancelled) {
          setProfile(userProfile as UserProfile);
        }
      } catch (error) {
        console.error("Sidebar profile error:", error);

        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const allNavigation: NavigationItem[] = [
    {
      label: isArabic ? "لوحة التحكم" : "Dashboard",
      icon: LayoutDashboard,
      href: "/",
    },
    {
      label: isArabic ? "الطلاب" : "Students",
      icon: Users,
      href: "/students",
    },
    {
      label: isArabic ? "المهام" : "Tasks",
      icon: ClipboardList,
      href: "/tasks",
    },
    {
      label: isArabic ? "الساعات" : "Hours",
      icon: Clock3,
      href: "/hours",
    },
    {
      label: isArabic ? "الجلسات والحضور" : "Sessions & Attendance",
      icon: CalendarDays,
      href: "/sessions",
    },
    {
      label: isArabic ? "الإعدادات" : "Settings",
      icon: Settings,
      href: "/settings",
    },
  ];

  const role = profile?.role;

  const navigation =
    role === "admin" || role === "secretary" || role === "board"
      ? allNavigation
      : role === "head"
        ? allNavigation.filter((item) =>
            ["/", "/tasks", "/sessions", "/hours"].includes(
              item.href
            )
          )
        : role === "volunteer" || role === "student"
          ? allNavigation.filter((item) =>
              ["/", "/tasks", "/hours", "/sessions"].includes(
                item.href
              )
            )
          : [];

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-overlay"
        aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}
        onClick={closeSidebar}
      />

      <aside className="sidebar" dir={isArabic ? "rtl" : "ltr"}>
        <div className="sidebar-brand">
          <img src="/ieee.jpeg" alt="IEEE NDETI Student Branch" />

          <div className="sidebar-brand-text">
            <h2>IEEE NDETI</h2>
            <span>
              {isArabic ? "الفرع الطلابي" : "Student Branch"}
            </span>
          </div>

          <button
            type="button"
            className="sidebar-close"
            aria-label={isArabic ? "إغلاق القائمة" : "Close sidebar"}
            onClick={closeSidebar}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section-label">
          {isArabic ? "القائمة الرئيسية" : "MAIN MENU"}
        </div>

        <nav className="sidebar-nav">
          {loading ? (
            <p className="sidebar-loading">
              {isArabic ? "جاري تحميل القائمة..." : "Loading menu..."}
            </p>
          ) : (
            navigation.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={closeSidebar}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">
            <GraduationCap size={23} />
          </div>

          <div className="sidebar-bottom-text">
            <strong>
              {isArabic ? "ساعات ومهام IEEE" : "IEEE Hours & Tasks"}
            </strong>
            <p>
              {profile?.committee ??
                (isArabic ? "إدارة الطلاب" : "Student Management")}
            </p>
          </div>
        </div>

        <div className="sidebar-footer">
          {isArabic
            ? "تطوير أحمد جلال © 2026"
            : "Powered by Ahmed Galal © 2026"}
        </div>
      </aside>
    </>
  );
}
