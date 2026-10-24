
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Mail, Lock, UserPlus } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError || !data.user) {
        setError(
          loginError?.message || "تعذر تسجيل الدخول. حاول مرة أخرى."
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active, approval_status, role_approved")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setError(
          `تم تسجيل الدخول، لكن تعذر التحقق من صلاحيات الحساب: ${profileError.message}`
        );
        await supabase.auth.signOut();
        return;
      }

      if (!profile) {
        setError("لم يتم العثور على ملف الحساب. تواصل مع مسؤول الفرع.");
        await supabase.auth.signOut();
        return;
      }

      const legacyStaff = ["admin", "secretary"].includes(profile.role);
      const approvedMember =
        ["board", "head", "volunteer"].includes(profile.role) &&
        profile.role_approved === true &&
        profile.approval_status === "approved";

      if (!profile.is_active || (!legacyStaff && !approvedMember)) {
        await supabase.auth.signOut();
        setError(
          "حسابك غير معتمد أو موقوف حاليًا. تواصل مع مسؤول الفرع."
        );
        return;
      }

      // Full navigation ensures the server reads the latest auth cookies.
      window.location.assign("/");
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ غير متوقع. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-logo">
          <LogIn size={30} />
        </div>

        <span className="login-eyebrow">IEEE NDETI</span>
        <h1>تسجيل الدخول</h1>

        <p className="login-description">
          سجّل دخولك للوصول إلى لوحة إدارة ساعات ومهام الطلاب.
        </p>

        <form onSubmit={handleLogin} className="login-form">
          <label htmlFor="email">البريد الإلكتروني</label>

          <div className="login-input-wrap">
            <Mail size={19} />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          <label htmlFor="password">كلمة المرور</label>

          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "جارٍ تسجيل الدخول..." : "دخول"}
          </button>
        </form>

        <div className="login-register">
          <span>ليس لديك حساب؟</span>
          <Link href="/register" className="register-link">
            <UserPlus size={17} />
            إنشاء حساب جديد
          </Link>
        </div>

        <p className="login-note">
          الدخول مخصص للأعضاء المعتمدين فقط.
        </p>
      </section>
    </main>
  );
}
