import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type MockSeriesPaper = {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  onlineOnly?: boolean;
  questionIds: string[];
};

type MockSeriesScore = {
  mock_key: string;
  total_score: number;
  physics_score: number;
  chemistry_score: number;
  biology_score: number;
  physics_correct: number;
  physics_incorrect: number;
  physics_unanswered: number;
  chemistry_correct: number;
  chemistry_incorrect: number;
  chemistry_unanswered: number;
  biology_correct: number;
  biology_incorrect: number;
  biology_unanswered: number;
  score_status: 'provisional' | 'verified';
};

export const MOCK_TEST_SERIES: MockSeriesPaper[] = [
  { id: 'neet-level-2026-08-09', title: 'NEET Level Test – 09-Aug', date: '2026-08-09', dateLabel: '9 Aug 2026', questionIds: [] },
  { id: 'neet-level-2026-09-06', title: 'NEET Level Test – 06-Sep', date: '2026-09-06', dateLabel: '6 Sep 2026', questionIds: [] },
  { id: 'neet-level-2026-09-23', title: 'NEET Level Test – 23-Sep', date: '2026-09-23', dateLabel: '23 Sep 2026', onlineOnly: true, questionIds: [] },
  { id: 'neet-level-2026-09-27', title: 'NEET Level Test – 27-Sep', date: '2026-09-27', dateLabel: '27 Sep 2026', questionIds: [] },
  { id: 'neet-level-2026-10-11', title: 'NEET Level Test – 11-Oct', date: '2026-10-11', dateLabel: '11 Oct 2026', questionIds: [] },
  { id: 'neet-level-2026-10-25', title: 'NEET Level Test – 25-Oct', date: '2026-10-25', dateLabel: '25 Oct 2026', questionIds: [] },
  { id: 'neet-level-2026-11-05', title: 'NEET Level Test – 05-Nov', date: '2026-11-05', dateLabel: '5 Nov 2026', questionIds: [] },
];

type Props = {
  onAttempt: (paper: MockSeriesPaper) => void;
};

export default function MockTestSeries({ onAttempt }: Props) {
  const [scores, setScores] = useState<Record<string, MockSeriesScore>>({});
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoreLoadFailed, setScoreLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadScores = async (userId: string | null) => {
      if (!userId) {
        if (active) {
          setScores({});
          setScoresLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('mock_series_scores')
        .select('mock_key,total_score,physics_score,chemistry_score,biology_score,physics_correct,physics_incorrect,physics_unanswered,chemistry_correct,chemistry_incorrect,chemistry_unanswered,biology_correct,biology_incorrect,biology_unanswered,score_status')
        .eq('user_id', userId);

      if (!active) return;
      if (error) {
        console.error('Could not load provisional mock scores', error);
        setScoreLoadFailed(true);
        setScoresLoading(false);
        return;
      }

      const nextScores: Record<string, MockSeriesScore> = {};
      (data ?? []).forEach(row => {
        const score = row as unknown as MockSeriesScore;
        nextScores[score.mock_key] = score;
      });
      setScores(nextScores);
      setScoreLoadFailed(false);
      setScoresLoading(false);
    };

    void supabase.auth.getSession()
      .then(({ data }) => loadScores(data.session?.user.id ?? null))
      .catch(error => {
        console.error('Could not read the current Supabase session', error);
        if (active) {
          setScoreLoadFailed(true);
          setScoresLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setScoresLoading(true);
      void loadScores(session?.user.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const scoredCount = Object.keys(scores).length;

  return (
    <section className="mock-series">
      <style>{css}</style>
      <div className="mock-series-heading">
        <div>
          <span className="section-kicker">YOUR COACHING TEST SERIES</span>
          <h2>Your mock test series.</h2>
          <p>Six papers have provisional subject-wise marks. Upload the PDFs and answer keys later to replace these estimates with verified results.</p>
        </div>
        <span className="mock-series-count">{scoresLoading ? 'LOADING MARKS' : scoreLoadFailed ? 'MARKS UNAVAILABLE' : `${scoredCount} MARKED`}</span>
      </div>

      <div className="mock-series-note">
        <span aria-hidden="true">◎</span>
        <p><b>Provisional marks, not verified results.</b> Each score uses the NEET marking scheme: +4 for correct, −1 for incorrect and 0 for unanswered. Subject-wise counts are stored in Supabase and can be recalculated after the PDFs and answer keys are uploaded.</p>
      </div>

      {scoreLoadFailed && (
        <div className="mock-series-error" role="status">
          Saved marks could not be loaded. Check the Supabase table access and try refreshing the page.
        </div>
      )}

      <div className="mock-series-grid">
        {MOCK_TEST_SERIES.map((paper, index) => {
          const ready = paper.questionIds.length > 0;
          const score = scores[paper.id];
          const subjectBreakdown = score ? [
            { label: 'BIO', marks: score.biology_score, correct: score.biology_correct, incorrect: score.biology_incorrect, unanswered: score.biology_unanswered },
            { label: 'PHY', marks: score.physics_score, correct: score.physics_correct, incorrect: score.physics_incorrect, unanswered: score.physics_unanswered },
            { label: 'CHEM', marks: score.chemistry_score, correct: score.chemistry_correct, incorrect: score.chemistry_incorrect, unanswered: score.chemistry_unanswered },
          ] : [];

          return (
            <article className="mock-series-card" key={paper.id}>
              <div className="mock-series-card-top">
                <span className="mock-series-index">TEST {String(index + 1).padStart(2, '0')}</span>
                <span className={ready ? 'mock-series-state ready' : 'mock-series-state'}>{ready ? 'PAPER READY' : 'PDF PENDING'}</span>
              </div>
              <h3>{paper.title}</h3>
              <div className="mock-series-date">
                <span aria-hidden="true">◷</span>
                <span>Live on: {paper.dateLabel}, 01:30 pm</span>
              </div>
              {paper.onlineOnly && <span className="mock-series-online">ONLY ONLINE</span>}
              <div className="mock-series-goal">
                <span>{score ? (score.score_status === 'verified' ? 'VERIFIED SCORE' : 'PROVISIONAL SCORE') : 'SCORE PENDING'}</span>
                <b>{score ? `${score.total_score} / 720` : '—'}</b>
              </div>
              {subjectBreakdown.length > 0 && (
                <div className="mock-series-subjects">
                  {subjectBreakdown.map(subject => (
                    <div className="mock-series-subject" key={subject.label}>
                      <div className="mock-series-subject-head">
                        <small>{subject.label}</small>
                        <strong>{subject.marks}</strong>
                      </div>
                      <span>{subject.correct}✓ · {subject.incorrect}✕ · {subject.unanswered}–</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="mock-series-attempt"
                disabled={!ready}
                onClick={() => onAttempt(paper)}
              >
                {ready ? 'Attempt paper →' : 'Attempt paper · PDF pending'}
              </button>
              <small className="mock-series-foot">{ready ? 'Opens the timed test interface' : 'Question paper and answer key not added yet'}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const css = `
.mock-series{margin:0 0 28px}
.mock-series-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:30px 0 15px}
.mock-series-heading h2{margin:7px 0 5px;font-size:clamp(27px,3vw,38px);letter-spacing:-1.6px;color:var(--text)}
.mock-series-heading p{max-width:660px;margin:0;color:var(--app-muted);font-size:11px;line-height:1.6}
.mock-series-count{flex:none;padding:8px 11px;border:1px solid var(--app-line);border-radius:10px;color:var(--app-muted);font-size:9px;font-weight:850;letter-spacing:.1em}
.mock-series-note{display:flex;gap:11px;align-items:flex-start;margin:0 0 14px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--apple-blue) 20%,var(--app-line));border-radius:13px;background:color-mix(in srgb,var(--apple-blue) 6%,var(--app-panel))}
.mock-series-note>span{color:var(--apple-blue);font-size:17px;line-height:1}
.mock-series-note p{margin:0;color:var(--app-muted);font-size:10px;line-height:1.55}
.mock-series-note b{color:var(--text)}
.mock-series-error{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(220,90,90,.28);border-radius:10px;color:var(--app-muted);font-size:10px}
.mock-series-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.mock-series-card{min-width:0;padding:17px;border:1px solid var(--app-line);border-radius:17px;background:var(--app-panel)}
.mock-series-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mock-series-index{color:var(--app-muted);font-size:8px;font-weight:900;letter-spacing:.12em}
.mock-series-state{padding:5px 7px;border-radius:7px;background:rgba(238,174,83,.10);color:#d9a752;font-size:7px;font-weight:900;letter-spacing:.08em}
.mock-series-state.ready{background:rgba(47,190,137,.10);color:#63cda1}
.mock-series-card h3{margin:13px 0 7px;color:var(--text);font-size:14px;letter-spacing:-.25px}
.mock-series-date{display:flex;gap:7px;align-items:center;color:var(--app-muted);font-size:9px}
.mock-series-date span:first-child{color:var(--apple-blue);font-size:13px}
.mock-series-online{display:inline-flex;margin-top:9px;padding:5px 7px;border-radius:6px;background:rgba(10,132,255,.10);color:#67b4ff;font-size:7px;font-weight:900;letter-spacing:.09em}
.mock-series-goal{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--app-line)}
.mock-series-goal span{color:var(--app-muted);font-size:7px;font-weight:900;letter-spacing:.09em}
.mock-series-goal b{color:var(--text);font-size:12px}
.mock-series-subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}
.mock-series-subject{min-width:0;padding:8px 6px;border:1px solid var(--app-line);border-radius:9px;background:color-mix(in srgb,var(--text) 2%,transparent)}
.mock-series-subject-head{display:flex;align-items:center;justify-content:space-between;gap:3px}
.mock-series-subject-head small{color:var(--app-muted);font-size:7px;font-weight:900;letter-spacing:.06em}
.mock-series-subject-head strong{color:var(--text);font-size:11px}
.mock-series-subject>span{display:block;margin-top:5px;color:var(--app-muted);font-size:7px;white-space:nowrap}
.mock-series-attempt{width:100%;min-height:39px;margin-top:13px;border:0;border-radius:10px;background:var(--apple-blue);color:#fff;font-size:10px;font-weight:850;cursor:pointer}
.mock-series-attempt:disabled{background:color-mix(in srgb,var(--text) 5%,transparent);color:var(--app-muted);cursor:not-allowed;border:1px solid var(--app-line)}
.mock-series-foot{display:block;margin-top:7px;color:var(--app-muted);font-size:8px;line-height:1.45}
@media(max-width:900px){.mock-series-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.mock-series-heading{align-items:flex-start}.mock-series-heading h2{font-size:29px}.mock-series-grid{grid-template-columns:1fr}.mock-series-card{padding:15px}.mock-series-count{font-size:8px}}
`;
