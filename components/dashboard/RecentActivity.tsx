"use client";

import {
  CheckCircle2,
  Clock3,
  Users,
  ClipboardList,
} from "lucide-react";

import { useLanguage } from "../LanguageProvider";

export default function RecentActivity() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const activities = [
    {
      title: isArabic ? "إدارة الطلاب" : "Student Management",
      description: isArabic
        ? "سيظهر الطلاب المسجلون هنا"
        : "Registered students will appear here",
      time: isArabic ? "في انتظار البيانات" : "Waiting for data",
      icon: Users,
      color: "blue",
    },
    {
      title: isArabic ? "إكمال المهام" : "Task Completion",
      description: isArabic
        ? "ستظهر المهام المكتملة هنا"
        : "Completed tasks will appear here",
      time: isArabic ? "في انتظار البيانات" : "Waiting for data",
      icon: CheckCircle2,
      color: "green",
    },
    {
      title: isArabic ? "متابعة الساعات" : "Hours Tracking",
      description: isArabic
        ? "ستظهر سجلات ساعات الطلاب هنا"
        : "Student hour transactions will appear here",
      time: isArabic ? "في انتظار البيانات" : "Waiting for data",
      icon: Clock3,
      color: "purple",
    },
    {
      title: isArabic ? "جلسات الفرع" : "Branch Sessions",
      description: isArabic
        ? "ستظهر سجلات الحضور هنا"
        : "Attendance records will appear here",
      time: isArabic ? "في انتظار البيانات" : "Waiting for data",
      icon: ClipboardList,
      color: "orange",
    },
  ];

  return (
    <section
      className="activity-card"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="section-heading">
        <div>
          <h2>{isArabic ? "أحدث الأنشطة" : "Recent Activity"}</h2>
          <p>
            {isArabic
              ? "آخر التحديثات الخاصة بالفرع"
              : "Latest updates from your branch"}
          </p>
        </div>

        <button className="text-button" type="button">
          {isArabic ? "عرض الكل" : "View all"}
        </button>
      </div>

      <div className="activity-list">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <article
              className="activity-item"
              key={activity.title}
            >
              <div className={`activity-icon ${activity.color}`}>
                <Icon size={19} />
              </div>

              <div className="activity-content">
                <h3>{activity.title}</h3>
                <p>{activity.description}</p>
              </div>

              <span className="activity-time">
                {activity.time}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}