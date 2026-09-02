import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { QUESTIONS } from './data/questions';

type Question = (typeof QUESTIONS)[number] & { correct_indices?: number[]; status?: 'dropped' };
type Tab = 'home' | 'practice' | 'mocks' | 'saved' | 'mistakes' | 'progress';
type SolverMode = 'practice' | 'mock';
type ThemeId = 'violet' | 'blue' | 'teal' | 'rose' | 'amber' | 'slate' | 'indigo' | 'mint' | 'coral';
type Appearance = 'dark' | 'light';

type Attempt = {
  ids: string[];
  answers: Record<string, number>;
  marked: string[];
  index: number;
  mode: SolverMode;
  startedAt: number;
  title: string;
  duration: number;
};

type Result = {
  title: string;
  ids: string[];
  answers: Record<string, number>;
  startedAt: number;
  finishedAt: number;
};

const THEMES: Array<{ id: ThemeId; name: string; color: string }> = [
  { id: 'violet', name: 'Violet', color: '#9b7cff' },
  { id: 'blue', name: 'Blue', color: '#6da8ff' },
  { id: 'teal', name: 'Teal', color: '#58d0c0' },
  { id: 'rose', name: 'Rose', color: '#e58eae' },
  { id: 'amber', name: 'Amber', color: '#e5b357' },
  { id: 'slate', name: 'Slate', color: '#9caabd' },
  { id: 'indigo', name: 'Indigo', color: '#7788ff' },
  { id: 'mint', name: 'Mint', color: '#63d59a' },
  { id: 'coral', name: 'Coral', color: '#ff8e82' },
];

const SUBJECTS = [
  { name: 'Physics' as const, icon: 'P', desc: '45 questions · 180 marks', tone: 'blue' },
  { name: 'Chemistry' as const, icon: 'C', desc: '45 questions · 180 marks', tone: 'teal' },
  { name: 'Biology' as const, icon: 'B', desc: '90 questions · 360 marks', tone: 'mint' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const STORAGE = {
  saved: 'neetprep-saved-v3',
  mistakes: 'neetprep-mistakes-v3',
  notes: 'neetprep-notes-v3',
  daily: 'neetprep-daily-v3',
  target: 'neetprep-target-v3',
  results: 'neetprep-results-v3',
  theme: 'neet-theme',
  appearance: 'neet-appearance',
};

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function answerIsCorrect(q: Question, selected: number | undefined) {
  if (selected === undefined || q.status === 'dropped') return false;
  const accepted = q.correct_indices ?? (q.correct_index === null ? [] : [q.correct_index]);
  return accepted.includes(selected);
}

function answerLabel(q: Question) {
  if (q.status === 'dropped') return 'Dropped by NTA';
  const accepted = q.correct_indices ?? (q.correct_index === null ? [] : [q.correct_index]);
  if (!accepted.length) return 'Not available';
  return accepted.map(i => OPTION_LABELS[i]).join(' / ');
}

function scoreAttempt(ids: string[], answers: Record<string, number>) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let dropped = 0;
  ids.forEach(id => {
    const q = QUESTIONS.find(item => item.id === id) as Question | undefined;
    if (!q) return;
    if (q.status === 'dropped') { dropped += 1; return; }
    const selected = answers[id];
    if (selected === undefined) unanswered += 1;
    else if (answerIsCorrect(q, selected)) correct += 1;
    else incorrect += 1;
  });
  return { correct, incorrect, unanswered, dropped, score: correct * 4 - incorrect };
}

function getSubjectStats(results: Result[]) {
  const stats: Record<string, { attempted: number; correct: number; incorrect: number }> = {
    Physics: { attempted: 0, correct: 0, incorrect: 0 },
    Chemistry: { attempted: 0, correct: 0, incorrect: 0 },
    Biology: { attempted: 0, correct: 0, incorrect: 0 },
  };
  results.forEach(result => result.ids.forEach(id => {
    const q = QUESTIONS.find(item => item.id === id) as Question | undefined;
    if (!q || q.status === 'dropped') return;
    const selected = result.answers[id];
    if (selected === undefined) return;
    stats[q.subject].attempted += 1;
    if (answerIsCorrect(q, selected)) stats[q.subject].correct += 1;
    else stats[q.subject].incorrect += 1;
  }));
  return stats;
}

export default function App() {
  const questions = QUESTIONS as Question[];
  const [tab, setTab] = useState<Tab>('home');
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<string[]>(() => read(STORAGE.saved, []));
  const [mistakes, setMistakes] = useState<string[]>(() => read(STORAGE.mistakes, []));
  const [notes, setNotes] = useState<Record<string, string>>(() => read(STORAGE.notes, {}));
  const [daily, setDaily] = useState<Record<string, number>>(() => read(STORAGE.daily, {}));
  const [target, setTarget] = useState<number>(() => Number(localStorage.getItem(STORAGE.target) || 30));
  const [results, setResults] = useState<Result[]>(() => read(STORAGE.results, []));
  const [theme, setTheme] = useState<ThemeId>('teal');
  const [appearance, setAppearance] = useState<Appearance>('dark');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'All' | Question['subject']>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'RE-NEET 2026'>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [solver, setSolver] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(Date.now());
  const [mockSubjects, setMockSubjects] = useState<Question['subject'][]>(['Physics', 'Chemistry', 'Biology']);
  const [mockCount, setMockCount] = useState(180);
  const [mockDuration, setMockDuration] = useState(180);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE.theme);
    if (savedTheme && THEMES.some(t => t.id === savedTheme)) setTheme(savedTheme as ThemeId);
    setAppearance(localStorage.getItem(STORAGE.appearance) === 'light' ? 'light' : 'dark');
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => localStorage.setItem(STORAGE.theme, theme), [theme]);
  useEffect(() => localStorage.setItem(STORAGE.appearance, appearance), [appearance]);
  useEffect(() => localStorage.setItem(STORAGE.saved, JSON.stringify(saved)), [saved]);
  useEffect(() => localStorage.setItem(STORAGE.mistakes, JSON.stringify(mistakes)), [mistakes]);
  useEffect(() => localStorage.setItem(STORAGE.notes, JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem(STORAGE.daily, JSON.stringify(daily)), [daily]);
  useEffect(() => localStorage.setItem(STORAGE.target, String(target)), [target]);
  useEffect(() => localStorage.setItem(STORAGE.results, JSON.stringify(results)), [results]);

  useEffect(() => {
    if (!solver) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [solver]);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(''), 2400);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter(q => {
      if (subjectFilter !== 'All' && q.subject !== subjectFilter) return false;
      if (sourceFilter !== 'All' && !String(q.source).includes(sourceFilter)) return false;
      if (difficultyFilter !== 'All' && q.difficulty !== difficultyFilter) return false;
      if (!term) return true;
      return [q.question, q.sourceText, q.subject, q.chapter, q.topic, q.year, q.source].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [questions, search, subjectFilter, sourceFilter, difficultyFilter]);

  const today = daily[todayKey()] ?? 0;
  const dailyPct = Math.min(100, Math.round((today / Math.max(1, target)) * 100));
  const stats = useMemo(() => getSubjectStats(results), [results]);
  const totalAnswered = (Object.values(stats) as Array<{attempted:number;correct:number;incorrect:number}>).reduce((sum, s) => sum + s.attempted, 0);
  const totalCorrect = (Object.values(stats) as Array<{attempted:number;correct:number;incorrect:number}>).reduce((sum, s) => sum + s.correct, 0);
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const current = solver ? questions.find(q => q.id === solver.ids[solver.index]) ?? null : null;
  const remaining = solver ? Math.max(0, solver.duration - Math.floor((now - solver.startedAt) / 1000)) : 0;

  useEffect(() => {
    if (solver?.mode === 'mock' && remaining <= 0) finishSolver(true);
  }, [remaining]);

  function showToast(message: string) { setToast(message); }

  function startAttempt(pool: Question[], mode: SolverMode, title: string, duration = 1200) {
    const valid = mode === 'mock' ? pool : pool.filter(q => q.status !== 'dropped');
    if (!valid.length) return showToast('No questions are available for this set.');
    setResult(null);
    setSolver({ ids: valid.map(q => q.id), answers: {}, marked: [], index: 0, mode, startedAt: Date.now(), title, duration });
  }

  function openPracticeQuestion(q: Question) {
    setResult(null);
    setSolver({ ids: [q.id], answers: {}, marked: [], index: 0, mode: 'practice', startedAt: Date.now(), title: 'Practice question', duration: 0 });
  }

  function chooseAnswer(value: number) {
    if (!solver || !current) return;
    setSolver(prev => prev ? { ...prev, answers: { ...prev.answers, [current.id]: value } } : prev);
    if (solver.mode === 'practice') {
      setDaily(prev => ({ ...prev, [todayKey()]: (prev[todayKey()] ?? 0) + 1 }));
      if (current.status !== 'dropped') {
        if (answerIsCorrect(current, value)) setMistakes(prev => prev.filter(id => id !== current.id));
        else setMistakes(prev => prev.includes(current.id) ? prev : [...prev, current.id]);
      }
    }
  }

  function toggleSaved(id: string) {
    setSaved(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    showToast(saved.includes(id) ? 'Removed from saved' : 'Saved for revision');
  }

  function toggleMarked(id: string) {
    setSolver(prev => prev ? { ...prev, marked: prev.marked.includes(id) ? prev.marked.filter(x => x !== id) : [...prev.marked, id] } : prev);
  }

  function saveAndNext() {
    if (!solver) return;
    if (solver.index >= solver.ids.length - 1) {
      setSubmitConfirmOpen(true);
      return;
    }
    setSolver(prev => prev ? { ...prev, index: prev.index + 1 } : prev);
  }

  function markReviewAndNext() {
    if (!solver || !current) return;
    setSolver(prev => {
      if (!prev) return prev;
      const marked = prev.marked.includes(current.id) ? prev.marked : [...prev.marked, current.id];
      return { ...prev, marked, index: Math.min(prev.ids.length - 1, prev.index + 1) };
    });
  }

  function clearResponse() {
    if (!solver || !current) return;
    setSolver(prev => {
      if (!prev) return prev;
      const answers = { ...prev.answers };
      delete answers[current.id];
      return { ...prev, answers };
    });
  }

  function jumpToQuestion(index: number) {
    setSolver(prev => prev ? { ...prev, index } : prev);
  }

  function submitFromCBT() {
    setSubmitConfirmOpen(false);
    finishSolver(false);
  }

  function nextQuestion() {
    if (!solver) return;
    if (solver.mode === 'mock') return saveAndNext();
    if (solver.index >= solver.ids.length - 1) return finishSolver(false);
    setSolver(prev => prev ? { ...prev, index: prev.index + 1 } : prev);
  }

  function previousQuestion() {
    setSolver(prev => prev ? { ...prev, index: Math.max(0, prev.index - 1) } : prev);
  }

  function finishSolver(auto = false) {
    if (!solver) return;
    const finished: Result = { title: solver.title, ids: solver.ids, answers: solver.answers, startedAt: solver.startedAt, finishedAt: Date.now() };
    setSubmitConfirmOpen(false);
    const score = scoreAttempt(finished.ids, finished.answers);
    if (solver.mode === 'mock') {
      setResults(prev => [finished, ...prev].slice(0, 30));
      setResult(finished);
      setSolver(null);
      showToast(auto ? 'Time is up. Test submitted.' : 'Test submitted successfully.');
    } else {
      setSolver(null);
      setTab('practice');
      showToast(score.unanswered ? `Answer saved · ${score.unanswered} unanswered` : 'Answer saved');
    }
  }

  function signInOrUp() {
    setAuthMessage('');
    (async () => {
      const response = authMode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (response.error) setAuthMessage(response.error.message);
      else { setAuthMessage(authMode === 'in' ? 'Signed in.' : 'Account created.'); setTimeout(() => setAuthOpen(false), 500); }
    })();
  }

  function go(next: Tab) { setTab(next); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function renderHome() {
    return <main className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> NEET UG · DAILY PREPARATION</div>
          <h1>Prepare with a system,<br /><em>not a pile of PDFs.</em></h1>
          <p>Practice questions, take realistic mocks, review mistakes and watch your preparation improve one session at a time.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => go('practice')}>Start practicing <b>→</b></button>
            <button className="secondary-button" onClick={() => go('mocks')}>Take a mock test</button>
          </div>
          <div className="hero-proof"><span><b>{questions.length}</b> questions loaded</span><span><b>180</b> full-paper format</span><span><b>2026</b> official key</span></div>
        </div>
        <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring ring-a" /><div className="orbit-ring ring-b" /><div className="hero-core"><span>NEET</span><b>UG</b><small>PREP</small></div></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">YOUR DAY</span><h2>Keep the momentum.</h2></div><button className="text-button" onClick={() => go('progress')}>View progress →</button></div>
        <div className="home-grid">
          <button className="continue-card" onClick={() => startAttempt(questions.filter(q => q.status !== 'dropped').slice(0, 10), 'practice', 'Quick practice')}>
            <div className="card-label">CONTINUE PRACTICING</div><h3>{today ? `${today} questions solved today.` : 'Start your first focused session.'}</h3><p>{today ? 'Keep the daily target moving.' : 'Ten questions is enough to get started.'}</p><span className="card-arrow">→</span>
          </button>
          <div className="target-card">
            <div className="target-top"><div><span className="card-label">TODAY'S TARGET</span><h3>{today} / {target}</h3></div><div className="target-percent">{dailyPct}%</div></div>
            <div className="progress-track"><i style={{ width: `${dailyPct}%` }} /></div>
            <div className="target-foot"><span>Questions solved</span><button onClick={() => setTarget(v => v >= 100 ? 10 : v + 10)}>Set target</button></div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">QUESTION BANK</span><h2>Pick a subject.</h2></div><button className="text-button" onClick={() => go('practice')}>Open bank →</button></div>
        <div className="subject-grid">{SUBJECTS.map(s => <button key={s.name} className={`subject-card ${s.tone}`} onClick={() => { setSubjectFilter(s.name); go('practice'); }}><span className="subject-mark">{s.icon}</span><span><b>{s.name}</b><small>{s.desc}</small></span><strong>→</strong></button>)}</div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="section-kicker">REVISION</span><h2>Where your work goes next.</h2></div></div>
        <div className="revision-grid">
          <button className="revision-card" onClick={() => go('saved')}><span className="mini-symbol">◇</span><div><b>Saved questions</b><small>{saved.length} bookmarked for later</small></div><strong>→</strong></button>
          <button className="revision-card" onClick={() => go('mistakes')}><span className="mini-symbol warning">!</span><div><b>Mistake bank</b><small>{mistakes.length} questions need another look</small></div><strong>→</strong></button>
          <button className="revision-card" onClick={() => go('progress')}><span className="mini-symbol trend">↗</span><div><b>Performance trend</b><small>{overallAccuracy ? `${overallAccuracy}% overall accuracy` : 'Build your first data point'}</small></div><strong>→</strong></button>
        </div>
      </section>
    </main>;
  }

  function renderPractice() {
    return <main className="page">
      <section className="page-title"><div><span className="section-kicker">QUESTION BANK</span><h1>Practice.</h1><p>Search the imported RE-NEET paper, filter by subject, and solve questions one at a time.</p></div><button className="primary-button compact" onClick={() => startAttempt(filteredQuestions.slice(0, 10), 'practice', 'Quick practice')}>10-question set →</button></section>
      <section className="filter-panel">
        <div className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions, subjects, sources…" /></div>
        <div className="filter-row"><select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value as typeof subjectFilter)}><option value="All">All subjects</option><option>Physics</option><option>Chemistry</option><option>Biology</option></select><select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value as typeof difficultyFilter)}><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option></select><select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}><option value="All">All sources</option><option value="RE-NEET 2026">RE-NEET 2026</option></select></div>
      </section>
      <div className="result-line"><b>{filteredQuestions.length}</b> questions <span>·</span> tap any question to solve</div>
      <section className="question-list">{filteredQuestions.map((q, index) => <button key={q.id} className="question-row" onClick={() => openPracticeQuestion(q)}><span className={`q-number ${q.subject.toLowerCase()}`}>{questions.indexOf(q) + 1}</span><span className="q-row-copy"><small>{q.subject} · {q.year} · Code 60</small><b>{q.question.replace(/\s+/g, ' ').slice(0, 180)}{q.question.length > 180 ? '…' : ''}</b><span>{q.status === 'dropped' ? 'Dropped by NTA' : `Official answer · ${answerLabel(q)}`} {saved.includes(q.id) && <i>Saved</i>}</span></span><strong>›</strong></button>)}</section>
    </main>;
  }

  function renderMocks() {
    const available = questions.filter(q => mockSubjects.includes(q.subject));
    const maxCount = Math.max(1, available.length);
    const count = Math.min(mockCount, maxCount);
    const subjectCounts = (['Physics','Chemistry','Biology'] as Question['subject'][]).map(subject => ({
      subject,
      count: questions.filter(q => q.subject === subject).length,
    }));
    const subjectIcon: Record<Question['subject'], string> = { Physics: 'P', Chemistry: 'C', Biology: 'B' };
    const subjectTone: Record<Question['subject'], string> = { Physics: 'blue', Chemistry: 'teal', Biology: 'mint' };
    return <main className="page mock-builder-page">
      <div className="mock-builder-top"><button className="ghost-button" onClick={() => go('home')}>← Home</button><span className="exam-pill">TIMED MOCK EXAM</span></div>
      <section className="mock-builder-hero"><div><span className="section-kicker">NEET UG / EXAM MODE</span><h1>Build your own mock exam.</h1><p>Choose exactly what you want to test. During the exam, answers stay hidden and the interface follows an NTA-style computer based test flow.</p></div><div className="mock-summary"><small>YOUR MOCK</small><strong>{count}</strong><span>questions</span><hr/><b>{mockDuration} min · {mockSubjects.length} subjects</b></div></section>

      <div className="mock-builder-grid">
        <div className="mock-builder-left">
          <section className="builder-card"><div className="builder-head"><div className="step-no">01</div><div><span>SUBJECTS</span><h2>What are you testing?</h2></div><b>{mockSubjects.length} selected</b></div><div className="subject-select-grid">{subjectCounts.map(({subject,count:availableCount}) => { const selected = mockSubjects.includes(subject); return <button key={subject} className={`subject-select ${selected ? 'selected' : ''}`} onClick={() => setMockSubjects(prev => selected ? (prev.length === 1 ? prev : prev.filter(s => s !== subject)) : [...prev, subject])}><span className={`check-box ${selected ? 'checked' : ''}`}>{selected ? '✓' : ''}</span><span><strong>{subject}</strong><small>{availableCount} questions available</small></span><em>{selected ? 'IN' : '+'}</em></button>; })}</div></section>
          <section className="builder-card"><div className="builder-head"><div className="step-no">02</div><div><span>QUESTION COUNT</span><h2>How long should the paper be?</h2></div><b>{maxCount} available</b></div><div className="count-presets">{[10,20,30,45,90,180].filter(n => n <= maxCount).map(n => <button key={n} className={count === n ? 'selected' : ''} onClick={() => setMockCount(n)}>{n === 180 ? 'FULL' : n}</button>)}</div><input className="count-range" type="range" min="1" max={maxCount} value={count} onChange={e => setMockCount(Number(e.target.value))}/><div className="range-foot"><span>1</span><b>{count} questions</b><span>{maxCount}</span></div></section>
          <section className="builder-card"><div className="builder-head"><div className="step-no">03</div><div><span>TIME LIMIT</span><h2>Set the clock.</h2></div><b>Auto-submit at 0:00</b></div><div className="time-presets">{[15,30,45,60,90,120,180].map(n => <button key={n} className={mockDuration === n ? 'selected' : ''} onClick={() => setMockDuration(n)}>{n} min</button>)}</div><label className="custom-time">Custom minutes <input type="number" min="1" max="600" value={mockDuration} onChange={e => setMockDuration(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} /></label></section>
        </div>
        <aside className="mock-rules-card"><span className="section-kicker">EXAM RULES</span><h2>Simulation mode</h2><ul><li>Questions can be visited in any order</li><li>Answers are not revealed during the exam</li><li>Save & Next records the current response</li><li>Mark for Review keeps the question in the review state</li><li>Clear Response removes the selected answer</li><li>Timer auto-submits when it reaches zero</li><li>Score and corrections appear only after submission</li></ul><div className="ready-box"><div><small>READY</small><strong>{count} questions</strong></div><span>{mockDuration} minutes</span></div><button className="primary-button full" disabled={!available.length} onClick={() => { const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, count); startAttempt(shuffled, 'mock', `NEET UG Mock · ${count} questions`, mockDuration * 60); setPaletteOpen(true); }}>START EXAM →</button><p className="builder-footnote">You can leave before starting without losing anything.</p></aside>
      </div>
    </main>;
  }

  function renderRevision(kind: 'saved' | 'mistakes') {
    const ids = kind === 'saved' ? saved : mistakes;
    const pool = ids.map(id => questions.find(q => q.id === id)).filter(Boolean) as Question[];
    return <main className="page"><section className="page-title"><div><span className="section-kicker">REVISION</span><h1>{kind === 'saved' ? 'Saved questions.' : 'Mistake bank.'}</h1><p>{kind === 'saved' ? 'Questions you intentionally kept for another pass.' : 'Questions you got wrong and should make friends with before the exam.'}</p></div>{pool.length > 0 && <button className="primary-button compact" onClick={() => startAttempt(pool, 'practice', kind === 'saved' ? 'Saved revision' : 'Mistake revision')}>Practice all →</button>}</section>{pool.length ? <section className="question-list">{pool.map(q => <button key={q.id} className="question-row" onClick={() => openPracticeQuestion(q)}><span className={`q-number ${q.subject.toLowerCase()}`}>{questions.indexOf(q) + 1}</span><span className="q-row-copy"><small>{q.subject} · RE-NEET 2026</small><b>{q.question.replace(/\s+/g, ' ').slice(0, 190)}{q.question.length > 190 ? '…' : ''}</b><span>Official answer · {answerLabel(q)}</span></span><strong>›</strong></button>)}</section> : <div className="empty-state"><span>✓</span><h2>Nothing here yet.</h2><p>Answer questions and your revision bank will start building itself.</p><button className="primary-button compact" onClick={() => go('practice')}>Go to practice</button></div>}</main>;
  }

  function renderProgress() {
    const weak = (Object.entries(stats) as Array<[Question['subject'], typeof stats.Physics]>).sort((a, b) => {
      const aa = a[1].attempted ? a[1].correct / a[1].attempted : 1;
      const bb = b[1].attempted ? b[1].correct / b[1].attempted : 1;
      return aa - bb;
    })[0];
    return <main className="page"><section className="page-title"><div><span className="section-kicker">YOUR PERFORMANCE</span><h1>Progress.</h1><p>Useful numbers, not motivational confetti. The goal is to know what needs work.</p></div></section>
      <section className="metrics-grid"><div className="metric-card"><small>QUESTIONS ANSWERED</small><strong>{totalAnswered}</strong><span>Across practice & mocks</span></div><div className="metric-card"><small>ACCURACY</small><strong>{overallAccuracy}%</strong><span>{totalAnswered ? `${totalCorrect} correct answers` : 'No attempts yet'}</span></div><div className="metric-card"><small>TODAY</small><strong>{today}</strong><span>of {target} target questions</span></div><div className="metric-card"><small>SAVED</small><strong>{saved.length}</strong><span>Ready for revision</span></div></section>
      <section className="performance-panel"><div className="section-heading"><div><span className="section-kicker">SUBJECT PERFORMANCE</span><h2>Know your weak lane.</h2></div>{weak && <span className="weak-badge">Focus: {weak[0]}</span>}</div><div className="subject-performance">{SUBJECTS.map(s => { const st = stats[s.name]; const acc = st.attempted ? Math.round(st.correct / st.attempted * 100) : 0; return <div className="perf-row" key={s.name}><span className={`subject-mark ${s.tone}`}>{s.icon}</span><div className="perf-copy"><b>{s.name}</b><small>{st.attempted} attempted · {st.correct} correct · {st.incorrect} incorrect</small><div className="progress-track"><i style={{ width: `${acc}%` }} /></div></div><strong>{acc}%</strong></div>; })}</div></section>
      <section className="performance-panel"><div className="section-heading"><div><span className="section-kicker">TEST HISTORY</span><h2>Recent attempts.</h2></div></div>{results.length ? <div className="history-list">{results.map((r, i) => { const s = scoreAttempt(r.ids, r.answers); return <button className="history-row" key={`${r.finishedAt}-${i}`} onClick={() => setResult(r)}><span><b>{r.title}</b><small>{new Date(r.finishedAt).toLocaleString()}</small></span><strong>{s.score}<small>{s.correct} correct · {s.incorrect} wrong</small></strong></button>; })}</div> : <div className="inline-empty">Complete a mock test and your history will appear here.</div>}</section>
    </main>;
  }

  function renderSolver() {
    if (!solver || !current) return null;
    const selected = solver.answers[current.id];
    const answered = selected !== undefined;
    const sourcePage = current.sourcePage;
    const answeredCount = Object.keys(solver.answers).length;
    const validIds = solver.ids.filter(id => (questions.find(q => q.id === id) as Question | undefined)?.status !== 'dropped');
    const notAnsweredCount = Math.max(0, validIds.length - validIds.filter(id => solver.answers[id] !== undefined).length);
    const markedCount = solver.marked.length;
    const currentNumber = solver.index + 1;
    const paletteState = (id: string) => {
      const hasAnswer = solver.answers[id] !== undefined;
      const marked = solver.marked.includes(id);
      const q = questions.find(x => x.id === id) as Question | undefined;
      if (q?.status === 'dropped') return 'dropped';
      if (hasAnswer && marked) return 'answered-review';
      if (marked) return 'review';
      if (hasAnswer) return 'answered';
      const visited = solver.ids.indexOf(id) <= solver.index;
      return visited ? 'not-answered' : 'not-visited';
    };
    const isMock = solver.mode === 'mock';
    return <div className="cbt-shell">
      <header className="cbt-topbar">
        <div className="cbt-brand"><span className="cbt-brand-mark">N</span><div><strong>neetprep</strong><small>{solver.title}</small></div></div>
        <div className="cbt-section-tabs">{(['Physics','Chemistry','Biology'] as Question['subject'][]).map(subject => { const first = solver.ids.findIndex(id => (questions.find(q => q.id === id) as Question | undefined)?.subject === subject); return <button key={subject} className={current.subject === subject ? 'active' : ''} disabled={first < 0} onClick={() => first >= 0 && jumpToQuestion(first)}>{subject}</button>; })}</div>
        <div className="cbt-top-actions"><button className="cbt-lang">English ▾</button><div className={`cbt-clock ${remaining < 300 && isMock ? 'danger' : ''}`}><small>TIME LEFT</small><strong>{isMock ? formatTime(remaining) : '—'}</strong></div><button className="cbt-profile">{(user?.email?.[0] ?? 'S').toUpperCase()}</button></div>
      </header>
      <div className="cbt-mobile-section"><span>Section: <b>{current.subject}</b></span><button onClick={() => setPaletteOpen(v => !v)}>Question Palette</button></div>
      <div className="cbt-layout">
        <main className="cbt-question-area">
          <div className="cbt-question-head"><div><span>NEET UG · {current.subject}</span><h1>Question {currentNumber}</h1></div><div className="cbt-progress-label">{answeredCount}/{solver.ids.length} answered</div></div>
          <div className="cbt-instruction-strip"><span><b>+4</b> Correct</span><span><b>−1</b> Incorrect</span><span><b>0</b> Unanswered</span><span className="cbt-question-type">Single Correct Answer</span></div>
          <section className={`cbt-question-card ${current.status === 'dropped' ? 'cbt-dropped-card' : ''}`}>
            <div className="cbt-q-number">Question No. {currentNumber} {current.status === 'dropped' && <span className="cbt-dropped-badge">DROPPED BY NTA · NOT EVALUATED</span>}</div>
            <div className="cbt-question-text">{current.question.replace(/\s+/g, ' ').trim()}</div>
            <div className="cbt-source-toggle"><button onClick={() => sourcePage && window.open(`/source-pages/page-${sourcePage}.jpg`, '_blank')}>View original paper scan ↗</button><span>Use the scan for diagrams / exact option typography.</span></div>
            <div className="cbt-options">{OPTION_LABELS.map((label, i) => <button key={label} className={`cbt-option ${selected === i ? 'selected' : ''}`} onClick={() => chooseAnswer(i)} disabled={current.status === 'dropped'}><span className="option-radio">{selected === i ? '●' : '○'}</span><b>{label}.</b><span className="cbt-option-label">{current.options[i] && current.options[i] !== label ? current.options[i] : `Choice ${label}`}</span></button>)}</div>
          </section>
          <div className="cbt-actions-mobile"><button onClick={clearResponse} disabled={!answered}>Clear Response</button><button onClick={markReviewAndNext}>Mark for Review & Next</button><button className="primary-button" onClick={saveAndNext}>{currentNumber === solver.ids.length ? 'Save & Submit' : 'Save & Next'}</button></div>
        </main>
        <aside className={`cbt-palette ${paletteOpen ? 'open' : 'closed'}`}>
          <div className="cbt-candidate"><div className="candidate-avatar">{(user?.email?.[0] ?? 'S').toUpperCase()}</div><div><small>Candidate</small><strong>{user?.email?.split('@')[0] ?? 'Student'}</strong></div><button onClick={() => setPaletteOpen(false)}>‹</button></div>
          <div className="cbt-palette-summary"><strong>{answeredCount}</strong><span>Answered</span><strong>{markedCount}</strong><span>Review</span><strong>{notAnsweredCount}</strong><span>Not answered</span></div>
          <div className="cbt-palette-title"><b>Question Palette</b><span>{solver.ids.length} Questions</span></div>
          <div className="cbt-palette-grid">{solver.ids.map((id, i) => <button key={id} className={`palette-q ${paletteState(id)} ${i === solver.index ? 'current' : ''}`} onClick={() => jumpToQuestion(i)}>{i + 1}</button>)}</div>
          <div className="cbt-legend"><div><i className="lg-answered"/> Answered</div><div><i className="lg-not"/> Not Answered</div><div><i className="lg-review"/> Marked for Review</div><div><i className="lg-ar"/> Answered & Review</div></div>
          <button className="cbt-submit" onClick={() => setSubmitConfirmOpen(true)}>Submit Test</button>
        </aside>
      </div>
      <footer className="cbt-footer"><button onClick={() => { if (solver.index > 0) jumpToQuestion(solver.index - 1); }} disabled={solver.index === 0}>‹ Previous</button><div className="cbt-footer-center"><span>Question {currentNumber} of {solver.ids.length}</span><div className="cbt-dots"><i style={{width:`${(currentNumber/solver.ids.length)*100}%`}}/></div></div><div className="cbt-footer-right"><button onClick={clearResponse} disabled={!answered}>Clear Response</button><button onClick={markReviewAndNext}>Mark for Review & Next</button><button className="primary-button" onClick={saveAndNext}>{currentNumber === solver.ids.length ? 'Save & Submit' : 'Save & Next'}</button></div></footer>
      {submitConfirmOpen && <div className="cbt-confirm-backdrop"><div className="cbt-confirm"><span className="section-kicker">SUBMIT EXAM</span><h2>Are you sure you want to submit?</h2><p>You have <b>{notAnsweredCount}</b> unanswered question{notAnsweredCount === 1 ? '' : 's'} and <b>{markedCount}</b> marked for review.</p><div className="confirm-stats"><div><b>{answeredCount}</b><small>Answered</small></div><div><b>{notAnsweredCount}</b><small>Unanswered</small></div><div><b>{markedCount}</b><small>Review</small></div></div><div className="confirm-actions"><button onClick={() => setSubmitConfirmOpen(false)}>Return to test</button><button className="primary-button" onClick={submitFromCBT}>Submit Test</button></div></div></div>}
    </div>;
  }

  function renderResult() {
    if (!result) return null;
    const s = scoreAttempt(result.ids, result.answers);
    const valid = result.ids.filter(id => (questions.find(q => q.id === id) as Question)?.status !== 'dropped').length;
    const accuracy = s.correct + s.incorrect ? Math.round(s.correct / (s.correct + s.incorrect) * 100) : 0;
    return <div className="result-overlay"><div className="result-sheet"><button className="close-button" onClick={() => setResult(null)}>×</button><span className="section-kicker">TEST COMPLETE</span><h1>{result.title}</h1><div className="score-hero"><div><small>SCORE</small><strong>{s.score}</strong><span>/ {valid * 4}</span></div><div className="score-ring" style={{ '--score': `${Math.min(100, Math.max(0, Math.round(s.score / Math.max(1, valid * 4) * 100)))}%` } as CSSProperties}><b>{accuracy}%</b><small>accuracy</small></div></div><div className="result-stats"><div><b>{s.correct}</b><small>Correct</small></div><div><b>{s.incorrect}</b><small>Incorrect</small></div><div><b>{s.unanswered}</b><small>Unanswered</small></div><div><b>{s.dropped}</b><small>Dropped</small></div></div><div className="result-actions"><button className="primary-button" onClick={() => { setResult(null); go('practice'); }}>Review questions</button><button className="secondary-button" onClick={() => { setResult(null); go('progress'); }}>View progress</button></div></div></div>;
  }

  const currentTheme = THEMES.find(t => t.id === theme) ?? THEMES[2];
  return <div className="app" data-theme={theme} data-appearance={appearance} style={{ '--accent': currentTheme.color } as CSSProperties}>
    <header className="top-nav"><button className="brand" onClick={() => go('home')}><span className="brand-mark">N</span><span>neet<span>prep</span></span></button><nav>{([['home', 'Home'], ['practice', 'Practice'], ['mocks', 'Tests'], ['saved', 'Saved'], ['mistakes', 'Mistakes'], ['progress', 'Progress']] as [Tab, string][]).map(([id, label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => go(id)}>{label}</button>)}</nav><div className="nav-actions"><button className="nav-theme" onClick={() => setAppearanceOpen(true)}><i style={{ background: currentTheme.color }} /> Theme</button><button className="nav-search" onClick={() => { go('practice'); setTimeout(() => document.querySelector<HTMLInputElement>('.search-field input')?.focus(), 50); }}>⌕ <span>Search</span></button>{user ? <button className="nav-avatar" onClick={() => setProfileOpen(true)}>{(user.email?.[0] ?? 'N').toUpperCase()}</button> : <button className="nav-login" onClick={() => setAuthOpen(true)}>Log in</button>}</div></header>
    <div className="mobile-header"><button className="brand" onClick={() => go('home')}><span className="brand-mark">N</span><span>neet<span>prep</span></span></button><div><button className="mobile-streak" onClick={() => go('progress')}>◔ {today}</button><button className="nav-avatar" onClick={() => user ? setProfileOpen(true) : setAuthOpen(true)}>{(user?.email?.[0] ?? 'N').toUpperCase()}</button></div></div>
    {tab === 'home' && renderHome()}
    {tab === 'practice' && renderPractice()}
    {tab === 'mocks' && renderMocks()}
    {tab === 'saved' && renderRevision('saved')}
    {tab === 'mistakes' && renderRevision('mistakes')}
    {tab === 'progress' && renderProgress()}
    <nav className="mobile-bottom"><button className={tab === 'home' ? 'active' : ''} onClick={() => go('home')}><span>⌂</span><b>Home</b></button><button className={tab === 'practice' ? 'active' : ''} onClick={() => go('practice')}><span>▤</span><b>Practice</b></button><button className="mobile-plus" onClick={() => startAttempt(questions.filter(q => q.status !== 'dropped').slice(0, 10), 'practice', 'Quick practice')}><span>+</span></button><button className={tab === 'mocks' ? 'active' : ''} onClick={() => go('mocks')}><span>◷</span><b>Tests</b></button><button className={tab === 'progress' ? 'active' : ''} onClick={() => go('progress')}><span>↗</span><b>Progress</b></button></nav>
    {solver && renderSolver()}
    {result && renderResult()}
    {appearanceOpen && <div className="modal-backdrop" onMouseDown={() => setAppearanceOpen(false)}><div className="modal appearance-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setAppearanceOpen(false)}>×</button><span className="section-kicker">APPEARANCE</span><h2>Make it yours.</h2><div className="appearance-section"><small>ACCENT</small><div className="theme-swatches">{THEMES.map(t => <button key={t.id} className={theme === t.id ? 'selected' : ''} onClick={() => setTheme(t.id)}><i style={{ background: t.color }} /><span>{t.name}</span></button>)}</div></div><div className="appearance-section"><small>MODE</small><div className="mode-toggle"><button className={appearance === 'dark' ? 'selected' : ''} onClick={() => setAppearance('dark')}>Dark</button><button className={appearance === 'light' ? 'selected' : ''} onClick={() => setAppearance('light')}>Light</button></div></div></div></div>}
    {profileOpen && <div className="modal-backdrop" onMouseDown={() => setProfileOpen(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setProfileOpen(false)}>×</button><span className="section-kicker">PROFILE</span><h2>{user?.email?.split('@')[0] ?? 'Student'}</h2><p>{user?.email}</p><div className="profile-actions"><button onClick={() => { supabase.auth.signOut(); setProfileOpen(false); }}>Sign out</button><button onClick={() => setAppearanceOpen(true)}>Appearance</button></div></div></div>}
    {authOpen && <div className="modal-backdrop" onMouseDown={() => setAuthOpen(false)}><div className="modal auth-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setAuthOpen(false)}>×</button><span className="section-kicker">NEETPREP ACCOUNT</span><h2>{authMode === 'in' ? 'Welcome back.' : 'Create your account.'}</h2><p>Save progress across devices and keep your revision history.</p><label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" /></label><label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" /></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button full" onClick={signInOrUp}>{authMode === 'in' ? 'Log in' : 'Create account'}</button><button className="switch-auth" onClick={() => setAuthMode(authMode === 'in' ? 'up' : 'in')}>{authMode === 'in' ? 'Need an account? Create one' : 'Already have an account? Log in'}</button></div></div>}
    {noteOpen && current && <div className="modal-backdrop" onMouseDown={() => setNoteOpen(false)}><div className="modal note-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setNoteOpen(false)}>×</button><span className="section-kicker">PERSONAL NOTE</span><h2>Question {questions.indexOf(current) + 1}</h2><textarea value={notes[current.id] ?? ''} onChange={e => setNotes(prev => ({ ...prev, [current.id]: e.target.value }))} placeholder="Write a short reminder for your next revision…" autoFocus /><button className="primary-button full" onClick={() => { setNoteOpen(false); showToast('Note saved'); }}>Save note</button></div></div>}
    {reportOpen && <div className="modal-backdrop" onMouseDown={() => setReportOpen(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setReportOpen(false)}>×</button><span className="section-kicker">REPORT QUESTION</span><h2>What looks wrong?</h2><div className="report-options">{['Question text', 'Diagram / scan', 'Answer key', 'Other'].map(x => <button key={x} onClick={() => { setReportOpen(false); showToast('Report recorded for review'); }}>{x}<span>›</span></button>)}</div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
