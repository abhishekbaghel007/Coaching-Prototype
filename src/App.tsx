import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { cloudEnabled, loadCloudSnapshot, syncAnswerRecords, syncAttempt, syncDailyActivity, syncQuestionStates, upsertProfile, type CloudAnswerRecord, type CloudAttempt } from './lib/cloudSync';
import { QUESTIONS } from './data/questions';
import StudentExperience from './student/StudentExperience';

type Question = (typeof QUESTIONS)[number] & { correct_indices?: number[]; status?: 'dropped' };
type Tab = 'home' | 'practice' | 'mocks' | 'saved' | 'mistakes' | 'progress';
type SolverMode = 'practice' | 'mock';
type ThemeId = 'violet' | 'blue' | 'teal' | 'rose' | 'amber' | 'slate' | 'indigo' | 'mint' | 'coral';
type Appearance = 'dark' | 'light';

type Attempt = {
  attemptId: string;
  ids: string[];
  answers: Record<string, number>;
  marked: string[];
  index: number;
  mode: SolverMode;
  startedAt: number;
  title: string;
  duration: number;
};

type AnswerRecord = Omit<CloudAnswerRecord, 'answered_at'> & { answeredAt: number };

function cloudAnswerToLocal(record: CloudAnswerRecord): AnswerRecord {
  return { ...record, answeredAt: new Date(record.answered_at).getTime() };
}

type Result = {
  id?: string;
  title: string;
  ids: string[];
  answers: Record<string, number>;
  startedAt: number;
  finishedAt: number;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
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

// Clean display copy for the first scanned page. The source OCR mixed the two
// columns together, so the option text must not be inferred from that OCR blob.
// The remaining questions still use the generic parser below until their source
// text is normalized.
const QUESTION_DISPLAY_OVERRIDES: Record<string, { stem: string; options: string[] }> = {
  'reneet-2026-code60-q1': {
    stem: 'An ac voltage V = 220 sin(2 × 10³t) Volt is applied to a series LCR circuit. Then the current amplitude in this circuit is: (Given: L = 10 mH, C = 25 μF, R = 100 Ω)',
    options: ['11.0 A', '22.0 A', '2.2 A', '5.5 A'],
  },
  'reneet-2026-code60-q2': {
    stem: 'The mean free path of molecules in an ideal gas A is half that of another ideal gas B. The diameter of the spherical molecules of gas A is twice the diameter of the molecules of B. If number densities of the gases A and B are nA and nB, respectively, the correct option is:',
    options: ['nA = ¼ nB', 'nA = ½ nB', 'nA = nB', 'nA = 2nB'],
  },
  'reneet-2026-code60-q3': {
    stem: 'A cylindrical cork of uniform density floats in a liquid of density ρ₁. If the cork is depressed slightly and released, it oscillates harmonically with time period T. If the same cork floats in another liquid of density ρ₂, then the similar oscillation has time period 2T. The value of ρ₂/ρ₁ is:',
    options: ['1/2', '1/4', '4', '2'],
  },
  'reneet-2026-code60-q4': {
    stem: 'Consider a spring-mass simple harmonic oscillator in one dimension. The mass of the particle is m kg and the spring constant is k Nm⁻¹. At a given instant, the extension of the spring is x meter and the speed of the particle is v ms⁻¹. On the x-v plane, if the graph of v as a function of x is a circle, then the correct option is:',
    options: ['k = m²', 'k/m = √m', 'k = 1/m', 'k = m'],
  },
  'reneet-2026-code60-q5': {
    stem: 'In an adiabatic expansion, the temperature of one mole of an ideal monatomic gas (γ = 5/3) decreases from 60 K to 50 K. The work done by the gas in the process is: (Take the universal gas constant as R = 8.3 J mol⁻¹ K⁻¹)',
    options: ['124.5 J', '166 J', '41.5 J', '83 J'],
  },
  'reneet-2026-code60-q6': {
    stem: 'The following table presents the part of the electromagnetic spectrum and their corresponding major applications. The correct option is:',
    options: ['P-II, Q-I, R-IV, S-III', 'P-II, Q-IV, R-III, S-I', 'P-I, Q-II, R-III, S-IV', 'P-I, Q-IV, R-II, S-III'],
  },
  'reneet-2026-code60-q7': {
    stem: 'A unit positive point charge is taken slowly through an infinitesimally thin tube that is inside a charged dielectric sphere of radius R, having uniform positive charge density ρ, as shown in the figure. The initial and final positions of the charge are marked by A and B at distances 2R and 3R respectively, from the centre of the sphere. In this process, the magnitude of the total work done on the point charge is ρR²/(nε₀). The value of n is: (ε₀ is the permittivity of vacuum)',
    options: ['9', '18', '2', '6'],
  },
  'reneet-2026-code60-q9': {
    stem: 'Bob B of mass m at rest is hanging vertically from the ceiling via a massless string of length 10 m, as shown in the figure. Point mass A of mass m travelling horizontally with speed 10 ms⁻¹ hits bob B elastically. The bob B rises h meter after the collision. Taking the acceleration due to gravity g = 10 ms⁻² and neglecting the size of the bob, the value of h is:',
    options: ['5', '2.5', '8', '7'],
  },
  'reneet-2026-code60-q10': {
    stem: 'An ideal gas is made of polyatomic molecules. Each of the molecules has three translational, three rotational and f number of vibrational modes. If the ratio of heat capacities CP/CV of the gas is 8/7, then the value of f is:',
    options: ['2', '1', '4', '3'],
  },
};

function getQuestionDisplay(q: Question) {
  const override = QUESTION_DISPLAY_OVERRIDES[q.id];
  if (override) return override;

  const raw = q.question.replace(/\s+/g, ' ').trim();
  const supplied = Array.isArray(q.options) ? q.options.map(x => String(x ?? '').trim()) : [];
  const hasRealOptions = supplied.length >= 4 && supplied.slice(0, 4).some((x, i) => x && x.toUpperCase() !== OPTION_LABELS[i] && !/^Choice\s+[A-D]$/i.test(x));
  if (hasRealOptions) return { stem: raw, options: supplied.slice(0, 4) };

  const re = /\((1|2|3|4)\)\s*[-:.)]?\s*/g;
  const matches = Array.from(raw.matchAll(re));
  if (matches.length >= 4) {
    const firstFour = matches.slice(0, 4);
    const nums = firstFour.map(m => Number(m[1]));
    if (nums.join(',') === '1,2,3,4' && firstFour[0].index != null) {
      const stem = raw.slice(0, firstFour[0].index).replace(/[\s/_-]+$/, '').trim();
      const options = firstFour.map((m, i) => {
        const start = (m.index ?? 0) + m[0].length;
        const end = i < 3 ? (firstFour[i + 1].index ?? raw.length) : raw.length;
        return raw.slice(start, end).replace(/\s*[\/_]+\s*$/g, '').trim();
      });
      if (options.every(Boolean)) return { stem, options };
    }
  }

  return { stem: raw, options: supplied.length >= 4 ? supplied.slice(0, 4) : OPTION_LABELS.map(x => `Choice ${x}`) };
}
const STORAGE = {
  saved: 'neetprep-saved-v3',
  mistakes: 'neetprep-mistakes-v3',
  notes: 'neetprep-notes-v3',
  daily: 'neetprep-daily-v3',
  target: 'neetprep-target-v3',
  results: 'neetprep-results-v3',
  answers: 'neetprep-answer-history-v1',
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

function getStreakDays(activity: Record<string, number>) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if ((activity[key] ?? 0) <= 0) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function MobileIcon({ name }: { name: 'home' | 'practice' | 'test' | 'progress' | 'spark' | 'book' | 'target' | 'flame' | 'arrow' }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>;
  if (name === 'practice') return <svg {...common}><circle cx="12" cy="12" r="7"/><path d="M3 12h6m6 0h6"/><circle cx="12" cy="12" r="2"/></svg>;
  if (name === 'test') return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (name === 'progress') return <svg {...common}><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Z"/><path d="m19 14 .6 2.1L22 17l-2.4.9L19 20l-.6-2.1L16 17l2.4-.9L19 14Z"/></svg>;
  if (name === 'book') return <svg {...common}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5Z"/><path d="M5 4.5v17M9 6h7M9 10h7"/></svg>;
  if (name === 'target') return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>;
  if (name === 'flame') return <svg {...common}><path d="M12 21c4 0 7-2.7 7-6.6 0-3.4-2.2-5.9-4.4-8.4-.2 2-1 3.3-2.1 4.3.2-3.5-1.8-6.1-4.2-8.3.1 3.5-3.3 5.7-3.3 10.2C5 18 8 21 12 21Z"/><path d="M12 21c-1.8-.7-2.8-2.2-2.8-4 0-1.6 1-2.8 2.2-4 0 1.5 1 2.2 2 3 .5-1 .8-1.8.8-2.7 1.1 1.2 1.6 2.4 1.6 3.7 0 1.8-1.5 3.3-3.8 4Z"/></svg>;
  return <svg {...common}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
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

function getSubjectStats(answerHistory: AnswerRecord[]) {
  const stats: Record<string, { attempted: number; correct: number; incorrect: number }> = {
    Physics: { attempted: 0, correct: 0, incorrect: 0 },
    Chemistry: { attempted: 0, correct: 0, incorrect: 0 },
    Biology: { attempted: 0, correct: 0, incorrect: 0 },
  };
  answerHistory.forEach(item => {
    if (!stats[item.subject]) return;
    stats[item.subject].attempted += 1;
    if (item.is_correct) stats[item.subject].correct += 1;
    else stats[item.subject].incorrect += 1;
  });
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
  const [target, setTarget] = useState<number>(() => Number(localStorage.getItem(STORAGE.target) || 650));
  const [results, setResults] = useState<Result[]>(() => read(STORAGE.results, []));
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>(() => read(STORAGE.answers, []));
  const [theme, setTheme] = useState<ThemeId>('teal');
  const [appearance, setAppearance] = useState<Appearance>('dark');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'All' | Question['subject']>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'RE-NEET 2026'>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [solver, setSolver] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mockSubjects, setMockSubjects] = useState<Question['subject'][]>(['Physics', 'Chemistry', 'Biology']);
  const [mockCount, setMockCount] = useState(180);
  const [mockDuration, setMockDuration] = useState(180);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState('');


  async function loadStudentAnnouncements() {
    setAnnouncementBusy(true);
    try {
      const { data, error } = await supabase
        .from('teacher_announcements')
        .select('id,title,body,created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setAnnouncements((data ?? []) as Announcement[]);
    } catch (error) {
      console.error('Could not load announcements', error);
    } finally {
      setAnnouncementBusy(false);
    }
  }

  useEffect(() => {
    void loadStudentAnnouncements();
    const channel = supabase
      .channel('student-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_announcements' }, () => {
        void loadStudentAnnouncements();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE.theme);
    if (savedTheme && THEMES.some(t => t.id === savedTheme)) setTheme(savedTheme as ThemeId);
    setAppearance(localStorage.getItem(STORAGE.appearance) === 'light' ? 'light' : 'dark');

    let cancelled = false;
    const hydrate = async (nextUser: User | null) => {
      setUser(nextUser);
      setCloudReady(false);
      setCloudError('');
      if (!nextUser || !cloudEnabled()) return;
      try {
        const snapshot = await loadCloudSnapshot(nextUser);
        if (cancelled || !snapshot) return;

        const pendingMigration = localStorage.getItem('neetprep-pending-migration') === '1';
        if (pendingMigration) {
          const localSaved = read<string[]>(STORAGE.saved, []);
          const localMistakes = read<string[]>(STORAGE.mistakes, []);
          const localNotes = read<Record<string, string>>(STORAGE.notes, {});
          const localDaily = read<Record<string, number>>(STORAGE.daily, {});
          const localResults = read<Result[]>(STORAGE.results, []);
          const localAnswers = read<AnswerRecord[]>(STORAGE.answers, []);
          const localTarget = Number(localStorage.getItem(STORAGE.target) || 650);
          const legacyAnswerRecords: AnswerRecord[] = [];
          if (!localAnswers.length) {
            localResults.forEach(result => result.ids.forEach(id => {
              const q = questions.find(item => item.id === id) as Question | undefined;
              const selected = result.answers[id];
              if (!q || selected === undefined || q.status === 'dropped') return;
              legacyAnswerRecords.push({
                id: `${result.id ?? `${result.startedAt}-${result.finishedAt}`}:${id}`,
                question_id: id,
                selected_index: selected,
                is_correct: answerIsCorrect(q, selected),
                subject: q.subject,
                mode: result.title.toLowerCase().includes('practice') ? 'practice' : 'mock',
                answeredAt: result.finishedAt,
              });
            }));
          }
          const allLocalAnswers = [...localAnswers, ...legacyAnswerRecords];

          const mergedSaved = Array.from(new Set([...snapshot.saved, ...localSaved]));
          const mergedMistakes = Array.from(new Set([...snapshot.mistakes, ...localMistakes]));
          const mergedNotes = { ...snapshot.notes, ...localNotes };
          const mergedDaily = { ...snapshot.daily };
          Object.entries(localDaily).forEach(([day, count]) => { mergedDaily[day] = Math.max(mergedDaily[day] ?? 0, count); });

          await syncQuestionStates(nextUser, mergedSaved, mergedMistakes, mergedNotes);
          await syncDailyActivity(nextUser, mergedDaily);
          if (allLocalAnswers.length) await syncAnswerRecords(nextUser, allLocalAnswers);
          for (const item of localResults.slice(0, 30)) {
            const id = item.id ?? crypto.randomUUID();
            await syncAttempt(nextUser, {
              id, title: item.title, mode: item.title.toLowerCase().includes('practice') ? 'practice' : 'mock',
              question_ids: item.ids, answers: item.answers,
              started_at: new Date(item.startedAt).toISOString(), finished_at: new Date(item.finishedAt).toISOString(),
              duration_seconds: Math.max(0, Math.floor((item.finishedAt - item.startedAt) / 1000)),
              ...scoreAttempt(item.ids, item.answers),
            });
          }
          await upsertProfile(nextUser, { target: localTarget, theme, appearance });
          localStorage.removeItem('neetprep-pending-migration');

          setSaved(mergedSaved);
          setMistakes(mergedMistakes);
          setNotes(mergedNotes);
          setDaily(mergedDaily);
          const cloudAnswers = snapshot.answers.map(cloudAnswerToLocal);
          const mergedAnswers = [...cloudAnswers, ...allLocalAnswers].filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
          await syncAnswerRecords(nextUser, mergedAnswers);
          setAnswerHistory(mergedAnswers);
          setTarget(localTarget);
          const cloudResults = snapshot.results.map(item => ({
            id: item.id, title: item.title, ids: item.question_ids, answers: item.answers,
            startedAt: new Date(item.started_at).getTime(), finishedAt: new Date(item.finished_at).getTime(),
          }));
          const cloudIds = new Set(cloudResults.map(item => item.id));
          const migratedResults = localResults.map(item => ({ ...item, id: item.id ?? crypto.randomUUID() })).filter(item => !cloudIds.has(item.id));
          setResults([...migratedResults, ...cloudResults].slice(0, 30));
        } else {
          const localAnswers = read<AnswerRecord[]>(STORAGE.answers, []);
          const cloudAnswers = snapshot.answers.map(cloudAnswerToLocal);
          const mergedAnswers = [...cloudAnswers, ...localAnswers].filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
          if (localAnswers.length) await syncAnswerRecords(nextUser, localAnswers);
          setSaved(snapshot.saved);
          setMistakes(snapshot.mistakes);
          setNotes(snapshot.notes);
          setDaily(snapshot.daily);
          setAnswerHistory(mergedAnswers);
        }

        setTarget(snapshot.target);
        setResults(snapshot.results.map(item => ({
          id: item.id,
          title: item.title,
          ids: item.question_ids,
          answers: item.answers,
          startedAt: new Date(item.started_at).getTime(),
          finishedAt: new Date(item.finished_at).getTime(),
        })));
        if (snapshot.theme && THEMES.some(t => t.id === snapshot.theme)) setTheme(snapshot.theme as ThemeId);
        if (snapshot.appearance === 'light' || snapshot.appearance === 'dark') setAppearance(snapshot.appearance);
        setCloudReady(true);
      } catch (error) {
        console.error('neetprep cloud hydrate failed', error);
        if (!cancelled) setCloudError('Cloud sync is unavailable right now. Your local progress is still safe.');
      }
    };

    supabase.auth.getSession().then(({ data }) => hydrate(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { void hydrate(session?.user ?? null); });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => localStorage.setItem(STORAGE.theme, theme), [theme]);
  useEffect(() => { localStorage.setItem(STORAGE.appearance, appearance); document.documentElement.dataset.theme = appearance; }, [appearance]);
  useEffect(() => localStorage.setItem(STORAGE.saved, JSON.stringify(saved)), [saved]);
  useEffect(() => localStorage.setItem(STORAGE.mistakes, JSON.stringify(mistakes)), [mistakes]);
  useEffect(() => localStorage.setItem(STORAGE.notes, JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem(STORAGE.daily, JSON.stringify(daily)), [daily]);
  useEffect(() => localStorage.setItem(STORAGE.target, String(target)), [target]);
  useEffect(() => localStorage.setItem(STORAGE.results, JSON.stringify(results)), [results]);
  useEffect(() => localStorage.setItem(STORAGE.answers, JSON.stringify(answerHistory)), [answerHistory]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    const timer = window.setTimeout(() => {
      setCloudSyncing(true);
      syncQuestionStates(user, saved, mistakes, notes)
        .catch(error => { console.error(error); setCloudError('Could not sync revision data. Changes remain on this device.'); })
        .finally(() => setCloudSyncing(false));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, saved, mistakes, notes]);

  useEffect(() => {
    if (!user || !cloudReady || !answerHistory.length) return;
    const timer = window.setTimeout(() => {
      syncAnswerRecords(user, answerHistory).catch(error => { console.error(error); setCloudError('Could not sync answer history.'); });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, answerHistory]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    const timer = window.setTimeout(() => {
      syncDailyActivity(user, daily).catch(error => { console.error(error); setCloudError('Could not sync daily activity.'); });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, daily]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    const timer = window.setTimeout(() => {
      upsertProfile(user, { target, theme, appearance }).catch(error => { console.error(error); setCloudError('Could not sync profile settings.'); });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user, cloudReady, target, theme, appearance]);

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
  const dailyGoal = 20;
  const streakDays = getStreakDays(daily);
  const dailyPct = Math.min(100, Math.round((today / dailyGoal) * 100));
  const stats = useMemo(() => getSubjectStats(answerHistory), [answerHistory]);
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
    setSolver({ attemptId: crypto.randomUUID(), ids: valid.map(q => q.id), answers: {}, marked: [], index: 0, mode, startedAt: Date.now(), title, duration });
  }

  function openPracticeQuestion(q: Question) {
    setResult(null);
    setSolver({ attemptId: crypto.randomUUID(), ids: [q.id], answers: {}, marked: [], index: 0, mode: 'practice', startedAt: Date.now(), title: 'Practice question', duration: 0 });
  }

  function chooseAnswer(value: number) {
    if (!solver || !current) return;
    const previous = solver.answers[current.id];
    setSolver(prev => prev ? { ...prev, answers: { ...prev.answers, [current.id]: value } } : prev);

    const record: AnswerRecord = {
      id: `${solver.attemptId}:${current.id}`,
      question_id: current.id,
      selected_index: value,
      is_correct: answerIsCorrect(current, value),
      subject: current.subject,
      mode: solver.mode,
      answeredAt: Date.now(),
    };
    setAnswerHistory(prev => {
      const existing = prev.findIndex(item => item.id === record.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = record;
        return next;
      }
      return [...prev, record];
    });

    if (solver.mode === 'practice') {
      if (previous === undefined) setDaily(prev => ({ ...prev, [todayKey()]: (prev[todayKey()] ?? 0) + 1 }));
      if (current.status !== 'dropped') {
        if (answerIsCorrect(current, value)) setMistakes(prev => prev.filter(id => id !== current.id));
        else setMistakes(prev => prev.includes(current.id) ? prev : [...prev, current.id]);
      }
      if (user && cloudReady) syncAnswerRecords(user, [record]).catch(error => { console.error(error); setCloudError('Could not sync this answer yet. It remains saved locally.'); });
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
    const finished: Result = { id: crypto.randomUUID(), title: solver.title, ids: solver.ids, answers: solver.answers, startedAt: solver.startedAt, finishedAt: Date.now() };
    setSubmitConfirmOpen(false);
    const score = scoreAttempt(finished.ids, finished.answers);
    if (user && cloudReady) {
      const records = finished.ids.map(id => {
        const q = questions.find(item => item.id === id) as Question | undefined;
        const selected = finished.answers[id];
        if (!q || selected === undefined || q.status === 'dropped') return null;
        return {
          id: `${solver.attemptId}:${id}`,
          question_id: id,
          selected_index: selected,
          is_correct: answerIsCorrect(q, selected),
          subject: q.subject,
          mode: solver.mode,
          answeredAt: finished.finishedAt,
        } as AnswerRecord;
      }).filter(Boolean) as AnswerRecord[];
      if (records.length) syncAnswerRecords(user, records).catch(error => { console.error(error); setCloudError('Attempt saved, but answer history sync failed.'); });
      const cloudAttempt: CloudAttempt = {
        id: finished.id!,
        title: finished.title,
        mode: solver.mode,
        question_ids: finished.ids,
        answers: finished.answers,
        started_at: new Date(finished.startedAt).toISOString(),
        finished_at: new Date(finished.finishedAt).toISOString(),
        duration_seconds: Math.max(0, Math.floor((finished.finishedAt - finished.startedAt) / 1000)),
        ...score,
      };
      syncAttempt(user, cloudAttempt).catch(error => { console.error(error); setCloudError('Attempt saved locally, but cloud sync failed.'); });
    }
    setResults(prev => [finished, ...prev].slice(0, 30));
    if (solver.mode === 'mock') {
      setResult(finished);
      setSolver(null);
      showToast(auto ? 'Time is up. Test submitted.' : 'Test submitted successfully.');
    } else {
      setSolver(null);
      setTab('practice');
      showToast(score.unanswered ? `Answer saved · ${score.unanswered} unanswered` : 'Answer saved');
    }
  }



  async function signInOrUp() {
    setAuthMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setAuthMessage('Enter your email address.');
    if (authMode !== 'reset' && password.length < 6) return setAuthMessage('Password must be at least 6 characters.');
    if (authMode === 'up' && password !== confirmPassword) return setAuthMessage('Passwords do not match.');

    setAuthBusy(true);
    try {
      if (authMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin });
        if (error) setAuthMessage(error.message);
        else setAuthMessage('Password reset email sent. Check your inbox.');
        return;
      }

      if (authMode === 'up') {
        localStorage.setItem('neetprep-pending-migration', '1');
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: displayName.trim() || cleanEmail.split('@')[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          localStorage.removeItem('neetprep-pending-migration');
          setAuthMessage(error.message);
          return;
        }
        if (!data.session) {
          setAuthMessage('Account created. Check your email to verify it, then log in.');
        } else {
          setAuthMessage('Account created. Your progress is being backed up.');
          setTimeout(() => setAuthOpen(false), 700);
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) setAuthMessage(error.message);
      else {
        setAuthMessage('Signed in. Restoring your progress…');
        setTimeout(() => setAuthOpen(false), 600);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  function switchAuthMode(next: 'in' | 'up' | 'reset') {
    setAuthMode(next);
    setAuthMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  function go(next: Tab) { setTab(next); setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function openAnnouncements() {
    setAnnouncementOpen(true);
    void loadStudentAnnouncements();
  }

  function renderAnnouncementsCard() {
    const latest = announcements[0];
    return <section className="student-announcement-card">
      <div className="student-announcement-icon">✦</div>
      <div className="student-announcement-copy">
        <span className="ph-kicker">TEACHER UPDATES <i>·</i> {announcements.length ? `${announcements.length} live` : 'ALL CLEAR'}</span>
        <strong>{latest ? latest.title : 'Nothing new right now.'}</strong>
        <p>{latest ? latest.body : 'Your teachers will post DPP releases, schedule changes and important instructions here.'}</p>
      </div>
      <button onClick={openAnnouncements}>{latest ? 'View all' : 'Open'} <span>→</span></button>
    </section>;
  }

  function renderMobileHome() {
    return <StudentExperience
      user={user}
      target={target}
      setTarget={setTarget}
      stats={stats as Record<'Physics' | 'Chemistry' | 'Biology', { attempted: number; correct: number; incorrect: number }>}
      totalAnswered={totalAnswered}
      overallAccuracy={overallAccuracy}
      today={today}
      dailyGoal={dailyGoal}
      streakDays={streakDays}
      mistakes={mistakes}
      saved={saved}
      activity={daily}
      announcementsCount={announcements.length}
      onAnnouncements={openAnnouncements}
      onAppearance={() => setAppearanceOpen(true)}
      onPractice={(count, title, ids) => {
        const pool = ids?.length ? questions.filter(q => ids.includes(q.id) && q.status !== 'dropped') : questions.filter(q => q.status !== 'dropped');
        startAttempt(pool.slice(0, count), 'practice', title);
      }}
      onGo={(next) => go(next)}
      questionIds={questions.map(q => q.id)}
      subjectQuestionIds={{
        Physics: questions.filter(q => q.subject === 'Physics' && q.status !== 'dropped').map(q => q.id),
        Chemistry: questions.filter(q => q.subject === 'Chemistry' && q.status !== 'dropped').map(q => q.id),
        Biology: questions.filter(q => q.subject === 'Biology' && q.status !== 'dropped').map(q => q.id),
      }}
    />;
  }

  function renderHome() {
    return <main className="page home-page coaching-home-page">
      <div className="student-home-stage">{renderMobileHome()}</div>
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

  function renderPracticeSolver() {
    if (!solver || !current) return null;
    const selected = solver.answers[current.id];
    const answered = selected !== undefined;
    const qIndex = questions.indexOf(current);
    const subjectClass = current.subject.toLowerCase();
    const correct = answered && answerIsCorrect(current, selected);
    const showResult = answered;
    const sourcePage = current.sourcePage;
    const display = getQuestionDisplay(current);

    return <div className="practice-overlay">
      <div className="practice-shell">
        <header className="practice-topbar">
          <button className="practice-back" onClick={() => { setSolver(null); go('practice'); }}>‹ <span>Question Bank</span></button>
          <div className="practice-top-title"><b>Practice</b><span>{current.subject} · {current.year} · Code 60</span></div>
          <div className="practice-top-actions">
            <button className={saved.includes(current.id) ? 'active' : ''} onClick={() => toggleSaved(current.id)} aria-label="Bookmark">{saved.includes(current.id) ? '★' : '☆'}</button>
            <button onClick={() => setReportOpen(true)} aria-label="Report">⋯</button>
          </div>
        </header>

        <div className="practice-filterbar">
          <button onClick={() => { setSubjectFilter('All'); go('practice'); }}>Subject & Chapter <span>⌄</span></button>
          <button onClick={() => { setDifficultyFilter('All'); go('practice'); }}>Difficulty <span>⌄</span></button>
          <button onClick={() => { setSourceFilter('All'); go('practice'); }}>Previous Year <span>⌄</span></button>
          <button className="filter-active">RE-NEET 2026</button>
          <button onClick={() => go('saved')}>☆ Saved</button>
          <button onClick={() => go('mistakes')}>ⓧ Incorrect</button>
          <button className="filter-qno">▦ Q. No.</button>
        </div>

        <main className="practice-content">
          <div className="practice-question-card">
            <div className="practice-question-head">
              <div><span className={`practice-subject ${subjectClass}`}>{current.subject}</span><span className="practice-qmeta">Question {qIndex + 1} · {current.difficulty}</span></div>
              <div className="practice-card-actions"><button className={saved.includes(current.id) ? 'active' : ''} onClick={() => toggleSaved(current.id)}>▱</button><button onClick={() => setReportOpen(true)}>↗</button></div>
            </div>
            <div className="practice-question-text">{display.stem}</div>
            <div className="practice-tags"><span>{current.source || 'NEET question'}</span><span>Level: {current.difficulty}</span>{current.status === 'dropped' && <span className="dropped-tag">Dropped by NTA</span>}</div>
            {sourcePage && <button className="practice-source-link" onClick={() => window.open(`/source-pages/page-${sourcePage}.jpg`, '_blank')}>View original paper scan ↗</button>}
          </div>

          <div className="practice-options-heading"><strong>Answer choices</strong><span>Select one option</span></div>
          <div className="practice-options">
            {OPTION_LABELS.map((label, i) => {
              const isSelected = selected === i;
              const isCorrect = answered && answerIsCorrect(current, i);
              return <button key={label} className={`practice-option ${isSelected ? 'selected' : ''} ${showResult && isCorrect ? 'correct' : ''} ${showResult && isSelected && !isCorrect ? 'wrong' : ''}`} onClick={() => chooseAnswer(i)} disabled={current.status === 'dropped'}>
                <span className="practice-option-number">{i + 1}</span><span className="practice-option-copy"><b>{label}</b>{display.options[i]}</span><span className="practice-option-state">{showResult && isCorrect ? '✓' : isSelected ? '●' : ''}</span>
              </button>;
            })}
          </div>

          {showResult && current.status !== 'dropped' && <section className={`practice-answer-panel ${correct ? 'is-correct' : 'is-wrong'}`}>
            <div><strong>{correct ? 'Correct answer' : 'Review this one'}</strong><span>Official answer: {answerLabel(current)}</span></div>
            <button onClick={() => setNoteOpen(true)}>＋ Add Note</button>
          </section>}

          <div className="practice-actionbar">
            <div className="practice-action-group">
              <button className="solver-action-icon" onClick={() => setNoteOpen(true)} aria-label="Add note"><span>✎</span><b>Note</b></button>
              <button className={`solver-action-icon ${saved.includes(current.id) ? 'active' : ''}`} onClick={() => toggleSaved(current.id)} aria-label="Save question"><span>{saved.includes(current.id) ? '★' : '☆'}</span><b>{saved.includes(current.id) ? 'Saved' : 'Save'}</b></button>
              <button className="solver-action-icon solver-more" onClick={() => setReportOpen(true)} aria-label="More actions"><span>•••</span><b>More</b></button>
            </div>
            <button className="practice-next" onClick={nextQuestion}><span>{qIndex === questions.length - 1 ? 'Finish' : 'Next Question'}</span><b>→</b></button>
          </div>
        </main>
      </div>
    </div>;
  }

  function renderSolver() {
    if (solver?.mode === 'practice') return renderPracticeSolver();
    if (!solver || !current) return null;
    const selected = solver.answers[current.id];
    const answered = selected !== undefined;
    const sourcePage = current.sourcePage;
    const answeredCount = Object.keys(solver.answers).length;
    const validIds = solver.ids.filter(id => (questions.find(q => q.id === id) as Question | undefined)?.status !== 'dropped');
    const notAnsweredCount = Math.max(0, validIds.length - validIds.filter(id => solver.answers[id] !== undefined).length);
    const markedCount = solver.marked.length;
    const currentNumber = solver.index + 1;
    const display = getQuestionDisplay(current);
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
            <div className="cbt-question-text">{display.stem}</div>
            <div className="cbt-source-toggle"><button onClick={() => sourcePage && window.open(`/source-pages/page-${sourcePage}.jpg`, '_blank')}>View original paper scan ↗</button><span>Use the scan for diagrams / exact option typography.</span></div>
            <div className="cbt-options-heading"><strong>Answer choices</strong><span>Select one option</span></div>
            <div className="cbt-options">{OPTION_LABELS.map((label, i) => <button key={label} className={`cbt-option ${selected === i ? 'selected' : ''}`} onClick={() => chooseAnswer(i)} disabled={current.status === 'dropped'}><span className="option-radio">{selected === i ? '●' : '○'}</span><b>{label}.</b><span className="cbt-option-label">{display.options[i]}</span></button>)}</div>
          </section>
          <div className="cbt-actions-mobile">
            <button className="cbt-mobile-tool" onClick={() => { if (solver.index > 0) jumpToQuestion(solver.index - 1); }} disabled={solver.index === 0}><span>‹</span><b>Back</b></button>
            <button className="cbt-mobile-tool" onClick={clearResponse} disabled={!answered}><span>⌫</span><b>Clear</b></button>
            <button className={`cbt-mobile-tool ${solver.marked.includes(current.id) ? 'active' : ''}`} onClick={markReviewAndNext}><span>⚑</span><b>Review</b></button>
            <button className="cbt-mobile-primary" onClick={saveAndNext}><span>{currentNumber === solver.ids.length ? 'Submit' : 'Next'}</span><b>→</b></button>
            <button className="cbt-mobile-end" onClick={() => setSubmitConfirmOpen(true)} aria-label="End test">•••</button>
          </div>
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
      <footer className="cbt-footer"><button className="cbt-back-btn" onClick={() => { if (solver.index > 0) jumpToQuestion(solver.index - 1); }} disabled={solver.index === 0}>‹ Back</button><div className="cbt-footer-center"><span>Question {currentNumber} of {solver.ids.length}</span><div className="cbt-dots"><i style={{width:`${(currentNumber/solver.ids.length)*100}%`}}/></div></div><div className="cbt-footer-right"><button onClick={clearResponse} disabled={!answered}>Clear Response</button><button onClick={markReviewAndNext}>Mark for Review & Next</button><button className="primary-button" onClick={saveAndNext}>{currentNumber === solver.ids.length ? 'Save & Submit' : 'Save & Next'}</button><button className="cbt-end-btn" onClick={() => setSubmitConfirmOpen(true)}>End Test</button></div></footer>
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
  const mobilePolishCss = `
    :root{--app-bg:#071013;--app-panel:#10171b;--app-panel-2:#141c20;--app-line:rgba(255,255,255,.08);--app-muted:#8d999f}
    *{box-sizing:border-box}
    html,body,#root{min-height:100%;margin:0}
    body{background:var(--app-bg);color:var(--text,#f4f6f7);font-family:Manrope,Inter,system-ui,sans-serif}
    button,input,textarea,select{font:inherit}
    .app{min-height:100vh;background:radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--accent) 7%,transparent),transparent 38%),var(--app-bg)}
    .top-nav{height:70px;padding:0 28px;display:flex;align-items:center;gap:28px;border-bottom:1px solid var(--app-line);background:rgba(7,16,19,.88);backdrop-filter:blur(20px);position:sticky;top:0;z-index:40}
    .brand{border:0;background:none;color:var(--text);display:flex;align-items:center;gap:10px;font-weight:900;font-size:20px;letter-spacing:-.8px;cursor:pointer}.brand>span:last-child>span{color:var(--accent)}.brand-mark{width:38px;height:38px;border-radius:12px;background:var(--accent);color:#071013;display:grid;place-items:center;font-weight:950}
    .top-nav nav{display:flex;gap:3px;align-items:center;flex:1}.top-nav nav button{border:0;background:transparent;color:var(--app-muted);padding:10px 12px;border-radius:11px;font-size:12px;font-weight:800;cursor:pointer}.top-nav nav button.active{background:rgba(255,255,255,.07);color:var(--text)}
    .nav-actions{display:flex;align-items:center;gap:8px}.nav-actions button{cursor:pointer}.nav-theme,.nav-search,.nav-bell,.nav-login{height:38px;border:1px solid var(--app-line);background:rgba(255,255,255,.035);color:var(--text);border-radius:12px;padding:0 11px;font-size:10px;font-weight:800}.nav-theme i{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}.nav-bell{width:38px;padding:0;position:relative}.nav-bell i{position:absolute;right:3px;top:3px;min-width:13px;height:13px;border-radius:8px;background:#ff746d;color:#fff;font-size:7px;font-style:normal;display:grid;place-items:center}.nav-avatar{width:38px;height:38px;border-radius:50%;border:1px solid var(--app-line);background:rgba(255,255,255,.07);color:var(--text);font-weight:900}.page{max-width:1180px;margin:0 auto;padding:30px 28px 80px}.coaching-home-page{max-width:100%;padding:0 0 100px}.student-home-stage{width:100%;max-width:1180px;margin:0 auto;padding:0 28px}
    .page-title{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}.page-title h1{font-size:42px;letter-spacing:-1.5px;margin:8px 0}.page-title p{max-width:650px;color:var(--app-muted);font-size:13px;line-height:1.55}.section-kicker{font-size:9px;letter-spacing:1.25px;color:var(--app-muted);font-weight:900}
    .primary-button{border:0;border-radius:13px;background:var(--accent);color:#071013;padding:12px 16px;font-weight:950;cursor:pointer}.secondary-button{border:1px solid var(--app-line);border-radius:13px;background:rgba(255,255,255,.045);color:var(--text);padding:12px 16px;font-weight:850;cursor:pointer}.primary-button.full{width:100%}.compact{padding:10px 13px}
    .section-block,.performance-panel,.builder-card,.mock-rules-card,.question-list,.metrics-grid{border-color:var(--app-line)}
    .question-row,.history-row,.revision-card,.subject-card,.metric-card,.performance-panel,.builder-card,.mock-rules-card,.empty-state{background:var(--app-panel);border:1px solid var(--app-line);border-radius:18px}
    .question-row:hover,.history-row:hover,.revision-card:hover,.subject-card:hover{background:var(--app-panel-2)}
    .mobile-bottom{display:none}
    .modal-backdrop{background:rgba(0,0,0,.68);backdrop-filter:blur(10px);z-index:100}.modal{background:#11191d;border:1px solid rgba(255,255,255,.09);border-radius:24px;color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.45)}
    .toast{border:1px solid var(--app-line);background:#151d21;color:var(--text);border-radius:14px}
    @media(max-width:760px){
      .top-nav{display:none}.page{padding:0 16px 112px}.coaching-home-page{padding:0 0 112px}.student-home-stage{padding:0 14px;max-width:none}.mobile-bottom{position:fixed;left:12px;right:12px;bottom:12px;height:72px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;align-items:center;padding:5px;border:1px solid rgba(255,255,255,.09);border-radius:25px;background:rgba(15,21,25,.92);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);box-shadow:0 16px 50px rgba(0,0,0,.42);z-index:80}.mobile-bottom button{border:0;background:transparent;color:#778188;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:60px;border-radius:20px;cursor:pointer}.mobile-bottom button.active{color:var(--accent);background:rgba(255,255,255,.045)}.mobile-bottom b{font-size:8px}.mobile-bottom .mobile-plus{width:62px;height:62px;justify-self:center;margin-top:-22px;border-radius:21px;background:var(--accent);color:#071013;box-shadow:0 12px 30px color-mix(in srgb,var(--accent) 28%,transparent);font-size:31px;font-weight:300}.mobile-bottom .mobile-plus b{display:none}.mobile-bottom .mobile-plus span{display:grid;place-items:center}.page-title{align-items:flex-start;flex-direction:column;margin-bottom:18px}.page-title h1{font-size:31px}.metrics-grid{grid-template-columns:1fr 1fr}.question-row{border-radius:16px}.practice-overlay{position:fixed!important;inset:0!important}.practice-shell{border-radius:0!important}.result-sheet{width:min(94vw,560px)!important}.modal{width:min(92vw,560px)}
    }
    @media(min-width:761px){.student-home-stage{padding:22px 0 0}.coaching-home-page{background:radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--accent) 5%,transparent),transparent 30%)}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    /* APPLE UI 2.0 TARGETED CBT + NAV POLISH, based on the last Apple baseline */
    .mobile-bottom{height:68px!important;left:18px!important;right:18px!important;bottom:max(12px,env(safe-area-inset-bottom))!important;padding:6px!important;border-radius:24px!important;background:color-mix(in srgb,var(--np-surface) 86%,transparent)!important;border:1px solid color-mix(in srgb,var(--np-text) 10%,transparent)!important;box-shadow:0 18px 55px rgba(0,0,0,.30),inset 0 1px rgba(255,255,255,.045)!important;backdrop-filter:blur(30px) saturate(150%)!important;-webkit-backdrop-filter:blur(30px) saturate(150%)!important}
    .mobile-bottom button{height:54px!important;border-radius:18px!important;gap:3px!important;color:color-mix(in srgb,var(--np-text) 48%,transparent)!important}.mobile-bottom button.active{background:color-mix(in srgb,var(--apple-blue) 11%,transparent)!important;color:var(--apple-blue)!important}.mobile-bottom b{font-size:9px!important;font-weight:800!important}.mobile-bottom .mobile-plus{width:50px!important;height:50px!important;margin-top:-10px!important;border-radius:50%!important;background:var(--apple-blue)!important;color:#fff!important;box-shadow:0 10px 26px color-mix(in srgb,var(--apple-blue) 30%,transparent),0 0 0 5px color-mix(in srgb,var(--np-bg) 92%,transparent)!important;font-size:0!important}.mobile-bottom .mobile-plus span{width:50px!important;height:50px!important;font-size:27px!important;font-weight:300!important}
    .cbt-shell{background:var(--np-bg)!important;color:var(--np-text)!important}.cbt-topbar{height:72px!important;padding:0 28px!important;background:color-mix(in srgb,var(--np-bg) 88%,transparent)!important;border-bottom:1px solid color-mix(in srgb,var(--np-text) 8%,transparent)!important;backdrop-filter:blur(26px)!important;-webkit-backdrop-filter:blur(26px)!important}.cbt-brand-mark{width:38px!important;height:38px!important;border-radius:12px!important;background:var(--apple-blue)!important;color:#fff!important}.cbt-brand strong{font-size:19px!important;letter-spacing:-.7px!important}.cbt-brand small{font-size:9px!important;color:var(--np-muted)!important}.cbt-section-tabs button{border:0!important;border-radius:12px!important;background:transparent!important;color:var(--np-muted)!important;padding:9px 13px!important}.cbt-section-tabs button.active{background:color-mix(in srgb,var(--apple-blue) 10%,transparent)!important;color:var(--apple-blue)!important}.cbt-clock,.cbt-lang,.cbt-profile{border:1px solid color-mix(in srgb,var(--np-text) 9%,transparent)!important;background:color-mix(in srgb,var(--np-text) 4%,transparent)!important;color:var(--np-text)!important;border-radius:16px!important}.cbt-profile{border-radius:50%!important}
    .cbt-layout{max-width:1240px!important;gap:22px!important;padding:30px 28px 110px!important}.cbt-question-head h1{font-size:38px!important;letter-spacing:-2px!important}.cbt-instruction-strip{border:0!important;background:transparent!important;padding:0 0 12px!important;color:var(--np-muted)!important}.cbt-question-type{color:var(--apple-blue)!important;background:color-mix(in srgb,var(--apple-blue) 9%,transparent)!important;border:1px solid color-mix(in srgb,var(--apple-blue) 15%,transparent)!important;border-radius:999px!important;padding:7px 10px!important}.cbt-question-card{border:1px solid color-mix(in srgb,var(--np-text) 8%,transparent)!important;border-radius:26px!important;background:color-mix(in srgb,var(--np-surface) 82%,transparent)!important;box-shadow:0 18px 55px rgba(0,0,0,.16)!important;padding:28px!important}.cbt-q-number{font-size:9px!important;color:var(--np-muted)!important}.cbt-question-text{font-size:20px!important;line-height:1.55!important;letter-spacing:-.35px!important;max-width:850px!important;margin:18px 0 22px!important}.cbt-options-heading{border-top:1px solid color-mix(in srgb,var(--np-text) 7%,transparent)!important;padding-top:18px!important}.cbt-options{gap:9px!important}.cbt-option{min-height:62px!important;border:1px solid color-mix(in srgb,var(--np-text) 9%,transparent)!important;border-radius:17px!important;background:color-mix(in srgb,var(--np-text) 3%,transparent)!important;color:var(--np-text)!important;padding:12px 15px!important}.cbt-option.selected{border-color:color-mix(in srgb,var(--apple-blue) 65%,transparent)!important;background:color-mix(in srgb,var(--apple-blue) 10%,transparent)!important}.option-radio{width:25px!important;height:25px!important;border-radius:50%!important;border:1px solid color-mix(in srgb,var(--np-text) 15%,transparent)!important;display:grid!important;place-items:center!important;color:var(--apple-blue)!important}.cbt-option.selected .option-radio{border-color:var(--apple-blue)!important;background:var(--apple-blue)!important;color:#fff!important}.cbt-palette{border:1px solid color-mix(in srgb,var(--np-text) 8%,transparent)!important;border-radius:24px!important;background:color-mix(in srgb,var(--np-surface) 88%,transparent)!important;box-shadow:0 18px 55px rgba(0,0,0,.15)!important;backdrop-filter:blur(26px)!important}.palette-q{border-radius:11px!important}.palette-q.current{box-shadow:0 0 0 2px var(--apple-blue)!important}.cbt-submit{border-radius:14px!important;background:var(--apple-blue)!important;color:#fff!important;border:0!important}.cbt-footer{height:78px!important;background:color-mix(in srgb,var(--np-surface) 88%,transparent)!important;border-top:1px solid color-mix(in srgb,var(--np-text) 8%,transparent)!important;backdrop-filter:blur(26px)!important;-webkit-backdrop-filter:blur(26px)!important}.cbt-footer .primary-button{background:var(--apple-blue)!important;color:#fff!important;border-radius:14px!important}.cbt-end-btn{color:#ff453a!important}
    @media(max-width:760px){.cbt-topbar{height:62px!important;padding:0 16px!important}.cbt-brand strong{font-size:17px!important}.cbt-brand small,.cbt-section-tabs,.cbt-lang{display:none!important}.cbt-clock{min-width:76px!important;padding:6px 9px!important;border-radius:14px!important}.cbt-clock small{display:none!important}.cbt-profile{width:34px!important;height:34px!important}.cbt-mobile-section{padding:11px 16px!important;border-bottom:1px solid color-mix(in srgb,var(--np-text) 7%,transparent)!important;background:color-mix(in srgb,var(--np-bg) 90%,transparent)!important}.cbt-mobile-section button{border:1px solid color-mix(in srgb,var(--np-text) 9%,transparent)!important;border-radius:999px!important;background:color-mix(in srgb,var(--np-text) 4%,transparent)!important;color:var(--np-text)!important;padding:8px 10px!important;font-size:9px!important}.cbt-layout{display:block!important;padding:18px 14px 100px!important}.cbt-question-head h1{font-size:28px!important}.cbt-question-text{font-size:17px!important;line-height:1.52!important;margin:15px 0 19px!important}.cbt-question-card{padding:18px 14px!important;border-radius:22px!important}.cbt-option{min-height:56px!important;padding:10px 11px!important;border-radius:15px!important}.option-radio{width:23px!important;height:23px!important;min-width:23px!important}.cbt-source-toggle span{display:none!important}.cbt-actions-mobile{display:grid!important;grid-template-columns:44px 44px 44px minmax(0,1fr) 44px!important;gap:7px!important;position:fixed!important;left:12px!important;right:12px!important;bottom:91px!important;z-index:70!important;padding:7px!important;border:1px solid color-mix(in srgb,var(--np-text) 9%,transparent)!important;border-radius:21px!important;background:color-mix(in srgb,var(--np-surface) 88%,transparent)!important;box-shadow:0 18px 55px rgba(0,0,0,.30),inset 0 1px rgba(255,255,255,.04)!important;backdrop-filter:blur(28px)!important;-webkit-backdrop-filter:blur(28px)!important}.cbt-mobile-tool,.cbt-mobile-end{width:44px!important;height:44px!important;border:0!important;border-radius:14px!important;background:transparent!important;color:var(--np-muted)!important;display:grid!important;place-items:center!important;font-size:0!important}.cbt-mobile-tool span{font-size:17px!important}.cbt-mobile-tool b{display:none!important}.cbt-mobile-tool.active{background:color-mix(in srgb,var(--apple-blue) 11%,transparent)!important;color:var(--apple-blue)!important}.cbt-mobile-primary{height:44px!important;border:0!important;border-radius:14px!important;background:var(--apple-blue)!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;font-size:12px!important;font-weight:800!important}.cbt-mobile-primary b{font-size:17px!important;font-weight:400!important}.cbt-mobile-end{background:color-mix(in srgb,var(--np-text) 5%,transparent)!important;color:var(--np-text)!important;font-size:16px!important}.cbt-footer{display:none!important}.cbt-palette{position:fixed!important;inset:auto 12px 88px!important;max-height:72vh!important;border-radius:24px!important;z-index:90!important}.cbt-palette.closed{display:none!important}.cbt-palette.open{display:block!important}}
    @media(min-width:761px){.cbt-actions-mobile{display:none!important}}


    /* APPLE-STYLE ENDGAME APP SHELL */
    .app{--apple-blue:#0a84ff;background:var(--np-bg);color:var(--np-text)}
    .app[data-appearance='light']{--apple-blue:#007aff}
    .top-nav{height:72px;padding:0 34px;grid-template-columns:220px 1fr auto;background:color-mix(in srgb,var(--np-bg) 88%,transparent);border-bottom-color:color-mix(in srgb,var(--np-text) 8%,transparent);box-shadow:none}
    .brand-mark{width:36px;height:36px;border-radius:11px;box-shadow:none}.brand{font-size:20px}.top-nav nav button{font-size:13px;padding:10px 14px;border-radius:12px}.top-nav nav button.active{background:color-mix(in srgb,var(--np-text) 7%,transparent);color:var(--text)}
    .nav-theme,.nav-search,.nav-bell,.nav-login{height:40px;border:1px solid color-mix(in srgb,var(--np-text) 8%,transparent);background:color-mix(in srgb,var(--np-text) 4%,transparent);border-radius:20px}.nav-theme{padding:0 14px}.nav-search{padding:0 14px}.nav-avatar{width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,var(--np-text) 6%,transparent);border-color:color-mix(in srgb,var(--np-text) 8%,transparent)}
    .page{width:min(1180px,calc(100% - 68px));padding:58px 0 120px}.coaching-home-page{width:100%;max-width:none;padding:0 0 120px}.student-home-stage{max-width:1180px;padding:0 34px}
    .page-title h1{font-size:56px;letter-spacing:-2.8px}.page-title p{font-size:14px}.filter-panel{border-radius:20px;padding:10px;background:color-mix(in srgb,var(--np-text) 3%,transparent)}.question-row,.history-row,.revision-card,.subject-card,.metric-card,.performance-panel,.builder-card,.mock-rules-card,.empty-state{border-radius:20px;background:color-mix(in srgb,var(--np-text) 3.5%,transparent);border-color:color-mix(in srgb,var(--np-text) 8%,transparent);box-shadow:none}.question-row:hover,.history-row:hover,.revision-card:hover,.subject-card:hover{transform:none;background:color-mix(in srgb,var(--np-text) 6%,transparent)}
    .primary-button{background:var(--apple-blue);color:#fff;border-radius:14px;box-shadow:none}.secondary-button{border-radius:14px;background:color-mix(in srgb,var(--np-text) 5%,transparent)}
    .modal-backdrop{background:rgba(0,0,0,.5);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px)}.modal{border-radius:28px;background:color-mix(in srgb,var(--np-surface) 96%,transparent);border-color:color-mix(in srgb,var(--np-text) 9%,transparent);box-shadow:0 30px 100px rgba(0,0,0,.35);backdrop-filter:blur(28px)}
    .apple-appearance-backdrop{place-items:end center;padding:0}.apple-appearance{width:min(520px,100%);padding:22px 24px 24px;border-radius:30px 30px 0 0}.apple-sheet-handle{width:36px;height:4px;border-radius:99px;background:color-mix(in srgb,var(--np-text) 20%,transparent);margin:0 auto 21px}.apple-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border:0;border-radius:50%;background:color-mix(in srgb,var(--np-text) 7%,transparent);color:var(--np-text);font-size:20px}.apple-appearance h2{font-size:30px;letter-spacing:-1.5px;margin:7px 0 20px}.apple-appearance-section{margin-top:19px}.apple-appearance-section>small{display:block;font-size:10px;letter-spacing:.13em;color:var(--np-muted);font-weight:900;margin:0 0 9px}.apple-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.apple-mode-grid button,.apple-colour-grid button{min-height:62px;display:flex;align-items:center;gap:10px;border:1px solid color-mix(in srgb,var(--np-text) 9%,transparent);border-radius:16px;background:color-mix(in srgb,var(--np-text) 4%,transparent);color:var(--np-text);padding:0 13px;text-align:left}.apple-mode-grid button.selected,.apple-colour-grid button.selected{border-color:color-mix(in srgb,var(--accent) 65%,transparent);background:color-mix(in srgb,var(--accent) 11%,transparent)}.apple-mode-grid button>span{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:color-mix(in srgb,var(--np-text) 7%,transparent);color:var(--accent)}.apple-mode-grid b,.apple-colour-grid b{font-size:12px;flex:1}.apple-mode-grid i,.apple-colour-grid i{font-style:normal;color:var(--accent);font-size:19px}.apple-colour-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.apple-colour-grid button{min-height:50px}.apple-colour-grid button>span{width:17px;height:17px;border-radius:50%;box-shadow:0 0 18px color-mix(in srgb,currentColor 25%,transparent)}.apple-preference-note{margin-top:16px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--np-text) 8%,transparent);color:var(--np-muted);font-size:10px}
    .app[data-appearance='light'] .top-nav,.app[data-appearance='light'] .mobile-bottom{background:rgba(255,255,255,.82)}.app[data-appearance='light'] .mobile-bottom{border-color:rgba(20,35,40,.1)}
    @media(max-width:760px){.page{width:100%;padding:34px 16px 120px}.coaching-home-page{padding:0 0 112px}.student-home-stage{padding:0 16px;max-width:none}.page-title h1{font-size:42px}.apple-appearance{padding-bottom:max(24px,env(safe-area-inset-bottom))}.apple-mode-grid,.apple-colour-grid{gap:7px}}
  `;
  return <div className="app" data-theme={theme} data-appearance={appearance} style={{ '--accent': currentTheme.color } as CSSProperties}>
    <style>{mobilePolishCss}</style>
    <header className="top-nav"><button className="brand" onClick={() => go('home')}><span className="brand-mark">N</span><span>neet<span>prep</span></span></button><nav>{([['home', 'Home'], ['practice', 'Practice'], ['mocks', 'Tests'], ['saved', 'Saved'], ['mistakes', 'Mistakes'], ['progress', 'Progress']] as [Tab, string][]).map(([id, label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => go(id)}>{label}</button>)}</nav><div className="nav-actions"><button className="nav-theme" onClick={() => setAppearanceOpen(true)}><i style={{ background: currentTheme.color }} /> Theme</button><button className="nav-search" onClick={() => { go('practice'); setTimeout(() => document.querySelector<HTMLInputElement>('.search-field input')?.focus(), 50); }}>⌕ <span>Search</span></button><button className="nav-bell" onClick={openAnnouncements} aria-label="Teacher announcements"><span>✦</span>{announcements.length > 0 && <i>{Math.min(announcements.length, 9)}</i>}</button>{user ? <button className="nav-avatar" onClick={() => setProfileOpen(true)}>{(user.email?.[0] ?? 'N').toUpperCase()}</button> : <button className="nav-login" onClick={() => setAuthOpen(true)}>Log in</button>}</div></header>
    {tab === 'home' && renderHome()}
    {tab === 'practice' && renderPractice()}
    {tab === 'mocks' && renderMocks()}
    {tab === 'saved' && renderRevision('saved')}
    {tab === 'mistakes' && renderRevision('mistakes')}
    {tab === 'progress' && renderProgress()}
    <nav className="mobile-bottom"><button className={tab === 'home' ? 'active' : ''} onClick={() => go('home')}><span><MobileIcon name="home" /></span><b>Home</b></button><button className={tab === 'practice' ? 'active' : ''} onClick={() => go('practice')}><span><MobileIcon name="practice" /></span><b>Practice</b></button><button className="mobile-plus" aria-label="Quick practice" onClick={() => startAttempt(questions.filter(q => q.status !== 'dropped').slice(0, 10), 'practice', 'Quick practice')}><span>+</span></button><button className={tab === 'mocks' ? 'active' : ''} onClick={() => go('mocks')}><span><MobileIcon name="test" /></span><b>Tests</b></button><button className={tab === 'progress' ? 'active' : ''} onClick={() => go('progress')}><span><MobileIcon name="progress" /></span><b>Progress</b></button></nav>
    {solver && renderSolver()}
    {result && renderResult()}
    {announcementOpen && <div className="modal-backdrop announcement-backdrop" onMouseDown={() => setAnnouncementOpen(false)}><div className="modal announcement-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setAnnouncementOpen(false)}>×</button><span className="section-kicker">TEACHER UPDATES</span><h2>Stay in the loop.</h2><p className="announcement-modal-copy">Important notices from your coaching team, in one calm place.</p>{announcementBusy && !announcements.length ? <div className="announcement-loading">Loading updates…</div> : announcements.length ? <div className="announcement-list">{announcements.map(item => <article key={item.id} className="announcement-item"><div className="announcement-item-meta"><span>TEACHER UPDATE</span><time>{new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</time></div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div> : <div className="announcement-empty-student"><div>✦</div><strong>You're all caught up.</strong><span>No new teacher updates yet.</span></div>}</div></div>}
    {appearanceOpen && <div className="modal-backdrop apple-appearance-backdrop" onMouseDown={() => setAppearanceOpen(false)}><div className="modal appearance-modal apple-appearance" onMouseDown={e => e.stopPropagation()}><div className="apple-sheet-handle"/><button className="apple-close" onClick={() => setAppearanceOpen(false)} aria-label="Close">×</button><span className="section-kicker">INTERFACE</span><h2>Appearance</h2><div className="apple-appearance-section"><small>MODE</small><div className="apple-mode-grid"><button className={appearance === 'dark' ? 'selected' : ''} onClick={() => setAppearance('dark')}><span>◐</span><b>Dark mode</b>{appearance === 'dark' && <i>✓</i>}</button><button className={appearance === 'light' ? 'selected' : ''} onClick={() => setAppearance('light')}><span>☀</span><b>Light mode</b>{appearance === 'light' && <i>✓</i>}</button></div></div><div className="apple-appearance-section"><small>ACCENT COLOUR</small><div className="apple-colour-grid">{THEMES.slice(0,6).map(t => <button key={t.id} className={theme === t.id ? 'selected' : ''} onClick={() => setTheme(t.id)}><span style={{background:t.color}}/><b>{t.name}</b>{theme === t.id && <i>✓</i>}</button>)}</div></div><div className="apple-preference-note">Your preferences are saved on this device.</div></div></div>}
    {profileOpen && <div className="modal-backdrop" onMouseDown={() => setProfileOpen(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setProfileOpen(false)}>×</button><span className="section-kicker">PROFILE</span><h2>{user?.email?.split('@')[0] ?? 'Student'}</h2><p>{user?.email}</p><div className="cloud-status"><span className={cloudSyncing ? 'sync-dot syncing' : cloudReady ? 'sync-dot' : 'sync-dot offline'} />{cloudSyncing ? 'Syncing your progress…' : cloudReady ? 'Progress synced to cloud' : 'Local mode'}</div>{cloudError && <div className="auth-message">{cloudError}</div>}<div className="profile-actions"><button onClick={() => { supabase.auth.signOut(); setProfileOpen(false); }}>Sign out</button><button onClick={() => setAppearanceOpen(true)}>Appearance</button></div></div></div>}
    {authOpen && <div className="modal-backdrop" onMouseDown={() => setAuthOpen(false)}><div className="modal auth-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setAuthOpen(false)}>×</button><span className="section-kicker">NEETPREP ACCOUNT</span><h2>{authMode === 'in' ? 'Welcome back.' : authMode === 'up' ? 'Create your account.' : 'Reset your password.'}</h2><p>{authMode === 'reset' ? 'We will send a secure password reset link to your email.' : 'Save your progress, mistakes, notes and test history across devices.'}</p>{authMode === 'up' && <label>Name<input value={displayName} onChange={e => setDisplayName(e.target.value)} type="text" autoComplete="name" placeholder="Your name" /></label>}<label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" /></label>{authMode !== 'reset' && <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={authMode === 'in' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" /></label>}{authMode === 'up' && <label>Confirm password<input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Repeat password" /></label>}{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button full" onClick={() => void signInOrUp()} disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'in' ? 'Log in' : authMode === 'up' ? 'Create account' : 'Send reset email'}</button><div className="auth-links">{authMode === 'in' && <button className="switch-auth" onClick={() => switchAuthMode('reset')}>Forgot password?</button>}{authMode !== 'in' && <button className="switch-auth" onClick={() => switchAuthMode('in')}>Back to log in</button>}{authMode === 'in' && <button className="switch-auth" onClick={() => switchAuthMode('up')}>Need an account? Create one</button>}{authMode === 'up' && <button className="switch-auth" onClick={() => switchAuthMode('in')}>Already have an account? Log in</button>}</div><div className="guest-note">You can continue as a guest. Your local progress stays on this device until you create an account.</div></div></div>}
    {noteOpen && current && <div className="modal-backdrop" onMouseDown={() => setNoteOpen(false)}><div className="modal note-modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setNoteOpen(false)}>×</button><span className="section-kicker">PERSONAL NOTE</span><h2>Question {questions.indexOf(current) + 1}</h2><textarea value={notes[current.id] ?? ''} onChange={e => setNotes(prev => ({ ...prev, [current.id]: e.target.value }))} placeholder="Write a short reminder for your next revision…" autoFocus /><button className="primary-button full" onClick={() => { setNoteOpen(false); if (user && cloudReady && current) syncQuestionStates(user, saved, mistakes, notes).catch(error => console.error(error)); showToast('Note saved'); }}>Save note</button></div></div>}
    {reportOpen && <div className="modal-backdrop" onMouseDown={() => setReportOpen(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="close-button" onClick={() => setReportOpen(false)}>×</button><span className="section-kicker">REPORT QUESTION</span><h2>What looks wrong?</h2><div className="report-options">{['Question text', 'Diagram / scan', 'Answer key', 'Other'].map(x => <button key={x} onClick={() => { setReportOpen(false); showToast('Report recorded for review'); }}>{x}<span>›</span></button>)}</div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
