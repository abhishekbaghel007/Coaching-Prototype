import { useEffect, useMemo, useState } from 'react';

type Answer = {
  id?: string;
  question_id: string;
  is_correct: boolean;
  subject: 'Physics' | 'Chemistry' | 'Biology';
  answeredAt: number;
};

type Result = {
  id?: string;
  title: string;
  ids: string[];
  answers: Record<string, number>;
  startedAt?: number;
  finishedAt: number;
};

type ProgressFinalProps = {
  onClose?: () => void;
  onPractice?: () => void;
  website?: boolean;
  answers?: Answer[];
  results?: Result[];
  daily?: Record<string, number>;
  saved?: string[];
  mistakes?: string[];
  target?: number;
};

type MockReport = {
  id: string;
  title: string;
  date: string;
  physics: number;
  chemistry: number;
  biology: number;
  note: string;
  createdAt: number;
};

type ReportDraft = {
  title: string;
  date: string;
  physics: string;
  chemistry: string;
  biology: string;
  note: string;
};

const REPORTS_KEY = 'neetprep-mock-reports-v1';
const ESTIMATE_KEY = 'neetprep-current-score-estimate-v1';
const START_SCORE = 230;
const START_DATE = '2026-08-15';
const SUBJECTS = [
  { key: 'physics', label: 'Physics', max: 180 },
  { key: 'chemistry', label: 'Chemistry', max: 180 },
  { key: 'biology', label: 'Biology', max: 360 },
] as const;

function localDateValue() {
  const date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function readReports(): MockReport[] {
  try {
    const value = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is MockReport =>
      !!item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.title === 'string' &&
      typeof item.date === 'string' &&
      Number.isFinite(item.physics) && Number.isFinite(item.chemistry) &&
      Number.isFinite(item.biology)
    );
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function totalMarks(report: MockReport) {
  return report.physics + report.chemistry + report.biology;
}

function csvCell(value: string | number) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

export default function ProgressFinal({ onClose, onPractice, target = 650 }: ProgressFinalProps) {
  const [reports, setReports] = useState<MockReport[]>(readReports);
  const [currentScore, setCurrentScore] = useState(() => {
    const stored = localStorage.getItem(ESTIMATE_KEY);
    const value = stored === null ? 315 : Number(stored);
    return Number.isInteger(value) && value >= 0 && value <= 720 ? value : 315;
  });
  const [estimateEditing, setEstimateEditing] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState(String(currentScore));
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState<ReportDraft>({
    title: '',
    date: localDateValue(),
    physics: '',
    chemistry: '',
    biology: '',
    note: '',
  });

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem(ESTIMATE_KEY, String(currentScore));
  }, [currentScore]);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [reports],
  );
  const latestScore = currentScore;
  const improvement = latestScore - START_SCORE;
  const remaining = Math.max(0, target - latestScore);
  const targetPercent = target > 0 ? Math.min(100, Math.round((latestScore / target) * 100)) : 0;
  const reportScores = reports.map(totalMarks);
  const averageScore = reportScores.length
    ? Math.round(reportScores.reduce((sum, score) => sum + score, 0) / reportScores.length)
    : null;
  const bestScore = reportScores.length ? Math.max(...reportScores) : null;
  const latestReport = [...reports].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];

  const subjectAverages = SUBJECTS.map(subject => {
    const rows = reports.map(report => report[subject.key]);
    const average = rows.length ? rows.reduce((sum, score) => sum + score, 0) / rows.length : null;
    return { ...subject, average, percent: average === null ? 0 : Math.round(average / subject.max * 100) };
  });

  const chartPoints = sortedReports.map((report, index) => {
    const x = sortedReports.length === 1 ? 300 : 20 + index * (560 / (sortedReports.length - 1));
    const y = 154 - (totalMarks(report) / 720) * 132;
    return { x, y, score: totalMarks(report), title: report.title };
  });
  const chartLine = chartPoints.map(point => point.x + ',' + point.y).join(' ');

  const resetDraft = () => {
    setDraft({ title: '', date: localDateValue(), physics: '', chemistry: '', biology: '', note: '' });
    setEditingId(null);
    setFormError('');
  };

  const openNewReport = () => {
    resetDraft();
    setFormOpen(true);
  };

  const editReport = (report: MockReport) => {
    setDraft({
      title: report.title,
      date: report.date,
      physics: String(report.physics),
      chemistry: String(report.chemistry),
      biology: String(report.biology),
      note: report.note || '',
    });
    setEditingId(report.id);
    setFormError('');
    setFormOpen(true);
  };

  const saveReport = () => {
    const physics = Number(draft.physics);
    const chemistry = Number(draft.chemistry);
    const biology = Number(draft.biology);
    const values = [physics, chemistry, biology];
    const limits = [180, 180, 360];
    if (!draft.title.trim()) {
      setFormError('Add a test name first.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(new Date(draft.date + 'T12:00:00').getTime())) {
      setFormError('Choose a valid test date.');
      return;
    }
    if (values.some((value, index) => draft[[ 'physics', 'chemistry', 'biology' ][index] as keyof ReportDraft].trim() === '' || !Number.isInteger(value) || value < 0 || value > limits[index])) {
      setFormError('Enter whole-number marks within each subject maximum: Physics 180, Chemistry 180, Biology 360.');
      return;
    }

    const next: MockReport = {
      id: editingId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())),
      title: draft.title.trim(),
      date: draft.date,
      physics,
      chemistry,
      biology,
      note: draft.note.trim(),
      createdAt: Date.now(),
    };
    setReports(previous => editingId
      ? previous.map(item => item.id === editingId ? { ...next, createdAt: item.createdAt } : item)
      : [...previous, next]);
    resetDraft();
    setFormOpen(false);
  };

  const deleteReport = (id: string) => {
    setReports(previous => previous.filter(item => item.id !== id));
  };

  const saveEstimate = () => {
    const value = Number(estimateDraft);
    if (!Number.isInteger(value) || value < 0 || value > 720) return;
    setCurrentScore(value);
    setEstimateEditing(false);
  };

  const exportReports = () => {
    if (!reports.length) return;
    const rows = [
      ['Test', 'Date', 'Physics / 180', 'Chemistry / 180', 'Biology / 360', 'Total / 720', 'Notes'],
      ...[...reports].sort((a, b) => a.date.localeCompare(b.date)).map(report => [
        report.title, report.date, report.physics, report.chemistry, report.biology, totalMarks(report), report.note,
      ]),
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'neetprep-mock-reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pf">
      <style>{css}</style>
      <header className="pf-nav">
        <button className="pf-round" onClick={() => onClose ? onClose() : window.history.back()} aria-label="Back"><span aria-hidden="true">‹</span></button>
        <div className="pf-nav-title"><b>Progress</b><small>Your preparation at a glance</small></div>
        <span className="pf-mark" aria-hidden="true">✦</span>
      </header>

      <main className="pf-wrap">
        <div className="pf-period"><span className="pf-live-dot" /> SCORE JOURNEY <span>15 AUG – 11 NOV 2026</span></div>

        <section className="pf-hero">
          <article className="pf-card pf-intro">
            <span className="pf-eyebrow">YOUR PREPARATION</span>
            <h1>A steady climb.<br /><span>Even with a few dips.</span></h1>
            <p>You started at around {START_SCORE} marks on 15 August. Your current estimate is {currentScore}, a change of {improvement >= 0 ? '+' : ''}{improvement} marks.</p>
            <div className="pf-actions">
              <button className="pf-primary" onClick={onPractice}>Practice next <span aria-hidden="true">→</span></button>
              <span className={improvement >= 0 ? 'pf-gain' : 'pf-loss'}>{improvement >= 0 ? '+' : ''}{improvement} marks since August</span>
            </div>
          </article>

          <aside className="pf-card pf-current">
            <div className="pf-current-top"><span>CURRENT SCORE ESTIMATE</span><i>EDITABLE</i></div>
            <div className="pf-score"><strong>~{currentScore}</strong><span>/ 720</span></div>
            <div className="pf-target-row"><span>Target score</span><b>{target}/720</b></div>
            <div className="pf-target-track"><i style={{ width: targetPercent + '%' }} /></div>
            <small>{remaining ? remaining + ' marks to your target' : 'Target reached. Keep it consistent.'}</small>
            {estimateEditing ? (
              <div className="pf-estimate-edit">
                <label htmlFor="pf-estimate">Update current estimate</label>
                <div><input id="pf-estimate" type="number" min="0" max="720" value={estimateDraft} onChange={event => setEstimateDraft(event.target.value)} /><button onClick={saveEstimate}>Save</button><button className="pf-quiet" onClick={() => setEstimateEditing(false)}>Cancel</button></div>
              </div>
            ) : <button className="pf-text-button" onClick={() => { setEstimateDraft(String(currentScore)); setEstimateEditing(true); }}>Update estimate</button>}
          </aside>
        </section>

        <section className="pf-snapshots">
          <article className="pf-card pf-snapshot"><span>Starting point</span><b>~{START_SCORE}</b><small>15 August 2026</small></article>
          <article className="pf-card pf-snapshot"><span>Improvement</span><b className={improvement >= 0 ? 'positive' : 'negative'}>{improvement >= 0 ? '+' : ''}{improvement}</b><small>Compared with your start</small></article>
          <article className="pf-card pf-snapshot"><span>Mock tests logged</span><b>{reports.length}</b><small>Reports you've added</small></article>
          <article className="pf-card pf-snapshot"><span>Average mock score</span><b>{averageScore === null ? '—' : averageScore}</b><small>{averageScore === null ? 'No reports yet' : 'Across logged tests'}</small></article>
        </section>

        <section className="pf-card pf-chart-card">
          <div className="pf-section-head">
            <div><span className="pf-eyebrow">RECORDED TESTS ONLY</span><h2>Mock score trend</h2></div>
            <span className="pf-chart-tag">{reports.length ? reports.length + ' REPORTS' : 'AWAITING REPORTS'}</span>
          </div>
          {chartPoints.length >= 2 ? (
            <div className="pf-chart">
              <svg viewBox="0 0 600 180" role="img" aria-label="Recorded mock test score trend">
                <path className="pf-grid-line" d="M10 22 H590 M10 66 H590 M10 110 H590 M10 154 H590" />
                <polyline className="pf-line" points={chartLine} />
                {chartPoints.map((point, index) => <circle key={index} className="pf-end-dot" cx={point.x} cy={point.y} r="5"><title>{point.title}: {point.score}/720</title></circle>)}
              </svg>
              <div className="pf-chart-labels"><span><b>{chartPoints[0].score}</b><small>{formatDate(sortedReports[0].date)}</small></span><span><b>{chartPoints[chartPoints.length - 1].score}</b><small>{formatDate(sortedReports[sortedReports.length - 1].date)}</small></span></div>
            </div>
          ) : (
            <div className="pf-chart-empty"><span>↗</span><div><b>{reports.length ? 'One report added. Add another to see a trend.' : 'Your actual score trend starts here.'}</b><p>Log mock tests below. The graph will use only the marks and dates you enter, not made-up test scores.</p></div></div>
          )}
        </section>

        <section className="pf-card pf-subject-card">
          <div className="pf-section-head"><div><span className="pf-eyebrow">SUBJECT BREAKDOWN</span><h2>Where your marks come from</h2></div><span className="pf-chart-tag">AVERAGE</span></div>
          <div className="pf-subjects">
            {subjectAverages.map(subject => (
              <div className="pf-subject" key={subject.key}>
                <div className="pf-subject-top"><b>{subject.label}</b><strong>{subject.average === null ? '—' : Math.round(subject.average) + '/' + subject.max}</strong></div>
                <div className="pf-subject-track"><i style={{ width: subject.percent + '%' }} /></div>
                <small>{subject.average === null ? 'Add a mock report to calculate' : subject.percent + '% of subject maximum · ' + reports.length + ' tests'}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="pf-card pf-reports">
          <div className="pf-section-head pf-report-head">
            <div><span className="pf-eyebrow">TEST PERFORMANCE</span><h2>Mock test reports</h2></div>
            <div className="pf-report-actions">
              {reports.length > 0 && <button className="pf-outline-button" onClick={exportReports}>Export CSV ↓</button>}
              <button className="pf-add-button" onClick={openNewReport}>+ Add test</button>
            </div>
          </div>
          {formOpen && (
            <div className="pf-form">
              <div className="pf-form-title"><b>{editingId ? 'Edit mock report' : 'Add mock report'}</b><span>Enter marks exactly as shown on your result.</span></div>
              <div className="pf-form-grid pf-form-top">
                <label>Test name<input value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} placeholder="e.g. Aakash AIATS Test 03" maxLength={80} /></label>
                <label>Test date<input type="date" value={draft.date} onChange={event => setDraft(value => ({ ...value, date: event.target.value }))} /></label>
              </div>
              <div className="pf-form-grid pf-marks-grid">
                <label>Physics <small>/ 180</small><input type="number" min="0" max="180" step="1" value={draft.physics} onChange={event => setDraft(value => ({ ...value, physics: event.target.value }))} placeholder="0–180" /></label>
                <label>Chemistry <small>/ 180</small><input type="number" min="0" max="180" step="1" value={draft.chemistry} onChange={event => setDraft(value => ({ ...value, chemistry: event.target.value }))} placeholder="0–180" /></label>
                <label>Biology <small>/ 360</small><input type="number" min="0" max="360" step="1" value={draft.biology} onChange={event => setDraft(value => ({ ...value, biology: event.target.value }))} placeholder="0–360" /></label>
              </div>
              <label className="pf-note-field">Quick note <small>Optional</small><input value={draft.note} onChange={event => setDraft(value => ({ ...value, note: event.target.value }))} placeholder="e.g. Time management was difficult" maxLength={180} /></label>
              {formError && <p className="pf-form-error">{formError}</p>}
              <div className="pf-form-actions"><button className="pf-add-button" onClick={saveReport}>Save report</button><button className="pf-outline-button" onClick={() => { setFormOpen(false); resetDraft(); }}>Cancel</button></div>
            </div>
          )}
          {reports.length ? (
            <div className="pf-report-list">
              {[...reports].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).map(report => (
                <article className="pf-report-row" key={report.id}>
                  <div className="pf-report-copy"><b>{report.title}</b><small>{formatDate(report.date)} · P {report.physics} · C {report.chemistry} · B {report.biology}</small>{report.note && <p>{report.note}</p>}</div>
                  <div className="pf-report-score"><strong>{totalMarks(report)}</strong><small>/ 720</small></div>
                  <div className="pf-report-controls"><button onClick={() => editReport(report)}>Edit</button><button onClick={() => deleteReport(report.id)}>Remove</button></div>
                </article>
              ))}
            </div>
          ) : !formOpen ? (
            <div className="pf-report-empty"><span className="pf-report-icon" aria-hidden="true">▤</span><div><b>No mock reports added yet.</b><p>Add a test whenever you have its result. Subject totals, average, best score and score trend will calculate automatically.</p></div></div>
          ) : null}
          <p className="pf-storage-note">Reports are saved in this browser on this device. The marks are entered by you and are never generated automatically.</p>
        </section>
      </main>
    </div>
  );
}

const css = `
.pf{min-height:100dvh;width:100%;color:#eef3f7;background:radial-gradient(850px 440px at 84% -12%,rgba(35,122,219,.17),transparent 66%),#090d11;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.app.progress-mode>.top-nav,.app.progress-mode>.mobile-bottom{display:none!important}
.pf *{box-sizing:border-box}
.pf button,.pf input{font:inherit}
.pf-nav{height:72px;position:sticky;top:0;z-index:20;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;padding:0 28px;background:rgba(10,15,20,.94);border-bottom:1px solid #202b34}
.pf-round{width:40px;height:40px;border-radius:50%;border:1px solid #293640;background:#121a21;color:#dce6ed;font-size:24px;line-height:1;cursor:pointer}
.pf-nav-title{text-align:center}.pf-nav-title b{display:block;font-size:15px;letter-spacing:-.2px}.pf-nav-title small{display:block;margin-top:3px;color:#81909a;font-size:10px}
.pf-mark{width:40px;height:40px;display:grid;place-items:center;border:1px solid #293640;border-radius:50%;color:#70b3ff;background:#121a21;font-size:18px}
.pf-wrap{width:min(1060px,calc(100% - 40px));margin:0 auto;padding:30px 0 72px}
.pf-period{display:flex;align-items:center;gap:9px;margin:0 0 15px;color:#a8b8c3;font-size:10px;font-weight:850;letter-spacing:.13em}
.pf-period>span:last-child{margin-left:5px;color:#71818d;font-size:9px;letter-spacing:.08em}
.pf-live-dot{width:7px;height:7px;border-radius:50%;background:#3b98ff;box-shadow:0 0 0 4px rgba(59,152,255,.12)}
.pf-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(250px,.72fr);gap:14px}
.pf-card{background:#111920;border:1px solid #25323c;border-radius:22px}
.pf-intro{padding:34px 36px;min-height:270px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}
.pf-eyebrow{color:#69b2ff;font-size:9px;font-weight:900;letter-spacing:.16em}
.pf-intro h1{margin:14px 0 10px;color:#f3f7fa;font-size:clamp(34px,4.5vw,53px);line-height:1.02;letter-spacing:-2.7px}
.pf-intro h1 span{color:#9aaab6}
.pf-intro p{max-width:570px;margin:0;color:#9aa8b2;font-size:13px;line-height:1.7}
.pf-actions{display:flex;align-items:center;gap:17px;margin-top:22px;flex-wrap:wrap}
.pf-primary{border:0;border-radius:12px;padding:12px 16px;background:#1685f8;color:#fff;font-size:12px;font-weight:800;cursor:pointer}
.pf-primary span{margin-left:7px}.pf-primary:hover{background:#3196ff}
.pf-gain{color:#72c9a5;font-size:11px;font-weight:750}.pf-loss{color:#f0a27f;font-size:11px;font-weight:750}
.pf-current{padding:24px 25px;display:flex;flex-direction:column;justify-content:center}
.pf-current-top{display:flex;align-items:center;justify-content:space-between;color:#8ea0ad;font-size:9px;font-weight:850;letter-spacing:.13em}
.pf-current-top i{font-style:normal;padding:5px 8px;border-radius:7px;background:rgba(47,190,137,.10);color:#69d6a8;font-size:8px}
.pf-score{display:flex;align-items:baseline;gap:8px;margin:13px 0 20px}
.pf-score strong{color:#f5f8fa;font-size:58px;line-height:1;letter-spacing:-3px}
.pf-score span{color:#82919c;font-size:13px}
.pf-target-row{display:flex;justify-content:space-between;align-items:center;color:#9baab4;font-size:10px}
.pf-target-row b{color:#dfe8ee;font-size:11px}
.pf-target-track{height:7px;margin:9px 0 8px;overflow:hidden;border-radius:20px;background:#26323b}
.pf-target-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#267be5,#55b6ff)}
.pf-current>small{color:#778894;font-size:9px}
.pf-text-button{align-self:flex-start;margin-top:12px;border:0;background:transparent;color:#72b9ff;font-size:10px;font-weight:750;cursor:pointer}
.pf-estimate-edit{margin-top:12px}.pf-estimate-edit label{display:block;margin-bottom:6px;color:#a7b6c0;font-size:9px}.pf-estimate-edit>div{display:flex;gap:6px}.pf-estimate-edit input{width:95px;padding:8px;border:1px solid #344550;border-radius:9px;background:#0d141a;color:#eef3f7}.pf-estimate-edit button{border:0;border-radius:9px;padding:8px 11px;background:#1685f8;color:#fff;font-size:10px;font-weight:800;cursor:pointer}.pf-estimate-edit .pf-quiet{background:#202b33;color:#bbc7ce}
.pf-snapshots{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
.pf-snapshot{padding:16px 18px;display:flex;flex-direction:column;gap:7px}.pf-snapshot>span{color:#8fa0aa;font-size:9px;font-weight:750}.pf-snapshot>b{color:#f1f5f8;font-size:25px;letter-spacing:-1px}.pf-snapshot>b.positive{color:#72c9a5}.pf-snapshot>b.negative{color:#f0a27f}.pf-snapshot>small{color:#71828d;font-size:8px}
.pf-chart-card,.pf-subject-card,.pf-reports{margin-top:12px;padding:23px 25px}
.pf-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.pf-section-head h2{margin:6px 0 0;color:#eff4f7;font-size:19px;letter-spacing:-.6px}
.pf-chart-tag,.pf-report-status{padding:7px 9px;border:1px solid #2a3a48;border-radius:8px;color:#8ea6b8;font-size:8px;font-weight:850;letter-spacing:.1em}
.pf-chart{margin-top:14px}
.pf-chart svg{display:block;width:100%;height:180px;overflow:visible}
.pf-grid-line{fill:none;stroke:#25313a;stroke-width:1;stroke-dasharray:3 7}
.pf-line{fill:none;stroke:#4ca3ff;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}
.pf-end-dot{fill:#4ca3ff;stroke:#d9edff;stroke-width:2}
.pf-chart-labels{display:flex;justify-content:space-between;margin-top:0}
.pf-chart-labels span{display:flex;flex-direction:column;gap:3px}
.pf-chart-labels b{color:#e7f1f8;font-size:13px}.pf-chart-labels small{color:#7d8c97;font-size:9px}
.pf-chart-empty{display:flex;align-items:center;gap:14px;margin-top:18px;padding:21px;border-radius:15px;border:1px dashed #344550;background:#0e151b}
.pf-chart-empty>span{font-size:27px;color:#72b9ff}.pf-chart-empty b{color:#e2ebf1;font-size:12px}.pf-chart-empty p{margin:5px 0 0;color:#82929d;font-size:10px;line-height:1.6}
.pf-subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:19px}
.pf-subject{padding:15px;border:1px solid #273640;border-radius:14px;background:#0e151b}
.pf-subject-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.pf-subject-top b{color:#dce7ee;font-size:11px}.pf-subject-top strong{color:#f2f6f9;font-size:12px}
.pf-subject-track{height:6px;margin:12px 0 8px;border-radius:99px;background:#26323b;overflow:hidden}.pf-subject-track i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,#338be9,#62c0ff)}
.pf-subject small{color:#7d8d97;font-size:9px}
.pf-report-actions{display:flex;gap:8px}
.pf-add-button,.pf-outline-button{border:1px solid #2b4050;border-radius:10px;padding:9px 12px;background:#152433;color:#8fc9ff;font-size:10px;font-weight:800;cursor:pointer}
.pf-outline-button{background:transparent;color:#a5b4be}
.pf-form{margin-top:19px;padding:18px;border:1px solid #2b3e4c;border-radius:16px;background:#0d151c}
.pf-form-title{display:flex;align-items:baseline;gap:10px;margin-bottom:15px;flex-wrap:wrap}.pf-form-title b{color:#edf3f7;font-size:13px}.pf-form-title span{color:#83939e;font-size:9px}
.pf-form-grid{display:grid;gap:10px}.pf-form-top{grid-template-columns:1.4fr 1fr}.pf-marks-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:11px}
.pf-form label{display:block;color:#9fb0bb;font-size:9px;font-weight:750}.pf-form label small{color:#718692;font-weight:500}
.pf-form input{display:block;width:100%;height:39px;margin-top:6px;padding:0 10px;border:1px solid #2b3d49;border-radius:9px;background:#111b23;color:#eef3f7;font-size:11px;outline:none}.pf-form input:focus{border-color:#398bd7;box-shadow:0 0 0 3px rgba(57,139,215,.13)}.pf-form input::placeholder{color:#596a76}
.pf-note-field{margin-top:11px}.pf-form-error{margin:10px 0 0;color:#ff9b9b;font-size:10px}.pf-form-actions{display:flex;gap:8px;margin-top:15px}
.pf-report-list{margin-top:14px}.pf-report-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:18px;padding:14px 2px;border-top:1px solid #25333d}
.pf-report-copy b{display:block;color:#e3edf3;font-size:12px}.pf-report-copy small{display:block;margin-top:5px;color:#84949e;font-size:9px}.pf-report-copy p{margin:5px 0 0;color:#9aabb5;font-size:9px}
.pf-report-score{text-align:right}.pf-report-score strong{color:#f2f7fa;font-size:20px}.pf-report-score small{color:#81909a;font-size:9px}
.pf-report-controls{display:flex;gap:6px}.pf-report-controls button{border:1px solid #2b3c47;border-radius:8px;padding:6px 8px;background:transparent;color:#93bde0;font-size:9px;cursor:pointer}.pf-report-controls button:last-child{color:#d99595}
.pf-report-empty{display:flex;align-items:center;gap:15px;margin-top:19px;padding:17px;border:1px dashed #344550;border-radius:15px;background:#0e151b}
.pf-report-icon{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;background:#172938;color:#78baff;font-size:19px}
.pf-report-empty b{display:block;color:#e2ebf1;font-size:12px}.pf-report-empty p{max-width:690px;margin:5px 0 0;color:#82929d;font-size:10px;line-height:1.6}
.pf-storage-note{margin:13px 0 0;color:#657681;font-size:9px;line-height:1.5}
@media(max-width:760px){
 .pf-nav{height:64px;padding:0 14px}.pf-wrap{width:calc(100% - 24px);padding:20px 0 48px}.pf-hero{grid-template-columns:1fr}.pf-intro{min-height:245px;padding:25px 22px}.pf-intro h1{font-size:37px;letter-spacing:-1.9px}.pf-current{padding:20px 22px}.pf-score{margin:10px 0 16px}.pf-snapshots{grid-template-columns:1fr 1fr}.pf-chart-card,.pf-subject-card,.pf-reports{padding:19px 17px}.pf-subjects{grid-template-columns:1fr}.pf-form-top{grid-template-columns:1fr}.pf-marks-grid{grid-template-columns:1fr 1fr}.pf-report-row{grid-template-columns:minmax(0,1fr) auto;gap:10px}.pf-report-controls{grid-column:1/-1;justify-content:flex-end}.pf-report-actions{flex-wrap:wrap;justify-content:flex-end}.pf-chart-empty{align-items:flex-start}
}
@media(max-width:420px){.pf-period{font-size:9px;gap:7px}.pf-period>span:last-child{font-size:8px}.pf-intro h1{font-size:33px}.pf-gain,.pf-loss{font-size:10px}.pf-snapshot{padding:13px}.pf-snapshot>b{font-size:22px}}
@media(prefers-reduced-motion:reduce){.pf *{scroll-behavior:auto!important;transition:none!important}}
`;