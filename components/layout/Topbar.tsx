"use client";

import {
  Bell,
  Search,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

import { useLanguage } from "../LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";

export default function Topbar() {
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const isArabic = language === "ar";
  const isDark = theme === "dark";

  return (
    <header
      className="topbar"
      dir={isArabic ? "rtl" : "ltr"}
    >
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
          <h1>{isArabic ? "لوحة التحكم" : "Dashboard"}</h1>

          <p>
            {isArabic
              ? "أهلاً بعودتك! إليك نظرة عامة على الفرع."
              : "Welcome back! Here is your branch overview."}
          </p>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Dark / Light Mode */}
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

        {/* Language Toggle */}
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

        {/* Search */}
        <label className="search-box">
          <Search size={18} />

          <input
            type="search"
            placeholder={isArabic ? "بحث..." : "Search..."}
            aria-label={isArabic ? "بحث" : "Search"}
          />

          <kbd>Ctrl K</kbd>
        </label>

        {/* Notifications */}
        <button
          className="notification-button"
          type="button"
          aria-label={isArabic ? "الإشعارات" : "Notifications"}
        >
          <Bell size={20} />
          <span />
        </button>

        {/* Admin Profile */}
        <div className="admin-profile">
          <div className="admin-avatar">AG</div>

          <div className="admin-info">
            <strong>
              {isArabic ? "مسؤول الفرع" : "Branch Admin"}
            </strong>

            <span>
              {isArabic ? "مدير النظام" : "Administrator"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}