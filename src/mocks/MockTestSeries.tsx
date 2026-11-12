import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MockQuestionAnalysis, { type MockAnalysisScore } from './MockQuestionAnalysis';

export type MockSeriesPaper = {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  questionIds: string[];
  questionCount: number;
  durationMinutes: number;
};

type MockSeriesScore = MockAnalysisScore;

export const MOCK_TEST_SERIES: MockSeriesPaper[] = [
  { id: 'coaching-2026-03-15-lets-start-01', title: 'LETS START #1 - 15-Mar', date: '2026-03-15', dateLabel: '15 Mar 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-03-29-builder', title: 'NEET Level Test - 29-Mar (BUILDER)', date: '2026-03-29', dateLabel: '29 Mar 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'coaching-2026-04-05-lets-start-02', title: 'LETS START #2 - 05-Apr', date: '2026-04-05', dateLabel: '5 Apr 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-04-12-builder', title: 'NEET Level Test - 12-Apr (BUILDER)', date: '2026-04-12', dateLabel: '12 Apr 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-04-26-builder', title: 'NEET Level Test - 26-Apr (BUILDER)', date: '2026-04-26', dateLabel: '26 Apr 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'coaching-2026-04-26-lets-start-03', title: 'LETS START #3 - 26-Apr', date: '2026-04-26', dateLabel: '26 Apr 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-05-20-120q', title: 'NEET Level Test (120 Q) - 20-May (Only Online)', date: '2026-05-20', dateLabel: '20 May 2026', questionIds: [], questionCount: 120, durationMinutes: 120 },
  { id: 'neet-level-2026-06-14', title: 'NEET Level Test - 14-Jun', date: '2026-06-14', dateLabel: '14 Jun 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-07-12', title: 'NEET Level Test - 12-Jul', date: '2026-07-12', dateLabel: '12 Jul 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-08-09', title: 'NEET Level Test - 09-Aug', date: '2026-08-09', dateLabel: '9 Aug 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-09-06', title: 'NEET Level Test - 06-Sep', date: '2026-09-06', dateLabel: '6 Sep 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-09-27', title: 'NEET Level Test - 27-Sep', date: '2026-09-27', dateLabel: '27 Sep 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-10-11', title: 'NEET Level Test - 11-Oct', date: '2026-10-11', dateLabel: '11 Oct 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-10-25', title: 'NEET Level Test - 25-Oct', date: '2026-10-25', dateLabel: '25 Oct 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
  { id: 'neet-level-2026-11-05', title: 'NEET Level Test - 05-Nov', date: '2026-11-05', dateLabel: '5 Nov 2026', questionIds: [], questionCount: 180, durationMinutes: 180 },
];

type Props = {
  onAttempt: (paper: MockSeriesPaper) => void;
};

export default function MockTestSeries({ onAttempt }: Props) {
  const [scores, setScores] = useState<Record<string, MockSeriesScore>>({});
  const [uploadedPapers, setUploadedPapers] = useState<Record<string, string>>({});
  const [uploadedOmrs, setUploadedOmrs] = useState<Record<string, string>>({});
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoreLoadFailed, setScoreLoadFailed] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<{ paper: MockSeriesPaper; score: MockSeriesScore } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadingOmrKey, setUploadingOmrKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadScores = async (userId: string | null) => {
      if (!userId) {
        if (active) {
          setUserId(null);
          setScores({});
          setUploadedPapers({});
          setUploadedOmrs({});
          setScoreLoadFailed(false);
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
      const { data: paperRows, error: paperError } = await supabase.from('mock_series_paper_files').select('mock_key,pdf_path').eq('user_id', userId);
      if (!active) return;
      if (paperError) { console.error('Could not load uploaded mock PDFs', paperError); setUploadedPapers({}); }
      else {
        const nextPapers: Record<string, string> = {};
        (paperRows ?? []).forEach(row => { nextPapers[row.mock_key] = row.pdf_path; });
        setUploadedPapers(nextPapers);
      }
      const { data: omrRows, error: omrError } = await supabase.from('mock_series_omr_files').select('mock_key,omr_path').eq('user_id', userId);
      if (!active) return;
      if (omrError) { console.error('Could not load uploaded OMR sheets', omrError); setUploadedOmrs({}); }
      else {
        const nextOmrs: Record<string, string> = {};
        (omrRows ?? []).forEach(row => { nextOmrs[row.mock_key] = row.omr_path; });
        setUploadedOmrs(nextOmrs);
      }
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
  const orderedPapers = [...MOCK_TEST_SERIES].sort((a, b) => a.date.localeCompare(b.date));

  async function uploadMockPdf(paper: MockSeriesPaper, file: File) {
    if (!userId) { setUploadError('Sign in before uploading a mock PDF.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Please choose a PDF file.'); return; }
    if (file.size > 25 * 1024 * 1024) { setUploadError('The PDF must be smaller than 25 MB.'); return; }
    const filePath = userId + '/' + paper.id + '.pdf';
    setUploadingKey(paper.id); setUploadError(''); setUploadMessage('');
    try {
      const { error: storageError } = await supabase.storage.from('coaching-mock-papers').upload(filePath, file, { upsert: true, contentType: 'application/pdf' });
      if (storageError) throw storageError;
      const { error: rowError } = await supabase.from('mock_series_paper_files').upsert({ user_id: userId, mock_key: paper.id, pdf_path: filePath, uploaded_at: new Date().toISOString() }, { onConflict: 'user_id,mock_key' });
      if (rowError) throw rowError;
      setUploadedPapers(current => ({ ...current, [paper.id]: filePath }));
      setUploadMessage(paper.title + ': PDF uploaded successfully.');
    } catch (error) {
      console.error('Could not upload mock PDF', error);
      setUploadError(error instanceof Error ? error.message : 'PDF upload failed. Check sign-in and Storage permissions.');
    } finally { setUploadingKey(null); }
  }

  async function uploadOmrPdf(paper: MockSeriesPaper, file: File) {
    if (!userId) { setUploadError('Sign in before uploading an OMR sheet.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Please choose an OMR PDF file.'); return; }
    if (file.size > 25 * 1024 * 1024) { setUploadError('The OMR PDF must be smaller than 25 MB.'); return; }
    const filePath = userId + '/' + paper.id + '-omr.pdf';
    setUploadingOmrKey(paper.id); setUploadError(''); setUploadMessage('');
    try {
      const { error: storageError } = await supabase.storage.from('coaching-mock-papers').upload(filePath, file, { upsert: true, contentType: 'application/pdf' });
      if (storageError) throw storageError;
      const { error: rowError } = await supabase.from('mock_series_omr_files').upsert({
        user_id: userId, mock_key: paper.id, omr_path: filePath, uploaded_at: new Date().toISOString()
      }, { onConflict: 'user_id,mock_key' });
      if (rowError) throw rowError;
      setUploadedOmrs(current => ({ ...current, [paper.id]: filePath }));
      setUploadMessage(paper.title + ': OMR sheet uploaded successfully.');
    } catch (error) {
      console.error('Could not upload OMR sheet', error);
      setUploadError(error instanceof Error ? error.message : 'OMR upload failed. Check sign-in and Storage permissions.');
    } finally { setUploadingOmrKey(null); }
  }

  function publicPdfUrl(path: string) {
    return supabase.storage.from('coaching-mock-papers').getPublicUrl(path).data.publicUrl;
  }

  return (
    <section className="mock-series">
      <style>{css}</style>
      <div className="mock-series-heading">
        <div>
          <span className="section-kicker">YOUR COACHING TEST SERIES</span>
          <h2>Your mock test series.</h2>
          <p>All 13 coaching tests, arranged chronologically. Upload each original paper and attempt a fresh random question set from the website question bank.</p>
        </div>
        <span className="mock-series-count">{scoresLoading ? 'LOADING MARKS' : scoreLoadFailed ? 'MARKS UNAVAILABLE' : `${scoredCount} / ${MOCK_TEST_SERIES.length} SCORED`}</span>
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
        {orderedPapers.map((paper, index) => {
          const score = scores[paper.id];
          const pdfPath = uploadedPapers[paper.id] ?? score?.pdf_path ?? null;
          const omrPath = uploadedOmrs[paper.id] ?? null;
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
                <span className="mock-series-state ready">{score ? 'SCORECARD READY' : 'READY TO ATTEMPT'}</span>
              </div>
              <h3>{paper.title}</h3>
              <div className="mock-series-date">
                <span aria-hidden="true">◷</span>
                <span>Test date: {paper.dateLabel}</span>
              </div>
              <div className="mock-series-format">{paper.questionCount} questions <i>·</i> {paper.durationMinutes} minutes</div>
              <div className="mock-series-pdf-row">
                {pdfPath ? (
                  <a className="mock-series-pdf-link" href={publicPdfUrl(pdfPath)} target="_blank" rel="noreferrer">Open question paper PDF ↗</a>
                ) : (
                  <label className="mock-series-pdf-upload">
                    {uploadingKey === paper.id ? 'Uploading PDF…' : 'Upload question paper PDF'}
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
                {omrPath ? (
                  <a className="mock-series-omr-link" href={publicPdfUrl(omrPath)} target="_blank" rel="noreferrer">Open OMR sheet ↗</a>
                ) : (
                  <label className="mock-series-pdf-upload mock-series-omr-upload">
                    {uploadingOmrKey === paper.id ? 'Uploading OMR…' : 'Upload OMR sheet'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={uploadingOmrKey !== null}
                      onChange={event => {
                        const selected = event.currentTarget.files?.[0];
                        if (selected) void uploadOmrPdf(paper, selected);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                )}
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
              <button className="mock-series-attempt" onClick={() => onAttempt(paper)}>
                Attempt test →
              </button>
              <small className="mock-series-foot">
                A fresh random set of {paper.questionCount} questions is drawn from the website question bank on every attempt.
              </small>
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
.mock-series-format{margin-top:7px;color:var(--app-muted);font-size:8px;letter-spacing:.02em}.mock-series-format i{font-style:normal;margin:0 4px;color:var(--apple-blue)}
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
.mock-series-paper-review{display:flex;align-items:center;justify-content:center;text-decoration:none}.mock-series-attempt:disabled{background:color-mix(in srgb,var(--text) 5%,transparent);color:var(--app-muted);cursor:not-allowed;border:1px solid var(--app-line)}
.mock-series-foot{display:block;margin-top:7px;color:var(--app-muted);font-size:8px;line-height:1.45}
@media(max-width:900px){.mock-series-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.mock-series-heading{align-items:flex-start}.mock-series-heading h2{font-size:29px}.mock-series-grid{grid-template-columns:1fr}.mock-series-card{padding:15px}.mock-series-count{font-size:8px}}
`;
