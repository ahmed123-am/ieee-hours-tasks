
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const heads = [
  { email: "mhmdmrwf863@gmail.com", committee: "CORE" },
  { email: "reemtamer02@gmail.com", committee: "CORE" },
  { email: "mariamhanyjm2670@gmail.com", committee: "HR" },
  { email: "mohammedosama2486@gmail.com", committee: "HR" },
  { email: "nourfhed@gmail.com", committee: "PR" },
  { email: "aboanis541@gmail.com", committee: "LOGISTICS" },
  { email: "mennaakrab180@gmail.com", committee: "LOGISTICS" },
  { email: "rawahamed2025@gmail.com", committee: "MEDIA" },
  { email: "karolene221@gmail.com", committee: "MEDIA" },
  { email: "elawadlysara57@gmail.com", committee: "PROGRAMMING" },
  { email: "Omar212hossam@gmail.com", committee: "PROGRAMMING" },
];

export async function POST() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookies may be read-only in this context.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.is_active ||
      !["admin", "secretary"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية إنشاء الحسابات." },
        { status: 403 }
      );
    }

    const password = process.env.HEADS_TEMP_PASSWORD;

    if (!password || password.length < 10) {
      return NextResponse.json(
        { error: "كلمة المرور المؤقتة غير مضبوطة على الخادم." },
        { status: 500 }
      );
    }

    const results = [];

    for (const head of heads) {
      const { data, error } =
        await supabaseAdmin.auth.admin.createUser({
          email: head.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: head.email.split("@")[0],
            committee: head.committee,
          },
        });

      if (error) {
        results.push({
          email: head.email,
          committee: head.committee,
          status: "failed",
          reason: error.message,
        });
        continue;
      }

      results.push({
        email: head.email,
        committee: head.committee,
        status: "created",
        userId: data.user.id,
      });
    }

    return NextResponse.json({
      message: "انتهت محاولة إنشاء الحسابات.",
      results,
    });
  } catch {
    return NextResponse.json(
      { error: "حدث خطأ داخلي أثناء إنشاء الحسابات." },
      { status: 500 }
    );
  }
}
