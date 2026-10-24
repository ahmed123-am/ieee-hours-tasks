
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
    // 1. Verify the temporary setup token.
    const token = request.headers.get("x-heads-setup-token");
    const expectedToken = process.env.HEADS_SETUP_TOKEN;

    if (!expectedToken || !token || token !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Create the authenticated Supabase server client.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      supabaseUrl,
      publishableKey,
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

    // 3. Require a valid logged-in user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to the website first." },
        { status: 401 }
      );
    }

    // 4. Require an active admin or secretary.
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
        { error: "An active admin or secretary account is required." },
        { status: 403 }
      );
    }

    // 5. Read the temporary password from server environment variables.
    const password = process.env.HEADS_TEMP_PASSWORD;

    if (!password || password.length < 10) {
      return NextResponse.json(
        { error: "Temporary password is missing or too short." },
        { status: 500 }
      );
    }

    // 6. Check whether the test account already exists.
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
      (existing) =>
        existing.email?.toLowerCase() ===
        TEST_HEAD.email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json({
        message: "Account already exists; no changes were made.",
        email: TEST_HEAD.email,
        committee: TEST_HEAD.committee,
        status: "already_exists",
      });
    }

    // 7. Create the test account.
    const { data, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: TEST_HEAD.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: TEST_HEAD.email.split("@")[0],
          committee: TEST_HEAD.committee,
        },
      });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message:
        "Test account created. Verify profiles and students before continuing.",
      email: data.user.email,
      committee: TEST_HEAD.committee,
      status: "created",
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
