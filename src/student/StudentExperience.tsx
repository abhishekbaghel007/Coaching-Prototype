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
  onAppearance: () => void;
  onAccount: () => void;
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
      --v-bg: var(--np-bg, #080d10);
      --v-panel: var(--np-surface, #10171b);
      --v-panel2: var(--np-surface-2, #151e23);
      --v-text: var(--np-text, #f5f7f7);
      --v-muted: var(--np-muted, #8c999f);
      --v-line: var(--np-border, rgba(255,255,255,.075));
      width:100%; max-width:1040px; margin:0 auto; padding:4px 0 60px; color:var(--v-text);
    }
    .v7-top{display:flex;align-items:center;justify-content:space-between;padding:0 2px 14px}
    .v7-brand{display:flex;align-items:center;gap:11px}
    .v7-logo{width:43px;height:43px;border-radius:14px;display:grid;place-items:center;color:#17130a;font-size:20px;font-weight:950;background:linear-gradient(145deg,#f6cf73,#df9f35);box-shadow:0 10px 28px rgba(233,180,79,.17)}
    .v7-brand-name{font:800 20px Manrope;letter-spacing:-.8px}.v7-brand-name span{color:#e9b44f}
    .v7-actions{display:flex;gap:8px}.v7-round{position:relative;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;color:var(--v-text);border:1px solid var(--v-line);background:rgba(255,255,255,.035);transition:.18s ease}.v7-round:hover{transform:translateY(-1px);background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)}
    .v7-dot{position:absolute;right:6px;top:5px;width:7px;height:7px;border-radius:50%;background:#ef776f;border:2px solid #141a1d}
    .v7-avatar{font-size:13px;font-weight:950;background:linear-gradient(145deg,#222c31,#151b1f)}

    .v7-welcome{padding:17px 2px 14px}.v7-welcome small{color:#809097;font-size:9px;letter-spacing:1.5px;font-weight:900}.v7-welcome h1{margin:7px 0 7px;font:800 clamp(31px,4vw,39px)/1.03 Manrope;letter-spacing:-1.8px}.v7-welcome h1 .gold{color:#e9b44f}.v7-welcome p{margin:0;color:var(--v-muted);font-size:12px;line-height:1.5}
    .v7-course{width:100%;display:flex;align-items:center;gap:12px;padding:11px 13px;margin-bottom:14px;border:1px solid var(--v-line);border-radius:17px;background:rgba(255,255,255,.028);text-align:left}.v7-course-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#61d7c6;background:rgba(87,209,191,.09)}.v7-course-copy{flex:1;min-width:0}.v7-course-copy small{display:block;color:#76858b;font-size:8px;letter-spacing:1.2px;font-weight:900}.v7-course-copy b{display:block;margin-top:4px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-edit{border:0;background:none;color:#e9b44f;font-size:8px;font-weight:950}

    .v7-hero{position:relative;overflow:hidden;border-radius:26px;padding:24px 24px 22px;background:linear-gradient(135deg,#16373c 0%,#123039 45%,#1b1b2a 100%);border:1px solid rgba(91,213,198,.22);box-shadow:0 22px 60px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.04)}
    .v7-hero:before,.v7-hero:after{content:"";position:absolute;border-radius:50%;pointer-events:none;border:1px solid rgba(117,225,214,.11)}.v7-hero:before{width:350px;height:350px;right:-165px;top:-205px}.v7-hero:after{width:245px;height:245px;right:-105px;top:-150px}.v7-hero-content{position:relative;z-index:2}.v7-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.v7-kicker{color:#6edbcb;font-size:9px;letter-spacing:1.5px;font-weight:950}.v7-hero h2{font:800 clamp(25px,3vw,31px)/1.03 Manrope;letter-spacing:-1.2px;margin:8px 0 7px;max-width:560px}.v7-hero p{margin:0;max-width:540px;color:#b8c8ca;font-size:11px;line-height:1.55}
    .v7-ring{--v7p:0%;width:78px;height:78px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#6fe1c6 var(--v7p),rgba(255,255,255,.11) 0);position:relative;box-shadow:0 10px 30px rgba(0,0,0,.16)}.v7-ring:before{content:"";position:absolute;inset:7px;border-radius:50%;background:#15272b}.v7-ring b{position:relative;font-size:13px}.v7-hero-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}.v7-chip{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.08);color:#dce6e6;font-size:8px;font-weight:900}.v7-chip strong{color:#fff}.v7-hero-btn{margin-top:17px;border:0;border-radius:13px;padding:12px 15px;display:inline-flex;align-items:center;gap:8px;background:#f4f6f4;color:#121719;font-size:10px;font-weight:950;box-shadow:0 10px 25px rgba(0,0,0,.15);transition:.18s ease}.v7-hero-btn:hover{transform:translateY(-1px)}

    .v7-section{margin-top:28px}.v7-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}.v7-label{color:#7e8d94;font-size:8px;letter-spacing:1.55px;font-weight:950}.v7-head h2{font:800 clamp(20px,2.3vw,23px)/1.06 Manrope;letter-spacing:-.9px;margin:4px 0 0}.v7-link{border:0;background:none;color:#e9b44f;font-size:9px;font-weight:950;padding:3px 0}

    .v7-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.v7-quick-card{--tone:#7c5ce6;position:relative;overflow:hidden;min-width:0;min-height:132px;text-align:left;border:1px solid var(--v-line);border-radius:19px;padding:15px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.018));color:var(--v-text);display:grid;grid-template-columns:46px minmax(0,1fr) 16px;grid-template-rows:auto 1fr auto;column-gap:10px;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.v7-quick-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.045)}.v7-quick-card:before{content:"";position:absolute;width:155px;height:155px;border-radius:50%;right:-82px;top:-82px;background:var(--tone);opacity:.105}.v7-quick-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,var(--tone),color-mix(in srgb,var(--tone) 42%,#101416));box-shadow:0 10px 26px color-mix(in srgb,var(--tone) 19%,transparent);grid-row:1/4;position:relative;z-index:1}.v7-quick-card b{align-self:center;font-size:13px;line-height:1.15;min-width:0;overflow-wrap:anywhere;position:relative;z-index:1}.v7-quick-card span:not(.v7-arrow){align-self:end;color:#89969c;font-size:9px;line-height:1.35;min-width:0;overflow-wrap:anywhere;position:relative;z-index:1}.v7-arrow{align-self:center;color:#89959a;font-size:22px;grid-row:1/4;position:relative;z-index:1}

    .v7-continue{display:flex;align-items:center;gap:13px;padding:14px;border-radius:19px;background:linear-gradient(135deg,rgba(139,103,232,.13),rgba(255,255,255,.025));border:1px solid rgba(139,103,232,.17)}.v7-play{width:47px;height:47px;border-radius:15px;display:grid;place-items:center;flex:0 0 auto;color:#fff;background:linear-gradient(145deg,#966cf1,#6546d0);box-shadow:0 11px 26px rgba(119,79,224,.2)}.v7-copy{flex:1;min-width:0}.v7-copy small{display:block;color:#a98fee;font-size:8px;letter-spacing:1.05px;font-weight:950}.v7-copy b{display:block;margin-top:3px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-copy span{display:block;margin-top:3px;color:#929da3;font-size:9px;line-height:1.4}.v7-start{border:0;border-radius:11px;padding:9px 12px;background:#e9b44f;color:#17130a;font-size:9px;font-weight:950}

    .v7-progress{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:18px;padding:17px;border:1px solid var(--v-line);border-radius:20px;background:rgba(255,255,255,.025)}.v7-progress-main{min-width:0}.v7-progress-main b{font-size:13px}.v7-progress-main p{font-size:9px;color:#8e9aa0;margin:5px 0 13px}.v7-bigbar{height:9px;border-radius:999px;background:#202a2f;overflow:hidden}.v7-bigbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#e8b34f,#59d2c1)}.v7-progress-stats{display:flex;justify-content:space-between;margin-top:7px;color:#7f8b91;font-size:8px}.v7-progress-ring{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;justify-self:end;background:conic-gradient(#5ed6c4 var(--v7p),#273237 0);position:relative}.v7-progress-ring:before{content:"";position:absolute;width:65px;height:65px;border-radius:50%;background:#11181c}.v7-progress-ring b{position:relative;font-size:13px}

    .v7-plan{display:grid;gap:8px}.v7-plan-row{display:grid;grid-template-columns:48px 42px minmax(0,1fr) auto;align-items:center;gap:11px;padding:12px;border-radius:17px;border:1px solid var(--v-line);background:rgba(255,255,255,.025)}.v7-time{font-size:8px;color:#7c898f;font-weight:950}.v7-plan-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#1d282d;color:#e9b44f}.v7-plan-copy{min-width:0}.v7-plan-copy b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-plan-copy span{display:block;color:#88949a;font-size:8px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-plan-row button{border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.05);color:#e7ecee;font-size:8px;font-weight:950}

    .v7-subjects{display:grid;gap:8px}.v7-subject{width:100%;text-align:left;color:var(--v-text);padding:13px;border-radius:17px;border:1px solid var(--v-line);background:rgba(255,255,255,.025);cursor:pointer;transition:.18s ease}.v7-subject:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.12)}.v7-subject-top{display:flex;justify-content:space-between;gap:10px}.v7-subject-top b{font-size:11px}.v7-subject-top span{font-size:8px;color:#849096}.v7-track{height:7px;border-radius:999px;background:#222c30;margin-top:9px;overflow:hidden}.v7-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#eab34e,#57d1bf)}

    .v7-signal{display:flex;align-items:center;gap:13px;padding:15px;border-radius:20px;background:linear-gradient(135deg,rgba(139,103,232,.14),rgba(255,255,255,.025));border:1px solid rgba(145,105,239,.18)}.v7-signal-icon{width:47px;height:47px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#9367ef,#5e42c9);color:#fff;flex:0 0 auto}.v7-signal-copy{flex:1;min-width:0}.v7-signal-copy small{color:#aa90ef;font-size:8px;letter-spacing:1px;font-weight:950}.v7-signal-copy b{display:block;font-size:12px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v7-signal-copy p{font-size:9px;line-height:1.45;color:#949da4;margin:4px 0 0}.v7-signal button{width:34px;height:34px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.07);color:#fff;flex:0 0 auto}

    .v7-streak{display:flex;align-items:center;gap:12px;padding:14px;border-radius:20px;background:linear-gradient(135deg,rgba(237,128,111,.12),rgba(255,255,255,.025));border:1px solid rgba(255,135,93,.13)}.v7-streak-flame{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#f1b043,#df6d4f);color:#fff;flex:0 0 auto}.v7-streak-copy{flex:1;min-width:0}.v7-streak-copy b{display:block;font-size:12px}.v7-streak-copy span{display:block;font-size:8px;color:#8e999e;margin-top:3px}.v7-xp{font-size:9px;color:#e8b24f;font-weight:950;white-space:nowrap}.v7-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin-top:9px}.v7-day{padding:8px 4px;border-radius:13px;text-align:center;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05)}.v7-day span{display:block;font-size:8px;color:#77848a;font-weight:900}.v7-day i{display:block;font-size:11px;font-style:normal;font-weight:950;margin-top:5px;color:#59666c}.v7-day.active i{color:#e9b44f}.v7-day.today{border-color:rgba(233,180,79,.32);background:rgba(233,180,79,.05)}

    .v7-recovery{display:flex;align-items:center;gap:12px;padding:14px;border-radius:20px;background:linear-gradient(135deg,rgba(255,112,103,.12),rgba(255,255,255,.025));border:1px solid rgba(255,112,103,.13)}.v7-recovery-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,111,102,.14);color:#ff8b82;flex:0 0 auto}.v7-recovery-copy{flex:1;min-width:0}.v7-recovery-copy small{font-size:8px;letter-spacing:1px;color:#a48c91;font-weight:900}.v7-recovery-copy b{display:block;font-size:11px;margin-top:3px}.v7-score{text-align:right;white-space:nowrap}.v7-score b{font-size:20px;color:#ff9a8f}.v7-score span{display:block;font-size:7px;color:#8f979b}

    .v7-explore{position:fixed;inset:0;z-index:140;background:rgba(4,7,9,.84);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);overflow:auto}.v7-explore-inner{width:min(1040px,100%);margin:0 auto;padding:24px 20px 50px}.v7-explore-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px}.v7-explore-top h2{font:800 30px/1 Manrope;letter-spacing:-1.1px;margin:4px 0 6px}.v7-explore-top p{max-width:600px;font-size:10px;line-height:1.55;color:#89959b;margin:0}.v7-explore-close{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#151c20;color:#fff;display:grid;place-items:center}.v7-app-section{margin:20px 0 9px;color:#7e8b91;font-size:8px;letter-spacing:1.35px;font-weight:950}.v7-menu-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.v7-menu-card{--tone:#7c5ce6;position:relative;overflow:hidden;text-align:left;min-height:132px;border-radius:18px;border:1px solid var(--v-line);background:rgba(255,255,255,.035);color:#fff;padding:14px;cursor:pointer;transition:.18s ease}.v7-menu-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.14)}.v7-menu-card:after{content:"";position:absolute;width:100px;height:100px;border-radius:50%;right:-38px;top:-38px;background:var(--tone);opacity:.12}.v7-menu-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,var(--tone),color-mix(in srgb,var(--tone) 40%,#101416));box-shadow:0 8px 20px color-mix(in srgb,var(--tone) 18%,transparent)}.v7-menu-card b{display:block;font-size:11px;margin-top:12px;position:relative;z-index:1}.v7-menu-card span{display:block;font-size:8px;color:#89959a;margin-top:3px;position:relative;z-index:1}.v7-menu-badge{position:absolute;right:8px;bottom:8px;padding:3px 6px;border-radius:6px;background:rgba(232,179,78,.1);color:#e8b34e;font-size:7px;font-style:normal;font-weight:950}

    .v7-dna-modal{max-width:520px}.v7-dna-modal h2{font:800 24px/1.05 Manrope;letter-spacing:-.8px;margin:5px 0}.v7-dna-modal p{font-size:11px;line-height:1.5;color:#929da2}.v7-form{display:grid;gap:11px;margin-top:15px}.v7-form label{font-size:9px;color:#929da2;font-weight:900}.v7-form select,.v7-form input{width:100%;box-sizing:border-box;margin-top:5px;padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#141a1e;color:#fff}.v7-form-actions{display:flex;gap:8px;margin-top:5px}.v7-form-actions button{flex:1;border:0;border-radius:12px;padding:12px;font-size:9px;font-weight:900}.v7-form-actions .main{background:#e9b44f;color:#17120a}.v7-form-actions .alt{background:rgba(255,255,255,.07);color:#fff}

    @media(max-width:900px){.v7-quick{grid-template-columns:repeat(2,minmax(0,1fr))}.v7-menu-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:560px){.student-v7{padding:2px 0 48px}.v7-welcome h1{font-size:29px}.v7-hero{border-radius:23px;padding:20px 17px}.v7-hero h2{font-size:23px}.v7-ring{width:68px;height:68px}.v7-progress{grid-template-columns:minmax(0,1fr) 78px;gap:10px;padding:14px}.v7-progress-ring{width:72px;height:72px}.v7-progress-ring:before{width:56px;height:56px}.v7-plan-row{grid-template-columns:42px 38px minmax(0,1fr) auto;gap:8px}.v7-time{display:none}.v7-menu-grid{grid-template-columns:1fr 1fr}.v7-menu-card{min-height:114px}.v7-explore-inner{padding:18px 14px 42px}.v7-signal-copy b{white-space:normal}.v7-streak{align-items:flex-start}.v7-xp{font-size:8px}.v7-week{gap:5px}}
    @media(prefers-reduced-motion:reduce){.student-v7 *{transition:none!important;animation:none!important}}
    /* APPLE UI 2.0 TARGETED HOME POLISH, based on the last Apple baseline */
    .v7-top{position:sticky!important;top:0!important;z-index:30!important;padding:10px 0!important;background:color-mix(in srgb,var(--v-bg) 84%,transparent)!important;border-bottom:1px solid color-mix(in srgb,var(--v-text) 7%,transparent)!important;backdrop-filter:blur(28px) saturate(145%)!important;-webkit-backdrop-filter:blur(28px) saturate(145%)!important}.v7-brand{gap:10px!important}.v7-logo{width:40px!important;height:40px!important;border-radius:12px!important;background:var(--apple-blue,#0a84ff)!important;color:#fff!important;box-shadow:none!important}.v7-brand-name{font-size:20px!important;letter-spacing:-1px!important}.v7-actions{gap:8px!important}.v7-round{width:40px!important;height:40px!important;border-radius:50%!important;background:color-mix(in srgb,var(--v-text) 4%,transparent)!important;border:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-round:hover{background:color-mix(in srgb,var(--v-text) 7%,transparent)!important}.v7-welcome{padding:40px 0 22px!important}.v7-welcome h1{font-size:clamp(38px,5vw,58px)!important;letter-spacing:-3.2px!important;line-height:1.02!important}.v7-welcome p{font-size:14px!important;line-height:1.55!important;color:var(--v-muted)!important}.v7-course{border-radius:18px!important;background:color-mix(in srgb,var(--v-text) 4%,transparent)!important;border:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--apple-blue,#0a84ff) 12%,var(--v-panel)),var(--v-panel) 56%,color-mix(in srgb,var(--accent) 5%,var(--v-panel)))!important;border-color:color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:0 20px 65px rgba(0,0,0,.16)!important}.v7-kicker{color:var(--apple-blue,#0a84ff)!important}.v7-hero-btn{background:var(--apple-blue,#0a84ff)!important;color:#fff!important}.v7-ring{background:conic-gradient(var(--apple-blue,#0a84ff) var(--v7p),color-mix(in srgb,var(--v-text) 9%,transparent) 0)!important}.v7-ring:before{background:var(--v-panel)!important}.v7-quick-card,.v7-plan-row,.v7-progress,.v7-continue,.v7-subject,.v7-signal,.v7-streak,.v7-recovery{background:color-mix(in srgb,var(--v-text) 3.5%,transparent)!important;border-color:color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-quick-card:hover{background:color-mix(in srgb,var(--v-text) 6%,transparent)!important;transform:translateY(-1px)!important}


    /* NEETPrep visual polish: preserve the existing home, refine hierarchy and density. */
    .student-v7{max-width:1000px;padding:8px 0 72px}
    .v7-top{padding:0 4px 18px;border-bottom:1px solid rgba(255,255,255,.045)}
    .v7-logo{width:40px;height:40px;border-radius:12px;box-shadow:0 8px 22px rgba(233,180,79,.12)}
    .v7-brand-name{font-size:19px}
    .v7-round{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.028)}
    .v7-welcome{padding:25px 4px 16px}
    .v7-welcome h1{font-size:clamp(30px,4vw,37px);letter-spacing:-1.65px}
    .v7-welcome p{max-width:620px;color:#87959b}
    .v7-course{margin:0 4px 16px;width:calc(100% - 8px);background:rgba(255,255,255,.022);border-color:rgba(255,255,255,.065);border-radius:15px;padding:10px 12px}
    .v7-course-icon{width:38px;height:38px;border-radius:11px}

    .v7-hero{border-radius:22px;padding:23px 24px 21px;background:linear-gradient(120deg,#123638 0%,#112a31 48%,#181b27 100%);border-color:rgba(87,209,191,.19);box-shadow:0 18px 45px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.05)}
    .v7-hero h2{font-size:28px;letter-spacing:-1.25px;max-width:580px}
    .v7-hero p{font-size:11px;max-width:500px;color:#b1c1c3}
    .v7-ring{width:74px;height:74px;background:conic-gradient(#68dbc7 var(--v7p),rgba(255,255,255,.09) 0)}
    .v7-chip{background:rgba(255,255,255,.065);padding:6px 9px}
    .v7-hero-btn{padding:11px 14px;border-radius:11px}

    .v7-section{margin-top:34px}
    .v7-head{margin-bottom:13px}
    .v7-head h2{font-size:22px;letter-spacing:-.95px}
    .v7-label{font-size:8px;color:#71838a}
    .v7-link{font-size:10px}

    .v7-quick{gap:10px}
    .v7-quick-card{min-height:104px;padding:13px;border-radius:16px;display:flex;align-items:center;gap:11px;background:linear-gradient(145deg,rgba(255,255,255,.034),rgba(255,255,255,.018));box-shadow:inset 0 1px rgba(255,255,255,.035)}
    .v7-quick-card:before{width:130px;height:130px;right:-70px;top:-70px;opacity:.085}
    .v7-quick-icon{width:42px;height:42px;min-width:42px;border-radius:13px}
    .v7-quick-card b{font-size:12px;line-height:1.2;flex:1}
    .v7-quick-card span:not(.v7-arrow){font-size:8px;line-height:1.25;display:none}
    .v7-arrow{margin-left:auto;font-size:20px}

    .v7-continue{padding:13px;border-radius:17px;background:linear-gradient(135deg,rgba(139,103,232,.11),rgba(255,255,255,.024));border-color:rgba(139,103,232,.15)}
    .v7-play{width:43px;height:43px;border-radius:13px}
    .v7-copy b{font-size:12px}.v7-copy span{font-size:8px}.v7-start{padding:8px 11px}

    .v7-progress{padding:15px;border-radius:17px;background:rgba(255,255,255,.024)}
    .v7-progress-main b{font-size:12px}.v7-progress-main p{font-size:8px;margin:4px 0 11px}
    .v7-bigbar{height:8px}
    .v7-progress-ring{width:76px;height:76px}
    .v7-progress-ring:before{width:59px;height:59px}

    .v7-plan{gap:7px}
    .v7-plan-row{grid-template-columns:45px 40px minmax(0,1fr) auto;padding:11px;border-radius:15px;background:rgba(255,255,255,.023)}
    .v7-plan-icon{width:40px;height:40px;border-radius:12px}
    .v7-plan-copy b{font-size:10px}.v7-plan-copy span{font-size:8px}
    .v7-plan-row button{padding:7px 9px}

    .v7-subjects{gap:7px}.v7-subject{padding:12px;border-radius:15px;background:rgba(255,255,255,.023)}
    .v7-subject-top b{font-size:10px}.v7-subject-top span{font-size:8px}.v7-track{height:6px;margin-top:8px}

    .v7-signal{padding:13px;border-radius:17px;background:linear-gradient(135deg,rgba(139,103,232,.11),rgba(255,255,255,.024));border-color:rgba(145,105,239,.15)}
    .v7-signal-icon{width:43px;height:43px;border-radius:13px}
    .v7-signal-copy small{font-size:7px}.v7-signal-copy b{font-size:11px}.v7-signal-copy p{font-size:8px}
    .v7-streak{padding:13px;border-radius:17px;background:linear-gradient(135deg,rgba(237,128,111,.09),rgba(255,255,255,.023));border-color:rgba(237,128,111,.14)}
    .v7-streak-flame{width:43px;height:43px;border-radius:13px}.v7-streak-copy b{font-size:11px}.v7-streak-copy span{font-size:8px}.v7-xp{font-size:8px}
    .v7-week{gap:7px;margin-top:8px}.v7-day{border-radius:12px;padding:8px 4px}.v7-day span{font-size:7px}.v7-day i{font-size:10px}
    .v7-recovery{padding:13px;border-radius:17px;background:linear-gradient(135deg,rgba(237,128,111,.08),rgba(255,255,255,.022));border-color:rgba(237,128,111,.14)}
    .v7-recovery-icon{width:43px;height:43px;border-radius:13px}.v7-recovery-copy small{font-size:7px}.v7-recovery-copy b{font-size:11px}.v7-score b{font-size:18px}.v7-score span{font-size:7px}

    .v7-explore{background:rgba(3,7,9,.78);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px)}
    .v7-explore-inner{padding:25px 22px 55px}
    .v7-explore-top h2{font-size:28px}.v7-menu-grid{gap:9px}.v7-menu-card{min-height:120px;border-radius:16px;background:rgba(255,255,255,.03)}
    .v7-menu-icon{width:41px;height:41px;border-radius:12px}

    .v7-dna-modal{max-width:540px;border-radius:24px}
    .v7-dna-modal h2{font-size:25px}.v7-form{gap:10px}.v7-form select,.v7-form input{border-radius:11px;background:#11171b;padding:12px}

    @media(max-width:700px){
      .student-v7{padding:2px 0 48px}
      .v7-top{padding-bottom:13px}
      .v7-welcome{padding:21px 2px 14px}
      .v7-welcome h1{font-size:28px}
      .v7-hero{padding:19px 16px 18px;border-radius:21px}
      .v7-hero h2{font-size:22px;max-width:calc(100% - 74px)}
      .v7-ring{width:62px;height:62px}
      .v7-hero-meta{gap:5px}.v7-chip{font-size:7px;padding:6px 7px}
      .v7-hero-btn{font-size:9px}
      .v7-section{margin-top:29px}.v7-head h2{font-size:19px}
      .v7-quick{grid-template-columns:1fr 1fr;gap:8px}
      .v7-quick-card{min-height:82px;padding:10px;border-radius:15px;gap:9px}
      .v7-quick-icon{width:36px;height:36px;min-width:36px;border-radius:11px}
      .v7-quick-card b{font-size:10px}.v7-arrow{font-size:17px}
      .v7-continue{padding:11px}.v7-play{width:39px;height:39px}.v7-copy b{font-size:10px}.v7-copy span{font-size:7px}.v7-start{font-size:8px;padding:7px 9px}
      .v7-progress{grid-template-columns:minmax(0,1fr) 68px;padding:12px}.v7-progress-ring{width:66px;height:66px}.v7-progress-ring:before{width:51px;height:51px}.v7-progress-main b{font-size:10px}.v7-progress-main p{font-size:7px}
      .v7-plan-row{grid-template-columns:34px 35px minmax(0,1fr) auto;gap:7px;padding:10px}.v7-time{display:none}.v7-plan-icon{width:35px;height:35px}.v7-plan-copy b{font-size:9px}.v7-plan-copy span{font-size:7px}.v7-plan-row button{font-size:7px;padding:7px 8px}
      .v7-subject{padding:11px}.v7-subject-top b{font-size:9px}.v7-subject-top span{font-size:7px}
      .v7-signal{gap:9px;padding:11px}.v7-signal-icon{width:38px;height:38px;border-radius:11px}.v7-signal-copy b{font-size:10px}.v7-signal-copy p{font-size:7px;margin-top:2px}.v7-signal>button{width:30px;height:30px}
      .v7-streak{padding:11px}.v7-streak-flame{width:38px;height:38px}.v7-streak-copy b{font-size:10px}.v7-streak-copy span{font-size:7px}.v7-xp{font-size:7px}.v7-week{gap:5px}.v7-day{padding:7px 2px;border-radius:10px}
      .v7-recovery{padding:11px}.v7-recovery-icon{width:38px;height:38px}.v7-recovery-copy b{font-size:10px}.v7-score b{font-size:16px}
    }

    /* APPLE-STYLE ENDGAME LAYER: visual only, existing behavior preserved. */
    .student-v7{max-width:1180px;padding:10px 0 92px;--apple-blue:#0a84ff;--apple-radius:24px}
    .v7-top{height:58px;padding:0 2px 14px;border-bottom:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)}
    .v7-logo{width:40px;height:40px;border-radius:12px;background:var(--accent);box-shadow:none}
    .v7-brand-name{font-size:21px;letter-spacing:-1px}.v7-round{width:42px;height:42px;border-radius:50%;background:color-mix(in srgb,var(--v-text) 5%,transparent);border-color:color-mix(in srgb,var(--v-text) 9%,transparent);box-shadow:none}
    .v7-round:hover{transform:none;background:color-mix(in srgb,var(--v-text) 9%,transparent)}.v7-theme-button{position:relative}.v7-theme-dot{width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 12%,transparent)}
    .v7-welcome{padding:58px 2px 22px}.v7-welcome small{font-size:10px;letter-spacing:.13em}.v7-welcome h1{font-size:clamp(42px,5vw,68px);letter-spacing:-3.8px;line-height:.98;margin:11px 0}.v7-welcome p{font-size:15px;max-width:650px;line-height:1.55}
    .v7-course{margin:0 0 18px;width:100%;min-height:72px;padding:12px 14px;border-radius:18px;background:color-mix(in srgb,var(--v-text) 4%,transparent);border-color:color-mix(in srgb,var(--v-text) 8%,transparent)}.v7-course-icon{width:46px;height:46px;border-radius:14px;background:color-mix(in srgb,var(--accent) 10%,transparent)}.v7-course-copy small{font-size:9px}.v7-course-copy b{font-size:13px}.v7-edit{font-size:10px;color:var(--apple-blue)}
    .v7-hero{min-height:270px;padding:34px 34px 30px;border-radius:30px;background:linear-gradient(135deg,#16181c,#101216 62%,#17191e);border:1px solid rgba(255,255,255,.08);box-shadow:0 22px 70px rgba(0,0,0,.22)}.v7-kicker{color:#64d8c8;font-size:10px}.v7-hero h2{font-size:clamp(31px,4vw,48px);letter-spacing:-2.2px;max-width:690px;margin:13px 0 10px}.v7-hero p{font-size:13px;max-width:560px}.v7-ring{width:94px;height:94px;background:conic-gradient(var(--apple-blue) var(--v7p),rgba(255,255,255,.1) 0);box-shadow:none}.v7-ring:before{inset:8px;background:#171a1e}.v7-ring b{font-size:15px}.v7-chip{padding:8px 11px;font-size:9px;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.08)}.v7-hero-btn{margin-top:22px;border-radius:14px;padding:13px 17px;font-size:11px}
    .v7-section{margin-top:58px}.v7-head{margin-bottom:17px}.v7-label{font-size:10px;letter-spacing:.13em}.v7-head h2{font-size:30px;letter-spacing:-1.5px;margin-top:7px}.v7-link{font-size:12px;color:var(--apple-blue)}
    .v7-quick{grid-template-columns:repeat(4,1fr);gap:12px}.v7-quick-card{min-height:155px;padding:19px;border-radius:22px;display:block;background:color-mix(in srgb,var(--v-text) 4%,transparent);border-color:color-mix(in srgb,var(--v-text) 8%,transparent);box-shadow:none}.v7-quick-card:before{opacity:.055}.v7-quick-icon{width:48px;height:48px;border-radius:15px;box-shadow:none;margin-bottom:27px}.v7-quick-card b{display:block;font-size:15px}.v7-quick-card span:not(.v7-arrow){display:block;font-size:10px;margin-top:5px}.v7-arrow{position:absolute;right:17px;bottom:15px;color:var(--apple-blue);font-size:19px}
    .v7-continue,.v7-progress,.v7-plan-row,.v7-subject,.v7-signal,.v7-streak,.v7-recovery{border-radius:20px;background:color-mix(in srgb,var(--v-text) 3.5%,transparent);border-color:color-mix(in srgb,var(--v-text) 8%,transparent);box-shadow:none}.v7-continue{padding:17px}.v7-play{width:50px;height:50px;border-radius:16px;box-shadow:none}.v7-copy b{font-size:14px}.v7-copy span{font-size:10px}.v7-start{background:var(--apple-blue);color:#fff;border-radius:12px;padding:10px 14px}
    .v7-progress{padding:22px;grid-template-columns:1fr 110px}.v7-progress-main b{font-size:15px}.v7-progress-main p{font-size:10px}.v7-bigbar{height:8px}.v7-bigbar i{background:var(--apple-blue)}.v7-progress-ring{width:98px;height:98px;background:conic-gradient(var(--apple-blue) var(--v7p),color-mix(in srgb,var(--v-text) 8%,transparent) 0)}.v7-progress-ring:before{width:76px;height:76px;background:var(--v-panel)}
    .v7-plan{gap:8px}.v7-plan-row{grid-template-columns:54px 48px 1fr auto;padding:14px 16px}.v7-time{font-size:9px}.v7-plan-icon{width:48px;height:48px;border-radius:15px;background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent)}.v7-plan-copy b{font-size:13px}.v7-plan-copy span{font-size:10px}.v7-plan-row button{border:0;background:color-mix(in srgb,var(--apple-blue) 10%,transparent);color:var(--apple-blue);border-radius:11px;padding:9px 12px;font-size:10px}
    .v7-subject{padding:16px}.v7-subject-top b{font-size:13px}.v7-subject-top span{font-size:9px}.v7-track{height:6px;background:color-mix(in srgb,var(--v-text) 8%,transparent)}.v7-track i{background:var(--apple-blue)}
    .v7-signal{padding:17px}.v7-signal-icon{width:50px;height:50px;border-radius:16px}.v7-signal-copy b{font-size:14px}.v7-signal-copy p{font-size:10px}.v7-streak,.v7-recovery{padding:16px}.v7-streak-flame,.v7-recovery-icon{width:48px;height:48px;border-radius:15px}.v7-streak-copy b,.v7-recovery-copy b{font-size:13px}
    .v7-explore{background:rgba(0,0,0,.52);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px)}.v7-explore-inner{max-width:1180px;margin:auto}.v7-menu-card{border-radius:20px;background:color-mix(in srgb,var(--v-text) 5%,transparent);border-color:color-mix(in srgb,var(--v-text) 9%,transparent)}
    .v7-sheet-backdrop{place-items:end center;padding:0}.v7-prep-sheet{width:min(620px,100%);max-width:620px;margin:0;border-radius:30px 30px 0 0;padding:22px 24px 28px;background:color-mix(in srgb,var(--v-panel) 96%,transparent);border:1px solid color-mix(in srgb,var(--v-text) 9%,transparent);box-shadow:0 -20px 80px rgba(0,0,0,.35);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px)}.v7-sheet-handle{width:36px;height:4px;border-radius:99px;background:color-mix(in srgb,var(--v-text) 22%,transparent);margin:0 auto 22px}.v7-sheet-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border-radius:50%;border:0;background:color-mix(in srgb,var(--v-text) 8%,transparent);color:var(--v-text);font-size:20px}.v7-sheet-kicker{font-size:10px;letter-spacing:.14em;color:var(--accent);font-weight:900}.v7-prep-sheet h2{font-size:31px;letter-spacing:-1.5px;margin:8px 0}.v7-prep-sheet>p{font-size:12px;line-height:1.55;margin:0 0 18px}.v7-setting-list{border-top:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)}.v7-setting-row{min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid color-mix(in srgb,var(--v-text) 7%,transparent);text-align:left}.v7-setting-row>span b{display:block;font-size:13px}.v7-setting-row>span small{display:block;color:var(--v-muted);font-size:10px;margin-top:3px}.v7-setting-row select{max-width:220px;border:0;background:transparent;color:var(--apple-blue);font-size:12px;font-weight:800;text-align:right;outline:0}.v7-stepper{display:flex;align-items:center;gap:10px}.v7-stepper button{width:32px;height:32px;border-radius:50%;border:1px solid color-mix(in srgb,var(--v-text) 10%,transparent);background:color-mix(in srgb,var(--v-text) 6%,transparent);color:var(--v-text);font-size:18px}.v7-stepper strong{min-width:28px;text-align:center;font-size:12px}.v7-prep-sheet .v7-form-actions{margin-top:20px}.v7-prep-sheet .v7-form-actions button{font-size:12px;border-radius:13px;padding:13px}.v7-prep-sheet .v7-form-actions .main{background:var(--apple-blue);color:#fff}
    @media(max-width:700px){.student-v7{max-width:none;padding:0 16px 110px}.v7-top{margin:0 -2px}.v7-welcome{padding:42px 0 20px}.v7-welcome h1{font-size:40px;letter-spacing:-2.6px}.v7-welcome p{font-size:14px}.v7-course{margin-bottom:16px}.v7-hero{padding:23px 20px;border-radius:25px;min-height:260px}.v7-hero h2{font-size:31px;letter-spacing:-1.6px}.v7-ring{width:72px;height:72px}.v7-section{margin-top:42px}.v7-head h2{font-size:24px}.v7-quick{grid-template-columns:1fr 1fr;gap:9px}.v7-quick-card{min-height:124px;padding:15px;border-radius:18px}.v7-quick-icon{width:42px;height:42px;margin-bottom:18px}.v7-quick-card b{font-size:12px}.v7-quick-card span:not(.v7-arrow){font-size:9px}.v7-progress{grid-template-columns:1fr 76px;padding:16px}.v7-progress-ring{width:70px;height:70px}.v7-progress-ring:before{width:54px;height:54px}.v7-plan-row{grid-template-columns:38px 38px 1fr auto;gap:8px;padding:12px}.v7-time{display:none}.v7-plan-icon{width:38px;height:38px}.v7-plan-copy b{font-size:11px}.v7-plan-copy span{font-size:8px}.v7-setting-row{min-height:70px}.v7-prep-sheet{padding:18px 20px 24px}.v7-prep-sheet h2{font-size:27px}}
    @media(min-width:701px){.v7-dna-modal{margin-bottom:0}.v7-sheet-backdrop{padding:24px}.v7-prep-sheet{border-radius:28px}}
    @media(prefers-reduced-motion:reduce){.student-v7 *{transition:none!important;animation:none!important}}
    /* APPLE UI 2.0 TARGETED HOME POLISH, based on the last Apple baseline */
    .v7-top{position:sticky!important;top:0!important;z-index:30!important;padding:10px 0!important;background:color-mix(in srgb,var(--v-bg) 84%,transparent)!important;border-bottom:1px solid color-mix(in srgb,var(--v-text) 7%,transparent)!important;backdrop-filter:blur(28px) saturate(145%)!important;-webkit-backdrop-filter:blur(28px) saturate(145%)!important}.v7-brand{gap:10px!important}.v7-logo{width:40px!important;height:40px!important;border-radius:12px!important;background:var(--apple-blue,#0a84ff)!important;color:#fff!important;box-shadow:none!important}.v7-brand-name{font-size:20px!important;letter-spacing:-1px!important}.v7-actions{gap:8px!important}.v7-round{width:40px!important;height:40px!important;border-radius:50%!important;background:color-mix(in srgb,var(--v-text) 4%,transparent)!important;border:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-round:hover{background:color-mix(in srgb,var(--v-text) 7%,transparent)!important}.v7-welcome{padding:40px 0 22px!important}.v7-welcome h1{font-size:clamp(38px,5vw,58px)!important;letter-spacing:-3.2px!important;line-height:1.02!important}.v7-welcome p{font-size:14px!important;line-height:1.55!important;color:var(--v-muted)!important}.v7-course{border-radius:18px!important;background:color-mix(in srgb,var(--v-text) 4%,transparent)!important;border:1px solid color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--apple-blue,#0a84ff) 12%,var(--v-panel)),var(--v-panel) 56%,color-mix(in srgb,var(--accent) 5%,var(--v-panel)))!important;border-color:color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:0 20px 65px rgba(0,0,0,.16)!important}.v7-kicker{color:var(--apple-blue,#0a84ff)!important}.v7-hero-btn{background:var(--apple-blue,#0a84ff)!important;color:#fff!important}.v7-ring{background:conic-gradient(var(--apple-blue,#0a84ff) var(--v7p),color-mix(in srgb,var(--v-text) 9%,transparent) 0)!important}.v7-ring:before{background:var(--v-panel)!important}.v7-quick-card,.v7-plan-row,.v7-progress,.v7-continue,.v7-subject,.v7-signal,.v7-streak,.v7-recovery{background:color-mix(in srgb,var(--v-text) 3.5%,transparent)!important;border-color:color-mix(in srgb,var(--v-text) 8%,transparent)!important;box-shadow:none!important}.v7-quick-card:hover{background:color-mix(in srgb,var(--v-text) 6%,transparent)!important;transform:translateY(-1px)!important}


    /* APPLE UI 2.1 — depth pass for Study Centre icons */
    .v7-menu-icon,
    .v7-quick-icon,
    .v7-course-icon,
    .v7-plan-icon{
      position:relative!important;
      isolation:isolate!important;
      overflow:hidden!important;
      border:1px solid color-mix(in srgb,var(--tone,var(--accent)) 28%,transparent)!important;
      background:
        radial-gradient(circle at 28% 20%,rgba(255,255,255,.34),transparent 28%),
        linear-gradient(145deg,
          color-mix(in srgb,var(--tone,var(--accent)) 96%,#fff 4%),
          color-mix(in srgb,var(--tone,var(--accent)) 48%,#080b0d 52%))!important;
      box-shadow:
        inset 0 1px rgba(255,255,255,.22),
        inset 0 -8px 18px rgba(0,0,0,.14),
        0 8px 18px color-mix(in srgb,var(--tone,var(--accent)) 22%,transparent)!important;
      transform:translateY(-1px)!important;
    }
    .v7-menu-icon::before,
    .v7-quick-icon::before,
    .v7-course-icon::before,
    .v7-plan-icon::before{
      content:"";
      position:absolute;
      left:8%;
      top:5%;
      width:65%;
      height:34%;
      border-radius:999px;
      background:rgba(255,255,255,.17);
      filter:blur(5px);
      pointer-events:none;
    }
    .v7-menu-icon svg,
    .v7-quick-icon svg,
    .v7-course-icon svg,
    .v7-plan-icon svg{
      position:relative!important;
      z-index:1!important;
      filter:drop-shadow(0 1px 2px rgba(0,0,0,.22))!important;
    }
    .v7-menu-card:hover .v7-menu-icon,
    .v7-quick-card:hover .v7-quick-icon{
      transform:translateY(-2px) scale(1.015)!important;
      box-shadow:
        inset 0 1px rgba(255,255,255,.24),
        inset 0 -8px 18px rgba(0,0,0,.12),
        0 12px 25px color-mix(in srgb,var(--tone,var(--accent)) 28%,transparent)!important;
    }

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
            <button className="v7-round v7-theme-button" onClick={props.onAppearance} aria-label="Change appearance">
              <span className="v7-theme-dot" />
            </button>
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
              onClick={props.onAccount}
              aria-label={props.user ? 'Open account' : 'Sign in'}
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
        <div className="modal-backdrop v7-sheet-backdrop" onMouseDown={() => setDnaOpen(false)}>
          <div className="modal v7-dna-modal v7-prep-sheet" onMouseDown={e => e.stopPropagation()}>
            <div className="v7-sheet-handle" />
            <button className="v7-sheet-close" onClick={() => setDnaOpen(false)} aria-label="Close">×</button>
            <span className="v7-sheet-kicker">MY PREPARATION</span>
            <h2>Shape your study setup.</h2>
            <p>Keep the experience relevant to your stage and routine.</p>

            <div className="v7-setting-list">
              <label className="v7-setting-row">
                <span><b>Stage</b><small>Your current NEET stage</small></span>
                <select value={dna.stage} onChange={e => setDna(prev => ({ ...prev, stage: e.target.value as PrepDNA['stage'] }))}>
                  <option>Class 11</option><option>Class 12</option><option>Dropper</option>
                </select>
              </label>
              <label className="v7-setting-row">
                <span><b>Coaching</b><small>How you prepare</small></span>
                <select value={dna.coaching} onChange={e => setDna(prev => ({ ...prev, coaching: e.target.value as PrepDNA['coaching'] }))}>
                  <option>Offline coaching</option><option>Online coaching</option><option>Hybrid</option><option>Self study</option>
                </select>
              </label>
              <div className="v7-setting-row">
                <span><b>Daily study hours</b><small>Your planned daily time</small></span>
                <div className="v7-stepper"><button onClick={() => setDna(prev => ({ ...prev, hours: Math.max(1, prev.hours - 1) }))}>−</button><strong>{dna.hours}h</strong><button onClick={() => setDna(prev => ({ ...prev, hours: Math.min(16, prev.hours + 1) }))}>+</button></div>
              </div>
              <label className="v7-setting-row">
                <span><b>Best focus window</b><small>When you study best</small></span>
                <select value={dna.focus} onChange={e => setDna(prev => ({ ...prev, focus: e.target.value as PrepDNA['focus'] }))}>
                  <option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option>
                </select>
              </label>
            </div>

            <div className="v7-form-actions"><button className="alt" onClick={() => setDnaOpen(false)}>Cancel</button><button className="main" onClick={saveDNA}>Save setup</button></div>
          </div>
        </div>
      )}
    </>
  );
}
