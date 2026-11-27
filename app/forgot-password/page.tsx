"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setError("تعذر إرسال الطلب الآن. تأكد من البريد الإلكتروني وحاول مرة أخرى.");
        return;
      }

      // Supabase intentionally returns the same result whether an account exists or not.
      setSent(true);
    } catch (requestError: unknown) {
      console.error("Password reset request error:", requestError);
      setError("تعذر إرسال الطلب الآن. حاول مرة أخرى بعد قليل.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card register-success">
          <div className="login-logo">
            <CheckCircle2 size={32} />
          </div>

          <h1>افحص بريدك الإلكتروني</h1>

          <p className="login-description">
            لو البريد مسجل في الموقع، هتوصلك رسالة فيها رابط آمن لتعيين كلمة مرور جديدة.
          </p>

          <p className="login-note">
            راجع صندوق الرسائل غير المرغوب فيها لو الرسالة ما وصلتش.
          </p>

          <Link href="/login" className="register-back">
            الرجوع إلى تسجيل الدخول
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-logo">
          <KeyRound size={30} />
        </div>

        <span className="login-eyebrow">IEEE NDETI</span>
        <h1>استعادة كلمة المرور</h1>

        <p className="login-description">
          اكتب البريد الإلكتروني المسجل في حسابك، وهنبعتلك رابط تعيين كلمة مرور جديدة.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="reset-email">البريد الإلكتروني</label>

          <div className="login-input-wrap">
            <Mail size={19} />
            <input
              id="reset-email"
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

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "جارٍ إرسال الرابط..." : "إرسال رابط الاستعادة"}
          </button>
        </form>

        <div className="login-register">
          <Link href="/login" className="register-link">
            <ArrowRight size={17} />
            الرجوع إلى تسجيل الدخول
          </Link>
        </div>
      </section>
    </main>
  );
}
