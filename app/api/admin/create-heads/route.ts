
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_HEAD = {
  email: "elawadlysara57@gmail.com",
  committee: "PROGRAMMING",
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    // 1. Validate the temporary setup token.
    const token = request.headers.get("x-heads-setup-token");
    const expectedToken = process.env.HEADS_SETUP_TOKEN;

    if (
      !expectedToken ||
      !token ||
      token.length !== expectedToken.length ||
      token !== expectedToken
    ) {
      return jsonError("Unauthorized.", 401);
    }

    // 2. Validate public Supabase configuration.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
      return jsonError(
        "Supabase environment variables are missing.",
        500
      );
    }

    // 3. Read the current browser session from cookies.
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
            // Some route contexts do not allow cookie writes.
          }
        },
      },
    });

    // 4. Require a valid signed-in user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(
        "Sign in with the admin account first.",
        401
      );
    }

    // 5. Verify the active admin/secretary role in the database.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.is_active !== true ||
      !["admin", "secretary"].includes(profile.role)
    ) {
      return jsonError(
        "An active admin or secretary account is required.",
        403
      );
    }

    // 6. Read the temporary password only on the server.
    const password = process.env.HEADS_TEMP_PASSWORD;

    if (!password || password.length < 10) {
      return jsonError(
        "Temporary password configuration is missing or invalid.",
        500
      );
    }

    // 7. Check whether the account already exists.
    // Never overwrite its password or modify an existing account.
    const { data: usersPage, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return jsonError(
        "Could not check existing accounts.",
        500
      );
    }

    const existingUser = usersPage.users.find(
      (item) =>
        item.email?.toLowerCase() ===
        TEST_HEAD.email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json({
        status: "already_exists",
        email: TEST_HEAD.email,
        message:
          "The Auth account already exists. No changes were made.",
      });
    }

    // 8. Create only the designated test Head.
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: TEST_HEAD.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: TEST_HEAD.email.split("@")[0],
          committee: TEST_HEAD.committee,
        },
      });

    if (createError || !created.user) {
      return jsonError(
        createError?.message ?? "Account creation failed.",
        400
      );
    }

    // 9. Verify the database trigger created the profile.
    const { data: newProfile, error: newProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, email, role, committee, is_active")
        .eq("id", created.user.id)
        .maybeSingle();

    if (newProfileError || !newProfile) {
      return NextResponse.json(
        {
          status: "created_but_verification_failed",
          email: TEST_HEAD.email,
          message:
            "The Auth account was created, but its profile could not be verified. Do not retry; inspect the database first.",
        },
        { status: 500 }
      );
    }

    // 10. Verify the student record.
    const { data: newStudent, error: studentError } =
      await supabaseAdmin
        .from("students")
        .select("id, email, committee")
        .eq("id", created.user.id)
        .maybeSingle();

    if (studentError || !newStudent) {
      return NextResponse.json(
        {
          status: "created_but_verification_failed",
          email: TEST_HEAD.email,
          message:
            "The Auth account and profile exist, but the student record could not be verified. Do not retry; inspect the database first.",
        },
        { status: 500 }
      );
    }

    // 11. Confirm the actual role, committee and active status.
    if (
      newProfile.role !== "head" ||
      newProfile.committee !== TEST_HEAD.committee ||
      newProfile.is_active !== true ||
      newStudent.committee !== TEST_HEAD.committee
    ) {
      return NextResponse.json(
        {
          status: "created_but_configuration_mismatch",
          email: TEST_HEAD.email,
          profileRole: newProfile.role,
          profileCommittee: newProfile.committee,
          profileActive: newProfile.is_active,
          studentCommittee: newStudent.committee,
          message:
            "The account exists, but its role or committee is incorrect. Do not retry creation.",
        },
        { status: 500 }
      );
    }

    // 12. Return a success response only after all checks pass.
    return NextResponse.json({
      status: "created_and_verified",
      email: TEST_HEAD.email,
      role: newProfile.role,
      committee: newProfile.committee,
      profileVerified: true,
      studentVerified: true,
    });
  } catch {
    return jsonError("Unexpected server error.", 500);
  }
}
