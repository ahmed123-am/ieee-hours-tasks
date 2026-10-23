
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "../lib/supabase/server";
import HomeDashboard from "../components/dashboard/HomeDashboard";

export default async function HomePage() {
  await connection();

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
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
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup failed:", profileError.message);

    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">
          تعذر التحقق من صلاحيات الحساب
        </h1>
        <p className="mt-2">
          راجع بيانات الحساب وسياسات الوصول لجدول profiles.
        </p>
      </main>
    );
  }

  if (
    !profile ||
    !profile.is_active ||
    !["admin", "secretary"].includes(profile.role)
  ) {
    redirect("/login");
  }

  return <HomeDashboard />;
}
