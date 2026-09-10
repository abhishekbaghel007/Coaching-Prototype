import { supabase } from '../lib/supabase';

export type StaffRole = 'teacher' | 'admin';
export type AdminStudent = { id: string; display_name: string | null; email: string | null; target_score: number; created_at: string; updated_at: string };
export type AdminAnswer = { id: string; user_id: string; question_id: string; selected_index: number; is_correct: boolean; subject: string; mode: string; answered_at: string };
export type AdminStudyAttempt = { id: string; user_id: string; title: string; mode: 'practice' | 'mock'; question_ids: string[]; answers: Record<string, number>; started_at: string; finished_at: string; duration_seconds: number; correct: number; incorrect: number; unanswered: number; dropped: number; score: number; created_at: string };
export type AdminDailyActivity = { user_id: string; activity_date: string; questions_answered: number; updated_at: string };
export type AdminQuestionState = { user_id: string; question_id: string; is_saved: boolean; is_mistake: boolean; note: string; updated_at: string };
export type Dpp = { id: string; title: string; description: string | null; scheduled_for: string; due_at: string | null; status: string; asset_path?: string | null; created_at: string };
export type DppQuestion = { id: string; dpp_id: string; question_id: string; position: number; points: number };

export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  const { data, error } = await supabase.from('teacher_roles').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.role === 'admin' || data?.role === 'teacher' ? data.role : null;
}

export async function loadAdminStudents(): Promise<AdminStudent[]> {
  const { data, error } = await supabase.from('profiles').select('id,display_name,email,target_score,created_at,updated_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminStudent[];
}

export async function loadAdminAnswers(userIds?: string[]): Promise<AdminAnswer[]> {
  let query = supabase.from('question_attempts').select('id,user_id,question_id,selected_index,is_correct,subject,mode,answered_at').order('answered_at', { ascending: false }).limit(10000);
  if (userIds?.length) query = query.in('user_id', userIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AdminAnswer[];
}

export async function loadAdminStudyAttempts(userId: string): Promise<AdminStudyAttempt[]> {
  const { data, error } = await supabase.from('study_attempts').select('id,user_id,title,mode,question_ids,answers,started_at,finished_at,duration_seconds,correct,incorrect,unanswered,dropped,score,created_at').eq('user_id', userId).order('finished_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row, question_ids: Array.isArray(row.question_ids) ? row.question_ids : [], answers: row.answers && typeof row.answers === 'object' ? row.answers : {} })) as AdminStudyAttempt[];
}

export async function loadAdminDailyActivity(userId: string): Promise<AdminDailyActivity[]> {
  const { data, error } = await supabase.from('daily_activity').select('user_id,activity_date,questions_answered,updated_at').eq('user_id', userId).order('activity_date', { ascending: true }).limit(730);
  if (error) throw error;
  return (data ?? []) as AdminDailyActivity[];
}

export async function loadAdminQuestionStates(userId: string): Promise<AdminQuestionState[]> {
  const { data, error } = await supabase.from('question_states').select('user_id,question_id,is_saved,is_mistake,note,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(10000);
  if (error) throw error;
  return (data ?? []) as AdminQuestionState[];
}

export async function loadDpps(): Promise<Dpp[]> {
  const { data, error } = await supabase.from('dpps').select('id,title,description,scheduled_for,due_at,status,asset_path,created_at').order('scheduled_for', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dpp[];
}

export async function loadDppQuestions(dppId: string): Promise<DppQuestion[]> {
  const { data, error } = await supabase.from('dpp_questions').select('id,dpp_id,question_id,position,points').eq('dpp_id', dppId).order('position');
  if (error) throw error;
  return (data ?? []) as DppQuestion[];
}

export async function createDpp(input: { title: string; description?: string; scheduledFor: string; dueAt?: string; questionIds: string[]; assetPath?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { data, error } = await supabase.from('dpps').insert({ title: input.title, description: input.description || null, scheduled_for: input.scheduledFor, due_at: input.dueAt || null, asset_path: input.assetPath || null, status: 'published', created_by: user.id }).select('id').single();
  if (error) throw error;
  const rows = input.questionIds.map((questionId, index) => ({ dpp_id: data.id, question_id: questionId, position: index + 1, points: 4 }));
  if (rows.length) {
    const { error: qError } = await supabase.from('dpp_questions').insert(rows);
    if (qError) throw qError;
  }
  return data.id as string;
}

export async function uploadTeacherAsset(file: File, folder = 'dpp-assets') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${user.id}/${folder}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('teacher-assets').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export async function createAnnouncement(title: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { error } = await supabase.from('teacher_announcements').insert({ title, body, created_by: user.id });
  if (error) throw error;
}
