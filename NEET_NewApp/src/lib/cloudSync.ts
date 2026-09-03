import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type CloudQuestionState = {
  question_id: string;
  is_saved: boolean;
  is_mistake: boolean;
  note: string;
};

export type CloudAttempt = {
  id: string;
  title: string;
  mode: 'practice' | 'mock';
  question_ids: string[];
  answers: Record<string, number>;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  dropped: number;
  score: number;
};

export type CloudSnapshot = {
  saved: string[];
  mistakes: string[];
  notes: Record<string, string>;
  daily: Record<string, number>;
  target: number;
  results: Array<CloudAttempt & { id: string }>;
  theme?: string | null;
  appearance?: 'dark' | 'light' | null;
};

export function cloudEnabled() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY));
}

export async function loadCloudSnapshot(user: User): Promise<CloudSnapshot | null> {
  if (!cloudEnabled()) return null;

  const [profileRes, statesRes, attemptsRes, dailyRes] = await Promise.all([
    supabase.from('profiles').select('target_score, accent_theme, appearance').eq('id', user.id).maybeSingle(),
    supabase.from('question_states').select('question_id, is_saved, is_mistake, note').eq('user_id', user.id),
    supabase.from('study_attempts').select('*').eq('user_id', user.id).order('finished_at', { ascending: false }).limit(100),
    supabase.from('daily_activity').select('activity_date, questions_answered').eq('user_id', user.id),
  ]);

  const firstError = [profileRes.error, statesRes.error, attemptsRes.error, dailyRes.error].find(Boolean);
  if (firstError) throw firstError;

  const states = (statesRes.data ?? []) as CloudQuestionState[];
  const saved = states.filter(s => s.is_saved).map(s => s.question_id);
  const mistakes = states.filter(s => s.is_mistake).map(s => s.question_id);
  const notes: Record<string, string> = {};
  states.forEach(s => { if (s.note) notes[s.question_id] = s.note; });

  const daily: Record<string, number> = {};
  (dailyRes.data ?? []).forEach((row: { activity_date: string; questions_answered: number }) => {
    daily[row.activity_date] = row.questions_answered;
  });

  const results = ((attemptsRes.data ?? []) as CloudAttempt[]).map(a => ({ ...a, id: a.id }));
  const profile = profileRes.data as { target_score?: number | null; accent_theme?: string | null; appearance?: 'dark' | 'light' | null } | null;

  return {
    saved,
    mistakes,
    notes,
    daily,
    target: profile?.target_score ?? 30,
    results,
    theme: profile?.accent_theme,
    appearance: profile?.appearance,
  };
}

export async function upsertProfile(user: User, values: { target?: number; theme?: string; appearance?: 'dark' | 'light' }) {
  if (!cloudEnabled()) return;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student',
    target_score: values.target,
    accent_theme: values.theme,
    appearance: values.appearance,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function syncQuestionStates(user: User, saved: string[], mistakes: string[], notes: Record<string, string>) {
  if (!cloudEnabled()) return;
  const ids = new Set([...saved, ...mistakes, ...Object.keys(notes)]);
  const rows = Array.from(ids).map(question_id => ({
    user_id: user.id,
    question_id,
    is_saved: saved.includes(question_id),
    is_mistake: mistakes.includes(question_id),
    note: notes[question_id] ?? '',
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('question_states').upsert(rows, { onConflict: 'user_id,question_id' });
  if (error) throw error;
}

export async function syncDailyActivity(user: User, daily: Record<string, number>) {
  if (!cloudEnabled()) return;
  const rows = Object.entries(daily).map(([activity_date, questions_answered]) => ({
    user_id: user.id,
    activity_date,
    questions_answered,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('daily_activity').upsert(rows, { onConflict: 'user_id,activity_date' });
  if (error) throw error;
}

export async function syncAttempt(user: User, attempt: CloudAttempt) {
  if (!cloudEnabled()) return;
  const { error } = await supabase.from('study_attempts').upsert({
    id: attempt.id,
    user_id: user.id,
    title: attempt.title,
    mode: attempt.mode,
    question_ids: attempt.question_ids,
    answers: attempt.answers,
    started_at: attempt.started_at,
    finished_at: attempt.finished_at,
    duration_seconds: attempt.duration_seconds,
    correct: attempt.correct,
    incorrect: attempt.incorrect,
    unanswered: attempt.unanswered,
    dropped: attempt.dropped,
    score: attempt.score,
  }, { onConflict: 'id' });
  if (error) throw error;
}
