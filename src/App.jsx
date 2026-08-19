import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Home, Clock, NotebookPen, HeartHandshake, Users, Bell, Trophy,
  BarChart3, User, Play, Pause, RotateCcw, Flame, CheckCircle2,
  Circle, Search, Plus, X, Award, Calendar, Sparkles, Link2, Menu,
  Trash2, ChevronRight, Sunrise, PlusCircle, BookMarked, TrendingUp,
  Pencil, Save, Copy, LogOut, Mail, UserX, UserPlus, Check, AlertTriangle, Lock,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { supabase, supabaseConfigured } from "./supabaseClient";

/* ============================= CONSTANTS ============================= */

const DEFAULT_CATEGORIES = [
  "Intercession", "Thanksgiving", "Worship",
  "Meditation", "Scripture Reading", "Petition",
];

const CATEGORY_COLORS = {
  "Intercession": "#96727E",
  "Thanksgiving": "#C7963C",
  "Worship": "#2F3A56",
  "Meditation": "#83987F",
  "Scripture Reading": "#6E85A8",
  "Petition": "#A66A47",
};
const FALLBACK_COLORS = ["#8C8672", "#B08BA0", "#7C9E86", "#A98A50"];

const VERSES = [
  { text: "Pray without ceasing.", ref: "1 Thessalonians 5:17" },
  { text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", ref: "Matthew 7:7" },
  { text: "The effectual fervent prayer of a righteous man availeth much.", ref: "James 5:16" },
  { text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.", ref: "Philippians 4:6" },
  { text: "And all things, whatsoever ye shall ask in prayer, believing, ye shall receive.", ref: "Matthew 21:22" },
  { text: "If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven.", ref: "2 Chronicles 7:14" },
  { text: "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.", ref: "Jeremiah 33:3" },
  { text: "In the morning will I direct my prayer unto thee, and will look up.", ref: "Psalm 5:3" },
  { text: "Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.", ref: "Hebrews 4:16" },
  { text: "The Lord is nigh unto all them that call upon him, to all that call upon him in truth.", ref: "Psalm 145:18" },
];

const AVATARS = ["🕊️", "🌿", "✨", "🕯️", "🌅", "📖", "🙏", "⛲"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ============================= HELPERS ============================= */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const toKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const startOfWeek = (d) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const formatHrs = (mins) => (mins / 60).toFixed(1);

const catColor = (cat, customList) => {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const idx = customList.indexOf(cat) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx < 0 ? 0 : idx];
};

/* ---------- streak + stats ---------- */

function computeDayTotals(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const k = toKey(s.date);
    map[k] = (map[k] || 0) + s.duration;
  });
  return map;
}

function computeCurrentStreak(sessions) {
  const dayTotals = computeDayTotals(sessions);
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!dayTotals[toKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dayTotals[toKey(cursor)]) return 0;
  }
  let streak = 0;
  while (dayTotals[toKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeLongestStreak(sessions) {
  const dayTotals = computeDayTotals(sessions);
  const keys = Object.keys(dayTotals).sort();
  if (!keys.length) return 0;
  let longest = 1, run = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const cur = new Date(keys[i]);
    const diffDays = Math.round((cur - prev) / 86400000);
    if (diffDays === 1) { run += 1; } else { run = 1; }
    longest = Math.max(longest, run);
  }
  return longest;
}

function computeStats(sessions) {
  const totalMinutes = sessions.reduce((a, s) => a + s.duration, 0);
  const byCategory = {};
  sessions.forEach((s) => { byCategory[s.category] = (byCategory[s.category] || 0) + s.duration; });
  let mostCommon = null, mostCount = 0;
  const countByCategory = {};
  sessions.forEach((s) => { countByCategory[s.category] = (countByCategory[s.category] || 0) + 1; });
  Object.entries(countByCategory).forEach(([cat, count]) => {
    if (count > mostCount) { mostCount = count; mostCommon = cat; }
  });
  return {
    totalMinutes,
    totalHours: totalMinutes / 60,
    avgSessionMin: sessions.length ? totalMinutes / sessions.length : 0,
    mostCommonCategory: mostCommon,
    byCategory,
    currentStreak: computeCurrentStreak(sessions),
    longestStreak: computeLongestStreak(sessions),
    sessionCount: sessions.length,
  };
}

function weekMinutes(sessions, weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return sessions
    .filter((s) => {
      const d = new Date(s.date);
      return d >= weekStart && d < weekEnd;
    })
    .reduce((a, s) => a + s.duration, 0);
}

/* ============================= DEFAULTS ============================= */
// Real accounts start empty and are populated from Supabase; each panel
// already renders an EmptyState when its list has no rows.

const CHALLENGE = {
  title: "30 Days of Faithfulness",
  goalHours: 100,
  endsInDays: 9,
};

/* ============================= BADGES ============================= */

const BADGES = [
  { id: "first", title: "First step", desc: "Log your first session", icon: Sunrise,
    check: (s) => s.sessionCount >= 1 },
  { id: "week", title: "Week of faith", desc: "Reach a 7-day streak", icon: Flame,
    check: (s) => s.longestStreak >= 7 },
  { id: "month", title: "Devoted heart", desc: "Reach a 30-day streak", icon: Flame,
    check: (s) => s.longestStreak >= 30 },
  { id: "ten", title: "Ten hours", desc: "Log 10 total hours", icon: Clock,
    check: (s) => s.totalHours >= 10 },
  { id: "fifty", title: "Fifty hours", desc: "Log 50 total hours", icon: Clock,
    check: (s) => s.totalHours >= 50 },
  { id: "hundred", title: "Hundred hours", desc: "Log 100 total hours", icon: Trophy,
    check: (s) => s.totalHours >= 100 },
  { id: "journal", title: "Journal keeper", desc: "Write 5 journal entries", icon: NotebookPen,
    check: (s, extra) => extra.journalCount >= 5 },
  { id: "warrior", title: "Prayer warrior", desc: "Log 50 sessions", icon: Award,
    check: (s) => s.sessionCount >= 50 },
  { id: "chain", title: "Chain keeper", desc: "Pray for everyone in your chain in one day", icon: Link2,
    check: (s, extra) => extra.chainAllPrayedToday },
];

/* ============================= SMALL UI PARTS ============================= */

function ProgressBar({ value, max, color = "var(--accent)", height = 10 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="pbar-track" style={{ height }}>
      <div
        className="pbar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function Confetti({ show }) {
  if (!show) return null;
  const pieces = Array.from({ length: 26 });
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: [ "var(--accent)", "var(--sage)", "var(--mauve)", "var(--deep)"][i % 4],
            animationDelay: `${Math.random() * 0.4}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function CopyLinkRow({ link, label }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const copy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (inputRef.current) {
        inputRef.current.select();
        document.execCommand("copy");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (inputRef.current) inputRef.current.select();
    }
  };

  return (
    <div className="copy-link-row">
      {label && <span className="copy-link-label">{label}</span>}
      <div className="copy-link-field">
        <input ref={inputRef} readOnly value={link} onFocus={(e) => e.target.select()} />
        <button type="button" className="secondary-btn" onClick={copy}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.4} />
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
    </div>
  );
}

/* ============================= AUTH ============================= */

function SetupNeeded() {
  return (
    <div className="auth-screen">
      <div className="auth-center">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark">🕯️</span>
            <div>
              <div className="brand-title">Still Hours</div>
              <div className="brand-sub">a prayer companion</div>
            </div>
          </div>
          <div className="setup-notice">
            <AlertTriangle size={18} />
            <p>
              This app isn't connected to a database yet. Add
              <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
              {" "}to a <code>.env.local</code> file (or your Vercel project's
              environment variables) and reload. See <code>README.md</code> for
              step-by-step setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthGate() {
  const [mode, setMode] = useState("signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [sentKind, setSentKind] = useState("confirm"); // "confirm" | "reset"

  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Fill in first name, last name, email, and password to continue.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address, like you@example.com.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message || "Something went wrong creating your account.");
      return;
    }
    if (!data.session) {
      setSentKind("confirm");
      setSentTo(email.trim());
    }
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message || "Incorrect email or password.");
      return;
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email to continue.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message || "Something went wrong sending the reset link.");
      return;
    }
    setSentKind("reset");
    setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <div className="auth-screen"><div className="auth-topbar"><div className="auth-topbar-brand"><span className="brand-mark">🕯️</span><span className="auth-topbar-title">Still Hours</span></div></div>
        <div className="auth-center">
          <div className="auth-card">
            <div className="auth-brand">
              <span className="brand-mark">🕯️</span>
              <div>
                <div className="brand-title">Still Hours</div>
                <div className="brand-sub">a prayer companion</div>
              </div>
            </div>
            <p className="auth-verse">"Be still, and know that I am God." — Psalm 46:10, KJV</p>
            <div className="setup-notice">
              <Mail size={18} />
              <p>
                {sentKind === "reset"
                  ? <>We sent a password reset link to <strong>{sentTo}</strong>. Open it to choose a new password.</>
                  : <>We sent a confirmation link to <strong>{sentTo}</strong>. Confirm your email, then log in with your password.</>}
              </p>
            </div>
            <div className="full-width form-actions">
              <button type="button" className="secondary-btn" onClick={() => { setSentTo(""); setMode("login"); }}>
                Back to log in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen"><div className="auth-topbar"><div className="auth-topbar-brand"><span className="brand-mark">🕯️</span><span className="auth-topbar-title">Still Hours</span></div></div><div className="auth-center"><div className="auth-visual" aria-hidden="true"><div className="mock-laptop"><div className="mock-laptop-screen"><div className="mock-topbar"><span></span><span></span><span></span></div><div className="mock-app"><div className="mock-dash-greeting">Good morning, Demo User</div><div className="mock-verse-card"><p className="mock-verse-text">"In the morning will I direct my prayer unto thee."</p></div><div className="mock-stat-row"><div className="mock-stat-chip"><span className="mock-stat-num">8.1</span><span className="mock-stat-label">hrs</span></div><div className="mock-stat-chip"><span className="mock-stat-num">1</span><span className="mock-stat-label">streak</span></div><div className="mock-stat-chip"><span className="mock-stat-num">9%</span><span className="mock-stat-label">goal</span></div></div><div className="mock-bars"><span style={{height:"30%"}}></span><span style={{height:"55%"}}></span><span style={{height:"40%"}}></span><span style={{height:"70%"}}></span><span style={{height:"50%"}}></span><span style={{height:"85%"}}></span></div></div></div><div className="mock-laptop-base"></div></div><div className="mock-phone"><div className="mock-phone-notch"></div><div className="mock-phone-screen"><div className="mock-dash-greeting mock-dash-greeting-sm">Good morning</div><div className="mock-verse-card mock-verse-card-sm"><p className="mock-verse-text">"In the morning will I direct my prayer."</p></div><div className="mock-stat-row"><div className="mock-stat-chip"><span className="mock-stat-num">8.1</span><span className="mock-stat-label">hrs</span></div><div className="mock-stat-chip"><span className="mock-stat-num">9%</span><span className="mock-stat-label">goal</span></div></div><div className="mock-bars"><span style={{height:"30%"}}></span><span style={{height:"55%"}}></span><span style={{height:"40%"}}></span><span style={{height:"70%"}}></span><span style={{height:"50%"}}></span><span style={{height:"85%"}}></span></div></div><div className="mock-phone-home"></div></div></div>
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">🕯️</span>
          <div>
            <div className="brand-title">Still Hours</div>
            <div className="brand-sub">a prayer companion</div>
          </div>
        </div>
        <p className="auth-verse">"Be still, and know that I am God." — Psalm 46:10, KJV</p>

        {mode !== "forgot" && (
          <div className="tab-row">
            <button className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); setPassword(""); }}>
              <UserPlus size={14} /> Sign up
            </button>
            <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); setPassword(""); }}>
              <Mail size={14} /> Log in
            </button>
          </div>
        )}

        {mode === "forgot" ? (
          <form className="form-grid" onSubmit={submitForgot} noValidate>
            <label className="full-width">Email
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {error && <p className="full-width auth-error">{error}</p>}
            <div className="full-width form-actions">
              <button type="submit" className="primary-btn" disabled={loading}><Mail size={16} /> {loading ? "Sending…" : "Send reset link"}</button>
            </div>
            <div className="full-width form-actions">
              <button type="button" className="secondary-btn" onClick={() => { setMode("login"); setError(""); }}>
                Back to log in
              </button>
            </div>
          </form>
        ) : mode === "signup" ? (
          <form className="form-grid" onSubmit={submitSignup} noValidate>
            <label>First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
            </label>
            <label>Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </label>
            <label className="full-width">Email
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="full-width">Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </label>
            {error && <p className="full-width auth-error">{error}</p>}
            <div className="full-width form-actions">
              <button type="submit" className="primary-btn" disabled={loading}><UserPlus size={16} /> {loading ? "Creating account…" : "Create account"}</button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={submitLogin} noValidate>
            <label className="full-width">Email
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="full-width">Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
            </label>
            {error && <p className="full-width auth-error">{error}</p>}
            <div className="full-width form-actions">
              <button type="submit" className="primary-btn" disabled={loading}><Lock size={16} /> {loading ? "Logging in…" : "Log in"}</button>
            </div>
            <div className="full-width">
              <button type="button" className="link-btn" onClick={() => { setMode("forgot"); setError(""); setPassword(""); }}>
                Forgot password?
              </button>
            </div>
          </form>
        )}
        <p className="auth-note">Your progress is saved to your account and synced wherever you log in.</p></div>
      </div>
    </div>
  );
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message || "Something went wrong updating your password.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="auth-screen"><div className="auth-topbar"><div className="auth-topbar-brand"><span className="brand-mark">🕯️</span><span className="auth-topbar-title">Still Hours</span></div></div>
      <div className="auth-center">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark">🕯️</span>
            <div>
              <div className="brand-title">Still Hours</div>
              <div className="brand-sub">a prayer companion</div>
            </div>
          </div>
          {done ? (
            <>
              <div className="setup-notice">
                <Check size={18} />
                <p>Your password has been updated.</p>
              </div>
              <div className="full-width form-actions">
                <button type="button" className="primary-btn" onClick={onDone}>Continue</button>
              </div>
            </>
          ) : (
            <form className="form-grid" onSubmit={submit} noValidate>
              <p className="full-width auth-note" style={{ marginTop: 0 }}>Choose a new password for your account.</p>
              <label className="full-width">New password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              </label>
              <label className="full-width">Confirm new password
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
              </label>
              {error && <p className="full-width auth-error">{error}</p>}
              <div className="full-width form-actions">
                <button type="submit" className="primary-btn" disabled={loading}><Lock size={16} /> {loading ? "Updating…" : "Update password"}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================= APP ============================= */

export default function PrayerHoursApp() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (<><GlobalStyle /><SetupNeeded /></>);
  }

  if (session === undefined) {
    return (
      <>
        <GlobalStyle />
        <div className="auth-screen"><div className="auth-center"><p className="subtitle">Loading…</p></div></div>
      </>
    );
  }

  if (passwordRecovery) {
    return (
      <>
        <GlobalStyle />
        <ResetPassword onDone={() => setPasswordRecovery(false)} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <GlobalStyle />
        <AuthGate />
      </>
    );
  }

  return <MainApp user={session.user} onLogout={() => supabase.auth.signOut()} />;
}

/* ============================= SUPABASE SYNC ============================= */
// Each app-side list (sessions, journal, requests, ...) stays a plain React
// state array exactly as before, so every existing add/edit/delete handler
// in the panels below needs no changes. This hook loads the user's rows for
// one table on login, then watches that array and pushes any additions,
// edits, or deletions up to Supabase, scoped to the signed-in user via RLS.
function useCollectionSync({ table, userId, rows, setRows, getId, toDb, fromDb, orderBy }) {
  const lastSynced = useRef(new Map());
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadedRef.current = false;
    setLoaded(false);
    (async () => {
      let query = supabase.from(table).select("*").eq("user_id", userId);
      if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error(`Failed to load ${table}`, error);
        loadedRef.current = true;
        setLoaded(true);
        return;
      }
      const mappedRows = (data || []).map(fromDb);
      const snap = new Map();
      mappedRows.forEach((r) => {
        const id = String(getId(r));
        snap.set(id, JSON.stringify({ ...toDb(r), id, user_id: userId }));
      });
      lastSynced.current = snap;
      setRows(mappedRows);
      loadedRef.current = true;
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, userId]);

  useEffect(() => {
    if (!userId || !loadedRef.current) return;
    const dbRows = rows.map((r) => ({ ...toDb(r), id: String(getId(r)), user_id: userId }));
    const currentIds = new Set(dbRows.map((r) => r.id));
    const toDelete = [...lastSynced.current.keys()].filter((id) => !currentIds.has(id));
    const changed = dbRows.filter((r) => lastSynced.current.get(r.id) !== JSON.stringify(r));
    if (!toDelete.length && !changed.length) return;
    (async () => {
      if (toDelete.length) {
        const { error } = await supabase.from(table).delete().eq("user_id", userId).in("id", toDelete);
        if (!error) toDelete.forEach((id) => lastSynced.current.delete(id));
        else console.error(`Failed to delete from ${table}`, error);
      }
      if (changed.length) {
        const { error } = await supabase.from(table).upsert(changed);
        if (!error) changed.forEach((r) => lastSynced.current.set(r.id, JSON.stringify(r)));
        else console.error(`Failed to sync ${table}`, error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, userId]);

  return loaded;
}

function fromDbProfile(row) {
  return {
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    name: row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    email: row.email || "",
    avatar: row.avatar || "🕊️",
    weeklyGoalHours: Number(row.weekly_goal_hours) || 5,
    memberSince: row.member_since || new Date().toISOString(),
  };
}

function toDbProfile(profile, userId) {
  return {
    id: userId,
    first_name: profile.firstName || "",
    last_name: profile.lastName || "",
    full_name: profile.name || "",
    email: profile.email || "",
    avatar: profile.avatar,
    weekly_goal_hours: profile.weeklyGoalHours,
    member_since: profile.memberSince,
  };
}

function useProfileSync(userId, user) {
  const [profile, setProfile] = useState(null);
  const loadedRef = useRef(false);
  const lastSynced = useRef("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (cancelled) return;
      let row = data;
      if (!row) {
        // Fallback in case the on-signup trigger hasn't run yet (e.g. schema
        // was just applied) — create a default profile for this user.
        const meta = user?.user_metadata || {};
        const defaults = {
          id: userId,
          first_name: meta.first_name || "",
          last_name: meta.last_name || "",
          full_name: `${meta.first_name || ""} ${meta.last_name || ""}`.trim(),
          email: user?.email || "",
          avatar: "🕊️",
          weekly_goal_hours: 5,
          member_since: new Date().toISOString(),
        };
        const { data: inserted, error: insertError } = await supabase.from("profiles").insert(defaults).select().maybeSingle();
        if (insertError) console.error("Failed to create profile", insertError);
        row = inserted || defaults;
      } else if (error) {
        console.error("Failed to load profile", error);
      }
      lastSynced.current = JSON.stringify(toDbProfile(fromDbProfile(row), userId));
      setProfile(fromDbProfile(row));
      loadedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !loadedRef.current || !profile) return;
    const dbRow = toDbProfile(profile, userId);
    const serialized = JSON.stringify(dbRow);
    if (serialized === lastSynced.current) return;
    (async () => {
      const { error } = await supabase.from("profiles").upsert(dbRow);
      if (!error) lastSynced.current = serialized;
      else console.error("Failed to sync profile", error);
    })();
  }, [profile, userId]);

  return [profile, setProfile, loadedRef.current];
}

function MainApp({ user, onLogout }) {
  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const [profile, setProfile, profileLoaded] = useProfileSync(user.id, user);

  const [sessions, setSessions] = useState([]);
  const sessionsLoaded = useCollectionSync({
    table: "sessions", userId: user.id, rows: sessions, setRows: setSessions, getId: (r) => r.id,
    toDb: (s) => ({ date: s.date, duration: Number(s.duration), category: s.category, notes: s.notes || "" }),
    fromDb: (r) => ({ id: r.id, date: r.date, duration: r.duration, category: r.category, notes: r.notes || "" }),
    orderBy: { column: "date", ascending: false },
  });

  const [customCategories, setCustomCategories] = useState([]);
  const categoriesLoaded = useCollectionSync({
    table: "custom_categories", userId: user.id, rows: customCategories, setRows: setCustomCategories,
    getId: (name) => name,
    toDb: (name) => ({ name }),
    fromDb: (r) => r.name,
  });
  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const [journal, setJournal] = useState([]);
  const journalLoaded = useCollectionSync({
    table: "journal_entries", userId: user.id, rows: journal, setRows: setJournal, getId: (r) => r.id,
    toDb: (j) => ({ date: j.date, title: j.title, body: j.text }),
    fromDb: (r) => ({ id: r.id, date: r.date, title: r.title, text: r.body || "" }),
    orderBy: { column: "date", ascending: false },
  });

  const [requests, setRequests] = useState([]);
  const requestsLoaded = useCollectionSync({
    table: "prayer_requests", userId: user.id, rows: requests, setRows: setRequests, getId: (r) => r.id,
    toDb: (r) => ({ name: r.name, notes: r.notes || "", status: r.status, date_added: r.dateAdded, date_answered: r.dateAnswered }),
    fromDb: (r) => ({ id: r.id, name: r.name, notes: r.notes || "", status: r.status, dateAdded: r.date_added, dateAnswered: r.date_answered }),
    orderBy: { column: "date_added", ascending: false },
  });

  const [chain, setChain] = useState([]);
  const chainLoaded = useCollectionSync({
    table: "prayer_chain", userId: user.id, rows: chain, setRows: setChain, getId: (r) => r.id,
    toDb: (c) => ({ name: c.name, note: c.note || "", prayed_date: c.prayedDate }),
    fromDb: (r) => ({ id: r.id, name: r.name, note: r.note || "", prayedDate: r.prayed_date }),
  });

  const [reminders, setReminders] = useState([]);
  const remindersLoaded = useCollectionSync({
    table: "reminders", userId: user.id, rows: reminders, setRows: setReminders, getId: (r) => r.id,
    toDb: (r) => ({ label: r.label, time: r.time, days: r.days }),
    fromDb: (r) => ({ id: r.id, label: r.label, time: r.time, days: r.days || [] }),
  });

  const [challengeMembers, setChallengeMembers] = useState([]);
  const membersLoaded = useCollectionSync({
    table: "challenge_members", userId: user.id, rows: challengeMembers, setRows: setChallengeMembers, getId: (r) => r.id,
    toDb: (m) => ({ name: m.name, hours: m.hours }),
    fromDb: (r) => ({ id: r.id, name: r.name, hours: Number(r.hours) || 0 }),
  });

  const dataReady = profileLoaded && sessionsLoaded && categoriesLoaded && journalLoaded
    && requestsLoaded && chainLoaded && remindersLoaded && membersLoaded;

  const account = useMemo(() => ({
    id: user.id,
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    email: profile?.email || user.email || "",
    memberSince: profile?.memberSince || new Date().toISOString(),
  }), [user, profile]);

  const [verseIdx, setVerseIdx] = useState(() => Math.floor(Math.random() * VERSES.length));
  useEffect(() => {
    const t = setInterval(() => setVerseIdx((i) => (i + 1) % VERSES.length), 15000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => computeStats(sessions), [sessions]);

  const thisWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const thisWeekMinutes = useMemo(() => weekMinutes(sessions, thisWeekStart), [sessions, thisWeekStart]);
  const weeklySessionCount = useMemo(() => {
    const weekEnd = new Date(thisWeekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    return sessions.filter((s) => new Date(s.date) >= thisWeekStart && new Date(s.date) < weekEnd).length;
  }, [sessions, thisWeekStart]);

  const [celebration, setCelebration] = useState(false);
  const prevWeekPctRef = useRef(0);
  useEffect(() => {
    if (!profile) return;
    const goalMin = profile.weeklyGoalHours * 60;
    const pct = goalMin > 0 ? (thisWeekMinutes / goalMin) * 100 : 0;
    if (pct >= 100 && prevWeekPctRef.current < 100) {
      setCelebration(true);
      const t = setTimeout(() => setCelebration(false), 2600);
      return () => clearTimeout(t);
    }
    prevWeekPctRef.current = pct;
  }, [thisWeekMinutes, profile?.weeklyGoalHours]);

  const chainAllPrayedToday = chain.length > 0 && chain.every((p) => p.prayedDate === toKey(new Date()));

  const badgeExtra = { journalCount: journal.length, chainAllPrayedToday };
  const unlockedBadges = useMemo(
    () => new Set(BADGES.filter((b) => b.check(stats, badgeExtra)).map((b) => b.id)),
    [stats, badgeExtra]
  );

  const addSession = useCallback((sess) => {
    setSessions((prev) => [{ id: uid(), ...sess }, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateSession = useCallback((id, updates) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)).sort((a, b) => new Date(b.date) - new Date(a.date))
    );
  }, []);

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "log", label: "Session log", icon: NotebookPen },
    { id: "timer", label: "Prayer timer", icon: Clock },
    { id: "journal", label: "Journal", icon: BookMarked },
    { id: "requests", label: "Prayer requests", icon: HeartHandshake },
    { id: "chain", label: "Prayer chain", icon: Link2 },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "challenges", label: "Group challenge", icon: Users },
    { id: "stats", label: "Statistics", icon: BarChart3 },
    { id: "profile", label: "Profile", icon: User },
  ];

  if (!dataReady || !profile) {
    return (
      <>
        <GlobalStyle />
        <div className="ph-app">
          <div className="auth-center" style={{ width: "100%" }}>
            <p className="subtitle">Loading your progress…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="ph-app">
      <GlobalStyle />
      <Confetti show={celebration} />
      {celebration && (
        <div className="celebration-banner">
          <Sparkles size={16} /> Weekly goal reached — well done.
        </div>
      )}

      <button className="mobile-nav-toggle" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle menu">
        <Menu size={20} />
      </button>

      <nav className={`ph-sidebar ${navOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">🕯️</span>
          <div>
            <div className="brand-title">Still Hours</div>
            <div className="brand-sub">a prayer companion</div>
          </div>
        </div>
        <div className="sidebar-items">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-item ${view === item.id ? "active" : ""}`}
              onClick={() => { setView(item.id); setNavOpen(false); }}
            >
              <item.icon size={17} strokeWidth={1.7} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{profile.avatar}</div>
          <div className="sidebar-footer-main">
            <div className="sidebar-name">{profile.name}</div>
            <div className="sidebar-streak"><Flame size={12} /> {stats.currentStreak}-day streak</div>
          </div>
          <button className="sidebar-logout" onClick={onLogout} aria-label="Log out" title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      <main className="ph-main">
        {view === "dashboard" && (
          <Dashboard
            profile={profile} sessions={sessions} stats={stats}
            thisWeekMinutes={thisWeekMinutes} weeklySessionCount={weeklySessionCount}
            verse={VERSES[verseIdx]} allCategories={allCategories}
            reminders={reminders} setView={setView}
          />
        )}
        {view === "log" && (
          <SessionLog
            sessions={sessions} addSession={addSession} deleteSession={deleteSession}
            updateSession={updateSession}
            allCategories={allCategories} customCategories={customCategories}
            setCustomCategories={setCustomCategories}
          />
        )}
        {view === "timer" && (
          <PrayerTimer allCategories={allCategories} addSession={addSession} />
        )}
        {view === "journal" && (
          <Journal journal={journal} setJournal={setJournal} />
        )}
        {view === "requests" && (
          <PrayerRequests requests={requests} setRequests={setRequests} />
        )}
        {view === "chain" && (
          <PrayerChain chain={chain} setChain={setChain} account={account} />
        )}
        {view === "reminders" && (
          <Reminders reminders={reminders} setReminders={setReminders} />
        )}
        {view === "challenges" && (
          <GroupChallenge
            stats={stats} members={challengeMembers} setMembers={setChallengeMembers}
            account={account}
          />
        )}
        {view === "stats" && (
          <Statistics sessions={sessions} stats={stats} allCategories={allCategories} />
        )}
        {view === "profile" && (
          <Profile
            profile={profile} setProfile={setProfile}
            stats={stats} unlockedBadges={unlockedBadges}
          />
        )}
      </main>
    </div>
  );
}

/* ============================= DASHBOARD ============================= */

function Dashboard({ profile, sessions, stats, thisWeekMinutes, weeklySessionCount, verse, allCategories, reminders, setView }) {
  const weeklyGoalMin = profile.weeklyGoalHours * 60;
  const weeklyPct = weeklyGoalMin > 0 ? Math.min(100, (thisWeekMinutes / weeklyGoalMin) * 100) : 0;

  const last14 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const key = toKey(d);
      const mins = sessions.filter((s) => toKey(s.date) === key).reduce((a, s) => a + s.duration, 0);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), minutes: mins });
    }
    return days;
  }, [sessions]);

  const recent = sessions.slice(0, 5);

  const upcomingReminders = useMemo(() => {
    const now = new Date();
    return reminders
      .map((r) => {
        const [h, m] = r.time.split(":").map(Number);
        let best = null;
        for (let addDays = 0; addDays < 8; addDays++) {
          const d = new Date(now);
          d.setDate(d.getDate() + addDays);
          d.setHours(h, m, 0, 0);
          if (r.days.includes(d.getDay()) && d > now) { best = d; break; }
        }
        return best ? { ...r, next: best } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.next - b.next)
      .slice(0, 3);
  }, [reminders]);

  const milestones = [
    { label: `Weekly hours goal (${profile.weeklyGoalHours}h)`, value: thisWeekMinutes / 60, max: profile.weeklyGoalHours, color: "var(--accent)" },
    { label: "Weekly sessions goal (5 sessions)", value: weeklySessionCount, max: 5, color: "var(--sage)" },
    { label: "Monthly hours goal (20h)", value: stats.totalHours, max: 20, color: "var(--mauve)" },
  ];

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Peace be with you</p>
          <h1>{greeting()}, {profile.name}</h1>
        </div>
      </header>

      <div className="verse-card">
        <span className="verse-dropcap">{verse.text.trim()[0]}</span>
        <p className="verse-text">{verse.text.trim().slice(1)}</p>
        <p className="verse-ref">— {verse.ref}, KJV</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--accent-soft)" }}><Clock size={16} /></div>
          <div className="stat-value">{formatHrs(stats.totalMinutes)}</div>
          <div className="stat-label">Total hours prayed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon flame-bg"><Flame size={16} className="flame-icon" /></div>
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Day streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--sage-soft)" }}><TrendingUp size={16} /></div>
          <div className="stat-value">{Math.round(weeklyPct)}%</div>
          <div className="stat-label">Weekly goal progress</div>
          <ProgressBar value={thisWeekMinutes} max={weeklyGoalMin} />
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--mauve-soft)" }}><Award size={16} /></div>
          <div className="stat-value">{stats.sessionCount}</div>
          <div className="stat-label">Sessions logged</div>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Hours over the last 14 days</h2>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={last14} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  formatter={(v) => [`${v} min`, "Prayed"]}
                  contentStyle={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="minutes" stroke="var(--deep)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <h2>Recent activity</h2>
          {recent.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No sessions yet" body="Log your first prayer session to see it here." />
          ) : (
            <ul className="activity-list">
              {recent.map((s) => (
                <li key={s.id}>
                  <span className="dot" style={{ background: catColor(s.category, allCategories) }} />
                  <div className="activity-main">
                    <span className="activity-cat">{s.category}</span>
                    <span className="activity-meta">{formatDateTime(s.date)} · {s.duration} min</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Weekly milestones</h2>
          <div className="milestone-list">
            {milestones.map((m) => (
              <div key={m.label} className="milestone">
                <div className="milestone-top">
                  <span>{m.label}</span>
                  <span>{m.value % 1 === 0 ? m.value : m.value.toFixed(1)} / {m.max}</span>
                </div>
                <ProgressBar value={m.value} max={m.max} color={m.color} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Upcoming reminders</h2>
          {upcomingReminders.length === 0 ? (
            <EmptyState icon={Bell} title="Nothing scheduled" body="Add a reminder to see it appear here." />
          ) : (
            <ul className="reminder-list">
              {upcomingReminders.map((r) => (
                <li key={r.id}>
                  <Bell size={14} />
                  <div>
                    <div className="reminder-label">{r.label}</div>
                    <div className="reminder-time">{r.next.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button className="link-btn" onClick={() => setView("reminders")}>
            Manage reminders <ChevronRight size={14} />
          </button>
        </section>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ============================= SESSION LOG ============================= */

function toLocalInput(d) {
  const dt = new Date(d);
  dt.setSeconds(0, 0);
  const tzOffset = dt.getTimezoneOffset() * 60000;
  return new Date(dt - tzOffset).toISOString().slice(0, 16);
}

function SessionLog({ sessions, addSession, deleteSession, updateSession, allCategories, customCategories, setCustomCategories }) {
  const [duration, setDuration] = useState(15);
  const [category, setCategory] = useState(allCategories[0]);
  const [dateTime, setDateTime] = useState(() => toLocalInput(new Date()));
  const [notes, setNotes] = useState("");
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState("All");
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    addSession({ duration: Number(duration), category, date: new Date(dateTime).toISOString(), notes });
    setNotes("");
  };

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (trimmed && !allCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
      setCategory(trimmed);
    }
    setNewCat("");
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditDraft({ duration: s.duration, category: s.category, dateTime: toLocalInput(s.date), notes: s.notes || "" });
  };

  const cancelEdit = () => { setEditId(null); setEditDraft(null); };

  const saveEdit = (id) => {
    updateSession(id, {
      duration: Number(editDraft.duration),
      category: editDraft.category,
      date: new Date(editDraft.dateTime).toISOString(),
      notes: editDraft.notes,
    });
    cancelEdit();
  };

  const filtered = filter === "All" ? sessions : sessions.filter((s) => s.category === filter);

  return (
    <div className="view">
      <header className="view-header"><h1>Session log</h1><p className="subtitle">Record time spent in prayer.</p></header>

      <section className="panel">
        <h2>Log a session</h2>
        <form className="form-grid" onSubmit={submit}>
          <label>Duration (minutes)
            <input type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </label>
          <label>Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Date and time
            <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
          </label>
          <label className="full-width">Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was on your heart during this time?" />
          </label>
          <div className="full-width form-actions">
            <div className="add-category">
              <input placeholder="Add a custom category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button type="button" onClick={addCategory}><Plus size={14} /> Add category</button>
            </div>
            <button type="submit" className="primary-btn"><Save size={16} /> Save session</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>All sessions ({filtered.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
            <option>All</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No sessions found" body="Sessions you log will appear here." />
        ) : (
          <ul className="session-list">
            {filtered.map((s) => (
              <li key={s.id}>
                {editId === s.id ? (
                  <div className="session-edit-form">
                    <div className="form-grid">
                      <label>Duration (minutes)
                        <input type="number" min="1" max="600" value={editDraft.duration}
                          onChange={(e) => setEditDraft({ ...editDraft, duration: e.target.value })} />
                      </label>
                      <label>Category
                        <select value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}>
                          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label>Date and time
                        <input type="datetime-local" value={editDraft.dateTime}
                          onChange={(e) => setEditDraft({ ...editDraft, dateTime: e.target.value })} />
                      </label>
                      <label className="full-width">Notes
                        <textarea rows={2} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                      </label>
                    </div>
                    <div className="form-actions" style={{ marginTop: 10 }}>
                      <button className="secondary-btn" onClick={cancelEdit}><X size={14} /> Cancel</button>
                      <button className="primary-btn" onClick={() => saveEdit(s.id)}><Save size={14} /> Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="dot" style={{ background: catColor(s.category, allCategories) }} />
                    <div className="session-main">
                      <div className="session-top">
                        <span className="session-cat">{s.category}</span>
                        <span className="session-dur">{s.duration} min</span>
                      </div>
                      <div className="session-date">{formatDateTime(s.date)}</div>
                      {s.notes && <div className="session-notes">{s.notes}</div>}
                    </div>
                    <button className="icon-btn" onClick={() => startEdit(s)} aria-label="Edit session"><Pencil size={15} /></button>
                    <button className="icon-btn" onClick={() => deleteSession(s.id)} aria-label="Delete session"><Trash2 size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================= TIMER ============================= */

function PrayerTimer({ allCategories, addSession }) {
  const [category, setCategory] = useState(allCategories[0]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const reset = () => { setRunning(false); setSeconds(0); };

  const saveAndReset = () => {
    const mins = Math.round(seconds / 60);
    if (mins > 0) {
      addSession({ duration: mins, category, date: new Date().toISOString(), notes: "Logged via prayer timer." });
      setSavedMsg(`Saved ${mins} minute${mins === 1 ? "" : "s"} of ${category.toLowerCase()}.`);
      setTimeout(() => setSavedMsg(""), 3500);
    }
    reset();
  };

  const pct = Math.min(100, (seconds % 1800) / 18);

  return (
    <div className="view">
      <header className="view-header"><h1>Prayer timer</h1><p className="subtitle">Start a session and let it log itself when you're done.</p></header>

      <section className="panel timer-panel">
        <label className="timer-cat-label">Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={running || seconds > 0}>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="timer-ring-wrap">
          <svg viewBox="0 0 200 200" className="timer-ring">
            <circle cx="100" cy="100" r="88" className="ring-track" />
            <circle
              cx="100" cy="100" r="88"
              className="ring-progress"
              style={{ strokeDasharray: 553, strokeDashoffset: 553 - (553 * pct) / 100 }}
            />
          </svg>
          <div className="timer-readout">
            <span>{mm}:{ss}</span>
            <small>{running ? "in prayer" : seconds > 0 ? "paused" : "ready"}</small>
          </div>
        </div>

        <div className="timer-controls">
          {!running ? (
            <button className="primary-btn" onClick={() => setRunning(true)}><Play size={16} /> {seconds > 0 ? "Resume" : "Start"}</button>
          ) : (
            <button className="primary-btn" onClick={() => setRunning(false)}><Pause size={16} /> Pause</button>
          )}
          <button className="secondary-btn" onClick={reset}><RotateCcw size={16} /> Reset</button>
          <button className="secondary-btn" onClick={saveAndReset} disabled={seconds < 1}><CheckCircle2 size={16} /> Finish and log</button>
        </div>
        {savedMsg && <p className="timer-saved">{savedMsg}</p>}
      </section>
    </div>
  );
}

/* ============================= JOURNAL ============================= */

function Journal({ journal, setJournal }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setJournal((prev) => [{ id: uid(), date: new Date().toISOString(), title: title.trim() || "Untitled reflection", text }, ...prev]);
    setTitle(""); setText("");
  };

  const remove = (id) => setJournal((prev) => prev.filter((j) => j.id !== id));

  const filtered = journal.filter((j) =>
    (j.title + " " + j.text).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="view">
      <header className="view-header"><h1>Prayer journal</h1><p className="subtitle">Reflect and keep a record of what stirs your heart.</p></header>

      <section className="panel">
        <h2>New entry</h2>
        <form className="form-grid" onSubmit={add}>
          <label className="full-width">Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short title for this entry" />
          </label>
          <label className="full-width">Reflection
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What are you carrying today? What did you sense in prayer?" />
          </label>
          <div className="full-width form-actions">
            <button type="submit" className="primary-btn"><PlusCircle size={16} /> Save entry</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>Entries ({filtered.length})</h2>
          <div className="search-box">
            <Search size={14} />
            <input placeholder="Search entries" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={BookMarked} title="No entries found" body="Write your first reflection above." />
        ) : (
          <ul className="journal-list">
            {filtered.map((j) => (
              <li key={j.id}>
                <div className="journal-top">
                  <span className="journal-title">{j.title}</span>
                  <span className="journal-date">{formatDate(j.date)}</span>
                </div>
                <p className="journal-text">{j.text}</p>
                <button className="link-btn danger" onClick={() => remove(j.id)}><Trash2 size={13} /> Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================= PRAYER REQUESTS ============================= */

function PrayerRequests({ requests, setRequests }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState("ongoing");

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setRequests((prev) => [{ id: uid(), name: name.trim(), notes, status: "ongoing", dateAdded: new Date().toISOString(), dateAnswered: null }, ...prev]);
    setName(""); setNotes("");
  };

  const toggleStatus = (id) => {
    setRequests((prev) => prev.map((r) => r.id === id
      ? { ...r, status: r.status === "ongoing" ? "answered" : "ongoing", dateAnswered: r.status === "ongoing" ? new Date().toISOString() : null }
      : r));
  };

  const remove = (id) => setRequests((prev) => prev.filter((r) => r.id !== id));

  const shown = requests.filter((r) => r.status === tab);

  return (
    <div className="view">
      <header className="view-header"><h1>Prayer requests</h1><p className="subtitle">Keep track of what you're bringing before God, and celebrate what's been answered.</p></header>

      <section className="panel">
        <h2>Add a request</h2>
        <form className="form-grid" onSubmit={add}>
          <label className="full-width">Who or what is this for?
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Healing for a friend" required />
          </label>
          <label className="full-width">Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any details worth remembering" />
          </label>
          <div className="full-width form-actions">
            <button type="submit" className="primary-btn"><PlusCircle size={16} /> Add request</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="tab-row">
          <button className={`tab ${tab === "ongoing" ? "active" : ""}`} onClick={() => setTab("ongoing")}>
            Ongoing ({requests.filter((r) => r.status === "ongoing").length})
          </button>
          <button className={`tab ${tab === "answered" ? "active" : ""}`} onClick={() => setTab("answered")}>
            Answered ({requests.filter((r) => r.status === "answered").length})
          </button>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={HeartHandshake} title={`No ${tab} requests`} body="Requests you add will show up here." />
        ) : (
          <ul className="request-list">
            {shown.map((r) => (
              <li key={r.id}>
                <button className="status-toggle" onClick={() => toggleStatus(r.id)} aria-label="Toggle status">
                  {r.status === "answered" ? <CheckCircle2 size={18} className="answered-icon" /> : <Circle size={18} />}
                </button>
                <div className="request-main">
                  <span className="request-name">{r.name}</span>
                  {r.notes && <span className="request-notes">{r.notes}</span>}
                  <span className="request-dates">
                    Added {formatDate(r.dateAdded)}{r.dateAnswered ? ` · Answered ${formatDate(r.dateAnswered)}` : ""}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => remove(r.id)} aria-label="Delete request"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================= PRAYER CHAIN ============================= */

function PrayerChain({ chain, setChain, account }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const today = toKey(new Date());

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setChain((prev) => [...prev, { id: uid(), name: name.trim(), note, prayedDate: null }]);
    setName(""); setNote("");
  };

  const toggle = (id) => {
    setChain((prev) => prev.map((p) => p.id === id ? { ...p, prayedDate: p.prayedDate === today ? null : today } : p));
  };

  const remove = (id) => setChain((prev) => prev.filter((p) => p.id !== id));

  const prayedCount = chain.filter((p) => p.prayedDate === today).length;
  const inviteLink = `https://stillhours.app/chain/${slugify(account.firstName + "-" + account.lastName)}-${account.id.slice(0, 6)}`;

  return (
    <div className="view">
      <header className="view-header"><h1>Prayer chain</h1><p className="subtitle">People to hold in prayer today.</p></header>

      <div className="chain-progress-card">
        <span>{prayedCount} of {chain.length} prayed for today</span>
        <ProgressBar value={prayedCount} max={chain.length || 1} color="var(--sage)" />
      </div>

      <section className="panel">
        <h2>Invite someone to your chain</h2>
        <p className="subtitle" style={{ marginBottom: 12 }}>Share this link so someone can ask to be added to your prayer chain.</p>
        <CopyLinkRow link={inviteLink} />
      </section>

      <section className="panel">
        <h2>Add someone</h2>
        <form className="form-grid" onSubmit={add}>
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          </label>
          <label>What for
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Encouragement, healing" />
          </label>
          <div className="full-width form-actions">
            <button type="submit" className="primary-btn"><PlusCircle size={16} /> Add to chain</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Your chain ({chain.length})</h2>
        {chain.length === 0 ? (
          <EmptyState icon={Link2} title="Your chain is empty" body="Add the people you want to hold in prayer." />
        ) : (
          <ul className="chain-list">
            {chain.map((p) => {
              const prayed = p.prayedDate === today;
              return (
                <li key={p.id} className={prayed ? "prayed" : ""}>
                  <button className={`chain-toggle ${prayed ? "on" : ""}`} onClick={() => toggle(p.id)}>
                    {prayed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <div className="chain-main">
                    <span className="chain-name">{p.name}</span>
                    {p.note && <span className="chain-note">{p.note}</span>}
                  </div>
                  <button className="icon-btn" onClick={() => remove(p.id)} aria-label="Remove"><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================= REMINDERS ============================= */

function Reminders({ reminders, setReminders }) {
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("07:00");
  const [days, setDays] = useState([1, 2, 3, 4, 5]);

  const toggleDay = (d) => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const add = (e) => {
    e.preventDefault();
    if (!label.trim() || days.length === 0) return;
    setReminders((prev) => [...prev, { id: uid(), label: label.trim(), time, days }]);
    setLabel(""); setDays([1, 2, 3, 4, 5]);
  };

  const remove = (id) => setReminders((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="view">
      <header className="view-header"><h1>Reminders</h1><p className="subtitle">Set gentle nudges to return to prayer through the week.</p></header>

      <section className="panel">
        <h2>New reminder</h2>
        <form className="form-grid" onSubmit={add}>
          <label>Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Morning quiet time" required />
          </label>
          <label>Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <div className="full-width">
            <span className="days-label">Days</span>
            <div className="day-picker">
              {DAY_NAMES.map((d, i) => (
                <button type="button" key={d} className={`day-chip ${days.includes(i) ? "on" : ""}`} onClick={() => toggleDay(i)}>{d}</button>
              ))}
            </div>
          </div>
          <div className="full-width form-actions">
            <button type="submit" className="primary-btn"><PlusCircle size={16} /> Add reminder</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>All reminders ({reminders.length})</h2>
        {reminders.length === 0 ? (
          <EmptyState icon={Bell} title="No reminders set" body="Add one above to be nudged back to prayer." />
        ) : (
          <ul className="reminder-manage-list">
            {reminders.map((r) => (
              <li key={r.id}>
                <Bell size={15} />
                <div className="reminder-manage-main">
                  <span className="reminder-manage-label">{r.label}</span>
                  <span className="reminder-manage-meta">{(() => { const [h, m] = r.time.split(":").map(Number); const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; })()} · {r.days.map((d) => DAY_NAMES[d]).join(", ")}</span>
                </div>
                <button className="icon-btn" onClick={() => remove(r.id)} aria-label="Delete reminder"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================= GROUP CHALLENGE ============================= */

function GroupChallenge({ stats, members, setMembers, account }) {
  const [newMember, setNewMember] = useState("");

  const you = { id: "you", name: "You", hours: stats.totalHours, isUser: true };
  const membersWithUser = [you, ...members];
  const totalHours = membersWithUser.reduce((a, m) => a + m.hours, 0);
  const pct = Math.min(100, (totalHours / CHALLENGE.goalHours) * 100);
  const sorted = [...membersWithUser].sort((a, b) => b.hours - a.hours);

  const inviteLink = `https://stillhours.app/challenge/${slugify(CHALLENGE.title)}-${account.id.slice(0, 6)}`;

  const addMember = (e) => {
    e.preventDefault();
    const trimmed = newMember.trim();
    if (!trimmed) return;
    setMembers((prev) => [...prev, { id: uid(), name: trimmed, hours: 0 }]);
    setNewMember("");
  };

  const removeMember = (id) => setMembers((prev) => prev.filter((m) => m.id !== id));

  return (
    <div className="view">
      <header className="view-header"><h1>Group challenge</h1><p className="subtitle">A shared season of prayer with your circle.</p></header>

      <section className="panel challenge-hero">
        <div className="challenge-hero-top">
          <div>
            <h2 style={{ marginBottom: 4 }}>{CHALLENGE.title}</h2>
            <p className="subtitle" style={{ margin: 0 }}>{CHALLENGE.endsInDays} days remaining · goal {CHALLENGE.goalHours} combined hours</p>
          </div>
          <div className="challenge-pct">{Math.round(pct)}%</div>
        </div>
        <ProgressBar value={totalHours} max={CHALLENGE.goalHours} height={12} />
        <p className="challenge-total">{totalHours.toFixed(1)} of {CHALLENGE.goalHours} hours prayed together</p>
      </section>

      <section className="panel">
        <h2>Invite people to this challenge</h2>
        <p className="subtitle" style={{ marginBottom: 12 }}>Share this link so others can join your group.</p>
        <CopyLinkRow link={inviteLink} />
      </section>

      <section className="panel">
        <h2>Leaderboard</h2>
        <ul className="leaderboard-list">
          {sorted.map((m, i) => (
            <li key={m.id} className={m.isUser ? "is-user" : ""}>
              <span className="rank">{i + 1}</span>
              <div className="member-avatar">{m.name[0]}</div>
              <div className="member-main">
                <span className="member-name">{m.name}{m.isUser ? " (you)" : ""}</span>
                <ProgressBar value={m.hours} max={Math.max(...membersWithUser.map((x) => x.hours), 1)} color={m.isUser ? "var(--accent)" : "var(--sage)"} height={7} />
              </div>
              <span className="member-hours">{m.hours.toFixed(1)}h</span>
              {!m.isUser && (
                <button className="icon-btn" onClick={() => removeMember(m.id)} aria-label={`Remove ${m.name}`}><UserX size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Add a member</h2>
        <form className="form-grid" onSubmit={addMember}>
          <label className="full-width">Name
            <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="Their name" required />
          </label>
          <div className="full-width form-actions">
            <button type="submit" className="primary-btn"><UserPlus size={16} /> Add member</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ============================= STATISTICS ============================= */

function Statistics({ sessions, stats, allCategories }) {
  const categoryData = Object.entries(stats.byCategory)
    .map(([cat, mins]) => ({ name: cat, hours: Math.round((mins / 60) * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  const weeklyData = useMemo(() => {
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const ws = startOfWeek(new Date());
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      const mins = sessions.filter((s) => { const d = new Date(s.date); return d >= ws && d < we; }).reduce((a, s) => a + s.duration, 0);
      weeks.push({ label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }), hours: Math.round((mins / 60) * 10) / 10 });
    }
    return weeks;
  }, [sessions]);

  return (
    <div className="view">
      <header className="view-header"><h1>Statistics</h1><p className="subtitle">A closer look at your practice over time.</p></header>

      <div className="card-grid">
        <div className="stat-card"><div className="stat-value">{formatHrs(stats.totalMinutes)}</div><div className="stat-label">Total hours</div></div>
        <div className="stat-card"><div className="stat-value">{Math.round(stats.avgSessionMin)}m</div><div className="stat-label">Average session length</div></div>
        <div className="stat-card"><div className="stat-value">{stats.mostCommonCategory || "—"}</div><div className="stat-label">Most common category</div></div>
        <div className="stat-card"><div className="stat-value">{stats.longestStreak}</div><div className="stat-label">Longest streak (days)</div></div>
      </div>

      <section className="panel">
        <h2>Weekly hours (last 12 weeks)</h2>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                formatter={(v) => [`${v} h`, "Hours"]}
                contentStyle={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
              />
              <Bar dataKey="hours" fill="var(--deep)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Hours by category</h2>
          {categoryData.length === 0 ? (
            <EmptyState icon={BarChart3} title="No data yet" body="Log sessions to see your breakdown." />
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} dataKey="hours" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {categoryData.map((entry, i) => (
                      <Cell key={entry.name} fill={catColor(entry.name, allCategories)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} h`, n]} contentStyle={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Category breakdown</h2>
          <ul className="category-breakdown">
            {categoryData.map((c) => (
              <li key={c.name}>
                <span className="dot" style={{ background: catColor(c.name, allCategories) }} />
                <span className="cb-name">{c.name}</span>
                <span className="cb-hours">{c.hours}h</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ============================= PROFILE ============================= */

function Profile({ profile, setProfile, stats, unlockedBadges }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  const save = (e) => {
    e.preventDefault();
    setProfile(draft);
    setEditing(false);
  };

  const memberDays = Math.max(1, Math.round((Date.now() - new Date(profile.memberSince)) / 86400000));

  return (
    <div className="view">
      <header className="view-header"><h1>Profile</h1><p className="subtitle">Your practice, at a glance.</p></header>

      <section className="panel profile-card">
        <div className="profile-top">
          <div className="profile-avatar">{profile.avatar}</div>
          <div>
            <h2 style={{ margin: 0 }}>{profile.name}</h2>
            <p className="subtitle" style={{ margin: "4px 0 0" }}>Member for {memberDays} days · since {formatDate(profile.memberSince)}</p>
            {profile.email && <p className="subtitle" style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 5 }}><Mail size={12} /> {profile.email}</p>}
          </div>
          <button className="secondary-btn" style={{ marginLeft: "auto" }} onClick={() => { setDraft(profile); setEditing((v) => !v); }}>
            {editing ? <><X size={14} /> Cancel</> : "Edit profile"}
          </button>
        </div>

        {editing && (
          <form className="form-grid" onSubmit={save} style={{ marginTop: 20 }}>
            <label>Name
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label>Weekly goal (hours)
              <input type="number" min="1" max="40" value={draft.weeklyGoalHours} onChange={(e) => setDraft({ ...draft, weeklyGoalHours: Number(e.target.value) })} required />
            </label>
            <div className="full-width">
              <span className="days-label">Avatar</span>
              <div className="avatar-picker">
                {AVATARS.map((a) => (
                  <button type="button" key={a} className={`avatar-choice ${draft.avatar === a ? "on" : ""}`} onClick={() => setDraft({ ...draft, avatar: a })}>{a}</button>
                ))}
              </div>
            </div>
            <div className="full-width form-actions">
              <button type="submit" className="primary-btn"><CheckCircle2 size={16} /> Save changes</button>
            </div>
          </form>
        )}

        <div className="profile-stats-row">
          <div><strong>{formatHrs(stats.totalMinutes)}</strong><span>total hours</span></div>
          <div><strong>{stats.currentStreak}</strong><span>current streak</span></div>
          <div><strong>{profile.weeklyGoalHours}h</strong><span>weekly goal</span></div>
          <div><strong>{unlockedBadges.size}/{BADGES.length}</strong><span>badges earned</span></div>
        </div>
      </section>

      <section className="panel">
        <h2>Badge gallery</h2>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const unlocked = unlockedBadges.has(b.id);
            const Icon = b.icon;
            return (
              <div key={b.id} className={`badge-card ${unlocked ? "unlocked" : "locked"}`}>
                <div className="badge-icon"><Icon size={20} /></div>
                <div className="badge-title">{b.title}</div>
                <div className="badge-desc">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ============================= GLOBAL STYLE ============================= */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

      .ph-app {
        --parchment: #F5F1E6;
        --paper: #FFFDF8;
        --ink: #2C2A24;
        --ink-soft: #736C5C;
        --deep: #2F3A56;
        --deep-soft: #E7EAF1;
        --accent: #C7963C;
        --accent-soft: #F3E4C4;
        --sage: #7C9179;
        --sage-soft: #E2E9DD;
        --mauve: #96727E;
        --mauve-soft: #EFE1E5;
        --border: #E5DDC8;

        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--ink);
        background: var(--parchment);
        min-height: 100vh;
        display: flex;
        position: relative;
      }
      .ph-app * { box-sizing: border-box; }
      .ph-app h1, .ph-app h2 { font-family: 'Fraunces', Georgia, serif; color: var(--deep); margin: 0; }
      .ph-app h1 { font-size: 26px; font-weight: 600; }
      .ph-app h2 { font-size: 17px; font-weight: 600; margin-bottom: 14px; }

      .mobile-nav-toggle {
        display: none; position: fixed; top: 14px; left: 14px; z-index: 30;
        background: var(--deep); color: var(--accent-soft); border: none; border-radius: 10px;
        width: 38px; height: 38px; align-items: center; justify-content: center; cursor: pointer;
      }

      .ph-sidebar {
        width: 232px; flex-shrink: 0; background: var(--deep); color: #EDE7D6;
        display: flex; flex-direction: column; padding: 22px 16px; min-height: 100vh;
        position: sticky; top: 0;
      }
      .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; border-bottom: 1px solid rgba(237,231,214,0.12); margin-bottom: 16px; }
      .brand-mark { font-size: 22px; }
      .brand-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: #F6EFDD; }
      .brand-sub { font-size: 11px; color: rgba(237,231,214,0.55); }

      .sidebar-items { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .sidebar-item {
        display: flex; align-items: center; gap: 10px; background: none; border: none;
        color: rgba(237,231,214,0.75); font-size: 13.5px; font-family: 'Inter', sans-serif;
        padding: 9px 10px; border-radius: 9px; cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s;
      }
      .sidebar-item:hover { background: rgba(237,231,214,0.08); color: #F6EFDD; }
      .sidebar-item.active { background: var(--accent); color: #2F2A17; font-weight: 600; }

      .sidebar-footer { display: flex; align-items: center; gap: 10px; padding: 12px 8px 0; border-top: 1px solid rgba(237,231,214,0.12); margin-top: 8px; }
      .sidebar-footer-main { flex: 1; min-width: 0; }
      .sidebar-logout { background: none; border: none; color: rgba(237,231,214,0.55); cursor: pointer; padding: 6px; border-radius: 8px; flex-shrink: 0; }
      .sidebar-logout:hover { background: rgba(237,231,214,0.1); color: #F6EFDD; }
      .sidebar-avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(237,231,214,0.12); display: flex; align-items: center; justify-content: center; font-size: 16px; }
      .sidebar-name { font-size: 13px; font-weight: 600; color: #F6EFDD; }
      .sidebar-streak { font-size: 11px; color: rgba(237,231,214,0.6); display: flex; align-items: center; gap: 4px; }

      .ph-main { flex: 1; padding: 32px 40px 60px; max-width: 980px; }
      .view { display: flex; flex-direction: column; gap: 22px; }
      .view-header h1 { font-style: normal; }
      .eyebrow { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin: 0 0 4px; }
      .subtitle { color: var(--ink-soft); font-size: 14px; margin: 4px 0 0; }

      .verse-card {
        background: var(--deep); color: #F3EEDD; border-radius: 18px; padding: 28px 32px;
        position: relative; overflow: hidden;
      }
      .verse-dropcap {
        font-family: 'Fraunces', serif; font-style: italic; font-size: 54px; line-height: 0.8;
        float: left; margin-right: 10px; color: var(--accent); font-weight: 500;
      }
      .verse-text { font-family: 'Fraunces', serif; font-size: 19px; line-height: 1.5; margin: 0; font-weight: 400; }
      .verse-ref { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: rgba(243,238,221,0.6); margin: 14px 0 0; clear: both; }

      .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
      .stat-card { background: var(--paper); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; position: relative; }
      .stat-icon { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; color: var(--deep); }
      .flame-bg { background: #FBEBD8; }
      .flame-icon { color: #C9713A; }
      .stat-value { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; color: var(--deep); }
      .stat-label { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }

      .two-col { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; }
      @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

      .panel { background: var(--paper); border: 1px solid var(--border); border-radius: 16px; padding: 22px 24px; }
      .panel-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .panel-header-row h2 { margin-bottom: 0; }

      .pbar-track { width: 100%; background: var(--deep-soft); border-radius: 20px; overflow: hidden; margin-top: 6px; }
      .pbar-fill { height: 100%; border-radius: 20px; transition: width 0.5s ease; }

      .activity-list, .reminder-list, .reminder-manage-list, .session-list, .journal-list, .request-list, .chain-list, .leaderboard-list, .category-breakdown {
        list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
      }
      .activity-list li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .activity-list li:last-child { border-bottom: none; }
      .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .activity-main { display: flex; flex-direction: column; }
      .activity-cat { font-size: 13.5px; font-weight: 600; color: var(--ink); }
      .activity-meta { font-size: 12px; color: var(--ink-soft); }

      .milestone-list { display: flex; flex-direction: column; gap: 16px; }
      .milestone-top { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink); margin-bottom: 4px; }

      .reminder-list li { display: flex; align-items: center; gap: 10px; color: var(--ink-soft); }
      .reminder-label { font-size: 13.5px; font-weight: 600; color: var(--ink); }
      .reminder-time { font-size: 12px; color: var(--ink-soft); }
      .link-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--deep); font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 14px; padding: 0; }
      .link-btn.danger { color: #A24B3E; margin-top: 8px; }

      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .form-grid label { display: flex; flex-direction: column; font-size: 12.5px; color: var(--ink-soft); gap: 6px; font-weight: 600; }
      .form-grid .full-width { grid-column: 1 / -1; }
      .form-grid input, .form-grid select, .form-grid textarea {
        font-family: 'Inter', sans-serif; font-size: 14px; padding: 9px 11px; border-radius: 9px;
        border: 1px solid var(--border); background: var(--parchment); color: var(--ink); font-weight: 400;
      }
      .form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
      .form-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .add-category { display: flex; gap: 8px; }
      .add-category input { border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; font-size: 13px; background: var(--parchment); }
      .add-category button { display: flex; align-items: center; gap: 4px; background: none; border: 1px dashed var(--border); border-radius: 9px; padding: 8px 10px; font-size: 12.5px; color: var(--ink-soft); cursor: pointer; }

      .primary-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--deep); color: #F6EFDD; border: none; padding: 10px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
      .primary-btn:hover { background: #253049; }
      .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .secondary-btn { display: inline-flex; align-items: center; gap: 6px; background: none; color: var(--deep); border: 1px solid var(--border); padding: 9px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
      .secondary-btn:hover { background: var(--deep-soft); }
      .secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .icon-btn { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 6px; border-radius: 8px; }
      .icon-btn:hover { background: var(--mauve-soft); color: #A24B3E; }

      .filter-select { font-size: 12.5px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--parchment); }

      .session-list li { display: flex; align-items: flex-start; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--border); }
      .session-list li:last-child { border-bottom: none; }
      .session-main { flex: 1; }
      .session-top { display: flex; justify-content: space-between; }
      .session-cat { font-size: 13.5px; font-weight: 600; }
      .session-dur { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--ink-soft); }
      .session-date { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
      .session-notes { font-size: 13px; color: var(--ink); margin-top: 6px; font-style: italic; }

      .search-box { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 9px; padding: 6px 10px; background: var(--parchment); }
      .search-box input { border: none; background: none; font-size: 13px; outline: none; width: 160px; }

      .journal-list li { padding: 14px 0; border-bottom: 1px solid var(--border); }
      .journal-list li:last-child { border-bottom: none; }
      .journal-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
      .journal-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: var(--deep); }
      .journal-date { font-size: 12px; color: var(--ink-soft); }
      .journal-text { font-size: 13.5px; line-height: 1.6; color: var(--ink); margin: 0; }

      .tab-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .tab { background: none; border: 1px solid var(--border); border-radius: 20px; padding: 7px 16px; font-size: 13px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
      .tab.active { background: var(--deep); color: #F6EFDD; border-color: var(--deep); }

      .request-list li, .chain-list li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
      .request-list li:last-child, .chain-list li:last-child { border-bottom: none; }
      .status-toggle, .chain-toggle { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 0; display: flex; }
      .answered-icon { color: var(--sage); }
      .chain-toggle.on { color: var(--sage); }
      .request-main, .chain-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
      .request-name, .chain-name { font-size: 13.5px; font-weight: 600; }
      .request-notes, .chain-note { font-size: 12.5px; color: var(--ink-soft); }
      .request-dates { font-size: 11.5px; color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; }
      .chain-list li.prayed .chain-name { color: var(--sage); }

      .chain-progress-card { background: var(--sage-soft); border-radius: 14px; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--deep); }

      .days-label { font-size: 12.5px; color: var(--ink-soft); font-weight: 600; display: block; margin-bottom: 6px; }
      .day-picker { display: flex; gap: 6px; }
      .day-chip { width: 38px; height: 34px; border-radius: 9px; border: 1px solid var(--border); background: var(--parchment); font-size: 12px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
      .day-chip.on { background: var(--deep); color: #F6EFDD; border-color: var(--deep); }

      .reminder-manage-list li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); color: var(--ink-soft); }
      .reminder-manage-list li:last-child { border-bottom: none; }
      .reminder-manage-main { flex: 1; display: flex; flex-direction: column; }
      .reminder-manage-label { font-size: 13.5px; font-weight: 600; color: var(--ink); }
      .reminder-manage-meta { font-size: 12px; color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; }

      .challenge-hero-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
      .challenge-pct { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 600; color: var(--accent); }
      .challenge-total { font-size: 12.5px; color: var(--ink-soft); margin: 8px 0 0; }

      .leaderboard-list li { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .leaderboard-list li:last-child { border-bottom: none; }
      .leaderboard-list li.is-user { background: var(--accent-soft); border-radius: 10px; padding: 8px 10px; border-bottom: none; }
      .rank { width: 18px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); }
      .member-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--deep-soft); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; color: var(--deep); flex-shrink: 0; }
      .member-main { flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .member-name { font-size: 13px; font-weight: 600; }
      .member-hours { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--ink-soft); }

      .category-breakdown li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .cb-name { flex: 1; }
      .cb-hours { font-family: 'IBM Plex Mono', monospace; color: var(--ink-soft); }

      .timer-panel { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 36px 24px; }
      .timer-cat-label { align-self: flex-start; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
      .timer-cat-label select { padding: 8px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--parchment); font-size: 13.5px; }
      .timer-ring-wrap { position: relative; width: 220px; height: 220px; }
      .timer-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: var(--deep-soft); stroke-width: 10; }
      .ring-progress { fill: none; stroke: var(--accent); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
      .timer-readout { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .timer-readout span { font-family: 'IBM Plex Mono', monospace; font-size: 36px; font-weight: 500; color: var(--deep); }
      .timer-readout small { font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
      .timer-controls { display: flex; gap: 10px; }
      .timer-saved { font-size: 13px; color: var(--sage); font-weight: 600; }

      .profile-card .profile-top { display: flex; align-items: center; gap: 16px; }
      .profile-avatar { width: 58px; height: 58px; border-radius: 50%; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; font-size: 28px; }
      .profile-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 14px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
      .profile-stats-row div { display: flex; flex-direction: column; }
      .profile-stats-row strong { font-family: 'Fraunces', serif; font-size: 20px; color: var(--deep); }
      .profile-stats-row span { font-size: 11.5px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; }
      .avatar-picker { display: flex; gap: 8px; flex-wrap: wrap; }
      .avatar-choice { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border); background: var(--parchment); font-size: 18px; cursor: pointer; }
      .avatar-choice.on { border: 2px solid var(--accent); background: var(--accent-soft); } .auth-decor { position: absolute; inset: 0; pointer-events: none; } .auth-decor-icon { position: absolute; font-size: 48px; opacity: 0.55; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15)); } .auth-screen::before { content: ""; position: absolute; inset: 0; background: rgba(20,18,30,0.45); pointer-events: none; }

      .auth-screen { --parchment: #F5F1E6; --paper: #FFFDF8; --ink: #2C2A24; --ink-soft: #736C5C; --deep: #2F3A56; --deep-soft: #E7EAF1; --accent: #C7963C; --accent-soft: #F3E4C4; --sage: #7C9179; --sage-soft: #E2E9DD; --mauve: #96727E; --mauve-soft: #EFE1E5; --border: #E5DDC8;
        min-height: 100vh; width: 100%; display: flex; flex-direction: column; align-items: center;
        background: url('/background.jpg') center/cover no-repeat fixed; padding: 20px; font-family: 'Inter', sans-serif; position: relative; overflow: hidden;
      }
      .auth-card {
        background: #FFFDF8; border: 1px solid #E5DDC8; border-radius: 20px; position: relative; z-index: 1;
        padding: 34px 34px 28px; width: 100%; max-width: 420px;
      }
      .auth-topbar { position: relative; z-index: 1; width: 100%; max-width: 1040px; display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 28px; } .auth-topbar-brand { display: flex; align-items: center; gap: 10px; } .auth-topbar-brand .brand-mark { font-size: 24px; } .auth-topbar-title { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 600; color: #F6EFDD; } .auth-topbar-icon { font-size: 22px; } .auth-center { position: relative; z-index: 1; width: 100%; max-width: 1040px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 48px; flex-wrap: wrap; } .auth-brand { display: none; }
      .auth-brand .brand-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; color: var(--deep); }
      .auth-brand .brand-sub { font-size: 11.5px; color: var(--ink-soft); }
      .auth-verse { font-family: 'Fraunces', serif; font-style: italic; font-size: 14.5px; color: var(--ink-soft); margin: 0 0 20px; line-height: 1.5; }
      .auth-error { font-size: 12.5px; color: #A24B3E; background: var(--mauve-soft); border-radius: 8px; padding: 8px 12px; margin: 0; }
      .setup-notice { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--ink-soft); background: var(--accent-soft); border-radius: 10px; padding: 12px 14px; margin: 14px 0; line-height: 1.5; }
      .setup-notice svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
      .setup-notice code { background: rgba(0,0,0,0.06); border-radius: 4px; padding: 1px 5px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
      .auth-note { font-size: 11.5px; color: var(--ink-soft); margin: 18px 0 0; line-height: 1.5; } .auth-visual { position: relative; width: 460px; height: 380px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; } .mock-laptop { position: absolute; left: 0; top: 30px; width: 340px; z-index: 1; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.35)); } .mock-laptop-screen { background: #1F2437; border-radius: 10px 10px 4px 4px; padding: 10px 10px 16px; border: 6px solid #12141F; } .mock-topbar { display: flex; gap: 5px; padding: 2px 4px 10px; } .mock-topbar span { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.25); } .mock-app { background: #F5F1E6; border-radius: 6px; padding: 14px 14px 16px; min-height: 170px; } .mock-app-title { font-family: 'Fraunces', serif; font-size: 13px; font-weight: 600; color: #2F3A56; margin-bottom: 12px; } .mock-req-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #E5DDC8; } .mock-req-item:last-child { border-bottom: none; } .mock-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; } .mock-dot-mauve { background: #96727E; } .mock-dot-sage { background: #7C9179; } .mock-dot-accent { background: #C7963C; } .mock-lines { flex: 1; display: flex; flex-direction: column; gap: 5px; } .mock-line-main { display: block; width: 70%; height: 7px; border-radius: 4px; background: #D9D2BC; } .mock-line-sub { display: block; width: 45%; height: 6px; border-radius: 4px; background: #E9E3D1; } .mock-laptop-base { height: 12px; width: 112%; margin-left: -6%; background: linear-gradient(#2B2F42, #12141F); border-radius: 0 0 14px 14px; margin-top: 2px; } .mock-phone { position: absolute; right: 10px; bottom: -20px; width: 148px; z-index: 2; background: #12141F; border-radius: 30px; padding: 12px 9px 16px; box-shadow: 0 20px 30px rgba(0,0,0,0.35); } .mock-phone-notch { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 46%; height: 14px; background: #12141F; border-radius: 0 0 10px 10px; z-index: 3; } .mock-phone-screen { background: #F5F1E6; border-radius: 20px; padding: 22px 10px 14px; min-height: 230px; position: relative; overflow: hidden; } .mock-phone-screen .mock-app-title { font-size: 12px; margin-bottom: 10px; } .mock-stat-row { display: flex; gap: 6px; margin-bottom: 14px; } .mock-stat-chip { flex: 1; background: #F3E4C4; border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; } .mock-stat-num { font-family: 'Fraunces', serif; font-size: 14px; font-weight: 600; color: #2F3A56; } .mock-stat-label { font-size: 8.5px; color: #736C5C; text-transform: uppercase; letter-spacing: 0.03em; } .mock-bars { display: flex; align-items: flex-end; gap: 4px; height: 60px; } .mock-bars span { flex: 1; background: #2F3A56; border-radius: 3px 3px 0 0; opacity: 0.85; } .mock-phone-home { width: 36%; height: 4px; background: rgba(255,255,255,0.35); border-radius: 3px; margin: 8px auto 0; } .mock-dash-greeting { font-family: 'Fraunces', serif; font-size: 13px; font-weight: 600; color: #2F3A56; margin-bottom: 8px; } .mock-dash-greeting-sm { font-size: 11px; } .mock-verse-card { background: #2F3A56; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; } .mock-verse-card .mock-verse-text { font-family: 'Fraunces', serif; font-style: italic; font-size: 9.5px; color: #F3EEDD; line-height: 1.4; margin: 0; } .mock-verse-card-sm .mock-verse-text { font-size: 8px; } @media (max-width: 900px) { .auth-visual { display: none; } }me="auth-center"><div className="auth-visual" aria-hidden="true"><div className="mock-laptop"><div className="mock-laptop-screen"><div className="mock-topbar"><span></span><span></span><span></span></div>ZZZTESTZZZ</div><div className="mock-laptop-base"></div></div><div className="mock-phone"><div className="mock-phone-notch"></div><div className="mock-phone-screen"><div className="mock-dash-greeting mock-dash-greeting-sm">Good morning</div><div className="mock-verse-card mock-verse-card-sm"><p className="mock-verse-text">"In the morning will I direct my prayer."</p></div><div className="mock-stat-row"><div className="mock-stat-chip"><span className="mock-stat-num">8.1</span><span className="mock-stat-label">hrs</span></div><div className="mock-stat-chip"><span className="mock-stat-num">9%</span><span className="mock-stat-label">goal</span></div></div><div className="mock-bars"><span style={{height:"30%"}}></span><span style={{height:"55%"}}></span><span style={{height:"40%"}}></span><span style={{height:"70%"}}></span><span style={{height:"50%"}}></span><span style={{height:"85%"}}></span></div></div><div className="mock-phone-home"></div></div></div>

      .copy-link-row { display: flex; flex-direction: column; gap: 6px; }
      .copy-link-label { font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
      .copy-link-field { display: flex; gap: 8px; }
      .copy-link-field input {
        flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 9px 11px;
        border-radius: 9px; border: 1px solid var(--border); background: var(--parchment); color: var(--ink-soft);
        min-width: 0;
      }

      .session-edit-form { flex: 1; padding: 6px 0; }

      .badge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
      .badge-card { border-radius: 14px; padding: 16px; text-align: center; border: 1px solid var(--border); }
      .badge-card.unlocked { background: var(--accent-soft); }
      .badge-card.locked { opacity: 0.45; filter: grayscale(0.5); }
      .badge-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--paper); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: var(--deep); }
      .badge-card.unlocked .badge-icon { color: var(--accent); }
      .badge-title { font-size: 13px; font-weight: 600; color: var(--deep); }
      .badge-desc { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }

      .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 30px 10px; color: var(--ink-soft); gap: 6px; }
      .empty-title { font-weight: 600; color: var(--ink); margin: 4px 0 0; }
      .empty-body { font-size: 13px; margin: 0; max-width: 260px; }

      .celebration-banner {
        position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 40;
        background: var(--deep); color: #F6EFDD; padding: 10px 20px; border-radius: 30px;
        font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      }
      .confetti-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 39; overflow: hidden; }
      .confetti-piece { position: absolute; top: -12px; width: 8px; height: 14px; opacity: 0.9; animation: confetti-fall 2.4s ease-in forwards; }
      @keyframes confetti-fall { to { transform: translateY(100vh) rotate(200deg); opacity: 0; } }

      @media (prefers-reduced-motion: reduce) {
        .confetti-piece { animation: none; display: none; }
        .ring-progress, .pbar-fill { transition: none; }
      }

      @media (max-width: 780px) {
        .mobile-nav-toggle { display: flex; }
        .ph-sidebar { position: fixed; left: -240px; top: 0; height: 100vh; z-index: 25; transition: left 0.2s ease; }
        .ph-sidebar.open { left: 0; }
        .ph-main { padding: 70px 18px 50px; }
        .form-grid { grid-template-columns: 1fr; }
        .card-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
      }
    `}</style>
  );
}
