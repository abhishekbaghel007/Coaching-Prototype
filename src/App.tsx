import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { QUESTIONS } from './data/questions';
import PremiumCheckoutButton from './PremiumCheckoutButton';

type Question = {
  section: string;
  question: string;
  options: string[];
  correct_index: number;
};
import { supabase } from './lib/supabase';

type View = 'home' | 'quiz' | 'results' | 'progress' | 'examSetup' | 'exam' | 'examResults';
type HistoryItem = { q: Question; chosen: number; correct: boolean };
type AttemptState = {
  section: string;
  order: Question[];
  history: Array<HistoryItem | null>;
  score: number;
  isMistakeReview?: boolean;
  isChallenge?: boolean;
  timeLimitSeconds?: number;
};
type SavedAttempt = {
  subject: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  created_at?: string;
};

type ExamConfig = {
  subjects: string[];
  questionCount: number;
  timeMinutes: number;
};

type ExamState = {
  questions: Question[];
  answers: Record<number, number>;
  flagged: number[];
  current: number;
  remainingSeconds: number;
  config: ExamConfig;
};

const PRIMARY_ORDER = ['Osteology', 'Myology (Muscles)', 'CNS', 'PNS', 'Splanchnology', 'CVS'];
const SECTION_DISPLAY: Record<string, string> = {
  CVS: 'Cardiovascular System (CVS)',
  CNS: 'Central Nervous System (CNS)',
  PNS: 'Peripheral Nervous System (PNS)',
};
const THEME_OPTIONS = [
  { id: 'violet', name: 'Violet', color: '#a98bff' },
  { id: 'blue', name: 'Blue', color: '#6ea8ff' },
  { id: 'teal', name: 'Teal', color: '#5ed1c1' },
  { id: 'rose', name: 'Rose', color: '#e48aaa' },
  { id: 'amber', name: 'Amber', color: '#e0b15a' },
  { id: 'slate', name: 'Slate', color: '#9ca9ba' },
] as const;
type ThemeId = typeof THEME_OPTIONS[number]['id'];
type AppearanceId = 'dark' | 'light';

const ACCENTS = ['#a98bff', '#6ea8ff', '#5ed1c1', '#e48aaa', '#e0b15a', '#9ca9ba'];
const ICONS: Record<string, string> = {
  Osteology: '◈',
  'Myology (Muscles)': '⌁',
  CNS: '◉',
  PNS: '✣',
  Splanchnology: '◍',
  CVS: '♡',
};

function displaySection(section: string) {
  return SECTION_DISPLAY[section] ?? section;
}

function groupQuestions() {
  const map: Record<string, Question[]> = {};
  const order: string[] = [];
  for (const q of QUESTIONS) {
    if (!map[q.section]) {
      map[q.section] = [];
      order.push(q.section);
    }
    map[q.section].push(q);
  }
  return { map, order };
}

const { map: SECTIONS, order: ENCOUNTER_ORDER } = groupQuestions();
const DYNAMIC_ORDER = ENCOUNTER_ORDER.filter((section) => !PRIMARY_ORDER.includes(section));

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatDate(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function questionKey(q: Question) {
  return `${q.section}::${q.question}`;
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function getCurrentStreak(progress: Record<string, number>) {
  let cursor = new Date();
  let streak = 0;
  if ((progress[localDayKey(cursor)] ?? 0) === 0) cursor.setDate(cursor.getDate() - 1);
  while ((progress[localDayKey(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 3650) break;
  }
  return streak;
}

function getLastSevenDays(progress: Record<string, number>) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    const key = localDayKey(date);
    return { key, label: dayLabel(key), value: progress[key] ?? 0 };
  });
}

export default function App() {
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [attempts, setAttempts] = useState<SavedAttempt[]>([]);
  const [theme, setTheme] = useState<ThemeId>(() => {
    const savedTheme = window.localStorage.getItem('kazan-theme') as ThemeId | null;
    return THEME_OPTIONS.some((x) => x.id === savedTheme) ? savedTheme! : 'violet';
  });
  const [themeOpen, setThemeOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceId>(() => {
    const savedAppearance = window.localStorage.getItem('kazan-appearance') as AppearanceId | null;
    return savedAppearance === 'light' ? 'light' : 'dark';
  });
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    subjects: ['Osteology'],
    questionCount: Math.min(45, SECTIONS.Osteology?.length ?? 45),
    timeMinutes: 45,
  });
  const [exam, setExam] = useState<ExamState | null>(null);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examSaved, setExamSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const [bookmarks, setBookmarks] = useState<string[]>(() => loadStored<string[]>('kazan-bookmarks', []));
  const [notes, setNotes] = useState<Record<string, string>>(() => loadStored<Record<string, string>>('kazan-notes', {}));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [challengeBest, setChallengeBest] = useState<number>(() => Number(window.localStorage.getItem('kazan-challenge-best') || 0));

  const [dailyTarget, setDailyTarget] = useState<number>(() => Math.max(1, Number(window.localStorage.getItem('kazan-daily-target') || 30)));
  const [dailyProgress, setDailyProgress] = useState<Record<string, number>>(() => loadStored<Record<string, number>>('kazan-daily-progress', {}));
  const [lastSession, setLastSession] = useState<AttemptState | null>(() => loadStored<AttemptState | null>('kazan-last-session', null));
  const [mistakeBank, setMistakeBank] = useState<string[]>(() => loadStored<string[]>('kazan-mistake-bank', []));


  useEffect(() => {
    window.localStorage.setItem('kazan-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    window.localStorage.setItem('kazan-notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    window.localStorage.setItem('kazan-daily-target', String(dailyTarget));
  }, [dailyTarget]);

  useEffect(() => {
    window.localStorage.setItem('kazan-daily-progress', JSON.stringify(dailyProgress));
  }, [dailyProgress]);

  useEffect(() => {
    if (lastSession && !lastSession.isChallenge) window.localStorage.setItem('kazan-last-session', JSON.stringify(lastSession));
    else if (!lastSession) window.localStorage.removeItem('kazan-last-session');
  }, [lastSession]);

  useEffect(() => {
    window.localStorage.setItem('kazan-mistake-bank', JSON.stringify(mistakeBank));
  }, [mistakeBank]);

  const totalQuestions = QUESTIONS.length;
  const totalSubjects = ENCOUNTER_ORDER.length;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('kazan-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    window.localStorage.setItem('kazan-appearance', appearance);
  }, [appearance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        setAuthMessage('Choose a new password for your Kazan MBBS account.');
        setAuthOpen(true);
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (view !== 'exam' || !exam || examSubmitted) return;
    const timer = window.setInterval(() => {
      setExam((current) => {
        if (!current) return current;
        if (current.remainingSeconds <= 1) {
          window.clearInterval(timer);
          return { ...current, remainingSeconds: 0 };
        }
        return { ...current, remainingSeconds: current.remainingSeconds - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [view, examSubmitted]);

  useEffect(() => {
    if (view === 'exam' && exam && exam.remainingSeconds === 0 && !examSubmitted) {
      void finishExam();
    }
  }, [exam?.remainingSeconds, view, examSubmitted]);

  useEffect(() => {
    if (!user) {
      setAttempts([]);
      return;
    }
    let alive = true;
    supabase
      .from('quiz_attempts')
      .select('subject,total_questions,correct_answers,score_percentage,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (alive) setAttempts((data ?? []) as SavedAttempt[]);
      });
    return () => {
      alive = false;
    };
  }, [user, saved]);


  const toggleBookmark = (q: Question) => {
    const key = questionKey(q);
    setBookmarks((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  };

  const updateNote = (q: Question, value: string) => {
    const key = questionKey(q);
    setNotes((current) => {
      const next = { ...current };
      if (value.trim()) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const resumeLastSession = () => {
    if (!lastSession || !lastSession.order.length) return;
    setAttempt(lastSession);
    setRevealed(false);
    setSaved('idle');
    setView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startMistakeBank = () => {
    const questions = mistakeBank
      .map((key) => QUESTIONS.find((q) => questionKey(q) === key))
      .filter((q): q is Question => Boolean(q) && q!.section === 'Osteology');
    if (!questions.length) return;
    startCustomQuiz(shuffle(questions), 'Mistake Bank');
  };

  const startSavedReview = () => {
    const questions = bookmarks
      .map((key) => QUESTIONS.find((q) => questionKey(q) === key))
      .filter((q): q is Question => Boolean(q) && q!.section === 'Osteology');
    if (!questions.length) return;
    startCustomQuiz(shuffle(questions), 'Saved Questions');
  };

  const setTarget = (value: number) => setDailyTarget(Math.max(1, Math.min(500, Math.round(value) || 1)));

  const startCustomQuiz = (questions: Question[], label: string, isChallenge = false, timeLimitSeconds?: number) => {
    if (!questions.length) return;
    const nextAttempt: AttemptState = {
      section: label,
      order: questions,
      history: Array(questions.length).fill(null),
      score: 0,
      isChallenge,
      timeLimitSeconds,
    };
    setAttempt(nextAttempt);
    if (!isChallenge) setLastSession(nextAttempt);
    setRevealed(false);
    setSaved('idle');
    setView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startQuickPractice = () => {
    // Keep Quick Practice within the currently free Osteology bank so it cannot bypass Premium locking.
    const pool = SECTIONS.Osteology ?? [];
    startCustomQuiz(shuffle(pool).slice(0, Math.min(10, pool.length)), '5-Minute Quick Practice', false, 300);
  };

  const startChallenge = () => {
    const pool = SECTIONS.Osteology ?? [];
    startCustomQuiz(shuffle(pool).slice(0, Math.min(10, pool.length)), 'Challenge Mode', true);
  };

  const openAuth = (mode: 'signin' | 'signup' | 'forgot' = 'signin') => {
    setAuthMode(mode);
    setAuthMessage('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthOpen(true);
  };

  const closeAuth = () => {
    if (!authBusy) setAuthOpen(false);
  };

  const submitAuth = async () => {
    const email = authEmail.trim();

    if (!email) {
      setAuthMessage('Enter your email address.');
      return;
    }

    if (authMode === 'forgot') {
      setAuthBusy(true);
      setAuthMessage('Sending reset link…');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setAuthMessage(error ? error.message : 'Reset link sent. Check your email.');
      setAuthBusy(false);
      return;
    }

    if (!authPassword) {
      setAuthMessage('Enter your password.');
      return;
    }

    if (authMode === 'reset') {
      if (authPassword.length < 8) {
        setAuthMessage('Password must be at least 8 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthMessage('Passwords do not match.');
        return;
      }

      setAuthBusy(true);
      setAuthMessage('Updating password…');
      const { error } = await supabase.auth.updateUser({ password: authPassword });
      if (error) {
        setAuthMessage(error.message);
      } else {
        setAuthMessage('Password updated successfully. You can now continue.');
        setAuthPassword('');
        setAuthConfirmPassword('');
        window.setTimeout(() => setAuthOpen(false), 900);
      }
      setAuthBusy(false);
      return;
    }

    if (authMode === 'signup') {
      if (authPassword.length < 8) {
        setAuthMessage('Password must be at least 8 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthMessage('Passwords do not match.');
        return;
      }
    }

    setAuthBusy(true);
    setAuthMessage(authMode === 'signin' ? 'Signing in…' : 'Creating account…');

    const result = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password: authPassword })
      : await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });

    if (result.error) {
      setAuthMessage(result.error.message);
    } else if (authMode === 'signup' && !result.data.session) {
      setAuthMessage('Account created. Check your email to confirm your address, then sign in.');
      setAuthPassword('');
      setAuthConfirmPassword('');
    } else {
      setUser(result.data.user);
      setAuthMessage(authMode === 'signin' ? 'Signed in successfully.' : 'Account created. You are signed in.');
      setAuthPassword('');
      setAuthConfirmPassword('');
      window.setTimeout(() => setAuthOpen(false), 650);
    }

    setAuthBusy(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthOpen(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAttempts([]);
    setView('home');
  };

  const openExamSetup = () => {
    const available = ENCOUNTER_ORDER.filter((section) => (SECTIONS[section] ?? []).length > 0);
    setExamConfig((current) => {
      const subjects = current.subjects.filter((s) => available.includes(s));
      const nextSubjects = subjects.length ? subjects : [available[0] ?? 'Osteology'];
      const pool = nextSubjects.reduce((sum, section) => sum + (SECTIONS[section]?.length ?? 0), 0);
      return { ...current, subjects: nextSubjects, questionCount: Math.min(current.questionCount, pool || 1) };
    });
    setView('examSetup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExamSubject = (section: string) => {
    setExamConfig((current) => {
      const exists = current.subjects.includes(section);
      const subjects = exists
        ? current.subjects.filter((s) => s !== section)
        : [...current.subjects, section];
      if (!subjects.length) return current;
      const pool = subjects.reduce((sum, s) => sum + (SECTIONS[s]?.length ?? 0), 0);
      return { ...current, subjects, questionCount: Math.min(current.questionCount, pool) };
    });
  };

  const startExam = () => {
    const pool = examConfig.subjects.flatMap((section) => SECTIONS[section] ?? []);
    if (!pool.length) return;
    const count = Math.max(1, Math.min(examConfig.questionCount, pool.length));
    const questions = shuffle(pool).slice(0, count);
    const config = { ...examConfig, questionCount: count };
    setExam({ questions, answers: {}, flagged: [], current: 0, remainingSeconds: config.timeMinutes * 60, config });
    setExamConfig(config);
    setExamSubmitted(false);
    setExamSaved('idle');
    setView('exam');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const answerExam = (optionIndex: number) => {
    setExam((current) => current ? { ...current, answers: { ...current.answers, [current.current]: optionIndex } } : current);
  };

  const toggleExamFlag = () => {
    setExam((current) => {
      if (!current) return current;
      const flagged = current.flagged.includes(current.current)
        ? current.flagged.filter((i) => i !== current.current)
        : [...current.flagged, current.current];
      return { ...current, flagged };
    });
  };

  const goExamQuestion = (index: number) => {
    setExam((current) => current ? { ...current, current: Math.max(0, Math.min(index, current.questions.length - 1)) } : current);
  };

  const finishExam = async () => {
    if (!exam || examSubmitted) return;
    setExamSubmitted(true);
    setView('examResults');
    setExamSaved('idle');
    if (!user) return;
    setExamSaved('saving');
    const correctAnswers = exam.questions.reduce((sum, q, i) => sum + (exam.answers[i] === q.correct_index ? 1 : 0), 0);
    const scorePercentage = Math.round((correctAnswers / exam.questions.length) * 100);
    const subject = exam.config.subjects.length === 1 ? exam.config.subjects[0] : 'Mixed Exam';
    const { error } = await supabase.from('quiz_attempts').insert({
      user_id: user.id,
      subject,
      total_questions: exam.questions.length,
      correct_answers: correctAnswers,
      score_percentage: scorePercentage,
    });
    setExamSaved(error ? 'failed' : 'saved');
  };

  const abandonExam = () => {
    if (!exam || window.confirm('Leave this exam? Your current answers will be lost.')) {
      setExam(null);
      setExamSubmitted(false);
      setView('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startQuiz = (section: string, randomized = false) => {
    const base = SECTIONS[section] ?? [];
    const order = randomized ? shuffle(base) : [...base];
    if (!order.length) return;
    const nextAttempt: AttemptState = { section, order, history: Array(order.length).fill(null), score: 0 };
    setAttempt(nextAttempt);
    setLastSession(nextAttempt);
    setRevealed(false);
    setSaved('idle');
    setView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startMistakeReview = () => {
    if (!attempt) return;
    const missed = attempt.history
      .filter((h): h is HistoryItem => h !== null && !h.correct)
      .map((h) => h.q);
    if (!missed.length) return;
    const nextAttempt: AttemptState = {
      section: attempt.section,
      order: missed,
      history: Array(missed.length).fill(null),
      score: 0,
      isMistakeReview: true,
    };
    setAttempt(nextAttempt);
    setLastSession(nextAttempt);
    setRevealed(false);
    setSaved('idle');
    setView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const choose = (index: number, optionIndex: number) => {
    if (!attempt || attempt.history[index]) return;
    const q = attempt.order[index];
    const correct = optionIndex === q.correct_index;
    const history = [...attempt.history];
    history[index] = { q, chosen: optionIndex, correct };
    const nextAttempt: AttemptState = { ...attempt, history, score: attempt.score + (correct ? 1 : 0) };
    setAttempt(nextAttempt);
    if (!attempt.isChallenge) setLastSession(nextAttempt);

    const today = localDayKey();
    setDailyProgress((current) => ({ ...current, [today]: (current[today] ?? 0) + 1 }));
    const key = questionKey(q);
    setMistakeBank((current) => correct
      ? current.filter((item) => item !== key)
      : current.includes(key) ? current : [...current, key]);
  };

  const answered = attempt?.history.filter(Boolean).length ?? 0;
  const total = attempt?.order.length ?? 0;
  const correct = attempt?.history.filter((h) => h?.correct).length ?? 0;
  const wrong = answered - correct;
  const complete = total > 0 && answered === total;

  const finishQuiz = async (force = false) => {
    if (!attempt || (!complete && !force)) return;

    // Challenge Mode is intentionally ephemeral. It updates the local personal
    // best, but it must NOT create a normal practice-session record.
    if (attempt.isChallenge) {
      if (attempt.score > challengeBest) {
        setChallengeBest(attempt.score);
        window.localStorage.setItem('kazan-challenge-best', String(attempt.score));
      }
      setSaved('idle');
      setView('results');
      return;
    }

    setLastSession(null);
    setView('results');
    setSaved('idle');
    if (!user) return;
    setSaved('saving');
    const scorePercentage = Math.round((attempt.score / attempt.order.length) * 100);
    const { error } = await supabase.from('quiz_attempts').insert({
      user_id: user.id,
      subject: attempt.section,
      total_questions: attempt.order.length,
      correct_answers: attempt.score,
      score_percentage: scorePercentage,
    });
    setSaved(error ? 'failed' : 'saved');
  };

  const home = () => {
    setView('home');
    setAttempt(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retry = () => {
    if (!attempt) return;
    if (attempt.isChallenge) {
      startChallenge();
      return;
    }
    if (attempt.timeLimitSeconds === 300) {
      startQuickPractice();
      return;
    }
    startQuiz(attempt.section, false);
  };

  const openSubject = (section: string) => {
    if (section !== 'Osteology') {
      setPremiumOpen(true);
      return;
    }
    startQuiz(section);
  };

  return (
    <div className="app-shell">
      <style>{` 
.exam-launch-card{margin-top:22px;width:100%;display:flex;align-items:center;gap:14px;padding:17px 19px;border:1px solid rgba(169,139,255,.28);border-radius:14px;background:linear-gradient(135deg,rgba(169,139,255,.10),rgba(169,139,255,.025));color:inherit;text-align:left;cursor:pointer;transition:.18s ease;box-shadow:0 12px 30px rgba(0,0,0,.10)}
.exam-launch-card:hover{transform:translateY(-2px);border-color:rgba(169,139,255,.52);background:rgba(169,139,255,.13)}
.exam-launch-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(169,139,255,.16);font-size:21px}.exam-launch-card span:nth-child(2){display:flex;flex-direction:column;gap:3px;flex:1}.exam-launch-card b{font-size:.94rem}.exam-launch-card small{color:var(--muted,#8d98aa);font-size:.78rem}.exam-launch-card strong{font-size:20px;color:#a98bff}
.exam-setup,.exam-results{max-width:1120px;margin:0 auto;padding:26px 0 70px}.exam-setup-top,.exam-result-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}.exam-badge{font:700 .68rem/1 'IBM Plex Mono',monospace;letter-spacing:.13em;padding:9px 11px;border:1px solid rgba(169,139,255,.35);border-radius:999px;color:#a98bff;background:rgba(169,139,255,.07)}
.exam-hero{display:grid;grid-template-columns:1fr 230px;gap:28px;align-items:stretch;margin-bottom:26px}.exam-hero>div:first-child{padding:28px 4px}.exam-hero h2{font-size:clamp(2rem,4vw,3.5rem);line-height:1.02;margin:8px 0 14px;letter-spacing:-.04em}.exam-hero p{max-width:680px;color:var(--muted,#8d98aa);line-height:1.65}.exam-preview-card{border:1px solid var(--line,rgba(255,255,255,.08));border-radius:18px;background:rgba(255,255,255,.025);padding:24px;display:flex;flex-direction:column;justify-content:center;box-shadow:inset 0 1px rgba(255,255,255,.03)}.exam-preview-card span{font:700 .66rem 'IBM Plex Mono',monospace;letter-spacing:.13em;color:#8d98aa}.exam-preview-card b{font-size:3.4rem;line-height:1;margin:10px 0 2px}.exam-preview-card small{color:#8d98aa}.exam-preview-card div{margin-top:17px;padding-top:13px;border-top:1px solid var(--line,rgba(255,255,255,.08));font-size:.78rem;color:#a98bff}
.exam-builder{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px}.exam-builder-main{display:flex;flex-direction:column;gap:14px}.exam-step,.exam-rules{border:1px solid var(--line,rgba(255,255,255,.08));border-radius:18px;background:rgba(255,255,255,.025);padding:22px}.exam-step-head{display:flex;align-items:center;gap:13px;margin-bottom:18px}.exam-step-head>span{font:700 .7rem 'IBM Plex Mono',monospace;color:#a98bff;border:1px solid rgba(169,139,255,.3);border-radius:8px;padding:7px 8px}.exam-step-head>div{flex:1}.exam-step-head h3{margin:3px 0 0;font-size:1.05rem}.exam-step-head>b{font:600 .72rem 'IBM Plex Mono',monospace;color:#8d98aa}
.exam-subject-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.exam-subject{display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--line,rgba(255,255,255,.08));background:rgba(255,255,255,.018);border-radius:12px;padding:13px;color:inherit;cursor:pointer;transition:.15s}.exam-subject:hover{border-color:rgba(169,139,255,.38)}.exam-subject.selected{border-color:rgba(169,139,255,.6);background:rgba(169,139,255,.09)}.exam-subject>span:nth-child(2){display:flex;flex-direction:column;gap:3px;flex:1}.exam-subject small{color:#8d98aa;font-size:.72rem}.exam-subject strong{font:700 .68rem 'IBM Plex Mono',monospace;color:#a98bff}.exam-check{width:22px;height:22px;border-radius:7px;border:1px solid #465063;display:grid;place-items:center;font-size:12px}.selected .exam-check{background:#a98bff;color:#12131a;border-color:#a98bff}
.exam-choice-row{display:flex;flex-wrap:wrap;gap:8px}.exam-choice{border:1px solid var(--line,rgba(255,255,255,.08));background:transparent;color:inherit;border-radius:10px;padding:10px 14px;cursor:pointer;font:600 .8rem 'IBM Plex Mono',monospace}.exam-choice:hover{border-color:rgba(169,139,255,.4)}.exam-choice.active{background:#a98bff;color:#15151b;border-color:#a98bff}.exam-slider-row{display:flex;align-items:center;gap:14px;margin-top:17px}.exam-slider-row input{flex:1;accent-color:#a98bff}.exam-slider-row span{min-width:105px;text-align:right;font:600 .75rem 'IBM Plex Mono',monospace;color:#8d98aa}.exam-custom-time{display:flex;align-items:center;justify-content:space-between;margin-top:15px;color:#8d98aa;font-size:.78rem}.exam-custom-time input{width:90px;padding:9px 10px;border:1px solid var(--line,rgba(255,255,255,.08));border-radius:9px;background:rgba(0,0,0,.12);color:inherit}
.exam-rules{position:sticky;top:18px;height:max-content}.exam-rules h3{margin:5px 0 17px;font-size:1.25rem}.rule-list{display:flex;flex-direction:column;gap:11px;color:#aab3c1;font-size:.8rem;line-height:1.45}.exam-ready{margin:22px 0 14px;padding:16px;border-radius:13px;background:rgba(169,139,255,.07);border:1px solid rgba(169,139,255,.18);display:grid;grid-template-columns:1fr auto;gap:5px}.exam-ready span{grid-column:1/-1;font:700 .62rem 'IBM Plex Mono',monospace;color:#a98bff}.exam-ready b{font-size:.95rem}.exam-ready small{color:#8d98aa}.exam-start-btn{width:100%;padding:14px}.exam-note{font-size:.7rem;color:#737d8c;text-align:center;margin:12px 0 0}
.exam-session{max-width:1240px;margin:0 auto;padding:0 0 50px}.exam-session-head{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:14px 18px;margin:0 -18px 14px;background:rgba(12,14,19,.94);backdrop-filter:blur(16px);border-bottom:1px solid var(--line,rgba(255,255,255,.08))}.exam-session-head.urgent{box-shadow:0 8px 35px rgba(220,70,90,.10)}.exam-session-brand{display:flex;align-items:center;gap:10px}.exam-session-brand>div{display:flex;flex-direction:column;gap:3px}.exam-session-brand b{font:700 .7rem 'IBM Plex Mono',monospace;letter-spacing:.12em}.exam-session-brand small{font-size:.7rem;color:#8d98aa}.exam-live-dot{width:8px;height:8px;border-radius:50%;background:#a98bff;box-shadow:0 0 0 5px rgba(169,139,255,.10)}.exam-timer{text-align:center}.exam-timer span{display:block;font:600 .58rem 'IBM Plex Mono',monospace;color:#8d98aa;letter-spacing:.12em}.exam-timer b{display:block;font:700 1.4rem 'IBM Plex Mono',monospace;margin-top:2px}.urgent .exam-timer b{color:#e48aaa}.exam-submit-top{justify-self:end;border:1px solid rgba(228,138,170,.3);background:rgba(228,138,170,.06);color:#e48aaa;border-radius:10px;padding:10px 14px;font:700 .7rem 'IBM Plex Mono',monospace;cursor:pointer}.exam-progress{height:5px;background:rgba(255,255,255,.05);border-radius:99px;position:relative;margin-bottom:22px}.exam-progress>div{height:100%;background:#a98bff;border-radius:99px;transition:width .2s}.exam-progress span{display:block;text-align:right;margin-top:8px;font:600 .65rem 'IBM Plex Mono',monospace;color:#737d8c}.exam-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px}.exam-question-area{min-width:0}.exam-question-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.exam-question-meta>span{font:700 .66rem 'IBM Plex Mono',monospace;color:#8d98aa;letter-spacing:.1em}.exam-flag{border:0;background:transparent;color:#8d98aa;cursor:pointer;font-size:.76rem}.exam-flag.active{color:#e0b15a}.exam-question-card{border:1px solid var(--line,rgba(255,255,255,.08));border-radius:20px;background:rgba(255,255,255,.025);padding:30px;min-height:440px}.exam-q-kicker{font:700 .67rem 'IBM Plex Mono',monospace;color:#a98bff;letter-spacing:.08em}.exam-question-card h2{font-size:clamp(1.35rem,2.2vw,1.8rem);line-height:1.35;margin:16px 0 26px;max-width:850px}.exam-options{display:flex;flex-direction:column;gap:10px}.exam-option{display:grid;grid-template-columns:34px 1fr 22px;align-items:center;gap:12px;text-align:left;border:1px solid var(--line,rgba(255,255,255,.08));background:rgba(255,255,255,.015);border-radius:12px;padding:14px;color:inherit;cursor:pointer;transition:.14s}.exam-option:hover{border-color:rgba(169,139,255,.38);transform:translateX(2px)}.exam-option>span{width:30px;height:30px;border:1px solid #465063;border-radius:9px;display:grid;place-items:center;font:700 .72rem 'IBM Plex Mono',monospace;color:#8d98aa;text-transform:uppercase}.exam-option b{font-size:.92rem;line-height:1.4;font-weight:500}.exam-option i{font-style:normal;color:#a98bff}.exam-option.selected{border-color:rgba(169,139,255,.62);background:rgba(169,139,255,.09)}.exam-option.selected>span{background:#a98bff;color:#15151b;border-color:#a98bff}.exam-nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;margin-top:13px}.exam-nav>button:last-child{justify-self:end}.exam-nav>span{text-align:center;font:600 .68rem 'IBM Plex Mono',monospace;color:#737d8c}
.exam-palette{border:1px solid var(--line,rgba(255,255,255,.08));border-radius:18px;background:rgba(255,255,255,.025);padding:18px;height:max-content;position:sticky;top:82px}.palette-head{display:flex;justify-content:space-between;align-items:center}.palette-head h3{margin:4px 0 0}.palette-head>span{font:700 .75rem 'IBM Plex Mono',monospace;color:#8d98aa}.palette-legend{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0;font-size:.62rem;color:#737d8c}.palette-legend span{display:flex;align-items:center;gap:5px}.palette-legend i{width:7px;height:7px;border-radius:2px;border:1px solid #465063}.legend-current{background:#a98bff!important;border-color:#a98bff!important}.legend-done{background:#344055}.legend-flag{background:#e0b15a;border-color:#e0b15a!important}.palette-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-height:370px;overflow:auto;padding-right:2px}.palette-grid button{height:35px;border:1px solid var(--line,rgba(255,255,255,.08));border-radius:8px;background:rgba(255,255,255,.02);color:#8d98aa;font:600 .67rem 'IBM Plex Mono',monospace;cursor:pointer}.palette-grid button:hover{border-color:#a98bff}.palette-grid button.done{background:rgba(169,139,255,.12);color:#d9d0ff}.palette-grid button.current{outline:2px solid #a98bff;outline-offset:-2px;color:#fff}.palette-grid button.flagged{box-shadow:inset 0 -3px #e0b15a}.palette-summary{margin-top:14px;padding-top:13px;border-top:1px solid var(--line,rgba(255,255,255,.08));font:600 .68rem 'IBM Plex Mono',monospace;color:#737d8c}.palette-summary b{color:#c5ccd8}.palette-summary span{margin:0 4px}.exam-leave{margin-top:15px;width:100%;border:0;background:transparent;color:#737d8c;cursor:pointer;font-size:.72rem}.exam-leave:hover{color:#e48aaa}
.exam-results{text-align:center}.exam-result-top{text-align:left}.exam-result-hero{padding:20px 0 10px}.exam-score-ring{width:180px;height:180px;border-radius:50%;margin:22px auto;background:conic-gradient(#a98bff var(--score),rgba(255,255,255,.06) 0);display:grid;place-items:center}.exam-score-ring>div{width:142px;height:142px;border-radius:50%;background:#11141b;display:flex;flex-direction:column;align-items:center;justify-content:center}.exam-score-ring b{font-size:2.35rem;letter-spacing:-.05em}.exam-score-ring span{font:600 .65rem 'IBM Plex Mono',monospace;color:#8d98aa;text-transform:uppercase}.exam-result-hero h2{font-size:1.7rem;margin:10px 0}.exam-result-hero p{color:#8d98aa}.exam-result-stats{max-width:800px;margin:25px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.exam-result-stats>div{border:1px solid var(--line,rgba(255,255,255,.08));border-radius:14px;padding:18px;background:rgba(255,255,255,.025)}.exam-result-stats span{display:block;color:#8d98aa;font-size:.68rem}.exam-result-stats b{display:block;margin-top:6px;font-size:1.5rem}.exam-result-actions{justify-content:center}.exam-result-note{max-width:800px;margin:20px auto;padding:17px;border:1px solid var(--line,rgba(255,255,255,.08));border-radius:14px;display:flex;flex-direction:column;gap:5px;text-align:left}.exam-result-note span{color:#8d98aa;font-size:.78rem;line-height:1.5}
@media(max-width:900px){.exam-builder,.exam-layout{grid-template-columns:1fr}.exam-rules,.exam-palette{position:static}.exam-hero{grid-template-columns:1fr}.exam-preview-card{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center}.exam-preview-card span{grid-column:1/-1}.exam-preview-card div{grid-column:2/-1;margin:0;padding:0;border:0}.exam-session-head{grid-template-columns:1fr auto}.exam-submit-top{display:none}}
@media(max-width:620px){.exam-setup,.exam-results{padding-left:4px;padding-right:4px}.exam-subject-grid{grid-template-columns:1fr}.exam-step{padding:17px}.exam-step-head>b{display:none}.exam-choice-row{display:grid;grid-template-columns:repeat(3,1fr)}.exam-choice{padding:10px 5px}.exam-question-card{padding:20px;min-height:0}.exam-nav{grid-template-columns:1fr 1fr}.exam-nav>span{display:none}.exam-nav>button:last-child{justify-self:end}.exam-session{padding-left:4px;padding-right:4px}.exam-session-head{margin:0 -4px 14px;padding:12px}.exam-question-meta{gap:8px}.exam-result-stats{grid-template-columns:repeat(2,1fr)}.exam-hero h2{font-size:2.25rem}}


/* iOS 26-inspired LIQUID GLASS layer for the existing Kazan MBBS OS.
   Existing quiz/exam logic is preserved. */
.ios26-exam-hero{
  position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 330px;
  min-height:360px;margin:0 0 22px;padding:42px;border-radius:34px;
  background:
    radial-gradient(circle at 84% 20%,rgba(169,139,255,.30),transparent 30%),
    radial-gradient(circle at 58% 100%,rgba(83,155,255,.17),transparent 34%),
    linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.025));
  border:1px solid rgba(255,255,255,.13);
  box-shadow:0 30px 90px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.12);
  backdrop-filter:blur(28px) saturate(145%);
}
.ios26-exam-hero:after{content:"";position:absolute;inset:1px;border-radius:33px;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.08),transparent 30%,transparent 70%,rgba(255,255,255,.035));}
.ios26-hero-copy{position:relative;z-index:2;align-self:center}
.ios26-eyebrow{display:flex;align-items:center;gap:9px;color:#a98bff;font:700 .67rem/1 'IBM Plex Mono',monospace;letter-spacing:.13em}
.ios26-eyebrow span{width:25px;height:25px;border-radius:9px;display:grid;place-items:center;background:rgba(169,139,255,.16);box-shadow:inset 0 1px rgba(255,255,255,.1)}
.ios26-eyebrow i{height:1px;width:35px;background:rgba(169,139,255,.35)}
.ios26-hero-copy h2{font-size:clamp(2.8rem,6vw,5rem);line-height:.95;letter-spacing:-.065em;margin:22px 0 18px;max-width:720px}
.ios26-hero-copy h2 span{color:#a98bff}
.ios26-hero-copy p{max-width:620px;color:#a9b1c0;font-size:.98rem;line-height:1.65;margin:0}
.ios26-trust-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.ios26-trust-row span{padding:9px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:#bfc6d2;font:600 .67rem 'IBM Plex Mono',monospace;box-shadow:inset 0 1px rgba(255,255,255,.05)}
.ios26-hero-preview{position:relative;z-index:2;display:grid;place-items:center}
.ios26-preview-glass{width:min(270px,100%);padding:25px;border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.16);box-shadow:0 25px 55px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.13);backdrop-filter:blur(24px) saturate(150%);transform:rotate(1.5deg)}
.ios26-preview-label{color:#8993a6;font:700 .6rem 'IBM Plex Mono',monospace;letter-spacing:.13em}.ios26-preview-number{font-size:5rem;font-weight:850;line-height:1;margin:18px 0 2px;letter-spacing:-.07em}.ios26-preview-caption{color:#aab2c0;font-size:.76rem}.ios26-preview-line{height:1px;background:rgba(255,255,255,.09);margin:20px 0 14px}.ios26-preview-meta{display:flex;align-items:baseline;justify-content:space-between}.ios26-preview-meta b{font-size:1.05rem}.ios26-preview-meta span{color:#858fa1;font-size:.7rem}
.ios26-orb{position:absolute;border-radius:50%;filter:blur(3px);pointer-events:none}.ios26-orb-a{width:190px;height:190px;right:90px;top:-105px;background:rgba(169,139,255,.22);box-shadow:0 0 90px rgba(169,139,255,.17)}.ios26-orb-b{width:120px;height:120px;right:-30px;bottom:-40px;background:rgba(85,161,255,.18);box-shadow:0 0 70px rgba(85,161,255,.13)}
.ios26-mode-section{margin:0 0 18px}.ios26-section-head{display:flex;justify-content:space-between;align-items:end;gap:15px;margin:0 2px 13px}.ios26-section-head h3{font-size:1.25rem;margin:4px 0 0;letter-spacing:-.025em}.ios26-selection-status{display:flex;align-items:center;gap:7px;color:#9099aa;font:600 .65rem 'IBM Plex Mono',monospace}.ios26-selection-status span{width:7px;height:7px;border-radius:50%;background:#62d59c;box-shadow:0 0 0 5px rgba(98,213,156,.08)}
.ios26-mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.ios26-mode-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;min-height:205px;padding:21px;text-align:left;color:inherit;border:1px solid rgba(255,255,255,.09);border-radius:23px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:0 14px 35px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.045);backdrop-filter:blur(18px);transition:transform .22s cubic-bezier(.2,.8,.2,1),border-color .22s,background .22s,box-shadow .22s}
.ios26-mode-card:hover{transform:translateY(-3px) scale(1.005);border-color:rgba(169,139,255,.3);box-shadow:0 22px 50px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.07)}
.ios26-mode-card.active{border-color:rgba(169,139,255,.65);background:linear-gradient(145deg,rgba(169,139,255,.15),rgba(169,139,255,.045));box-shadow:0 0 0 2px rgba(169,139,255,.08),0 24px 55px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.09)}
.ios26-mode-check{position:absolute;right:16px;top:16px;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.13);color:transparent;font-size:.7rem}.active .ios26-mode-check{background:#a98bff;border-color:#a98bff;color:#15151d}
.ios26-mode-icon{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.065);color:#c8ceda;font-size:20px;margin-bottom:19px;box-shadow:inset 0 1px rgba(255,255,255,.06)}.active .ios26-mode-icon{background:rgba(169,139,255,.16);color:#b99fff}
.ios26-mode-card b{font-size:.98rem;letter-spacing:-.01em}.ios26-mode-card small{margin-top:7px;color:#8993a5;line-height:1.5;font-size:.73rem;max-width:270px}.ios26-mode-card em{font-style:normal;margin-top:auto;padding-top:15px;color:#707b8d;font:700 .57rem 'IBM Plex Mono',monospace;letter-spacing:.12em}.active em{color:#a98bff}
.ios26-start{border-radius:17px!important;box-shadow:0 15px 35px rgba(169,139,255,.17)!important;background:linear-gradient(135deg,#a98bff,#7f63df)!important;border:1px solid rgba(255,255,255,.16)!important}
.ios26-start:hover{transform:translateY(-2px);filter:saturate(1.08)}
@media(max-width:900px){.ios26-exam-hero{grid-template-columns:1fr;padding:30px;min-height:auto}.ios26-hero-preview{justify-content:start;margin-top:10px}.ios26-preview-glass{transform:none}.ios26-mode-grid{grid-template-columns:1fr}.ios26-mode-card{min-height:165px}}
@media(max-width:620px){.ios26-exam-hero{padding:24px;border-radius:27px}.ios26-hero-copy h2{font-size:2.7rem}.ios26-section-head{align-items:start;flex-direction:column}.ios26-selection-status{display:none}.ios26-mode-card{min-height:155px}}

/* ─────────────────────────────────────────────────────────────────────────────
   KAZAN MBBS DESIGN SYSTEM OVERRIDES
   UI-only layer. Existing quiz, auth, Supabase, payment and exam logic remain
   untouched.
   ───────────────────────────────────────────────────────────────────────── */
:root {
  --kazan-accent: #a98bff;
  --kazan-accent-soft: rgba(169,139,255,.13);
  --kazan-bg: #080a0f;
  --kazan-surface: rgba(17,21,30,.72);
  --kazan-surface-solid: #11151e;
  --kazan-line: rgba(160,173,198,.16);
  --kazan-text: #f4f6fb;
  --kazan-muted: #8f9aaf;
  --kazan-shadow: 0 22px 70px rgba(0,0,0,.28);
}

html[data-theme="violet"] { --kazan-accent:#a98bff; --kazan-accent-soft:rgba(169,139,255,.13); }
html[data-theme="blue"] { --kazan-accent:#6ea8ff; --kazan-accent-soft:rgba(110,168,255,.13); }
html[data-theme="teal"] { --kazan-accent:#5ed1c1; --kazan-accent-soft:rgba(94,209,193,.13); }
html[data-theme="rose"] { --kazan-accent:#e48aaa; --kazan-accent-soft:rgba(228,138,170,.13); }
html[data-theme="amber"] { --kazan-accent:#e0b15a; --kazan-accent-soft:rgba(224,177,90,.13); }
html[data-theme="slate"] { --kazan-accent:#9ca9ba; --kazan-accent-soft:rgba(156,169,186,.13); }

html[data-appearance="light"] {
  --kazan-bg:#f4f6fa;
  --kazan-surface:rgba(255,255,255,.78);
  --kazan-surface-solid:#ffffff;
  --kazan-line:rgba(36,47,67,.13);
  --kazan-text:#111827;
  --kazan-muted:#667085;
  --kazan-shadow:0 20px 60px rgba(35,45,65,.12);
}

.app-shell {
  --accent:var(--kazan-accent);
  --accent-soft:var(--kazan-accent-soft);
  --bg:var(--kazan-bg);
  --surface:var(--kazan-surface);
  --line:var(--kazan-line);
  --text:var(--kazan-text);
  --muted:var(--kazan-muted);
  min-height:100vh;
  background:
    radial-gradient(900px 500px at 88% -5%, var(--kazan-accent-soft), transparent 62%),
    radial-gradient(700px 450px at -10% 20%, rgba(110,168,255,.055), transparent 65%),
    var(--kazan-bg);
  color:var(--kazan-text);
  transition:background .35s ease,color .25s ease;
}

.app-shell button,
.app-shell input { font-family:inherit; }

.app-shell button:focus-visible,
.app-shell input:focus-visible {
  outline:2px solid var(--kazan-accent);
  outline-offset:3px;
}

.wrap { position:relative; isolation:isolate; }
.wrap::before {
  content:"";
  position:fixed;
  width:420px;
  height:420px;
  right:-220px;
  top:18%;
  border-radius:50%;
  background:var(--kazan-accent-soft);
  filter:blur(90px);
  pointer-events:none;
  z-index:-1;
}

/* Header */
.top {
  position:relative;
  z-index:50;
  min-height:78px;
  align-items:center;
  border-bottom:1px solid var(--kazan-line);
}
.brand-button { transition:transform .22s ease, opacity .22s ease; }
.brand-button:hover { transform:translateY(-1px); }
.brand-mark {
  box-shadow:0 0 0 7px var(--kazan-accent-soft),0 10px 28px rgba(0,0,0,.18);
  transition:box-shadow .25s ease,transform .25s ease;
}
.brand-button:hover .brand-mark {
  transform:rotate(-3deg) scale(1.03);
  box-shadow:0 0 0 9px var(--kazan-accent-soft),0 14px 32px rgba(0,0,0,.22);
}
.top-right { gap:10px; }
.top-stat {
  border:1px solid var(--kazan-line);
  border-radius:999px;
  padding:8px 12px;
  background:rgba(255,255,255,.025);
  backdrop-filter:blur(12px);
}

/* Premium hero */
.hero-note {
  position:relative;
  overflow:hidden;
  border:1px solid var(--kazan-line) !important;
  border-radius:30px !important;
  background:
    linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,255,255,.012) 48%,var(--kazan-accent-soft)),
    rgba(12,15,22,.56) !important;
  box-shadow:var(--kazan-shadow),inset 0 1px rgba(255,255,255,.07) !important;
  backdrop-filter:blur(22px);
}
html[data-appearance="light"] .hero-note {
  background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,255,255,.72)) !important;
}
.hero-note::before {
  content:"";
  position:absolute;
  width:360px;
  height:360px;
  right:-110px;
  top:-160px;
  border-radius:50%;
  background:radial-gradient(circle,var(--kazan-accent-soft),transparent 68%);
  pointer-events:none;
}
.hero-note::after {
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(115deg,transparent 0 42%,rgba(255,255,255,.025) 50%,transparent 58%);
  transform:translateX(-100%);
  animation:kazan-sheen 9s ease-in-out infinite;
  pointer-events:none;
}
@keyframes kazan-sheen {
  0%,55%,100% { transform:translateX(-100%); }
  70% { transform:translateX(100%); }
}
.hero-copy { position:relative; z-index:2; }
.hero-copy h2 {
  max-width:780px;
  letter-spacing:-.055em !important;
  text-wrap:balance;
}
.hero-copy p { max-width:650px; }
.hero-actions { position:relative; z-index:3; }
.hero-actions .next-btn {
  box-shadow:0 12px 30px var(--kazan-accent-soft);
  transition:transform .2s ease,box-shadow .2s ease;
}
.hero-actions .next-btn:hover {
  transform:translateY(-2px);
  box-shadow:0 16px 38px var(--kazan-accent-soft);
}
.hero-stats {
  position:relative;
  z-index:3;
  gap:9px !important;
}
.hero-stat {
  min-height:78px;
  border:1px solid var(--kazan-line) !important;
  border-radius:16px !important;
  background:rgba(255,255,255,.028) !important;
  backdrop-filter:blur(12px);
  transition:transform .2s ease,border-color .2s ease,background .2s ease;
}
html[data-appearance="light"] .hero-stat { background:rgba(255,255,255,.72) !important; }
.hero-stat:hover {
  transform:translateY(-3px);
  border-color:rgba(169,139,255,.32) !important;
  background:var(--kazan-accent-soft) !important;
}
.hero-stat b { color:var(--kazan-text); }
.hero-stat-feature { position:relative; overflow:hidden; }
.hero-stat-orbit {
  width:30px;
  height:30px;
  display:grid;
  place-items:center;
  border-radius:50%;
  color:var(--kazan-accent);
  background:var(--kazan-accent-soft);
  box-shadow:0 0 25px var(--kazan-accent-soft);
}
.hero-floating-chip {
  position:absolute;
  z-index:5;
  display:flex;
  align-items:center;
  gap:7px;
  padding:8px 11px;
  border:1px solid var(--kazan-line);
  border-radius:999px;
  background:rgba(16,20,29,.72);
  color:var(--kazan-muted);
  box-shadow:0 12px 30px rgba(0,0,0,.18);
  backdrop-filter:blur(16px);
  font:600 .66rem/1 'IBM Plex Mono',monospace;
  pointer-events:none;
  animation:kazan-float 5s ease-in-out infinite;
}
html[data-appearance="light"] .hero-floating-chip { background:rgba(255,255,255,.82); }
.hero-floating-chip span { color:var(--kazan-accent); }
.chip-one { right:6%; top:18%; }
.chip-two { right:12%; bottom:9%; animation-delay:-2.1s; }
@keyframes kazan-float {
  0%,100% { transform:translateY(0); }
  50% { transform:translateY(-5px); }
}

/* Subject cards: no collisions, ever */
.grid { align-items:stretch; }
.card {
  min-width:0;
  overflow:hidden;
  isolation:isolate;
  border-radius:20px !important;
  border:1px solid var(--kazan-line) !important;
  background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012)) !important;
  box-shadow:0 12px 36px rgba(0,0,0,.10),inset 0 1px rgba(255,255,255,.035);
  transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease !important;
}
html[data-appearance="light"] .card { background:rgba(255,255,255,.84) !important; }
.card:hover {
  transform:translateY(-5px);
  border-color:color-mix(in srgb,var(--accent) 42%,transparent) !important;
  box-shadow:0 20px 45px rgba(0,0,0,.16),0 0 0 1px var(--accent-soft);
}
.card-top { min-width:0; }
.cname {
  min-width:0;
  overflow-wrap:anywhere;
  word-break:normal;
  line-height:1.22 !important;
}
.ccount,.cstart { min-width:0; overflow-wrap:anywhere; }
.lock-pill,.free-pill {
  flex:0 0 auto;
  white-space:nowrap;
}
.cstart span { flex:0 0 auto; }

/* Theme panel */
.theme-wrap { position:relative; z-index:100; }
.theme-button {
  border:1px solid var(--kazan-line) !important;
  background:rgba(255,255,255,.035) !important;
  border-radius:14px !important;
  backdrop-filter:blur(14px);
  transition:transform .18s ease,border-color .18s ease,background .18s ease;
}
.theme-button:hover {
  transform:translateY(-1px);
  border-color:color-mix(in srgb,var(--accent) 45%,transparent) !important;
  background:var(--kazan-accent-soft) !important;
}
.theme-menu {
  position:absolute !important;
  top:calc(100% + 10px) !important;
  right:0 !important;
  left:auto !important;
  width:min(360px,calc(100vw - 28px)) !important;
  max-height:min(76vh,520px);
  overflow:auto;
  padding:15px !important;
  border:1px solid var(--kazan-line) !important;
  border-radius:20px !important;
  background:rgba(15,19,27,.94) !important;
  box-shadow:0 24px 70px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.06) !important;
  backdrop-filter:blur(24px) saturate(1.15);
  animation:kazan-panel-in .16s ease-out;
}
html[data-appearance="light"] .theme-menu {
  background:rgba(255,255,255,.96) !important;
  box-shadow:0 24px 60px rgba(35,45,65,.16),inset 0 1px rgba(255,255,255,.9) !important;
}
@keyframes kazan-panel-in {
  from { opacity:0; transform:translateY(-5px) scale(.985); }
  to { opacity:1; transform:translateY(0) scale(1); }
}
.theme-panel-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:2px 2px 14px;
  border-bottom:1px solid var(--kazan-line);
}
.theme-panel-header > div { display:flex; flex-direction:column; gap:4px; }
.theme-panel-header strong { font-size:.98rem; letter-spacing:-.02em; }
.theme-panel-kicker {
  color:var(--kazan-accent);
  font:700 .57rem/1 'IBM Plex Mono',monospace;
  letter-spacing:.14em;
}
.theme-panel-close {
  width:30px;
  height:30px;
  display:grid;
  place-items:center;
  border:1px solid var(--kazan-line);
  border-radius:9px;
  background:rgba(255,255,255,.035);
  color:var(--kazan-muted);
  cursor:pointer;
  font-size:18px;
}
.theme-menu-title {
  margin:15px 2px 8px !important;
  color:var(--kazan-muted) !important;
  font:700 .58rem/1 'IBM Plex Mono',monospace !important;
  letter-spacing:.13em !important;
  text-transform:uppercase;
}
.appearance-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.appearance-choice {
  min-width:0;
  display:flex;
  align-items:center;
  gap:9px;
  padding:11px 10px;
  border:1px solid var(--kazan-line);
  border-radius:12px;
  background:rgba(255,255,255,.025);
  color:inherit;
  cursor:pointer;
  text-align:left;
  transition:.16s ease;
}
.appearance-choice:hover,.appearance-choice.active {
  border-color:color-mix(in srgb,var(--accent) 55%,transparent);
  background:var(--kazan-accent-soft);
}
.appearance-choice span:nth-child(2) { flex:1; min-width:0; font-size:.78rem; }
.appearance-icon {
  width:27px;
  height:27px;
  display:grid;
  place-items:center;
  border-radius:8px;
  background:rgba(255,255,255,.06);
  color:var(--kazan-accent);
}
.accent-title { margin-top:17px !important; }
.accent-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
.accent-grid .theme-choice {
  min-width:0;
  display:flex;
  align-items:center;
  gap:9px;
  padding:10px;
  border:1px solid var(--kazan-line);
  border-radius:11px;
  background:rgba(255,255,255,.025);
  color:inherit;
  cursor:pointer;
  text-align:left;
  transition:.16s ease;
}
.accent-grid .theme-choice:hover,.accent-grid .theme-choice.active {
  border-color:color-mix(in srgb,var(--accent) 55%,transparent);
  background:var(--kazan-accent-soft);
}
.accent-grid .theme-choice > span:nth-child(2) { flex:1; }
.theme-swatch {
  width:13px !important;
  height:13px !important;
  min-width:13px;
  border-radius:50% !important;
  box-shadow:0 0 0 4px rgba(255,255,255,.035),0 0 14px currentColor;
}
.theme-check { margin-left:auto; color:var(--kazan-accent); font-weight:800; }
.theme-panel-footer {
  margin:13px 2px 1px;
  padding-top:11px;
  border-top:1px solid var(--kazan-line);
  color:var(--kazan-muted);
  font-size:.63rem;
}

/* Quiz controls: one elegant floating surface */
.quiz-view { position:relative; }
.submit-bar {
  position:sticky !important;
  top:10px !important;
  z-index:35 !important;
  display:grid !important;
  grid-template-columns:minmax(180px,1fr) auto auto !important;
  align-items:center;
  gap:14px;
  margin:16px 0 20px !important;
  padding:10px !important;
  border:1px solid var(--kazan-line) !important;
  border-radius:18px !important;
  background:rgba(12,16,24,.80) !important;
  box-shadow:0 18px 45px rgba(0,0,0,.20),inset 0 1px rgba(255,255,255,.06) !important;
  backdrop-filter:blur(22px) saturate(1.2);
}
html[data-appearance="light"] .submit-bar {
  background:rgba(255,255,255,.86) !important;
  box-shadow:0 18px 45px rgba(35,45,65,.13),inset 0 1px rgba(255,255,255,.95) !important;
}
.bar-count { min-width:0; }
.count-text { font-size:.68rem; color:var(--kazan-muted); margin-bottom:5px; }
.count-track { height:4px; overflow:hidden; border-radius:99px; background:rgba(127,141,165,.15); }
.count-fill {
  height:100%;
  border-radius:99px;
  background:var(--kazan-accent) !important;
  box-shadow:0 0 14px var(--kazan-accent-soft);
}
.bar-tally { display:flex; align-items:center; gap:12px; white-space:nowrap; }
.bar-actions { display:flex; align-items:center; justify-content:flex-end; gap:7px; flex-wrap:wrap; }
.bar-actions button,.bar-tally { min-height:38px; }
.reveal-btn {
  border:1px solid var(--kazan-line) !important;
  border-radius:11px !important;
  background:rgba(255,255,255,.025) !important;
  color:inherit;
  padding:9px 12px !important;
  cursor:pointer;
  transition:.17s ease;
}
.reveal-btn:hover {
  transform:translateY(-1px);
  border-color:color-mix(in srgb,var(--accent) 45%,transparent) !important;
  background:var(--kazan-accent-soft) !important;
}

/* Questions */
.q-plate {
  position:relative;
  overflow:hidden;
  border:1px solid var(--kazan-line) !important;
  border-radius:22px !important;
  background:linear-gradient(145deg,rgba(255,255,255,.038),rgba(255,255,255,.012)) !important;
  box-shadow:0 14px 42px rgba(0,0,0,.10),inset 0 1px rgba(255,255,255,.035);
  transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease;
}
html[data-appearance="light"] .q-plate { background:rgba(255,255,255,.88) !important; }
.q-plate:hover {
  border-color:color-mix(in srgb,var(--accent) 25%,transparent) !important;
}
.q-eyebrow { flex-wrap:wrap; gap:8px; }
.q-text {
  max-width:950px;
  text-wrap:pretty;
  overflow-wrap:anywhere;
  letter-spacing:-.012em;
}
.options { gap:9px !important; }
.opt {
  min-width:0;
  display:grid !important;
  grid-template-columns:34px minmax(0,1fr) !important;
  align-items:center;
  gap:12px !important;
  border:1px solid var(--kazan-line) !important;
  border-radius:14px !important;
  background:rgba(255,255,255,.018) !important;
  transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease !important;
}
html[data-appearance="light"] .opt { background:rgba(247,249,252,.82) !important; }
.opt > span:last-child {
  min-width:0;
  overflow-wrap:anywhere;
  line-height:1.45;
}
.opt:hover:not(:disabled) {
  transform:translateX(3px);
  border-color:color-mix(in srgb,var(--accent) 42%,transparent) !important;
  background:var(--kazan-accent-soft) !important;
}
.opt .letter {
  border-radius:10px !important;
  transition:.16s ease;
}
.opt.correct {
  border-color:rgba(77,196,137,.45) !important;
  background:rgba(77,196,137,.09) !important;
}
.opt.wrong {
  border-color:rgba(228,138,170,.48) !important;
  background:rgba(228,138,170,.08) !important;
}
.feedback {
  border-radius:12px !important;
  line-height:1.5;
}

/* Results */
.result-hero {
  position:relative;
  padding:30px 18px !important;
  border:1px solid var(--kazan-line);
  border-radius:24px;
  background:linear-gradient(145deg,rgba(255,255,255,.04),var(--kazan-accent-soft));
  box-shadow:var(--kazan-shadow);
}
.result-ring {
  filter:drop-shadow(0 0 24px var(--kazan-accent-soft));
}
.result-stats > div,.review-item {
  border:1px solid var(--kazan-line) !important;
  background:rgba(255,255,255,.025) !important;
  border-radius:15px !important;
}

/* Dashboard */
.dashboard-head {
  position:relative;
  overflow:hidden;
  padding:26px !important;
  border:1px solid var(--kazan-line);
  border-radius:24px;
  background:linear-gradient(135deg,rgba(255,255,255,.045),var(--kazan-accent-soft));
  box-shadow:var(--kazan-shadow);
}
.dashboard-head::after {
  content:"";
  position:absolute;
  width:230px;height:230px;
  right:-100px;top:-130px;
  border-radius:50%;
  background:var(--kazan-accent-soft);
  filter:blur(18px);
}
.sync-badge {
  position:relative;
  z-index:2;
  border:1px solid rgba(80,205,155,.22) !important;
  background:rgba(80,205,155,.07) !important;
  backdrop-filter:blur(10px);
}
.metric-card,.dashboard-card,.account-actions {
  border:1px solid var(--kazan-line) !important;
  border-radius:20px !important;
  background:rgba(255,255,255,.028) !important;
  box-shadow:0 14px 42px rgba(0,0,0,.08),inset 0 1px rgba(255,255,255,.035);
  backdrop-filter:blur(14px);
  transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
}
html[data-appearance="light"] .metric-card,
html[data-appearance="light"] .dashboard-card,
html[data-appearance="light"] .account-actions { background:rgba(255,255,255,.82) !important; }
.metric-card:hover,.dashboard-card:hover {
  border-color:color-mix(in srgb,var(--accent) 24%,transparent) !important;
}
.metric-icon {
  background:var(--kazan-accent-soft) !important;
  color:var(--kazan-accent) !important;
}
.subject-track {
  background:rgba(127,141,165,.13) !important;
}
.subject-track > div {
  background:var(--kazan-accent) !important;
  box-shadow:0 0 15px var(--kazan-accent-soft);
}
.focus-box {
  border-color:color-mix(in srgb,var(--accent) 28%,transparent) !important;
  background:var(--kazan-accent-soft) !important;
}
.history-row {
  border-color:var(--kazan-line) !important;
  transition:background .16s ease,transform .16s ease;
}
.history-row:hover {
  background:var(--kazan-accent-soft);
  transform:translateX(2px);
}

/* Exam mode */
.exam-setup,.exam-results,.exam-session { position:relative; }
.exam-step,.exam-rules,.exam-preview-card,.exam-question-card,.exam-palette,.exam-result-stats>div,.exam-result-note {
  background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012)) !important;
  box-shadow:0 16px 42px rgba(0,0,0,.09),inset 0 1px rgba(255,255,255,.035);
  backdrop-filter:blur(14px);
}
html[data-appearance="light"] .exam-step,
html[data-appearance="light"] .exam-rules,
html[data-appearance="light"] .exam-preview-card,
html[data-appearance="light"] .exam-question-card,
html[data-appearance="light"] .exam-palette,
html[data-appearance="light"] .exam-result-stats>div,
html[data-appearance="light"] .exam-result-note {
  background:rgba(255,255,255,.86) !important;
}
.exam-subject,.exam-choice,.exam-option {
  min-width:0;
  transition:transform .16s ease,border-color .16s ease,background .16s ease !important;
}
.exam-subject > span:nth-child(2),
.exam-option b {
  min-width:0;
  overflow-wrap:anywhere;
}
.exam-choice.active,.exam-subject.selected {
  border-color:color-mix(in srgb,var(--accent) 60%,transparent) !important;
  background:var(--kazan-accent-soft) !important;
}
.exam-check,.exam-option.selected > span {
  border-color:var(--kazan-accent) !important;
}
.exam-option.selected > span {
  background:var(--kazan-accent) !important;
}
.exam-progress > div,.exam-score-ring {
  background-color:var(--kazan-accent) !important;
}
.exam-score-ring {
  filter:drop-shadow(0 0 28px var(--kazan-accent-soft));
}

/* Prevent sticky controls from obscuring the question when jumping */
.q-plate { scroll-margin-top:100px; }

/* Mobile: deliberate stacking, no collisions */
@media (max-width:900px) {
  .top { flex-wrap:wrap; gap:12px; }
  .top-right { margin-left:auto; }
  .hero-floating-chip { display:none; }
  .submit-bar {
    grid-template-columns:1fr !important;
    gap:8px;
    padding:9px !important;
    top:6px !important;
  }
  .bar-count { width:100%; }
  .bar-tally { justify-content:center; }
  .bar-actions { justify-content:stretch; }
  .bar-actions button { flex:1 1 0; min-width:0; }
  .theme-menu {
    position:fixed !important;
    top:76px !important;
    right:12px !important;
    max-height:calc(100vh - 90px);
  }
}
@media (max-width:620px) {
  .top-stat { display:none; }
  .theme-button { padding:10px 11px !important; }
  .account-button { padding:10px 12px !important; }
  .hero-note { border-radius:22px !important; }
  .hero-copy h2 { font-size:clamp(2.2rem,11vw,3.5rem) !important; }
  .hero-actions { flex-direction:column; align-items:stretch; }
  .hero-actions button { width:100%; }
  .hero-stats { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
  .hero-stat { min-width:0; }
  .submit-bar { border-radius:15px !important; }
  .bar-actions { display:grid !important; grid-template-columns:1fr 1fr !important; }
  .bar-actions .next-btn { grid-column:1/-1; }
  .q-plate { border-radius:17px !important; }
  .q-text { font-size:1.08rem !important; }
  .opt { grid-template-columns:31px minmax(0,1fr) !important; padding:11px !important; }
  .theme-menu { width:min(340px,calc(100vw - 20px)) !important; right:10px !important; }
  .appearance-grid,.accent-grid { grid-template-columns:1fr 1fr; }
  .dashboard-head { padding:20px !important; }
}
@media (prefers-reduced-motion:reduce) {
  *,*::before,*::after {
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    scroll-behavior:auto !important;
    transition-duration:.01ms !important;
  }
}

/* ─────────────── STUDY OS FEATURES ─────────────── */
.search-launch{display:flex;align-items:center;gap:8px;border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:inherit;border-radius:12px;padding:9px 11px;cursor:pointer;backdrop-filter:blur(12px);transition:.18s}.search-launch:hover{border-color:color-mix(in srgb,var(--accent) 42%,transparent);background:var(--kazan-accent-soft);transform:translateY(-1px)}.search-launch span:first-child{font-size:18px}.search-launch kbd{font:600 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);border:1px solid var(--kazan-line);border-radius:6px;padding:2px 5px}.search-label{font-size:.76rem}
.study-command-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0 30px}.command-card{position:relative;overflow:hidden;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;text-align:left;padding:17px 18px;border:1px solid var(--kazan-line);border-radius:20px;color:inherit;background:linear-gradient(135deg,rgba(255,255,255,.045),var(--kazan-accent-soft));box-shadow:0 14px 40px rgba(0,0,0,.09),inset 0 1px rgba(255,255,255,.05);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}.command-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 40%,transparent);box-shadow:0 20px 50px var(--kazan-accent-soft)}.command-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:20px}.command-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.command-copy b{font-size:.9rem}.command-copy small{color:var(--kazan-muted);line-height:1.4}.command-card>strong{font:700 .68rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);white-space:nowrap}
.search-overlay{position:fixed;inset:0;z-index:500;display:grid;place-items:start center;padding:10vh 18px 30px;background:rgba(3,5,9,.62);backdrop-filter:blur(18px)}.search-panel{width:min(860px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--kazan-line);border-radius:26px;background:var(--kazan-surface-solid);box-shadow:0 30px 100px rgba(0,0,0,.38),0 0 0 1px var(--kazan-accent-soft);}.search-top{display:flex;justify-content:space-between;align-items:flex-start;padding:24px 24px 12px}.search-top h2{margin:5px 0 0;font-size:1.7rem;letter-spacing:-.035em}.search-close{border:1px solid var(--kazan-line);background:rgba(255,255,255,.03);color:inherit;width:34px;height:34px;border-radius:10px;font-size:20px;cursor:pointer}.search-input-wrap{margin:0 24px;display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid var(--kazan-line);border-radius:14px;background:rgba(255,255,255,.035);box-shadow:inset 0 1px rgba(255,255,255,.04)}.search-input-wrap>span{font-size:21px;color:var(--kazan-muted)}.search-input-wrap input{flex:1;border:0;outline:0;background:transparent;color:inherit;font-size:.95rem}.search-input-wrap kbd{font:600 .6rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);border:1px solid var(--kazan-line);border-radius:6px;padding:3px 5px}.search-meta{padding:12px 24px 8px;color:var(--kazan-muted);font:600 .62rem 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em}.search-results{overflow:auto;padding:4px 16px 16px}.search-result{display:flex;align-items:center;gap:14px;padding:14px 8px;border-top:1px solid var(--kazan-line)}.search-result-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}.search-result-subject{font:700 .6rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);text-transform:uppercase}.search-result-main b{font-size:.84rem;line-height:1.45}.search-result-main small{color:var(--kazan-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.search-result-actions{display:flex;gap:7px}.search-result-actions button{border:1px solid var(--kazan-line);background:rgba(255,255,255,.03);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:.7rem}.search-result-actions button:hover,.search-result-actions button.active{border-color:var(--kazan-accent);color:var(--kazan-accent);background:var(--kazan-accent-soft)}.search-empty{padding:40px;text-align:center;color:var(--kazan-muted)}.search-footer{padding:12px 24px;border-top:1px solid var(--kazan-line);color:var(--kazan-muted);font-size:.67rem}
.quiz-session-topline{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;margin:0 0 20px;padding:10px 0;}
.quiz-session-topline .quiz-title{text-align:center;font-weight:700;}
.quiz-session-count{justify-self:end;font:700 .68rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);}
.quiz-bottom-dashboard{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:120;width:min(1120px,calc(100vw - 40px));display:grid;grid-template-columns:minmax(260px,1.35fr) auto auto;align-items:center;gap:20px;padding:13px 15px 13px 18px;border:1px solid color-mix(in srgb,var(--kazan-accent) 24%,var(--kazan-line));border-radius:20px;background:color-mix(in srgb,var(--kazan-panel) 86%,rgba(8,11,17,.92));box-shadow:0 18px 50px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.025) inset;backdrop-filter:blur(22px) saturate(1.2);}
.quiz-bottom-main{min-width:0;}
.quiz-bottom-label{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:7px;}
.quiz-bottom-label span{font:800 .58rem 'IBM Plex Mono',monospace;letter-spacing:.13em;color:var(--kazan-muted);}
.quiz-bottom-label strong{font-size:.92rem;white-space:nowrap;}
.quiz-bottom-label em{font-style:normal;color:var(--kazan-muted);font-weight:500;font-size:.72rem;}
.quiz-bottom-track{height:6px;border-radius:999px;background:rgba(127,141,165,.13);overflow:hidden;}
.quiz-bottom-track>div{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--kazan-accent),color-mix(in srgb,var(--kazan-accent) 55%,white));box-shadow:0 0 14px var(--kazan-accent-soft);transition:width .25s ease;}
.quiz-bottom-stats{display:flex;align-items:center;gap:15px;white-space:nowrap;font:700 .67rem 'IBM Plex Mono',monospace;}
.quiz-bottom-stats span{display:flex;align-items:center;gap:6px;}
.quiz-bottom-stats i{width:7px;height:7px;border-radius:50%;display:block;}
.quiz-bottom-actions{display:flex;align-items:center;gap:7px;justify-content:flex-end;}
.session-action,.session-submit{height:40px;border:1px solid var(--kazan-line);border-radius:12px;padding:0 13px;background:rgba(255,255,255,.025);color:var(--kazan-text);font:700 .67rem 'IBM Plex Mono',monospace;white-space:nowrap;cursor:pointer;transition:.16s ease;}
.session-action:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--kazan-line));background:var(--kazan-accent-soft);transform:translateY(-1px);}
.session-submit{border-color:var(--kazan-accent);background:var(--kazan-accent);color:#111;box-shadow:0 8px 24px var(--kazan-accent-soft);}
.session-submit:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04);}
.session-submit:disabled{opacity:.42;cursor:not-allowed;box-shadow:none;}
.quiz-list{padding-bottom:115px;}
@media(max-width:900px){.quiz-bottom-dashboard{grid-template-columns:minmax(180px,1fr) auto;gap:12px;width:min(760px,calc(100vw - 28px));bottom:12px;padding:12px;}.quiz-bottom-stats{grid-column:2;grid-row:1;justify-content:flex-end;}.quiz-bottom-actions{grid-column:1/-1;grid-row:2;justify-content:stretch;}.quiz-bottom-actions .session-action,.quiz-bottom-actions .session-submit{flex:1;}.quiz-list{padding-bottom:145px;}}
@media(max-width:620px){.quiz-session-topline{grid-template-columns:auto 1fr auto;gap:8px;margin-bottom:14px;padding:8px 0;}.quiz-session-topline .back-btn{font-size:.62rem;padding:7px 8px;}.quiz-session-topline .quiz-title{font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.quiz-session-count{font-size:.58rem;}.quiz-bottom-dashboard{left:10px;right:10px;bottom:10px;transform:none;width:auto;display:grid;grid-template-columns:1fr auto;gap:9px;padding:10px;border-radius:17px;}.quiz-bottom-main{grid-column:1/-1;}.quiz-bottom-label{margin-bottom:6px;}.quiz-bottom-label span{font-size:.5rem;}.quiz-bottom-label strong{font-size:.82rem;}.quiz-bottom-label em{font-size:.64rem;}.quiz-bottom-track{height:5px;}.quiz-bottom-stats{grid-column:1/-1;grid-row:auto;justify-content:flex-start;gap:13px;font-size:.56rem;}.quiz-bottom-actions{grid-column:1/-1;grid-row:auto;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}.quiz-bottom-actions .session-action,.quiz-bottom-actions .session-submit{min-width:0;flex:initial;height:36px;padding:0 7px;font-size:.55rem;}.quiz-bottom-actions span{overflow:hidden;text-overflow:ellipsis;}.quiz-list{padding-bottom:205px;}}
.q-utility-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 5px}.question-save{border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:var(--kazan-muted);border-radius:9px;padding:7px 9px;font-size:.67rem;cursor:pointer}.question-save:hover,.question-save.active{border-color:var(--kazan-accent);color:var(--kazan-accent);background:var(--kazan-accent-soft)}.question-save span{font-size:15px;margin-right:5px}.question-hint{font:600 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);text-transform:uppercase;letter-spacing:.08em}.personal-note{margin-top:14px;padding-top:13px;border-top:1px solid var(--kazan-line)}.personal-note-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.personal-note-head span{font:700 .63rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);text-transform:uppercase}.personal-note-head small{color:var(--kazan-muted);font-size:.6rem}.personal-note textarea{width:100%;resize:vertical;box-sizing:border-box;border:1px solid var(--kazan-line);border-radius:11px;background:rgba(255,255,255,.025);color:inherit;padding:10px 11px;font:inherit;font-size:.76rem;line-height:1.5;outline:0}.personal-note textarea:focus{border-color:color-mix(in srgb,var(--accent) 48%,transparent);background:var(--kazan-accent-soft)}
.dashboard-command-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:12px;margin:16px 0}.dashboard-command{position:relative;overflow:hidden;padding:20px;border:1px solid var(--kazan-line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.04),var(--kazan-accent-soft));box-shadow:0 14px 40px rgba(0,0,0,.08),inset 0 1px rgba(255,255,255,.04)}.dashboard-command::after{content:"";position:absolute;width:180px;height:180px;right:-90px;bottom:-100px;border-radius:50%;background:var(--kazan-accent-soft);filter:blur(20px)}.command-top{display:flex;justify-content:space-between;align-items:center;color:var(--kazan-muted);font-size:.66rem}.prediction-badge{font:700 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-accent)}.prediction-number{font-size:2.7rem;font-weight:750;letter-spacing:-.06em;margin-top:10px}.dashboard-command>strong{font-size:.9rem}.dashboard-command>p{max-width:540px;color:var(--kazan-muted);font-size:.72rem;line-height:1.5;margin:7px 0 12px}.prediction-line{height:6px;border-radius:99px;background:rgba(127,141,165,.12);overflow:hidden}.prediction-line span{display:block;height:100%;border-radius:99px;background:var(--kazan-accent);box-shadow:0 0 16px var(--kazan-accent-soft)}.dash-mini-row{display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--kazan-line);font-size:.7rem;color:var(--kazan-muted)}.dash-mini-row b{color:var(--kazan-text)}.saved-library-card{margin-top:14px}.saved-library-list{display:flex;flex-direction:column}.saved-library-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--kazan-line)}.saved-library-row>div{min-width:0;display:flex;flex-direction:column;gap:3px;flex:1}.saved-library-row span{font:700 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);text-transform:uppercase}.saved-library-row b{font-size:.75rem;line-height:1.4}.saved-library-row small{color:var(--kazan-muted);font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.saved-library-row button{width:32px;height:32px;border:1px solid var(--kazan-line);border-radius:9px;background:var(--kazan-accent-soft);color:var(--kazan-accent);cursor:pointer}
@media(max-width:760px){.search-launch .search-label,.search-launch kbd{display:none}.study-command-grid,.dashboard-command-grid{grid-template-columns:1fr}.command-card{grid-template-columns:auto 1fr}.command-card>strong{grid-column:2}.search-overlay{padding:6vh 10px 20px}.search-top{padding:20px 18px 10px}.search-input-wrap{margin:0 18px}.search-meta{padding-left:18px;padding-right:18px}.search-result{align-items:flex-start;flex-direction:column}.search-result-actions{width:100%}.search-result-actions button:last-child{flex:1}.q-utility-row{align-items:flex-start}.question-hint{display:none}.personal-note textarea{font-size:.72rem}}

/* Challenge Mode: intentionally separate interaction model from normal practice. */
.challenge-view{min-height:calc(100vh - 80px);padding:22px 0 70px}.challenge-shell{max-width:1180px;margin:0 auto}.challenge-header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;padding:14px 0 20px;border-bottom:1px solid var(--kazan-line)}.challenge-exit{justify-self:start;border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:var(--kazan-muted);border-radius:12px;padding:10px 13px;cursor:pointer}.challenge-brand{display:flex;align-items:center;gap:10px}.challenge-brand>div{display:flex;flex-direction:column;gap:4px}.challenge-brand span:not(.challenge-live-dot){font:800 .68rem 'IBM Plex Mono',monospace;letter-spacing:.13em;color:var(--kazan-accent)}.challenge-brand small{color:var(--kazan-muted);font-size:.7rem}.challenge-live-dot{width:9px;height:9px;border-radius:50%;background:var(--kazan-accent);box-shadow:0 0 0 6px var(--kazan-accent-soft),0 0 22px var(--kazan-accent-soft)}.challenge-score{justify-self:end;display:flex;align-items:baseline;gap:7px}.challenge-score b{font-size:1.25rem}.challenge-score span{font:600 .65rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);text-transform:uppercase}.challenge-progress{padding:18px 0 22px}.challenge-progress-track{height:5px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}.challenge-progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--kazan-accent),rgba(255,255,255,.9));transition:width .25s ease}.challenge-progress>div+div{display:flex;justify-content:space-between;margin-top:9px;font:700 .62rem 'IBM Plex Mono',monospace;color:var(--kazan-muted)}.challenge-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px}.challenge-main{min-width:0}.challenge-question-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.challenge-topic{font:800 .65rem 'IBM Plex Mono',monospace;letter-spacing:.1em;color:var(--kazan-accent)}.challenge-bookmark{border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:var(--kazan-muted);border-radius:10px;padding:8px 11px;font-size:.72rem;cursor:pointer}.challenge-bookmark.active{color:var(--kazan-accent);border-color:var(--kazan-accent)}.challenge-card{position:relative;overflow:hidden;border:1px solid var(--kazan-line);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:var(--kazan-shadow),inset 0 1px rgba(255,255,255,.06);padding:34px;min-height:510px}.challenge-card:before{content:"";position:absolute;width:300px;height:300px;right:-170px;top:-160px;border-radius:50%;background:radial-gradient(circle,var(--kazan-accent-soft),transparent 68%);pointer-events:none}.challenge-number{position:relative;width:46px;height:46px;display:grid;place-items:center;border:1px solid var(--kazan-accent);border-radius:14px;color:var(--kazan-accent);background:var(--kazan-accent-soft);font:800 .75rem 'IBM Plex Mono',monospace}.challenge-question{position:relative;margin:30px 0 30px;max-width:850px;font-size:clamp(1.45rem,2.8vw,2.05rem);font-weight:750;line-height:1.32;letter-spacing:-.035em}.challenge-options{position:relative;display:grid;gap:10px}.challenge-option{display:grid;grid-template-columns:42px 1fr 22px;align-items:center;gap:13px;text-align:left;border:1px solid var(--kazan-line);background:rgba(255,255,255,.018);color:var(--kazan-text);border-radius:15px;padding:14px 15px;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.challenge-option:hover:not(:disabled){transform:translateY(-2px);border-color:var(--kazan-accent);background:var(--kazan-accent-soft)}.challenge-option:disabled{cursor:default}.challenge-option.selected{border-color:var(--kazan-accent);background:var(--kazan-accent-soft);box-shadow:0 0 0 1px var(--kazan-accent-soft)}.challenge-option-letter{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--kazan-line);border-radius:10px;font:800 .72rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);text-transform:uppercase}.challenge-option.selected .challenge-option-letter{background:var(--kazan-accent);color:#111;border-color:var(--kazan-accent)}.challenge-option>b{color:var(--kazan-accent)}.challenge-feedback{margin-top:14px;padding:12px 14px;border-radius:12px;display:flex;justify-content:space-between;gap:12px;font-size:.78rem}.challenge-feedback.correct{border:1px solid rgba(55,210,160,.28);background:rgba(55,210,160,.07);color:#59d6aa}.challenge-feedback.wrong{border:1px solid rgba(228,138,170,.28);background:rgba(228,138,170,.07);color:#e48aaa}.challenge-feedback small{color:var(--kazan-muted)}.challenge-note-wrap{margin-top:12px;padding:15px 17px;border:1px solid var(--kazan-line);border-radius:16px;background:rgba(255,255,255,.018)}.challenge-note-wrap label{display:flex;justify-content:space-between;margin-bottom:8px}.challenge-note-wrap label span{font:800 .61rem 'IBM Plex Mono',monospace;letter-spacing:.1em;color:var(--kazan-muted)}.challenge-note-wrap label small{font-size:.65rem;color:#737d8c}.challenge-note-wrap textarea{width:100%;resize:vertical;box-sizing:border-box;border:0;outline:0;background:transparent;color:var(--kazan-text);font:500 .78rem/1.5 inherit}.challenge-note-wrap textarea::placeholder{color:#657083}.challenge-nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-top:14px}.challenge-nav-btn,.challenge-submit-btn{min-height:44px;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}.challenge-nav-btn{justify-self:start;border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:var(--kazan-muted)}.challenge-nav-btn.primary{justify-self:end;border-color:var(--kazan-accent);background:var(--kazan-accent);color:#111}.challenge-nav-btn:disabled{opacity:.35;cursor:not-allowed}.challenge-dots{display:flex;gap:6px;justify-content:center}.challenge-dots button{width:8px;height:8px;border:0;border-radius:50%;padding:0;background:#3c4554;cursor:pointer}.challenge-dots button.current{width:22px;border-radius:99px;background:var(--kazan-accent)}.challenge-dots button.done{background:var(--kazan-accent-soft);box-shadow:inset 0 0 0 1px var(--kazan-accent)}.challenge-submit-btn{border:1px solid var(--kazan-accent);background:var(--kazan-accent);color:#111;box-shadow:0 10px 30px var(--kazan-accent-soft)}.challenge-sidebar{display:flex;flex-direction:column;gap:12px}.challenge-panel{border:1px solid var(--kazan-line);border-radius:20px;background:rgba(255,255,255,.025);padding:19px;box-shadow:inset 0 1px rgba(255,255,255,.035)}.challenge-panel-kicker{display:block;font:800 .61rem 'IBM Plex Mono',monospace;letter-spacing:.11em;color:var(--kazan-accent);margin-bottom:12px}.challenge-panel>strong{display:block;font-size:2.8rem;letter-spacing:-.06em}.challenge-panel>strong small{font-size:1rem;color:var(--kazan-muted);letter-spacing:0}.challenge-panel>span:last-of-type{display:block;color:var(--kazan-muted);font-size:.72rem;margin-bottom:17px}.challenge-stat-line{display:flex;justify-content:space-between;padding-top:10px;margin-top:10px;border-top:1px solid var(--kazan-line);font-size:.75rem}.challenge-stat-line span{color:var(--kazan-muted)}.challenge-map{position:sticky;top:16px}.challenge-panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.challenge-panel-title span{font:800 .61rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);letter-spacing:.1em}.challenge-panel-title b{font-size:.8rem}.challenge-map-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.challenge-map-grid button{height:36px;border:1px solid var(--kazan-line);border-radius:9px;background:rgba(255,255,255,.018);color:var(--kazan-muted);font:700 .68rem 'IBM Plex Mono',monospace;cursor:pointer}.challenge-map-grid button.current{border-color:var(--kazan-accent);background:var(--kazan-accent-soft);color:var(--kazan-text);box-shadow:0 0 0 1px var(--kazan-accent-soft)}.challenge-map-grid button.answered{color:var(--kazan-accent)}.challenge-map p{color:#737d8c;font-size:.68rem;line-height:1.5;margin:13px 0 0}.challenge-submit-overlay{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:20px;background:rgba(2,4,8,.65);backdrop-filter:blur(14px)}.challenge-submit-dialog{width:min(460px,100%);box-sizing:border-box;border:1px solid var(--kazan-line);border-radius:24px;background:var(--kazan-surface-solid);box-shadow:0 30px 100px rgba(0,0,0,.45);padding:28px}.challenge-dialog-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:1.25rem;margin-bottom:20px}.challenge-submit-dialog h2{margin:0 0 9px;font-size:1.5rem;letter-spacing:-.03em}.challenge-submit-dialog p{color:var(--kazan-muted);font-size:.8rem;line-height:1.6;margin:0}.challenge-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:23px}.challenge-result-badge{display:inline-flex;padding:9px 12px;border:1px solid var(--kazan-line);border-radius:999px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font:700 .66rem 'IBM Plex Mono',monospace}
@media(max-width:900px){.challenge-grid{grid-template-columns:1fr}.challenge-map{position:static}.challenge-sidebar{display:grid;grid-template-columns:1fr 1fr}.challenge-panel:first-child{display:none}.challenge-header{grid-template-columns:1fr auto}.challenge-brand{justify-self:center}.challenge-score{display:none}}
@media(max-width:620px){.challenge-view{padding:8px 0 45px}.challenge-shell{width:100%}.challenge-header{padding:10px 0 14px}.challenge-brand small{display:none}.challenge-card{padding:23px 18px;border-radius:20px;min-height:0}.challenge-question{font-size:1.38rem;margin:24px 0}.challenge-option{grid-template-columns:36px 1fr 18px;padding:12px}.challenge-option-letter{width:30px;height:30px}.challenge-nav{grid-template-columns:1fr auto}.challenge-dots{grid-column:1/-1;grid-row:1;margin-bottom:3px}.challenge-nav-btn,.challenge-submit-btn{grid-row:2}.challenge-nav-btn.primary{justify-self:end}.challenge-sidebar{display:block}.challenge-panel{margin-top:10px}.challenge-map{display:block}.challenge-map-grid{grid-template-columns:repeat(5,1fr)}.challenge-question-top{padding:0 2px}.challenge-dialog-actions{flex-direction:column-reverse}.challenge-dialog-actions button{width:100%}}

/* ─────────────────────────────────────────────────────────────────────────────
   KAZAN HOME OS: DAILY PLAN / CONTINUE / LIBRARY / MISTAKE BANK
   ───────────────────────────────────────────────────────────────────────────── */
.continue-card{width:100%;margin-top:18px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;padding:14px 15px;border:1px solid color-mix(in srgb,var(--accent) 34%,var(--kazan-line));border-radius:17px;background:rgba(255,255,255,.035);color:inherit;text-align:left;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.10);backdrop-filter:blur(14px);transition:transform .18s ease,border-color .18s ease,background .18s ease}.continue-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 60%,transparent);background:var(--kazan-accent-soft)}.continue-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:18px}.continue-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.continue-copy small{font:800 .55rem/1 'IBM Plex Mono',monospace;letter-spacing:.13em;color:var(--kazan-accent)}.continue-copy b{font-size:.88rem}.continue-copy>span{font-size:.68rem;color:var(--kazan-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.continue-card>strong{font:700 .65rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);white-space:nowrap}
.home-command-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,.8fr);gap:12px;margin:18px 0 12px}.daily-goal-card,.streak-card{min-width:0;border:1px solid var(--kazan-line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012));box-shadow:0 14px 40px rgba(0,0,0,.08),inset 0 1px rgba(255,255,255,.045);padding:18px}.daily-goal-main{display:flex;align-items:center;gap:13px}.goal-icon,.streak-flame{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:20px}.daily-goal-card h3,.streak-card h3{margin:3px 0 2px;font-size:1.55rem;letter-spacing:-.045em}.daily-goal-card h3 span{font-size:.85rem;color:var(--kazan-muted);font-weight:600}.daily-goal-card p{margin:0;color:var(--kazan-muted);font-size:.7rem}.goal-progress{height:7px;margin:18px 0 10px;border-radius:99px;background:rgba(127,141,165,.13);overflow:hidden}.goal-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--kazan-accent),rgba(255,255,255,.86));box-shadow:0 0 18px var(--kazan-accent-soft);transition:width .25s ease}.goal-footer{display:flex;justify-content:space-between;align-items:center;color:var(--kazan-muted);font:600 .6rem 'IBM Plex Mono',monospace}.goal-footer label{display:flex;align-items:center;gap:7px}.goal-footer input{width:58px;border:1px solid var(--kazan-line);border-radius:8px;background:rgba(255,255,255,.035);color:var(--kazan-text);padding:5px 7px;font:700 .62rem 'IBM Plex Mono',monospace}.streak-top{display:flex;justify-content:space-between;align-items:flex-start}.streak-top h3 small{font-size:.7rem;color:var(--kazan-muted);letter-spacing:0}.week-strip{height:62px;display:flex;align-items:flex-end;gap:7px;margin-top:13px}.week-strip>div{height:100%;flex:1;display:flex;align-items:flex-end;border-radius:6px 6px 3px 3px;background:rgba(127,141,165,.08);overflow:hidden}.week-strip>div span{display:block;width:100%;min-height:8px;border-radius:5px 5px 2px 2px;background:var(--kazan-accent);opacity:.82;transition:height .2s ease}.week-strip>div.active{background:var(--kazan-accent-soft)}.week-labels{display:flex;gap:7px;margin-top:7px}.week-labels span{flex:1;text-align:center;font:700 .53rem 'IBM Plex Mono',monospace;color:var(--kazan-muted)}
.home-library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 34px}.home-library-card{min-width:0;min-height:145px;padding:16px;text-align:left;color:inherit;border:1px solid var(--kazan-line);border-radius:18px;background:rgba(255,255,255,.025);cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.035);transition:transform .18s ease,border-color .18s ease,background .18s ease}.home-library-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 38%,transparent);background:var(--kazan-accent-soft)}.library-card-head{display:flex;align-items:center;gap:8px;margin-bottom:18px}.library-card-head strong{margin-left:auto;color:var(--kazan-accent);font-size:16px}.library-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:15px}.home-library-card>b{display:block;font-size:.9rem;margin-bottom:5px}.home-library-card>span{display:block;color:var(--kazan-muted);font-size:.68rem;line-height:1.45}.library-meter{height:4px;margin-top:14px;border-radius:99px;background:rgba(127,141,165,.12);overflow:hidden}.library-meter i{display:block;height:100%;border-radius:inherit;background:var(--kazan-accent)}.mistake-card .library-icon{color:#e48aaa;background:rgba(228,138,170,.09)}.mistake-dots{display:flex!important;gap:4px;margin-top:14px}.mistake-dots i{width:6px;height:6px;border-radius:50%;background:#e48aaa;box-shadow:0 0 10px rgba(228,138,170,.2)}
html[data-appearance="light"] .daily-goal-card,html[data-appearance="light"] .streak-card,html[data-appearance="light"] .home-library-card{background:rgba(255,255,255,.84)}
@media(max-width:760px){.home-command-row{grid-template-columns:1fr}.home-library-grid{grid-template-columns:1fr}.home-library-card{min-height:0}.continue-card{grid-template-columns:auto 1fr}.continue-card>strong{grid-column:2}.week-strip{height:52px}}
@media(max-width:480px){.continue-card{padding:12px}.goal-footer{gap:8px}.daily-goal-card,.streak-card{padding:15px}.home-library-grid{gap:8px}}

/* ─────────────────────────────────────────────────────────────────────────────
   KAZAN STUDY OS V3 - HOME
   This layer is intentionally namespaced so it cannot disturb the existing quiz,
   auth, Supabase, Razorpay, exam, or dashboard implementation.
   ───────────────────────────────────────────────────────────────────────────── */
.home-medical{padding-bottom:42px}.med-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(270px,.75fr);gap:34px;align-items:stretch;padding:34px 36px;border:1px solid var(--kazan-line);border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:0 18px 55px rgba(0,0,0,.12);overflow:hidden}.med-hero-main{display:flex;flex-direction:column;justify-content:center;min-width:0}.med-kicker{display:flex;align-items:center;gap:9px;color:var(--kazan-muted);font:700 .58rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase}.med-kicker i{width:4px;height:4px;border-radius:50%;background:var(--kazan-accent)}.med-hero h2{margin:15px 0 13px;max-width:780px;font-size:clamp(2.4rem,5.2vw,4.45rem);line-height:1.02;letter-spacing:-.055em}.med-hero h2 em{font-style:normal;color:var(--kazan-accent)}.med-hero p{max-width:660px;margin:0;color:var(--kazan-muted);font-size:.9rem;line-height:1.7}.med-hero-actions{display:flex;gap:10px;align-items:center;margin-top:23px;flex-wrap:wrap}.med-primary,.med-secondary{min-height:44px;padding:11px 16px;border-radius:10px;font-weight:700;cursor:pointer;white-space:nowrap;transition:.18s ease}.med-primary{border:1px solid var(--kazan-accent);background:var(--kazan-accent);color:var(--kazan-bg);box-shadow:0 8px 22px var(--kazan-accent-soft)}.med-primary:hover{transform:translateY(-1px);filter:brightness(1.05)}.med-secondary{border:1px solid var(--kazan-line);background:rgba(255,255,255,.025);color:inherit}.med-secondary:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--kazan-line));background:var(--kazan-accent-soft)}.med-proof-row{display:flex;gap:18px;margin-top:24px;padding-top:15px;border-top:1px solid var(--kazan-line);color:var(--kazan-muted);font:600 .58rem 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;flex-wrap:wrap}.med-proof-row span{display:flex;gap:5px;align-items:baseline}.med-proof-row b{font-size:.78rem;color:var(--kazan-text)}
.med-exam-sheet{align-self:stretch;min-height:260px;padding:23px;background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.018));border:1px solid var(--kazan-line);border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.13);transform:rotate(1.2deg);display:flex;flex-direction:column;justify-content:space-between}.sheet-top,.sheet-bottom{display:flex;justify-content:space-between;align-items:center;font:700 .58rem 'IBM Plex Mono',monospace;letter-spacing:.09em;color:var(--kazan-muted)}.sheet-top b{color:var(--kazan-accent);font-size:.72rem}.sheet-rule{height:1px;background:var(--kazan-line);margin:15px 0}.sheet-title{font:800 .62rem 'IBM Plex Mono',monospace;letter-spacing:.14em;color:var(--kazan-accent)}.sheet-question{margin:20px 0;display:grid;grid-template-columns:32px 1fr;column-gap:10px;align-items:center}.sheet-question span{width:30px;height:30px;border:1px solid var(--kazan-line);border-radius:8px;display:grid;place-items:center;font:700 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-muted)}.sheet-question b{font-size:1rem}.sheet-question small{grid-column:2;color:var(--kazan-muted);font-size:.67rem;margin-top:3px}.sheet-lines{display:flex;flex-direction:column;gap:9px;margin:4px 0 16px}.sheet-lines i{height:5px;border-radius:3px;background:var(--kazan-line)}.sheet-lines i:nth-child(1){width:88%}.sheet-lines i:nth-child(2){width:70%}.sheet-lines i:nth-child(3){width:79%}.sheet-bottom{padding-top:12px;border-top:1px solid var(--kazan-line)}
.med-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;margin:30px 0 12px}.med-section-head h3{margin:4px 0 0;font-size:1.42rem;letter-spacing:-.035em}.med-label{font:800 .55rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);letter-spacing:.13em}.med-muted,.med-status{font:700 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);white-space:nowrap}.med-status i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--kazan-accent)}.med-day-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:12px}.med-target-card,.med-streak-card{padding:20px;border:1px solid var(--kazan-line);border-radius:18px;background:rgba(255,255,255,.018)}.med-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.med-card-head h4{margin:8px 0 0;font-size:2rem;letter-spacing:-.06em}.med-card-head h4 small{font-size:.68rem;font-weight:500;color:var(--kazan-muted);letter-spacing:0}.med-number-badge{padding:6px 8px;border-radius:7px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font:800 .58rem 'IBM Plex Mono',monospace}.med-progress{height:7px;margin:17px 0 11px;background:rgba(127,141,165,.11);border-radius:99px;overflow:hidden}.med-progress span{display:block;height:100%;border-radius:inherit;background:var(--kazan-accent);transition:width .25s ease}.med-target-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--kazan-muted);font-size:.64rem}.med-target-foot label{display:flex;align-items:center;gap:6px;font:700 .55rem 'IBM Plex Mono',monospace}.med-target-foot input{width:58px;padding:5px 7px;border:1px solid var(--kazan-line);border-radius:7px;background:rgba(255,255,255,.025);color:inherit;font:700 .62rem 'IBM Plex Mono',monospace}.med-streak-note{font:700 .5rem 'IBM Plex Mono',monospace;color:var(--kazan-muted);letter-spacing:.08em}.med-bars{height:48px;display:flex;align-items:flex-end;gap:6px;margin-top:17px}.med-bars>div{height:100%;flex:1;background:rgba(127,141,165,.07);border-radius:4px;display:flex;align-items:flex-end;overflow:hidden}.med-bars>div span{display:block;width:100%;min-height:3px;background:var(--kazan-accent);opacity:.8}.med-bars>div.worked{background:var(--kazan-accent-soft)}.med-days{display:flex;gap:6px;margin-top:5px}.med-days span{flex:1;text-align:center;color:var(--kazan-muted);font:700 .5rem 'IBM Plex Mono',monospace}
.med-continue{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;margin-top:12px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--kazan-line));border-radius:14px;background:var(--kazan-accent-soft);color:inherit;text-align:left;cursor:pointer;transition:.18s ease}.med-continue:hover{border-color:var(--kazan-accent);transform:translateY(-1px)}.med-continue-icon{width:37px;height:37px;display:grid;place-items:center;border-radius:10px;background:var(--kazan-accent);color:var(--kazan-bg);font-weight:900}.med-continue>span:nth-child(2){display:flex;flex-direction:column;gap:3px;min-width:0}.med-continue small{font:800 .5rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);letter-spacing:.12em}.med-continue b{font-size:.84rem}.med-continue em{font-style:normal;color:var(--kazan-muted);font-size:.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.med-continue strong{font:700 .6rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);white-space:nowrap}
.med-tools-head{margin-top:30px}.med-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.med-tools>button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:15px;border:1px solid var(--kazan-line);border-radius:14px;background:rgba(255,255,255,.018);color:inherit;text-align:left;cursor:pointer;transition:.18s ease}.med-tools>button:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--kazan-line));background:var(--kazan-accent-soft);transform:translateY(-1px)}.med-tool-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--kazan-line);border-radius:10px;color:var(--kazan-accent);background:var(--kazan-accent-soft)}.med-tools>button span:nth-child(2){display:flex;flex-direction:column;gap:3px;min-width:0}.med-tools small{font:800 .48rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);letter-spacing:.09em}.med-tools b{font-size:.8rem}.med-tools em{font-style:normal;color:var(--kazan-muted);font-size:.59rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.med-tools strong{color:var(--kazan-accent)}
.med-library-head{margin-top:32px}.med-library{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.med-library>button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;padding:14px;border:1px solid var(--kazan-line);border-radius:14px;background:rgba(255,255,255,.014);color:inherit;text-align:left;cursor:pointer;transition:.18s ease}.med-library>button:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--kazan-line));background:var(--kazan-accent-soft)}.med-library-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-size:16px}.med-library>button:nth-child(2) .med-library-icon{background:rgba(228,138,170,.1);color:#e48aaa}.med-library>button span:nth-child(2){display:flex;flex-direction:column;gap:3px;min-width:0}.med-library b{font-size:.75rem}.med-library em{font-style:normal;color:var(--kazan-muted);font-size:.58rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.med-library strong{font-size:.9rem;color:var(--kazan-accent)}
.med-subject-head{margin-top:34px}.med-subject-grid .card{min-width:0}.med-footer{display:flex;align-items:center;gap:12px;margin-top:28px;padding:14px 16px;border-top:1px solid var(--kazan-line);color:var(--kazan-muted)}.med-footer>span{font:800 .5rem 'IBM Plex Mono',monospace;color:var(--kazan-accent);letter-spacing:.1em}.med-footer b{font-size:.67rem;font-weight:600}.med-footer button{margin-left:auto;border:0;background:transparent;color:var(--kazan-accent);font:700 .58rem 'IBM Plex Mono',monospace;cursor:pointer;white-space:nowrap}
html[data-appearance="light"] .os-hero,html[data-appearance="light"] .os-target-card,html[data-appearance="light"] .os-streak-card,html[data-appearance="light"] .os-tool,html[data-appearance="light"] .os-library-item{background:rgba(255,255,255,.82)}html[data-appearance="light"] .os-orbit-core{background:rgba(255,255,255,.7)}
@media(max-width:900px){.os-hero{grid-template-columns:1fr;padding:30px;min-height:0}.os-hero-orbit{display:none}.os-hero-metrics{position:static;grid-column:1/-1;margin-top:24px;padding-top:14px}.os-day-grid{grid-template-columns:1fr}.os-tools-grid{grid-template-columns:1fr}.os-library-grid{grid-template-columns:1fr}}
@media(max-width:620px){.home-os-v3{padding-bottom:25px}.os-hero{padding:23px 18px;border-radius:22px}.os-hero-copy h2{font-size:clamp(2.55rem,14vw,4rem)}.os-hero-copy p{font-size:.78rem}.os-hero-actions{flex-direction:column}.os-hero-actions button{width:100%}.os-hero-metrics{grid-template-columns:repeat(2,1fr);row-gap:12px}.os-section-head{align-items:flex-start;flex-direction:column;gap:5px}.os-section-head h3{font-size:1.25rem}.os-target-card,.os-streak-card{padding:16px;border-radius:18px}.os-target-foot{align-items:flex-start;flex-direction:column}.os-continue{grid-template-columns:auto 1fr;padding:13px}.os-continue>strong{grid-column:2}.os-tool{grid-template-columns:auto minmax(0,1fr);padding:14px}.os-tool>strong{grid-column:2}.os-library-item{padding:13px}.os-footer-strip{align-items:flex-start;flex-wrap:wrap}.os-footer-strip button{width:100%;margin-left:0;text-align:left;padding-left:45px}.os-subject-grid{grid-template-columns:1fr!important}}

/* Clinical visual language: anatomy department, not AI dashboard */
.med-hero{
  position:relative;
  background:
    linear-gradient(90deg,rgba(255,255,255,.028),rgba(255,255,255,.012)),
    radial-gradient(circle at 82% 20%,var(--kazan-accent-soft),transparent 34%);
  border-color:color-mix(in srgb,var(--kazan-line) 86%,var(--kazan-accent) 14%);
}
.med-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.34;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:34px 34px;mask-image:linear-gradient(90deg,black,transparent 72%);
}
.med-hero-main,.med-record-card{position:relative;z-index:1}
.med-kicker{color:var(--kazan-accent)}
.med-kicker i{width:18px;height:1px;border-radius:0;background:var(--kazan-accent)}
.med-hero h2{font-weight:760;letter-spacing:-.045em}
.med-hero h2 em{color:var(--kazan-text);background:linear-gradient(90deg,var(--kazan-accent),color-mix(in srgb,var(--kazan-accent) 42%,var(--kazan-text)));background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.med-hero p{max-width:700px}
.med-primary{border-radius:11px;box-shadow:0 7px 20px var(--kazan-accent-soft)}
.med-secondary{border-radius:11px}

.med-record-card{position:relative;overflow:hidden;min-height:260px;padding:22px 22px 17px;border:1px solid var(--kazan-line);border-radius:14px;background:linear-gradient(145deg,rgba(250,252,255,.065),rgba(255,255,255,.018));box-shadow:0 18px 45px rgba(0,0,0,.16);transform:rotate(.35deg)}
.med-record-card::after{content:"ANATOMY";position:absolute;right:-25px;bottom:30px;font:900 4.8rem/1 Arial,sans-serif;letter-spacing:.12em;color:rgba(255,255,255,.025);transform:rotate(-90deg);pointer-events:none}
.record-cross{position:absolute;right:22px;top:19px;width:34px;height:34px;border:1px solid var(--kazan-line);border-radius:9px;display:grid;place-items:center;background:var(--kazan-accent-soft)}
.record-cross span{position:absolute;display:block;background:var(--kazan-accent);border-radius:2px}.record-cross span:first-child{width:15px;height:4px}.record-cross span:last-child{width:4px;height:15px}
.record-head{display:flex;align-items:flex-start;justify-content:space-between;padding-right:48px}.record-head div{display:flex;flex-direction:column;gap:5px}.record-head span,.record-title,.record-grid span{font:800 .48rem 'IBM Plex Mono',monospace;letter-spacing:.13em;color:var(--kazan-muted)}.record-head b{font-size:.83rem;letter-spacing:.03em}.record-head strong{font:800 .68rem 'IBM Plex Mono',monospace;color:var(--kazan-accent)}
.record-rule{height:1px;background:var(--kazan-line);margin:16px 0 14px}.record-title{color:var(--kazan-accent)}
.record-main{display:grid;grid-template-columns:34px 1fr;gap:11px;align-items:center;margin:18px 0}.record-number{width:32px;height:32px;border:1px solid var(--kazan-line);border-radius:8px;display:grid;place-items:center;font:800 .58rem 'IBM Plex Mono',monospace;color:var(--kazan-muted)}.record-main div:last-child{display:flex;flex-direction:column;gap:4px}.record-main b{font-size:1rem;letter-spacing:.02em}.record-main span{font-size:.63rem;line-height:1.45;color:var(--kazan-muted);max-width:220px}
.record-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:4px}.record-grid>div{padding:8px 9px;border:1px solid var(--kazan-line);border-radius:8px;background:rgba(255,255,255,.018);display:flex;justify-content:space-between;gap:6px}.record-grid b{font:700 .48rem 'IBM Plex Mono',monospace;color:var(--kazan-text)}
.record-footer{position:relative;z-index:2;display:flex;justify-content:space-between;gap:8px;margin-top:13px;padding-top:10px;border-top:1px solid var(--kazan-line);font:600 .48rem 'IBM Plex Mono',monospace;color:var(--kazan-muted)}.record-status{color:var(--kazan-accent)}.record-status i{display:inline-block;width:5px;height:5px;margin-right:5px;border-radius:50%;background:currentColor}
.med-section-head{margin-top:34px}.med-label{color:var(--kazan-accent)}
.med-target-card,.med-streak-card,.med-tools>button,.med-library>button{background:rgba(255,255,255,.014);box-shadow:0 8px 25px rgba(0,0,0,.06)}
.med-target-card,.med-streak-card{border-radius:14px}
.med-tools>button,.med-library>button{border-radius:12px}
.med-subject-head{border-bottom:1px solid var(--kazan-line);padding-bottom:11px}
.med-footer{font-style:normal}
html[data-appearance="light"] .med-hero{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(246,248,251,.94))}
html[data-appearance="light"] .med-record-card{background:rgba(255,255,255,.9)}
html[data-appearance="light"] .med-record-card::after{color:rgba(25,35,50,.035)}
@media(max-width:900px){.med-hero{grid-template-columns:1fr}.med-record-card{max-width:520px;width:100%;margin:0 auto;transform:none}}
@media(max-width:620px){.med-hero{padding:22px 18px}.med-record-card{min-height:0;padding:18px}.record-grid>div{flex-direction:column;gap:3px}.record-footer{flex-direction:column}.record-footer span:last-child{display:none}.med-hero h2{font-size:clamp(2.2rem,11vw,3.4rem)}}

/* Mobile / tablet clinical layout refinement
   Designed for portrait tablets and phones first. */
@media (max-width: 900px) {
  .wrap {
    width: min(100%, 920px);
  }

  .home-medical {
    width: 100%;
  }

  .med-hero {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 28px;
  }

  .med-record-card {
    max-width: none;
    width: 100%;
    transform: none;
  }

  .med-day-grid {
    grid-template-columns: 1fr;
  }

  .med-tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .med-tools > button:last-child {
    grid-column: 1 / -1;
  }

  .med-library {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .med-library > button:last-child {
    grid-column: 1 / -1;
  }

  .med-subject-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .med-subject-grid .card {
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .top {
    min-height: 68px;
    gap: 12px;
  }

  .brand-mark {
    width: 42px;
    height: 42px;
  }

  .brand-text h1 {
    font-size: 1rem;
  }

  .brand-text .tag {
    font-size: .48rem;
  }

  .top-right {
    gap: 7px;
  }

  .top-stat {
    display: none;
  }

  .search-launch {
    min-width: 42px;
    width: 42px;
    padding: 0;
    justify-content: center;
  }

  .search-launch .search-label,
  .search-launch kbd {
    display: none;
  }

  .account-button {
    padding-inline: 12px;
  }

  .med-hero {
    padding: 24px 20px;
    border-radius: 18px;
  }

  .med-kicker {
    flex-wrap: wrap;
    line-height: 1.5;
  }

  .med-hero h2 {
    font-size: clamp(2.25rem, 8vw, 3.6rem);
    line-height: 1.03;
  }

  .med-hero p {
    font-size: .82rem;
    line-height: 1.6;
  }

  .med-hero-actions {
    align-items: stretch;
  }

  .med-primary,
  .med-secondary {
    width: 100%;
    justify-content: center;
  }

  .med-proof-row {
    gap: 10px 16px;
  }

  .med-section-head {
    margin-top: 27px;
  }

  .med-section-head h3 {
    font-size: 1.3rem;
  }

  .med-day-grid {
    gap: 10px;
  }

  .med-target-card,
  .med-streak-card {
    padding: 18px;
  }

  .med-target-foot {
    align-items: center;
  }

  .med-target-foot > span {
    min-width: 0;
  }

  .med-tools > button,
  .med-library > button {
    min-width: 0;
  }

  .med-tools b,
  .med-library b {
    overflow-wrap: anywhere;
  }

  .med-subject-grid .card {
    padding: 16px;
  }

  .med-subject-grid .cname,
  .med-subject-grid .ccount,
  .med-subject-grid .cstart {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 520px) {
  .top {
    align-items: center;
  }

  .brand-button {
    min-width: 0;
  }

  .brand-text h1 {
    font-size: .94rem;
  }

  .brand-text .tag {
    display: none;
  }

  .account-button {
    font-size: .58rem;
    min-height: 40px;
    padding: 0 11px;
  }

  .med-hero {
    padding: 20px 16px;
  }

  .med-hero h2 {
    font-size: clamp(2.05rem, 11.5vw, 3rem);
  }

  .med-hero p {
    font-size: .78rem;
  }

  .med-proof-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 9px;
  }

  .med-record-card {
    padding: 17px;
  }

  .record-head {
    padding-right: 42px;
  }

  .record-grid {
    grid-template-columns: 1fr;
  }

  .record-grid > div {
    flex-direction: row;
    align-items: center;
  }

  .record-footer {
    flex-direction: row;
    align-items: center;
  }

  .record-footer > span:last-child {
    display: none;
  }

  .med-card-head {
    gap: 8px;
  }

  .med-card-head h4 {
    font-size: 2rem;
  }

  .med-target-foot {
    align-items: stretch;
    flex-direction: column;
  }

  .med-target-foot label {
    width: 100%;
    justify-content: space-between;
  }

  .med-target-foot input {
    width: 78px;
  }

  .med-tools,
  .med-library,
  .med-subject-grid {
    grid-template-columns: 1fr !important;
  }

  .med-tools > button:last-child,
  .med-library > button:last-child {
    grid-column: auto;
  }

  .med-tools > button {
    min-height: 76px;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .med-library > button {
    min-height: 62px;
  }

  .med-subject-grid .card {
    min-height: 150px;
  }

  .med-footer {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .med-footer button {
    width: 100%;
    margin-left: 0;
    padding: 7px 0 0;
    text-align: left;
  }
}


/* Mobile subject cards + opening notice refinement */
.med-subject-grid .card {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  text-align: left !important;
  min-height: 185px !important;
  padding: 20px !important;
  gap: 0 !important;
  position: relative;
}
.med-subject-grid .card-top {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
}
.med-subject-grid .card-icon {
  flex: 0 0 auto;
}
.med-subject-grid .cname {
  display: block !important;
  width: 100%;
  margin-top: auto !important;
  padding-top: 26px;
  font-size: 1.35rem !important;
  font-weight: 800 !important;
  line-height: 1.14 !important;
  letter-spacing: -.035em !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  white-space: normal !important;
}
.med-subject-grid .ccount {
  width: 100%;
  margin-top: 7px;
  line-height: 1.3 !important;
  color: var(--kazan-muted);
}
.med-subject-grid .cstart {
  width: 100%;
  margin-top: 9px;
  line-height: 1.25 !important;
  white-space: normal !important;
}
@media (max-width: 760px) {
  .med-subject-grid .card {
    min-height: 172px !important;
    padding: 18px !important;
  }
  .med-subject-grid .cname {
    font-size: clamp(1.15rem, 5.4vw, 1.55rem) !important;
    padding-top: 20px;
  }
}
@media (max-width: 520px) {
  .med-subject-grid .card {
    min-height: 160px !important;
    padding: 17px !important;
  }
  .med-subject-grid .cname {
    font-size: 1.22rem !important;
    padding-top: 18px;
  }
  .med-subject-grid .ccount { font-size: .68rem !important; }
  .med-subject-grid .cstart { font-size: .62rem !important; }
}

/* Support desk + bulletproof subject-card typography */
.med-subject-grid .card {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  overflow: hidden !important;
}
.med-subject-grid .cname {
  flex: 0 0 auto !important;
  margin: 0 !important;
  padding: 30px 0 0 !important;
  max-width: 100% !important;
  line-height: 1.12 !important;
}
.subject-card-meta {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 5px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin-top: 10px !important;
  padding: 0 !important;
}
.med-subject-grid .ccount,
.med-subject-grid .cstart {
  position: static !important;
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: visible !important;
  line-height: 1.3 !important;
}
.med-subject-grid .ccount { order: 1; }
.med-subject-grid .cstart { order: 2; }
.med-subject-grid .cstart span { display: inline-block; margin-left: 4px; }

.support-section {
  margin-top: 42px;
  padding: 24px;
  border: 1px solid var(--kazan-line);
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255,255,255,.038), rgba(255,255,255,.012));
  box-shadow: 0 18px 50px rgba(0,0,0,.10), inset 0 1px rgba(255,255,255,.035);
}
.support-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:22px; }
.support-heading h3 { margin:5px 0 7px; font-size:1.55rem; letter-spacing:-.04em; }
.support-heading p { margin:0; max-width:650px; color:var(--kazan-muted); font-size:.68rem; line-height:1.6; }
.support-email-badge { flex:0 0 auto; display:flex; flex-direction:column; gap:5px; padding:11px 13px; border:1px solid var(--kazan-line); border-radius:13px; background:var(--kazan-accent-soft); }
.support-email-badge span { font:800 .48rem 'IBM Plex Mono',monospace; color:var(--kazan-accent); letter-spacing:.12em; }
.support-email-badge b { font-size:.68rem; white-space:nowrap; }
.support-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; margin-top:19px; }
.support-card { min-width:0; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:13px; border:1px solid var(--kazan-line); border-radius:15px; background:rgba(255,255,255,.018); color:inherit; text-align:left; text-decoration:none; cursor:pointer; transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
.support-card:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--kazan-accent) 42%,var(--kazan-line)); background:var(--kazan-accent-soft); box-shadow:0 12px 30px rgba(0,0,0,.10); }
.support-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; background:var(--kazan-accent-soft); color:var(--kazan-accent); font:800 .9rem 'IBM Plex Mono',monospace; }
.support-card > span:nth-child(2) { min-width:0; display:flex; flex-direction:column; gap:3px; }
.support-card b { font-size:.68rem; line-height:1.25; }
.support-card small { color:var(--kazan-muted); font-size:.55rem; line-height:1.35; }
.support-card > strong { color:var(--kazan-accent); font-size:.75rem; }
.support-trust { display:flex; align-items:center; gap:8px; margin-top:17px; padding-top:13px; border-top:1px solid var(--kazan-line); color:var(--kazan-muted); font:600 .52rem 'IBM Plex Mono',monospace; letter-spacing:.035em; }
.support-trust > span:first-child { color:var(--kazan-accent); font-size:.8rem; }
.support-trust b { color:var(--kazan-text); }
.support-trust i { width:4px; height:4px; border-radius:50%; background:var(--kazan-line); }
@media(max-width:900px){.support-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.support-heading{flex-direction:column}.support-email-badge{width:100%;box-sizing:border-box}}
@media(max-width:520px){.support-section{padding:17px;border-radius:18px;margin-top:30px}.support-heading h3{font-size:1.3rem}.support-heading p{font-size:.62rem}.support-grid{grid-template-columns:1fr;gap:8px}.support-card{padding:12px}.support-trust{flex-wrap:wrap;line-height:1.5}.support-trust i{display:none}.med-subject-grid .cname{padding-top:22px !important;font-size:1.18rem !important}.subject-card-meta{margin-top:8px !important}}


.support-overlay{position:fixed;inset:0;z-index:2500;display:grid;place-items:center;padding:18px;background:rgba(3,5,9,.68);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.support-modal{width:min(560px,100%);max-height:min(88vh,720px);overflow:auto;position:relative;box-sizing:border-box;padding:27px;border:1px solid var(--kazan-line);border-radius:24px;background:linear-gradient(145deg,rgba(24,29,38,.99),rgba(12,16,22,.99));box-shadow:0 32px 110px rgba(0,0,0,.48),0 0 0 1px var(--kazan-accent-soft)}
html[data-appearance="light"] .support-modal{background:rgba(250,251,253,.99);box-shadow:0 30px 90px rgba(20,30,45,.22)}
.support-modal-close{position:absolute;right:15px;top:15px;width:36px;height:36px;border:1px solid var(--kazan-line);border-radius:50%;background:rgba(255,255,255,.03);color:var(--kazan-muted);font-size:21px;cursor:pointer}.support-modal-close:hover{border-color:var(--kazan-accent);color:var(--kazan-text)}
.support-modal-mark{width:45px;height:45px;display:grid;place-items:center;margin-bottom:18px;border-radius:13px;background:var(--kazan-accent-soft);color:var(--kazan-accent);font-weight:900;font-size:21px}
.support-modal h2{margin:7px 0 8px;font-size:1.8rem;letter-spacing:-.045em}.support-modal>p{margin:0 0 20px;color:var(--kazan-muted);font-size:.72rem;line-height:1.6;max-width:470px}
.support-field-label{display:block;margin:16px 0 8px;color:var(--kazan-muted);font:800 .5rem 'IBM Plex Mono',monospace;letter-spacing:.11em}.support-options{display:grid;grid-template-columns:1fr 1fr;gap:7px}.support-options button{min-width:0;display:flex;justify-content:space-between;gap:8px;padding:10px 11px;border:1px solid var(--kazan-line);border-radius:10px;background:rgba(255,255,255,.025);color:inherit;text-align:left;font-size:.63rem;cursor:pointer}.support-options button span{color:var(--kazan-muted)}.support-options button:hover,.support-options button.selected{border-color:var(--kazan-accent);background:var(--kazan-accent-soft);color:var(--kazan-text)}
.support-modal textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:105px;padding:11px 12px;border:1px solid var(--kazan-line);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;outline:0;font:inherit;font-size:.7rem;line-height:1.5}.support-modal textarea:focus{border-color:var(--kazan-accent);box-shadow:0 0 0 3px var(--kazan-accent-soft)}.support-modal textarea::placeholder{color:#707989}
.support-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid var(--kazan-line);color:var(--kazan-muted);font-size:.58rem;line-height:1.45}.support-modal-foot b{color:var(--kazan-text)}.support-send{min-height:42px;padding:0 15px;border:1px solid var(--kazan-accent);border-radius:11px;background:var(--kazan-accent);color:#0b0e13;font-weight:800;cursor:pointer}.support-send:hover{filter:brightness(1.05);transform:translateY(-1px)}
@media(max-width:520px){.support-overlay{padding:10px}.support-modal{padding:22px 17px 17px;border-radius:20px}.support-modal h2{font-size:1.55rem}.support-options{grid-template-columns:1fr}.support-modal-foot{align-items:stretch;flex-direction:column}.support-send{width:100%}}
/* Opening announcement */
.welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 8, 12, .68);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: welcome-fade .22s ease both;
}
.welcome-card {
  width: min(520px, 100%);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--kazan-line);
  border-radius: 24px;
  padding: 30px;
  background: linear-gradient(145deg, rgba(24,29,38,.98), rgba(13,17,23,.98));
  box-shadow: 0 28px 90px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.025);
}
html[data-appearance="light"] .welcome-card {
  background: rgba(250,251,253,.98);
  box-shadow: 0 28px 80px rgba(20,30,45,.2);
}
.welcome-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 28px;
  right: 28px;
  height: 2px;
  background: var(--kazan-accent);
  opacity: .8;
}
.welcome-close {
  position: absolute;
  top: 15px;
  right: 16px;
  width: 38px;
  height: 38px;
  border: 1px solid var(--kazan-line);
  border-radius: 50%;
  background: rgba(255,255,255,.035);
  color: var(--kazan-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.welcome-close:hover { color: var(--kazan-text); border-color: var(--kazan-accent); }
.welcome-mark {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  border: 1px solid var(--kazan-line);
  border-radius: 14px;
  background: var(--kazan-accent-soft);
  color: var(--kazan-accent);
  font-size: 25px;
  font-weight: 900;
  margin-bottom: 24px;
}
.welcome-kicker {
  color: var(--kazan-accent);
  font: 800 .57rem 'IBM Plex Mono', monospace;
  letter-spacing: .14em;
  margin-bottom: 9px;
}
.welcome-card h2 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 3rem);
  line-height: .98;
  letter-spacing: -.055em;
}
.welcome-card h2 span { color: var(--kazan-accent); }
.welcome-copy {
  margin: 16px 0 22px;
  color: var(--kazan-muted);
  font-size: .88rem;
  line-height: 1.65;
  max-width: 430px;
}
.welcome-device {
  display: grid;
  grid-template-columns: 46px minmax(0,1fr);
  gap: 13px;
  align-items: center;
  padding: 14px;
  border: 1px solid var(--kazan-line);
  border-radius: 15px;
  background: rgba(255,255,255,.025);
  margin-bottom: 22px;
}
.welcome-device-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid var(--kazan-line);
  color: var(--kazan-accent);
  background: var(--kazan-accent-soft);
  font-size: 21px;
}
.welcome-device strong { display: block; font-size: .83rem; }
.welcome-device small { display: block; margin-top: 3px; color: var(--kazan-muted); font-size: .66rem; line-height: 1.45; }
.welcome-enter {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 12px;
  background: var(--kazan-accent);
  color: #0a0d12;
  font-weight: 800;
  cursor: pointer;
  transition: transform .18s ease, filter .18s ease;
}
.welcome-enter:hover { transform: translateY(-1px); filter: brightness(1.04); }
.welcome-foot {
  margin-top: 12px;
  text-align: center;
  color: var(--kazan-muted);
  font: 600 .53rem 'IBM Plex Mono', monospace;
  letter-spacing: .06em;
}
@keyframes welcome-fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 520px) {
  .welcome-overlay { padding: 14px; }
  .welcome-card { padding: 25px 20px 20px; border-radius: 20px; }
  .welcome-card h2 { font-size: 2.15rem; }
  .welcome-copy { font-size: .8rem; }
}

/* v11: definitive mobile subject layout + visible support desk */
.medical-subject-card {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  box-sizing: border-box !important;
  min-width: 0 !important;
  min-height: 235px !important;
  height: auto !important;
  padding: 22px !important;
  overflow: hidden !important;
}
.medical-subject-top {
  flex: 0 0 auto !important;
  width: 100% !important;
  min-width: 0 !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 14px !important;
}
.medical-subject-body {
  position: static !important;
  width: 100% !important;
  min-width: 0 !important;
  margin-top: auto !important;
  padding-top: 42px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
}
.medical-subject-card .cname {
  position: static !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
  font-size: clamp(1.35rem, 2vw, 1.75rem) !important;
  line-height: 1.08 !important;
  letter-spacing: -.045em !important;
}
.medical-subject-card .subject-card-meta {
  position: static !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 12px 0 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 6px !important;
}
.medical-subject-card .ccount,
.medical-subject-card .cstart {
  position: static !important;
  inset: auto !important;
  transform: none !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: visible !important;
  line-height: 1.3 !important;
}
.medical-subject-card .cstart {
  color: var(--accent) !important;
  font-weight: 800 !important;
}
.support-nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 42px;
  padding: 0 15px;
  border: 1px solid var(--kazan-line);
  border-radius: 13px;
  background: var(--kazan-accent-soft);
  color: var(--kazan-accent);
  font-weight: 800;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease;
}
.support-nav-button:hover { transform: translateY(-1px); border-color: var(--kazan-accent); }
.support-nav-button span:first-child { width: 18px; height: 18px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; font-size: .65rem; }
.support-desk { position: relative; overflow: hidden; }
.support-desk::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--kazan-accent); opacity: .8; }
.support-desk .support-card { min-height: 70px; }
@media (max-width: 760px) {
  .medical-subject-card { min-height: 205px !important; padding: 19px !important; }
  .medical-subject-body { padding-top: 32px !important; }
  .medical-subject-card .cname { font-size: clamp(1.25rem, 5.8vw, 1.55rem) !important; }
  .support-nav-button { display: none; }
}
@media (max-width: 520px) {
  .medical-subject-card { min-height: 185px !important; padding: 17px !important; border-radius: 18px !important; }
  .medical-subject-body { padding-top: 27px !important; }
  .medical-subject-card .cname { font-size: 1.28rem !important; line-height: 1.1 !important; }
  .medical-subject-card .ccount { font-size: .72rem !important; }
  .medical-subject-card .cstart { font-size: .68rem !important; }
  .support-desk { margin-top: 32px !important; padding: 18px !important; }
  .support-desk .support-grid { grid-template-columns: 1fr !important; }
}
`}
</style>
      <div className="watermark" aria-hidden="true"><span>✣</span>KAZAN MBBS</div>

      <main className="wrap">
        <header className="top">
          <button className="brand-button" onClick={home} aria-label="Kazan MBBS home">
            <div className="brand-mark">✚</div>
            <div className="brand-text">
              <h1>Kazan MBBS</h1>
              <div className="tag">Anatomy Question Bank</div>
            </div>
          </button>

          <div className="top-right">
            <div className="top-stat">
              <div><b>{totalQuestions}</b> questions</div>
              <div><b>{totalSubjects}</b> subjects</div>
            </div>

            <div className="theme-wrap">
              <button className="theme-button" onClick={() => setThemeOpen((v) => !v)}>
                <span className="theme-dot" style={{ background: THEME_OPTIONS.find((x) => x.id === theme)?.color }} />
                Theme
              </button>
              {themeOpen && (
                <div className="theme-menu" role="dialog" aria-label="Appearance and accent settings">
                  <div className="theme-panel-header">
                    <div>
                      <span className="theme-panel-kicker">INTERFACE</span>
                      <strong>Appearance</strong>
                    </div>
                    <button className="theme-panel-close" onClick={() => setThemeOpen(false)} aria-label="Close appearance settings">×</button>
                  </div>

                  <div className="theme-menu-title">Mode</div>
                  <div className="appearance-grid">
                    {([
                      { id: 'dark' as const, name: 'Dark mode', icon: '☾' },
                      { id: 'light' as const, name: 'Light mode', icon: '☀' },
                    ]).map((option) => (
                      <button
                        key={option.id}
                        className={`appearance-choice ${appearance === option.id ? 'active' : ''}`}
                        onClick={() => setAppearance(option.id)}
                      >
                        <span className="appearance-icon">{option.icon}</span>
                        <span>{option.name}</span>
                        {appearance === option.id && <span className="theme-check">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="theme-menu-title accent-title">Accent colour</div>
                  <div className="accent-grid">
                    {THEME_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        className={`theme-choice ${theme === option.id ? 'active' : ''}`}
                        onClick={() => setTheme(option.id)}
                        aria-label={`${option.name} accent`}
                        title={option.name}
                      >
                        <span className="theme-swatch" style={{ background: option.color }} />
                        <span>{option.name}</span>
                        {theme === option.id && <span className="theme-check">✓</span>}
                      </button>
                    ))}
                  </div>
                  <div className="theme-panel-footer">Your preferences are saved on this device.</div>
                </div>
              )}
            </div>

            <button className="search-launch" onClick={() => setSearchOpen(true)} aria-label="Search questions">
              <span>⌕</span><span className="search-label">Search</span><kbd>⌘ K</kbd>
            </button>
            <button className="support-nav-button" onClick={() => setSupportOpen(true)} aria-label="Open student support">
              <span aria-hidden="true">?</span><span>Support</span>
            </button>
            <button
              className="account-button"
              onClick={() => user ? setView('progress') : openAuth('signin')}
            >
              {user ? 'ACCOUNT' : 'SIGN IN'}
            </button>
          </div>
        </header>

        {view === 'home' && (
          <HomeView
            totalQuestions={totalQuestions}
            totalSubjects={totalSubjects}
            onStart={openSubject}
            onProgress={() => user ? setView('progress') : openAuth('signin')}
            onExam={openExamSetup}
            onQuickPractice={startQuickPractice}
            onChallenge={startChallenge}
            challengeBest={challengeBest}
            user={user}
            primary={PRIMARY_ORDER}
            dynamic={DYNAMIC_ORDER}
            lastSession={lastSession}
            dailyTarget={dailyTarget}
            dailyProgress={dailyProgress}
            bookmarks={bookmarks}
            mistakes={mistakeBank}
            notes={notes}
            onResume={resumeLastSession}
            onQuickSaved={startSavedReview}
            onMistakes={startMistakeBank}
            onSetTarget={setTarget}
            onSupport={() => setSupportOpen(true)}
          />
        )}

        {view === 'examSetup' && (
          <ExamSetupView
            config={examConfig}
            subjects={ENCOUNTER_ORDER}
            onToggleSubject={toggleExamSubject}
            onChangeConfig={setExamConfig}
            onBack={home}
            onStart={startExam}
            onStartNormal={() => startQuiz(examConfig.subjects[0] ?? 'Osteology', false)}
          />
        )}

        {view === 'exam' && exam && (
          <ExamView
            exam={exam}
            onAnswer={answerExam}
            onQuestion={goExamQuestion}
            onFlag={toggleExamFlag}
            onSubmit={() => void finishExam()}
            onLeave={abandonExam}
          />
        )}

        {view === 'examResults' && exam && (
          <ExamResultsView exam={exam} saved={examSaved} onHome={home} onNewExam={openExamSetup} />
        )}

        {view === 'quiz' && attempt && (
          <QuizView
            attempt={attempt}
            revealed={revealed}
            setRevealed={setRevealed}
            answered={answered}
            correct={correct}
            wrong={wrong}
            complete={complete}
            onBack={home}
            onChoose={choose}
            onFinish={() => void finishQuiz(Boolean(attempt.isChallenge))}
            onTimeUp={() => void finishQuiz(true)}
            onShuffle={() => startQuiz(attempt.section, true)}
            bookmarks={bookmarks}
            notes={notes}
            onToggleBookmark={toggleBookmark}
            onNoteChange={updateNote}
          />
        )}

        {view === 'results' && attempt && (
          <ResultsView
            attempt={attempt}
            user={user}
            saved={saved}
            onRetry={retry}
            onHome={home}
            onMistakes={startMistakeReview}
          />
        )}

        {view === 'progress' && (
          <ProgressView
            user={user}
            attempts={attempts}
            onBack={home}
            onSignIn={() => openAuth('signin')}
            onSignOut={signOut}
            onTheme={() => setThemeOpen(true)}
            bookmarks={bookmarks}
            notes={notes}
            onToggleBookmark={toggleBookmark}
          />
        )}

        <footer>Kazan MBBS · Anatomy practice · built for focused self-study</footer>
      </main>

      {welcomeOpen && (
        <div className="welcome-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setWelcomeOpen(false)}>
          <div className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <button className="welcome-close" onClick={() => setWelcomeOpen(false)} aria-label="Close">×</button>
            <div className="welcome-mark" aria-hidden="true">✚</div>
            <div className="welcome-kicker">KAZAN MBBS · DEPARTMENT OF ANATOMY</div>
            <h2 id="welcome-title">Coming <span>soon.</span></h2>
            <p className="welcome-copy">We’re putting the finishing touches on Kazan MBBS. A focused anatomy question bank built for MBBS students is almost ready.</p>
            <div className="welcome-device">
              <div className="welcome-device-icon" aria-hidden="true">▣</div>
              <div><strong>Best experience on iPad or tablet</strong><small>The larger screen gives you more room for questions, revision tools, notes and your study progress.</small></div>
            </div>
            <button className="welcome-enter" onClick={() => setWelcomeOpen(false)}>Enter Kazan MBBS →</button>
            <div className="welcome-foot">MBBS ANATOMY · PRACTICE · REVIEW</div>
          </div>
        </div>
      )}

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}

      {searchOpen && (
        <QuestionSearchModal
          term={searchTerm}
          onTermChange={setSearchTerm}
          onClose={() => { setSearchOpen(false); setSearchTerm(''); }}
          bookmarks={bookmarks}
          notes={notes}
          onToggleBookmark={toggleBookmark}
          onNoteChange={updateNote}
          onPractice={(q) => {
            setSearchOpen(false);
            setSearchTerm('');
            if (q.section !== 'Osteology') {
              setPremiumOpen(true);
            } else {
              startCustomQuiz([q], 'Search Practice');
            }
          }}
        />
      )}

      {authOpen && (
        <div className="auth-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
          <div className="auth-box" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" onClick={closeAuth} aria-label="Close">×</button>
            <div className="auth-kicker">KAZAN MBBS</div>

            <div className="auth-title" id="auth-title">
              {authMode === 'signin'
                ? 'Welcome back.'
                : authMode === 'signup'
                  ? 'Create your account.'
                  : authMode === 'forgot'
                    ? 'Reset your password.'
                    : 'Set a new password.'}
            </div>

            <div className="auth-subtitle">
              {authMode === 'signin'
                ? 'Sign in to save results and build your progress history.'
                : authMode === 'signup'
                  ? 'Create your account and keep your study progress synced.'
                  : authMode === 'forgot'
                    ? 'Enter your email and we’ll send you a secure reset link.'
                    : 'Choose a new password for your Kazan MBBS account.'}
            </div>

            {authMode !== 'reset' && (
              <div className="auth-tabs">
                <button className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setAuthMessage(''); }}>
                  SIGN IN
                </button>
                <button className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAuthMessage(''); }}>
                  CREATE ACCOUNT
                </button>
              </div>
            )}

            <div className="auth-form">
              <input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="Email address"
                disabled={authMode === 'reset'}
              />

              {authMode !== 'forgot' && (
                <input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  type="password"
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="Password"
                  onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                />
              )}

              {(authMode === 'signup' || authMode === 'reset') && (
                <input
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                />
              )}

              <button className="auth-primary" disabled={authBusy} onClick={submitAuth}>
                {authBusy
                  ? 'PLEASE WAIT…'
                  : authMode === 'signin'
                    ? 'SIGN IN'
                    : authMode === 'signup'
                      ? 'CREATE ACCOUNT'
                      : authMode === 'forgot'
                        ? 'SEND RESET LINK'
                        : 'UPDATE PASSWORD'}
              </button>
            </div>

            {authMessage && <div className="auth-message">{authMessage}</div>}

            {authMode === 'signin' && (
              <button className="plain-link" onClick={() => { setAuthMode('forgot'); setAuthMessage(''); }}>
                Forgot password?
              </button>
            )}

            {authMode === 'forgot' && (
              <button className="plain-link" onClick={() => { setAuthMode('signin'); setAuthMessage(''); }}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      )}

      {premiumOpen && (
        <div className="auth-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPremiumOpen(false)}>
          <div className="premium-box" role="dialog" aria-modal="true">
            <button className="auth-close" onClick={() => setPremiumOpen(false)} aria-label="Close">×</button>
            <div className="premium-icon">✦</div>
            <div className="premium-kicker">PREMIUM SUBJECT</div>
            <h2>Unlock the complete anatomy bank.</h2>
            <p>Osteology is free. The remaining subjects are reserved for Premium, with progress tracking and mistake practice built in.</p>
            <div className="premium-list">
              <span>✓ All anatomy subjects</span>
              <span>✓ Full question banks</span>
              <span>✓ Progress history</span>
              <span>✓ Mistake practice</span>
            </div>
            <PremiumCheckoutButton />
            <button className="plain-link" onClick={() => setPremiumOpen(false)}>Continue with free subject</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeView({
  totalQuestions, totalSubjects, onStart, onProgress, onExam, onQuickPractice, onChallenge, challengeBest, user, primary, dynamic,
  lastSession, dailyTarget, dailyProgress, bookmarks, mistakes, notes, onResume, onQuickSaved, onMistakes, onSetTarget, onSupport,
}: {
  totalQuestions: number;
  totalSubjects: number;
  onStart: (section: string) => void;
  onProgress: () => void;
  onExam: () => void;
  onQuickPractice: () => void;
  onChallenge: () => void;
  challengeBest: number;
  user: User | null;
  primary: string[];
  dynamic: string[];
  lastSession: AttemptState | null;
  dailyTarget: number;
  dailyProgress: Record<string, number>;
  bookmarks: string[];
  mistakes: string[];
  notes: Record<string, string>;
  onResume: () => void;
  onQuickSaved: () => void;
  onMistakes: () => void;
  onSetTarget: (value: number) => void;
  onSupport: () => void;
}) {
  const today = dailyProgress[localDayKey()] ?? 0;
  const targetPct = Math.min(100, Math.round((today / Math.max(1, dailyTarget)) * 100));
  const streak = getCurrentStreak(dailyProgress);
  const week = getLastSevenDays(dailyProgress);
  const maxWeek = Math.max(dailyTarget, ...week.map((d) => d.value), 1);
  const resumeAnswered = lastSession?.history.filter(Boolean).length ?? 0;
  const resumeTotal = lastSession?.order.length ?? 0;
  const notesCount = Object.keys(notes).length;
  const targetDone = today >= dailyTarget;

  return (
    <section className="home-medical">
      <div className="med-hero">
        <div className="med-hero-main">
          <div className="med-kicker"><span>DEPARTMENT OF ANATOMY</span><i /> <span>MBBS QUESTION BANK</span></div>
          <h2>Extra anatomy questions<br /><em>from the 2025 Anatomy Exam.</em></h2>
          <p>Practice anatomy the way you prepare for college exams: by subject, by question, and by the mistakes you need to revisit.</p>
          <div className="med-hero-actions">
            <button className="med-primary" onClick={() => onStart('Osteology')}>Start free practice <span>→</span></button>
            <button className="med-secondary" onClick={onProgress}>{user ? 'My progress' : 'Sign in to save progress'}</button>
          </div>
          <div className="med-proof-row">
            <span><b>{totalQuestions}</b> questions</span><span><b>{totalSubjects}</b> subjects</span><span><b>2025</b> exam-focused</span>
          </div>
        </div>

        <div className="med-record-card" aria-label="Anatomy department study record">
          <div className="record-cross" aria-hidden="true"><span /><span /></div>
          <div className="record-head">
            <div><span>DEPARTMENT OF ANATOMY</span><b>MBBS</b></div>
            <strong>2025</strong>
          </div>
          <div className="record-rule" />
          <div className="record-title">EXAM PREPARATION RECORD</div>
          <div className="record-main">
            <div className="record-number">01</div>
            <div><b>OSTEOLOGY</b><span>Extra anatomy questions from the 2025 exam</span></div>
          </div>
          <div className="record-grid">
            <div><span>FORMAT</span><b>MCQ</b></div>
            <div><span>LEVEL</span><b>MBBS</b></div>
            <div><span>METHOD</span><b>RECALL</b></div>
            <div><span>REVIEW</span><b>MISTAKES</b></div>
          </div>
          <div className="record-footer"><span className="record-status"><i /> STUDY FILE</span><span>Practice · Review · Repeat</span></div>
        </div>
      </div>

      <div className="med-section-head">
        <div><span className="med-label">YOUR STUDY DESK</span><h3>Today's work</h3></div>
        <span className="med-status"><i /> {targetDone ? 'Target complete' : `${dailyTarget - today} questions left`}</span>
      </div>

      <div className="med-day-grid">
        <div className="med-target-card">
          <div className="med-card-head"><div><span className="med-label">DAILY TARGET</span><h4>{today} <small>/ {dailyTarget} questions</small></h4></div><span className="med-number-badge">{targetPct}%</span></div>
          <div className="med-progress"><span style={{ width: `${targetPct}%` }} /></div>
          <div className="med-target-foot"><span>{targetDone ? '✓ Daily target reached' : `${dailyTarget - today} more to reach today's target`}</span><label>Target <input aria-label="Daily question target" type="number" min="1" max="500" value={dailyTarget} onChange={(e) => onSetTarget(Number(e.target.value))} /></label></div>
        </div>

        <div className="med-streak-card">
          <div className="med-card-head"><div><span className="med-label">STUDY STREAK</span><h4>{streak} <small>days</small></h4></div><span className="med-streak-note">LAST 7 DAYS</span></div>
          <div className="med-bars">
            {week.map((day) => <div key={day.key} title={`${day.label}: ${day.value} questions`} className={day.value ? 'worked' : ''}><span style={{ height: `${Math.max(8, Math.min(100, (day.value / maxWeek) * 100))}%` }} /></div>)}
          </div>
          <div className="med-days">{week.map((day) => <span key={day.key}>{day.label.slice(0, 1)}</span>)}</div>
        </div>
      </div>

      {lastSession && resumeTotal > resumeAnswered && (
        <button className="med-continue" onClick={onResume}>
          <span className="med-continue-icon">↗</span>
          <span><small>CONTINUE STUDYING</small><b>{displaySection(lastSession.section)}</b><em>{resumeAnswered} of {resumeTotal} answered · pick up where you stopped</em></span>
          <strong>Resume →</strong>
        </button>
      )}

      <div className="med-section-head med-tools-head">
        <div><span className="med-label">STUDY TOOLS</span><h3>Choose your session</h3></div>
      </div>
      <div className="med-tools">
        <button onClick={onQuickPractice}><span className="med-tool-icon">◷</span><span><small>5 MINUTES</small><b>Quick Practice</b><em>10 questions · no setup</em></span><strong>→</strong></button>
        <button onClick={onExam}><span className="med-tool-icon">▣</span><span><small>TIMED SESSION</small><b>Exam Mode</b><em>Build a paper from your subjects</em></span><strong>→</strong></button>
        <button onClick={onChallenge}><span className="med-tool-icon">★</span><span><small>PERSONAL BEST · {challengeBest}/10</small><b>Challenge Mode</b><em>Beat your best session</em></span><strong>→</strong></button>
      </div>

      <div className="med-section-head med-library-head">
        <div><span className="med-label">REVISION FILE</span><h3>Keep the difficult questions close.</h3></div>
        <span className="med-muted">{bookmarks.length + mistakes.length + notesCount} saved items</span>
      </div>
      <div className="med-library">
        <button onClick={bookmarks.length ? onQuickSaved : onProgress}><span className="med-library-icon">☆</span><span><b>Saved questions</b><em>{bookmarks.length ? `${bookmarks.length} ready for revision` : 'Bookmark questions while you study'}</em></span><strong>{bookmarks.length}</strong></button>
        <button className="mistakes" onClick={mistakes.length ? onMistakes : onProgress}><span className="med-library-icon">!</span><span><b>Mistake bank</b><em>{mistakes.length ? `${mistakes.length} questions to review` : 'Wrong answers collect here'}</em></span><strong>{mistakes.length}</strong></button>
        <button onClick={onProgress}><span className="med-library-icon">✎</span><span><b>Personal notes</b><em>{notesCount ? `${notesCount} annotated questions` : 'Add your own memory hooks'}</em></span><strong>{notesCount}</strong></button>
      </div>

      <div className="med-section-head med-subject-head">
        <div><span className="med-label">QUESTION BANK</span><h3>Choose your subject</h3></div>
        <span className="med-muted">Osteology is free · other subjects are Premium</span>
      </div>
      <div className="grid med-subject-grid">
        {primary.map((section, i) => <SubjectCard key={section} section={section} count={SECTIONS[section]?.length ?? 0} accent={ACCENTS[i % ACCENTS.length]} onStart={onStart} free={section === 'Osteology'} />)}
      </div>
      {dynamic.length > 0 && <>
        <div className="section-heading compact"><div><div className="section-label">MORE ANATOMY</div><h3>Additional subjects</h3></div></div>
        <div className="grid med-subject-grid">{dynamic.map((section, i) => <SubjectCard key={section} section={section} count={SECTIONS[section]?.length ?? 0} accent={ACCENTS[(i + 2) % ACCENTS.length]} onStart={onStart} free={false} />)}</div>
      </>}

      <section className="support-section support-desk" aria-label="Kazan MBBS student support">
        <div className="support-heading">
          <div><span className="med-label">STUDENT SUPPORT DESK</span><h3>Something not working?</h3><p>Report a broken question, payment issue, account problem, or anything else. Your message goes directly to our student support email.</p></div>
          <div className="support-email-badge"><span>SUPPORT</span><b>suprvirat@gmail.com</b></div>
        </div>
        <div className="support-grid">
          <button className="support-card" onClick={onSupport}><span className="support-icon">!</span><span><b>Something isn't working</b><small>Report a bug or a broken button</small></span><strong>→</strong></button>
          <button className="support-card" onClick={onSupport}><span className="support-icon">✎</span><span><b>Send feedback</b><small>Tell us what could be better</small></span><strong>→</strong></button>
          <button className="support-card" onClick={onSupport}><span className="support-icon">?</span><span><b>Ask a question</b><small>General help or account questions</small></span><strong>→</strong></button>
          <a className="support-card support-mail" href="mailto:suprvirat@gmail.com?subject=Kazan%20MBBS%20Support"><span className="support-icon">@</span><span><b>Email support directly</b><small>suprvirat@gmail.com</small></span><strong>↗</strong></a>
        </div>
        <div className="support-trust"><span>✚</span><b>KAZAN MBBS</b><span>Independent anatomy question bank</span><i /> <span>Student support by email</span></div>
      </section>
      <div className="med-footer"><span>MBBS ANATOMY</span><b>Practice what you know. Revisit what you miss.</b><button onClick={onProgress}>Open full dashboard →</button></div>
    </section>
  );
}

function SubjectCard({ section, count, accent, onStart, free }: { section: string; count: number; accent: string; onStart: (section: string) => void; free: boolean }) {
  return (
    <button
      type="button"
      className={`card medical-subject-card ${free ? 'free-card' : 'locked-card'}`}
      style={{ '--accent': accent } as CSSProperties}
      onClick={() => onStart(section)}
      aria-label={`${displaySection(section)}. ${count} questions. ${free ? 'Start practice' : 'Premium subject, unlock to practice'}`}
    >
      <div className="card-top medical-subject-top">
        <div className="card-icon">{ICONS[section] ?? '▤'}</div>
        {free ? <span className="free-pill">FREE</span> : <span className="lock-pill">PREMIUM</span>}
      </div>
      <div className="medical-subject-body">
        <div className="cname">{displaySection(section)}</div>
        <div className="subject-card-meta">
          <div className="ccount">{count} questions</div>
          <div className="cstart">{free ? 'Start practice' : 'Unlock subject'} <span aria-hidden="true">→</span></div>
        </div>
      </div>
    </button>
  );
}

function QuizView({
  attempt, revealed, setRevealed, answered, correct, wrong, complete, onBack, onChoose, onFinish, onTimeUp, onShuffle,
  bookmarks, notes, onToggleBookmark, onNoteChange,
}: {
  attempt: AttemptState; revealed: boolean; setRevealed: (v: boolean) => void; answered: number; correct: number; wrong: number; complete: boolean;
  onBack: () => void; onChoose: (q: number, option: number) => void; onFinish: () => void; onTimeUp: () => void; onShuffle: () => void;
  bookmarks: string[]; notes: Record<string, string>; onToggleBookmark: (q: Question) => void; onNoteChange: (q: Question, value: string) => void;
}) {
  if (attempt.isChallenge) {
    return (
      <ChallengeQuizView
        attempt={attempt}
        answered={answered}
        correct={correct}
        onBack={onBack}
        onChoose={onChoose}
        onSubmit={onFinish}
        bookmarks={bookmarks}
        notes={notes}
        onToggleBookmark={onToggleBookmark}
        onNoteChange={onNoteChange}
      />
    );
  }

  const progress = attempt.order.length ? (answered / attempt.order.length) * 100 : 0;
  const [timeLeft, setTimeLeft] = useState<number | null>(attempt.timeLimitSeconds ?? null);
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    const id = window.setInterval(() => setTimeLeft((current) => current === null ? null : Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timeLeft, onTimeUp]);
  const timeText = timeLeft === null ? '' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;
  return (
    <section className="quiz-view">
      <div className="quiz-session-topline">
        <button className="back-btn" onClick={onBack}>← All subjects</button>
        <div className="quiz-title">
          <span>{attempt.isMistakeReview ? 'Mistake review · ' : ''}</span>
          {displaySection(attempt.section)}
        </div>
        <span className="quiz-session-count">{answered} / {attempt.order.length}</span>
      </div>

      <div className="quiz-bottom-dashboard" role="region" aria-label="Quiz progress dashboard">
        <div className="quiz-bottom-main">
          <div className="quiz-bottom-label">
            <span>SESSION PROGRESS</span>
            <strong>{answered}<em> / {attempt.order.length}</em></strong>
          </div>
          <div className="quiz-bottom-track" aria-label={`Session progress: ${answered} of ${attempt.order.length} answered`}>
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="quiz-bottom-stats">
          <span className="status-right"><i /> {correct} right</span>
          <span className="status-wrong"><i /> {wrong} wrong</span>
        </div>
        <div className="quiz-bottom-actions">
          <button className="session-action" onClick={() => setRevealed(!revealed)}>◉ <span>{revealed ? 'Hide answers' : 'Reveal answers'}</span></button>
          <button className="session-action" onClick={onShuffle}>⌁ <span>Shuffle</span></button>
          <button className="session-submit" disabled={!complete} onClick={onFinish}>✓ <span>SUBMIT</span></button>
        </div>
      </div>

      <div className="quiz-list">
        {attempt.order.map((q, qi) => (
          <QuestionPlate
            key={`${qi}-${q.question}`}
            q={q}
            index={qi}
            total={attempt.order.length}
            history={attempt.history[qi]}
            revealed={revealed}
            onChoose={onChoose}
            bookmarked={bookmarks.includes(questionKey(q))}
            note={notes[questionKey(q)] ?? ''}
            onToggleBookmark={onToggleBookmark}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </section>
  );
}

function ChallengeQuizView({
  attempt, answered, correct, onBack, onChoose, onSubmit, bookmarks, notes, onToggleBookmark, onNoteChange,
}: {
  attempt: AttemptState;
  answered: number;
  correct: number;
  onBack: () => void;
  onChoose: (q: number, option: number) => void;
  onSubmit: () => void;
  bookmarks: string[];
  notes: Record<string, string>;
  onToggleBookmark: (q: Question) => void;
  onNoteChange: (q: Question, value: string) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const q = attempt.order[current];
  const history = attempt.history[current];
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const total = attempt.order.length;
  const unanswered = total - answered;
  const progress = total ? ((current + 1) / total) * 100 : 0;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  if (!q) return null;

  const submit = () => {
    setShowSubmit(false);
    onSubmit();
  };

  return (
    <section className="challenge-view">
      <div className="challenge-shell">
        <header className="challenge-header">
          <button className="challenge-exit" onClick={onBack}>← Exit</button>
          <div className="challenge-brand">
            <span className="challenge-live-dot" />
            <div><span>CHALLENGE MODE</span><small>10 questions · personal best</small></div>
          </div>
          <div className="challenge-score"><b>{correct}</b><span>correct</span></div>
        </header>

        <div className="challenge-progress">
          <div className="challenge-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div><span>QUESTION {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span><b>{answered}/{total} answered</b></div>
        </div>

        <div className="challenge-grid">
          <main className="challenge-main">
            <div className="challenge-question-top">
              <span className="challenge-topic">{displaySection(q.section)}</span>
              <button className={`challenge-bookmark ${bookmarks.includes(questionKey(q)) ? 'active' : ''}`} onClick={() => onToggleBookmark(q)}>
                {bookmarks.includes(questionKey(q)) ? '★ Saved' : '☆ Save'}
              </button>
            </div>

            <article className="challenge-card">
              <div className="challenge-number">{String(current + 1).padStart(2, '0')}</div>
              <div className="challenge-question">{q.question}</div>
              <div className="challenge-options">
                {q.options.map((option, i) => {
                  const selected = history?.chosen === i;
                  return (
                    <button key={`${option}-${i}`} className={`challenge-option ${selected ? 'selected' : ''}`} disabled={Boolean(history)} onClick={() => onChoose(current, i)}>
                      <span className="challenge-option-letter">{letters[i]}</span>
                      <span>{option}</span>
                      {selected && <b>✓</b>}
                    </button>
                  );
                })}
              </div>
              {history && <div className={`challenge-feedback ${history.correct ? 'correct' : 'wrong'}`}>
                <span>{history.correct ? '✓ Correct' : '× Incorrect'}</span>
                {!history.correct && <small>Correct answer: {q.options[q.correct_index]}</small>}
              </div>}
            </article>

            <div className="challenge-note-wrap">
              <label><span>PRIVATE NOTE</span><small>Optional · saved locally</small></label>
              <textarea value={notes[questionKey(q)] ?? ''} onChange={(e) => onNoteChange(q, e.target.value)} placeholder="Add a quick memory hook…" rows={2} />
            </div>

            <nav className="challenge-nav">
              <button className="challenge-nav-btn" disabled={current === 0} onClick={() => setCurrent((v) => Math.max(0, v - 1))}>← Previous</button>
              <div className="challenge-dots">
                {attempt.order.map((_, i) => <button key={i} aria-label={`Question ${i + 1}`} className={`${i === current ? 'current ' : ''}${attempt.history[i] ? 'done' : ''}`} onClick={() => setCurrent(i)} />)}
              </div>
              {current < total - 1 ? (
                <button className="challenge-nav-btn primary" onClick={() => setCurrent((v) => Math.min(total - 1, v + 1))}>Next →</button>
              ) : (
                <button className="challenge-submit-btn" onClick={() => setShowSubmit(true)}>Submit challenge</button>
              )}
            </nav>
          </main>

          <aside className="challenge-sidebar">
            <div className="challenge-panel">
              <span className="challenge-panel-kicker">YOUR RUN</span>
              <strong>{answered}<small>/{total}</small></strong>
              <span>questions answered</span>
              <div className="challenge-stat-line"><span>Correct</span><b>{correct}</b></div>
              <div className="challenge-stat-line"><span>Remaining</span><b>{unanswered}</b></div>
            </div>
            <div className="challenge-panel challenge-map">
              <div className="challenge-panel-title"><span>QUESTION MAP</span><b>{total}</b></div>
              <div className="challenge-map-grid">
                {attempt.order.map((_, i) => <button key={i} className={`${i === current ? 'current ' : ''}${attempt.history[i] ? 'answered' : ''}`} onClick={() => setCurrent(i)}>{i + 1}</button>)}
              </div>
              <p>Answers are locked after selection. Submit when you're done.</p>
            </div>
          </aside>
        </div>
      </div>

      {showSubmit && (
        <div className="challenge-submit-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowSubmit(false)}>
          <div className="challenge-submit-dialog" role="dialog" aria-modal="true" aria-labelledby="challenge-submit-title">
            <span className="challenge-dialog-icon">↯</span>
            <span className="challenge-panel-kicker">FINAL CHECK</span>
            <h2 id="challenge-submit-title">Submit your challenge?</h2>
            <p>{answered === total ? 'All questions are answered. Your result will be shown immediately.' : `You still have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Unanswered questions count as incorrect.`}</p>
            <div className="challenge-dialog-actions"><button className="btn-secondary" onClick={() => setShowSubmit(false)}>Keep solving</button><button className="challenge-submit-btn" onClick={submit}>Submit challenge</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionPlate({
  q, index, total, history, revealed, onChoose, bookmarked, note, onToggleBookmark, onNoteChange,
}: {
  q: Question;
  index: number;
  total: number;
  history: HistoryItem | null;
  revealed: boolean;
  onChoose: (q: number, option: number) => void;
  bookmarked: boolean;
  note: string;
  onToggleBookmark: (q: Question) => void;
  onNoteChange: (q: Question, value: string) => void;
}) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return (
    <article className={`q-plate ${history ? 'answered' : ''}`}>
      <div className="q-eyebrow">
        <span>{displaySection(q.section)}</span>
        <span>{index + 1} / {total}</span>
      </div>
      <div className="q-utility-row">
        <button className={`question-save ${bookmarked ? 'active' : ''}`} onClick={() => onToggleBookmark(q)}>
          <span>{bookmarked ? '★' : '☆'}</span>{bookmarked ? 'Saved' : 'Save question'}
        </button>
        <span className="question-hint">Personal revision space</span>
      </div>
      <div className="q-text">{q.question}</div>
      <div className="options">
        {q.options.map((option, i) => {
          const isChosen = history?.chosen === i;
          const isCorrect = i === q.correct_index;
          let className = 'opt';
          if (history && isCorrect) className += ' correct';
          if (history && isChosen && !history.correct) className += ' wrong';
          if (!history && revealed && isCorrect) className += ' correct';
          return (
            <button key={`${option}-${i}`} className={className} disabled={Boolean(history)} onClick={() => onChoose(index, i)}>
              <span className="letter">{letters[i]}</span><span>{option}</span>
            </button>
          );
        })}
      </div>
      {history && <div className={`feedback ${history.correct ? 'ok' : 'no'}`}>{history.correct ? 'Correct. Keep going.' : `Not quite. Correct answer: ${q.options[q.correct_index]}`}</div>}
      <div className="personal-note">
        <div className="personal-note-head"><span>✎ Personal note</span><small>Saved on this device</small></div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(q, e.target.value)}
          placeholder="Add a memory hook, clinical connection, or something to revisit…"
          rows={note ? 3 : 2}
        />
      </div>
    </article>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('Something is not working');
  const [message, setMessage] = useState('');
  const categories = ['Something is not working', 'Question about the website', 'Premium / payment question', 'Suggestion or feedback', 'Other'];
  const send = () => {
    const subject = `Kazan MBBS Support - ${category}`;
    const body = `Category: ${category}\n\nMessage:\n${message || '(No additional details provided)'}\n\nSent from Kazan MBBS.`;
    window.location.href = `mailto:suprvirat@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <div className="support-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title">
        <button className="support-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="support-modal-mark">✚</div>
        <div className="med-label">KAZAN MBBS · STUDENT SUPPORT</div>
        <h2 id="support-title">Tell us what happened.</h2>
        <p>Choose the closest option and describe the problem. Your email app will open with the support message ready to send.</p>
        <label className="support-field-label">WHAT DO YOU NEED HELP WITH?</label>
        <div className="support-options">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}<span>›</span></button>)}</div>
        <label className="support-field-label" htmlFor="support-message">WHAT'S THE PROBLEM?</label>
        <textarea id="support-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what you clicked, what you expected, and what happened..." rows={4} />
        <div className="support-modal-foot"><span>Support email<br /><b>suprvirat@gmail.com</b></span><button className="support-send" onClick={send}>Open email →</button></div>
      </div>
    </div>
  );
}

function QuestionSearchModal({
  term, onTermChange, onClose, bookmarks, notes, onToggleBookmark, onNoteChange, onPractice,
}: {
  term: string;
  onTermChange: (value: string) => void;
  onClose: () => void;
  bookmarks: string[];
  notes: Record<string, string>;
  onToggleBookmark: (q: Question) => void;
  onNoteChange: (q: Question, value: string) => void;
  onPractice: (q: Question) => void;
}) {
  const results = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return QUESTIONS.slice(0, 8);
    return QUESTIONS.filter((q) => {
      const haystack = `${q.section} ${q.question} ${q.options.join(' ')}`.toLowerCase();
      return haystack.includes(query);
    }).slice(0, 24);
  }, [term]);

  return (
    <div className="search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search questions">
        <div className="search-top">
          <div><span className="section-label">QUESTION LIBRARY</span><h2>Find any question.</h2></div>
          <button className="search-close" onClick={onClose}>×</button>
        </div>
        <div className="search-input-wrap">
          <span>⌕</span>
          <input autoFocus value={term} onChange={(e) => onTermChange(e.target.value)} placeholder="Search anatomy, nerve, muscle, artery…" />
          <kbd>ESC</kbd>
        </div>
        <div className="search-meta">{term ? `${results.length} matching questions` : 'Start typing to search the question bank'}</div>
        <div className="search-results">
          {results.length === 0 ? <div className="search-empty">No questions found. Try a broader term.</div> : results.map((q) => {
            const key = questionKey(q);
            const saved = bookmarks.includes(key);
            return (
              <div className="search-result" key={key}>
                <div className="search-result-main">
                  <span className="search-result-subject">{displaySection(q.section)}</span>
                  <b>{q.question}</b>
                  <small>{q.options.join(' · ')}</small>
                </div>
                <div className="search-result-actions">
                  <button className={saved ? 'active' : ''} onClick={() => onToggleBookmark(q)}>{saved ? '★' : '☆'}</button>
                  <button onClick={() => onPractice(q)}>Practice</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="search-footer">Search covers questions, options, and subjects. Notes and saved questions stay on this device.</div>
      </div>
    </div>
  );
}


function ResultsView({ attempt, user, saved, onRetry, onHome, onMistakes }: {
  attempt: AttemptState; user: User | null; saved: 'idle' | 'saving' | 'saved' | 'failed'; onRetry: () => void; onHome: () => void; onMistakes: () => void;
}) {
  const pct = Math.round((attempt.score / attempt.order.length) * 100);
  const missed = useMemo(() => attempt.history.filter((h): h is HistoryItem => h !== null && !h.correct), [attempt.history]);
  const correctCount = attempt.score;
  const wrongCount = attempt.order.length - correctCount;
  const message = pct >= 90 ? 'Excellent work.' : pct >= 70 ? 'Solid session. Keep sharpening it.' : pct >= 50 ? 'Good start. Your mistakes show you where to focus.' : 'This is exactly what practice is for. Review, then go again.';
  return (
    <section className="results-view">
      <div className="quiz-head"><button className="back-btn" onClick={onHome}>← All subjects</button><div className="quiz-title">{displaySection(attempt.section)}</div><div /></div>

      <div className="result-hero">
        <div className="section-label centered">{attempt.isChallenge ? 'CHALLENGE COMPLETE' : 'SESSION COMPLETE'}</div>
        <div className="result-ring" style={{ '--score': `${pct}%` } as CSSProperties}><div><b>{pct}%</b><span>accuracy</span></div></div>
        <h2>{message}</h2>
        <p>{correctCount} correct · {wrongCount} incorrect · {attempt.order.length} total</p>
        {attempt.isChallenge ? (
          <div className="challenge-result-badge">↯ Challenge result · personal best updates on this device</div>
        ) : user && <div className={`save-status ${saved}`}>{saved === 'saving' ? 'Saving attempt…' : saved === 'saved' ? '✓ Attempt saved to your account' : saved === 'failed' ? 'Attempt could not be saved, but your result is still here.' : ''}</div>}
      </div>

      <div className="result-stats">
        <div><span>Correct</span><b className="good-text">{correctCount}</b></div>
        <div><span>Incorrect</span><b className="bad-text">{wrongCount}</b></div>
        <div><span>Accuracy</span><b>{pct}%</b></div>
      </div>

      <div className="results-actions">
        {missed.length > 0 && <button className="next-btn" onClick={onMistakes}>↻ Practice mistakes ({missed.length})</button>}
        <button className="btn-secondary" onClick={onRetry}>{attempt.isChallenge ? 'Try challenge again' : 'Practice again'}</button>
        <button className="btn-secondary" onClick={onHome}>Back to subjects</button>
      </div>

      <div className="review-list">
        <div className="section-heading compact"><div><div className="section-label">Revision</div><h3>{missed.length ? 'Your mistakes' : 'Perfect session'}</h3></div><span className="subject-note">{missed.length ? `${missed.length} to review` : 'Nothing missed'}</span></div>
        {missed.length === 0 ? (
          <div className="empty-note success-note">Every question answered correctly. Nothing to review.</div>
        ) : missed.map((h, i) => (
          <div className="review-item" key={`${h.q.question}-${i}`}>
            <div className="review-index">{String(i + 1).padStart(2, '0')}</div>
            <div><div className="review-q">{h.q.question}</div>
              <div className="review-line"><span className="tag your">Your answer</span>{h.q.options[h.chosen]}</div>
              <div className="review-line"><span className="tag right">Correct</span>{h.q.options[h.q.correct_index]}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgressView({ user, attempts, onBack, onSignIn, onSignOut, onTheme, bookmarks, notes, onToggleBookmark }: {
  user: User | null;
  attempts: SavedAttempt[];
  onBack: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onTheme: () => void;
  bookmarks: string[];
  notes: Record<string, string>;
  onToggleBookmark: (q: Question) => void;
}) {
  const totalAnswered = attempts.reduce((sum, a) => sum + Number(a.total_questions || 0), 0);
  const totalCorrect = attempts.reduce((sum, a) => sum + Number(a.correct_answers || 0), 0);
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const subjectStats = ENCOUNTER_ORDER.map((subject) => {
    const rows = attempts.filter((a) => a.subject === subject);
    const questions = rows.reduce((sum, a) => sum + Number(a.total_questions || 0), 0);
    const correct = rows.reduce((sum, a) => sum + Number(a.correct_answers || 0), 0);
    return { subject, questions, correct, pct: questions ? Math.round((correct / questions) * 100) : 0 };
  }).filter((x) => x.questions > 0);
  const bestSubject = [...subjectStats].sort((a, b) => b.pct - a.pct)[0];
  const weakSubject = [...subjectStats].sort((a, b) => a.pct - b.pct)[0];

  if (!user) {
    return (
      <section className="progress-view">
        <div className="quiz-head"><button className="back-btn" onClick={onBack}>← Home</button><div className="quiz-title">Student Progress</div><div /></div>
        <div className="empty-dashboard">
          <div className="dashboard-icon">◌</div>
          <div className="section-label">ACCOUNT SYNC</div>
          <h2>Your progress lives here.</h2>
          <p>Sign in to save completed sessions, see subject accuracy, and build a proper revision history.</p>
          <button className="next-btn" onClick={onSignIn}>Sign in to continue →</button>
        </div>
      </section>
    );
  }

  return (
    <section className="progress-view">
      <div className="quiz-head"><button className="back-btn" onClick={onBack}>← Home</button><div className="quiz-title">Student Progress</div><div /></div>

      <div className="dashboard-head">
        <div><div className="section-label">KAZAN MBBS / STUDENT DASHBOARD</div><h2>Keep the weak spots visible.</h2><p>{user.email}</p></div>
        <div className="sync-badge"><span /> Account synced</div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Questions attempted" value={totalAnswered.toString()} detail={`${attempts.length} saved sessions`} icon="Q" />
        <MetricCard label="Overall accuracy" value={`${accuracy}%`} detail={totalAnswered ? `${totalCorrect} correct answers` : 'Start your first session'} icon="%" />
        <MetricCard label="Subjects practiced" value={subjectStats.length.toString()} detail={`of ${ENCOUNTER_ORDER.length} available`} icon="◈" />
        <MetricCard label="Best subject" value={bestSubject ? `${bestSubject.pct}%` : '—'} detail={bestSubject ? displaySection(bestSubject.subject) : 'No data yet'} icon="↑" />
      </div>

      <div className="dashboard-command-grid">
        <div className="dashboard-command prediction-command">
          <div className="command-top"><span className="section-label">PROJECTION</span><span className="prediction-badge">{trendLabel(attempts)}</span></div>
          <div className="prediction-number">{predictionAccuracy(attempts)}%</div>
          <strong>Projected accuracy</strong>
          <p>Based on your recent completed sessions. The goal is a useful signal, not fake precision.</p>
          <div className="prediction-line"><span style={{ width: `${predictionAccuracy(attempts)}%` }} /></div>
        </div>
        <div className="dashboard-command">
          <div className="command-top"><span className="section-label">REVISION QUEUE</span><span>{bookmarks.length} saved</span></div>
          <div className="prediction-number">{Object.keys(notes).length}</div>
          <strong>Personal notes</strong>
          <p>Questions you've annotated for later revision.</p>
          <div className="dash-mini-row"><span>Saved questions</span><b>{bookmarks.length}</b></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dash-card-head"><div><div className="section-label">PERFORMANCE</div><h3>Subject accuracy</h3></div><span className="dash-count">{subjectStats.length} tracked</span></div>
          {subjectStats.length === 0 ? <div className="empty-note">Complete a quiz to start building your subject history.</div> : (
            <div className="subject-performance">
              {subjectStats.map((s) => (
                <div className="subject-row" key={s.subject}>
                  <div className="subject-row-top"><span>{displaySection(s.subject)}</span><b>{s.pct}%</b></div>
                  <div className="subject-track"><div style={{ width: `${s.pct}%` }} /></div>
                  <div className="subject-row-bottom"><span>{s.questions} questions</span><span>{s.correct} correct</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dash-card-head"><div><div className="section-label">FOCUS</div><h3>What to work on</h3></div><span className="focus-icon">◎</span></div>
          {weakSubject ? (
            <div className="focus-box">
              <span className="focus-kicker">NEEDS ATTENTION</span>
              <strong>{displaySection(weakSubject.subject)}</strong>
              <b>{weakSubject.pct}% accuracy</b>
              <p>Keep this subject in your next revision cycle. Your mistakes are data, not a verdict.</p>
            </div>
          ) : (
            <div className="focus-box empty"><strong>Your dashboard is ready.</strong><p>Complete Osteology practice to generate your first performance signal.</p></div>
          )}
        </div>
      </div>

      <div className="dashboard-card history-card">
        <div className="dash-card-head"><div><div className="section-label">RECENT ACTIVITY</div><h3>Practice history</h3></div><span className="dash-count">{attempts.length} sessions</span></div>
        {attempts.length === 0 ? <div className="empty-note">No completed sessions yet.</div> : (
          <div className="history-list">
            {attempts.slice(0, 12).map((a, i) => (
              <div className="history-row" key={`${a.created_at}-${i}`}>
                <div className="history-mark">{a.score_percentage >= 70 ? '✓' : '!'}</div>
                <div className="history-main"><strong>{displaySection(a.subject)}</strong><span>{a.total_questions} questions · {formatDate(a.created_at)}</span></div>
                <b className={a.score_percentage >= 70 ? 'good-text' : 'bad-text'}>{a.score_percentage}%</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card saved-library-card">
        <div className="dash-card-head">
          <div><div className="section-label">YOUR LIBRARY</div><h3>Saved questions</h3></div>
          <span className="dash-count">{bookmarks.length} saved</span>
        </div>
        {bookmarks.length === 0 ? (
          <div className="empty-note">Save questions while practicing and they will appear here for quick revision.</div>
        ) : (
          <div className="saved-library-list">
            {QUESTIONS.filter((q) => bookmarks.includes(questionKey(q))).slice(0, 8).map((q) => (
              <div className="saved-library-row" key={questionKey(q)}>
                <div><span>{displaySection(q.section)}</span><b>{q.question}</b>{notes[questionKey(q)] && <small>✎ {notes[questionKey(q)]}</small>}</div>
                <button onClick={() => onToggleBookmark(q)}>★</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-footer-note">
        <span>↑ {bestSubject ? `Strongest: ${displaySection(bestSubject.subject)}` : 'Start practicing'}</span>
        <span>↓ {weakSubject ? `Focus: ${displaySection(weakSubject.subject)}` : 'More data after your first session'}</span>
      </div>

      <div className="account-actions">
        <div>
          <div className="section-label">ACCOUNT</div>
          <strong>{user.email}</strong>
          <span>Your quiz history is synced to this account.</span>
        </div>
        <button className="btn-secondary" onClick={onSignOut}>SIGN OUT</button>
      </div>
    </section>
  );
}

function predictionAccuracy(attempts: SavedAttempt[]) {
  if (!attempts.length) return 0;
  const recent = attempts.slice(0, 5).map((a) => Number(a.score_percentage || 0));
  const previous = attempts.slice(5, 10).map((a) => Number(a.score_percentage || 0));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : recentAvg;
  return Math.max(0, Math.min(100, Math.round(recentAvg + (recentAvg - previousAvg) * 0.35)));
}

function trendLabel(attempts: SavedAttempt[]) {
  if (attempts.length < 2) return 'BUILDING BASELINE';
  const recent = attempts.slice(0, 3).reduce((sum, a) => sum + Number(a.score_percentage || 0), 0) / Math.min(3, attempts.length);
  const previousRows = attempts.slice(3, 6);
  if (!previousRows.length) return 'EARLY TREND';
  const previous = previousRows.reduce((sum, a) => sum + Number(a.score_percentage || 0), 0) / previousRows.length;
  if (recent >= previous + 3) return '↗ IMPROVING';
  if (recent <= previous - 3) return '↘ NEEDS FOCUS';
  return '→ STEADY';
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><b>{value}</b><small>{detail}</small></div>;
}


function formatExamTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function ExamSetupView({ config, subjects, onToggleSubject, onChangeConfig, onBack, onStart, onStartNormal }: {
  config: ExamConfig;
  subjects: string[];
  onToggleSubject: (section: string) => void;
  onChangeConfig: (config: ExamConfig) => void;
  onBack: () => void;
  onStart: () => void;
  onStartNormal: () => void;
}) {
  const [practiceMode, setPracticeMode] = useState<'normal' | 'pdf' | 'cbt'>('cbt');
  const poolSize = config.subjects.reduce((sum, s) => sum + (SECTIONS[s]?.length ?? 0), 0);
  const countOptions = Array.from(new Set([10, 20, 30, 45, 60, 90, 120, poolSize])).filter((n) => n > 0 && n <= poolSize).sort((a, b) => a - b);
  const timeOptions = [15, 30, 45, 60, 90, 120];
  return (
    <section className="exam-setup">
      <div className="exam-setup-top">
        <button className="back-btn" onClick={onBack}>← Home</button>
        <div className="exam-badge">TIMED MOCK EXAM</div>
      </div>

      <div className="ios26-exam-hero">
        <div className="ios26-orb ios26-orb-a" aria-hidden="true" />
        <div className="ios26-orb ios26-orb-b" aria-hidden="true" />
        <div className="ios26-hero-copy">
          <div className="ios26-eyebrow"><span>✦</span> KAZAN MBBS <i /> PRACTICE OS</div>
          <h2>How do you want<br /><span>to practice today?</span></h2>
          <p>Same questions. A completely different experience. Choose your mode before the test begins.</p>
          <div className="ios26-trust-row">
            <span>⌁ {config.questionCount} questions</span>
            <span>◷ {config.timeMinutes} min</span>
            <span>◌ {config.subjects.length} subject{config.subjects.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="ios26-hero-preview">
          <div className="ios26-preview-glass">
            <span className="ios26-preview-label">TODAY'S SESSION</span>
            <div className="ios26-preview-number">{config.questionCount}</div>
            <div className="ios26-preview-caption">questions ready</div>
            <div className="ios26-preview-line" />
            <div className="ios26-preview-meta"><b>{config.timeMinutes} min</b><span>suggested</span></div>
          </div>
        </div>
      </div>

      <div className="ios26-mode-section">
        <div className="ios26-section-head">
          <div>
            <div className="section-label">CHOOSE EXPERIENCE</div>
            <h3>One test. Three ways to take it.</h3>
          </div>
          <span className="ios26-selection-status"><span /> {practiceMode === 'cbt' ? 'Exam ready' : practiceMode === 'normal' ? 'Learning mode' : 'Print ready'}</span>
        </div>
        <div className="ios26-mode-grid">
          <button className={`ios26-mode-card ${practiceMode === 'normal' ? 'active' : ''}`} onClick={() => setPracticeMode('normal')}>
            <span className="ios26-mode-check">{practiceMode === 'normal' ? '✓' : ''}</span>
            <span className="ios26-mode-icon">◉</span>
            <b>Normal Practice</b>
            <small>Immediate feedback, explanations and a calmer learning flow.</small>
            <em>LEARN</em>
          </button>
          <button className={`ios26-mode-card ${practiceMode === 'cbt' ? 'active' : ''}`} onClick={() => setPracticeMode('cbt')}>
            <span className="ios26-mode-check">{practiceMode === 'cbt' ? '✓' : ''}</span>
            <span className="ios26-mode-icon">⌘</span>
            <b>CBT Exam</b>
            <small>Focused exam UI with timer, palette, review and submission.</small>
            <em>RECOMMENDED</em>
          </button>
          <button className={`ios26-mode-card ${practiceMode === 'pdf' ? 'active' : ''}`} onClick={() => setPracticeMode('pdf')}>
            <span className="ios26-mode-check">{practiceMode === 'pdf' ? '✓' : ''}</span>
            <span className="ios26-mode-icon">▤</span>
            <b>PDF Paper</b>
            <small>Clean printable paper for pen-and-paper revision.</small>
            <em>OFFLINE</em>
          </button>
        </div>
      </div>

      <div className="exam-builder">
        <div className="exam-builder-main">
          <div className="exam-step">
            <div className="exam-step-head"><span>01</span><div><div className="section-label">SUBJECTS</div><h3>What are you testing?</h3></div><b>{config.subjects.length} selected</b></div>
            <div className="exam-subject-grid">
              {subjects.map((section) => {
                const count = SECTIONS[section]?.length ?? 0;
                const selected = config.subjects.includes(section);
                return (
                  <button key={section} className={`exam-subject ${selected ? 'selected' : ''}`} onClick={() => onToggleSubject(section)} disabled={!count}>
                    <span className="exam-check">{selected ? '✓' : ''}</span>
                    <span><b>{displaySection(section)}</b><small>{count} questions available</small></span>
                    <strong>{selected ? 'IN' : '+'}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="exam-step">
            <div className="exam-step-head"><span>02</span><div><div className="section-label">QUESTION COUNT</div><h3>How long should the paper be?</h3></div><b>{poolSize} available</b></div>
            <div className="exam-choice-row">
              {countOptions.map((count) => (
                <button key={count} className={config.questionCount === count ? 'exam-choice active' : 'exam-choice'} onClick={() => onChangeConfig({ ...config, questionCount: count })}>
                  {count === poolSize ? 'ALL' : count}
                </button>
              ))}
            </div>
            <div className="exam-slider-row">
              <input type="range" min="1" max={Math.max(1, poolSize)} value={Math.min(config.questionCount, poolSize || 1)} onChange={(e) => onChangeConfig({ ...config, questionCount: Number(e.target.value) })} />
              <span>{config.questionCount} questions</span>
            </div>
          </div>

          <div className="exam-step">
            <div className="exam-step-head"><span>03</span><div><div className="section-label">TIME LIMIT</div><h3>Set the clock.</h3></div><b>Auto-submit at 0:00</b></div>
            <div className="exam-choice-row time-row">
              {timeOptions.map((minutes) => (
                <button key={minutes} className={config.timeMinutes === minutes ? 'exam-choice active' : 'exam-choice'} onClick={() => onChangeConfig({ ...config, timeMinutes: minutes })}>{minutes} min</button>
              ))}
            </div>
            <label className="exam-custom-time">Custom minutes
              <input type="number" min="5" max="180" value={config.timeMinutes} onChange={(e) => onChangeConfig({ ...config, timeMinutes: Math.max(5, Math.min(180, Number(e.target.value) || 5)) })} />
            </label>
          </div>
        </div>

        <aside className="exam-rules">
          <div className="section-label">EXAM RULES</div>
          <h3>Simulation mode</h3>
          <div className="rule-list">
            <span>✓ Questions are randomized</span>
            <span>✓ No answer feedback during exam</span>
            <span>✓ Navigate freely between questions</span>
            <span>✓ Mark questions for review</span>
            <span>✓ Timer auto-submits the paper</span>
            <span>✓ Score and corrections appear after submission</span>
          </div>
          <div className="exam-ready"><span>READY</span><b>{config.questionCount} questions</b><small>{config.timeMinutes} minutes</small></div>
          <button
            className="next-btn exam-start-btn ios26-start"
            disabled={!config.subjects.length || !poolSize}
            onClick={() => {
              if (practiceMode === 'normal') onStartNormal();
              else if (practiceMode === 'pdf') window.print();
              else onStart();
            }}
          >
            {practiceMode === 'normal' ? 'START PRACTICE' : practiceMode === 'pdf' ? 'GENERATE PDF' : 'START CBT EXAM'}
            <span>↗</span>
          </button>
          <p className="exam-note">{practiceMode === 'cbt' ? 'Your answers remain hidden until submission.' : practiceMode === 'normal' ? 'Learn as you go with immediate explanations.' : 'Your browser print dialog will create the paper.'}</p>
        </aside>
      </div>
    </section>
  );
}

function ExamView({ exam, onAnswer, onQuestion, onFlag, onSubmit, onLeave }: {
  exam: ExamState;
  onAnswer: (option: number) => void;
  onQuestion: (index: number) => void;
  onFlag: () => void;
  onSubmit: () => void;
  onLeave: () => void;
}) {
  const q = exam.questions[exam.current];
  const answered = Object.keys(exam.answers).length;
  const progress = exam.questions.length ? (answered / exam.questions.length) * 100 : 0;
  const isUrgent = exam.remainingSeconds <= 300;
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const flagged = exam.flagged.includes(exam.current);
  const selected = exam.answers[exam.current];
  return (
    <section className="exam-session">
      <header className={`exam-session-head ${isUrgent ? 'urgent' : ''}`}>
        <div className="exam-session-brand"><span className="exam-live-dot" /> <div><b>MOCK EXAM</b><small>{exam.config.subjects.length === 1 ? displaySection(exam.config.subjects[0]) : 'Mixed subjects'}</small></div></div>
        <div className="exam-timer"><span>TIME REMAINING</span><b>{formatExamTime(exam.remainingSeconds)}</b></div>
        <button className="exam-submit-top" onClick={onSubmit}>SUBMIT EXAM</button>
      </header>

      <div className="exam-progress"><div style={{ width: `${progress}%` }} /><span>{answered}/{exam.questions.length} answered</span></div>

      <div className="exam-layout">
        <main className="exam-question-area">
          <div className="exam-question-meta"><span>QUESTION {exam.current + 1} OF {exam.questions.length}</span><button className={flagged ? 'exam-flag active' : 'exam-flag'} onClick={onFlag}>{flagged ? '★ Marked' : '☆ Mark for review'}</button></div>
          <article className="exam-question-card">
            <div className="exam-q-kicker">{displaySection(q.section)}</div>
            <h2>{q.question}</h2>
            <div className="exam-options">
              {q.options.map((option, i) => (
                <button key={`${option}-${i}`} className={selected === i ? 'exam-option selected' : 'exam-option'} onClick={() => onAnswer(i)}>
                  <span>{letters[i]}</span><b>{option}</b>{selected === i && <i>✓</i>}
                </button>
              ))}
            </div>
          </article>
          <div className="exam-nav">
            <button className="btn-secondary" disabled={exam.current === 0} onClick={() => onQuestion(exam.current - 1)}>← Previous</button>
            <span>{flagged ? 'Marked for review' : selected !== undefined ? 'Answer recorded' : 'Not answered'}</span>
            <button className="next-btn" disabled={exam.current === exam.questions.length - 1} onClick={() => onQuestion(exam.current + 1)}>Next →</button>
          </div>
        </main>

        <aside className="exam-palette">
          <div className="palette-head"><div><div className="section-label">QUESTION MAP</div><h3>Navigate</h3></div><span>{exam.questions.length}</span></div>
          <div className="palette-legend"><span><i className="legend-current" /> Current</span><span><i className="legend-done" /> Answered</span><span><i className="legend-flag" /> Review</span></div>
          <div className="palette-grid">
            {exam.questions.map((_, i) => <button key={i} className={`${i === exam.current ? 'current ' : ''}${exam.answers[i] !== undefined ? 'done ' : ''}${exam.flagged.includes(i) ? 'flagged' : ''}`} onClick={() => onQuestion(i)}>{i + 1}</button>)}
          </div>
          <div className="palette-summary"><b>{answered}</b> answered <span>·</span> <b>{exam.questions.length - answered}</b> remaining</div>
          <button className="exam-leave" onClick={onLeave}>Leave exam</button>
        </aside>
      </div>
    </section>
  );
}

function ExamResultsView({ exam, saved, onHome, onNewExam }: { exam: ExamState; saved: 'idle' | 'saving' | 'saved' | 'failed'; onHome: () => void; onNewExam: () => void }) {
  const correct = exam.questions.reduce((sum, q, i) => sum + (exam.answers[i] === q.correct_index ? 1 : 0), 0);
  const answered = Object.keys(exam.answers).length;
  const wrong = answered - correct;
  const skipped = exam.questions.length - answered;
  const pct = Math.round((correct / exam.questions.length) * 100);
  return (
    <section className="exam-results">
      <div className="exam-result-top"><button className="back-btn" onClick={onHome}>← Home</button><span className="exam-badge">EXAM COMPLETE</span></div>
      <div className="exam-result-hero">
        <div className="section-label">TIMED MOCK EXAM</div>
        <div className="exam-score-ring" style={{ '--score': `${pct}%` } as CSSProperties}><div><b>{pct}%</b><span>score</span></div></div>
        <h2>{pct >= 80 ? 'Strong performance.' : pct >= 60 ? 'Good attempt. Now review the gaps.' : 'This is useful data. Turn the misses into revision.'}</h2>
        <p>{exam.questions.length} questions · {exam.config.timeMinutes} minute limit · {exam.config.subjects.length === 1 ? displaySection(exam.config.subjects[0]) : 'Mixed subjects'}</p>
        {saved !== 'idle' && <div className={`save-status ${saved}`}>{saved === 'saving' ? 'Saving exam result…' : saved === 'saved' ? '✓ Exam result saved to your account' : 'Exam result could not be saved, but your score is here.'}</div>}
      </div>
      <div className="exam-result-stats">
        <div><span>Correct</span><b className="good-text">{correct}</b></div>
        <div><span>Wrong</span><b className="bad-text">{wrong}</b></div>
        <div><span>Skipped</span><b>{skipped}</b></div>
        <div><span>Accuracy</span><b>{pct}%</b></div>
      </div>
      <div className="results-actions exam-result-actions"><button className="next-btn" onClick={onNewExam}>Build another exam</button><button className="btn-secondary" onClick={onHome}>Back to dashboard</button></div>
      <div className="exam-result-note"><b>Review matters more than the number.</b><span>Your answers were kept private during the exam and corrections only appear after submission.</span></div>
    </section>
  );
}
