import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CSSProperties, ReactNode } from 'react';
import {
  buildPrepIntelligence,
  buildScoreRecovery,
  rankSubjects,
  type Subject,
  type SubjectStats,
} from './prepIntelligence';

type Stats = SubjectStats;

type PrepDNA = {
  stage: 'Class 11' | 'Class 12' | 'Dropper';
  coaching: 'Offline coaching' | 'Online coaching' | 'Hybrid' | 'Self study';
  hours: number;
  focus: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
};

type Props = {
  user: User | null;
  target: number;
  setTarget: (value: number | ((value: number) => number)) => void;
  stats: Stats;
  totalAnswered: number;
  overallAccuracy: number;
  today: number;
  dailyGoal: number;
  streakDays: number;
  mistakes: string[];
  saved: string[];
  activity: Record<string, number>;
  announcementsCount: number;
  onAnnouncements: () => void;
  onPractice: (count: number, title: string, ids?: string[]) => void;
  onGo: (tab: 'practice' | 'mocks' | 'saved' | 'mistakes' | 'progress') => void;
  questionIds: string[];
  subjectQuestionIds: Record<Subject, string[]>;
};

const DNA_KEY = 'neetprep-prep-dna-v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* local-only */
  }
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const paths: Record<string, ReactNode> = {
    play: <><path d="m9 6 9 6-9 6V6Z" /></>,
    practice: <><circle cx="12" cy="12" r="8" /><path d="M8 12h8M12 8v8" /></>,
    test: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22Z" /><path d="M5 4.5V22" /></>,
    note: <><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
    flame: <><path d="M12 21c4 0 7-2.7 7-6.6 0-3.4-2.2-5.9-4.4-8.4-.2 2-1 3.3-2.1 4.3.2-3.5-1.8-6.1-4.2-8.3.1 3.5-3.3 5.7-3.3 10.2C5 18 8 21 12 21Z" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <><path d="m9 6 6 6-6 6" /></>,
    spark: <><path d="m12 2 1.5 5L19 9l-5.5 2L12 16l-1.5-5L5 9l5.5-2L12 2Z" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    flash: <><path d="M12 2 5 13h6l-1 9 7-11h-6l1-9Z" /></>,
    doubt: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1 .7-1.8 1.1-1.8 2.8M12 17h.01" /></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 9 4-2v10l-4-2" /><path d="m9 9 4 3-4 3V9Z" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
    rank: <><path d="M5 20V9M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    planner: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  };

  return <svg {...p}>{paths[name] ?? paths.grid}</svg>;
}

type MenuItem = {
  title: string;
  sub: string;
  icon: string;
  tone: string;
  action: () => void;
  badge?: string;
};

const TONES: Record<string, string> = {
  violet: '#8b63ef',
  blue: '#4b8fe9',
  orange: '#efa83f',
  sky: '#52b7ed',
  pink: '#e985b0',
  green: '#4dcc98',
  amber: '#e7ad3e',
  purple: '#a174f2',
  teal: '#52d0bf',
  coral: '#ed806f',
  cyan: '#54c6e5',
  rose: '#e9839b',
};

export default function StudentExperience(props: Props) {
  const [dna, setDna] = useState<PrepDNA>(() =>
    load<PrepDNA>(DNA_KEY, {
      stage: 'Dropper',
      coaching: 'Offline coaching',
      hours: 6,
      focus: 'Evening',
    }),
  );
  const [dnaOpen, setDnaOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  const intelligence = useMemo(
    () => buildPrepIntelligence(
      props.stats,
      props.mistakes.length,
      props.today,
      props.dailyGoal,
      props.target,
    ),
    [props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target],
  );

  const recovery = useMemo(
    () => buildScoreRecovery(props.stats, props.mistakes.length),
    [props.stats, props.mistakes.length],
  );

  const ranked = useMemo(() => rankSubjects(props.stats), [props.stats]);

  const firstName = props.user?.user_metadata?.display_name
    || props.user?.email?.split('@')[0]
    || 'Student';
  const first = String(firstName).split(' ')[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const remaining = Math.max(0, props.dailyGoal - props.today);
  const dailyPct = Math.min(
    100,
    Math.round((props.today / Math.max(1, props.dailyGoal)) * 100),
  );
  const level = Math.max(1, Math.floor((props.totalAnswered + props.streakDays * 10) / 100) + 1);
  const xp = props.totalAnswered * 5 + props.streakDays * 12;

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - index));
      return {
        label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        count: props.activity[dayKey(d)] ?? 0,
        today: index === 6,
      };
    }),
    [props.activity],
  );

  const startSmart = () => {
    if (intelligence.action === 'repair' && props.mistakes.length) {
      props.onPractice(
        Math.min(10, props.mistakes.length),
        `${intelligence.subject ?? 'Mistake'} repair`,
        props.mistakes,
      );
      return;
    }

    if (intelligence.subject) {
      props.onPractice(
        10,
        `${intelligence.subject} practice`,
        props.subjectQuestionIds[intelligence.subject],
      );
      return;
    }

    props.onPractice(10, 'Daily Practice');
  };

  const saveDNA = () => {
    save(DNA_KEY, dna);
    setDnaOpen(false);
  };

  const closeExplore = () => setExploreOpen(false);
  const openPractice = () => { closeExplore(); props.onGo('practice'); };
  const openTests = () => { closeExplore(); props.onGo('mocks'); };
  const openSaved = () => { closeExplore(); props.onGo('saved'); };
  const openMistakes = () => { closeExplore(); props.onGo('mistakes'); };
  const openProgress = () => { closeExplore(); props.onGo('progress'); };

  const menu: MenuItem[] = [
    { title: 'Lectures', sub: 'Learn concepts', icon: 'video', tone: 'violet', action: closeExplore, badge: 'Soon' },
    { title: 'Question Bank', sub: 'Practice by topic', icon: 'practice', tone: 'blue', action: openPractice },
    { title: 'Daily DPP', sub: 'Daily practice', icon: 'bolt', tone: 'orange', action: () => { closeExplore(); startSmart(); } },
    { title: 'Test Series', sub: 'Mocks & tests', icon: 'test', tone: 'sky', action: openTests },
    { title: 'PYQs', sub: 'Previous years', icon: 'layers', tone: 'pink', action: openPractice, badge: 'Soon' },
    { title: 'Mistake Book', sub: `${props.mistakes.length} to revise`, icon: 'target', tone: 'green', action: openMistakes },
    { title: 'Saved', sub: `${props.saved.length} questions`, icon: 'book', tone: 'amber', action: openSaved },
    { title: 'Flashcards', sub: 'Quick revision', icon: 'flash', tone: 'purple', action: closeExplore, badge: 'Soon' },
    { title: 'NCERT Mode', sub: 'Line-by-line prep', icon: 'note', tone: 'teal', action: closeExplore, badge: 'Soon' },
    { title: 'Study Planner', sub: 'Plan your day', icon: 'planner', tone: 'coral', action: closeExplore, badge: 'Soon' },
    { title: 'Performance', sub: `${props.overallAccuracy}% accuracy`, icon: 'chart', tone: 'cyan', action: openProgress },
    { title: 'Doubt Centre', sub: 'Ask & resolve', icon: 'doubt', tone: 'rose', action: closeExplore, badge: 'Soon' },
    { title: 'Rank Predictor', sub: 'Track your target', icon: 'rank', tone: 'orange', action: closeExplore, badge: 'Soon' },
    { title: 'Challenges', sub: 'Compete & improve', icon: 'trophy', tone: 'pink', action: closeExplore, badge: 'Soon' },
  ];

  const quick = [
    {
      title: 'Practice',
      sub: `${Math.max(0, 10)} focused questions`,
      icon: 'practice',
      tone: '#825be8',
      action: openPractice,
      className: 'violet',
    },
    {
      title: 'Mock Tests',
      sub: 'Real exam flow',
      icon: 'test',
      tone: '#438ee8',
      action: openTests,
      className: 'blue',
    },
    {
      title: 'Saved',
      sub: `${props.saved.length} to revise`,
      icon: 'book',
      tone: '#e7a33a',
      action: openSaved,
      className: 'amber',
    },
    {
      title: 'Mistake Bank',
      sub: `${props.mistakes.length} need review`,
      icon: 'target',
      tone: '#3fc38e',
      action: openMistakes,
      className: 'green',
    },
  ];

  const css = `
    .student-v7{
      --v-bg:var(--np-bg,#f5f5f7);--v-panel:rgba(255,255,255,.78);--v-panel2:#fff;--v-text:var(--np-text,#1d1d1f);--v-muted:#86868b;--v-line:rgba(0,0,0,.07);
      width:100%;max-width:1180px;margin:0 auto;padding:30px 34px 110px;color:var(--v-text);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,system-ui,sans-serif;
    }
    .app[data-appearance='dark'] .student-v7{--v-bg:#090a0c;--v-panel:rgba(28,29,33,.76);--v-panel2:#1c1d21;--v-text:#f5f5f7;--v-muted:#98989f;--v-line:rgba(255,255,255,.09)}
    .v7-top{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 0 20px;border-bottom:1px solid var(--v-line)}
    .v7-brand{display:flex;align-items:center;gap:11px}.v7-logo{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:#f5b940;color:#161616;font-size:16px;font-weight:800;box-shadow:0 7px 18px rgba(245,185,64,.18)}.v7-brand-name{font-size:20px;font-weight:700;letter-spacing:-.8px}.v7-brand-name span{color:var(--accent,#f5b940)}
    .v7-actions{display:flex;gap:7px}.v7-round{position:relative;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--v-text);border:1px solid var(--v-line);background:var(--v-panel);box-shadow:0 4px 16px rgba(0,0,0,.04);transition:transform .2s,background .2s}.v7-round:hover{transform:scale(1.04);background:var(--v-panel2)}.v7-dot{position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:#ff453a;border:2px solid var(--v-panel2)}.v7-avatar{font-size:12px;font-weight:800}

    .v7-welcome{padding:58px 0 24px}.v7-welcome small{font-size:11px;letter-spacing:.08em;color:var(--v-muted);font-weight:650}.v7-welcome h1{margin:11px 0 9px;font-size:clamp(42px,5.2vw,68px);line-height:.98;letter-spacing:-.055em;font-weight:750}.v7-welcome h1 .gold{color:var(--accent,#f5b940)}.v7-welcome p{margin:0;color:var(--v-muted);font-size:16px;line-height:1.5;letter-spacing:-.01em}
    .v7-course{width:100%;display:flex;align-items:center;gap:13px;padding:13px 15px;margin:0 0 20px;border:1px solid var(--v-line);border-radius:18px;background:var(--v-panel);color:var(--v-text);text-align:left;box-shadow:0 8px 28px rgba(0,0,0,.035);backdrop-filter:blur(20px);transition:.2s}.v7-course:hover{transform:translateY(-1px);background:var(--v-panel2)}.v7-course-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--accent);background:color-mix(in srgb,var(--accent) 11%,transparent)}.v7-course-copy{flex:1;min-width:0}.v7-course-copy small{display:block;color:var(--v-muted);font-size:9px;letter-spacing:.08em;font-weight:750}.v7-course-copy b{display:block;margin-top:3px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-edit{color:var(--accent);font-size:9px;font-weight:750}

    .v7-hero{position:relative;overflow:hidden;min-height:280px;border-radius:30px;padding:34px;background:#1d1d1f;color:#fff;border:0;box-shadow:0 25px 60px rgba(0,0,0,.16)}.app[data-appearance='dark'] .v7-hero{background:#151618}.v7-hero:before{content:"";position:absolute;width:520px;height:520px;right:-210px;top:-260px;border-radius:50%;border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 45px rgba(255,255,255,.025),0 0 0 100px rgba(255,255,255,.015)}.v7-hero-content{position:relative;z-index:1}.v7-hero-top{display:flex;justify-content:space-between;gap:30px}.v7-kicker{font-size:10px;letter-spacing:.11em;font-weight:750;color:#9fe5d8}.v7-hero h2{font-size:clamp(32px,4vw,48px);line-height:1.02;letter-spacing:-.055em;margin:12px 0 11px;max-width:620px;font-weight:720}.v7-hero p{margin:0;max-width:560px;color:#aeb0b5;font-size:14px;line-height:1.55}.v7-ring{--v7p:0%;width:92px;height:92px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#0a84ff var(--v7p),rgba(255,255,255,.11) 0);position:relative}.v7-ring:before{content:"";position:absolute;inset:8px;border-radius:50%;background:#1d1d1f}.v7-ring b{position:relative;font-size:15px}.v7-hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}.v7-chip{padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.08);font-size:10px;color:#e8e8eb}.v7-chip strong{color:#fff}.v7-hero-btn{margin-top:22px;border:0;border-radius:999px;padding:12px 16px;display:inline-flex;align-items:center;gap:9px;background:#fff;color:#1d1d1f;font-size:11px;font-weight:750;box-shadow:0 8px 22px rgba(0,0,0,.12);transition:.2s}.v7-hero-btn:hover{transform:translateY(-1px) scale(1.01)}

    .v7-section{margin-top:54px}.v7-head{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin-bottom:16px}.v7-label{font-size:10px;letter-spacing:.09em;color:var(--v-muted);font-weight:750}.v7-head h2{font-size:27px;line-height:1.05;letter-spacing:-.045em;margin:6px 0 0;font-weight:720}.v7-link{border:0;background:none;color:#007aff;font-size:11px;font-weight:650;padding:4px 0}

    .v7-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.v7-quick-card{--tone:#007aff;position:relative;min-height:150px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:18px;border:1px solid var(--v-line);border-radius:22px;background:var(--v-panel);color:var(--v-text);overflow:hidden;box-shadow:0 7px 25px rgba(0,0,0,.035);transition:transform .22s,box-shadow .22s,background .22s}.v7-quick-card:hover{transform:translateY(-4px);box-shadow:0 15px 35px rgba(0,0,0,.09);background:var(--v-panel2)}.v7-quick-card:before{content:"";position:absolute;width:170px;height:170px;right:-95px;top:-90px;border-radius:50%;background:var(--tone);opacity:.075}.v7-quick-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:var(--tone);background:color-mix(in srgb,var(--tone) 11%,transparent);position:relative}.v7-quick-card b{font-size:15px;margin-top:18px;letter-spacing:-.02em;position:relative}.v7-quick-card span:not(.v7-arrow){font-size:10px;color:var(--v-muted);margin-top:5px;position:relative}.v7-arrow{position:absolute;right:17px;bottom:16px;color:var(--v-muted);font-size:22px}

    .v7-continue,.v7-progress,.v7-plan-row,.v7-subject,.v7-signal,.v7-streak,.v7-recovery{border:1px solid var(--v-line);background:var(--v-panel);box-shadow:0 7px 25px rgba(0,0,0,.035);backdrop-filter:blur(18px)}
    .v7-continue{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:20px}.v7-play{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#007aff;color:#fff;flex:0 0 auto}.v7-copy{flex:1;min-width:0}.v7-copy small{font-size:9px;color:var(--v-muted);font-weight:700}.v7-copy b{display:block;font-size:14px;margin-top:4px}.v7-copy span{display:block;color:var(--v-muted);font-size:10px;margin-top:4px}.v7-start{border:0;border-radius:999px;padding:9px 13px;background:var(--v-text);color:var(--v-bg);font-size:10px;font-weight:750}

    .v7-progress{display:grid;grid-template-columns:1fr 110px;gap:28px;padding:20px;border-radius:22px}.v7-progress-main b{font-size:15px}.v7-progress-main p{font-size:10px;color:var(--v-muted);margin:6px 0 16px}.v7-bigbar{height:9px;border-radius:999px;background:color-mix(in srgb,var(--v-text) 9%,transparent);overflow:hidden}.v7-bigbar i{display:block;height:100%;border-radius:999px;background:#0a84ff}.v7-progress-stats{display:flex;justify-content:space-between;margin-top:8px;color:var(--v-muted);font-size:9px}.v7-progress-ring{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#0a84ff var(--v7p),color-mix(in srgb,var(--v-text) 9%,transparent) 0);position:relative}.v7-progress-ring:before{content:"";position:absolute;inset:9px;border-radius:50%;background:var(--v-panel2)}.v7-progress-ring b{position:relative;font-size:15px}

    .v7-plan{display:grid;gap:8px}.v7-plan-row{display:grid;grid-template-columns:48px 44px 1fr auto;align-items:center;gap:12px;padding:13px 15px;border-radius:18px}.v7-time{font-size:9px;color:var(--v-muted);font-weight:750}.v7-plan-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#007aff;background:color-mix(in srgb,#007aff 9%,transparent)}.v7-plan-copy{min-width:0}.v7-plan-copy b{display:block;font-size:12px}.v7-plan-copy span{display:block;color:var(--v-muted);font-size:9px;margin-top:3px}.v7-plan-row button{border:0;border-radius:999px;background:color-mix(in srgb,#007aff 9%,transparent);color:#007aff;padding:8px 12px;font-size:9px;font-weight:750}

    .v7-subjects{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.v7-subject{width:100%;text-align:left;color:var(--v-text);padding:17px;border-radius:19px}.v7-subject-top{display:flex;justify-content:space-between;gap:10px}.v7-subject-top b{font-size:12px}.v7-subject-top span{font-size:9px;color:var(--v-muted)}.v7-track{height:6px;border-radius:999px;background:color-mix(in srgb,var(--v-text) 8%,transparent);margin-top:14px;overflow:hidden}.v7-track i{display:block;height:100%;border-radius:inherit;background:#0a84ff}

    .v7-signal{display:flex;align-items:center;gap:14px;padding:17px;border-radius:20px}.v7-signal-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,#af52de 12%,transparent);color:#af52de}.v7-signal-copy{flex:1;min-width:0}.v7-signal-copy small{font-size:9px;color:#af52de;font-weight:750}.v7-signal-copy b{display:block;font-size:13px;margin-top:4px}.v7-signal-copy p{font-size:10px;color:var(--v-muted);margin:4px 0 0}.v7-signal button{width:34px;height:34px;border:0;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--v-text) 7%,transparent);color:var(--v-text)}

    .v7-streak{display:flex;align-items:center;gap:13px;padding:16px 17px;border-radius:20px}.v7-streak-flame{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,#ff9500 12%,transparent);color:#ff9500}.v7-streak-copy{flex:1}.v7-streak-copy b{display:block;font-size:13px}.v7-streak-copy span{display:block;font-size:9px;color:var(--v-muted);margin-top:3px}.v7-xp{font-size:10px;color:#ff9500;font-weight:700}.v7-week{display:grid;grid-template-columns:repeat(7,1fr);gap:7px;margin-top:9px}.v7-day{padding:10px 4px;border-radius:13px;text-align:center;background:var(--v-panel);border:1px solid var(--v-line)}.v7-day span{display:block;font-size:8px;color:var(--v-muted);font-weight:650}.v7-day i{display:block;font-size:12px;font-style:normal;font-weight:750;margin-top:5px}.v7-day.active i{color:#0a84ff}.v7-day.today{box-shadow:inset 0 -2px #0a84ff}
    .v7-recovery{display:flex;align-items:center;gap:13px;padding:16px;border-radius:20px}.v7-recovery-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,#ff453a 10%,transparent);color:#ff453a}.v7-recovery-copy{flex:1}.v7-recovery-copy small{font-size:9px;color:var(--v-muted);font-weight:750}.v7-recovery-copy b{display:block;font-size:12px;margin-top:4px}.v7-score{text-align:right}.v7-score b{font-size:19px}.v7-score span{display:block;color:var(--v-muted);font-size:8px}

    .v7-explore{position:fixed;inset:0;z-index:140;background:rgba(245,245,247,.78);color:#1d1d1f;backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);overflow:auto}.app[data-appearance='dark'] .v7-explore{background:rgba(8,9,11,.82);color:#f5f5f7}.v7-explore-inner{width:min(1040px,100%);margin:0 auto;padding:48px 30px 70px}.v7-explore-top{display:flex;justify-content:space-between;gap:20px;margin-bottom:30px}.v7-explore-top h2{font-size:46px;letter-spacing:-.055em;margin:7px 0}.v7-explore-top p{max-width:610px;color:var(--v-muted);font-size:13px;line-height:1.55}.v7-explore-close{width:42px;height:42px;border:1px solid var(--v-line);border-radius:50%;background:var(--v-panel);color:inherit;display:grid;place-items:center}.v7-app-section{font-size:9px;color:var(--v-muted);font-weight:750;letter-spacing:.1em;margin:28px 0 11px}.v7-menu-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.v7-menu-card{--tone:#007aff;min-height:150px;position:relative;overflow:hidden;text-align:left;border:1px solid var(--v-line);border-radius:21px;background:var(--v-panel);color:inherit;padding:18px;transition:.2s}.v7-menu-card:hover{transform:translateY(-3px)}.v7-menu-card:after{content:"";position:absolute;width:160px;height:160px;right:-80px;top:-80px;border-radius:50%;background:var(--tone);opacity:.07}.v7-menu-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone)}.v7-menu-card b{display:block;font-size:13px;margin-top:18px;position:relative}.v7-menu-card span{display:block;font-size:9px;color:var(--v-muted);margin-top:4px;position:relative}.v7-menu-badge{position:absolute;right:12px;bottom:12px;color:var(--accent);font-size:8px;font-style:normal;font-weight:750}
    .v7-dna-modal{max-width:540px}.v7-dna-modal h2{font-size:30px;letter-spacing:-.05em}.v7-form select,.v7-form input{border-radius:13px;background:var(--v-panel2);color:var(--v-text);border:1px solid var(--v-line)}
    @media(max-width:900px){.student-v7{padding:22px 24px 100px}.v7-quick{grid-template-columns:repeat(2,1fr)}.v7-subjects{grid-template-columns:1fr}.v7-menu-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:700px){.student-v7{padding:10px 16px 104px}.v7-top{height:48px;padding-bottom:12px}.v7-logo{width:34px;height:34px;border-radius:10px}.v7-brand-name{font-size:18px}.v7-round{width:35px;height:35px}.v7-welcome{padding:40px 0 20px}.v7-welcome small{font-size:9px}.v7-welcome h1{font-size:38px;margin:9px 0 8px}.v7-welcome p{font-size:14px}.v7-course{border-radius:16px}.v7-hero{min-height:0;border-radius:25px;padding:23px 20px}.v7-hero-top{gap:14px}.v7-hero h2{font-size:29px}.v7-hero p{font-size:12px}.v7-ring{width:68px;height:68px}.v7-ring:before{inset:7px}.v7-ring b{font-size:11px}.v7-hero-meta{gap:5px;margin-top:20px}.v7-chip{font-size:8px;padding:7px 8px}.v7-section{margin-top:39px}.v7-head h2{font-size:22px}.v7-quick{gap:9px}.v7-quick-card{min-height:120px;border-radius:18px;padding:14px}.v7-quick-icon{width:39px;height:39px;border-radius:12px}.v7-quick-card b{font-size:12px;margin-top:13px}.v7-quick-card span:not(.v7-arrow){font-size:9px}.v7-continue{padding:13px;border-radius:18px}.v7-copy b{font-size:12px}.v7-start{font-size:9px}.v7-progress{grid-template-columns:1fr 72px;padding:14px;border-radius:18px}.v7-progress-ring{width:68px;height:68px}.v7-progress-main b{font-size:12px}.v7-progress-main p{font-size:9px}.v7-plan-row{grid-template-columns:37px 36px 1fr auto;gap:8px;padding:11px;border-radius:16px}.v7-time{display:none}.v7-plan-icon{width:36px;height:36px}.v7-plan-copy b{font-size:10px}.v7-plan-copy span{font-size:8px}.v7-plan-row button{font-size:8px;padding:7px 9px}.v7-subject{padding:14px;border-radius:16px}.v7-signal{padding:13px;border-radius:17px}.v7-signal-copy b{font-size:11px}.v7-signal-copy p{font-size:8px}.v7-streak{padding:13px;border-radius:17px}.v7-week{gap:5px}.v7-day{padding:8px 2px}.v7-recovery{padding:13px;border-radius:17px}.v7-explore-inner{padding:25px 16px 50px}.v7-explore-top h2{font-size:36px}.v7-menu-grid{grid-template-columns:1fr 1fr}.v7-menu-card{min-height:125px}.v7-menu-icon{width:40px;height:40px}}
    @media(prefers-reduced-motion:reduce){.student-v7 *{transition:none!important;animation:none!important}}
  `;

  return (
    <>
      <style>{css}</style>

      <div className="student-v7">
        <header className="v7-top">
          <div className="v7-brand">
            <div className="v7-logo">N</div>
            <div className="v7-brand-name">neet<span>prep</span></div>
          </div>

          <div className="v7-actions">
            <button
              className="v7-round"
              onClick={() => setExploreOpen(true)}
              aria-label="Open Study Centre"
            >
              <Icon name="grid" size={18} />
            </button>
            <button
              className="v7-round"
              onClick={props.onAnnouncements}
              aria-label="Announcements"
            >
              <Icon name="bell" size={18} />
              {props.announcementsCount > 0 && <i className="v7-dot" />}
            </button>
            <button
              className="v7-round v7-avatar"
              onClick={() => setDnaOpen(true)}
              aria-label="Open profile settings"
            >
              {first.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <section className="v7-welcome">
          <small>NEET UG 2027 · {dna.stage.toUpperCase()}</small>
          <h1>{greeting}, <span className="gold">{first}</span> 👋</h1>
          <p>Let's make today's preparation count, one focused session at a time.</p>
        </section>

        <button className="v7-course" onClick={() => setDnaOpen(true)}>
          <div className="v7-course-icon"><Icon name="book" size={18} /></div>
          <div className="v7-course-copy">
            <small>MY PREPARATION</small>
            <b>NEET UG 2027 · {dna.stage}</b>
          </div>
          <span className="v7-edit">EDIT</span>
        </button>

        <section className="v7-hero">
          <div className="v7-hero-content">
            <div className="v7-hero-top">
              <div>
                <span className="v7-kicker">TODAY'S DPP</span>
                <h2>{remaining ? `${remaining} questions to go` : 'Daily target complete 🎉'}</h2>
                <p>
                  {remaining
                    ? 'A small focused block. Finish it and keep your streak moving.'
                    : 'Nice work. Use the next session to revise mistakes or saved questions.'}
                </p>
              </div>

              <div
                className="v7-ring"
                style={{ '--v7p': `${dailyPct}%` } as CSSProperties}
                aria-label={`${dailyPct}% daily goal`}
              >
                <b>{dailyPct}%</b>
              </div>
            </div>

            <div className="v7-hero-meta">
              <span className="v7-chip"><strong>{props.today}</strong> done</span>
              <span className="v7-chip"><strong>{props.dailyGoal}</strong> daily goal</span>
              <span className="v7-chip"><strong>{props.streakDays}</strong> day streak</span>
            </div>

            <button className="v7-hero-btn" onClick={startSmart}>
              {remaining ? "Start today's DPP" : 'Start revision'}
              <Icon name="arrow" size={14} />
            </button>
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">QUICK START</span>
              <h2>Jump back in</h2>
            </div>
            <button className="v7-link" onClick={() => setExploreOpen(true)}>See all</button>
          </div>

          <div className="v7-quick">
            {quick.map(item => (
              <button
                key={item.title}
                className="v7-quick-card"
                style={{ '--tone': item.tone } as CSSProperties}
                onClick={item.action}
              >
                <div className="v7-quick-icon">
                  <Icon name={item.icon} size={19} />
                </div>
                <b>{item.title}</b>
                <span>{item.sub}</span>
                <span className="v7-arrow">›</span>
              </button>
            ))}
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">CONTINUE LEARNING</span>
              <h2>Pick up where you left off</h2>
            </div>
          </div>

          <div className="v7-continue">
            <div className="v7-play"><Icon name="play" size={19} /></div>
            <div className="v7-copy">
              <small>{intelligence.subject ? 'RECOMMENDED PRACTICE' : 'START YOUR PREP'}</small>
              <b>{intelligence.subject ? `${intelligence.subject} practice` : 'Daily question practice'}</b>
              <span>
                {props.mistakes.length
                  ? `${Math.min(5, props.mistakes.length)} mistakes are waiting for another look`
                  : 'Build your first performance signal'}
              </span>
            </div>
            <button className="v7-start" onClick={startSmart}>START</button>
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">TODAY</span>
              <h2>Your progress</h2>
            </div>
            <button className="v7-link" onClick={openProgress}>Full report</button>
          </div>

          <div className="v7-progress">
            <div className="v7-progress-main">
              <b>{props.today} of {props.dailyGoal} questions complete</b>
              <p>{dailyPct >= 100 ? 'Daily goal completed. Keep the momentum going.' : `${remaining} questions left in today's target.`}</p>
              <div className="v7-bigbar"><i style={{ width: `${dailyPct}%` }} /></div>
              <div className="v7-progress-stats">
                <span>{dailyPct}% complete</span>
                <span>{props.totalAnswered} total answered</span>
              </div>
            </div>

            <div
              className="v7-progress-ring"
              style={{ '--v7p': `${dailyPct}%`, position: 'relative' } as CSSProperties}
            >
              <b>{dailyPct}%</b>
            </div>
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">TODAY'S PLAN</span>
              <h2>Three things to do</h2>
            </div>
            <button className="v7-link" onClick={() => setExploreOpen(true)}>View all</button>
          </div>

          <div className="v7-plan">
            <div className="v7-plan-row">
              <span className="v7-time">NOW</span>
              <div className="v7-plan-icon"><Icon name="practice" size={16} /></div>
              <div className="v7-plan-copy">
                <b>{intelligence.subject ? `${intelligence.subject} practice` : 'Daily question practice'}</b>
                <span>10 questions · focused session</span>
              </div>
              <button onClick={startSmart}>Start</button>
            </div>

            <div className="v7-plan-row">
              <span className="v7-time">LATER</span>
              <div className="v7-plan-icon"><Icon name="book" size={16} /></div>
              <div className="v7-plan-copy">
                <b>Revision block</b>
                <span>{recovery.marks > 0 ? `Mistakes · +${recovery.marks} marks in play` : 'Saved concepts'}</span>
              </div>
              <button onClick={props.mistakes.length ? openMistakes : openSaved}>Open</button>
            </div>

            <div className="v7-plan-row">
              <span className="v7-time">TEST</span>
              <div className="v7-plan-icon"><Icon name="test" size={16} /></div>
              <div className="v7-plan-copy">
                <b>Test Centre</b>
                <span>Chapter, part and full mock tests</span>
              </div>
              <button onClick={openTests}>View</button>
            </div>
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">SUBJECTS</span>
              <h2>Your preparation</h2>
            </div>
            <button className="v7-link" onClick={openProgress}>Report</button>
          </div>

          <div className="v7-subjects">
            {ranked.length ? ranked.map(item => (
              <button
                className="v7-subject"
                key={item.subject}
                onClick={() => props.onPractice(
                  10,
                  `${item.subject} practice`,
                  props.subjectQuestionIds[item.subject],
                )}
              >
                <div className="v7-subject-top">
                  <b>{item.subject}</b>
                  <span>{item.accuracy}% · {item.attempted} attempted</span>
                </div>
                <div className="v7-track">
                  <i style={{ width: `${item.accuracy}%` }} />
                </div>
              </button>
            )) : (
              <div className="v7-subject">
                <div className="v7-subject-top">
                  <b>Start practicing to unlock your subject report</b>
                  <span>10 questions</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-head">
            <div>
              <span className="v7-label">COACHING SIGNAL</span>
              <h2>What should you do next?</h2>
            </div>
          </div>

          <div className="v7-signal">
            <div className="v7-signal-icon"><Icon name="spark" size={19} /></div>
            <div className="v7-signal-copy">
              <small>{intelligence.priority} PRIORITY</small>
              <b>{intelligence.headline}</b>
              <p>{intelligence.detail}</p>
            </div>
            <button onClick={startSmart} aria-label="Start recommended session">
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-streak">
            <div className="v7-streak-flame"><Icon name="flame" size={20} /></div>
            <div className="v7-streak-copy">
              <b>{props.streakDays ? `${props.streakDays} day streak` : 'Start your study streak'}</b>
              <span>Small daily sessions add up.</span>
            </div>
            <span className="v7-xp">{xp} XP · LV {level}</span>
          </div>

          <div className="v7-week">
            {week.map(item => (
              <div
                key={`${item.label}-${item.today}`}
                className={`v7-day ${item.count ? 'active' : ''} ${item.today ? 'today' : ''}`}
              >
                <span>{item.label}</span>
                <i>{item.count || '·'}</i>
              </div>
            ))}
          </div>
        </section>

        <section className="v7-section">
          <div className="v7-recovery">
            <div className="v7-recovery-icon"><Icon name="target" size={18} /></div>
            <div className="v7-recovery-copy">
              <small>MISTAKE BOOK</small>
              <b>
                {props.mistakes.length
                  ? `${props.mistakes.length} questions waiting for review`
                  : 'Your improvement book is ready'}
              </b>
            </div>
            <div className="v7-score">
              <b>+{recovery.marks}</b>
              <span>marks in play</span>
            </div>
          </div>
        </section>
      </div>

      {exploreOpen && (
        <div className="v7-explore" role="dialog" aria-modal="true">
          <div className="v7-explore-inner">
            <div className="v7-explore-top">
              <div>
                <span className="v7-label">NEETPREP APPS</span>
                <h2>Study Centre</h2>
                <p>
                  Your full preparation toolkit, kept off the home screen so the home screen
                  can stay useful instead of becoming a control panel from NASA.
                </p>
              </div>

              <button
                className="v7-explore-close"
                onClick={() => setExploreOpen(false)}
                aria-label="Close Study Centre"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="v7-app-section">LEARN</div>
            <div className="v7-menu-grid">
              {menu.slice(0, 1).map(item => (
                <button
                  key={item.title}
                  className="v7-menu-card"
                  style={{ '--tone': TONES[item.tone] } as CSSProperties}
                  onClick={item.action}
                >
                  <div className="v7-menu-icon"><Icon name={item.icon} size={19} /></div>
                  <b>{item.title}</b>
                  <span>{item.sub}</span>
                  {item.badge && <em className="v7-menu-badge">{item.badge}</em>}
                </button>
              ))}
            </div>

            <div className="v7-app-section">PRACTICE & TESTS</div>
            <div className="v7-menu-grid">
              {menu.slice(1, 5).map(item => (
                <button
                  key={item.title}
                  className="v7-menu-card"
                  style={{ '--tone': TONES[item.tone] } as CSSProperties}
                  onClick={item.action}
                >
                  <div className="v7-menu-icon"><Icon name={item.icon} size={19} /></div>
                  <b>{item.title}</b>
                  <span>{item.sub}</span>
                  {item.badge && <em className="v7-menu-badge">{item.badge}</em>}
                </button>
              ))}
            </div>

            <div className="v7-app-section">REVISION</div>
            <div className="v7-menu-grid">
              {menu.slice(5, 10).map(item => (
                <button
                  key={item.title}
                  className="v7-menu-card"
                  style={{ '--tone': TONES[item.tone] } as CSSProperties}
                  onClick={item.action}
                >
                  <div className="v7-menu-icon"><Icon name={item.icon} size={19} /></div>
                  <b>{item.title}</b>
                  <span>{item.sub}</span>
                  {item.badge && <em className="v7-menu-badge">{item.badge}</em>}
                </button>
              ))}
            </div>

            <div className="v7-app-section">TRACK & IMPROVE</div>
            <div className="v7-menu-grid">
              {menu.slice(10).map(item => (
                <button
                  key={item.title}
                  className="v7-menu-card"
                  style={{ '--tone': TONES[item.tone] } as CSSProperties}
                  onClick={item.action}
                >
                  <div className="v7-menu-icon"><Icon name={item.icon} size={19} /></div>
                  <b>{item.title}</b>
                  <span>{item.sub}</span>
                  {item.badge && <em className="v7-menu-badge">{item.badge}</em>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {dnaOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDnaOpen(false)}>
          <div className="modal v7-dna-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setDnaOpen(false)}>×</button>
            <span className="section-kicker">MY PREPARATION</span>
            <h2>Shape your study setup.</h2>
            <p>This keeps the coaching experience relevant to your stage and routine.</p>

            <div className="v7-form">
              <label>
                Stage
                <select
                  value={dna.stage}
                  onChange={e => setDna(prev => ({
                    ...prev,
                    stage: e.target.value as PrepDNA['stage'],
                  }))}
                >
                  <option>Class 11</option>
                  <option>Class 12</option>
                  <option>Dropper</option>
                </select>
              </label>

              <label>
                Coaching
                <select
                  value={dna.coaching}
                  onChange={e => setDna(prev => ({
                    ...prev,
                    coaching: e.target.value as PrepDNA['coaching'],
                  }))}
                >
                  <option>Offline coaching</option>
                  <option>Online coaching</option>
                  <option>Hybrid</option>
                  <option>Self study</option>
                </select>
              </label>

              <label>
                Daily study hours
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={dna.hours}
                  onChange={e => setDna(prev => ({
                    ...prev,
                    hours: Math.max(1, Math.min(16, Number(e.target.value) || 1)),
                  }))}
                />
              </label>

              <label>
                Best focus window
                <select
                  value={dna.focus}
                  onChange={e => setDna(prev => ({
                    ...prev,
                    focus: e.target.value as PrepDNA['focus'],
                  }))}
                >
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                  <option>Night</option>
                </select>
              </label>

              <div className="v7-form-actions">
                <button className="alt" onClick={() => setDnaOpen(false)}>Cancel</button>
                <button className="main" onClick={saveDNA}>Save setup</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
