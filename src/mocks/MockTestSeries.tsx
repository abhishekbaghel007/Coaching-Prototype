import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MockQuestionAnalysis, { type MockAnalysisScore } from './MockQuestionAnalysis';

export type MockSeriesPaper = {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  questionIds: string[];
};

type MockSeriesScore = MockAnalysisScore & {


export const MOCK_TEST_SERIES: MockSeriesPaper[] = [
  { id: 'neet-level-2026-08-09', title: 'NEET Level Test – 09-Aug', date: '2026-08-09', dateLabel: '9 Aug 2026', questionIds: [] },
  { id: 'neet-level-2026-09-06', title: 'NEET Level Test – 06-Sep', date: '2026-09-06', dateLabel: '6 Sep 2026', questionIds: [] },
  { id: 'neet-level-2026-09-27', title: 'NEET Level Test – 27-Sep', date: '2026-09-27', dateLabel: '27 Sep 2026', questionIds: [] },
  { id: 'neet-level-2026-10-11', title: 'NEET Level Test – 11-Oct', date: '2026-10-11', dateLabel: '11 Oct 2026', questionIds: [] },
  { id: 'neet-level-2026-10-25', title: 'NEET Level Test – 25-Oct', date: '2026-10-25', dateLabel: '25 Oct 2026', questionIds: [] },
  { id: 'neet-level-2026-11-05', title: 'NEET Level Test –05-Nov', date: '2026-11-05', dateLabel: '5 Nov 2026', questionIds: [] },
];

type Props = {
  onAttempt: (paper: MockSeriesPaper) => void;
};

export default function MockTestSeries({ onAttempt }: Props) {
  const [scores, setScores] = useState<Record<string, MockSeriesScore>>({});
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoreLoadFailed, setScoreLoadFailed] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<{ paper: MockSeriesPaper; score: MockSeriesScore } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadScores = async (userId: string | null) => {
      if (!userId) {
        if (active) {
          setUserId(null);
          setScores({});
          setScoresLoading(false);
        }
        return;
      }
      if (active) setUserId(userId);

      const { data, error } = await supabase
        .from('mock_series_scores')
        .select('mock_key,total_score,physics_score,chemistry_score,botany_score,zoology_score,physics_correct,physics_incorrect,physics_unanswered,chemistry_correct,chemistry_incorrect,chemistry_unanswered,botany_correct,botany_incorrect,botany_unanswered,zoology_correct,zoology_incorrect,zoology_unanswered,score_status,pdf_path')
        .eq('user_id', userId);

      if (!active) return;
      if (error) {
        console.error('Could not load mock scores', error);
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

  async function uploadMockPdf(paper: MockSeriesPaper, file: File) {
    if (!userId) {
      setUploadError('Sign in before uploading a mock PDF.');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please choose a PDF file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('The PDF must be smaller than 25 MB.');
      return;
    }

    const fileNames: Record<string, string> = {
      'neet-level-2026-08-09': 'neet-level-test-09-aug.pdf',
      'neet-level-2026-09-06': 'neet-level-test-06-sep.pdf',
      'neet-level-2026-09-27': 'neet-level-test-27-sep.pdf',
      'neet-level-2026-10-11': 'neet-level-test-11-oct.pdf',
      'neet-level-2026-10-25': 'neet-level-test-25-oct.pdf',
      'neet-level-2026-11-05': 'neet-level-test-05-nov.pdf',
    };
    const filePath = fileNames[paper.id];
    if (!filePath) return;

    setUploadingKey(paper.id);
    setUploadError('');
    setUploadMessage('');
    try {
      const { error: storageError } = await supabase.storage
        .from('coaching-mock-papers')
        .upload(filePath, file, { upsert: true, contentType: 'application/pdf' });
      if (storageError) throw storageError;

      const { error: rowError } = await supabase
        .from('mock_series_scores')
        .update({ pdf_path: filePath })
        .eq('user_id', userId)
        .eq('mock_key', paper.id);
      if (rowError) throw rowError;

      setScores(current => ({
        ...current,
        [paper.id]: { ...current[paper.id], pdf_path: filePath },
      }));
      setUploadMessage(`${paper.title}: PDF uploaded.`);
    } catch (error) {
      console.error('Could not upload mock PDF', error);
      setUploadError(error instanceof Error ? error.message : 'PDF upload failed. Check sign-in and Storage permissions.');
    } finally {
      setUploadingKey(null);
    }
  }

  function publicPdfUrl(path: string) {
    return supabase.storage.from('coaching-mock-papers').getPublicUrl(path).data.publicUrl;
  }

  const omrUrls: Record<string, string> = {
    'neet-level-2026-08-09': 'https://www.neetprep.com/tests/omr_sheet/7709843',
    'neet-level-2026-09-06': 'https://www.neetprep.com/tests/omr_sheet/7709851',
    'neet-level-2026-09-27': 'https://www.neetprep.com/tests/omr_sheet/7709857',
    'neet-level-2026-10-11': 'https://www.neetprep.com/tests/omr_sheet/7709863',
    'neet-level-2026-10-25': 'https://www.neetprep.com/tests/omr_sheet/7709875',
    'neet-level-2026-11-05': 'https://www.neetprep.com/tests/omr_sheet/7709883',
  };

  return (
    <section className="mock-series">
      <style>{css}</style>
      <div className="mock-series-heading">
        <div>
          <span className="section-kicker">YOUR COACHING TEST SERIES</span>
          <h2>Your mock test series.</h2>
          <p>Six papers with subject-wise scorecards and a question review workspace.</p>
        </div>
        <span className="mock-series-count">{scoresLoading ? 'LOADING MARKS' : scoreLoadFailed ? 'MARKS UNAVAILABLE' : `${scoredCount} / 6 SCORED`}</span>
      </div>

      {scoreLoadFailed && (
        <div className="mock-series-error" role="status">
          Saved marks could not be loaded. Check Supabase access and refresh the page.
        </div>
      )}
      {(uploadError || uploadMessage) && (
        <div className={uploadError ? 'mock-series-error' : 'mock-series-upload-success'} role="status">
          {uploadError || uploadMessage}
        </div>
      )}

      <div className="mock-series-grid">
        {MOCK_TEST_SERIES.map((paper, index) => {
          const ready = paper.questionIds.length > 0;
          const score = scores[paper.id];
          const subjectBreakdown = score ? [
            { label: 'Physics', short: 'PHY', marks: score.physics_score, correct: score.physics_correct, incorrect: score.physics_incorrect, unanswered: score.physics_unanswered },
            { label: 'Chemistry', short: 'CHEM', marks: score.chemistry_score, correct: score.chemistry_correct, incorrect: score.chemistry_incorrect, unanswered: score.chemistry_unanswered },
            { label: 'Botany', short: 'BOT', marks: score.botany_score, correct: score.botany_correct, incorrect: score.botany_incorrect, unanswered: score.botany_unanswered },
            { label: 'Zoology', short: 'ZOO', marks: score.zoology_score, correct: score.zoology_correct, incorrect: score.zoology_incorrect, unanswered: score.zoology_unanswered },
          ] : [];

          return (
            <article className="mock-series-card" key={paper.id}>
              <div className="mock-series-card-top">
                <span className="mock-series-index">TEST {String(index + 1).padStart(2, '0')}</span>
                <span className={ready ? 'mock-series-state ready' : 'mock-series-state'}>{ready ? 'PAPER READY' : 'QUESTION REVIEW'}</span>
              </div>
              <h3>{paper.title}</h3>
              <div className="mock-series-date">
                <span aria-hidden="true">◷</span>
                <span>Test date: {paper.dateLabel}</span>
              </div>
              <div className="mock-series-pdf-row">
                {score?.pdf_path ? (
                  <a className="mock-series-pdf-link" href={publicPdfUrl(score.pdf_path)} target="_blank" rel="noreferrer">Open question paper PDF ↗</a>
                ) : (
                  <label className="mock-series-pdf-upload">
                    {uploadingKey === paper.id ? 'Uploading PDF…' : 'Add question paper PDF'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={uploadingKey !== null}
                      onChange={event => {
                        const selected = event.currentTarget.files?.[0];
                        if (selected) void uploadMockPdf(paper, selected);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                )}
                <a className="mock-series-omr-link" href={omrUrls[paper.id]} target="_blank" rel="noreferrer">OMR sheet ↗</a>
              </div>
              <div className="mock-series-goal">
                <span>{score ? (score.score_status === 'verified' ? 'VERIFIED SCORE' : 'RECONSTRUCTED SCORE') : 'SCORE PENDING'}</span>
                <b>{score ? `${score.total_score} / 720` : '—'}</b>
              </div>
              {subjectBreakdown.length > 0 && (
                <div className="mock-series-subjects">
                  {subjectBreakdown.map(subject => (
                    <div className="mock-series-subject" key={subject.short}>
                      <div className="mock-series-subject-head">
                        <small>{subject.short}</small>
                        <strong>{subject.marks}</strong>
                      </div>
                      <span>{subject.correct} correct · {subject.incorrect} wrong · {subject.unanswered} blank</span>
                    </div>
                  ))}
                </div>
              )}
              {score && (
                <button
                  className="mock-series-analysis"
                  onClick={() => setActiveAnalysis(current => current?.paper.id === paper.id ? null : { paper, score })}
                >
                  {activeAnalysis?.paper.id === paper.id ? 'Close analysis' : 'View full analysis ↗'}
                </button>
              )}
              <button
                className="mock-series-attempt"
                disabled={!ready}
                onClick={() => onAttempt(paper)}
              >
                {ready ? 'Attempt paper →' : 'CBT question mapping pending'}
              </button>
              <small className="mock-series-foot">{ready ? 'Opens the timed test interface' : 'Question text and answer key still need verification'}</small>
            </article>
          );
        })}
      </div>

      {activeAnalysis && (
        <MockQuestionAnalysis
          key={activeAnalysis.paper.id}
          mockKey={activeAnalysis.paper.id}
          mockTitle={activeAnalysis.paper.title}
          score={activeAnalysis.score}
          onClose={() => setActiveAnalysis(null)}
        />
      )}
    </section>
  );
}

const css = `
.mock-series{margin:0 0 28px}
.mock-series-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:30px 0 15px}
.mock-series-heading h2{margin:7px 0 5px;font-size:clamp(27px,3vw,38px);letter-spacing:-1.6px;color:var(--text)}
.mock-series-heading p{max-width:660px;margin:0;color:var(--app-muted);font-size:11px;line-height:1.6}
.mock-series-count{flex:none;padding:8px 11px;border:1px solid var(--app-line);border-radius:10px;color:var(--app-muted);font-size:9px;font-weight:850;letter-spacing:.1em}
.mock-series-error{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(220,90,90,.28);border-radius:10px;color:var(--app-muted);font-size:10px}
.mock-series-upload-success{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(47,190,137,.28);border-radius:10px;color:var(--app-muted);font-size:10px}
.mock-series-pdf-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.mock-series-pdf-upload,.mock-series-pdf-link,.mock-series-omr-link{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:7px 9px;border:1px solid var(--app-line);border-radius:8px;background:transparent;color:var(--text);font-size:9px;font-weight:800;text-decoration:none;cursor:pointer}
.mock-series-pdf-upload input{display:none}
.mock-series-pdf-upload:has(input:disabled){opacity:.6;cursor:wait}
.mock-series-omr-link{color:var(--app-muted)}
.mock-series-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.mock-series-card{min-width:0;padding:17px;border:1px solid var(--app-line);border-radius:17px;background:var(--app-panel)}
.mock-series-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mock-series-index{color:var(--app-muted);font-size:8px;font-weight:900;letter-spacing:.12em}
.mock-series-state{padding:5px 7px;border-radius:7px;background:rgba(238,174,83,.10);color:#d9a752;font-size:7px;font-weight:900;letter-spacing:.08em}
.mock-series-state.ready{background:rgba(47,190,137,.10);color:#63cda1}
.mock-series-card h3{margin:13px 0 7px;color:var(--text);font-size:14px;letter-spacing:-.25px}
.mock-series-date{display:flex;gap:7px;align-items:center;color:var(--app-muted);font-size:9px}
.mock-series-date span:first-child{color:var(--apple-blue);font-size:13px}
.mock-series-goal{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--app-line)}
.mock-series-goal span{color:var(--app-muted);font-size:7px;font-weight:900;letter-spacing:.09em}
.mock-series-goal b{color:var(--text);font-size:12px}
.mock-series-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px}
.mock-series-subject{min-width:0;padding:8px 7px;border:1px solid var(--app-line);border-radius:9px;background:color-mix(in srgb,var(--text) 2%,transparent)}
.mock-series-subject-head{display:flex;align-items:center;justify-content:space-between;gap:3px}
.mock-series-subject-head small{color:var(--app-muted);font-size:7px;font-weight:900;letter-spacing:.06em}
.mock-series-subject-head strong{color:var(--text);font-size:11px}
.mock-series-subject>span{display:block;margin-top:5px;color:var(--app-muted);font-size:8px;line-height:1.4}
.mock-series-analysis{width:100%;min-height:37px;margin-top:12px;border:1px solid var(--app-line);border-radius:10px;background:transparent;color:var(--text);font-size:10px;font-weight:850;cursor:pointer}
.mock-series-attempt{width:100%;min-height:39px;margin-top:9px;border:0;border-radius:10px;background:var(--apple-blue);color:#fff;font-size:10px;font-weight:850;cursor:pointer}
.mock-series-attempt:disabled{background:color-mix(in srgb,var(--text) 5%,transparent);color:var(--app-muted);cursor:not-allowed;border:1px solid var(--app-line)}
.mock-series-foot{display:block;margin-top:7px;color:var(--app-muted);font-size:8px;line-height:1.45}
@media(max-width:900px){.mock-series-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.mock-series-heading{align-items:flex-start}.mock-series-heading h2{font-size:29px}.mock-series-grid{grid-template-columns:1fr}.mock-series-card{padding:15px}.mock-series-count{font-size:8px}}
`;
