
export type Language = "ar" | "en";

export const translations = {
  ar: {
    branch: "IEEE NDETI Student Branch",
    dashboard: "لوحة التحكم",
    students: "الطلاب",
    tasks: "المهام",
    sessions: "الجلسات والحضور",
    hours: "سجل الساعات",
    welcome: "مرحبًا بك في نظام الفرع",
    title: "إدارة ساعات ومهام الطلاب",
    description:
      "تابع مشاركة الطلاب، ونظّم المهام والجلسات، وسجّل ساعات المشاركة في مكان واحد.",
    totalStudents: "إجمالي الطلاب",
    totalHours: "إجمالي الساعات",
    availableTasks: "المهام المتاحة",
    totalSessions: "الجلسات",
    overview: "نظرة عامة",
    branchSummary: "ملخص بيانات الفرع",
    ready: "النظام جاهز",
    emptyTitle: "مرحبًا بك في لوحة التحكم",
    emptyDescription:
      "ستظهر إحصائيات الطلاب والساعات والمهام هنا عند ربط البيانات.",
    language: "English",
    footer: "جميع الحقوق محفوظة",
  },
  en: {
    branch: "IEEE NDETI Student Branch",
    dashboard: "Dashboard",
    students: "Students",
    tasks: "Tasks",
    sessions: "Sessions & Attendance",
    hours: "Hours History",
    welcome: "Welcome to the branch system",
    title: "Student Hours & Tasks Management",
    description:
      "Track student participation, organize tasks and sessions, and manage participation hours in one place.",
    totalStudents: "Total Students",
    totalHours: "Total Hours",
    availableTasks: "Available Tasks",
    totalSessions: "Sessions",
    overview: "Overview",
    branchSummary: "Branch Summary",
    ready: "System Ready",
    emptyTitle: "Welcome to your dashboard",
    emptyDescription:
      "Student, hour, and task statistics will appear here when the data is connected.",
    language: "العربية",
    footer: "All rights reserved",
  },
} as const;
