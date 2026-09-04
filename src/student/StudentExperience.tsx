import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CSSProperties, ReactNode } from 'react';
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

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local-only */ }
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  };
  return <svg {...p}>{paths[name] ?? paths.more}</svg>;
}

export default function StudentExperience(props: Props) {
  const [dna, setDna] = useState<PrepDNA>(() => load<PrepDNA>(DNA_KEY, { stage: 'Dropper', coaching: 'Offline coaching', hours: 6, focus: 'Evening' }));
  const [dnaOpen, setDnaOpen] = useState(false);
  const [section, setSection] = useState<'home' | 'study'>('home');

  const intelligence = useMemo(() => buildPrepIntelligence(props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target), [props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target]);
  const recovery = useMemo(() => buildScoreRecovery(props.stats, props.mistakes.length), [props.stats, props.mistakes.length]);
  const ranked = useMemo(() => rankSubjects(props.stats), [props.stats]);

  const firstName = props.user?.user_metadata?.display_name || props.user?.email?.split('@')[0] || 'Student';
  const first = String(firstName).split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const remaining = Math.max(0, props.dailyGoal - props.today);
  const dailyPct = Math.min(100, Math.round((props.today / Math.max(1, props.dailyGoal)) * 100));
  const level = Math.max(1, Math.floor((props.totalAnswered + props.streakDays * 10) / 100) + 1);
  const xp = props.totalAnswered * 5 + props.streakDays * 12;

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count: props.activity[dayKey(d)] ?? 0, today: index === 6 };
  }), [props.activity]);

  const startSmart = () => {
    if (intelligence.action === 'repair' && props.mistakes.length) {
      props.onPractice(Math.min(10, props.mistakes.length), `${intelligence.subject ?? 'Mistake'} repair`, props.mistakes);
      return;
    }
    if (intelligence.subject) {
      props.onPractice(10, `${intelligence.subject} practice`, props.subjectQuestionIds[intelligence.subject]);
      return;
    }
    props.onPractice(10, 'Daily Practice');
  };

  const saveDNA = () => {
    save(DNA_KEY, dna);
    setDnaOpen(false);
  };

  const css = `
    .student-v5{padding:0 0 30px;max-width:760px;margin:0 auto;color:var(--text,#f4f6f7)}
    .v5-top{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 15px}
    .v5-brand{display:flex;align-items:center;gap:10px}.v5-logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--accent,#58d0c0);color:#07100f;font-weight:950;font-size:19px;box-shadow:0 7px 18px color-mix(in srgb,var(--accent,#58d0c0) 18%,transparent)}.v5-brand b{font-size:19px;letter-spacing:-.7px}.v5-brand b span{color:var(--accent,#58d0c0)}
    .v5-top-actions{display:flex;gap:7px}.v5-iconbtn{position:relative;width:39px;height:39px;border:1px solid rgba(255,255,255,.09);border-radius:50%;background:rgba(255,255,255,.035);color:var(--text,#fff);display:grid;place-items:center;cursor:pointer}.v5-dot{position:absolute;right:7px;top:6px;width:6px;height:6px;border-radius:50%;background:#ff776f;border:2px solid #0c1013}
    .v5-profile{width:39px;height:39px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);font-weight:900}
    .v5-welcome{padding:7px 2px 19px}.v5-welcome small{color:var(--muted,#9aa5ad);font-size:10px;font-weight:800;letter-spacing:.9px}.v5-welcome h1{font-size:29px;line-height:1.08;letter-spacing:-1.1px;margin:7px 0 5px}.v5-welcome p{font-size:12px;color:var(--muted,#9aa5ad);margin:0}
    .v5-course{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:17px;margin-bottom:14px}.v5-course-badge{width:38px;height:38px;border-radius:11px;background:rgba(88,208,192,.12);color:var(--accent,#58d0c0);display:grid;place-items:center}.v5-course-copy{flex:1}.v5-course-copy small{font-size:8px;letter-spacing:1px;color:var(--muted,#9aa5ad);font-weight:900}.v5-course-copy b{display:block;font-size:12px;margin-top:2px}.v5-course button{border:0;background:none;color:var(--accent,#58d0c0);font-size:10px;font-weight:900;cursor:pointer}
    .v5-hero{position:relative;overflow:hidden;border-radius:23px;padding:19px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent,#58d0c0) 17%,#10161a),#12191d 72%);border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 24%,transparent);margin-bottom:16px}.v5-hero:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-70px;top:-80px;background:var(--accent,#58d0c0);opacity:.10;filter:blur(16px)}.v5-hero-kicker{font-size:9px;letter-spacing:1.2px;color:var(--accent,#58d0c0);font-weight:900}.v5-hero h2{font-size:22px;letter-spacing:-.6px;margin:7px 0 5px;position:relative;z-index:1}.v5-hero p{font-size:11px;color:#b8c1c5;line-height:1.45;max-width:450px;position:relative;z-index:1}.v5-hero-row{display:flex;align-items:center;justify-content:space-between;gap:15px;position:relative;z-index:1}.v5-progress-ring{width:61px;height:61px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;background:conic-gradient(var(--accent,#58d0c0) var(--p),rgba(255,255,255,.09) 0);position:relative}.v5-progress-ring:before{content:"";position:absolute;inset:6px;background:#13191c;border-radius:50%}.v5-progress-ring b{position:relative;font-size:12px}.v5-hero-btn{margin-top:13px;border:0;border-radius:13px;padding:12px 15px;background:#f3f5f4;color:#101515;font-weight:950;font-size:11px;cursor:pointer;position:relative;z-index:1}.v5-hero-btn svg{vertical-align:middle;margin-left:6px}
    .v5-label{font-size:9px;letter-spacing:1.2px;color:var(--muted,#929da5);font-weight:900;text-transform:uppercase}.v5-section{margin-top:20px}.v5-section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:10px}.v5-section-head h2{font-size:18px;letter-spacing:-.5px;margin:3px 0 0}.v5-link{border:0;background:none;color:var(--accent,#58d0c0);font-size:10px;font-weight:900;cursor:pointer}
    .v5-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.v5-quick-card{min-height:84px;padding:11px 8px;border:1px solid rgba(255,255,255,.075);border-radius:16px;background:rgba(255,255,255,.035);color:var(--text,#fff);text-align:left;cursor:pointer}.v5-quick-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.07);margin-bottom:9px}.v5-quick-card b{display:block;font-size:10px}.v5-quick-card span{display:block;color:var(--muted,#8f9aa2);font-size:8px;margin-top:3px}
    .v5-continue{display:flex;gap:12px;align-items:center;padding:14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.075)}.v5-play{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent,#58d0c0) 18%,transparent);color:var(--accent,#58d0c0);flex:0 0 auto}.v5-continue-copy{flex:1}.v5-continue-copy small{font-size:8px;color:var(--muted,#929da5);font-weight:900;letter-spacing:.8px}.v5-continue-copy b{display:block;font-size:13px;margin-top:3px}.v5-continue-copy span{display:block;color:var(--muted,#929da5);font-size:9px;margin-top:4px}.v5-continue button{border:0;background:var(--accent,#58d0c0);color:#07100f;border-radius:11px;padding:10px 11px;font-size:9px;font-weight:950;cursor:pointer}
    .v5-schedule{display:grid;gap:7px}.v5-schedule-row{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.025);border-radius:15px}.v5-time{width:43px;color:var(--muted,#909ba3);font-size:9px;font-weight:900}.v5-class-icon{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.06);display:grid;place-items:center;color:var(--accent,#58d0c0)}.v5-schedule-copy{flex:1}.v5-schedule-copy b{font-size:10px}.v5-schedule-copy span{display:block;font-size:8px;color:var(--muted,#909ba3);margin-top:2px}.v5-schedule-row button{border:0;background:none;color:var(--accent,#58d0c0);font-size:9px;font-weight:900;cursor:pointer}
    .v5-subjects{display:grid;gap:8px}.v5-subject{border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.025);border-radius:15px;padding:12px;cursor:pointer;color:var(--text,#fff);text-align:left}.v5-subject-top{display:flex;justify-content:space-between;gap:10px;font-size:10px}.v5-subject-top span{color:var(--muted,#929da5);font-size:8px}.v5-track{height:5px;background:rgba(255,255,255,.07);border-radius:99px;margin-top:9px;overflow:hidden}.v5-track i{display:block;height:100%;background:var(--accent,#58d0c0);border-radius:99px}
    .v5-intel{display:flex;gap:11px;padding:14px;border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 15%,transparent);background:color-mix(in srgb,var(--accent,#58d0c0) 5%,transparent);border-radius:17px}.v5-intel-icon{width:37px;height:37px;border-radius:11px;background:color-mix(in srgb,var(--accent,#58d0c0) 13%,transparent);color:var(--accent,#58d0c0);display:grid;place-items:center;flex:0 0 auto}.v5-intel-copy{flex:1}.v5-intel-copy small{font-size:8px;color:var(--accent,#58d0c0);font-weight:900;letter-spacing:.8px}.v5-intel-copy b{display:block;font-size:11px;margin-top:3px}.v5-intel-copy p{font-size:9px;color:var(--muted,#929da5);line-height:1.4;margin:4px 0 0}.v5-intel button{align-self:center;border:0;background:none;color:var(--accent,#58d0c0);font-weight:900;cursor:pointer}
    .v5-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.v5-day{text-align:center;padding:8px 2px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055)}.v5-day span{display:block;color:var(--muted,#929da5);font-size:8px;font-weight:800}.v5-day i{display:block;font-style:normal;font-size:11px;font-weight:900;margin-top:5px}.v5-day.active{background:color-mix(in srgb,var(--accent,#58d0c0) 8%,transparent);border-color:color-mix(in srgb,var(--accent,#58d0c0) 15%,transparent)}.v5-day.today{outline:1px solid var(--accent,#58d0c0)}
    .v5-recovery{display:flex;align-items:center;gap:11px;padding:13px;border-radius:17px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03)}.v5-recovery-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(229,179,87,.11);color:#e5b357}.v5-recovery-copy{flex:1}.v5-recovery-copy small{font-size:8px;color:var(--muted,#929da5);font-weight:900}.v5-recovery-copy b{display:block;font-size:11px;margin-top:3px}.v5-recovery-score{text-align:right}.v5-recovery-score b{font-size:19px}.v5-recovery-score span{display:block;font-size:7px;color:var(--muted,#929da5)}
    .v5-study{display:grid;gap:9px}.v5-study-card{padding:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);border-radius:17px;display:flex;align-items:center;gap:12px}.v5-study-card .v5-play{width:42px;height:42px}.v5-study-card button{margin-left:auto;border:0;background:var(--accent,#58d0c0);color:#07100f;border-radius:10px;padding:9px 11px;font-size:9px;font-weight:950;cursor:pointer}
    .v5-dna-modal{max-width:520px}.v5-dna-modal h2{font-size:22px;margin:5px 0}.v5-dna-modal p{font-size:11px;line-height:1.5;color:var(--muted,#929da5)}.v5-form{display:grid;gap:10px;margin-top:15px}.v5-form label{font-size:9px;color:var(--muted,#929da5);font-weight:900}.v5-form select,.v5-form input{width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:var(--text,#fff)}.v5-form-actions{display:flex;gap:7px;margin-top:5px}.v5-form-actions button{flex:1;border:0;border-radius:11px;padding:11px;font-size:9px;font-weight:900;cursor:pointer}.v5-form-actions .main{background:var(--accent,#58d0c0);color:#07100f}.v5-form-actions .alt{background:rgba(255,255,255,.07);color:var(--text,#fff)}
    @media(max-width:520px){.student-v5{padding-bottom:22px}.v5-welcome h1{font-size:27px}.v5-quick{grid-template-columns:repeat(4,1fr)}.v5-quick-card{min-height:80px}.v5-quick-card span{display:none}.v5-hero{border-radius:20px}.v5-course{margin-bottom:11px}}
  `;

  const quick = [
    { title: 'Lectures', sub: 'Learn', icon: 'play', action: () => setSection('study') },
    { title: 'Practice', sub: 'Questions', icon: 'practice', action: () => props.onGo('practice') },
    { title: 'Tests', sub: 'Mocks', icon: 'test', action: () => props.onGo('mocks') },
    { title: 'Notes', sub: 'Revise', icon: 'note', action: () => props.onGo('saved') },
  ];

  return <>
    <style>{css}</style>
    <div className="student-v5">
      <header className="v5-top">
        <div className="v5-brand"><div className="v5-logo">N</div><b>neet<span>prep</span></b></div>
        <div className="v5-top-actions">
          <button className="v5-iconbtn" onClick={props.onAnnouncements} aria-label="Announcements"><Icon name="bell" size={18} />{props.announcementsCount > 0 && <i className="v5-dot" />}</button>
          <div className="v5-profile">{first.slice(0, 1).toUpperCase()}</div>
        </div>
      </header>

      <section className="v5-welcome">
        <small>NEET UG 2027 · {dna.stage.toUpperCase()}</small>
        <h1>{greeting}, {first} 👋</h1>
        <p>Let's keep today's preparation simple, focused and measurable.</p>
      </section>

      <div className="v5-course">
        <div className="v5-course-badge"><Icon name="book" size={18} /></div>
        <div className="v5-course-copy"><small>MY PREPARATION</small><b>NEET UG 2027 · {dna.stage}</b></div>
        <button onClick={() => setDnaOpen(true)}>EDIT</button>
      </div>

      <section className="v5-hero">
        <div className="v5-hero-row">
          <div><span className="v5-hero-kicker">TODAY'S TARGET</span><h2>{remaining ? `${remaining} questions to go` : "Today's target complete"}</h2><p>{remaining ? 'Finish this small block and keep your streak moving.' : 'Your daily target is done. A short revision session can strengthen weak areas.'}</p></div>
          <div className="v5-progress-ring" style={{ '--p': `${dailyPct}%` } as CSSProperties}><b>{dailyPct}%</b></div>
        </div>
        <button className="v5-hero-btn" onClick={startSmart}>{remaining ? 'Continue preparation' : 'Practice weak areas'} <Icon name="arrow" size={14} /></button>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">QUICK ACCESS</span><h2>Study your way</h2></div><button className="v5-link" onClick={() => setSection('study')}>See all</button></div>
        <div className="v5-quick">{quick.map(item => <button key={item.title} className="v5-quick-card" onClick={item.action}><div className="v5-quick-icon"><Icon name={item.icon} size={18} /></div><b>{item.title}</b><span>{item.sub}</span></button>)}</div>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">CONTINUE LEARNING</span><h2>Pick up where you left off</h2></div></div>
        <div className="v5-continue"><div className="v5-play"><Icon name="play" size={20} /></div><div className="v5-continue-copy"><small>RECOMMENDED SESSION</small><b>{intelligence.subject ? `${intelligence.subject} practice` : 'Daily practice'}</b><span>{props.mistakes.length ? `${Math.min(5, props.mistakes.length)} mistakes need another look` : 'Build your first performance signal'}</span></div><button onClick={startSmart}>START</button></div>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">TODAY'S PLAN</span><h2>Your study schedule</h2></div><button className="v5-link" onClick={() => setSection('study')}>View plan</button></div>
        <div className="v5-schedule">
          <div className="v5-schedule-row"><span className="v5-time">NOW</span><div className="v5-class-icon"><Icon name="practice" size={16} /></div><div className="v5-schedule-copy"><b>{intelligence.subject ? `${intelligence.subject} practice` : 'Daily question practice'}</b><span>10 questions · Focus session</span></div><button onClick={startSmart}>Start</button></div>
          <div className="v5-schedule-row"><span className="v5-time">LATER</span><div className="v5-class-icon"><Icon name="book" size={16} /></div><div className="v5-schedule-copy"><b>Revision block</b><span>{recovery.marks > 0 ? `Review mistakes · +${recovery.marks} marks in play` : 'Review saved concepts'}</span></div><button onClick={() => props.onGo(props.mistakes.length ? 'mistakes' : 'saved')}>Open</button></div>
          <div className="v5-schedule-row"><span className="v5-time">TEST</span><div className="v5-class-icon"><Icon name="test" size={16} /></div><div className="v5-schedule-copy"><b>Mock test centre</b><span>Full-length and chapter tests</span></div><button onClick={() => props.onGo('mocks')}>View</button></div>
        </div>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">SUBJECT PROGRESS</span><h2>How you're doing</h2></div><button className="v5-link" onClick={() => props.onGo('progress')}>Full report</button></div>
        <div className="v5-subjects">{ranked.length ? ranked.map(item => <button className="v5-subject" key={item.subject} onClick={() => props.onPractice(10, `${item.subject} practice`, props.subjectQuestionIds[item.subject])}><div className="v5-subject-top"><b>{item.subject}</b><span>{item.accuracy}% accuracy · {item.attempted} attempted</span></div><div className="v5-track"><i style={{ width: `${item.accuracy}%` }} /></div></button>) : <div className="v5-subject"><div className="v5-subject-top"><b>Start practicing to see your subject report</b><span>10 questions</span></div></div>}</div>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">PREP INTELLIGENCE</span><h2>Your next best move</h2></div></div>
        <div className="v5-intel"><div className="v5-intel-icon"><Icon name="spark" size={18} /></div><div className="v5-intel-copy"><small>{intelligence.priority} PRIORITY</small><b>{intelligence.headline}</b><p>{intelligence.detail}</p></div><button onClick={startSmart}><Icon name="chevron" size={17} /></button></div>
      </section>

      <section className="v5-section">
        <div className="v5-section-head"><div><span className="v5-label">STREAK</span><h2>{props.streakDays ? `${props.streakDays} days in a row` : 'Start your study streak'}</h2></div><span className="v5-label">{xp} XP · LV {level}</span></div>
        <div className="v5-week">{week.map(item => <div key={`${item.label}-${item.today}`} className={`v5-day ${item.count ? 'active' : ''} ${item.today ? 'today' : ''}`}><span>{item.label}</span><i>{item.count || '·'}</i></div>)}</div>
      </section>

      <section className="v5-section">
        <div className="v5-recovery"><div className="v5-recovery-icon"><Icon name="target" size={18} /></div><div className="v5-recovery-copy"><small>MISTAKE REPAIR</small><b>{props.mistakes.length ? `${props.mistakes.length} questions waiting for review` : 'Your improvement book is ready'}</b></div><div className="v5-recovery-score"><b>+{recovery.marks}</b><span>marks in play</span></div></div>
      </section>

      {section === 'study' && <section className="v5-section v5-study"><div className="v5-section-head"><div><span className="v5-label">STUDY CENTRE</span><h2>Everything for today's prep</h2></div><button className="v5-link" onClick={() => setSection('home')}>Close</button></div>{[
        ['Live / recorded classes', 'Watch lessons and revise concepts', 'play'],
        ['Practice modules', 'Topic-wise and adaptive questions', 'practice'],
        ['Test series', 'Chapter, part-syllabus and full mocks', 'test'],
        ['Revision notes', 'Saved concepts and quick review', 'note'],
      ].map(([title, sub, ico]) => <div className="v5-study-card" key={title}><div className="v5-play"><Icon name={ico} size={18} /></div><div className="v5-continue-copy"><b>{title}</b><span>{sub}</span></div><button onClick={ico === 'practice' ? () => props.onGo('practice') : ico === 'test' ? () => props.onGo('mocks') : ico === 'note' ? () => props.onGo('saved') : startSmart}>Open</button></div>)}</section>}

      {dnaOpen && <div className="modal-backdrop" onClick={() => setDnaOpen(false)}><div className="modal-card v5-dna-modal" onClick={e => e.stopPropagation()}><span className="v5-label">MY PREPARATION</span><h2>Set your study profile</h2><p>This helps NEETPrep shape your home screen around your stage and routine.</p><div className="v5-form"><label>PREPARATION STAGE<select value={dna.stage} onChange={e => setDna({ ...dna, stage: e.target.value as PrepDNA['stage'] })}><option>Class 11</option><option>Class 12</option><option>Dropper</option></select></label><label>COACHING<select value={dna.coaching} onChange={e => setDna({ ...dna, coaching: e.target.value as PrepDNA['coaching'] })}><option>Offline coaching</option><option>Online coaching</option><option>Hybrid</option><option>Self study</option></select></label><label>DAILY STUDY HOURS<input type="range" min="1" max="14" value={dna.hours} onChange={e => setDna({ ...dna, hours: Number(e.target.value) })} /><span style={{ display:'block', textAlign:'right', fontSize:9, color:'var(--accent,#58d0c0)' }}>{dna.hours} hours</span></label><label>BEST FOCUS WINDOW<select value={dna.focus} onChange={e => setDna({ ...dna, focus: e.target.value as PrepDNA['focus'] })}><option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label><div className="v5-form-actions"><button className="alt" onClick={() => setDnaOpen(false)}>Cancel</button><button className="main" onClick={saveDNA}>Save profile</button></div></div></div></div>}
    </div>
  </>;
}
