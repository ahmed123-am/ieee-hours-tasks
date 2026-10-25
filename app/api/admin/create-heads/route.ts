
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

function fail(error: string, status = 400, extra?: object) {
  return NextResponse.json(
    { success: false, error, ...extra },
    { status }
  );
}

function safeDbError(error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}) {
  // Never return keys, tokens, or request headers.
  return {
    code: error.code ?? null,
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
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
            // Cookie writes may not be available in every server context.
          }
        },
      },
    });

    // Authenticate the caller using the current website session.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail(
        "Sign in to the website with the designated admin account first.",
        401
      );
    }

    if (
      user.id !== ADMIN_ID ||
      user.email?.toLowerCase() !== ADMIN_EMAIL
    ) {
      return fail("This session is not the designated admin account.", 403);
    }

    // Verify all five Auth accounts before changing database records.
    for (const target of TARGETS) {
      const { data, error } =
        await supabaseAdmin.auth.admin.getUserById(target.id);

      if (error || !data.user) {
        return fail(
          `Auth account not found for ${target.email}.`,
          400,
          { authError: error ? safeDbError(error) : null }
        );
      }

      if (
        data.user.email?.toLowerCase() !== target.email.toLowerCase()
      ) {
        return fail(`Auth ID/email mismatch for ${target.email}.`, 400);
      }
    }

    const results: string[] = [];

    for (const target of TARGETS) {
      const now = new Date().toISOString();

      // Save the role using the server-only admin client.
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
        const dbError = safeDbError(profileError);

        console.error("Profile upsert failed:", {
          email: target.email,
          ...dbError,
        });

        return fail(
          `Could not save profile for ${target.email}.`,
          500,
          { databaseError: dbError }
        );
      }

      // Check whether the student record already exists.
      const { data: existingStudent, error: studentReadError } =
        await supabaseAdmin
          .from("students")
          .select("id")
          .eq("id", target.id)
          .maybeSingle();

      if (studentReadError) {
        const dbError = safeDbError(studentReadError);

        console.error("Student lookup failed:", {
          email: target.email,
          ...dbError,
        });

        return fail(
          `Could not check student record for ${target.email}.`,
          500,
          { databaseError: dbError }
        );
      }

      if (existingStudent) {
        // Keep the student's existing total_hours and committee.
        const { error: studentUpdateError } = await supabaseAdmin
          .from("students")
          .update({
            full_name: target.full_name,
            email: target.email,
          })
          .eq("id", target.id);

        if (studentUpdateError) {
          const dbError = safeDbError(studentUpdateError);

          console.error("Student update failed:", {
            email: target.email,
            ...dbError,
          });

          return fail(
            `Could not update student record for ${target.email}.`,
            500,
            { databaseError: dbError }
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
          const dbError = safeDbError(studentInsertError);

          console.error("Student insert failed:", {
            email: target.email,
            ...dbError,
          });

          return fail(
            `Could not create student record for ${target.email}.`,
            500,
            { databaseError: dbError }
          );
        }
      }

      results.push(`${target.email}: ${target.role}`);
    }

    // Verify the five expected profiles and roles.
    const { data: savedProfiles, error: verifyError } =
      await supabaseAdmin
        .from("profiles")
        .select("id,email,role,is_active")
        .in(
          "id",
          TARGETS.map((target) => target.id)
        );

    if (verifyError) {
      const dbError = safeDbError(verifyError);

      console.error("Profile verification failed:", dbError);

      return fail(
        "Could not verify saved profiles.",
        500,
        { databaseError: dbError }
      );
    }

    if (!savedProfiles || savedProfiles.length !== TARGETS.length) {
      return fail(
        "Not all five profiles were found after setup.",
        500,
        {
          expected: TARGETS.length,
          found: savedProfiles?.length ?? 0,
        }
      );
    }

    for (const target of TARGETS) {
      const saved = savedProfiles.find(
        (profile) => profile.id === target.id
      );

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
