
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type AccountRole = "admin" | "board" | "head" | "volunteer" | "student";

type NavigationItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
};

export default function Sidebar() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const pathname = usePathname();

  /*
   * مبدئيًا نعرض القائمة المشتركة فقط.
   * الدور يجب أن يأتي من profile موثوق من السيرفر،
   * وليس من اختيار المستخدم أو localStorage.
   *
   * الخطوة التالية ستوصل الدور الفعلي هنا.
   */
  const role: AccountRole = "admin";

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

  const navigation =
    role === "admin" || role === "board"
      ? allNavigation
      : role === "head"
        ? allNavigation.filter((item) =>
            ["/", "/tasks", "/sessions", "/hours"].includes(item.href)
          )
        : role === "volunteer" || role === "student"
          ? allNavigation.filter((item) =>
              ["/", "/tasks", "/hours", "/sessions"].includes(item.href)
            )
          : allNavigation.filter((item) => item.href === "/");

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
          {navigation.map((item) => {
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
          })}
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
              {isArabic ? "إدارة الطلاب" : "Student Management"}
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
