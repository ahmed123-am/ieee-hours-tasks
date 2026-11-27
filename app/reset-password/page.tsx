"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, Lock } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type PageState = "checking" | "ready" | "complete" | "invalid";

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hasRecoveryLink =
      searchParams.has("code") ||
      (hashParams.get("type") === "recovery" && hashParams.has("access_token"));
    const authError =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error_description");

    if (authError || !hasRecoveryLink) {
      setPageState("invalid");
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setPageState("ready");
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;

        if (sessionError || !data.session) {
          setPageState((current) =>
            current === "ready" ? current : "invalid"
          );
          return;
        }

        setPageState((current) =>
          current === "ready" ? current : "ready"
        );
      })
      .catch((sessionError: unknown) => {
        console.error("Password recovery session error:", sessionError);
        if (active) setPageState("invalid");
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;
    setError("");

    if (password.length < 8) {
      setError("كلمة المرور لازم تكون 8 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError("تعذر تحديث كلمة المرور. تأكد من الرابط وحاول مرة أخرى.");
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        console.warn("Password changed; local sign-out returned a warning:", signOutError);
      }

      setPageState("complete");
    } catch (updateError: unknown) {
      console.error("Password update error:", updateError);
      setError("حصل خطأ أثناء تحديث كلمة المرور. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  if (pageState === "checking") {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card register-success">
          <div className="login-logo">
            <KeyRound size={30} />
          </div>
          <h1>جارٍ التحقق من الرابط</h1>
          <p className="login-description">
            لحظة واحدة، بنتأكد من صلاحية رابط استعادة الحساب.
          </p>
        </section>
      </main>
    );
  }

  if (pageState === "complete") {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card register-success">
          <div className="login-logo">
            <CheckCircle2 size={32} />
          </div>
          <h1>تم تحديث كلمة المرور</h1>
          <p className="login-description">
            تقدر دلوقتي تسجل الدخول باستخدام كلمة المرور الجديدة.
          </p>
          <Link href="/login" className="register-back">
            الانتقال إلى تسجيل الدخول
          </Link>
        </section>
      </main>
    );
  }

  if (pageState === "invalid") {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card register-success">
          <div className="login-logo">
            <KeyRound size={30} />
          </div>
          <h1>رابط الاستعادة غير صالح</h1>
          <p className="login-description">
            ممكن يكون الرابط انتهت صلاحيته أو تم استخدامه بالفعل. اطلب رابطًا جديدًا وجرب مرة أخرى.
          </p>
          <Link href="/forgot-password" className="register-back">
            طلب رابط جديد
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
        <h1>تعيين كلمة مرور جديدة</h1>
        <p className="login-description">
          اختار كلمة مرور جديدة لحسابك، بحد أدنى 8 أحرف.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="new-password">كلمة المرور الجديدة</label>
          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 أحرف على الأقل"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
          </div>

          <label htmlFor="confirm-new-password">تأكيد كلمة المرور</label>
          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="confirm-new-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="أعد كتابة كلمة المرور"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
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
            {loading ? "جارٍ تحديث كلمة المرور..." : "حفظ كلمة المرور الجديدة"}
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
