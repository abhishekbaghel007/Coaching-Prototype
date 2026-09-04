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
    .student-v7{--bg:#070c0f;--surface:#10171b;--surface2:#141d22;--line:rgba(255,255,255,.075);--line-strong:rgba(255,255,255,.12);--text:#f5f7f7;--muted:#8d999f;--gold:#edb84f;--mint:#58d3c1;--violet:#8a63e9;max-width:1120px;margin:0 auto;padding:8px 24px 72px;color:var(--text);font-family:'DM Sans',system-ui,sans-serif;box-sizing:border-box}.student-v7 *{box-sizing:border-box}.student-v7 button{font:inherit}.v7-top{height:58px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.045);margin-bottom:42px}.v7-brand{display:flex;align-items:center;gap:9px}.v7-logo{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#f5ce72,#d99c34);color:#17130a;font:950 15px Manrope;box-shadow:0 8px 22px rgba(237,184,79,.12)}.v7-brand-name{font:800 18px Manrope;letter-spacing:-.7px}.v7-brand-name span{color:var(--gold)}.v7-actions{display:flex;align-items:center;gap:7px}.v7-round{position:relative;width:36px;height:36px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.035);color:#b8c0c4;display:grid;place-items:center;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.v7-round:hover{transform:translateY(-1px);border-color:var(--line-strong);background:rgba(255,255,255,.06);color:#fff}.v7-avatar{background:linear-gradient(145deg,#253036,#182126);color:#e8edf0;font:800 11px Manrope}.v7-dot{position:absolute;right:5px;top:5px;width:6px;height:6px;border-radius:50%;background:#ef8d7f;box-shadow:0 0 0 2px #10171b}.v7-welcome{margin-bottom:17px}.v7-welcome small{color:#718188;font-size:8px;letter-spacing:1.6px;font-weight:950}.v7-welcome h1{font:800 42px/1.02 Manrope;letter-spacing:-2px;margin:9px 0 8px}.v7-welcome h1 .gold{color:var(--gold)}.v7-welcome p{margin:0;color:#89969c;font-size:11px;line-height:1.55}.v7-course{width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;margin-bottom:20px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.022);color:var(--text);text-align:left;cursor:pointer;transition:.18s ease}.v7-course:hover{background:rgba(255,255,255,.045);border-color:var(--line-strong)}.v7-course-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(237,184,79,.09);color:var(--gold)}.v7-course-copy{min-width:0;flex:1}.v7-course-copy small{display:block;color:#69777e;font-size:7px;letter-spacing:1.2px;font-weight:950}.v7-course-copy b{display:block;margin-top:3px;font-size:10px}.v7-edit{font-size:7px;font-weight:950;letter-spacing:1px;color:#8c999f}.v7-hero{position:relative;overflow:hidden;border:1px solid rgba(87,211,193,.16);border-radius:24px;padding:24px;background:linear-gradient(135deg,rgba(24,54,58,.96),rgba(19,28,36,.98) 52%,rgba(27,24,43,.98));box-shadow:0 22px 55px rgba(0,0,0,.22);margin-bottom:46px}.v7-hero:before{content:"";position:absolute;width:320px;height:320px;border-radius:50%;right:-150px;top:-190px;background:rgba(87,211,193,.12);filter:blur(3px)}.v7-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 58%,rgba(255,255,255,.025) 58% 58.3%,transparent 58.3%);pointer-events:none}.v7-hero-content{position:relative;z-index:1}.v7-hero-top{display:flex;align-items:center;justify-content:space-between;gap:25px}.v7-kicker,.v7-label{display:block;color:#77a9a7;font-size:7px;letter-spacing:1.55px;font-weight:950}.v7-hero h2{font:800 28px/1.03 Manrope;letter-spacing:-1.15px;margin:8px 0 7px;max-width:650px}.v7-hero p{color:#9cafb1;font-size:10px;line-height:1.55;max-width:560px;margin:0}.v7-ring{--v7p:0%;width:82px;height:82px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;background:conic-gradient(var(--mint) var(--v7p),rgba(255,255,255,.09) 0);position:relative;box-shadow:0 0 0 1px rgba(255,255,255,.05),0 12px 30px rgba(0,0,0,.18)}.v7-ring:before{content:"";position:absolute;width:62px;height:62px;border-radius:50%;background:#18282c;border:1px solid rgba(255,255,255,.055)}.v7-ring b{position:relative;font:800 13px Manrope}.v7-hero-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:19px}.v7-chip{padding:7px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.13);color:#91a1a5;font-size:8px}.v7-chip strong{color:#e9eeee;font-weight:850}.v7-hero-btn{display:inline-flex;align-items:center;gap:8px;margin-top:17px;border:0;border-radius:11px;padding:10px 13px;background:#f0c15e;color:#17130a;font-size:9px;font-weight:950;cursor:pointer;box-shadow:0 10px 24px rgba(237,184,79,.12);transition:.18s ease}.v7-hero-btn:hover{transform:translateY(-1px);background:#f5c967}.v7-section{margin-top:0;margin-bottom:45px}.v7-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:14px}.v7-head h2{font:800 21px/1.05 Manrope;letter-spacing:-.75px;margin:5px 0 0}.v7-link{border:0;background:none;color:var(--gold);font-size:8px;font-weight:950;padding:3px 0;cursor:pointer}.v7-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.v7-quick-card{--tone:#8a63e9;position:relative;overflow:hidden;min-height:136px;border:1px solid var(--line);border-radius:19px;padding:15px;text-align:left;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.018));color:#fff;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.v7-quick-card:before{content:"";position:absolute;width:105px;height:105px;border-radius:50%;right:-50px;top:-54px;background:var(--tone);opacity:.13}.v7-quick-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.05)}.v7-quick-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--tone) 22%,#101619);color:#fff;box-shadow:0 10px 25px color-mix(in srgb,var(--tone) 12%,transparent);position:relative}.v7-quick-card b{display:block;font-size:12px;margin-top:16px;position:relative}.v7-quick-card span:not(.v7-arrow){display:block;color:#7f8d93;font-size:8px;margin-top:4px;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-arrow{position:absolute;right:13px;top:13px;color:#77858a;font-size:16px;line-height:1}.v7-continue{display:flex;align-items:center;gap:13px;padding:14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.024)}.v7-play{width:43px;height:43px;border-radius:14px;display:grid;place-items:center;background:#202b2f;color:var(--gold);flex:0 0 auto}.v7-copy{min-width:0;flex:1}.v7-copy small{display:block;color:#77868c;font-size:7px;letter-spacing:1.2px;font-weight:950}.v7-copy b{display:block;font-size:11px;margin-top:4px}.v7-copy span{display:block;color:#849198;font-size:8px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-start{border:0;border-radius:10px;padding:9px 12px;background:rgba(237,184,79,.12);color:#efbd58;font-size:8px;font-weight:950;cursor:pointer}.v7-progress{display:grid;grid-template-columns:minmax(0,1fr) 88px;gap:22px;padding:17px 18px;border:1px solid var(--line);border-radius:19px;background:rgba(255,255,255,.024)}.v7-progress-main{min-width:0}.v7-progress-main b{font-size:12px}.v7-progress-main p{font-size:8px;color:#859299;margin:5px 0 13px}.v7-bigbar{height:8px;border-radius:999px;background:#202a2e;overflow:hidden}.v7-bigbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#e8b34f,#59d3c1);box-shadow:0 0 14px rgba(89,211,193,.12)}.v7-progress-stats{display:flex;justify-content:space-between;margin-top:7px;color:#738188;font-size:7px}.v7-progress-ring{width:80px;height:80px;border-radius:50%;display:grid;place-items:center;justify-self:end;background:conic-gradient(var(--mint) var(--v7p),#263136 0);position:relative}.v7-progress-ring:before{content:"";position:absolute;width:61px;height:61px;border-radius:50%;background:#11191d}.v7-progress-ring b{position:relative;font-size:12px}.v7-plan{display:grid;gap:7px}.v7-plan-row{display:grid;grid-template-columns:48px 40px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.022);transition:.18s ease}.v7-plan-row:hover{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.04)}.v7-time{font-size:7px;color:#718087;font-weight:950;letter-spacing:.7px}.v7-plan-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#1c272b;color:var(--gold)}.v7-plan-copy{min-width:0}.v7-plan-copy b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-plan-copy span{display:block;color:#7f8c92;font-size:7px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-plan-row button{border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:7px 10px;background:rgba(255,255,255,.045);color:#e5eaec;font-size:7px;font-weight:950;cursor:pointer}.v7-subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.v7-subject{width:100%;text-align:left;color:var(--text);padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.022);cursor:pointer;transition:.18s ease}.v7-subject:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.12)}.v7-subject-top{display:flex;justify-content:space-between;gap:10px}.v7-subject-top b{font-size:10px}.v7-subject-top span{font-size:7px;color:#7d8b91}.v7-track{height:6px;border-radius:999px;background:#20292d;margin-top:10px;overflow:hidden}.v7-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#eab34e,#57d1bf)}.v7-subject:nth-child(1) .v7-track i{background:linear-gradient(90deg,#438fe8,#65a8ee)}.v7-subject:nth-child(2) .v7-track i{background:linear-gradient(90deg,#eab34e,#57d1bf)}.v7-subject:nth-child(3) .v7-track i{background:linear-gradient(90deg,#45c9b5,#70d7a8)}.v7-signal{display:flex;align-items:center;gap:13px;padding:15px;border-radius:19px;background:linear-gradient(135deg,rgba(138,99,233,.13),rgba(255,255,255,.022));border:1px solid rgba(138,99,233,.18)}.v7-signal-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#8d67eb,#6248c5);color:#fff;flex:0 0 auto;box-shadow:0 10px 24px rgba(106,73,200,.16)}.v7-signal-copy{flex:1;min-width:0}.v7-signal-copy small{color:#a995eb;font-size:7px;letter-spacing:1.2px;font-weight:950}.v7-signal-copy b{display:block;font-size:11px;margin-top:4px}.v7-signal-copy p{font-size:8px;line-height:1.45;color:#8c979d;margin:4px 0 0}.v7-signal button{width:33px;height:33px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.07);color:#fff;flex:0 0 auto;cursor:pointer}.v7-streak{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:18px;background:linear-gradient(135deg,rgba(237,128,111,.10),rgba(255,255,255,.022));border:1px solid rgba(255,135,93,.12)}.v7-streak-flame{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#f0b247,#df7152);color:#fff;flex:0 0 auto}.v7-streak-copy{flex:1;min-width:0}.v7-streak-copy b{display:block;font-size:11px}.v7-streak-copy span{display:block;font-size:7px;color:#849096;margin-top:3px}.v7-xp{font-size:8px;color:#e8b24f;font-weight:950;white-space:nowrap}.v7-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:8px}.v7-day{padding:7px 4px;border-radius:12px;text-align:center;background:rgba(255,255,255,.022);border:1px solid rgba(255,255,255,.05)}.v7-day span{display:block;font-size:7px;color:#728087;font-weight:900}.v7-day i{display:block;font-size:10px;font-style:normal;font-weight:950;margin-top:4px;color:#55636a}.v7-day.active i{color:#e9b44f}.v7-day.today{border-color:rgba(233,180,79,.3);background:rgba(233,180,79,.045)}.v7-recovery{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:18px;background:linear-gradient(135deg,rgba(255,112,103,.09),rgba(255,255,255,.022));border:1px solid rgba(255,112,103,.12)}.v7-recovery-icon{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;background:rgba(255,111,102,.12);color:#ff8b82;flex:0 0 auto}.v7-recovery-copy{flex:1;min-width:0}.v7-recovery-copy small{font-size:7px;letter-spacing:1.1px;color:#a48c91;font-weight:900}.v7-recovery-copy b{display:block;font-size:10px;margin-top:4px}.v7-score{text-align:right;white-space:nowrap}.v7-score b{font-size:19px;color:#ff9a8f}.v7-score span{display:block;font-size:6px;color:#8f979b}.v7-explore{position:fixed;inset:0;z-index:140;background:rgba(3,7,9,.82);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);overflow:auto}.v7-explore-inner{width:min(1050px,100%);margin:0 auto;padding:28px 24px 55px}.v7-explore-top{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:22px}.v7-explore-top h2{font:800 32px/1 Manrope;letter-spacing:-1.3px;margin:5px 0 7px}.v7-explore-top p{max-width:620px;font-size:9px;line-height:1.6;color:#89959b;margin:0}.v7-explore-close{width:40px;height:40px;border-radius:13px;border:1px solid rgba(255,255,255,.09);background:#151d21;color:#fff;display:grid;place-items:center;cursor:pointer}.v7-app-section{margin:21px 0 9px;color:#7e8b91;font-size:7px;letter-spacing:1.35px;font-weight:950}.v7-menu-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.v7-menu-card{--tone:#7c5ce6;position:relative;overflow:hidden;text-align:left;min-height:125px;border-radius:17px;border:1px solid var(--line);background:rgba(255,255,255,.032);color:#fff;padding:14px;cursor:pointer;transition:.18s ease}.v7-menu-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.13)}.v7-menu-card:after{content:"";position:absolute;width:100px;height:100px;border-radius:50%;right:-38px;top:-38px;background:var(--tone);opacity:.11}.v7-menu-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,var(--tone),color-mix(in srgb,var(--tone) 35%,#101416));box-shadow:0 8px 18px color-mix(in srgb,var(--tone) 15%,transparent)}.v7-menu-card b{display:block;font-size:10px;margin-top:11px;position:relative;z-index:1}.v7-menu-card span{display:block;font-size:7px;color:#89959a;margin-top:3px;position:relative;z-index:1}.v7-menu-badge{position:absolute;right:8px;bottom:8px;padding:3px 6px;border-radius:6px;background:rgba(232,179,78,.1);color:#e8b34e;font-size:6px;font-style:normal;font-weight:950}.v7-dna-modal{max-width:520px}.v7-dna-modal h2{font:800 24px/1.05 Manrope;letter-spacing:-.8px;margin:5px 0}.v7-dna-modal p{font-size:10px;line-height:1.5;color:#929da2}.v7-form{display:grid;gap:10px;margin-top:15px}.v7-form label{font-size:8px;color:#929da2;font-weight:900}.v7-form select,.v7-form input{width:100%;box-sizing:border-box;margin-top:5px;padding:11px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:#141a1e;color:#fff}.v7-form-actions{display:flex;gap:8px;margin-top:5px}.v7-form-actions button{flex:1;border:0;border-radius:11px;padding:11px;font-size:8px;font-weight:900}.v7-form-actions .main{background:#e9b44f;color:#17120a}.v7-form-actions .alt{background:rgba(255,255,255,.07);color:#fff}@media(max-width:860px){.student-v7{padding-left:18px;padding-right:18px}.v7-quick{grid-template-columns:repeat(2,minmax(0,1fr))}.v7-subjects{grid-template-columns:1fr}.v7-menu-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.student-v7{padding:3px 13px 48px}.v7-top{margin-bottom:32px}.v7-welcome h1{font-size:30px;letter-spacing:-1.35px}.v7-welcome p{font-size:10px}.v7-course{margin-bottom:15px}.v7-hero{padding:19px 16px;border-radius:21px;margin-bottom:36px}.v7-hero-top{align-items:flex-start;gap:13px}.v7-hero h2{font-size:22px}.v7-hero p{font-size:9px}.v7-ring{width:66px;height:66px}.v7-ring:before{width:49px;height:49px}.v7-ring b{font-size:11px}.v7-hero-meta{gap:5px}.v7-chip{font-size:7px;padding:6px 7px}.v7-section{margin-bottom:34px}.v7-head h2{font-size:19px}.v7-quick{gap:8px}.v7-quick-card{min-height:122px;padding:13px}.v7-quick-icon{width:38px;height:38px;border-radius:12px}.v7-quick-card b{font-size:10px;margin-top:13px}.v7-quick-card span:not(.v7-arrow){font-size:7px}.v7-progress{grid-template-columns:minmax(0,1fr) 72px;gap:10px;padding:13px}.v7-progress-ring{width:68px;height:68px}.v7-progress-ring:before{width:51px;height:51px}.v7-plan-row{grid-template-columns:37px 37px minmax(0,1fr) auto;gap:8px}.v7-time{display:none}.v7-plan-icon{width:37px;height:37px}.v7-plan-copy b{font-size:9px}.v7-plan-copy span{font-size:7px}.v7-plan-row button{padding:7px 8px}.v7-signal{padding:13px;gap:10px}.v7-signal-copy b{white-space:normal}.v7-streak{align-items:flex-start}.v7-xp{font-size:7px}.v7-week{gap:4px}.v7-day{padding:7px 3px}.v7-score b{font-size:17px}.v7-menu-grid{grid-template-columns:1fr 1fr}.v7-menu-card{min-height:112px}.v7-explore-inner{padding:20px 14px 45px}.v7-explore-top h2{font-size:27px}.v7-explore-top p{font-size:8px}}@media(prefers-reduced-motion:reduce){.student-v7 *{transition:none!important;animation:none!important}}
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
