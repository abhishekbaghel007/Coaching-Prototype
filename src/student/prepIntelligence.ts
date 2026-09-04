export type Subject = 'Physics' | 'Chemistry' | 'Biology';

export type SubjectStats = Record<Subject, { attempted: number; correct: number; incorrect: number }>;

export type IntelligenceResult = {
  subject: Subject | null;
  accuracy: number;
  attempted: number;
  recoveryMarks: number;
  headline: string;
  detail: string;
  action: 'repair' | 'practice' | 'progress';
};

export function buildPrepIntelligence(
  stats: SubjectStats,
  mistakesCount: number,
  today: number,
  dailyGoal: number,
  target: number,
): IntelligenceResult {
  const ranked = (Object.entries(stats) as Array<[Subject, SubjectStats[Subject]]>)
    .filter(([, s]) => s.attempted > 0)
    .sort((a, b) => {
      const accuracyA = a[1].correct / a[1].attempted;
      const accuracyB = b[1].correct / b[1].attempted;
      if (accuracyA !== accuracyB) return accuracyA - accuracyB;
      return b[1].attempted - a[1].attempted;
    });

  const weakest = ranked[0];
  const accuracy = weakest ? Math.round((weakest[1].correct / weakest[1].attempted) * 100) : 0;
  const recoveryMarks = Math.min(100, mistakesCount * 5);
  const goalRemaining = Math.max(0, dailyGoal - today);
  const targetGap = Math.max(0, target - 0);

  if (!weakest) {
    return {
      subject: null,
      accuracy: 0,
      attempted: 0,
      recoveryMarks,
      headline: 'Build your first signal',
      detail: `Answer ${Math.max(5, goalRemaining || 10)} questions so NEETPrep can start finding your highest-value repair lane.`,
      action: 'practice',
    };
  }

  if (mistakesCount >= 3) {
    return {
      subject: weakest[0],
      accuracy,
      attempted: weakest[1].attempted,
      recoveryMarks,
      headline: `${weakest[0]} is leaking marks`,
      detail: `${weakest[0]} is at ${accuracy}% across ${weakest[1].attempted} attempts. Repairing ${Math.min(10, mistakesCount)} recent mistakes is the fastest useful move.`,
      action: 'repair',
    };
  }

  if (goalRemaining > 0) {
    return {
      subject: weakest[0],
      accuracy,
      attempted: weakest[1].attempted,
      recoveryMarks,
      headline: `Push ${weakest[0]} while the signal is clear`,
      detail: `You're at ${accuracy}% in ${weakest[0]}. Finish today's ${goalRemaining} remaining questions with a targeted session instead of random practice.`,
      action: 'practice',
    };
  }

  return {
    subject: weakest[0],
    accuracy,
    attempted: weakest[1].attempted,
    recoveryMarks,
    headline: 'Your next gain is precision',
    detail: `Today's goal is complete. Your weakest lane is ${weakest[0]} at ${accuracy}%. A short repair session protects your progress toward ${targetGap || target}+ marks.`,
    action: 'progress',
  };
}
