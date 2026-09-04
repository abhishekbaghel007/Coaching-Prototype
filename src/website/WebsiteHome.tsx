import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type IconName = 'book'|'practice'|'test'|'chart'|'target'|'flame'|'note'|'flash'|'doubt'|'calendar'|'arrow'|'check'|'play'|'menu'|'close'|'layers';

function Icon({name,size=21}:{name:IconName;size?:number}) {
  const p={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  const d:Record<IconName,ReactNode>={
    book:<><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22Z"/><path d="M5 4.5V22"/></>,
    practice:<><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></>,
    test:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    chart:<><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></>,
    target:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
    flame:<><path d="M12 21c4 0 7-2.7 7-6.6 0-3.4-2.2-5.9-4.4-8.4-.2 2-1 3.3-2.1 4.3.2-3.5-1.8-6.1-4.2-8.3.1 3.5-3.3 5.7-3.3 10.2C5 18 8 21 12 21Z"/></>,
    note:<><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    flash:<><path d="M12 2 5 13h6l-1 9 7-11h-6l1-9Z"/></>,
    doubt:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1 .7-1.8 1.1-1.8 2.8M12 17h.01"/></>,
    calendar:<><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
    arrow:<><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    play:<path d="m9 6 9 6-9 6V6Z"/>,
    menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close:<><path d="m6 6 12 12M18 6 6 18"/></>,
    layers:<><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  };
  return <svg {...p}>{d[name]}</svg>;
}

const goApp=()=>{window.location.href='/';};

const features=[
  ['practice','Practice','Chapter-wise questions, focused sessions and daily practice.','#805be6'],
  ['test','Mock Tests','A proper test experience to build speed, accuracy and confidence.','#438fe8'],
  ['flame','Daily DPP','A small daily question block that keeps preparation moving.','#e8a43d'],
  ['target','Mistake Book','Keep the questions you got wrong close for another look.','#45c894'],
  ['note','Revision','Saved questions, notes and quick revision tools in one place.','#e685ae'],
  ['chart','Progress','See accuracy, attempts and subject-wise preparation over time.','#4fc7e5'],
] as const;

const tools=[
  ['book','Question Bank'],['layers','PYQs'],['flash','Flashcards'],['note','NCERT Mode'],
  ['calendar','Study Planner'],['doubt','Doubt Centre'],['chart','Performance'],['target','Mistake Book'],
] as const;

export default function WebsiteHome(){
  const [mobile,setMobile]=useState(false);
  const jump=(id:string)=>{setMobile(false);document.getElementById(id)?.scrollIntoView({behavior:'smooth'});};

  const css=`
  .np-site{min-height:100vh;background:#070b0e;color:#f4f7f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}
  .np-site *{box-sizing:border-box}.np-site button,.np-site a{font:inherit}
  .np-wrap{width:min(1160px,calc(100% - 40px));margin:auto}
  .np-nav{position:sticky;top:0;z-index:50;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(7,11,14,.86);backdrop-filter:blur(18px)}
  .np-navin{height:72px;display:flex;align-items:center;justify-content:space-between}
  .np-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none}.np-logo{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,#ffd66b,#e3a33b);color:#15120a;font-weight:950;font-size:18px}.np-brand b{font-size:20px;letter-spacing:-.8px}.np-brand b span{color:#e9b54f}
  .np-navlinks{display:flex;gap:26px}.np-navlinks button,.np-footlinks button{border:0;background:none;color:#9aa6ab;font-size:11px;font-weight:800;cursor:pointer}.np-navlinks button:hover,.np-footlinks button:hover{color:#fff}
  .np-navactions{display:flex;gap:8px}.np-login,.np-open,.np-primary,.np-secondary{border-radius:12px;padding:10px 14px;font-size:11px;font-weight:950;cursor:pointer}.np-login,.np-secondary{border:1px solid rgba(255,255,255,.09);background:#11181c;color:#e8edef}.np-open,.np-primary{border:0;background:#e9b54f;color:#18140a}.np-mobile{display:none;border:1px solid rgba(255,255,255,.09);background:#11181c;color:#fff;border-radius:11px;padding:9px}
  .np-mobilemenu{display:none}
  .np-hero{padding:84px 0 75px}.np-herogrid{display:grid;grid-template-columns:1.08fr .92fr;gap:60px;align-items:center}
  .np-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:rgba(79,211,191,.08);border:1px solid rgba(79,211,191,.14);color:#82dace;font-size:9px;font-weight:950;letter-spacing:1.2px}.np-eyebrow i{width:6px;height:6px;border-radius:50%;background:#62d6c4}
  .np-hero h1{font-size:clamp(48px,6.2vw,76px);line-height:.96;letter-spacing:-4px;margin:18px 0}.np-hero h1 span{color:#e9b54f}.np-herotext{max-width:590px;color:#a4afb4;font-size:16px;line-height:1.65}.np-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:26px}.np-primary{background:#f5f7f6;color:#111719;padding:13px 17px}.np-trust{display:flex;gap:16px;flex-wrap:wrap;margin-top:23px;color:#7e8a90;font-size:9px;font-weight:800}.np-trust b{color:#63d5c3;margin-right:5px}
  .np-art{height:460px;position:relative}.np-phone{position:absolute;right:20px;top:0;width:315px;aspect-ratio:.57;border:7px solid #1c2529;border-radius:39px;background:#0b1114;box-shadow:0 35px 80px rgba(0,0,0,.5);transform:rotate(3deg)}.np-notch{width:95px;height:22px;margin:auto;background:#1c2529;border-radius:0 0 15px 15px}.np-screen{padding:20px 15px}.np-minitop{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.np-minibrand{display:flex;gap:7px;align-items:center;font-size:11px;font-weight:950}.np-minin{width:27px;height:27px;border-radius:9px;display:grid;place-items:center;background:#e9b54f;color:#17130a}.np-pill{padding:7px 9px;border-radius:999px;background:#151e22;font-size:7px;color:#dce3e4}.np-mini-k{font-size:7px;color:#68d6c6;font-weight:950;letter-spacing:1.1px}.np-mini-title{font-size:23px;font-weight:950;line-height:1.03;letter-spacing:-1px;margin:7px 0 13px}.np-minihero{padding:16px;border-radius:18px;background:linear-gradient(145deg,#173f43,#182432);border:1px solid rgba(102,216,203,.2)}.np-minihero h3{font-size:16px;line-height:1.05;margin:7px 0}.np-minihero p{font-size:8px;color:#aebfc0;line-height:1.5}.np-minibtn{display:inline-block;margin-top:10px;padding:8px 10px;border-radius:9px;background:#f4f6f5;color:#111719;font-size:8px;font-weight:950}.np-minigrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.np-minicard{padding:10px;border-radius:13px;background:#141c20;border:1px solid rgba(255,255,255,.06)}.np-miniicon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:#fff;margin-bottom:7px}.np-minicard b{font-size:9px}.np-minicard small{display:block;color:#77848a;font-size:6px;margin-top:2px}.np-p{background:#7954e6}.np-b{background:#428ce8}.np-o{background:#e5a139}.np-g{background:#3ebd8a}.np-sticker{position:absolute;left:0;bottom:45px;padding:14px 16px;border-radius:17px;background:#121a1e;border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 45px rgba(0,0,0,.35);transform:rotate(-4deg)}.np-sticker b{font-size:21px;color:#e9b54f}.np-sticker span{display:block;color:#879399;font-size:8px;margin-top:2px}
  .np-section{padding:72px 0}.np-sectionhead{display:flex;justify-content:space-between;align-items:flex-end;gap:25px;margin-bottom:26px}.np-sectionhead small{font-size:9px;letter-spacing:1.5px;color:#7e8b91;font-weight:950}.np-sectionhead h2{font-size:36px;line-height:1.02;letter-spacing:-1.6px;margin:7px 0 0}.np-sectionhead p{max-width:470px;color:#89969c;font-size:11px;line-height:1.6;margin:0}
  .np-features{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.np-feature{min-height:185px;padding:20px;border-radius:22px;background:#11181c;border:1px solid rgba(255,255,255,.075);position:relative;overflow:hidden;transition:.2s}.np-feature:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.15)}.np-feature:after{content:"";position:absolute;width:130px;height:130px;border-radius:50%;right:-65px;top:-65px;background:var(--tone);opacity:.1}.np-ficon{width:47px;height:47px;border-radius:15px;display:grid;place-items:center;background:var(--tone);color:#fff}.np-feature h3{font-size:15px;margin:17px 0 6px}.np-feature p{font-size:10px;line-height:1.55;color:#89959b;max-width:300px}
  .np-subjects{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.np-subject{min-height:205px;padding:22px;border-radius:23px;background:#11181c;border:1px solid rgba(255,255,255,.075);position:relative;overflow:hidden}.np-letter{width:52px;height:52px;border-radius:17px;display:grid;place-items:center;background:var(--tone);font-size:20px;font-weight:950}.np-subject h3{font-size:21px;margin:21px 0 5px}.np-subject p{font-size:10px;color:#89959b}.np-line{position:absolute;left:22px;right:22px;bottom:20px;height:5px;border-radius:99px;background:rgba(255,255,255,.07)}.np-line i{display:block;width:48%;height:100%;border-radius:99px;background:var(--tone)}
  .np-journey{display:grid;grid-template-columns:1fr 1.2fr;gap:12px}.np-jcard{padding:26px;border-radius:24px;background:#11181c;border:1px solid rgba(255,255,255,.075)}.np-jcard.colour{background:linear-gradient(145deg,#193c3d,#1a2530)}.np-jcard h3{font-size:27px;line-height:1.04;letter-spacing:-1px;margin:9px 0}.np-jcard p{color:#9aa7ac;font-size:10px;line-height:1.6}.np-steps{display:grid;gap:7px;margin-top:18px}.np-step{display:flex;align-items:center;gap:10px;padding:10px;border-radius:13px;background:rgba(255,255,255,.055)}.np-stepnum{width:27px;height:27px;border-radius:9px;display:grid;place-items:center;background:#e9b54f;color:#17130a;font-size:8px;font-weight:950}.np-step b{font-size:9px}.np-step span{display:block;color:#829097;font-size:7px;margin-top:2px}.np-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:17px}.np-tool{padding:13px;border-radius:15px;background:#151e22;border:1px solid rgba(255,255,255,.055)}.np-toolicon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.07);margin-bottom:10px}.np-tool b{font-size:9px}.np-tool span{display:block;color:#7e8b91;font-size:7px;margin-top:3px}
  .np-cta{margin:35px 0 75px;padding:40px;border-radius:27px;background:linear-gradient(120deg,#1b2829,#1b202e);border:1px solid rgba(233,181,79,.18);position:relative;overflow:hidden}.np-cta:after{content:"";position:absolute;width:310px;height:310px;border-radius:50%;right:-120px;top:-170px;border:1px solid rgba(233,181,79,.16)}.np-cta h2{font-size:34px;letter-spacing:-1.4px;margin:0 0 7px;position:relative}.np-cta p{max-width:520px;color:#99a6ab;font-size:10px;line-height:1.6;position:relative}.np-cta button{position:relative;margin-top:12px}
  .np-footer{border-top:1px solid rgba(255,255,255,.06);padding:28px 0 40px}.np-footin{display:flex;justify-content:space-between;gap:20px}.np-footin p{max-width:380px;color:#758187;font-size:8px;line-height:1.6}.np-footlinks{display:flex;gap:16px;align-items:flex-start}
  @media(max-width:900px){.np-herogrid{grid-template-columns:1fr;gap:15px}.np-art{max-width:520px;width:100%;margin:auto}.np-features{grid-template-columns:1fr 1fr}.np-subjects{grid-template-columns:1fr}.np-journey{grid-template-columns:1fr}.np-sectionhead{align-items:flex-start;flex-direction:column;gap:8px}}
  @media(max-width:680px){.np-wrap{width:calc(100% - 28px)}.np-navin{height:62px}.np-navlinks,.np-navactions{display:none}.np-mobile{display:block}.np-mobilemenu{display:grid;gap:5px;padding:9px 14px 14px;background:#0a0f12;border-top:1px solid rgba(255,255,255,.05)}.np-mobilemenu button{border:0;border-radius:10px;background:#11181c;color:#dce2e4;padding:11px;text-align:left;font-size:10px;font-weight:800}.np-mobilemenu .cta{background:#e9b54f;color:#17130a}.np-hero{padding:49px 0 42px}.np-hero h1{font-size:47px;letter-spacing:-2.8px}.np-herotext{font-size:13px}.np-art{height:395px}.np-phone{width:270px;right:2%}.np-sticker{bottom:25px;width:135px}.np-section{padding:54px 0}.np-sectionhead h2{font-size:29px}.np-features{grid-template-columns:1fr}.np-feature{min-height:160px}.np-jcard{padding:21px}.np-tools{grid-template-columns:1fr 1fr}.np-cta{padding:28px 21px;margin-bottom:55px}.np-cta h2{font-size:28px}.np-footin{flex-direction:column}.np-footlinks{flex-wrap:wrap}}
  `;

  return <div className="np-site"><style>{css}</style>
    <nav className="np-nav"><div className="np-wrap np-navin">
      <a className="np-brand" href="/" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}}><span className="np-logo">N</span><b>neet<span>prep</span></b></a>
      <div className="np-navlinks"><button onClick={()=>jump('features')}>Features</button><button onClick={()=>jump('subjects')}>Subjects</button><button onClick={()=>jump('journey')}>How it works</button></div>
      <div className="np-navactions"><button className="np-login" onClick={goApp}>Log in</button><button className="np-open" onClick={goApp}>Open NEETPrep →</button></div>
      <button className="np-mobile" onClick={()=>setMobile(v=>!v)} aria-label="Menu"><Icon name={mobile?'close':'menu'} size={18}/></button>
    </div>{mobile&&<div className="np-mobilemenu"><button onClick={()=>jump('features')}>Features</button><button onClick={()=>jump('subjects')}>Subjects</button><button onClick={()=>jump('journey')}>How it works</button><button className="cta" onClick={goApp}>Open NEETPrep →</button></div>}</nav>

    <section className="np-hero"><div className="np-wrap np-herogrid"><div>
      <span className="np-eyebrow"><i/> BUILT FOR NEET UG PREPARATION</span>
      <h1>Prepare every day.<br/><span>Progress every week.</span></h1>
      <p className="np-herotext">NEETPrep brings practice, daily questions, mock tests, revision and progress together in one focused study platform.</p>
      <div className="np-actions"><button className="np-primary" onClick={goApp}>Start Practicing <Icon name="arrow" size={14}/></button><button className="np-secondary" onClick={()=>jump('features')}>Explore NEETPrep</button></div>
      <div className="np-trust"><span><b>✓</b>Practice questions</span><span><b>✓</b>NTA-style tests</span><span><b>✓</b>Personal progress</span></div>
    </div><div className="np-art" aria-hidden="true">
      <div className="np-phone"><div className="np-notch"/><div className="np-screen"><div className="np-minitop"><div className="np-minibrand"><span className="np-minin">N</span>neetprep</div><span className="np-pill">🔥 7 days</span></div><span className="np-mini-k">NEET UG 2027 · DAILY PREP</span><div className="np-mini-title">What are we<br/>solving today?</div><div className="np-minihero"><span className="np-mini-k">TODAY'S DPP</span><h3>20 questions.<br/>20 focused minutes.</h3><p>A small block to keep your preparation moving every day.</p><span className="np-minibtn">Start DPP →</span></div><div className="np-minigrid">
        <div className="np-minicard"><div className="np-miniicon np-p"><Icon name="practice" size={14}/></div><b>Practice</b><small>10 questions</small></div>
        <div className="np-minicard"><div className="np-miniicon np-b"><Icon name="test" size={14}/></div><b>Mock Tests</b><small>Real exam flow</small></div>
        <div className="np-minicard"><div className="np-miniicon np-o"><Icon name="book" size={14}/></div><b>Saved</b><small>Revise later</small></div>
        <div className="np-minicard"><div className="np-miniicon np-g"><Icon name="target" size={14}/></div><b>Mistakes</b><small>Repair weak spots</small></div>
      </div></div></div><div className="np-sticker"><b>720</b><span>marks in the NEET pattern</span></div>
    </div></div></section>

    <section className="np-section" id="features"><div className="np-wrap"><div className="np-sectionhead"><div><small>ONE PREP SPACE</small><h2>Everything you need to study.</h2></div><p>No complicated setup. Pick what you need, solve, review, and get back to preparation.</p></div>
      <div className="np-features">{features.map(([icon,title,text,tone])=><article key={title} className="np-feature" style={{'--tone':tone} as CSSProperties}><div className="np-ficon"><Icon name={icon} size={21}/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section className="np-section" id="subjects"><div className="np-wrap"><div className="np-sectionhead"><div><small>YOUR NEET SYLLABUS</small><h2>Three subjects. One clear system.</h2></div><p>Each subject gets its own identity while the overall experience stays consistent.</p></div>
      <div className="np-subjects">{[['P','Physics','Concepts · Numericals · Practice','#438fe8'],['C','Chemistry','Physical · Organic · Inorganic','#45c9b5'],['B','Biology','Botany · Zoology · NCERT','#4dc88e']].map(([letter,name,text,tone])=><article className="np-subject" key={name} style={{'--tone':tone} as CSSProperties}><div className="np-letter">{letter}</div><h3>{name}</h3><p>{text}</p><div className="np-line"><i/></div></article>)}</div>
    </div></section>

    <section className="np-section" id="journey"><div className="np-wrap"><div className="np-sectionhead"><div><small>THE DAILY LOOP</small><h2>Simple enough to actually use.</h2></div><p>The product should help a student decide what to do next, not make them study the interface.</p></div>
      <div className="np-journey"><article className="np-jcard colour"><span className="np-eyebrow">YOUR DAY</span><h3>Open. Practice.<br/>Review. Repeat.</h3><p>Start with a daily target, continue your preparation, or jump straight into a test when you're ready.</p><div className="np-steps"><div className="np-step"><span className="np-stepnum">01</span><div><b>Choose today's work</b><span>DPP, practice or revision</span></div></div><div className="np-step"><span className="np-stepnum">02</span><div><b>See what happened</b><span>Accuracy and mistakes</span></div></div><div className="np-step"><span className="np-stepnum">03</span><div><b>Come back tomorrow</b><span>Keep your streak moving</span></div></div></div></article>
        <article className="np-jcard"><span className="np-eyebrow" style={{color:'#e9b54f',background:'rgba(233,181,79,.08)',borderColor:'rgba(233,181,79,.14)'}}>STUDY CENTRE</span><h3>A bigger toolkit, when you need it.</h3><p>Keep the home experience focused. Open the Study Centre when you want the full preparation toolbox.</p><div className="np-tools">{tools.map(([icon,title])=><div className="np-tool" key={title}><div className="np-toolicon"><Icon name={icon} size={15}/></div><b>{title}</b><span>Inside the student app</span></div>)}</div></article>
      </div>
    </div></section>

    <section className="np-wrap"><div className="np-cta"><h2>Your next question is waiting.</h2><p>Open NEETPrep and turn today's preparation into one more solved question, one more reviewed mistake, and one more step forward.</p><button className="np-primary" onClick={goApp}>Open NEETPrep <Icon name="arrow" size={14}/></button></div></section>

    <footer className="np-footer"><div className="np-wrap np-footin"><div><a className="np-brand" href="/"><span className="np-logo">N</span><b>neet<span>prep</span></b></a><p>A focused NEET UG preparation platform for practice, tests, revision and progress.</p></div><div className="np-footlinks"><button onClick={()=>jump('features')}>Features</button><button onClick={()=>jump('subjects')}>Subjects</button><button onClick={()=>jump('journey')}>How it works</button><button onClick={goApp}>Student App</button></div></div></footer>
  </div>;
}
