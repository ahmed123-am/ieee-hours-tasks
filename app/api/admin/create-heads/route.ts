
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TEST_HEAD = {
  email: "elawadlysara57@gmail.com",
  committee: "PROGRAMMING",
};

export async function POST(request: Request) {
  try {
    // 1. Verify setup token.
    const token = request.headers.get("x-heads-setup-token");
    const expectedToken = process.env.HEADS_SETUP_TOKEN;

    if (!expectedToken || !token || token !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Validate public Supabase configuration.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
      return NextResponse.json(
        { error: "Supabase configuration is missing." },
        { status: 500 }
      );
    }

    // 3. Create authenticated server client.
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
            // Cookies can be read-only in some contexts.
          }
        },
      },
    });

    // 4. Verify current user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in with the admin account first." },
        { status: 401 }
      );
    }

    // 5. Verify active admin/secretary role.
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
      return NextResponse.json(
        { error: "An active admin or secretary is required." },
        { status: 403 }
      );
    }

    // 6. Read temporary password from server environment.
    const password = process.env.HEADS_TEMP_PASSWORD;

    if (!password || password.length < 10) {
      return NextResponse.json(
        { error: "Temporary password configuration is missing or invalid." },
        { status: 500 }
      );
    }

    // 7. Find existing account. Do not reset or overwrite it.
    const { data: usersPage, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return NextResponse.json(
        { error: "Could not check existing accounts." },
        { status: 500 }
      );
    }

    const existingUser = usersPage.users.find(
      (item) =>
        item.email?.toLowerCase() === TEST_HEAD.email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json({
        status: "already_exists",
        email: TEST_HEAD.email,
        message:
          "The Auth account already exists. No password or profile was changed.",
      });
    }

    // 8. Create the test account.
    // The handle_new_user trigger should create profiles and students.
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
      return NextResponse.json(
        { error: createError?.message ?? "Account creation failed." },
        { status: 400 }
      );
    }

    // 9. Verify profile created by the database trigger.
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
            "Auth account was created, but its profile could not be verified. Do not retry creation; inspect the database first.",
        },
        { status: 500 }
      );
    }

    // 10. Verify student record.
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
            "Auth and profile exist, but the student record could not be verified. Do not retry creation; inspect the database first.",
        },
        { status: 500 }
      );
    }

    // 11. Confirm the actual assigned role and committee.
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
          studentCommittee: newStudent.committee,
          message:
            "The account exists, but its role or committee is incorrect. Do not retry creation.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "created_and_verified",
      email: TEST_HEAD.email,
      role: newProfile.role,
      committee: newProfile.committee,
      profileVerified: true,
      studentVerified: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
