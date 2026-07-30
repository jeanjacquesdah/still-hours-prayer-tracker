import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
    Home, Clock, NotebookPen, HeartHandshake, Users, Bell, Trophy,
    BarChart3, User, Play, Pause, RotateCcw, Flame, CheckCircle2,
    Circle, Search, Plus, X, Award, Calendar, Sparkles, Link2, Menu,
    Trash2, ChevronRight, Sunrise, PlusCircle, BookMarked, TrendingUp,
} from "lucide-react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

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

const toKey = (d) => {
    const dt = new Date(d);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
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

/* ============================= SEED DATA ============================= */

function seedSessions() {
    const notes = [
          "Felt a real sense of peace during this time.",
          "Prayed for the family situation we discussed last week.",
          "Read through Psalm 23 slowly, sat with it a while.",
          "Quiet morning, needed the stillness.",
          "Brought the week's worries before the Lord.",
          "Gave thanks for how things worked out at work.",
          "",
        ];
    const cats = DEFAULT_CATEGORIES;
    const out = [];
    for (let i = 20; i >= 0; i--) {
          if (Math.random() < 0.28) continue; // skip some days
      const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0, 0);
          out.push({
                  id: uid(),
                  date: d.toISOString(),
                  duration: 10 + Math.floor(Math.random() * 40),
                  category: cats[Math.floor(Math.random() * cats.length)],
                  notes: notes[Math.floor(Math.random() * notes.length)],
          });
    }
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
}

const SEED_JOURNAL = [
  {
        id: uid(),
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
        title: "Stillness in the morning",
        text: "Woke up early and just sat in silence before turning to words. There is something about the quiet that says more than any request I could bring.",
  },
  {
        id: uid(),
        date: new Date(Date.now() - 8 * 86400000).toISOString(),
        title: "Answered, finally",
        text: "The thing I have been bringing up for months shifted this week. Grateful doesn't feel like a big enough word for it.",
  },
  ];

const SEED_REQUESTS = [
  { id: uid(), name: "Mom's recovery", status: "ongoing", notes: "Continued healing after surgery.", dateAdded: new Date(Date.now() - 14 * 86400000).toISOString(), dateAnswered: null },
  { id: uid(), name: "Job interview for Sam", status: "answered", notes: "Offer came through Tuesday.", dateAdded: new Date(Date.now() - 20 * 86400000).toISOString(), dateAnswered: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: uid(), name: "Wisdom for a decision", status: "ongoing", notes: "Whether to move for the new role.", dateAdded: new Date(Date.now() - 5 * 86400000).toISOString(), dateAnswered: null },
  ];

const SEED_CHAIN = [
  { id: uid(), name: "Grandma Ruth", note: "Health and comfort", prayedDate: null },
  { id: uid(), name: "The Alvarez family", note: "New baby, adjusting to sleep", prayedDate: toKey(new Date()) },
  { id: uid(), name: "Pastor Dan", note: "Wisdom for Sunday's message", prayedDate: null },
  { id: uid(), name: "James (coworker)", note: "Going through a hard season", prayedDate: null },
  ];

const SEED_REMINDERS = [
  { id: uid(), label: "Morning quiet time", time: "06:30", days: [1, 2, 3, 4, 5] },
  { id: uid(), label: "Evening gratitude", time: "21:00", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: uid(), label: "Sunday intercession", time: "17:00", days: [0] },
  ];

const CHALLENGE = {
    title: "30 Days of Faithfulness",
    goalHours: 100,
    endsInDays: 9,
    members: [
      { name: "You", isUser: true },
      { name: "Priya", hours: 14.5 },
      { name: "Marcus", hours: 11.2 },
      { name: "Grace", hours: 9.8 },
      { name: "Tomas", hours: 7.4 },
        ],
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

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.4} />
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
    </div>
  );
}

/* ============================= APP ============================= */

function loadLS(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return fallback;
}

export default function PrayerHoursApp() {
  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const [profile, setProfile] = useState(() => loadLS("ph_profile", {
    name: "Jean",
    avatar: "🕊️",
    weeklyGoalHours: 5,
    memberSince: new Date(Date.now() - 96 * 86400000).toISOString(),
  }));

  const [sessions, setSessions] = useState(() => loadLS("ph_sessions", null) || seedSessions());
  const [customCategories, setCustomCategories] = useState(() => loadLS("ph_customCategories", []));
  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const [journal, setJournal] = useState(() => loadLS("ph_journal", SEED_JOURNAL));
  const [requests, setRequests] = useState(() => loadLS("ph_requests", SEED_REQUESTS));
  const [chain, setChain] = useState(() => loadLS("ph_chain", SEED_CHAIN));
  const [reminders, setReminders] = useState(() => loadLS("ph_reminders", SEED_REMINDERS));

  useEffect(() => { localStorage.setItem("ph_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("ph_sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("ph_customCategories", JSON.stringify(customCategories)); }, [customCategories]);
  useEffect(() => { localStorage.setItem("ph_journal", JSON.stringify(journal)); }, [journal]);
  useEffect(() => { localStorage.setItem("ph_requests", JSON.stringify(requests)); }, [requests]);
  useEffect(() => { localStorage.setItem("ph_chain", JSON.stringify(chain)); }, [chain]);
  useEffect(() => { localStorage.setItem("ph_reminders", JSON.stringify(reminders)); }, [reminders]);

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
    const goalMin = profile.weeklyGoalHours * 60;
    const pct = goalMin > 0 ? (thisWeekMinutes / goalMin) * 100 : 0;
    if (pct >= 100 && prevWeekPctRef.current < 100) {
      setCelebration(true);
      const t = setTimeout(() => setCelebration(false), 2600);
      return () => clearTimeout(t);
    }
    prevWeekPctRef.current = pct;
  }, [thisWeekMinutes, profile.weeklyGoalHours]);

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
          <div>
            <div className="sidebar-name">{profile.name}</div>
            <div className="sidebar-streak"><Flame size={12} /> {stats.currentStreak}-day streak</div>
          </div>
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
          <PrayerChain chain={chain} setChain={setChain} />
        )}
        {view === "reminders" && (
          <Reminders reminders={reminders} setReminders={setReminders} />
        )}
        {view === "challenges" && (
          <GroupChallenge stats={stats} />
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
    { label: "Weekly hours goal (" + profile.weeklyGoalHours + "h)", value: thisWeekMinutes / 60, max: profile.weeklyGoalHours, color: "var(--accent)" },
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
                  formatter={(v) => [v + " min", "Prayed"]}
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

function SessionLog({ sessions, addSession, deleteSession, allCategories, customCategories, setCustomCategories }) {
  const [duration, setDuration] = useState(15);
  const [category, setCategory] = useState(allCategories[0]);
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState("All");

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
            <button type="submit" className="primary-btn"><PlusCircle size={16} /> Log session</button>
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
                <span className="dot" style={{ background: catColor(s.category, allCategories) }} />
                <div className="session-main">
                  <div className="session-top">
                    <span className="session-cat">{s.category}</span>
                    <span className="session-dur">{s.duration} min</span>
                  </div>
                  <div className="session-date">{formatDateTime(s.date)}</div>
                  {s.notes && <div className="session-notes">{s.notes}</div>}
                </div>
                <button className="icon-btn" onClick={() => deleteSession(s.id)} aria-label="Delete session"><Trash2 size={15} /></button>
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
      setSavedMsg("Saved " + mins + " minute" + (mins === 1 ? "" : "s") + " of " + category.toLowerCase() + ".");
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
          <EmptyState icon={HeartHandshake} title={"No " + tab + " requests"} body="Requests you add will show up here." />
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
                    Added {formatDate(r.dateAdded)}{r.dateAnswered ? " · Answered " + formatDate(r.dateAnswered) : ""}
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

function PrayerChain({ chain, setChain }) {
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

  return (
    <div className="view">
      <header className="view-header"><h1>Prayer chain</h1><p className="subtitle">People to hold in prayer today.</p></header>

      <div className="chain-progress-card">
        <span>{prayedCount} of {chain.length} prayed for today</span>
        <ProgressBar value={prayedCount} max={chain.length || 1} color="var(--sage)" />
      </div>

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
                  <span className="reminder-manage-meta">{r.time} · {r.days.map((d) => DAY_NAMES[d]).join(", ")}</span>
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

function GroupChallenge({ stats }) {
  const membersWithUser = CHALLENGE.members.map((m) => m.isUser ? { ...m, hours: stats.totalHours } : m);
  const totalHours = membersWithUser.reduce((a, m) => a + m.hours, 0);
  const pct = Math.min(100, (totalHours / CHALLENGE.goalHours) * 100);
  const sorted = [...membersWithUser].sort((a, b) => b.hours - a.hours);

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
        <h2>Leaderboard</h2>
        <ul className="leaderboard-list">
          {sorted.map((m, i) => (
            <li key={m.name} className={m.isUser ? "is-user" : ""}>
              <span className="rank">{i + 1}</span>
              <div className="member-avatar">{m.name[0]}</div>
              <div className="member-main">
                <span className="member-name">{m.name}{m.isUser ? " (you)" : ""}</span>
                <ProgressBar value={m.hours} max={Math.max(...membersWithUser.map((x) => x.hours), 1)} color={m.isUser ? "var(--accent)" : "var(--sage)"} height={7} />
              </div>
              <span className="member-hours">{m.hours.toFixed(1)}h</span>
            </li>
          ))}
        </ul>
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
                formatter={(v) => [v + " h", "Hours"]}
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
                  <Tooltip formatter={(v, n) => [v + " h", n]} contentStyle={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
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
      .avatar-choice.on { border: 2px solid var(--accent); background: var(--accent-soft); }

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
