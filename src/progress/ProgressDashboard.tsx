import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { QUESTIONS } from '../data/questions';

type Subject = 'Physics' | 'Chemistry' | 'Biology';
type Answer = { question_id: string; selected_index: number; is_correct: boolean; subject: Subject; answeredAt: number };
type Result = { title: string; ids: string[]; answers: Record<string, number>; startedAt: number; finishedAt: number };
type Props = { demo?: boolean; onClose?: () => void };
const subjects: Subject[] = ['Physics', 'Chemistry', 'Biology'];
const tones: Record<Subject, string> = { Physics: '#62a8ff', Chemistry: '#57d2c2', Biology: '#a487ff' };

function read<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function keyOf(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<string, ReactNode> = {
    back: <><path d="M15 6 9 12l6 6"/><path d="M9 12h10"/></>,
    spark: <path d="m12 2 1.6 5.2L19 9l-5.4 2-1.6 5-1.6-5L5 9l5.4-1.8L12 2Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
    flame: <path d="M12 21c4 0 7-2.7 7-6.5 0-3.4-2.1-5.8-4.3-8.5-.2 1.8-.9 3.3-2.1 4.4.1-3.5-1.8-6.1-4.2-8.4.1 3.5-3.4 5.8-3.4 10.2C5 18 8 21 12 21Z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></>,
    book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22Z"/><path d="M5 4.5V22"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    arrow: <><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.chart}</svg>;
}
function scoreFor(result: Result) {
  let correct = 0; let incorrect = 0;
  result.ids.forEach(id => { const q = QUESTIONS.find(item => item.id === id); if (!q || q.status === 'dropped') return; const answer = result.answers[id]; if (answer == null) return; const accepted = q.correct_indices ?? (q.correct_index == null ? [0] : [q.correct_index]); accepted.includes(answer) ? correct++ : incorrect++; });
  return { correct, incorrect, score: correct * 4 - incorrect };
}

export default function ProgressDashboard({ demo = false, onClose }: Props) {
  const [range, setRange] = useState<'7D' | '30D' | 'ALL'>('30D');
  const [name, setName] = useState(demo ? 'Arpit' : 'Student');
  const [target, setTarget] = useState(650);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [daily, setDaily] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);

  useEffect(() => {
    setTarget(Number(localStorage.getItem('neetprep-target-v3') || 650));
    setAnswers(read('neetprep-answer-history-v1', []));
    setResults(read('neetprep-results-v3', []));
    setDaily(read('neetprep-daily-v3', {}));
    setSaved(read('neetprep-saved-v3', []));
    setMistakes(read('neetprep-mistakes-v3', []));
    void supabase.auth.getSession().then(({ data }) => { if (!demo) setName(data.session?.user?.user_metadata?.display_name || data.session?.user?.email?.split('@')[0] || 'Student'); });
  }, [demo]);

  const filtered = useMemo(() => range === 'ALL' ? answers : answers.filter(a => a.answeredAt >= Date.now() - (range === '7D' ? 7 : 30) * 86400000), [answers, range]);
  const total = filtered.length;
  const correct = filtered.filter(a => a.is_correct).length;
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  const subjectStats = useMemo(() => subjects.map(subject => { const rows = filtered.filter(a => a.subject === subject); const ok = rows.filter(a => a.is_correct).length; return { subject, attempted: rows.length, accuracy: rows.length ? Math.round(ok / rows.length * 100) : 0 }; }), [filtered]);
  const streak = useMemo(() => { let n = 0; const d = new Date(); while ((daily[keyOf(d)] ?? 0) > 0) { n++; d.setDate(d.getDate() - 1); } return n; }, [daily]);
  const activeDays = Object.values(daily).filter(v => v > 0).length;
  const testHistory = useMemo(() => [...results].sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 8), [results]);
  const latestScore = testHistory[0] ? scoreFor(testHistory[0]).score : null;
  const readiness = demo ? 82 : Math.max(0, Math.min(100, Math.round(accuracy * 0.55 + Math.min(100, total / 150 * 100) * 0.25 + Math.min(100, streak / 14 * 100) * 0.2)));
  const gap = latestScore == null ? null : Math.max(0, target - latestScore);
  const trend = useMemo(() => testHistory.slice().reverse().map(test => { const s = scoreFor(test); const max = Math.max(1, test.ids.length * 4); return Math.max(0, Math.round((s.score / max) * 100)); }), [testHistory]);
  const trendValues = demo && trend.length < 4 ? [54, 58, 61, 64, 62, 69, 72, 76, 79] : (trend.length ? trend : [accuracy, accuracy, accuracy]);
  const chapterWeakness = useMemo(() => { const map: Record<string, { subject: Subject; attempted: number; correct: number }> = {}; filtered.forEach(answer => { const q = QUESTIONS.find(item => item.id === answer.question_id); if (!q) return; const chapter = q.chapter || answer.subject; map[chapter] ||= { subject: answer.subject, attempted: 0, correct: 0 }; map[chapter].attempted++; if (answer.is_correct) map[chapter].correct++; }); return Object.entries(map).map(([chapter, x]) => ({ chapter, ...x, accuracy: Math.round(x.correct / x.attempted * 100) })).sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted).slice(0, 5); }, [filtered]);
  const activity = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return { label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), value: daily[keyOf(d)] ?? 0 }; });
  const maxActivity = Math.max(1, ...activity.map(x => x.value));
  const points = trendValues.map((value, i) => `${(i / Math.max(1, trendValues.length - 1)) * 100},${100 - value}`).join(' ');
  const goPractice = () => { onClose?.(); window.location.href = '/'; };

  return <div className="progress-page">
    <div className="progress-background" />
    <header className="progress-nav"><button className="progress-icon" onClick={onClose ?? (() => window.history.back())} aria-label="Back"><Icon name="back" /></button><div className="progress-nav-title"><b>Progress</b><span>Your preparation at a glance</span></div><button className="progress-icon" onClick={goPractice} aria-label="Focus"><Icon name="spark" /></button></header>
    <main className="progress-content">
      <div className="progress-range">{(['7D', '30D', 'ALL'] as const).map(item => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item === 'ALL' ? 'All time' : item}</button>)}</div>
      <section className="progress-hero-grid">
        <article className="progress-hero"><span>PERSONAL PREPARATION</span><h1>{name}, here’s where<br />you stand.</h1><p>Your progress is more than a score. Track consistency, accuracy, subject mastery and the areas that deserve your next hour.</p><div className="progress-actions"><button onClick={goPractice}>Practice next <Icon name="arrow" size={16} /></button><button onClick={() => setRange('ALL')}>See details</button></div></article>
        <article className="readiness-card"><span>Preparation readiness</span><div className="readiness-ring" style={{ '--readiness': `${readiness * 3.6}deg` } as Record<string, string}}><div><b>{readiness}%</b><small>READY</small></div></div><p>{readiness < 50 ? 'Build consistency first.' : readiness < 80 ? 'Strong base. Keep closing gaps.' : 'Excellent momentum. Protect it.'}</p></article>
      </section>
      <section className="progress-stats">{[
        ['Questions', String(total || (demo ? 240 : 0)), 'answered in this period', 'check'],
        ['Accuracy', `${accuracy || (demo ? 72 : 0)}%`, `${correct || (demo ? 173 : 0)} correct answers`, 'target'],
        ['Study rhythm', `${streak} day${streak === 1 ? '' : 's'}`, `${activeDays} active days tracked`, 'flame'],
        ['Target', String(target), gap == null ? 'Keep building your score' : `${gap} marks to go`, 'spark'],
      ].map(([label, value, sub, icon]) => <article className="progress-stat" key={label}><div><span>{label}</span><i><Icon name={icon} size={15} /></i></div><b>{value}</b><small>{sub}</small></article>)}</section>
      <section className="progress-columns">
        <article className="progress-card"><div className="card-heading"><div><h2>Performance trend</h2><p>Test performance over time</p></div><em>{trendValues.length > 1 ? `${trendValues[trendValues.length - 1] - trendValues[0] >= 0 ? '+' : ''}${trendValues[trendValues.length - 1] - trendValues[0]} pts` : '—'}</em></div><div className="trend-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2196ff" stopOpacity=".35"/><stop offset="1" stopColor="#2196ff" stopOpacity="0"/></linearGradient></defs><polyline points={`0,100 ${points} 100,100`} fill="url(#pg)" stroke="none"/><polyline points={points} fill="none" stroke="#5eb0ff" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg></div></article>
        <article className="progress-card"><div className="card-heading"><div><h2>Subject mastery</h2><p>Accuracy by subject</p></div></div><div className="subject-list">{subjectStats.map(row => <div className="subject-row" key={row.subject}><div className="subject-dot" style={{ background: tones[row.subject] }} /><div><b>{row.subject}</b><small>{row.attempted} questions</small></div><strong>{row.accuracy}%</strong><div className="subject-bar"><i style={{ width: `${row.accuracy}%`, background: tones[row.subject] }} /></div></div>)}</div></article>
      </section>
      <section className="progress-columns">
        <article className="progress-card"><div className="card-heading"><div><h2>Study rhythm</h2><p>Your last 14 days</p></div><span>{streak} day streak</span></div><div className="activity-chart">{activity.map(item => <div className="activity-day" key={`${item.label}-${item.value}`}><div><i style={{ height: `${Math.max(10, item.value / maxActivity * 100)}%` }} /></div><small>{item.label}</small></div>)}</div></article>
        <article className="progress-card"><div className="card-heading"><div><h2>Weakest chapters</h2><p>Where your next hour matters most</p></div></div><div className="weak-list">{chapterWeakness.length ? chapterWeakness.map(row => <button key={row.chapter} onClick={goPractice}><span><i style={{ background: tones[row.subject] }} />{row.chapter}</span><strong>{row.accuracy}%</strong><Icon name="arrow" size={14} /></button>) : <div className="empty-copy">Answer more questions to unlock chapter-level insight.</div>}</div></article>
      </section>
      <section className="progress-columns">
        <article className="progress-card"><div className="card-heading"><div><h2>Recent tests</h2><p>Your latest full attempts</p></div><b>{testHistory.length} saved</b></div>{testHistory.length ? <div className="test-list">{testHistory.slice(0, 4).map((test, i) => { const s = scoreFor(test); return <div className="test-row" key={`${test.title}-${i}`}><div className="test-number">{i + 1}</div><div><b>{test.title}</b><small>{new Date(test.finishedAt).toLocaleDateString()}</small></div><strong>{s.score}</strong></div>; })}</div> : <div className="empty-copy">Complete a test to start your performance history.</div>}</article>
        <article className="progress-card"><div className="card-heading"><div><h2>Revision load</h2><p>Keep the recovery loop small</p></div></div><div className="revision-hero"><div className="revision-number">{mistakes.length}</div><div><b>mistakes to revisit</b><span>Saved: {saved.length} · Target: {target}</span></div></div><button className="revision-button" onClick={goPractice}>Review mistakes <Icon name="arrow" size={15} /></button></article>
      </section>
    </main>
    <style>{progressStyles}</style>
  </div>;
}

const progressStyles = `
.progress-page{position:fixed;inset:0;z-index:10000;overflow-y:auto;overflow-x:hidden;background:#080c10;color:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}.progress-background{position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 560px at 86% -10%,rgba(10,132,255,.18),transparent 67%),radial-gradient(760px 520px at -6% 35%,rgba(100,90,255,.10),transparent 70%),linear-gradient(180deg,#080c10,#0b1015 62%,#070a0d)}.progress-nav{position:sticky;top:0;z-index:20;height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 max(16px,calc((100% - 1360px)/2));background:rgba(8,12,16,.74);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%)}.progress-icon{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:#f4f7f9;display:grid;place-items:center}.progress-nav-title{position:absolute;left:50%;transform:translateX(-50%);text-align:center}.progress-nav-title b{font-size:16px}.progress-nav-title span{display:block;color:#8e9ba4;font-size:10px;margin-top:3px}.progress-content{position:relative;width:min(1360px,calc(100% - 36px));margin:0 auto;padding:30px 0 120px}.progress-range{display:flex;gap:4px;width:max-content;padding:4px;border-radius:16px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);margin:0 0 18px}.progress-range button{border:0;background:transparent;color:#89959d;border-radius:12px;padding:10px 18px;font-weight:700;font-size:11px}.progress-range button.active{background:rgba(255,255,255,.12);color:#f6f8f9;box-shadow:inset 0 1px rgba(255,255,255,.07)}.progress-hero-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.78fr);gap:18px}.progress-hero,.readiness-card,.progress-card,.progress-stat{border:1px solid rgba(255,255,255,.11);background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.027));box-shadow:0 26px 80px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.09);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%)}.progress-hero{min-height:330px;border-radius:38px;padding:46px}.progress-hero>span{font-size:10px;letter-spacing:.16em;color:#76c2ff;font-weight:800}.progress-hero h1{font-size:clamp(48px,6vw,82px);line-height:.92;letter-spacing:-5px;margin:14px 0 18px}.progress-hero p{max-width:830px;color:#a5b1b8;line-height:1.6;font-size:15px}.progress-actions{display:flex;gap:10px;margin-top:28px}.progress-actions button,.revision-button{border:1px solid rgba(255,255,255,.10);border-radius:15px;padding:13px 18px;background:rgba(255,255,255,.06);color:#f5f7f9;font-weight:750;display:flex;align-items:center;gap:9px}.progress-actions button:first-child,.revision-button{background:#0a84ff;border-color:transparent;box-shadow:0 16px 36px rgba(10,132,255,.25),inset 0 1px rgba(255,255,255,.25)}.readiness-card{border-radius:38px;min-height:330px;padding:27px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}.readiness-card>span{font-size:13px;color:#a1acb2;font-weight:700}.readiness-ring{--readiness:180deg;width:180px;height:180px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#5d68ff var(--readiness),rgba(255,255,255,.09) 0);position:relative;box-shadow:0 25px 55px rgba(0,0,0,.24)}.readiness-ring:before{content:"";position:absolute;inset:9px;border-radius:50%;background:#101820;box-shadow:inset 0 1px rgba(255,255,255,.08)}.readiness-ring>div{position:relative;display:grid;place-items:center}.readiness-ring b{font-size:38px;letter-spacing:-2px}.readiness-ring small{margin-top:2px;color:#87959e;font-size:9px;letter-spacing:.12em}.readiness-card p{font-size:11px;color:#89969e}.progress-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.progress-stat{min-height:136px;border-radius:25px;padding:18px 20px}.progress-stat>div{display:flex;align-items:center;justify-content:space-between;color:#95a1a9;font-size:10px;font-weight:700}.progress-stat i{width:34px;height:34px;border-radius:11px;background:rgba(10,132,255,.10);color:#79bfff;display:grid;place-items:center;font-style:normal}.progress-stat>b{display:block;font-size:32px;letter-spacing:-1.6px;margin-top:14px}.progress-stat>small{font-size:9px;color:#7f8c94}.progress-columns{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:16px;margin-top:16px}.progress-card{border-radius:31px;padding:26px}.card-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:18px}.card-heading h2{font-size:20px;letter-spacing:-.8px;margin:0}.card-heading p{font-size:10px;color:#86939b;margin:5px 0 0}.card-heading em,.card-heading>b,.card-heading>span{font-size:10px;color:#71c891;background:rgba(60,190,120,.11);padding:8px 10px;border-radius:10px;font-style:normal}.trend-chart{height:270px;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,rgba(10,132,255,.08),transparent);border:1px solid rgba(255,255,255,.04)}.trend-chart svg{width:100%;height:100%}.subject-list,.weak-list,.test-list{display:grid;gap:10px}.subject-row{display:grid;grid-template-columns:11px 1fr auto;gap:11px;align-items:center;padding:13px 14px;border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.065)}.subject-dot{width:8px;height:8px;border-radius:50%}.subject-row b,.test-row b{font-size:13px}.subject-row small,.test-row small{display:block;color:#7f8d95;font-size:9px;margin-top:3px}.subject-row>strong{font-size:15px}.subject-bar{grid-column:2/-1;height:4px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}.subject-bar i{display:block;height:100%;border-radius:inherit}.activity-chart{height:190px;display:grid;grid-template-columns:repeat(14,1fr);gap:6px;align-items:end}.activity-day{height:100%;display:grid;grid-template-rows:1fr auto;gap:8px}.activity-day>div{position:relative;display:flex;align-items:end;justify-content:center;padding:0 4px}.activity-day i{display:block;width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#69b8ff,#0a84ff);box-shadow:0 8px 20px rgba(10,132,255,.18)}.activity-day small{color:#738089;font-size:9px;text-align:center}.weak-list button{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);border-radius:17px;padding:14px;display:grid;grid-template-columns:1fr auto 18px;align-items:center;gap:10px;color:#f2f5f6;text-align:left}.weak-list button:hover,.test-row:hover,.subject-row:hover{background:rgba(255,255,255,.075)}.weak-list button span{display:flex;align-items:center;gap:9px;font-size:12px}.weak-list button span i{width:8px;height:8px;border-radius:50%}.weak-list strong{font-size:12px;color:#ff9a9a}.test-row{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:10px;padding:12px 14px;border-radius:17px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.065)}.test-number{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:rgba(10,132,255,.10);color:#7fc4ff;font-weight:800}.test-row>strong{font-size:18px}.revision-hero{display:flex;align-items:center;gap:15px;padding:20px;border-radius:22px;background:linear-gradient(135deg,rgba(10,132,255,.11),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.07)}.revision-number{font-size:46px;font-weight:800;letter-spacing:-3px}.revision-hero b{display:block;font-size:14px}.revision-hero span{display:block;font-size:10px;color:#7f8d95;margin-top:5px}.revision-button{margin-top:14px;width:100%;justify-content:center}.empty-copy{padding:30px 10px;text-align:center;color:#7e8a92;font-size:11px;line-height:1.6}
@media(max-width:900px){.progress-content{width:calc(100% - 24px)}.progress-hero-grid,.progress-columns{grid-template-columns:1fr}.progress-stats{grid-template-columns:1fr 1fr}.progress-hero{padding:32px}.progress-hero h1{font-size:50px}.readiness-card{min-height:280px}.progress-nav{height:68px}.progress-card{padding:20px}}
@media(max-width:560px){.progress-content{width:calc(100% - 14px);padding-top:18px}.progress-nav{height:62px}.progress-icon{width:40px;height:40px}.progress-hero{padding:24px;border-radius:28px;min-height:310px}.progress-hero h1{font-size:40px;letter-spacing:-2.8px}.readiness-card{border-radius:28px;min-height:260px}.readiness-ring{width:145px;height:145px}.progress-stats{gap:8px}.progress-stat{min-height:110px;padding:14px;border-radius:20px}.progress-stat>b{font-size:27px}.progress-columns{gap:10px}.progress-card{border-radius:25px;padding:18px}.trend-chart{height:215px}.activity-chart{height:160px;gap:4px}.activity-day small{font-size:8px}}
`;
