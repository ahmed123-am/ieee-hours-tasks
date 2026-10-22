
"use client";

import Sidebar from "../layout/Sidebar";
import Topbar from "../layout/Topbar";
import StatsCards from "./StatsCards";
import RecentActivity from "./RecentActivity";
import { useLanguage } from "../LanguageProvider";

export default function HomeDashboard() {
  const { language, t } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div
      className="dashboard-layout"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Sidebar />

      <main className="dashboard-main">
        <Topbar />

        <div className="dashboard-content">
          <section className="page-intro">
            <span className="eyebrow">IEEE NDETI</span>
            <h1>{t.dashboard}</h1>
            <p>{t.description}</p>
          </section>

          <StatsCards />

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>{t.overview}</h2>
                <p>{t.branchSummary}</p>
              </div>

              <span className="status-badge">
                {t.ready}
              </span>
            </div>

            <RecentActivity />
          </section>
        </div>

        <footer
          className="arabic-footer"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <span>© 2026 IEEE NDETI Student Branch</span>
        </footer>
      </main>
    </div>
  );
}
