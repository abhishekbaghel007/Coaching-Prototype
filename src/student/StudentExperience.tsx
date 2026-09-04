import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { buildPrepIntelligence, buildScoreRecovery, rankSubjects, type Subject, type SubjectStats } from './prepIntelligence';

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
const MISSION_KEY = 'neetprep-missions-v1';

type MissionState = Record<string, boolean>;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local-only enhancement */ }
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function icon(name: string) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'target') return <svg {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>;
  if (name === 'bolt') return <svg {...p}><path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/></svg>;
  if (name === 'flame') return <svg {...p}><path d="M12 21c4 0 7-2.7 7-6.6 0-3.4-2.2-5.9-4.4-8.4-.2 2-1 3.3-2.1 4.3.2-3.5-1.8-6.1-4.2-8.3.1 3.5-3.3 5.7-3.3 10.2C5 18 8 21 12 21Z"/></svg>;
  if (name === 'chart') return <svg {...p}><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></svg>;
  if (name === 'book') return <svg {...p}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5Z"/><path d="M5 4.5v17M9 6h7M9 10h7"/></svg>;
  if (name === 'spark') return <svg {...p}><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Z"/><path d="m19 14 .6 2.1L22 17l-2.4.9L19 20l-.6-2.1L16 17l2.4-.9L19 14Z"/></svg>;
  if (name === 'clock') return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === 'repair') return <svg {...p}><path d="m14.7 6.3 3-3 3 3-3 3"/><path d="M17.7 3.3a6 6 0 0 0-7.8 7.8L4 17l3 3 5.9-5.9a6 6 0 0 0 7.8-7.8"/></svg>;
  return <svg {...p}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
}

export default function StudentExperience(props: Props) {
  const [dna, setDna] = useState<PrepDNA>(() => load<PrepDNA>(DNA_KEY, { stage: 'Dropper', coaching: 'Offline coaching', hours: 6, focus: 'Evening' }));
  const [dnaOpen, setDnaOpen] = useState(false);
  const [missions, setMissions] = useState<MissionState>(() => load<MissionState>(MISSION_KEY, {}));
  const [intelOpen, setIntelOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sessionLength, setSessionLength] = useState<10 | 20 | 30>(20);

  const intelligence = useMemo(() => buildPrepIntelligence(props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target), [props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target]);
  const recovery = useMemo(() => buildScoreRecovery(props.stats, props.mistakes.length), [props.stats, props.mistakes.length]);
  const ranked = useMemo(() => rankSubjects(props.stats), [props.stats]);

  const firstName = props.user?.user_metadata?.display_name || props.user?.email?.split('@')[0] || 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const remaining = Math.max(0, props.dailyGoal - props.today);
  const dailyPct = Math.min(100, Math.round((props.today / Math.max(1, props.dailyGoal)) * 100));
  const level = Math.max(1, Math.floor((props.totalAnswered + props.today * 2 + props.streakDays * 10) / 100) + 1);
  const xp = props.totalAnswered * 5 + props.today * 3 + props.streakDays * 12;
  const xpPct = Math.min(100, Math.round((xp % 500) / 5));

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count: props.activity[dayKey(d)] ?? 0, today: index === 6 };
  }), [props.activity]);

  const missionDone = Object.values(missions).filter(Boolean).length;

  const toggleMission = (id: string) => {
    const next = { ...missions, [id]: !missions[id] };
    setMissions(next);
    save(MISSION_KEY, next);
  };

  const startSession = (title: string, ids?: string[]) => {
    const safeCount = Math.min(sessionLength, ids?.length ?? props.questionIds.length);
    props.onPractice(Math.max(1, safeCount), title, ids);
  };

  const startSmart = () => {
    if (intelligence.action === 'repair' && props.mistakes.length) {
      props.onPractice(Math.min(sessionLength, props.mistakes.length), `${intelligence.subject ?? 'Mistake'} repair`, props.mistakes);
      return;
    }
    if (intelligence.subject) {
      props.onPractice(sessionLength, `${intelligence.subject} focus`, props.subjectQuestionIds[intelligence.subject]);
      return;
    }
    props.onPractice(sessionLength, 'First signal');
  };

  const persistDNA = () => {
    save(DNA_KEY, dna);
    setDnaOpen(false);
  };

  const v4Css = `
    .v4-wrap{padding-bottom:28px}
    .v4-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:8px 2px 22px}
    .v4-eyebrow{display:flex;align-items:center;gap:8px;color:var(--muted,#9ba6b2);font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}.v4-pulse{width:7px;height:7px;border-radius:50%;background:var(--accent,#58d0c0);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent,#58d0c0) 10%,transparent)}
    .v4-hero h1{margin:9px 0 7px;font-size:35px;line-height:1.03;letter-spacing:-1.5px}.v4-hero h1 em{font-style:normal;color:var(--accent,#58d0c0)}.v4-hero p{margin:0;color:var(--muted,#9ba6b2);font-size:13px;line-height:1.5;max-width:430px}
    .v4-dna{width:76px;height:76px;border:1px solid rgba(255,255,255,.11);border-radius:25px;background:rgba(255,255,255,.055);color:var(--text,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;box-shadow:0 14px 38px rgba(0,0,0,.14)}.v4-dna span{font-size:21px;color:var(--accent,#58d0c0)}.v4-dna small{font-size:8px;font-weight:900;letter-spacing:1.1px;color:var(--muted,#9ba6b2)}
    .v4-command{position:relative;overflow:hidden;padding:20px;border-radius:28px;border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 25%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--accent,#58d0c0) 10%,transparent),rgba(255,255,255,.035));box-shadow:0 20px 60px rgba(0,0,0,.18)}.v4-command:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-75px;top:-100px;background:var(--accent,#58d0c0);opacity:.09;filter:blur(24px)}
    .v4-command-top{display:flex;align-items:center;justify-content:space-between;gap:15px;position:relative;z-index:1}.v4-kicker{display:block;font-size:9px;letter-spacing:1.5px;font-weight:900;color:var(--accent,#58d0c0);text-transform:uppercase}.v4-command strong{display:block;font-size:21px;letter-spacing:-.5px;margin-top:6px}.v4-command p{margin:6px 0 0;color:var(--muted,#9ba6b2);font-size:12px;line-height:1.45}.v4-ring{width:62px;height:62px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--accent,#58d0c0) var(--p),rgba(255,255,255,.08) 0);position:relative}.v4-ring:before{content:"";position:absolute;inset:6px;border-radius:50%;background:#12161b}.v4-ring span{position:relative;font-size:12px;font-weight:900}.v4-primary{margin-top:18px;width:100%;display:flex;justify-content:space-between;align-items:center;border:0;border-radius:17px;padding:14px 16px;background:var(--accent,#58d0c0);color:#08100f;font-weight:950;cursor:pointer;position:relative;z-index:1}.v4-primary svg{width:17px}
    .v4-intel{margin-top:14px;padding:18px;border-radius:25px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.075);cursor:pointer}.v4-intel-head{display:flex;justify-content:space-between;align-items:center}.v4-live{font-size:8px;font-weight:900;letter-spacing:1px;padding:5px 8px;border-radius:999px;background:rgba(88,208,192,.10);color:var(--accent,#58d0c0)}.v4-intel-main{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-top:9px}.v4-intel h2{font-size:19px;line-height:1.12;margin:0;letter-spacing:-.4px}.v4-intel p{font-size:12px;line-height:1.5;color:var(--muted,#9ba6b2);margin:7px 0 0}.v4-score{text-align:right;min-width:52px}.v4-score b{font-size:25px;display:block}.v4-score small{font-size:8px;color:var(--muted,#9ba6b2);font-weight:800}.v4-intel-foot{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,255,255,.07);padding-top:12px;margin-top:14px;font-size:10px;color:var(--muted,#9ba6b2)}.v4-intel-foot b{color:var(--text,#fff)}
    .v4-recovery{margin-top:14px;padding:17px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.075);cursor:pointer}.v4-recovery-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.v4-recovery-title{display:flex;align-items:center;gap:10px}.v4-recovery-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent,#58d0c0) 11%,transparent);color:var(--accent,#58d0c0)}.v4-recovery small{font-size:8px;letter-spacing:1.3px;font-weight:900;color:var(--muted,#9ba6b2)}.v4-recovery strong{display:block;font-size:17px;margin-top:3px}.v4-recovery-score{text-align:right}.v4-recovery-score b{font-size:27px;letter-spacing:-1px}.v4-recovery-score span{display:block;color:var(--muted,#9ba6b2);font-size:9px}.v4-recovery p{font-size:11px;line-height:1.5;color:var(--muted,#9ba6b2);margin:12px 0 0}.v4-progress{height:5px;border-radius:999px;background:rgba(255,255,255,.08);margin-top:13px;overflow:hidden}.v4-progress i{display:block;height:100%;border-radius:inherit;background:var(--accent,#58d0c0)}
    .v4-section{margin-top:22px}.v4-section-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:11px}.v4-section-head h2{margin:3px 0 0;font-size:18px;letter-spacing:-.4px}.v4-link{border:0;background:none;color:var(--accent,#58d0c0);font-weight:850;font-size:10px;cursor:pointer}
    .v4-session{padding:16px;border-radius:23px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.v4-session-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.v4-session-top b{font-size:15px}.v4-session-top span{font-size:10px;color:var(--muted,#9ba6b2)}.v4-segments{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.v4-segments button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:var(--muted,#9ba6b2);border-radius:12px;padding:10px 4px;font-size:10px;font-weight:850;cursor:pointer}.v4-segments button.active{background:color-mix(in srgb,var(--accent,#58d0c0) 12%,transparent);border-color:color-mix(in srgb,var(--accent,#58d0c0) 32%,transparent);color:var(--text,#fff)}.v4-session-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.v4-session-actions button{border:0;border-radius:14px;padding:12px;font-size:11px;font-weight:900;cursor:pointer}.v4-session-actions .main{background:var(--accent,#58d0c0);color:#08100f}.v4-session-actions .alt{background:rgba(255,255,255,.07);color:var(--text,#fff)}
    .v4-plan{display:grid;gap:7px}.v4-plan-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.035);border-radius:17px;padding:12px;color:var(--text,#fff);cursor:pointer}.v4-plan-item.done{opacity:.55}.v4-check{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.12);color:var(--muted,#9ba6b2);font-size:11px;flex:0 0 auto}.v4-plan-item.done .v4-check{background:var(--accent,#58d0c0);color:#08100f;border-color:transparent}.v4-plan-copy{flex:1}.v4-plan-copy b{font-size:12px;display:block}.v4-plan-copy small{display:block;color:var(--muted,#9ba6b2);font-size:9px;margin-top:3px}.v4-plan-arrow{color:var(--muted,#9ba6b2)}
    .v4-subjects{display:grid;gap:8px}.v4-subject{padding:13px 14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.v4-subject-top{display:flex;justify-content:space-between;font-size:11px}.v4-subject-top b{font-weight:900}.v4-subject-top span{color:var(--muted,#9ba6b2)}.v4-subject-track{height:5px;border-radius:999px;background:rgba(255,255,255,.08);margin-top:9px;overflow:hidden}.v4-subject-track i{height:100%;display:block;border-radius:inherit;background:var(--accent,#58d0c0)}
    .v4-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.v4-day{min-width:0;text-align:center}.v4-day span{font-size:8px;color:var(--muted,#9ba6b2);font-weight:800}.v4-day i{display:grid;place-items:center;height:34px;margin-top:5px;border-radius:11px;background:rgba(255,255,255,.045);font-style:normal;font-size:9px;font-weight:900}.v4-day.active i{background:color-mix(in srgb,var(--accent,#58d0c0) 16%,transparent);color:var(--accent,#58d0c0);border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 25%,transparent)}.v4-day.today i{box-shadow:inset 0 0 0 1px var(--accent,#58d0c0)}
    .v4-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.v4-stat{padding:13px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.v4-stat small{display:block;color:var(--muted,#9ba6b2);font-size:8px;font-weight:900;letter-spacing:.8px}.v4-stat b{display:block;font-size:18px;margin-top:5px;letter-spacing:-.5px}.v4-stat span{font-size:8px;color:var(--muted,#9ba6b2)}
    .v4-toolkit{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.v4-tool{padding:14px;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.035);border-radius:18px;text-align:left;color:var(--text,#fff);cursor:pointer}.v4-tool-icon{color:var(--accent,#58d0c0);margin-bottom:9px}.v4-tool b{display:block;font-size:11px}.v4-tool small{display:block;color:var(--muted,#9ba6b2);font-size:8px;margin-top:3px;line-height:1.35}
    .v4-more{width:100%;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:var(--text,#fff);border-radius:17px;padding:13px;font-size:11px;font-weight:900;cursor:pointer}.v4-more-panel{display:grid;gap:6px;margin-top:7px}.v4-more-panel button{padding:12px;border-radius:14px;text-align:left;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);color:var(--text,#fff);font-size:10px;cursor:pointer}
    .v4-modal{max-width:540px}.v4-modal h2{font-size:24px;letter-spacing:-.7px;margin:7px 0}.v4-modal p{font-size:12px;line-height:1.55;color:var(--muted,#9ba6b2)}.v4-modal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:18px 0}.v4-modal-metric{padding:13px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06)}.v4-modal-metric small{display:block;color:var(--muted,#9ba6b2);font-size:8px;font-weight:900;letter-spacing:1px}.v4-modal-metric b{display:block;margin-top:5px;font-size:17px}.v4-modal-reason{padding:14px;border-radius:17px;background:color-mix(in srgb,var(--accent,#58d0c0) 7%,transparent);border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 14%,transparent);font-size:11px;line-height:1.55}.v4-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:14px}.v4-modal-actions button{border:0;border-radius:14px;padding:13px;font-weight:900;cursor:pointer}.v4-modal-actions .main{background:var(--accent,#58d0c0);color:#08100f}.v4-modal-actions .alt{background:rgba(255,255,255,.07);color:var(--text,#fff)}
    .v4-form{display:grid;gap:12px;margin-top:17px}.v4-form label{font-size:10px;color:var(--muted,#9ba6b2);font-weight:850}.v4-form select,.v4-form input{display:block;width:100%;margin-top:5px;box-sizing:border-box;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:var(--text,#fff);border-radius:13px;padding:11px;outline:none}.v4-form input[type=range]{padding:0}.v4-form .value{text-align:right;font-size:10px;color:var(--accent,#58d0c0);margin-top:-8px}
    @media(max-width:520px){.v4-hero h1{font-size:31px}.v4-hero{padding-top:4px}.v4-dna{width:68px;height:68px;border-radius:22px}.v4-command{padding:17px;border-radius:24px}.v4-intel{border-radius:22px}.v4-modal-grid{grid-template-columns:1fr 1fr}.v4-modal-grid .v4-modal-metric:last-child{grid-column:1/-1}.v4-stats{grid-template-columns:1fr 1fr}.v4-stats .v4-stat:last-child{grid-column:1/-1}}
  `;

  const missionItems = [
    { id: 'questions', title: `${remaining || 10} focused questions`, sub: intelligence.subject ? `${intelligence.subject} · next best lane` : 'Build your first performance signal' },
    { id: 'repair', title: props.mistakes.length ? `Repair ${Math.min(5, props.mistakes.length)} mistakes` : 'Build the mistake bank', sub: props.mistakes.length ? 'Turn misses into recoverable marks' : 'Your first incorrect answers will appear here' },
    { id: 'review', title: 'Review your signal', sub: 'Check accuracy, streak and subject balance' },
  ];

  return <>
    <style>{v4Css}</style>
    <div className="student-os v4-wrap">
      <section className="v4-hero">
        <div>
          <div className="v4-eyebrow"><span className="v4-pulse" /> {greeting}, {String(firstName).split(' ')[0]}</div>
          <h1>Study less randomly.<br /><em>Study with a signal.</em></h1>
          <p>{remaining > 0 ? `${remaining} questions remain in today's plan. Your dashboard is choosing the highest-value next move.` : "Today's plan is complete. Use the recovery queue to protect tomorrow's score."}</p>
        </div>
        <button className="v4-dna" onClick={() => setDnaOpen(true)}><span>✦</span><small>PREP DNA</small></button>
      </section>

      <section className="v4-command">
        <div className="v4-command-top">
          <div><span className="v4-kicker">TODAY'S COMMAND</span><strong>{props.today >= props.dailyGoal ? 'Mission complete.' : `${props.dailyGoal} questions.`}</strong><p>{props.today >= props.dailyGoal ? 'Consistency is banked. A precision session is optional.' : 'One focused block. No wandering through the question bank.'}</p></div>
          <div className="v4-ring" style={{ '--p': `${dailyPct}%` } as CSSProperties}><span>{dailyPct}%</span></div>
        </div>
        <button className="v4-primary" onClick={() => startSession(props.today >= props.dailyGoal ? 'Extra daily set' : 'Daily Mission')}><span>{props.today >= props.dailyGoal ? 'Run another set' : 'Enter today\'s mission'}</span>{icon('arrow')}</button>
      </section>

      <section className="v4-intel" onClick={() => setIntelOpen(true)}>
        <div className="v4-intel-head"><span className="v4-kicker">PREP INTELLIGENCE · V4</span><span className="v4-live">LIVE SIGNAL</span></div>
        <div className="v4-intel-main"><div><h2>{intelligence.headline}</h2><p>{intelligence.detail}</p></div><div className="v4-score"><b>{intelligence.accuracy || '—'}</b><small>{intelligence.accuracy ? 'ACCURACY' : 'SIGNAL'}</small></div></div>
        <div className="v4-intel-foot"><span>Priority <b>{intelligence.priority}</b></span><span>{intelligence.subject ? `${intelligence.subject} · ${intelligence.attempted} attempts` : 'Needs more data'}</span></div>
      </section>

      <section className="v4-recovery" onClick={() => setRecoveryOpen(true)}>
        <div className="v4-recovery-row"><div className="v4-recovery-title"><span className="v4-recovery-icon">{icon('repair')}</span><div><small>SCORE RECOVERY</small><strong>{recovery.label}</strong></div></div><div className="v4-recovery-score"><b>+{recovery.marks}</b><span>possible marks</span></div></div>
        <p>{recovery.detail}</p>
        <div className="v4-progress"><i style={{ width: `${Math.min(100, recovery.marks)}%` }} /></div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">FOCUS LAB</span><h2>Build one clean session.</h2></div><span style={{ fontSize: 9, color: 'var(--muted,#9ba6b2)' }}>{sessionLength} min</span></div>
        <div className="v4-session">
          <div className="v4-session-top"><b>{intelligence.subject ? `${intelligence.subject} focus` : 'Signal builder'}</b><span>{props.mistakes.length ? `${props.mistakes.length} repair items` : 'Fresh question set'}</span></div>
          <div className="v4-segments">{([10,20,30] as const).map(n => <button key={n} className={sessionLength === n ? 'active' : ''} onClick={() => setSessionLength(n)}>{n} min</button>)}</div>
          <div className="v4-session-actions"><button className="main" onClick={startSmart}>Start smart →</button><button className="alt" onClick={() => props.onGo('practice')}>Browse bank</button></div>
        </div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">TODAY · 3 MOVES</span><h2>Small enough to finish.</h2></div><span style={{ fontSize: 9, color: 'var(--muted,#9ba6b2)' }}>{Math.min(3, missionDone)}/3 done</span></div>
        <div className="v4-plan">{missionItems.map(item => <button key={item.id} className={`v4-plan-item ${missions[item.id] ? 'done' : ''}`} onClick={() => toggleMission(item.id)}><span className="v4-check">{missions[item.id] ? '✓' : ''}</span><span className="v4-plan-copy"><b>{item.title}</b><small>{item.sub}</small></span><span className="v4-plan-arrow">›</span></button>)}</div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">SUBJECT SIGNAL</span><h2>Where your marks are moving.</h2></div><button className="v4-link" onClick={() => props.onGo('progress')}>Details →</button></div>
        <div className="v4-subjects">{ranked.length ? ranked.map(item => <button className="v4-subject" key={item.subject} onClick={() => props.onPractice(sessionLength, `${item.subject} focus`, props.subjectQuestionIds[item.subject])}><div className="v4-subject-top"><b>{item.subject}</b><span>{item.accuracy}% · {item.attempted} attempts</span></div><div className="v4-subject-track"><i style={{ width: `${item.accuracy}%` }} /></div></button>) : <div className="v4-subject"><div className="v4-subject-top"><b>Not enough data yet</b><span>Start with 10 questions</span></div></div>}</div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">MOMENTUM MAP</span><h2>{props.streakDays ? `${props.streakDays}-day streak.` : 'Start your streak.'}</h2></div><span style={{ fontSize: 9, color: 'var(--muted,#9ba6b2)' }}>{week.reduce((sum, item) => sum + item.count, 0)} this week</span></div>
        <div className="v4-week">{week.map(item => <div className={`v4-day ${item.count ? 'active' : ''} ${item.today ? 'today' : ''}`} key={`${item.label}-${item.today}`}><span>{item.label}</span><i>{item.count || '·'}</i></div>)}</div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">YOUR NUMBERS</span><h2>Keep the signal honest.</h2></div></div>
        <div className="v4-stats"><div className="v4-stat"><small>ANSWERED</small><b>{props.totalAnswered}</b><span>questions</span></div><div className="v4-stat"><small>ACCURACY</small><b>{props.overallAccuracy}%</b><span>overall</span></div><div className="v4-stat"><small>LEVEL</small><b>{level}</b><span>{xp} XP</span></div></div>
        <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}><i style={{ display: 'block', width: `${xpPct}%`, height: '100%', background: 'var(--accent,#58d0c0)', borderRadius: 99 }} /></div>
      </section>

      <section className="v4-section">
        <div className="v4-section-head"><div><span className="v4-kicker">TOOLKIT</span><h2>Go straight where you need.</h2></div></div>
        <div className="v4-toolkit">
          <button className="v4-tool" onClick={() => props.onGo('mistakes')}><div className="v4-tool-icon">{icon('repair')}</div><b>Mistake repair</b><small>{props.mistakes.length} questions waiting</small></button>
          <button className="v4-tool" onClick={() => props.onGo('saved')}><div className="v4-tool-icon">{icon('book')}</div><b>Saved</b><small>{props.saved.length} questions kept</small></button>
          <button className="v4-tool" onClick={() => props.onGo('mocks')}><div className="v4-tool-icon">{icon('target')}</div><b>Mock lab</b><small>Build a timed test</small></button>
          <button className="v4-tool" onClick={() => props.onGo('progress')}><div className="v4-tool-icon">{icon('chart')}</div><b>Performance</b><small>Accuracy and progress</small></button>
        </div>
      </section>

      {props.announcementsCount > 0 && <section className="v4-section"><button className="v4-more" onClick={props.onAnnouncements}>✦ &nbsp; {props.announcementsCount} teacher update{props.announcementsCount === 1 ? '' : 's'} · Open inbox →</button></section>}

      <section className="v4-section">
        <button className="v4-more" onClick={() => setMoreOpen(v => !v)}>{moreOpen ? 'Hide more controls' : 'More controls'} <span style={{ float: 'right' }}>{moreOpen ? '⌃' : '⌄'}</span></button>
        {moreOpen && <div className="v4-more-panel"><button onClick={() => setTarget(v => v >= 100 ? 10 : v + 10)}>Daily target · {props.dailyGoal} questions →</button><button onClick={() => props.onPractice(10, 'Saved revision', props.saved)}>Saved revision · {props.saved.length} ready →</button><button onClick={() => props.onPractice(Math.min(10, props.mistakes.length || 10), 'Mistake repair', props.mistakes)}>Mistake repair · {props.mistakes.length} ready →</button></div>}
      </section>
    </div>

    {intelOpen && <div className="modal-backdrop" onMouseDown={() => setIntelOpen(false)}><div className="modal v4-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setIntelOpen(false)}>×</button><span className="section-kicker">PREP INTELLIGENCE</span><h2>{intelligence.headline}</h2><p>{intelligence.detail}</p><div className="v4-modal-grid"><div className="v4-modal-metric"><small>WEAK LANE</small><b>{intelligence.subject ?? 'Finding'}</b></div><div className="v4-modal-metric"><small>ACCURACY</small><b>{intelligence.accuracy || '—'}%</b></div><div className="v4-modal-metric"><small>RECOVERY</small><b>+{intelligence.recoveryMarks}</b></div></div><div className="v4-modal-reason"><b>Why this recommendation</b><br />NEETPrep is using your answered-question signal, mistake queue and today's remaining workload. The goal is to make the next session useful, not merely busy.</div><div className="v4-modal-actions"><button className="main" onClick={() => { setIntelOpen(false); startSmart(); }}>Start this session</button><button className="alt" onClick={() => setIntelOpen(false)}>Keep exploring</button></div></div></div>}

    {recoveryOpen && <div className="modal-backdrop" onMouseDown={() => setRecoveryOpen(false)}><div className="modal v4-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setRecoveryOpen(false)}>×</button><span className="section-kicker">SCORE RECOVERY</span><h2>Recover marks before chasing more.</h2><p>{recovery.detail}</p><div className="v4-modal-grid"><div className="v4-modal-metric"><small>IN QUEUE</small><b>{recovery.mistakes}</b></div><div className="v4-modal-metric"><small>EST. SESSION</small><b>{recovery.estimatedQuestions} Q</b></div><div className="v4-modal-metric"><small>MARKS IN PLAY</small><b>+{recovery.marks}</b></div></div><div className="v4-modal-reason"><b>Best first move</b><br />{recovery.subject ? `Repair the ${recovery.subject} lane first, then return to mixed practice.` : 'Answer more questions so the recovery engine can identify a subject lane.'}</div><div className="v4-modal-actions"><button className="main" onClick={() => { setRecoveryOpen(false); props.onPractice(Math.min(sessionLength, props.mistakes.length || 10), 'Score recovery', props.mistakes); }}>Repair now</button><button className="alt" onClick={() => setRecoveryOpen(false)}>Close</button></div></div></div>}

    {dnaOpen && <div className="modal-backdrop" onMouseDown={() => setDnaOpen(false)}><div className="modal v4-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setDnaOpen(false)}>×</button><span className="section-kicker">PREP DNA</span><h2>Tell the dashboard how you study.</h2><p>This stays on this device for now and shapes the coaching surface.</p><div className="v4-form"><label>Stage<select value={dna.stage} onChange={e => setDna(v => ({ ...v, stage: e.target.value as PrepDNA['stage'] }))}><option>Class 11</option><option>Class 12</option><option>Dropper</option></select></label><label>Coaching<select value={dna.coaching} onChange={e => setDna(v => ({ ...v, coaching: e.target.value as PrepDNA['coaching'] }))}><option>Offline coaching</option><option>Online coaching</option><option>Hybrid</option><option>Self study</option></select></label><label>Study hours / day<input type="range" min="1" max="14" value={dna.hours} onChange={e => setDna(v => ({ ...v, hours: Number(e.target.value) }))}/><div className="value">{dna.hours} hours</div></label><label>Best focus window<select value={dna.focus} onChange={e => setDna(v => ({ ...v, focus: e.target.value as PrepDNA['focus'] }))}><option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label></div><div className="v4-modal-actions"><button className="main" onClick={persistDNA}>Save Prep DNA</button><button className="alt" onClick={() => setDnaOpen(false)}>Cancel</button></div></div></div>}
  </>;
}
