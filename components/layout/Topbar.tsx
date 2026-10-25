
"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Search,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

import { useLanguage } from "../LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";

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

export default function Topbar() {
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const isArabic = language === "ar";
  const isDark = theme === "dark";

  const [profile, setProfile] = useState<UserProfile | null>(null);

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
        console.error("Topbar profile error:", error);

        if (!cancelled) {
          setProfile(null);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabels: Record<AccountRole, { ar: string; en: string }> = {
    admin: { ar: "مدير النظام", en: "Administrator" },
    secretary: { ar: "أمين الفرع", en: "Branch Secretary" },
    board: { ar: "مجلس إدارة الفرع", en: "Branch Board" },
    head: { ar: "مسؤول لجنة", en: "Committee Head" },
    volunteer: { ar: "متطوع", en: "Volunteer" },
    student: { ar: "طالب", en: "Student" },
  };

  const role = profile?.role;
  const roleLabel = role ? roleLabels[role] : null;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email ||
    (isArabic ? "المستخدم" : "User");

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const pageTitle = isArabic ? "لوحة التحكم" : "Dashboard";

  return (
    <header className="topbar" dir={isArabic ? "rtl" : "ltr"}>
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu"
          aria-label={isArabic ? "فتح القائمة" : "Open menu"}
          onClick={() => {
            document.body.classList.toggle("sidebar-open");
          }}
        >
          <Menu size={22} />
        </button>

        <div>
          <h1>{pageTitle}</h1>
          <p>
            {isArabic
              ? "أهلاً بعودتك! إليك نظرة عامة على الفرع."
              : "Welcome back! Here is your branch overview."}
          </p>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={
            isDark
              ? isArabic
                ? "تفعيل الوضع الفاتح"
                : "Switch to light mode"
              : isArabic
                ? "تفعيل الوضع الداكن"
                : "Switch to dark mode"
          }
          title={
            isDark
              ? isArabic
                ? "الوضع الفاتح"
                : "Light mode"
              : isArabic
                ? "الوضع الداكن"
                : "Dark mode"
          }
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span>
            {isDark
              ? isArabic
                ? "فاتح"
                : "Light"
              : isArabic
                ? "داكن"
                : "Dark"}
          </span>
        </button>

        <button
          type="button"
          className="language-toggle"
          onClick={toggleLanguage}
          aria-label={
            isArabic
              ? "التبديل إلى الإنجليزية"
              : "Switch to Arabic"
          }
        >
          {isArabic ? "English" : "العربية"}
        </button>

        <label className="search-box">
          <Search size={18} />
          <input
            type="search"
            placeholder={isArabic ? "بحث..." : "Search..."}
            aria-label={isArabic ? "بحث" : "Search"}
          />
          <kbd>Ctrl K</kbd>
        </label>

        <button
          className="notification-button"
          type="button"
          aria-label={isArabic ? "الإشعارات" : "Notifications"}
        >
          <Bell size={20} />
          <span />
        </button>

        <div className="admin-profile">
          <div className="admin-avatar">
            {initials || "U"}
          </div>

          <div className="admin-info">
            <strong>{displayName}</strong>

            <span>
              {roleLabel
                ? isArabic
                  ? roleLabel.ar
                  : roleLabel.en
                : isArabic
                  ? "جاري تحميل الحساب..."
                  : "Loading account..."}
            </span>

            {profile?.committee && (
              <span>
                {isArabic ? "اللجنة: " : "Committee: "}
                {profile.committee}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
