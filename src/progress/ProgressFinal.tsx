import React, { useMemo, useState } from 'react';
import { QUESTIONS } from '../data/questions';

type Answer={question_id:string;is_correct:boolean;subject:'Physics'|'Chemistry'|'Biology';answeredAt:number};
type Result={title:string;ids:string[];answers:Record<string,number>;finishedAt:number};
const subjects=['Physics','Chemistry','Biology'] as const;
const read=<T,>(k:string,f:T):T=>{try{const x=localStorage.getItem(k);return x?JSON.parse(x):f}catch{return f}};
const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function Icon({n}:{n:string}){return <span aria-hidden>{({back:'‹',spark:'✦',check:'✓',target:'◎',flame:'♨',chart:'⌁',book:'▱',clock:'◷',arrow:'→'} as Record<string,string>)[n]||'•'}</span>}
function score(r:Result){let c=0,w=0;r.ids.forEach(id=>{const q=QUESTIONS.find(x=>x.id===id);if(!q)return;const a=r.answers[id];if(a===undefined)return;const ok=(q.correct_indices??(q.correct_index==null?[0]:[q.correct_index])).includes(a);ok?c++:w++});return c*4-w}
type ProgressFinalProps = { onClose?: () => void; website?: boolean; sampleDemo?: boolean };

function buildSampleAnswers(): Answer[] {
  const now = Date.now();
  const plan = [
    { subject: 'Physics' as const, total: 60, correct: 21 },
    { subject: 'Chemistry' as const, total: 60, correct: 21 },
    { subject: 'Biology' as const, total: 180, correct: 126 },
  ];
  return plan.flatMap(group => Array.from({ length: group.total }, (_, index) => ({
    question_id: 'sample-' + group.subject.toLowerCase() + '-' + (index + 1),
    subject: group.subject, is_correct: index < group.correct,
    answeredAt: now - ((group.total - index) % 30) * 43200000,
  })));
}

function buildSampleDaily(): Record<string, number> {
  const daily: Record<string, number> = {};
  for (let offset = 0; offset < 30; offset += 1) {
    if ([1, 4, 7, 10, 14, 18, 22, 25, 28].includes(offset)) continue;
    const date = new Date(); date.setDate(date.getDate() - offset);
    daily[day(date)] = 12 + ((offset * 7) % 19);
  }
  return daily;
}

function buildSampleResults(): Result[] {
  const pool = QUESTIONS.filter(q => q.status !== 'dropped').slice(0, 60);
  return Array.from({ length: 4 }, (_, testIndex) => {
    const selected = pool.slice(testIndex * 12, testIndex * 12 + 12);
    const ids = selected.map(q => q.id); const answers: Record<string, number> = {};
    selected.forEach((q, index) => {
      const accepted = q.correct_indices ?? (q.correct_index == null ? [0] : [q.correct_index]);
      const right = accepted[0] ?? 0;
      answers[q.id] = index < 8 + (testIndex % 3) ? right : (right + 1) % 4;
    });
    return { title: 'Practice assessment ' + (testIndex + 1), ids, answers, finishedAt: Date.now() - (3 - testIndex) * 3 * 86400000 };
  });
}
export default function ProgressFinal({onClose,website=false,sampleDemo=false}:ProgressFinalProps){
 const [range,setRange]=useState<'7D'|'30D'|'ALL'>('30D');
 const answers=sampleDemo?buildSampleAnswers():read<Answer[]>('neetprep-answer-history-v1',[]); const results=sampleDemo?buildSampleResults():read<Result[]>('neetprep-results-v3',[]); const daily=sampleDemo?buildSampleDaily():read<Record<string,number>>('neetprep-daily-v3',{}); const saved=sampleDemo?Array.from({length:24},(_,i)=>'sample-saved-'+(i+1)):read<string[]>('neetprep-saved-v3',[]); const mistakes=sampleDemo?Array.from({length:18},(_,i)=>'sample-mistake-'+(i+1)):read<string[]>('neetprep-mistakes-v3',[]); const target=Number(localStorage.getItem('neetprep-target-v3')||650);
 const cutoff=range==='ALL'?0:Date.now()-(range==='7D'?7:30)*86400000; const filtered=answers.filter(a=>a.answeredAt>=cutoff); const total=filtered.length; const correct=filtered.filter(a=>a.is_correct).length; const accuracy=total?Math.round(correct/total*100):0;
 const activeDays=Object.values(daily).filter(v=>v>0).length; const streak=useMemo(()=>{let n=0,d=new Date();while((daily[day(d)]||0)>0){n++;d.setDate(d.getDate()-1)}return n},[daily]);
 const readiness=Math.min(100,Math.round(accuracy*.55+Math.min(100,total/150*100)*.25+Math.min(100,streak/14*100)*.2));
 const subject=subjects.map(s=>{const a=filtered.filter(x=>x.subject===s),c=a.filter(x=>x.is_correct).length;return {s,n:a.length,p:a.length?Math.round(c/a.length*100):0}});
 const tests=[...results].sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,5).map(r=>({title:r.title,score:score(r)})); const gap=tests.length?Math.max(0,target-tests[0].score):null;
 const activity=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return {label:d.toLocaleDateString(undefined,{weekday:'narrow'}),v:daily[day(d)]||0}});
 return <div className="pf" data-website={website?'1':'0'}><style>{css}</style>
  <header className="pf-nav"><button className="pf-round" onClick={onClose||(()=>history.back())}><Icon n="back"/></button><div><b>Progress</b><small>Your preparation at a glance</small></div><button className="pf-round"><Icon n="spark"/></button></header>
  <main className="pf-wrap">{sampleDemo&&<div className="pf-demo-note">SAMPLE PROGRESS · DEMO DATA FOR suprvirat@gmail.com</div>}<div className="pf-range">{(['7D','30D','ALL'] as const).map(x=><button className={range===x?'on':''} onClick={()=>setRange(x)} key={x}>{x==='ALL'?'All time':x}</button>)}</div>
   <section className="pf-hero"><article className="pf-card pf-hello"><span className="eyebrow">PERSONAL PREPARATION</span><h1>{website?'Your preparation, at a glance.':'Here’s where you stand.'}</h1><p>Track consistency, accuracy, subject mastery and the areas that deserve your next hour.</p><div className="actions"><button className="primary">Practice next <Icon n="arrow"/></button><button className="secondary">See details</button></div></article><article className="pf-card readiness"><b>Preparation readiness</b><div className="ring"><span><strong>{readiness}%</strong><small>READY</small></span></div><small>{readiness<50?'Build consistency first.':readiness<80?'Good momentum.':'Excellent rhythm.'}</small></article></section>
   <section className="stats">{[['Questions',total,'✓','answered in this period'],['Accuracy',accuracy+'%','◎',correct+' correct answers'],['Study rhythm',streak+' days','♨',activeDays+' active days tracked'],['Target',target,'♕',gap==null?'Keep building':'marks to go']].map(([t,v,i,s])=><article className="pf-card stat" key={String(t)}><div><span>{t}</span><i>{i}</i></div><strong>{v}</strong><small>{s}</small></article>)}</section>
   <section className="grid"><article className="pf-card panel"><div className="head"><div><h2>Performance trend</h2><small>Recent test performance</small></div><em>LIVE</em></div><div className="bars">{(tests.length?tests.map(x=>Math.min(100,Math.max(0,x.score/720*100))):[0,0,0,0,0]).map((v,i)=><span key={i} style={{height:`${Math.max(10,v)}%`}} />)}</div></article><article className="pf-card panel"><div className="head"><div><h2>Subject mastery</h2><small>Accuracy by subject</small></div></div><div className="subjects">{subject.map(x=><div className="sub" key={x.s}><div><b>{x.s}</b><strong>{x.p}%</strong></div><div className="track"><i style={{width:`${x.p}%`}}/></div></div>)}</div></article></section>
   <section className="grid"><article className="pf-card panel"><div className="head"><div><h2>14-day rhythm</h2><small>Questions completed each day</small></div></div><div className="activity">{activity.map((x,i)=><div key={i}><span style={{height:`${Math.max(10,Math.round(x.v/Math.max(1,...activity.map(a=>a.v))*100))}%`}}/><small>{x.label}</small></div>)}</div></article><article className="pf-card panel"><div className="head"><div><h2>Study load</h2><small>What needs attention</small></div></div><div className="mini-list"><div><span><Icon n="target"/> Mistake book</span><b>{mistakes.length}</b></div><div><span><Icon n="book"/> Saved questions</span><b>{saved.length}</b></div><div><span><Icon n="clock"/> Latest test</span><b>{tests[0]?.score??'—'}</b></div></div></article></section>
   <section className="pf-card next"><div><span className="eyebrow">NEXT BEST MOVE</span><h2>{gap!=null&&gap>0?`Close the ${gap}-mark gap.`:'Keep your streak alive.'}</h2><p>Use your mistakes and weakest subject to make the next session count.</p></div><button className="primary">Start focused practice <Icon n="arrow"/></button></section>
  </main></div>
}
const css=`*{box-sizing:border-box}.pf{position:fixed;inset:0;z-index:99999;overflow:auto;background:radial-gradient(900px 520px at 85% -10%,rgba(0,122,255,.16),transparent 65%),radial-gradient(700px 460px at 0 30%,rgba(99,91,255,.10),transparent 68%),#080b0e;color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,system-ui,sans-serif}.pf-nav{height:78px;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;padding:0 26px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,14,18,.62);backdrop-filter:blur(25px) saturate(170%);-webkit-backdrop-filter:blur(25px) saturate(170%);position:sticky;top:0;z-index:3}.pf-nav>div{text-align:center}.pf-nav b{display:block;font-size:16px}.pf-nav small{display:block;color:#8e999f;font-size:10px;margin-top:3px}.pf-round{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#eef3f7}.pf-wrap{width:min(1180px,calc(100% - 40px));margin:auto;padding:28px 0 100px}.pf-range{display:flex;width:max-content;padding:4px;border-radius:14px;background:rgba(255,255,255,.055);margin-bottom:18px}.pf-range button{border:0;background:transparent;color:#87929a;padding:9px 15px;border-radius:10px;font-weight:700;font-size:11px}.pf-range button.on{background:rgba(255,255,255,.12);color:#fff}.pf-hero{display:grid;grid-template-columns:1.55fr .75fr;gap:16px}.pf-card{border:1px solid rgba(255,255,255,.12);background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.035));box-shadow:inset 0 1px rgba(255,255,255,.08),0 24px 70px rgba(0,0,0,.20);backdrop-filter:blur(22px) saturate(140%);-webkit-backdrop-filter:blur(22px) saturate(140%);border-radius:28px}.pf-hello{min-height:325px;padding:42px}.eyebrow{font-size:10px;letter-spacing:.18em;color:#63b8ff;font-weight:800}.pf-hello h1{font-size:clamp(42px,5vw,67px);line-height:.94;letter-spacing:-4px;margin:14px 0}.pf-hello p{color:#a6b1b8;max-width:680px;line-height:1.55;font-size:14px}.actions{display:flex;gap:10px;margin-top:24px}.primary,.secondary{border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:13px 17px;font-weight:750}.primary{background:#0a84ff;color:#fff;border-color:transparent;box-shadow:0 14px 30px rgba(10,132,255,.25)}.secondary{background:rgba(255,255,255,.065);color:#fff}.readiness{min-height:325px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}.readiness>b{font-size:12px;color:#a8b2b8}.ring{width:160px;height:160px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#5b8cff calc(var(--readiness,70)*1%),rgba(255,255,255,.10) 0);position:relative}.ring:before{content:'';position:absolute;inset:9px;border-radius:50%;background:#11202a}.ring span{position:relative;z-index:1}.ring strong{display:block;font-size:36px;letter-spacing:-2px}.ring small,.readiness>small{color:#8f999f;font-size:9px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.stat{min-height:135px;padding:19px}.stat>div{display:flex;justify-content:space-between;align-items:center;color:#9da7ad;font-size:10px;font-weight:700}.stat i{width:32px;height:32px;border-radius:11px;background:rgba(10,132,255,.10);display:grid;place-items:center;color:#72bbff;font-style:normal}.stat strong{display:block;font-size:31px;letter-spacing:-1.5px;margin:15px 0 3px}.stat small{color:#8d989e;font-size:9px}.grid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;margin-bottom:14px}.panel{min-height:290px;padding:26px}.head{display:flex;justify-content:space-between}.head h2{font-size:19px;margin:0;letter-spacing:-.5px}.head small{display:block;color:#89949b;font-size:10px;margin-top:4px}.head em{font-style:normal;font-size:9px;padding:6px 8px;border-radius:9px;background:rgba(0,122,255,.13);color:#74bdff}.bars{height:205px;display:flex;align-items:flex-end;gap:10px;padding-top:25px}.bars span{flex:1;min-width:14px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,#64b8ff,#087dff);box-shadow:0 8px 25px rgba(10,132,255,.16)}.subjects{display:grid;gap:18px;margin-top:24px}.sub>div:first-child{display:flex;justify-content:space-between;font-size:11px;margin-bottom:7px}.track{height:7px;border-radius:9px;background:rgba(255,255,255,.07);overflow:hidden}.track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#58d0c0,#5b9cff)}.activity{height:205px;display:flex;gap:8px;align-items:flex-end;padding-top:25px}.activity>div{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:7px}.activity span{width:100%;max-width:28px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,#6fb8ff,rgba(10,132,255,.45))}.activity small{font-size:9px;color:#778188}.mini-list{margin-top:22px;display:grid;gap:10px}.mini-list div{display:flex;justify-content:space-between;align-items:center;padding:14px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}.mini-list span{display:flex;gap:10px;align-items:center;color:#aeb8bd;font-size:11px}.mini-list span span{color:#62b5ff}.mini-list b{font-size:15px}.next{padding:26px;display:flex;justify-content:space-between;align-items:center;gap:20px}.next h2{margin:8px 0 5px;font-size:25px;letter-spacing:-1px}.next p{margin:0;color:#8e999f;font-size:11px}@media(max-width:900px){.pf-wrap{width:calc(100% - 24px)}.pf-hero,.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.next{display:block}.next .primary{margin-top:18px}}@media(max-width:560px){.pf-nav{padding:0 14px;height:70px}.pf-wrap{width:calc(100% - 16px);padding-top:18px}.pf-hello{padding:25px;min-height:280px}.pf-hello h1{font-size:42px;letter-spacing:-2.8px}.readiness{min-height:260px}.ring{width:135px;height:135px}.stat{min-height:110px;padding:15px}.stat strong{font-size:27px}.panel{padding:19px}.next{padding:22px}.next h2{font-size:22px}}
/* Progress page: normal document flow, a single browser scrollbar, and lightweight light UI. */
html:has(.pf), body:has(.pf), body:has(.pf) #root {
  height:auto !important;
  min-height:100% !important;
  max-height:none !important;
  overflow-x:hidden !important;
  overflow-y:auto !important;
  -webkit-overflow-scrolling:touch;
}
body:has(.pf) { margin:0 !important; }
body:has(.pf) #root { min-height:100dvh !important; }
.pf {
  position:relative !important;
  inset:auto !important;
  z-index:auto !important;
  width:100% !important;
  min-height:100dvh !important;
  height:auto !important;
  max-height:none !important;
  overflow:visible !important;
  background:#f5f7f8 !important;
  color:#172126 !important;
}
.pf-nav {
  position:sticky !important;
  top:0 !important;
  z-index:10 !important;
  height:70px !important;
  background:rgba(255,255,255,.96) !important;
  border-bottom:1px solid #e5eaed !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}
.pf-nav b { color:#172126 !important; }
.pf-nav small,.pf-card small,.pf-hello p,.readiness>b,.readiness>small,
.stat>div,.stat small,.head small,.activity small,.mini-list span,.next p {
  color:#68777e !important;
}
.pf-round,.pf-range,.pf-range button.on,.secondary,.mini-list div {
  background:#fff !important;
  color:#25343b !important;
  border-color:#e2e8eb !important;
}
.pf-range { border:1px solid #e5eaed; }
.pf-range button { color:#68777e !important; }
.pf-range button.on { background:#eaf2ff !important; color:#1769c2 !important; }
.pf-card {
  background:#fff !important;
  border:1px solid #e4e9ec !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
  color:#172126 !important;
}
.pf-hello h1,.stat strong,.head h2,.next h2,.mini-list b { color:#172126 !important; }
.stat i { background:#edf5ff !important; color:#2878ce !important; }
.ring:before { background:#fff !important; }
.ring { background:conic-gradient(#4388ed 0 70%,#e8edf0 70% 100%) !important; }
.track { background:#edf0f2 !important; }
.mini-list div { border-color:#e8edef !important; }
.bars span,.activity span { box-shadow:none !important; }
.pf .primary { box-shadow:none !important; }
@media(prefers-reduced-motion:reduce) {
  .pf *, .pf *::before, .pf *::after { animation:none !important; transition:none !important; }
}
.pf-demo-note{display:inline-flex;align-items:center;margin:0 0 16px;padding:8px 12px;border-radius:999px;background:#fff7e6;color:#805b16;border:1px solid #f0dfb7;font-size:10px;font-weight:800;letter-spacing:.06em}
.app.progress-mode>.top-nav,.app.progress-mode>.mobile-bottom{display:none!important}
`;
