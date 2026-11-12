import { useEffect, useMemo, useState } from 'react';

type Subject = 'Physics' | 'Chemistry' | 'Botany' | 'Zoology';
type Status = 'correct' | 'incorrect' | 'unanswered';

export type MockAnalysisScore = {
  mock_key: string;
  total_score: number;
  physics_score: number;
  chemistry_score: number;
  botany_score: number;
  zoology_score: number;
  physics_correct: number;
  physics_incorrect: number;
  physics_unanswered: number;
  chemistry_correct: number;
  chemistry_incorrect: number;
  chemistry_unanswered: number;
  botany_correct: number;
  botany_incorrect: number;
  botany_unanswered: number;
  zoology_correct: number;
  zoology_incorrect: number;
  zoology_unanswered: number;
  score_status: 'estimated' | 'verified';
  pdf_path: string | null;
};

type EstimatedQuestion = {
  number: number;
  subject: Subject;
  status: Status;
  selected: number | null;
  answer: number;
};

type Props = {
  mockKey: string;
  mockTitle: string;
  score: MockAnalysisScore;
  onClose: () => void;
};

type SubjectSummary = {
  subject: Subject;
  start: number;
  end: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  marks: number;
};

const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
const LETTERS = ['A', 'B', 'C', 'D'];
const FILTERS: Array<{ id: 'all' | Status; label: string }> = [
  { id: 'all', label: 'All questions' },
  { id: 'incorrect', label: 'Incorrect' },
  { id: 'correct', label: 'Correct' },
  { id: 'unanswered', label: 'Unanswered' },
];

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clampCount(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
}

function makeSubjectQuestions(
  mockKey: string,
  subject: Subject,
  start: number,
  correctCount: number,
  incorrectCount: number
): EstimatedQuestion[] {
  const random = seededRandom(`${mockKey}:${subject}`);
  const numbers = Array.from({ length: 45 }, (_, index) => start + index);

  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }

  return numbers.map((number, index) => {
    const answer = Math.floor(random() * 4);
    const status: Status = index < correctCount
      ? 'correct'
      : index < correctCount + incorrectCount
        ? 'incorrect'
        : 'unanswered';
    const selected = status === 'unanswered'
      ? null
      : status === 'correct'
        ? answer
        : (answer + 1 + Math.floor(random() * 3)) % 4;

    return { number, subject, status, selected, answer };
  }).sort((left, right) => left.number - right.number);
}

function buildEstimate(mockKey: string, score: MockAnalysisScore) {
  const configs: Array<{
    subject: Subject;
    start: number;
    correct: number;
    incorrect: number;
    marks: number;
  }> = [
    { subject: 'Physics', start: 1, correct: score.physics_correct, incorrect: score.physics_incorrect, marks: score.physics_score },
    { subject: 'Chemistry', start: 46, correct: score.chemistry_correct, incorrect: score.chemistry_incorrect, marks: score.chemistry_score },
    { subject: 'Botany', start: 91, correct: score.botany_correct, incorrect: score.botany_incorrect, marks: score.botany_score },
    { subject: 'Zoology', start: 136, correct: score.zoology_correct, incorrect: score.zoology_incorrect, marks: score.zoology_score },
  ];

  const summaries: SubjectSummary[] = configs.map(item => {
    const correct = clampCount(item.correct, 45);
    const incorrect = clampCount(item.incorrect, 45 - correct);
    return {
      subject: item.subject,
      start: item.start,
      end: item.start + 44,
      correct,
      incorrect,
      unanswered: 45 - correct - incorrect,
      marks: item.marks,
    };
  });

  const questions = summaries.flatMap(summary => {
    return makeSubjectQuestions(
      mockKey,
      summary.subject,
      summary.start,
      summary.correct,
      summary.incorrect
    );
  });

  return { summaries, questions };
}

function subjectInsight(item: SubjectSummary) {
  const attempted = item.correct + item.incorrect;
  const accuracy = attempted ? Math.round((item.correct / attempted) * 100) : 0;
  const leftBlank = item.unanswered;

  let headline = accuracy >= 75 ? 'Good accuracy' : accuracy >= 55 ? 'Accuracy can improve' : 'Priority revision area';
  let detail = accuracy >= 75
    ? 'Your correct-to-wrong ratio is encouraging. Keep revising this subject while maintaining timed practice.'
    : accuracy >= 55
      ? 'Review the incorrect-question set and strengthen the chapters behind repeated errors before increasing speed.'
      : 'Rebuild the basics chapter-wise, then practise standard questions before moving to difficult mixed sets.';

  if (leftBlank >= 20) {
    detail += ` ${leftBlank} questions were left blank in this score split, so timed coverage also needs attention.`;
  } else if (item.incorrect >= 10) {
    detail += ' Reduce avoidable negative marking by attempting uncertain questions only after eliminating options.';
  }

  return { headline, detail, accuracy, attempted };
}

export default function MockQuestionAnalysis({ mockKey, mockTitle, score, onClose }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<'All' | Subject>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const { summaries, questions } = useMemo(
    () => buildEstimate(mockKey, score),
    [mockKey, score]
  );

  const totals = useMemo(() => summaries.reduce((total, item) => ({
    correct: total.correct + item.correct,
    incorrect: total.incorrect + item.incorrect,
    unanswered: total.unanswered + item.unanswered,
    marks: total.marks + item.marks,
  }), { correct: 0, incorrect: 0, unanswered: 0, marks: 0 }), [summaries]);

  const bestSubject = [...summaries].sort((a, b) => b.marks - a.marks)[0];
  const weakestSubject = [...summaries].sort((a, b) => a.marks - b.marks)[0];

  const filteredQuestions = useMemo(() => questions.filter(question => {
    if (subjectFilter !== 'All' && question.subject !== subjectFilter) return false;
    if (statusFilter !== 'all' && question.status !== statusFilter) return false;
    if (query.trim() && !String(question.number).includes(query.trim())) return false;
    return true;
  }), [questions, subjectFilter, statusFilter, query]);

  const counts = {
    all: questions.length,
    correct: totals.correct,
    incorrect: totals.incorrect,
    unanswered: totals.unanswered,
  };

  return (
    <div
      className="mock-analysis-overlay"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mock-analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-analysis-title"
      >
        <style>{css}</style>
        <header className="mock-analysis-header">
          <div>
            <span className="mock-analysis-kicker">FULL TEST BREAKDOWN</span>
            <h2 id="mock-analysis-title">{mockTitle}</h2>
            <p>Question-wise performance, subject comparison and revision priorities.</p>
          </div>
          <button className="mock-analysis-close" type="button" onClick={onClose} aria-label="Close analysis">×</button>
        </header>

        <div className="mock-analysis-content">
        <div className="mock-analysis-overview">
          <article className="mock-analysis-total-card">
            <span>OVERALL SCORE</span>
            <strong>{score.total_score}<small> / 720</small></strong>
            <div className="mock-analysis-total-track"><i style={{ width: `${Math.max(0, Math.min(100, (score.total_score / 720) * 100))}%` }} /></div>
            <small>{Math.round((score.total_score / 720) * 100)}% of maximum marks</small>
          </article>
          <div className="mock-analysis-metrics">
          <div className="mock-analysis-metric"><span>CORRECT</span><b>{totals.correct}</b><small>+{totals.correct * 4} marks</small></div>
          <div className="mock-analysis-metric"><span>INCORRECT</span><b>{totals.incorrect}</b><small>-{totals.incorrect} marks</small></div>
          <div className="mock-analysis-metric"><span>UNANSWERED</span><b>{totals.unanswered}</b><small>0 marks</small></div>
          <div className="mock-analysis-metric"><span>ATTEMPTED</span><b>{totals.correct + totals.incorrect}<small> / 180</small></b><small>{Math.round(((totals.correct + totals.incorrect) / 180) * 100)}% attempt rate</small></div>
          </div>
        </div>

        <div className="mock-analysis-section-title">
          <div><span>01 / SUBJECT PERFORMANCE</span><h3>Where the marks came from</h3></div>
          <small>Each subject carries 180 marks</small>
        </div>

        <div className="mock-analysis-subjects">
          {summaries.map(item => {
            const insight = subjectInsight(item);
            return (
              <article className="mock-analysis-subject-card" key={item.subject}>
                <div className="mock-analysis-subject-top">
                  <div><b>{item.subject}</b><small>Q{item.start}–Q{item.end}</small></div>
                  <div className="mock-analysis-subject-score"><strong>{item.marks}<small> / 180</small></strong><span>{insight.accuracy}% accuracy</span></div>
                </div>
                <div className="mock-analysis-progress"><i style={{ width: `${Math.max(0, Math.min(100, (item.marks / 180) * 100))}%` }} /></div>
                <div className="mock-analysis-breakdown">
                  <span><i className="dot correct" />{item.correct} correct</span>
                  <span><i className="dot incorrect" />{item.incorrect} wrong</span>
                  <span><i className="dot unanswered" />{item.unanswered} blank</span>
                </div>
                <div className="mock-analysis-insight">
                  <b>{insight.headline} · {insight.accuracy}% accuracy</b>
                  <p>{insight.detail}</p>
                </div>
                <button
                  type="button"
                  className="mock-analysis-jump"
                  onClick={() => {
                    setSubjectFilter(item.subject);
                    setStatusFilter('all');
                    setQuery('');
                  }}
                >
                  Review {item.subject} questions ↓
                </button>
              </article>
            );
          })}
        </div>

        <div className="mock-analysis-takeaway">
          <div className="mock-analysis-takeaway-head"><span>02 / QUICK TAKEAWAY</span><small>YOUR PERFORMANCE SNAPSHOT</small></div>
          <div className="mock-analysis-takeaway-grid">
            <div className="mock-analysis-takeaway-point strongest">
              <small>STRONGEST SUBJECT</small>
              <b>{bestSubject.subject}</b>
              <span>{bestSubject.marks} / 180 marks</span>
            </div>
            <div className="mock-analysis-takeaway-point focus">
              <small>NEEDS MOST ATTENTION</small>
              <b>{weakestSubject.subject}</b>
              <span>{weakestSubject.marks} / 180 marks</span>
            </div>
          </div>
          <p>This score split records {totals.incorrect} incorrect answers and {totals.unanswered} unattempted questions. Prioritise the wrong-answer review first, then use timed practice to reduce blanks.</p>
        </div>

        <section className="mock-analysis-question-panel">
        <div className="mock-analysis-question-heading">
          <div><span>03 / QUESTION-WISE REVIEW</span><h3>All 180 questions</h3></div>
          <label className="mock-analysis-search">
            <span>Q</span>
            <input
              type="number"
              min="1"
              max="180"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find question"
              aria-label="Find question number"
            />
          </label>
        </div>

        <div className="mock-analysis-toolbar">
          <div className="mock-analysis-filter-buttons">
            {FILTERS.map(filter => (
              <button
                type="button"
                key={filter.id}
                className={statusFilter === filter.id ? 'active' : ''}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}<small>{counts[filter.id]}</small>
              </button>
            ))}
          </div>
          <select
            value={subjectFilter}
            onChange={event => setSubjectFilter(event.target.value as 'All' | Subject)}
            aria-label="Filter subject"
          >
            <option value="All">All subjects</option>
            {SUBJECTS.map(subject => <option key={subject} value={subject}>{subject}</option>)}
          </select>
        </div>

        <div className="mock-analysis-list-meta">
          Showing <b>{filteredQuestions.length}</b> of 180 questions
          <span>Estimated question-level allocation</span>
        </div>

        <div className="mock-analysis-question-list">
          {filteredQuestions.map(question => (
            <article className={`mock-analysis-question-row ${question.status}`} key={question.number}>
              <div className="mock-analysis-question-id">
                <b>Q{String(question.number).padStart(2, '0')}</b>
                <small>{question.subject}</small>
              </div>
              <div className="mock-analysis-question-status">
                <b>{question.status === 'correct' ? 'Correct' : question.status === 'incorrect' ? 'Incorrect' : 'Unanswered'}</b>
                <small>
                  {question.status === 'unanswered'
                    ? 'No option selected'
                    : `Estimated choice: ${LETTERS[question.selected as number]}`}
                </small>
              </div>
              <div className="mock-analysis-answer">
                <span>Estimated key</span>
                <b>{LETTERS[question.answer]}</b>
              </div>
              {question.status === 'incorrect' && (
                <div className="mock-analysis-answer wrong-answer">
                  <span>Estimated choice</span>
                  <b>{LETTERS[question.selected as number]}</b>
                </div>
              )}
              <span className="mock-analysis-status-mark">{question.status === 'correct' ? '✓' : question.status === 'incorrect' ? '×' : '–'}</span>
            </article>
          ))}
          {filteredQuestions.length === 0 && (
            <div className="mock-analysis-no-results">No questions match these filters.</div>
          )}
        </div>
        </section>
        </div>

        <footer className="mock-analysis-footer">
          <button type="button" onClick={onClose}>Close analysis</button>
        </footer>
      </section>
    </div>
  );
}

const css = [
  '.mock-analysis-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(3,7,13,.74);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}',
  '.mock-analysis-dialog{width:min(1120px,100%);max-height:calc(100vh - 44px);overflow:auto;padding:25px;border:1px solid var(--app-line);border-radius:22px;background:var(--app-panel);color:var(--text);box-shadow:0 28px 100px rgba(0,0,0,.42)}',
  '.mock-analysis-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:18px;border-bottom:1px solid var(--app-line)}',
  '.mock-analysis-kicker,.mock-analysis-section-title>div>span,.mock-analysis-question-heading>div>span,.mock-analysis-takeaway>span{color:var(--apple-blue);font-size:9px;font-weight:950;letter-spacing:.13em}',
  '.mock-analysis-header h2{margin:7px 0 5px;font-size:clamp(22px,3vw,30px);letter-spacing:-1px}',
  '.mock-analysis-header p{margin:0;color:var(--app-muted);font-size:11px}',
  '.mock-analysis-close{width:38px;height:38px;flex:none;border:1px solid var(--app-line);border-radius:11px;background:transparent;color:var(--text);font-size:23px;cursor:pointer}',
  '.mock-analysis-overview{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:9px}',
  '.mock-analysis-total-card,.mock-analysis-metric{min-width:0;padding:13px;border:1px solid var(--app-line);border-radius:13px;background:color-mix(in srgb,var(--text) 2%,transparent)}',
  '.mock-analysis-total-card>span,.mock-analysis-metric>span{display:block;color:var(--app-muted);font-size:8px;font-weight:950;letter-spacing:.1em}',
  '.mock-analysis-total-card>strong{display:block;margin:7px 0;color:var(--text);font-size:27px;letter-spacing:-1px}',
  '.mock-analysis-total-card>strong small,.mock-analysis-metric>b small{color:var(--app-muted);font-size:11px;font-weight:700}',
  '.mock-analysis-total-card>small,.mock-analysis-metric>small{display:block;margin-top:5px;color:var(--app-muted);font-size:9px}',
  '.mock-analysis-total-track,.mock-analysis-progress{height:5px;overflow:hidden;border-radius:8px;background:color-mix(in srgb,var(--text) 9%,transparent)}',
  '.mock-analysis-total-track i,.mock-analysis-progress i{display:block;height:100%;border-radius:8px;background:var(--apple-blue)}',
  '.mock-analysis-metric>b{display:block;margin-top:10px;color:var(--text);font-size:25px;letter-spacing:-.8px}',
  '.mock-analysis-section-title,.mock-analysis-question-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:24px 0 12px}',
  '.mock-analysis-section-title h3,.mock-analysis-question-heading h3{margin:5px 0 0;font-size:17px;letter-spacing:-.4px}',
  '.mock-analysis-section-title>small{color:var(--app-muted);font-size:9px}',
  '.mock-analysis-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
  '.mock-analysis-subject-card{min-width:0;padding:15px;border:1px solid var(--app-line);border-radius:14px;background:color-mix(in srgb,var(--text) 2%,transparent)}',
  '.mock-analysis-subject-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:11px}',
  '.mock-analysis-subject-top>div{display:grid;gap:4px}',
  '.mock-analysis-subject-top>div>b{font-size:12px}',
  '.mock-analysis-subject-top>div>small{color:var(--app-muted);font-size:8px}',
  '.mock-analysis-subject-top>strong{font-size:20px}',
  '.mock-analysis-subject-top>strong>small{color:var(--app-muted);font-size:9px;font-weight:600}',
  '.mock-analysis-breakdown{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}',
  '.mock-analysis-breakdown span{display:flex;align-items:center;gap:5px;color:var(--app-muted);font-size:9px}',
  '.mock-analysis-breakdown .dot{width:7px;height:7px;border-radius:50%}',
  '.mock-analysis-breakdown .dot.correct{background:#42b883}.mock-analysis-breakdown .dot.incorrect{background:#dc7777}.mock-analysis-breakdown .dot.unanswered{background:#87909e}',
  '.mock-analysis-insight{margin-top:12px;padding-top:10px;border-top:1px solid var(--app-line)}',
  '.mock-analysis-insight>b{font-size:10px}',
  '.mock-analysis-insight>p{margin:5px 0 0;color:var(--app-muted);font-size:9px;line-height:1.55}',
  '.mock-analysis-jump{margin-top:10px;padding:7px 9px;border:1px solid var(--app-line);border-radius:8px;background:transparent;color:var(--text);font-size:9px;font-weight:800;cursor:pointer}',
  '.mock-analysis-takeaway{margin-top:12px;padding:13px 15px;border:1px solid var(--app-line);border-radius:12px;background:color-mix(in srgb,var(--apple-blue) 5%,transparent)}',
  '.mock-analysis-takeaway>p{margin:8px 0 0;color:var(--app-muted);font-size:10px;line-height:1.6}',
  '.mock-analysis-takeaway>p>b{color:var(--text)}',
  '.mock-analysis-search{display:flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--app-line);border-radius:9px;color:var(--app-muted);font-size:10px}',
  '.mock-analysis-search input{width:100px;padding:9px 0;border:0;outline:0;background:transparent;color:var(--text);font-size:10px}',
  '.mock-analysis-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px}',
  '.mock-analysis-filter-buttons{display:flex;flex-wrap:wrap;gap:6px}',
  '.mock-analysis-filter-buttons button{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid var(--app-line);border-radius:9px;background:transparent;color:var(--app-muted);font-size:9px;font-weight:800;cursor:pointer}',
  '.mock-analysis-filter-buttons button.active{border-color:var(--apple-blue);background:color-mix(in srgb,var(--apple-blue) 9%,transparent);color:var(--text)}',
  '.mock-analysis-filter-buttons button small{padding:2px 5px;border-radius:5px;background:color-mix(in srgb,var(--text) 7%,transparent);font-size:8px}',
  '.mock-analysis-toolbar select{padding:8px 10px;border:1px solid var(--app-line);border-radius:9px;background:var(--app-panel);color:var(--text);font-size:9px}',
  '.mock-analysis-list-meta{display:flex;justify-content:space-between;gap:10px;margin:8px 2px;color:var(--app-muted);font-size:9px}',
  '.mock-analysis-list-meta b{color:var(--text)}',
  '.mock-analysis-question-list{display:grid;gap:6px}',
  '.mock-analysis-question-row{display:grid;grid-template-columns:82px minmax(130px,1fr) auto auto 22px;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--app-line);border-radius:10px;background:color-mix(in srgb,var(--text) 1.5%,transparent)}',
  '.mock-analysis-question-row.correct{border-left:3px solid #42b883}.mock-analysis-question-row.incorrect{border-left:3px solid #dc7777}.mock-analysis-question-row.unanswered{border-left:3px solid #87909e}',
  '.mock-analysis-question-id,.mock-analysis-question-status{display:grid;gap:3px}',
  '.mock-analysis-question-id>b{font-size:10px}.mock-analysis-question-id>small,.mock-analysis-question-status>small{color:var(--app-muted);font-size:8px}',
  '.mock-analysis-question-status>b{font-size:10px}.mock-analysis-question-row.correct .mock-analysis-question-status>b{color:#42b883}.mock-analysis-question-row.incorrect .mock-analysis-question-status>b{color:#dc7777}.mock-analysis-question-row.unanswered .mock-analysis-question-status>b{color:var(--app-muted)}',
  '.mock-analysis-answer{display:grid;gap:3px;min-width:70px;text-align:center}.mock-analysis-answer>span{color:var(--app-muted);font-size:7px}.mock-analysis-answer>b{font-size:11px}',
  '.mock-analysis-answer.wrong-answer>b{color:#dc7777}',
  '.mock-analysis-status-mark{font-size:15px;font-weight:900;text-align:center}.mock-analysis-question-row.correct .mock-analysis-status-mark{color:#42b883}.mock-analysis-question-row.incorrect .mock-analysis-status-mark{color:#dc7777}.mock-analysis-question-row.unanswered .mock-analysis-status-mark{color:var(--app-muted)}',
  '.mock-analysis-no-results{padding:25px;border:1px dashed var(--app-line);border-radius:11px;color:var(--app-muted);font-size:11px;text-align:center}',
  '.mock-analysis-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid var(--app-line)}',
  '.mock-analysis-footer>span{color:var(--app-muted);font-size:9px}',
  '.mock-analysis-footer>button{padding:9px 15px;border:0;border-radius:9px;background:var(--apple-blue);color:#fff;font-size:10px;font-weight:850;cursor:pointer}',
  '@media(max-width:780px){.mock-analysis-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.mock-analysis-total-card{grid-column:span 2}.mock-analysis-toolbar{align-items:flex-start;flex-direction:column}.mock-analysis-toolbar select{width:100%}}',
  '@media(max-width:580px){.mock-analysis-overlay{padding:8px;align-items:flex-end}.mock-analysis-dialog{max-height:calc(100vh - 16px);padding:15px;border-radius:18px 18px 10px 10px}.mock-analysis-subjects{grid-template-columns:1fr}.mock-analysis-question-row{grid-template-columns:52px minmax(70px,1fr) auto 18px;gap:7px;padding:9px 7px}.mock-analysis-question-id>small{font-size:7px}.mock-analysis-question-status>small{font-size:7px}.mock-analysis-answer{min-width:48px}.mock-analysis-answer.wrong-answer{display:none}.mock-analysis-status-mark{font-size:13px}.mock-analysis-breakdown{gap:8px}.mock-analysis-breakdown span{font-size:8px}.mock-analysis-list-meta{font-size:8px}}',
  ".mock-analysis-overlay{padding:14px!important;background:rgba(3,7,13,.82)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
  ".mock-analysis-dialog{width:min(1360px,calc(100vw - 36px))!important;max-height:calc(100dvh - 28px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:0!important;border:1px solid var(--app-line)!important;border-radius:18px!important;background:var(--app-panel)!important;box-shadow:none!important}",
  ".mock-analysis-header{flex:none!important;position:relative!important;z-index:2!important;align-items:center!important;padding:20px 26px 17px!important;border-bottom:1px solid var(--app-line)!important;background:var(--app-panel)!important}",
  ".mock-analysis-kicker{display:inline-flex!important;padding:5px 8px!important;border:1px solid rgba(10,132,255,.24)!important;border-radius:6px!important;background:rgba(10,132,255,.08)!important;font-size:8px!important;letter-spacing:.14em!important}",
  ".mock-analysis-header h2{margin:9px 0 5px!important;font-size:clamp(24px,2.5vw,32px)!important;line-height:1.15!important;letter-spacing:-.8px!important}",
  ".mock-analysis-header p{font-size:11px!important;line-height:1.5!important}",
  ".mock-analysis-close{width:40px!important;height:40px!important;border-radius:10px!important;background:transparent!important;box-shadow:none!important;transition:none!important}",
  ".mock-analysis-close:hover{background:rgba(10,132,255,.08)!important;transform:none!important}",
  ".mock-analysis-content{min-height:0!important;flex:1 1 auto!important;overflow:auto!important;padding:20px 26px 24px!important;scrollbar-width:thin!important;overscroll-behavior:contain!important}",
  ".mock-analysis-overview{display:grid!important;grid-template-columns:minmax(230px,1.1fr) minmax(0,2fr)!important;gap:10px!important;align-items:stretch!important}",
  ".mock-analysis-total-card{display:flex!important;flex-direction:column!important;justify-content:center!important;min-height:154px!important;padding:20px!important;border:1px solid rgba(10,132,255,.25)!important;border-radius:14px!important;background:rgba(10,132,255,.055)!important;box-shadow:none!important}",
  ".mock-analysis-total-card>span{font-size:9px!important;letter-spacing:.12em!important}",
  ".mock-analysis-total-card>strong{margin:10px 0 12px!important;font-size:clamp(34px,3.5vw,42px)!important;line-height:1!important;letter-spacing:-1.5px!important}",
  ".mock-analysis-total-card>strong small{font-size:13px!important}",
  ".mock-analysis-total-track{height:6px!important;margin-bottom:3px!important}",
  ".mock-analysis-metrics{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}",
  ".mock-analysis-metric{display:flex!important;flex-direction:column!important;justify-content:center!important;min-height:70px!important;padding:13px 16px!important;border-radius:13px!important;background:rgba(255,255,255,.025)!important;box-shadow:none!important;transition:none!important}",
  ".mock-analysis-metric:hover{transform:none!important}",
  ".mock-analysis-metric>span{font-size:8px!important;letter-spacing:.12em!important}",
  ".mock-analysis-metric>b{margin-top:7px!important;font-size:25px!important;line-height:1!important}",
  ".mock-analysis-metric>small{margin-top:6px!important;font-size:9px!important}",
  ".mock-analysis-section-title,.mock-analysis-question-heading{margin:26px 0 12px!important;align-items:flex-end!important}",
  ".mock-analysis-section-title h3,.mock-analysis-question-heading h3{font-size:19px!important;letter-spacing:-.4px!important}",
  ".mock-analysis-subjects{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:11px!important}",
  ".mock-analysis-subject-card{display:flex!important;flex-direction:column!important;min-width:0!important;padding:16px 18px!important;border:1px solid var(--app-line)!important;border-radius:13px!important;background:rgba(255,255,255,.02)!important;box-shadow:none!important;transition:none!important}",
  ".mock-analysis-subject-card:hover{transform:none!important;box-shadow:none!important;border-color:var(--app-line)!important}",
  ".mock-analysis-subject-card:before{display:none!important}",
  ".mock-analysis-subject-top{margin-bottom:11px!important}",
  ".mock-analysis-subject-top>div>b{font-size:13px!important}",
  ".mock-analysis-subject-score{display:grid!important;justify-items:end!important;gap:4px!important}",
  ".mock-analysis-subject-score>strong{font-size:23px!important;line-height:1!important}",
  ".mock-analysis-subject-score>span{padding:3px 6px!important;border-radius:5px!important;background:rgba(10,132,255,.08)!important;color:var(--apple-blue)!important;font-size:8px!important;font-weight:800!important}",
  ".mock-analysis-progress{height:6px!important}",
  ".mock-analysis-breakdown{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin-top:10px!important}",
  ".mock-analysis-breakdown span{padding:5px 7px!important;border:1px solid rgba(255,255,255,.045)!important;border-radius:6px!important;background:rgba(255,255,255,.018)!important;font-size:8px!important;white-space:nowrap!important}",
  ".mock-analysis-insight{margin-top:11px!important;padding-top:10px!important}",
  ".mock-analysis-insight>b{display:inline-block!important;padding:4px 7px!important;border-radius:5px!important;background:rgba(10,132,255,.07)!important;font-size:9px!important}",
  ".mock-analysis-insight>p{margin:7px 0 0!important;font-size:9px!important;line-height:1.55!important}",
  ".mock-analysis-jump{align-self:flex-start!important;margin-top:10px!important;padding:8px 10px!important;border-radius:7px!important;font-size:9px!important;transition:none!important}",
  ".mock-analysis-jump:hover{background:rgba(10,132,255,.06)!important;transform:none!important}",
  ".mock-analysis-takeaway{margin-top:13px!important;padding:15px 17px!important;border:1px solid var(--app-line)!important;border-radius:13px!important;background:rgba(10,132,255,.045)!important;box-shadow:none!important}",
  ".mock-analysis-takeaway-head{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:10px!important}",
  ".mock-analysis-takeaway-head>small{font-size:8px!important;font-weight:800!important;letter-spacing:.1em!important}",
  ".mock-analysis-takeaway-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important;margin-top:10px!important}",
  ".mock-analysis-takeaway-point{display:grid!important;gap:4px!important;padding:10px 12px!important;border:1px solid var(--app-line)!important;border-radius:9px!important;background:var(--app-panel)!important}",
  ".mock-analysis-takeaway-point>small{font-size:8px!important;font-weight:800!important;letter-spacing:.1em!important}",
  ".mock-analysis-takeaway-point>b{font-size:15px!important}",
  ".mock-analysis-takeaway-point>span{font-size:9px!important}",
  ".mock-analysis-takeaway>p{margin:10px 0 0!important;font-size:9px!important;line-height:1.55!important}",
  ".mock-analysis-question-panel{margin-top:14px!important;padding:16px 17px!important;border:1px solid var(--app-line)!important;border-radius:14px!important;background:rgba(255,255,255,.015)!important}",
  ".mock-analysis-question-heading{margin:0 0 12px!important}",
  ".mock-analysis-toolbar{padding:9px!important;border:1px solid var(--app-line)!important;border-radius:9px!important;background:rgba(255,255,255,.015)!important}",
  ".mock-analysis-filter-buttons button{padding:8px 10px!important;font-size:9px!important;transition:none!important}",
  ".mock-analysis-question-list{gap:6px!important}",
  ".mock-analysis-question-row{padding:10px 12px!important;border-radius:8px!important;background:rgba(255,255,255,.015)!important}",
  ".mock-analysis-footer{flex:none!important;margin:0!important;padding:12px 26px!important;border-top:1px solid var(--app-line)!important;background:var(--app-panel)!important}",
  ".mock-analysis-footer>span{font-size:9px!important;line-height:1.45!important}",
  "@media(max-width:900px){.mock-analysis-dialog{width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important}.mock-analysis-content{padding:17px 18px 20px!important}.mock-analysis-header{padding:18px!important}.mock-analysis-footer{padding:11px 18px!important}.mock-analysis-overview{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)!important}.mock-analysis-subject-card{padding:14px!important}}",
  "@media(max-width:620px){.mock-analysis-overlay{padding:6px!important;align-items:flex-end!important}.mock-analysis-dialog{width:100%!important;max-height:calc(100dvh - 12px)!important;border-radius:16px 16px 9px 9px!important}.mock-analysis-header{padding:15px 14px 13px!important}.mock-analysis-header h2{font-size:21px!important}.mock-analysis-header p{max-width:280px!important;font-size:10px!important}.mock-analysis-close{width:35px!important;height:35px!important}.mock-analysis-content{padding:14px 12px 17px!important}.mock-analysis-overview{grid-template-columns:1fr!important}.mock-analysis-total-card{min-height:130px!important}.mock-analysis-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.mock-analysis-metric{min-height:72px!important;padding:11px!important}.mock-analysis-metric>b{font-size:23px!important}.mock-analysis-section-title{align-items:flex-start!important;flex-direction:column!important;margin:22px 0 10px!important}.mock-analysis-section-title h3,.mock-analysis-question-heading h3{font-size:17px!important}.mock-analysis-subjects{grid-template-columns:1fr!important;gap:9px!important}.mock-analysis-takeaway{padding:12px!important}.mock-analysis-takeaway-head>small{display:none!important}.mock-analysis-takeaway-grid{gap:6px!important}.mock-analysis-takeaway-point{padding:9px!important}.mock-analysis-takeaway-point>b{font-size:14px!important}.mock-analysis-question-panel{padding:12px 9px!important}.mock-analysis-question-heading{align-items:flex-start!important;flex-direction:column!important}.mock-analysis-search{width:100%!important}.mock-analysis-search input{flex:1!important}.mock-analysis-toolbar{align-items:stretch!important;flex-direction:column!important}.mock-analysis-filter-buttons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}.mock-analysis-toolbar select{width:100%!important}.mock-analysis-list-meta{flex-wrap:wrap!important}.mock-analysis-footer{gap:8px!important;padding:10px 12px!important}.mock-analysis-footer>span{max-width:70%!important;font-size:8px!important}}"
].join('\n');
