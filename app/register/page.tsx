
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  UserPlus,
  Mail,
  Lock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
  HandHelping,
  UserRound,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type AccountRole = "board" | "head" | "volunteer";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("volunteer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] =
    useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 3) {
      setError("اكتب اسمك الكامل، ويجب ألا يقل عن 3 أحرف.");
      return;
    }

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

      const { data, error: registerError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              requested_role: role,
            },
          },
        });

      if (registerError) {
        setError(
          registerError.message === "User already registered"
            ? "البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول."
            : registerError.message
        );
        return;
      }

      if (!data.user) {
        setError(
          "لم يرجع نظام التسجيل بيانات الحساب. حاول مرة أخرى."
        );
        return;
      }

      setNeedsEmailConfirmation(!data.session);
      setSuccess(true);
    } catch {
      setError("حصل خطأ أثناء إنشاء الحساب. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="login-page" dir="rtl">
        <section className="login-card register-success">
          <div className="login-logo">
            <CheckCircle2 size={32} />
          </div>

          <h1>تم إنشاء طلب التسجيل بنجاح</h1>

          <p className="login-description">
            أهلًا يا {fullName.trim()}، تم إرسال طلب التسجيل
            بالبريد الإلكتروني: {email.trim().toLowerCase()}
          </p>

          {needsEmailConfirmation && (
            <p className="login-note">
              افتح بريدك الإلكتروني واضغط على رابط تأكيد الحساب
              إذا وصلتك رسالة التأكيد.
            </p>
          )}

          <p className="login-description">
            الدور المطلوب: <strong>{role.toUpperCase()}</strong>
          </p>

          <p className="login-note">
            حسابك يحتاج إلى موافقة الـ Board قبل تفعيل صلاحياته.
            لا تحاول الدخول للوحة التحكم قبل الاعتماد.
          </p>

          <Link href="/login" className="register-back">
            العودة إلى تسجيل الدخول
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-logo">
          <UserPlus size={30} />
        </div>

        <span className="login-eyebrow">IEEE NDETI</span>

        <h1>إنشاء حساب جديد</h1>

        <p className="login-description">
          اكتب اسمك الكامل واختر نوع الحساب المطلوب.
          سيعتمد الـ Board الحساب قبل تفعيل الصلاحيات.
        </p>

        <form onSubmit={handleRegister} className="login-form">
          <label htmlFor="register-full-name">الاسم الكامل</label>

          <div className="login-input-wrap">
            <UserRound size={19} />
            <input
              id="register-full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="اكتب اسمك بالكامل"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              minLength={3}
              maxLength={100}
              required
            />
          </div>

          <label>نوع الحساب</label>

          <div className="register-role-options">
            <label
              className={`register-role-option ${
                role === "board" ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value="board"
                checked={role === "board"}
                onChange={() => setRole("board")}
              />
              <ShieldCheck size={22} />
              <span>Board</span>
              <small>عضو مجلس الإدارة</small>
            </label>

            <label
              className={`register-role-option ${
                role === "head" ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value="head"
                checked={role === "head"}
                onChange={() => setRole("head")}
              />
              <Users size={22} />
              <span>Head</span>
              <small>رئيس لجنة</small>
            </label>

            <label
              className={`register-role-option ${
                role === "volunteer" ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value="volunteer"
                checked={role === "volunteer"}
                onChange={() => setRole("volunteer")}
              />
              <HandHelping size={22} />
              <span>Volunteer</span>
              <small>متطوع</small>
            </label>
          </div>

          <label htmlFor="register-email">البريد الإلكتروني</label>

          <div className="login-input-wrap">
            <Mail size={19} />
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <label htmlFor="register-password">كلمة المرور</label>

          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 أحرف على الأقل"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <label htmlFor="confirm-password">
            تأكيد كلمة المرور
          </label>

          <div className="login-input-wrap">
            <Lock size={19} />
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="أعد كتابة كلمة المرور"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "جارٍ إنشاء الحساب..." : "إرسال طلب التسجيل"}
          </button>
        </form>

        <div className="login-register">
          <span>عندك حساب بالفعل؟</span>
          <Link href="/login" className="register-link">
            <ArrowRight size={17} />
            تسجيل الدخول
          </Link>
        </div>

        <p className="login-note">
          IEEE NDETI — صلاحيات الحساب لا تُمنح إلا بعد اعتمادها.
        </p>
      </section>
    </main>
  );
}
