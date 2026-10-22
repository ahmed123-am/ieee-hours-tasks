
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountRole = "board" | "head" | "volunteer";

type PendingProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  requested_role: AccountRole | null;
  created_at: string;
  committee: string | null;
};

const roleLabels: Record<AccountRole, string> = {
  board: "Board",
  head: "Head",
  volunteer: "Volunteer",
};

const committees = [
  "Technical",
  "HR",
  "PR",
  "Marketing",
  "Media",
  "Logistics",
  "Other",
];

export default function ApprovalsPage() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [roles, setRoles] = useState<Record<string, AccountRole>>({});
  const [selectedCommittees, setSelectedCommittees] =
    useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("سجّل الدخول أولًا.");
      setLoading(false);
      return;
    }

    const { data: currentProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role,is_active,role_approved,approval_status")
        .eq("id", authData.user.id)
        .single();

    if (profileError || !currentProfile?.is_active) {
      setError("لا تملك صلاحية الوصول إلى الصفحة.");
      setLoading(false);
      return;
    }

    const isAllowed =
      currentProfile.role === "admin" ||
      currentProfile.role === "secretary" ||
      (currentProfile.role === "board" &&
        currentProfile.role_approved === true &&
        currentProfile.approval_status === "approved");

    if (!isAllowed) {
      setError("صفحة اعتماد الحسابات متاحة للـ Board فقط.");
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,requested_role,created_at,committee"
      )
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setProfiles([]);
    } else {
      const pending = (data ?? []) as PendingProfile[];
      setProfiles(pending);

      setRoles((previous) => {
        const next = { ...previous };

        pending.forEach((profile) => {
          if (!next[profile.id]) {
            next[profile.id] =
              profile.requested_role &&
              ["board", "head", "volunteer"].includes(
                profile.requested_role
              )
                ? profile.requested_role
                : "volunteer";
          }
        });

        return next;
      });
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function approveProfile(profile: PendingProfile) {
    const role = roles[profile.id] ?? "volunteer";
    const committee = selectedCommittees[profile.id] ?? "";

    if (role === "head" && !committee.trim()) {
      setError("اختار اللجنة الخاصة بالـ Head أولًا.");
      return;
    }

    const confirmed = window.confirm(
      `هل تريد اعتماد ${profile.full_name || profile.email} بدور ${roleLabels[role]}؟`
    );

    if (!confirmed) return;

    setBusyId(profile.id);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "approve_profile_request",
      {
        target_user_id: profile.id,
        approved_role: role,
        approved_committee: role === "head" ? committee : null,
      }
    );

    if (rpcError) {
      setError(`فشل اعتماد الحساب: ${rpcError.message}`);
    } else {
      setSuccess(
        `تم اعتماد حساب ${profile.full_name || profile.email} بنجاح.`
      );
      await loadProfiles();
    }

    setBusyId(null);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-400">
              IEEE NDETI Student Branch
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">
              اعتماد الحسابات
            </h1>
            <p className="mt-2 text-slate-400">
              راجع طلبات التسجيل وحدد الدور النهائي لكل عضو.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadProfiles()}
            disabled={loading || busyId !== null}
            className="rounded-xl border border-slate-700 px-5 py-3 transition hover:bg-slate-800 disabled:opacity-50"
          >
            تحديث القائمة
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
          >
            {success}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              طلبات التسجيل المعلقة
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
              {profiles.length} طلب
            </span>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            جاري تحميل الحسابات...
          </div>
        ) : profiles.length === 0 && !error ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mb-3 text-4xl">✓</div>
            <h2 className="text-xl font-semibold">
              لا توجد طلبات معلقة
            </h2>
            <p className="mt-2 text-slate-400">
              ستظهر طلبات التسجيل الجديدة هنا.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {profiles.map((profile) => {
              const role = roles[profile.id] ?? "volunteer";
              const isBusy = busyId === profile.id;

              return (
                <article
                  key={profile.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
                >
                  <div className="mb-5">
                    <h3 className="text-xl font-bold">
                      {profile.full_name || "بدون اسم"}
                    </h3>
                    <p className="mt-1 break-all text-sm text-slate-400">
                      {profile.email || "لا يوجد بريد إلكتروني"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      تاريخ التسجيل:{" "}
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString(
                            "ar-EG"
                          )
                        : "غير متاح"}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      الدور المطلوب:{" "}
                      {profile.requested_role
                        ? roleLabels[profile.requested_role]
                        : "Volunteer"}
                    </p>
                  </div>

                  <label
                    htmlFor={`role-${profile.id}`}
                    className="mb-2 block text-sm text-slate-300"
                  >
                    الدور النهائي
                  </label>

                  <select
                    id={`role-${profile.id}`}
                    value={role}
                    disabled={isBusy || busyId !== null}
                    onChange={(event) => {
                      const value = event.target.value as AccountRole;
                      setRoles((previous) => ({
                        ...previous,
                        [profile.id]: value,
                      }));
                    }}
                    className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                  >
                    <option value="board">Board</option>
                    <option value="head">Head</option>
                    <option value="volunteer">Volunteer</option>
                  </select>

                  {role === "head" && (
                    <>
                      <label
                        htmlFor={`committee-${profile.id}`}
                        className="mb-2 block text-sm text-slate-300"
                      >
                        اللجنة
                      </label>
                      <select
                        id={`committee-${profile.id}`}
                        value={selectedCommittees[profile.id] ?? ""}
                        disabled={isBusy || busyId !== null}
                        onChange={(event) =>
                          setSelectedCommittees((previous) => ({
                            ...previous,
                            [profile.id]: event.target.value,
                          }))
                        }
                        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                      >
                        <option value="">اختر اللجنة</option>
                        {committees.map((committee) => (
                          <option key={committee} value={committee}>
                            {committee}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => void approveProfile(profile)}
                    disabled={busyId !== null}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBusy ? "جاري الاعتماد..." : "اعتماد الحساب"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
