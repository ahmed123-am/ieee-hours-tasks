
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

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        console.error("Login error:", loginError.message);
        setError(loginError.message);
        return;
      }

      if (!data.user) {
        setError("لم يتم العثور على بيانات المستخدم بعد تسجيل الدخول.");
        return;
      }

       window.location.replace("/");
       
    } catch (err: unknown) {
      console.error("Unexpected login error:", err);

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

        <form
          onSubmit={handleLogin}
          className="login-form"
        >
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
          الدخول مخصص للأعضاء المصرح لهم فقط.
        </p>
      </section>
    </main>
  );
}
