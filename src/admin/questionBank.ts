import { supabase } from '../lib/supabase';

export type TeacherQuestion = {
  id?: string;
  question: string;
  options: string[];
  correct_index: number | null;
  subject: 'Physics' | 'Chemistry' | 'Biology';
  chapter: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  explanation: string;
  source_name?: string | null;
  source_type: 'manual' | 'word' | 'paste';
};

const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\r/g, '').trim();
const questionStart = (line: string) => /^(?:Q(?:uestion)?\s*)?\d+\s*[.)]/i.test(line.trim());
const stripQuestionNumber = (line: string) => clean(line).replace(/^(?:Q(?:uestion)?\s*)?\d+\s*[.)]\s*/i, '');
const optionMatch = (line: string) => clean(line).match(/^\s*(?:\(?([A-D])\)?|([1-4]))\s*[.)\-:]\s*(.+)$/i);
const answerMatch = (line: string) => {
  const m = clean(line).match(/^(?:correct\s*)?(?:answer|ans|key)\s*[:\-]?\s*(?:option\s*)?\(?([A-D1-4])\)?/i);
  if (!m) return null;
  const raw = m[1].toUpperCase();
  return /[A-D]/.test(raw) ? raw.charCodeAt(0) - 65 : Number(raw) - 1;
};

export function parseQuestionText(text: string, sourceType: TeacherQuestion['source_type'] = 'paste'): TeacherQuestion[] {
  const lines = text.split('\n').map(clean).filter(Boolean);
  const starts = lines.map((line, index) => questionStart(line) ? index : -1).filter(index => index >= 0);
  const chunks: string[][] = starts.length
    ? starts.map((start, i) => lines.slice(start, starts[i + 1] ?? lines.length))
    : [lines];

  return chunks.map(chunk => {
    const answerLine = chunk.find(line => answerMatch(line) !== null);
    const body = chunk.filter(line => answerMatch(line) === null);
    const options = ['', '', '', ''];
    const questionLines: string[] = [];
    let readingOptions = false;
    for (const line of body) {
      const option = optionMatch(line);
      if (option) {
        readingOptions = true;
        const index = option[2] ? Number(option[2]) - 1 : option[1].toUpperCase().charCodeAt(0) - 65;
        if (index >= 0 && index < 4) options[index] = clean(option[3]);
        continue;
      }
      if (!readingOptions) questionLines.push(questionLines.length === 0 ? stripQuestionNumber(line) : line);
    }
    return {
      question: clean(questionLines.join(' ')),
      options,
      correct_index: answerLine ? answerMatch(answerLine) : null,
      subject: 'Physics', chapter: '', topic: '', difficulty: 'Medium', explanation: '', source_type: sourceType,
    } as TeacherQuestion;
  }).filter(item => item.question.length > 8 && item.options.filter(Boolean).length >= 2);
}

export function applyAnswerKey(items: TeacherQuestion[], keyText: string) {
  const answers = new Map<number, number>();
  for (const match of keyText.matchAll(/(?:Q\s*)?(\d+)\s*[-.:)]\s*([A-D1-4])/gi)) {
    const q = Number(match[1]) - 1;
    const raw = match[2].toUpperCase();
    answers.set(q, /[A-D]/.test(raw) ? raw.charCodeAt(0) - 65 : Number(raw) - 1);
  }
  return items.map((item, index) => answers.has(index) ? { ...item, correct_index: answers.get(index)! } : item);
}

export async function importWordQuestions(file: File) {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { questions: parseQuestionText(result.value, 'word'), warnings: result.messages.filter(message => message.type === 'warning').map(message => message.message) };
}

export async function saveTeacherQuestions(questions: TeacherQuestion[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your teacher session has expired.');
  const rows = questions.map(question => ({
    question: question.question, options: question.options, correct_index: question.correct_index,
    subject: question.subject, chapter: question.chapter || null, topic: question.topic || null,
    difficulty: question.difficulty, explanation: question.explanation || null, source_name: question.source_name || null,
    source_type: question.source_type, created_by: user.id,
  }));
  const { data, error } = await supabase.from('teacher_questions').insert(rows).select('id');
  if (error) throw error;
  return data ?? [];
}

export async function loadTeacherQuestions() {
  const { data, error } = await supabase.from('teacher_questions').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeacherQuestion[];
}
