
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

const roleLabels: Record<string, { ar: string; en: string }> = {
  admin: { ar: "مدير النظام", en: "Administrator" },
  secretary: { ar: "أمين الفرع", en: "Secretary" },
  board: { ar: "مجلس إدارة الفرع", en: "Board" },
  head: { ar: "مسؤول لجنة", en: "Head" },
  volunteer: { ar: "متطوع", en: "Volunteer" },
  student: { ar: "طالب", en: "Student" },
};

export default function SettingsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const t = (arabic: string, english: string) => (isArabic ? arabic : english);

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
      setError(t("اكتب الاسم قبل الحفظ.", "Enter a name before saving."));
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
      setError(
        t(
          "انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.",
          "Your sign-in session has expired. Please sign in again."
        )
      );
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
      setError(
        `${t("فشل حفظ الاسم: ", "Failed to save name: ")}${updateError.message}`
      );
      setSaving(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: trimmedName },
    });

    setProfile(data as Profile);
    setFullName(trimmedName);
    window.dispatchEvent(
      new CustomEvent("ieee-profile-updated", {
        detail: { id: authData.user.id, full_name: trimmedName },
      })
    );

    if (metadataError) {
      setSuccess(
        t(
          "تم حفظ الاسم في ملف الحساب. تعذر تحديث بيانات Auth الإضافية.",
          "The name was saved to your profile, but the additional Auth metadata could not be updated."
        )
      );
    } else {
      setSuccess(t("تم حفظ بيانات الحساب بنجاح.", "Account information saved."));
    }

    setSaving(false);
  }

  async function handleSignOut() {
    setLoggingOut(true);
    setError("");

    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(
        `${t("تعذر تسجيل الخروج: ", "Could not sign out: ")}${signOutError.message}`
      );
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="p-8 text-center text-slate-500">
        {t("جارٍ تحميل الإعدادات...", "Loading settings...")}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-8">
        <p className="text-red-500">
          {error || t("تعذر العثور على بيانات الحساب.", "Account information could not be found.")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{t("الإعدادات", "Settings")}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("إدارة بيانات حسابك وجلسة تسجيل الدخول.", "Manage your account details and session.")}
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
        <h2 className="mb-5 text-xl font-semibold">{t("بيانات الحساب", "Account Information")}</h2>

        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium"
            >
              {t("الاسم الكامل", "Full Name")}
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
              maxLength={100}
              disabled={saving}
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("البريد الإلكتروني", "Email")}
            </label>
            <input
              value={profile.email ?? ""}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t("البريد الإلكتروني للعرض فقط.", "Email is read-only.")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("نوع الحساب", "Account Role")}
              </label>
              <input
                value={roleLabels[profile.role]?.[language] ?? profile.role}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("حالة الحساب", "Account Status")}
              </label>
              <input
                value={
                  profile.is_active
                    ? t("نشط", "Active")
                    : t("غير نشط", "Inactive")
                }
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
            {saving
              ? t("جارٍ الحفظ...", "Saving...")
              : t("حفظ التغييرات", "Save Changes")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t("تسجيل الخروج", "Sign Out")}</h2>
        <p className="mt-2 mb-5 text-sm text-slate-500">
          {t(
            "تسجيل الخروج من حسابك على هذا الجهاز.",
            "Sign out of your account on this device."
          )}
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut
            ? t("جارٍ تسجيل الخروج...", "Signing out...")
            : t("تسجيل الخروج", "Sign Out")}
        </button>
      </section>
    </main>
  );
}
