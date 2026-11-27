
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  UserPlus,
  Mail,
  Lock,
  CheckCircle2,
  ArrowRight,
  Users,
  UserRound,
  Building2,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";

const COMMITTEES = [
  "CORE",
  "HR",
  "PR",
  "LOGISTICS",
  "PROGRAMMING",
  "MEDIA",
] as const;

type Committee = (typeof COMMITTEES)[number];

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [committee, setCommittee] = useState<Committee[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] =
    useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 3) {
      setError("اكتب اسمك الكامل، ويجب ألا يقل عن 3 أحرف.");
      return;
    }

    if (
      committee.length !== 2 ||
      committee.some((item) => !COMMITTEES.includes(item))
    ) {
      setError("اختار لجنتين بالضبط.");
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
              committee: committee.join(","),
              requested_role: "volunteer",
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
        setError("لم يرجع نظام التسجيل بيانات الحساب. حاول مرة أخرى.");
        return;
      }

      setNeedsEmailConfirmation(!data.session);
      setSuccess(true);
    } catch (err: unknown) {
      console.error("Registration error:", err);
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

          <h1>تم إنشاء الحساب بنجاح</h1>

          <p className="login-description">
            أهلًا يا {fullName.trim()}، تم تسجيل حسابك باستخدام البريد:
            {" "}
            {email.trim().toLowerCase()}
          </p>

          <p className="login-description">
            اللجنتان المختارتان: <strong>{committee.join("، ")}</strong>
          </p>

          {needsEmailConfirmation && (
            <p className="login-note">
              افتح بريدك الإلكتروني واضغط على رابط تأكيد الحساب
              إذا وصلتك رسالة التأكيد.
            </p>
          )}

          <p className="login-note">
            نوع الحساب الافتراضي هو Volunteer. اختيار اللجنة لا يمنح
            صلاحيات إدارية.
          </p>

          <Link href="/login" className="register-back">
            الانتقال إلى تسجيل الدخول
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
          اكتب بياناتك واختار لجنتين تحب تنضم ليهم.
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
              disabled={loading}
            />
          </div>

          <fieldset
            className="committee-choices"
            aria-describedby="register-committee-help"
            disabled={loading}
          >
            <legend>اختار لجنتين</legend>

            <div className="committee-options">
              {COMMITTEES.map((item) => {
                const checked = committee.includes(item);
                const limitReached = committee.length >= 2;

                return (
                  <label
                    key={item}
                    className={`committee-option ${checked ? "is-selected" : ""} ${!checked && limitReached ? "is-disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="committee"
                      value={item}
                      checked={checked}
                      disabled={loading || (!checked && limitReached)}
                      onChange={() =>
                        setCommittee((previous) =>
                          checked
                            ? previous.filter((selected) => selected !== item)
                            : previous.length < 2
                              ? [...previous, item]
                              : previous
                        )
                      }
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>

            <p id="register-committee-help" className="committee-choice-hint" aria-live="polite">
              اختار لجنتين بالضبط ({committee.length}/2)
            </p>
          </fieldset>

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
              disabled={loading}
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
              disabled={loading}
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
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
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
            {loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب"}
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
          <Users size={15} className="inline-block ml-1" />
          IEEE NDETI — ساعات ومهام الطلاب.
        </p>
      </section>
    </main>
  );
}
