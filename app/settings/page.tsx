
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  secretary: "Secretary",
  board: "Board",
  head: "Head",
  volunteer: "Volunteer",
  student: "Student",
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,email,role,is_active")
        .eq("id", authData.user.id)
        .single();

      if (cancelled) return;

      if (profileError) {
        setError(`تعذر تحميل بيانات الحساب: ${profileError.message}`);
      } else if (data) {
        const currentProfile = data as Profile;
        setProfile(currentProfile);
        setFullName(currentProfile.full_name ?? "");
      }

      setLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setError("اكتب الاسم قبل الحفظ.");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.");
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id)
      .select("id,full_name,email,role,is_active")
      .single();

    if (updateError) {
      setError(`فشل حفظ الاسم: ${updateError.message}`);
      setSaving(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: trimmedName },
    });

    setProfile(data as Profile);
    setFullName(trimmedName);

    if (metadataError) {
      setSuccess(
        "تم حفظ الاسم في ملف الحساب. تعذر تحديث بيانات Auth الإضافية."
      );
    } else {
      setSuccess("تم حفظ بيانات الحساب بنجاح.");
    }

    setSaving(false);
  }

  async function handleSignOut() {
    setLoggingOut(true);
    setError("");

    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(`تعذر تسجيل الخروج: ${signOutError.message}`);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="p-8 text-center text-slate-500">
        جاري تحميل الإعدادات...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-8">
        <p className="text-red-500">
          {error || "تعذر العثور على بيانات الحساب."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage your account information and session.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-green-300 bg-green-50 p-4 text-green-700"
        >
          {success}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h2 className="mb-5 text-xl font-semibold">Account Information</h2>

        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium"
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
              maxLength={100}
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Email
            </label>
            <input
              value={profile.email ?? ""}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              البريد الإلكتروني للعرض فقط.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Account Role
              </label>
              <input
                value={roleLabels[profile.role] ?? profile.role}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Account Status
              </label>
              <input
                value={profile.is_active ? "Active" : "Inactive"}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Sign Out</h2>
        <p className="mt-2 mb-5 text-sm text-slate-500">
          تسجيل الخروج من حسابك على هذا الجهاز.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? "Signing out..." : "تسجيل الخروج"}
        </button>
      </section>
    </main>
  );
}
