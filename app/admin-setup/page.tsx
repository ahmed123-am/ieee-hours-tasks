
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminSetupPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function createTestHead() {
    setLoading(true);
    setResult("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setResult("سجّل الدخول إلى الموقع أولًا.");
        return;
      }

      const response = await fetch("/api/admin/create-heads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-heads-setup-token": token,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult("حدث خطأ في الاتصال. راجع Vercel Runtime Logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "60px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>إعداد حساب Head التجريبي</h1>

      <p>
        الحساب: elawadlysara57@gmail.com
        <br />
        اللجنة: PROGRAMMING
      </p>

      <label htmlFor="setup-token">مفتاح الإعداد</label>

      <input
        id="setup-token"
        type="password"
        autoComplete="off"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="أدخل HEADS_SETUP_TOKEN"
        style={{
          display: "block",
          width: "100%",
          padding: 12,
          margin: "12px 0",
          boxSizing: "border-box",
        }}
      />

      <button
        type="button"
        onClick={createTestHead}
        disabled={loading || !token.trim()}
      >
        {loading ? "جارٍ التنفيذ..." : "إنشاء الحساب التجريبي"}
      </button>

      {result && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            marginTop: 24,
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}
