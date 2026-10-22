
"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarDays,
  Plus,
  Users,
  Clock3,
  CheckCircle2,
  Search,
  X,
  MapPin,
  RefreshCw,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../components/LanguageProvider";

type Session = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_hours: number;
  location: string | null;
  status: string;
  organizer_id: string;
  created_by: string;
  created_at: string;
};

type Student = {
  id: string;
  full_name: string;
  committee: string | null;
  total_hours: number;
};

type AttendanceRow = {
  student_id: string;
  hours: number;
};

export default function SessionsPage() {
  const [supabase] = useState(() => createClient());
  const { language } = useLanguage();
  const ar = language === "ar";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceBySession, setAttendanceBySession] =
    useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<Session | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [hours, setHours] = useState("1");
  const [location, setLocation] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [sessionsResult, studentsResult, attendanceResult] =
        await Promise.all([
          supabase
            .from("sessions")
            .select(
              "id, title, description, starts_at, duration_hours, location, status, organizer_id, created_by, created_at"
            )
            .order("starts_at", { ascending: false }),

          supabase
            .from("students")
            .select("id, full_name, committee, total_hours")
            .order("full_name"),

          supabase
            .from("attendance")
            .select("session_id, student_id"),
        ]);

      if (sessionsResult.error) throw sessionsResult.error;
      if (studentsResult.error) throw studentsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      setSessions((sessionsResult.data ?? []) as Session[]);
      setStudents(
        ((studentsResult.data ?? []) as Student[]).map((student) => ({
          ...student,
          total_hours: Number(student.total_hours ?? 0),
        }))
      );

      const attendanceMap: Record<string, string[]> = {};

      for (const row of attendanceResult.data ?? []) {
        const item = row as { session_id: string; student_id: string };

        if (!attendanceMap[item.session_id]) {
          attendanceMap[item.session_id] = [];
        }

        attendanceMap[item.session_id].push(item.student_id);
      }

      setAttendanceBySession(attendanceMap);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر تحميل بيانات الجلسات."
            : "Could not load sessions."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, ar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error(
          ar
            ? "لازم تسجل الدخول قبل إنشاء جلسة."
            : "You must sign in before creating a session."
        );
      }

      const duration = Number(hours);

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(
          ar ? "أدخل عدد ساعات صحيحًا." : "Enter a valid duration."
        );
      }

      const result = await supabase
        .from("sessions")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          starts_at: new Date(date).toISOString(),
          duration_hours: duration,
          location: location.trim() || null,
          organizer_id: user.id,
          created_by: user.id,
        })
        .select(
          "id, title, description, starts_at, duration_hours, location, status, organizer_id, created_by, created_at"
        )
        .single();

      if (result.error) throw result.error;

      setShowModal(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setHours("1");

      setSuccess(ar ? "تم إنشاء الجلسة بنجاح." : "Session created successfully.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "فشل إنشاء الجلسة."
            : "Failed to create session."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAttendance() {
    if (!selectedSession || selectedStudents.length === 0) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const existing = await supabase
        .from("attendance")
        .select("student_id")
        .eq("session_id", selectedSession.id);

      if (existing.error) throw existing.error;

      const existingIds = new Set(
        (existing.data ?? []).map((row) => row.student_id)
      );

      const toAdd = selectedStudents.filter(
        (studentId) => !existingIds.has(studentId)
      );

      if (toAdd.length === 0) {
        setError(
          ar
            ? "كل الطلاب المحددين مسجل حضورهم بالفعل."
            : "All selected students are already marked present."
        );
        return;
      }

      const sessionHours = Number(selectedSession.duration_hours);

      const rows: AttendanceRow[] = toAdd.map((studentId) => ({
        student_id: studentId,
        hours: sessionHours,
      }));

      const inserted = await supabase
        .from("attendance")
        .insert(
          rows.map((row) => ({
            ...row,
            session_id: selectedSession.id,
          }))
        );

      if (inserted.error) throw inserted.error;

      /*
       * تحديث مجموع ساعات الطلاب بعد حفظ الحضور.
       * لو فشل تحديث طالب، سيظهر الخطأ بدل اعتباره نجاحًا كاملًا.
       */
      for (const studentId of toAdd) {
        const student = students.find((item) => item.id === studentId);
        if (!student) continue;

        const newTotal = Number(student.total_hours || 0) + sessionHours;

        const updated = await supabase
          .from("students")
          .update({ total_hours: newTotal })
          .eq("id", studentId);

        if (updated.error) {
          throw new Error(
            ar
              ? `تم حفظ الحضور، لكن تعذر تحديث ساعات ${student.full_name}: ${updated.error.message}`
              : `Attendance was saved, but hours could not be updated for ${student.full_name}: ${updated.error.message}`
          );
        }
      }

      setSelectedSession(null);
      setSelectedStudents([]);
      setSuccess(
        ar
          ? `تم تسجيل حضور ${toAdd.length} طالب وإضافة الساعات.`
          : `Attendance saved for ${toAdd.length} student(s).`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر حفظ الحضور."
            : "Could not save attendance."
      );

      // نعيد تحميل البيانات لإظهار الحالة الفعلية من قاعدة البيانات.
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  const filteredSessions = sessions.filter((session) =>
    `${session.title} ${session.description ?? ""} ${session.location ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalSessionHours = sessions.reduce(
    (sum, session) => sum + Number(session.duration_hours || 0),
    0
  );

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen space-y-6 bg-[var(--background)] p-4 text-[var(--foreground)] md:p-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "الجلسات والحضور" : "Sessions & Attendance"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {ar
              ? "إدارة الجلسات وتسجيل ساعات حضور الطلاب"
              : "Manage sessions and student attendance hours"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-3 hover:bg-[var(--hover-bg)] disabled:opacity-50"
            title={ar ? "تحديث البيانات" : "Refresh"}
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            {ar ? "إضافة جلسة" : "Add Session"}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="break-words rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="break-words rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<CalendarDays size={22} />}
          label={ar ? "إجمالي الجلسات" : "Total Sessions"}
          value={sessions.length}
        />
        <Stat
          icon={<Users size={22} />}
          label={ar ? "إجمالي الطلاب" : "Total Students"}
          value={students.length}
        />
        <Stat
          icon={<Clock3 size={22} />}
          label={ar ? "إجمالي ساعات الجلسات" : "Total Session Hours"}
          value={totalSessionHours}
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
          <Search size={18} className="text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ar ? "ابحث عن جلسة..." : "Search sessions..."}
            className="w-full bg-transparent text-[var(--text-primary)] outline-none"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-[var(--text-secondary)]">
            {ar ? "جاري تحميل البيانات..." : "Loading data..."}
          </p>
        ) : filteredSessions.length === 0 ? (
          <p className="py-10 text-center text-[var(--text-secondary)]">
            {search
              ? ar
                ? "لا توجد نتائج للبحث."
                : "No matching sessions."
              : ar
                ? "لا توجد جلسات حتى الآن."
                : "No sessions yet."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSessions.map((session) => {
              const presentIds = attendanceBySession[session.id] ?? [];

              return (
                <article
                  key={session.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                      <CalendarDays size={22} />
                    </div>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {session.duration_hours} {ar ? "ساعة" : "hours"}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold">{session.title}</h2>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                    {session.description ||
                      (ar ? "لا يوجد وصف" : "No description")}
                  </p>

                  <p className="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <CalendarDays size={16} />
                    {new Date(session.starts_at).toLocaleString(
                      ar ? "ar-EG" : "en-US",
                      { dateStyle: "medium", timeStyle: "short" }
                    )}
                  </p>

                  {session.location && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <MapPin size={16} />
                      {session.location}
                    </p>
                  )}

                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {ar ? "الحضور المسجل:" : "Attendance recorded:"}{" "}
                    <strong>{presentIds.length}</strong>
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSession(session);
                      setSelectedStudents([]);
                      setError("");
                      setSuccess("");
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-300 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <CheckCircle2 size={18} />
                    {ar ? "تسجيل الحضور" : "Record Attendance"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showModal && (
        <Modal
          title={ar ? "إضافة جلسة جديدة" : "Add New Session"}
          onClose={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <form onSubmit={createSession} className="space-y-4">
            <Field label={ar ? "اسم الجلسة" : "Session Title"}>
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]"
              />
            </Field>

            <Field label={ar ? "الوصف" : "Description"}>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]"
                rows={3}
              />
            </Field>

            <Field label={ar ? "تاريخ ووقت الجلسة" : "Session Date & Time"}>
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]"
              />
            </Field>

            <Field label={ar ? "عدد الساعات" : "Duration (hours)"}>
              <input
                required
                min="0.25"
                max="100"
                step="0.25"
                type="number"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]"
              />
            </Field>

            <Field label={ar ? "المكان (اختياري)" : "Location (optional)"}>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]"
              />
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#2563EB] p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ الجلسة"
                  : "Save Session"}
            </button>
          </form>
        </Modal>
      )}

      {selectedSession && (
        <Modal
          title={`${ar ? "تسجيل الحضور:" : "Attendance:"} ${selectedSession.title}`}
          onClose={() => {
            if (!saving) setSelectedSession(null);
          }}
        >
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            {ar
              ? `سيتم إضافة ${selectedSession.duration_hours} ساعة لكل طالب جديد يتم تسجيل حضوره.`
              : `${selectedSession.duration_hours} hour(s) will be added for each newly recorded student.`}
          </p>

          <div className="mb-4 max-h-80 space-y-2 overflow-y-auto">
            {students.map((student) => {
              const alreadyPresent = (
                attendanceBySession[selectedSession.id] ?? []
              ).includes(student.id);

              return (
                <label
                  key={student.id}
                  className={`flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 ${
                    alreadyPresent ? "opacity-60" : "cursor-pointer hover:bg-[var(--hover-bg)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={alreadyPresent}
                    checked={
                      alreadyPresent || selectedStudents.includes(student.id)
                    }
                    onChange={(event) =>
                      setSelectedStudents((previous) =>
                        event.target.checked
                          ? [...previous, student.id]
                          : previous.filter((id) => id !== student.id)
                      )
                    }
                  />

                  <span className="flex-1">
                    <span className="block font-medium">{student.full_name}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {student.committee || (ar ? "بدون لجنة" : "No committee")}
                    </span>
                  </span>

                  {alreadyPresent && (
                    <span className="text-xs font-medium text-green-700">
                      {ar ? "تم التسجيل" : "Recorded"}
                    </span>
                  )}
                </label>
              );
            })}

            {students.length === 0 && (
              <p className="py-5 text-center text-[var(--text-secondary)]">
                {ar ? "أضف الطلاب أولًا." : "Add students first."}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={saving || selectedStudents.length === 0}
            onClick={() => void saveAttendance()}
            className="w-full rounded-xl bg-[#2563EB] p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? ar
                ? "جاري تسجيل الحضور..."
                : "Saving attendance..."
              : ar
                ? "حفظ الحضور وإضافة الساعات"
                : "Save Attendance & Add Hours"}
          </button>
        </Modal>
      )}
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="rounded-xl bg-blue-100 p-3 text-blue-700">{icon}</div>
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-[var(--hover-bg)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
