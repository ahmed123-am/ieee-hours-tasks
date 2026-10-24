
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import HomeDashboard from "../components/dashboard/HomeDashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<div>جاري تحميل لوحة التحكم...</div>}>
      <DashboardAccess />
    </Suspense>
  );
}

async function DashboardAccess() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active, approval_status, role_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup failed:", profileError.message);

    return (
      <main className="p-6" dir="rtl">
        <h1 className="text-xl font-bold">
          تعذر التحقق من صلاحيات الحساب
        </h1>
        <p className="mt-2">
          تعذر قراءة بيانات الحساب. حاول مرة أخرى، وإذا استمرت المشكلة
          راجع سياسات الوصول لجدول profiles في Supabase.
        </p>
      </main>
    );
  }

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  const legacyStaff = ["admin", "secretary"].includes(profile.role);

  const approvedMember =
    ["board", "head", "volunteer"].includes(profile.role) &&
    profile.role_approved === true &&
    profile.approval_status === "approved";

  if (!legacyStaff && !approvedMember) {
    redirect("/login");
  }

  return <HomeDashboard />;
}
