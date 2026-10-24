
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID = "210663c5-6bac-4597-96a2-9c31ab9cfad5";
const ADMIN_EMAIL = "galilicon18@gmail.com";

const TARGETS = [
  {
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    full_name: "Galilicon",
    role: "admin",
  },
  {
    id: "a397e855-f004-4502-a458-a521c2b277b0",
    email: "yallyaahmed@gmail.com",
    full_name: "Yalla Ahmed",
    role: "board",
  },
  {
    id: "c4050030-fd5b-4dd0-b823-092c098e7ced",
    email: "seifmohamed21722172@gmail.com",
    full_name: "Seif Mohamed",
    role: "board",
  },
  {
    id: "5136496d-16a9-41df-8d74-95bce924edba",
    email: "yoys2222@gmail.com",
    full_name: "Yoys",
    role: "board",
  },
  {
    id: "b46f3b3d-dcd7-420c-891d-a87a40d9d01a",
    email: "karemeibrahim@gmail.com",
    full_name: "Kareem Ibrahim",
    role: "board",
  },
] as const;

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  const expectedToken = process.env.HEADS_SETUP_TOKEN;
  const suppliedToken = request.headers.get("x-heads-setup-token");

  if (
    !expectedToken ||
    !suppliedToken ||
    suppliedToken.length !== expectedToken.length ||
    suppliedToken !== expectedToken
  ) {
    return fail("Invalid setup token.", 401);
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
      return fail("Missing Supabase environment variables.", 500);
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(url, publishableKey, {
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
            // Cookies may be read-only in some server contexts.
          }
        },
      },
    });

    // Require a real signed-in session for the exact bootstrap admin.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Sign in to the website with the admin account first.", 401);
    }

    if (
      user.id !== ADMIN_ID ||
      user.email?.toLowerCase() !== ADMIN_EMAIL
    ) {
      return fail("This session is not the designated admin account.", 403);
    }

    // Verify every Auth account before changing either table.
    for (const target of TARGETS) {
      const { data, error } =
        await supabaseAdmin.auth.admin.getUserById(target.id);

      if (error || !data.user) {
        return fail(`Auth account not found for ${target.email}.`, 400);
      }

      if (data.user.email?.toLowerCase() !== target.email.toLowerCase()) {
        return fail(`Auth ID/email mismatch for ${target.email}.`, 400);
      }
    }

    const results: string[] = [];

    for (const target of TARGETS) {
      const now = new Date().toISOString();

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: target.id,
            email: target.email,
            full_name: target.full_name,
            role: target.role,
            is_active: true,
            approval_status: "approved",
            role_approved: true,
            requested_role: null,
            updated_at: now,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        return fail(
          `Could not save profile for ${target.email}: ${profileError.message}`,
          500
        );
      }

      // Preserve existing student hours and committee.
      const { data: existingStudent, error: studentReadError } =
        await supabaseAdmin
          .from("students")
          .select("id")
          .eq("id", target.id)
          .maybeSingle();

      if (studentReadError) {
        return fail(
          `Could not check student record for ${target.email}: ${studentReadError.message}`,
          500
        );
      }

      if (existingStudent) {
        const { error: studentUpdateError } = await supabaseAdmin
          .from("students")
          .update({
            full_name: target.full_name,
            email: target.email,
          })
          .eq("id", target.id);

        if (studentUpdateError) {
          return fail(
            `Could not update student record for ${target.email}: ${studentUpdateError.message}`,
            500
          );
        }
      } else {
        const { error: studentInsertError } = await supabaseAdmin
          .from("students")
          .insert({
            id: target.id,
            full_name: target.full_name,
            email: target.email,
            total_hours: 0,
          });

        if (studentInsertError) {
          return fail(
            `Could not create student record for ${target.email}: ${studentInsertError.message}`,
            500
          );
        }
      }

      results.push(`${target.email}: ${target.role}`);
    }

    // Verify saved roles before reporting success.
    const { data: savedProfiles, error: verifyError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,role,is_active")
      .in("id", TARGETS.map((target) => target.id));

    if (verifyError || !savedProfiles || savedProfiles.length !== TARGETS.length) {
      return fail(
        "Setup ran, but final verification failed. Check the profiles table before retrying.",
        500
      );
    }

    for (const target of TARGETS) {
      const saved = savedProfiles.find((profile) => profile.id === target.id);

      if (
        !saved ||
        saved.email?.toLowerCase() !== target.email.toLowerCase() ||
        saved.role !== target.role ||
        saved.is_active !== true
      ) {
        return fail(`Role verification failed for ${target.email}.`, 500);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Bootstrap completed and roles verified.",
      accounts: results,
      profiles_created_or_updated: savedProfiles.length,
    });
  } catch (error) {
    console.error("Setup roles failed:", error);
    return fail("Unexpected server error. Check the server logs.", 500);
  }
}
