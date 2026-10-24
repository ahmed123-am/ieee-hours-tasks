
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
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup failed:", profileError.message);

    return (
      <main className="p-6" dir="rtl">
        <h1 className="text-xl font-bold">
          تعذر التحقق من حالة الحساب
        </h1>
        <p className="mt-2">
          تعذر قراءة بيانات الحساب. حاول مرة أخرى، وإذا استمرت المشكلة
          راجع سياسات الوصول لجدول profiles في Supabase.
        </p>
      </main>
    );
  }

  if (!profile || profile.is_active !== true) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return <HomeDashboard />;
}
