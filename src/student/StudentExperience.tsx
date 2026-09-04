import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { buildPrepIntelligence, type Subject, type SubjectStats } from './prepIntelligence';

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

function icon(name: string) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'target') return <svg {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>;
  if (name === 'bolt') return <svg {...p}><path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/></svg>;
  if (name === 'flame') return <svg {...p}><path d="M12 21c4 0 7-2.7 7-6.6 0-3.4-2.2-5.9-4.4-8.4-.2 2-1 3.3-2.1 4.3.2-3.5-1.8-6.1-4.2-8.3.1 3.5-3.3 5.7-3.3 10.2C5 18 8 21 12 21Z"/></svg>;
  if (name === 'chart') return <svg {...p}><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></svg>;
  if (name === 'book') return <svg {...p}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5Z"/><path d="M5 4.5v17M9 6h7M9 10h7"/></svg>;
  if (name === 'spark') return <svg {...p}><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Z"/><path d="m19 14 .6 2.1L22 17l-2.4.9L19 20l-.6-2.1L16 17l2.4-.9L19 14Z"/></svg>;
  if (name === 'clock') return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  return <svg {...p}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StudentExperience(props: Props) {
  const [dna, setDna] = useState<PrepDNA>(() => load<PrepDNA>(DNA_KEY, { stage: 'Dropper', coaching: 'Offline coaching', hours: 6, focus: 'Evening' }));
  const [dnaOpen, setDnaOpen] = useState(false);
  const [missions, setMissions] = useState<Record<string, boolean>>(() => load<Record<string, boolean>>(MISSION_KEY, {}));
  const [moreOpen, setMoreOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);

  const intelligence = useMemo(() => buildPrepIntelligence(props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target), [props.stats, props.mistakes.length, props.today, props.dailyGoal, props.target]);

  const firstName = props.user?.user_metadata?.display_name || props.user?.email?.split('@')[0] || 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const remaining = Math.max(0, props.dailyGoal - props.today);
  const weak = useMemo(() => (Object.entries(props.stats) as Array<[Subject, Stats[Subject]]>)
    .filter(([, s]) => s.attempted > 0)
    .sort((a, b) => (a[1].correct / a[1].attempted) - (b[1].correct / b[1].attempted))[0], [props.stats]);
  const recoveryMarks = Math.min(100, props.mistakes.length * 5);
  const level = Math.max(1, Math.floor((props.totalAnswered + props.today * 2 + props.streakDays * 10) / 100) + 1);
  const xp = props.totalAnswered * 5 + props.today * 3 + props.streakDays * 12;
  const xpIntoLevel = xp % 500;
  const xpPct = Math.min(100, Math.round(xpIntoLevel / 5));

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count: props.activity[dayKey(d)] ?? 0, today: index === 6 };
  }), [props.activity]);

  const toggleMission = (id: string) => {
    const next = { ...missions, [id]: !missions[id] };
    setMissions(next);
    save(MISSION_KEY, next);
  };

  const startQuick = (count: number, title: string, ids?: string[]) => props.onPractice(count, title, ids);
  const startSmart = () => {
    if (intelligence.action === 'repair' && props.mistakes.length) {
      startQuick(Math.min(10, props.mistakes.length), `${intelligence.subject ?? 'Mistake'} repair`, props.mistakes);
      return;
    }
    if (intelligence.subject) {
      startQuick(10, `${intelligence.subject} focus`, props.subjectQuestionIds[intelligence.subject]);
      return;
    }
    startQuick(10, 'First signal');
  };

  const persistDNA = () => {
    save(DNA_KEY, dna);
    setDnaOpen(false);
  };

  const v2Css = `
    .os-intel-card{margin:18px 0;padding:20px;border:1px solid color-mix(in srgb,var(--accent,#58d0c0) 28%,transparent);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));box-shadow:0 18px 50px rgba(0,0,0,.18);cursor:pointer;overflow:hidden;position:relative}
    .os-intel-card:before{content:"";position:absolute;inset:-60px auto auto -40px;width:150px;height:150px;border-radius:50%;background:var(--accent,#58d0c0);opacity:.10;filter:blur(30px);pointer-events:none}
    .os-intel-top,.os-intel-footer,.os-intel-main{display:flex;align-items:center;justify-content:space-between;gap:14px}
    .os-intel-main{align-items:flex-start;margin-top:10px}.os-intel-main h2{margin:0;font-size:24px;letter-spacing:-.6px}.os-intel-main p{margin:7px 0 0;color:var(--muted,#94a0ad);line-height:1.5;font-size:13px;max-width:520px}
    .os-intel-live{font-size:9px;letter-spacing:1.3px;padding:6px 9px;border-radius:999px;background:rgba(88,208,192,.11);color:var(--accent,#58d0c0);font-weight:800}
    .os-intel-score{min-width:68px;text-align:right}.os-intel-score strong{display:block;font-size:28px;letter-spacing:-1px}.os-intel-score small{color:var(--muted,#94a0ad);font-size:10px}
    .os-intel-footer{margin-top:17px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:var(--muted,#94a0ad)}.os-intel-footer button{border:0;background:none;color:var(--text,#fff);font-weight:800;cursor:pointer}
    .os-intel-modal{max-width:520px}.os-intel-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:22px 0}.os-intel-metrics div{padding:13px;border-radius:16px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}.os-intel-metrics small,.os-intel-reason span{display:block;font-size:9px;letter-spacing:1.2px;color:var(--muted,#94a0ad);font-weight:800}.os-intel-metrics strong{display:block;margin-top:5px;font-size:17px}.os-intel-reason{padding:15px;border-radius:18px;background:rgba(88,208,192,.07);border:1px solid rgba(88,208,192,.14);margin-bottom:18px}.os-intel-reason b{display:block;margin-top:7px;line-height:1.5;font-size:13px}
    @media(max-width:520px){.os-intel-card{border-radius:22px;padding:17px}.os-intel-main h2{font-size:20px}.os-intel-main p{font-size:12px}.os-intel-score{min-width:55px}.os-intel-score strong{font-size:23px}.os-intel-footer{align-items:flex-start}.os-intel-metrics{grid-template-columns:1fr 1fr}.os-intel-metrics div:last-child{grid-column:1/-1}}
  `;

  return <>
    <style>{v2Css}</style>
    <div className="student-os">
      <section className="os-hero">
        <div>
          <div className="os-eyebrow"><span className="os-pulse" /> {greeting}, {String(firstName).split(' ')[0]}</div>
          <h1>Your prep.<br /><em>in motion.</em></h1>
          <p>{remaining > 0 ? `${remaining} questions left in today's mission.` : "Today's mission is complete. Your momentum is protected."}</p>
        </div>
        <button className="os-dna-button" onClick={() => setDnaOpen(true)}><span className="os-dna-ring">✦</span><small>PREP DNA</small></button>
      </section>

      <section className="os-command-card">
        <div className="os-command-top"><div><span className="os-kicker">TODAY'S MISSION</span><strong>{props.today >= props.dailyGoal ? 'Mission complete.' : `${props.dailyGoal} questions.`}</strong><p>{props.today >= props.dailyGoal ? 'You did the important part. Keep the streak clean.' : 'A compact, high-signal session built around consistency.'}</p></div><div className="os-ring" style={{ '--p': `${Math.min(100, Math.round((props.today / props.dailyGoal) * 100))}%` } as CSSProperties}><span>{Math.min(100, Math.round((props.today / props.dailyGoal) * 100))}%</span></div></div>
        <button className="os-primary" onClick={() => startQuick(props.dailyGoal, 'Daily Mission')}><span>{props.today >= props.dailyGoal ? 'Run another set' : 'Enter mission'}</span>{icon('arrow')}</button>
      </section>

      <section className="os-intel-card" onClick={() => setIntelligenceOpen(true)}>
        <div className="os-intel-top"><span className="os-kicker">PREP INTELLIGENCE · V2</span><span className="os-intel-live">LIVE SIGNAL</span></div>
        <div className="os-intel-main"><div><h2>{intelligence.headline}</h2><p>{intelligence.detail}</p></div><div className="os-intel-score"><strong>{intelligence.subject ? `${intelligence.accuracy}%` : '—'}</strong><small>{intelligence.subject ? intelligence.subject : 'Need data'}</small></div></div>
        <div className="os-intel-footer"><span>{intelligence.recoveryMarks > 0 ? `+${intelligence.recoveryMarks} marks recoverable` : 'Signal building from your answers'}</span><button onClick={(e) => { e.stopPropagation(); startSmart(); }}>Start smart →</button></div>
      </section>

      <section className="os-recovery">
        <div className="os-recovery-icon">{icon('bolt')}</div>
        <div className="os-recovery-copy"><span className="os-kicker">MARKS YOU CAN RECOVER</span><strong>+{recoveryMarks} marks</strong><p>{props.mistakes.length ? `${props.mistakes.length} mistakes are waiting to become correct answers.` : 'Your first mistake will become a future mark to recover.'}</p></div>
        <button onClick={() => props.onGo('mistakes')}>{props.mistakes.length ? 'Fix now' : 'Open'} <b>→</b></button>
      </section>

      <section className="os-section">
        <div className="os-section-head"><div><span className="os-kicker">YOUR WEEK</span><h2>Momentum map.</h2></div><span className="os-week-stat">{props.streakDays} day streak</span></div>
        <div className="os-week"><div className="os-week-lines"><i/><i/><i/><i/></div>{week.map(day => <div className="os-day" key={day.label + day.count}><span>{day.label}</span><b className={day.count > 0 ? 'filled' : ''} style={{ '--h': `${Math.min(100, 16 + day.count * 3)}%` } as CSSProperties}>{day.count > 0 && <small>{day.count}</small>}</b></div>)}</div>
      </section>

      <section className="os-section">
        <div className="os-section-head"><div><span className="os-kicker">MICRO WINS</span><h2>Today's three.</h2></div><span className="os-micro-count">{Object.values(missions).filter(Boolean).length}/3</span></div>
        <div className="os-missions">
          <button className={missions.q ? 'done' : ''} onClick={() => toggleMission('q')}><span className="os-check">{missions.q ? '✓' : '01'}</span><span><b>Question sprint</b><small>{props.today}/{props.dailyGoal} questions today</small></span><em>{missions.q ? 'DONE' : '10 min'}</em></button>
          <button className={missions.m ? 'done' : ''} onClick={() => toggleMission('m')}><span className="os-check">{missions.m ? '✓' : '02'}</span><span><b>Repair a mistake</b><small>{props.mistakes.length ? `${props.mistakes.length} in your bank` : 'Build your first mistake'}</small></span><em>{missions.m ? 'DONE' : '5 min'}</em></button>
          <button className={missions.p ? 'done' : ''} onClick={() => toggleMission('p')}><span className="os-check">{missions.p ? '✓' : '03'}</span><span><b>Read your signal</b><small>{props.totalAnswered ? `${props.overallAccuracy}% overall accuracy` : 'Answer questions to unlock'}</small></span><em>{missions.p ? 'DONE' : '2 min'}</em></button>
        </div>
      </section>

      <section className="os-section">
        <div className="os-section-head"><div><span className="os-kicker">FAST LANES</span><h2>Choose your move.</h2></div><button className="os-text-button" onClick={() => setMoreOpen(true)}>All tools →</button></div>
        <div className="os-lanes">
          <button onClick={() => startQuick(10, 'Focus Sprint')}><span className="os-lane-icon violet">{icon('target')}</span><span><b>Focus sprint</b><small>10 high-signal questions</small></span>{icon('arrow')}</button>
          <button onClick={() => props.onGo('mistakes')}><span className="os-lane-icon coral">{icon('flame')}</span><span><b>Repair mistakes</b><small>{props.mistakes.length} waiting</small></span>{icon('arrow')}</button>
          <button onClick={() => props.onGo('mocks')}><span className="os-lane-icon blue">{icon('clock')}</span><span><b>Exam simulation</b><small>CBT · timed · review</small></span>{icon('arrow')}</button>
          <button onClick={() => props.onGo('progress')}><span className="os-lane-icon mint">{icon('chart')}</span><span><b>Read my signal</b><small>{props.overallAccuracy}% accuracy</small></span>{icon('arrow')}</button>
        </div>
      </section>

      <section className="os-insight">
        <div className="os-insight-icon">{icon('spark')}</div>
        <div><span className="os-kicker">PERSONAL SIGNAL</span><strong>{weak ? `${weak[0]} is your current repair lane.` : 'Your dashboard is learning you.'}</strong><p>{weak ? `You're at ${Math.round(weak[1].correct / weak[1].attempted * 100)}% accuracy here. A short targeted session is likely more useful than another random set.` : 'Complete your first 10 questions and NEETPrep will start identifying where your marks are leaking.'}</p></div>
        <button onClick={() => weak ? startQuick(10, `${weak[0]} repair`) : startQuick(10, 'First signal')}>Act →</button>
      </section>

      <section className="os-section os-last">
        <div className="os-section-head"><div><span className="os-kicker">COACHING CONNECTION</span><h2>Never miss the signal.</h2></div></div>
        <button className="os-announcement" onClick={props.onAnnouncements}><span>{icon('spark')}</span><span><b>{props.announcementsCount ? `${props.announcementsCount} teacher update${props.announcementsCount > 1 ? 's' : ''}` : 'Teacher updates'}</b><small>{props.announcementsCount ? 'Open your coaching inbox' : 'DPP releases, schedule changes and notices'}</small></span><b>→</b></button>
      </section>

      <section className="os-level-card">
        <div><span className="os-kicker">LEVEL {level}</span><strong>Prep momentum</strong><p>{xp} XP earned through your work.</p></div>
        <div className="os-level-track"><i style={{ width: `${xpPct}%` }} /></div><small>{xpIntoLevel}/500 XP to next level</small>
      </section>
    </div>

    {intelligenceOpen && <div className="os-backdrop" onMouseDown={() => setIntelligenceOpen(false)}><div className="os-modal os-intel-modal" onMouseDown={e => e.stopPropagation()}><button className="os-close" onClick={() => setIntelligenceOpen(false)}>×</button><span className="os-kicker">PREP INTELLIGENCE</span><h2>Your next best move.</h2><p>NEETPrep V2 turns your recent performance into a practical recommendation. No mystical AI fog machine required.</p><div className="os-intel-metrics"><div><small>REPAIR LANE</small><strong>{intelligence.subject ?? 'Building signal'}</strong></div><div><small>ACCURACY</small><strong>{intelligence.subject ? `${intelligence.accuracy}%` : '—'}</strong></div><div><small>RECOVERABLE</small><strong>+{intelligence.recoveryMarks}</strong></div></div><div className="os-intel-reason"><span>WHY THIS</span><b>{intelligence.detail}</b></div><button className="os-primary full" onClick={startSmart}>Run recommended session</button></div></div>}

    {dnaOpen && <div className="os-backdrop" onMouseDown={() => setDnaOpen(false)}><div className="os-modal" onMouseDown={e => e.stopPropagation()}><button className="os-close" onClick={() => setDnaOpen(false)}>×</button><span className="os-kicker">PREP DNA</span><h2>Tell us how you prepare.</h2><p>NEETPrep uses this to shape your daily rhythm. You can change it anytime.</p><label>Stage<select value={dna.stage} onChange={e => setDna({ ...dna, stage: e.target.value as PrepDNA['stage'] })}><option>Class 11</option><option>Class 12</option><option>Dropper</option></select></label><label>Coaching<select value={dna.coaching} onChange={e => setDna({ ...dna, coaching: e.target.value as PrepDNA['coaching'] })}><option>Offline coaching</option><option>Online coaching</option><option>Hybrid</option><option>Self study</option></select></label><label>Focused study hours <input type="range" min="1" max="14" value={dna.hours} onChange={e => setDna({ ...dna, hours: Number(e.target.value) })}/><span className="os-range-value">{dna.hours}h / day</span></label><label>Best focus window<select value={dna.focus} onChange={e => setDna({ ...dna, focus: e.target.value as PrepDNA['focus'] })}><option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label><div className="os-modal-preview"><span>YOUR RHYTHM</span><strong>{dna.hours}h · {dna.focus.toLowerCase()} · {dna.coaching}</strong></div><button className="os-primary full" onClick={persistDNA}>Save my Prep DNA</button></div></div>}

    {moreOpen && <div className="os-backdrop" onMouseDown={() => setMoreOpen(false)}><div className="os-tool-sheet" onMouseDown={e => e.stopPropagation()}><button className="os-close" onClick={() => setMoreOpen(false)}>×</button><span className="os-kicker">NEETPREP TOOLKIT</span><h2>Your prep, one place.</h2><div className="os-tool-grid"><button onClick={() => { setMoreOpen(false); props.onGo('practice'); }}><span>{icon('book')}</span><b>Question library</b><small>{props.questionIds.length} questions</small></button><button onClick={() => { setMoreOpen(false); props.onGo('saved'); }}><span>◇</span><b>Saved</b><small>{props.saved.length} bookmarked</small></button><button onClick={() => { setMoreOpen(false); props.onGo('mistakes'); }}><span>{icon('bolt')}</span><b>Mistake repair</b><small>{props.mistakes.length} to fix</small></button><button onClick={() => { setMoreOpen(false); props.onGo('progress'); }}><span>{icon('chart')}</span><b>Performance</b><small>Accuracy & history</small></button><button onClick={() => { setMoreOpen(false); startQuick(10, 'Challenge'); }}><span>{icon('spark')}</span><b>Challenge</b><small>10 question sprint</small></button><button onClick={() => { setMoreOpen(false); props.onGo('mocks'); }}><span>{icon('clock')}</span><b>Mock lab</b><small>Build a CBT test</small></button></div><div className="os-next-tools"><span>COMING NEXT</span><b>NCERT Mode · Flashcards · Study Planner · Doubt Center · Rank Predictor</b></div></div></div>}
  </>;
}
