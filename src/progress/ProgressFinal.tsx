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

export default function ProgressFinal({ onClose, onPractice, target = 650 }: ProgressFinalProps) {
  const currentScore = 315;
  const startingScore = 230;
  const improvement = currentScore - startingScore;
  const remaining = Math.max(0, target - currentScore);
  const goalPercent = target > 0 ? Math.min(100, Math.round((currentScore / target) * 100)) : 0;

  return (
    <div className="pf">
      <style>{css}</style>
      <header className="pf-nav">
        <button className="pf-round" onClick={() => onClose ? onClose() : window.history.back()} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
        <div className="pf-nav-title">
          <b>Progress</b>
          <small>Your preparation at a glance</small>
        </div>
        <span className="pf-mark" aria-hidden="true">✦</span>
      </header>

      <main className="pf-wrap">
        <div className="pf-period"><span className="pf-live-dot" /> SCORE JOURNEY <span>15 AUG – 11 NOV 2026</span></div>

        <section className="pf-hero">
          <article className="pf-card pf-intro">
            <span className="pf-eyebrow">YOUR PREPARATION</span>
            <h1>A steady climb.<br /><span>Even with a few dips.</span></h1>
            <p>You started at around 230 marks on 15 August. You’re now at about 315, an improvement of 85 marks.</p>
            <div className="pf-actions">
              <button className="pf-primary" onClick={onPractice}>Practice next <span aria-hidden="true">→</span></button>
              <span className="pf-gain">+{improvement} marks since August</span>
            </div>
          </article>

          <aside className="pf-card pf-current">
            <div className="pf-current-top"><span>LATEST ESTIMATE</span><i>NOW</i></div>
            <div className="pf-score"><strong>~315</strong><span>/ 720</span></div>
            <div className="pf-target-row"><span>Target score</span><b>{target}/720</b></div>
            <div className="pf-target-track"><i style={{ width: goalPercent + '%' }} /></div>
            <small>About {remaining} marks to your target</small>
          </aside>
        </section>

        <section className="pf-card pf-chart-card">
          <div className="pf-section-head">
            <div><span className="pf-eyebrow">AUGUST TO NOVEMBER</span><h2>Score trend</h2></div>
            <span className="pf-chart-tag">APPROXIMATE</span>
          </div>
          <div className="pf-chart">
            <svg viewBox="0 0 600 180" role="img" aria-label="An illustrative upward score trend from around 230 to around 315, with fluctuations">
              <defs>
                <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b91ff" stopOpacity=".25" />
                  <stop offset="100%" stopColor="#3b91ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="pf-grid-line" d="M10 38 H590 M10 88 H590 M10 138 H590" />
              <path className="pf-area" d="M12 137 C55 145 78 105 122 119 S183 78 225 94 S286 57 329 76 S384 43 430 58 S505 19 588 25 L588 160 L12 160 Z" />
              <path className="pf-line" d="M12 137 C55 145 78 105 122 119 S183 78 225 94 S286 57 329 76 S384 43 430 58 S505 19 588 25" />
              <circle className="pf-start-dot" cx="12" cy="137" r="5" />
              <circle className="pf-end-dot" cx="588" cy="25" r="6" />
            </svg>
            <div className="pf-chart-labels"><span><b>≈230</b><small>15 Aug</small></span><span><b>≈315</b><small>11 Nov</small></span></div>
          </div>
          <p className="pf-chart-note">The middle dips show the overall up-and-down pattern, not individual recorded test scores. Your actual mock reports will replace this estimate as we add them.</p>
        </section>

        <section className="pf-card pf-reports">
          <div className="pf-section-head pf-report-head">
            <div><span className="pf-eyebrow">TEST PERFORMANCE</span><h2>Mock test reports</h2></div>
            <span className="pf-report-status">READY FOR REPORTS</span>
          </div>
          <div className="pf-report-empty">
            <span className="pf-report-icon" aria-hidden="true">▤</span>
            <div>
              <b>Your mock reports will appear here.</b>
              <p>Share your test PDFs or screenshots later. Each report can be added with marks, subject-wise scores and weak topics.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const css = `
.pf{min-height:100dvh;width:100%;color:#eef3f7;background:radial-gradient(850px 440px at 84% -12%,rgba(35,122,219,.17),transparent 66%),#090d11;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.app.progress-mode>.top-nav,.app.progress-mode>.mobile-bottom{display:none!important}
.pf *{box-sizing:border-box}
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
.pf-gain{color:#72c9a5;font-size:11px;font-weight:750}
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
.pf-chart-card,.pf-reports{margin-top:14px;padding:24px 27px}
.pf-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.pf-section-head h2{margin:6px 0 0;color:#eff4f7;font-size:19px;letter-spacing:-.6px}
.pf-chart-tag,.pf-report-status{padding:7px 9px;border:1px solid #2a3a48;border-radius:8px;color:#8ea6b8;font-size:8px;font-weight:850;letter-spacing:.1em}
.pf-chart{margin-top:12px}
.pf-chart svg{display:block;width:100%;height:180px;overflow:visible}
.pf-grid-line{fill:none;stroke:#25313a;stroke-width:1;stroke-dasharray:3 7}
.pf-area{fill:url(#pf-area)}
.pf-line{fill:none;stroke:#4ca3ff;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.pf-start-dot{fill:#121b22;stroke:#77baff;stroke-width:3}
.pf-end-dot{fill:#4ca3ff;stroke:#d9edff;stroke-width:3}
.pf-chart-labels{display:flex;justify-content:space-between;margin-top:0}
.pf-chart-labels span{display:flex;flex-direction:column;gap:3px}
.pf-chart-labels b{color:#e7f1f8;font-size:13px}
.pf-chart-labels small{color:#7d8c97;font-size:9px}
.pf-chart-note{margin:16px 0 0;padding-top:13px;border-top:1px solid #25323c;color:#7f909b;font-size:10px;line-height:1.6}
.pf-report-status{color:#76cda7;border-color:rgba(81,194,145,.25);background:rgba(81,194,145,.07)}
.pf-report-empty{display:flex;align-items:center;gap:15px;margin-top:19px;padding:17px;border:1px dashed #344550;border-radius:15px;background:#0e151b}
.pf-report-icon{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;background:#172938;color:#78baff;font-size:19px}
.pf-report-empty b{display:block;color:#e2ebf1;font-size:12px}
.pf-report-empty p{max-width:690px;margin:5px 0 0;color:#82929d;font-size:10px;line-height:1.6}
@media(max-width:760px){
 .pf-nav{height:64px;padding:0 14px}
 .pf-wrap{width:calc(100% - 24px);padding:20px 0 48px}
 .pf-hero{grid-template-columns:1fr}
 .pf-intro{min-height:245px;padding:25px 22px}
 .pf-intro h1{font-size:37px;letter-spacing:-1.9px}
 .pf-current{padding:20px 22px}
 .pf-score{margin:10px 0 16px}
 .pf-chart-card,.pf-reports{padding:19px 17px}
 .pf-chart svg{height:145px}
 .pf-report-empty{align-items:flex-start;padding:14px}
}
@media(max-width:420px){
 .pf-period{font-size:9px;gap:7px}
 .pf-period>span:last-child{font-size:8px}
 .pf-intro h1{font-size:33px}
 .pf-gain{font-size:10px}
}
@media(prefers-reduced-motion:reduce){.pf *{scroll-behavior:auto!important;transition:none!important}}
`;
