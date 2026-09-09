export type Subject = 'Physics' | 'Chemistry' | 'Biology';

export type SubjectStats = Record<Subject, { attempted: number; correct: number; incorrect: number }>;

export type IntelligenceAction = 'repair' | 'practice' | 'progress';

export type IntelligenceResult = {
  subject: Subject | null;
  accuracy: number;
  attempted: number;
  recoveryMarks: number;
  headline: string;
  detail: string;
  action: IntelligenceAction;
  priority: 'high' | 'medium' | 'low';
};

export type RecoveryResult = {
  marks: number;
  mistakes: number;
  estimatedQuestions: number;
  subject: Subject | null;
  label: string;
  detail: string;
};

const SUBJECT_ORDER: Subject[] = ['Physics', 'Chemistry', 'Biology'];

function accuracyOf(stat: SubjectStats[Subject]) {
  return stat.attempted ? stat.correct / stat.attempted : 0;
}

export function rankSubjects(stats: SubjectStats) {
  return SUBJECT_ORDER
    .map(subject => ({
      subject,
      ...stats[subject],
      accuracy: Math.round(accuracyOf(stats[subject]) * 100),
    }))
    .filter(item => item.attempted > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);
}

export function buildPrepIntelligence(
  stats: SubjectStats,
  mistakesCount: number,
  today: number,
  dailyGoal: number,
  target: number,
): IntelligenceResult {
  const ranked = rankSubjects(stats);
  const weakest = ranked[0];
  const recoveryMarks = Math.min(100, mistakesCount * 5);
  const goalRemaining = Math.max(0, dailyGoal - today);

  if (!weakest) {
    return {
      subject: null,
      accuracy: 0,
      attempted: 0,
      recoveryMarks,
      headline: 'Build your first signal',
      detail: `Answer ${Math.max(5, goalRemaining || 10)} questions so NEETPrep can find your highest-value lane.`,
      action: 'practice',
      priority: 'medium',
    };
  }

  if (mistakesCount >= 3) {
    return {
      subject: weakest.subject,
      accuracy: weakest.accuracy,
      attempted: weakest.attempted,
      recoveryMarks,
      headline: `${weakest.subject} is your repair lane`,
      detail: `${weakest.subject} is at ${weakest.accuracy}% across ${weakest.attempted} attempts. Repair recent mistakes before adding more random questions.`,
      action: 'repair',
      priority: weakest.accuracy < 60 ? 'high' : 'medium',
    };
  }

  if (goalRemaining > 0) {
    return {
      subject: weakest.subject,
      accuracy: weakest.accuracy,
      attempted: weakest.attempted,
      recoveryMarks,
      headline: `Push ${weakest.subject} while the signal is clear`,
      detail: `${goalRemaining} questions remain today. A targeted ${weakest.subject} session is more useful than opening the full bank at random.`,
      action: 'practice',
      priority: 'medium',
    };
  }

  return {
    subject: weakest.subject,
    accuracy: weakest.accuracy,
    attempted: weakest.attempted,
    recoveryMarks,
    headline: "Protect today's progress",
    detail: `Your daily goal is complete. A short ${weakest.subject} precision session keeps the weakest signal from becoming tomorrow's problem.`,
    action: 'progress',
    priority: target >= 680 ? 'high' : 'low',
  };
}

export function buildScoreRecovery(
  stats: SubjectStats,
  mistakesCount: number,
): RecoveryResult {
  const ranked = rankSubjects(stats);
  const weakest = ranked[0];
  const marks = Math.min(100, mistakesCount * 5);
  const estimatedQuestions = Math.min(20, mistakesCount);

  if (!mistakesCount) {
    return {
      marks: 0,
      mistakes: 0,
      estimatedQuestions: 0,
      subject: weakest?.subject ?? null,
      label: 'No recovery queue yet',
      detail: 'Your mistake bank is empty. Keep solving and NEETPrep will build a repair queue from your misses.',
    };
  }

  const subjectText = weakest ? ` with ${weakest.subject} as the first lane` : '';
  return {
    marks,
    mistakes: mistakesCount,
    estimatedQuestions,
    subject: weakest?.subject ?? null,
    label: `${marks} marks are in play`,
    detail: `You have ${mistakesCount} recorded mistakes${subjectText}. Relearning even a portion of them can recover marks without increasing your total study volume.`,
  };
}
