import { useEffect, useMemo, useState } from 'react';
import { QUESTIONS, type NEETQuestion } from '../data/questions';
import { supabase } from '../lib/supabase';
import { loadTeacherQuestions, type TeacherQuestion } from './questionBank';

type Props = { onClose: () => void };
type SourceQuestion = { key: string; sourceType: 'builtin' | 'teacher'; sourceId: string; subject: 'Physics' | 'Chemistry' | 'Biology'; chapter?: string; question: string; options: string[]; correctIndex: number | null };
type Step = 'setup' | 'questions' | 'rules' | 'review';

const neetCounts = { Physics: 45, Chemistry: 45, Biology: 90 };
const defaultInstructions = 'Attempt every question carefully. Each question has four options with one best answer. Unanswered questions receive 0 marks. Manage the clock yourself and review marked questions before submitting.';

const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function keyOf(sourceType: SourceQuestion['sourceType'], sourceId: string) { return `${sourceType}:${sourceId}`; }

export default function MockTestStudio({ onClose }: Props) {
  const [step, setStep] = useState<Step>('setup');
  const [teacherQuestions, setTeacherQuestions] = useState<TeacherQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [preset, setPreset] = useState<'neet' | 'custom'>('neet');
  const [title, setTitle] = useState('NEET Full Mock Test');
  const [description, setDescription] = useState('Full-syllabus NEET-style mock examination.');
  const [duration, setDuration] = useState(180);
  const [start, setStart] = useState(toLocalInput(new Date(Date.now() + 86400000)));
  const [end, setEnd] = useState(toLocalInput(new Date(Date.now() + 86400000 + 10800000)));
  const [counts, setCounts] = useState(neetCounts);
  const [selected, setSelected] = useState<string[]>([]);
  const [subjectTab, setSubjectTab] = useState<'All' | 'Physics' | 'Chemistry' | 'Biology'>('All');
  const [search, setSearch] = useState('');
  const [autoFill, setAutoFill] = useState(true);
  const [positive, setPositive] = useState(4);
  const [negative, setNegative] = useState(1);
  const [attemptLimit, setAttemptLimit] = useState(1);
  const [audience, setAudience] = useState<'all' | 'batch' | 'selected'>('all');
  const [audienceLabel, setAudienceLabel] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [students, setStudents] = useState<{ id: string; display_name: string | null; email: string | null }[]>([]);
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowBack, setAllowBack] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [resume, setResume] = useState(false);
  const [resultRelease, setResultRelease] = useState('after_submit');
  const [showSolutions, setShowSolutions] = useState(true);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [showRank, setShowRank] = useState(true);
  const [showPercentile, setShowPercentile] = useState(true);
  const [passPercentage, setPassPercentage] = useState(50);

  useEffect(() => {
    let alive = true;
    Promise.all([loadTeacherQuestions(), supabase.from('profiles').select('id,display_name,email').order('display_name')])
      .then(([questions, studentResult]) => {
        if (!alive) return;
        setTeacherQuestions(questions);
        setStudents((studentResult.data ?? []) as { id: string; display_name: string | null; email: string | null }[]);
      })
      .catch((error) => alive && setMessage(error instanceof Error ? error.message : 'Could not load question and student pools.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const pool = useMemo<SourceQuestion[]>(() => {
    const builtin = (QUESTIONS as NEETQuestion[]).filter(q => q.status !== 'dropped').map(q => ({ key: keyOf('builtin', q.id), sourceType: 'builtin' as const, sourceId: q.id, subject: q.subject, chapter: q.chapter, question: q.question, options: q.options, correctIndex: q.correct_index }));
    const teacher = teacherQuestions.map(q => ({ key: keyOf('teacher', q.id ?? q.question), sourceType: 'teacher' as const, sourceId: q.id ?? q.question, subject: q.subject, chapter: q.chapter, question: q.question, options: q.options, correctIndex: q.correct_index }));
    return [...builtin, ...teacher];
  }, [teacherQuestions]);

  const filtered = useMemo(() => pool.filter(q => (subjectTab === 'All' || q.subject === subjectTab) && (!search.trim() || `${q.question} ${q.chapter ?? ''}`.toLowerCase().includes(search.toLowerCase()))), [pool, subjectTab, search]);
  const selectedQuestions = useMemo(() => selected.map(key => pool.find(q => q.key === key)).filter(Boolean) as SourceQuestion[], [selected, pool]);
  const selectedCounts = useMemo(() => ({ Physics: selectedQuestions.filter(q => q.subject === 'Physics').length, Chemistry: selectedQuestions.filter(q => q.subject === 'Chemistry').length, Biology: selectedQuestions.filter(q => q.subject === 'Biology').length }), [selectedQuestions]);
  const totalQuestions = counts.Physics + counts.Chemistry + counts.Biology;
  const maxMarks = totalQuestions * positive;

  function applyPreset(value: 'neet' | 'custom') {
    setPreset(value);
    if (value === 'neet') {
      setTitle('NEET Full Mock Test'); setDuration(180); setCounts(neetCounts); setPositive(4); setNegative(1); setResultRelease('after_submit');
    }
  }

  function autoSelect() {
    const next: string[] = [];
    (['Physics', 'Chemistry', 'Biology'] as const).forEach(subject => {
      const candidates = pool.filter(q => q.subject === subject && q.correctIndex !== null);
      const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, counts[subject]);
      next.push(...shuffled.map(q => q.key));
    });
    setSelected(next);
    setMessage(next.length === totalQuestions ? `Auto-filled ${next.length} questions using the current subject blueprint.` : `Only ${next.length} eligible questions were available for the requested ${totalQuestions}.`);
  }

  function toggleQuestion(q: SourceQuestion) {
    setSelected(current => current.includes(q.key) ? current.filter(k => k !== q.key) : [...current, q.key]);
  }

  function toggleStudent(id: string) { setSelectedStudents(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]); }

  async function save(status: 'draft' | 'published' | 'scheduled') {
    if (!title.trim()) return setMessage('Give the exam a title.');
    if (!selectedQuestions.length) return setMessage('Select at least one question.');
    if (status !== 'draft' && selectedQuestions.some(q => q.correctIndex === null)) return setMessage('Every published question needs a correct answer.');
    if (preset === 'neet' && status !== 'draft' && selectedQuestions.length !== 180) return setMessage(`NEET full mock must contain 180 questions. You currently have ${selectedQuestions.length}.`);
    if (audience === 'batch' && !audienceLabel.trim()) return setMessage('Enter the batch name or identifier.');
    if (audience === 'selected' && !selectedStudents.length) return setMessage('Select at least one student.');
    setSaving(true); setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Your teacher session has expired.');
      const startIso = start ? new Date(start).toISOString() : null;
      const endIso = end ? new Date(end).toISOString() : null;
      const finalStatus = status === 'published' && startIso && new Date(startIso).getTime() > Date.now() ? 'scheduled' : status;
      const sectionConfig = (['Physics', 'Chemistry', 'Biology'] as const).map(subject => ({ subject, questions: counts[subject], marks: counts[subject] * positive }));
      const { data: exam, error: examError } = await supabase.from('mock_tests').insert({
        title: title.trim(), description: description.trim() || null, exam_type: preset === 'neet' ? 'NEET Full Mock' : 'Custom', status: finalStatus,
        duration_minutes: duration, scheduled_start: startIso, scheduled_end: endIso, attempt_limit: attemptLimit,
        audience_mode: audience, audience_label: audienceLabel.trim() || null, audience_student_ids: selectedStudents,
        instructions: instructions.trim() || null, positive_marks: positive, negative_marks: negative, unanswered_marks: 0,
        shuffle_questions: shuffleQuestions, shuffle_options: shuffleOptions, allow_back_navigation: allowBack, auto_submit: autoSubmit,
        require_fullscreen: fullscreen, allow_resume: resume, result_release: resultRelease, show_solutions: showSolutions,
        show_answer_key: showAnswerKey, show_rank: showRank, show_percentile: showPercentile, pass_percentage: passPercentage,
        section_config: sectionConfig, created_by: user.id,
      }).select('id').single();
      if (examError) throw examError;
      const rows = selectedQuestions.map((q, index) => ({ mock_test_id: exam.id, source_type: q.sourceType, source_id: q.sourceId, position: index + 1, section: q.subject, marks: positive, negative_marks: negative }));
      const { error: questionError } = await supabase.from('mock_test_questions').insert(rows);
      if (questionError) throw questionError;
      setMessage(finalStatus === 'scheduled' ? 'Mock test scheduled successfully.' : finalStatus === 'published' ? 'Mock test published successfully.' : 'Draft saved successfully.');
      if (status !== 'draft') window.setTimeout(onClose, 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the mock test.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="mts-backdrop"><div className="mts-modal"><div className="mts-loading">Loading question bank…</div></div></div>;

  const steps: { id: Step; label: string }[] = [
    { id: 'setup', label: 'Exam setup' }, { id: 'questions', label: 'Question paper' }, { id: 'rules', label: 'Rules & access' }, { id: 'review', label: 'Review & publish' },
  ];

  return <div className="mts-backdrop">
    <div className="mts-modal">
      <style>{css}</style>
      <header className="mts-header"><div><span>EXAM STUDIO</span><h1>Create a mock test.</h1><p>Build a complete NEET-style examination from your connected question bank.</p></div><button className="mts-close" onClick={onClose}>×</button></header>
      <div className="mts-steps">{steps.map((item, index) => <button key={item.id} className={step === item.id ? 'active' : ''} onClick={() => setStep(item.id)}><b>{index + 1}</b><span>{item.label}</span></button>)}</div>

      {step === 'setup' && <section className="mts-section">
        <div className="mts-grid two">
          <Field label="Exam name"><input value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="Exam type"><select value={preset} onChange={e => applyPreset(e.target.value as 'neet' | 'custom')}><option value="neet">NEET Full Mock</option><option value="custom">Custom Mock</option></select></Field>
        </div>
        <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <div className="mts-card"><div className="mts-card-title"><div><span>QUESTION BLUEPRINT</span><h3>{preset === 'neet' ? 'NEET 2026 pattern' : 'Custom subject mix'}</h3></div><b>{totalQuestions} questions · {maxMarks} marks</b></div>
          <div className="mts-subjects">{(['Physics', 'Chemistry', 'Biology'] as const).map(subject => <div className="mts-subject" key={subject}><div><strong>{subject}</strong><small>{subject === 'Biology' ? 'Botany + Zoology' : 'Single-correct MCQ'}</small></div><input type="number" min="0" max="180" value={counts[subject]} onChange={e => { setPreset('custom'); setCounts(x => ({ ...x, [subject]: Math.max(0, Number(e.target.value) || 0) })); }} /><span>questions</span></div>)}</div>
          <div className="mts-note">NEET 2026 uses 180 compulsory MCQs in 180 minutes: Physics 45, Chemistry 45 and Biology 90, for 720 total marks. citeturn2view0</div>
        </div>
        <div className="mts-grid three"><Field label="Duration (minutes)"><input type="number" min="1" max="1440" value={duration} onChange={e => setDuration(Number(e.target.value) || 1)} /></Field><Field label="Start"><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></Field><Field label="End"><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
      </section>}

      {step === 'questions' && <section className="mts-section">
        <div className="mts-toolbar"><div><span>QUESTION PAPER</span><h2>{selectedQuestions.length} selected</h2></div><button className="mts-primary" onClick={autoSelect}>✦ Auto-fill blueprint</button></div>
        <div className="mts-tabs"><button className={subjectTab === 'All' ? 'active' : ''} onClick={() => setSubjectTab('All')}>All · {pool.length}</button>{(['Physics', 'Chemistry', 'Biology'] as const).map(subject => <button className={subjectTab === subject ? 'active' : ''} key={subject} onClick={() => setSubjectTab(subject)}>{subject} · {selectedCounts[subject]}/{counts[subject]}</button>)}</div>
        <div className="mts-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search question or chapter…" /></div>
        <div className="mts-pool">{filtered.slice(0, 140).map(q => <button key={q.key} className={selected.includes(q.key) ? 'picked' : ''} onClick={() => toggleQuestion(q)}><span>{selected.includes(q.key) ? '✓' : '+'}</span><div><small>{q.subject} · {q.chapter || 'General'} · {q.sourceType === 'teacher' ? 'Teacher' : 'Question Bank'}</small><b>{q.question.replace(/\s+/g, ' ').slice(0, 180)}{q.question.length > 180 ? '…' : ''}</b></div></button>)}{!filtered.length && <div className="mts-empty">No questions match this filter.</div>}</div>
        <div className="mts-selection"><span>Physics {selectedCounts.Physics}/{counts.Physics} · Chemistry {selectedCounts.Chemistry}/{counts.Chemistry} · Biology {selectedCounts.Biology}/{counts.Biology}</span><button onClick={() => setSelected([])}>Clear selection</button></div>
      </section>}

      {step === 'rules' && <section className="mts-section">
        <div className="mts-grid three"><Field label="Correct answer"><input type="number" min="0" step="0.5" value={positive} onChange={e => setPositive(Number(e.target.value) || 0)} /></Field><Field label="Wrong answer penalty"><input type="number" min="0" step="0.5" value={negative} onChange={e => setNegative(Number(e.target.value) || 0)} /></Field><Field label="Attempts allowed"><input type="number" min="1" max="20" value={attemptLimit} onChange={e => setAttemptLimit(Math.max(1, Number(e.target.value) || 1))} /></Field></div>
        <div className="mts-rule-grid">
          <Rule title="Question order" text="Randomize the order for each student." value={shuffleQuestions} setValue={setShuffleQuestions} />
          <Rule title="Option order" text="Randomize A–D option positions." value={shuffleOptions} setValue={setShuffleOptions} />
          <Rule title="Back navigation" text="Allow students to revisit earlier questions." value={allowBack} setValue={setAllowBack} />
          <Rule title="Auto submit" text="Submit when the timer reaches zero." value={autoSubmit} setValue={setAutoSubmit} />
          <Rule title="Fullscreen mode" text="Ask the student to enter fullscreen." value={fullscreen} setValue={setFullscreen} />
          <Rule title="Resume after reconnect" text="Allow a saved attempt to resume." value={resume} setValue={setResume} />
        </div>
        <div className="mts-card"><div className="mts-card-title"><div><span>ACCESS</span><h3>Who can take this exam?</h3></div></div><div className="mts-access-tabs">{(['all', 'batch', 'selected'] as const).map(mode => <button className={audience === mode ? 'active' : ''} key={mode} onClick={() => setAudience(mode)}>{mode === 'all' ? 'All students' : mode === 'batch' ? 'A batch' : 'Selected students'}</button>)}</div>{audience === 'batch' && <Field label="Batch name / identifier"><input value={audienceLabel} onChange={e => setAudienceLabel(e.target.value)} placeholder="e.g. NEET 2027 · Batch A" /></Field>}{audience === 'selected' && <div className="mts-students">{students.map(student => <button key={student.id} className={selectedStudents.includes(student.id) ? 'picked' : ''} onClick={() => toggleStudent(student.id)}><span>{selectedStudents.includes(student.id) ? '✓' : '+'}</span><div><b>{student.display_name || 'Student'}</b><small>{student.email || student.id}</small></div></button>)}</div>}</div>
        <div className="mts-card"><div className="mts-card-title"><div><span>RESULTS</span><h3>What students see</h3></div></div><div className="mts-grid two"><Field label="Result release"><select value={resultRelease} onChange={e => setResultRelease(e.target.value)}><option value="immediate">Immediately</option><option value="after_submit">After submission</option><option value="after_close">After exam closes</option><option value="hidden">Keep hidden</option></select></Field><Field label="Pass percentage"><input type="number" min="0" max="100" value={passPercentage} onChange={e => setPassPercentage(Number(e.target.value) || 0)} /></Field></div><div className="mts-rule-grid"><Rule title="Show solutions" text="Release explanations with results." value={showSolutions} setValue={setShowSolutions} /><Rule title="Show answer key" text="Expose the final correct options." value={showAnswerKey} setValue={setShowAnswerKey} /><Rule title="Show rank" text="Compare performance within the audience." value={showRank} setValue={setShowRank} /><Rule title="Show percentile" text="Display percentile alongside marks." value={showPercentile} setValue={setShowPercentile} /></div></div>
        <Field label="Exam instructions"><textarea value={instructions} onChange={e => setInstructions(e.target.value)} /></Field>
      </section>}

      {step === 'review' && <section className="mts-section">
        <div className="mts-review-hero"><div><span>READY TO PUBLISH</span><h2>{title || 'Untitled mock test'}</h2><p>{description || 'No description'}</p></div><div><strong>{selectedQuestions.length}</strong><small>questions</small><strong>{maxMarks}</strong><small>maximum marks</small><strong>{duration}</strong><small>minutes</small></div></div>
        <div className="mts-summary"><Summary label="Pattern" value={preset === 'neet' ? 'NEET Full Mock · 2026 pattern' : 'Custom mock'} /><Summary label="Blueprint" value={`Physics ${counts.Physics} · Chemistry ${counts.Chemistry} · Biology ${counts.Biology}`} /><Summary label="Marking" value={`+${positive} / -${negative} / 0`} /><Summary label="Audience" value={audience === 'all' ? 'All students' : audience === 'batch' ? audienceLabel || 'Batch not set' : `${selectedStudents.length} selected students`} /><Summary label="Schedule" value={start ? new Date(start).toLocaleString() : 'Not scheduled'} /><Summary label="Results" value={`${resultRelease.replace('_', ' ')} · ${showRank ? 'rank' : 'no rank'} · ${showPercentile ? 'percentile' : 'no percentile'}`} /></div>
        {message && <div className="mts-message">{message}</div>}
        <div className="mts-publish"><button onClick={() => save('draft')} disabled={saving}>Save draft</button><button className="mts-primary" onClick={() => save('published')} disabled={saving}>{saving ? 'Saving…' : 'Publish exam ↗'}</button></div>
      </section>}

      <footer className="mts-footer"><button onClick={onClose}>Cancel</button><div>{step !== 'setup' && <button onClick={() => setStep(steps[Math.max(0, steps.findIndex(x => x.id === step) - 1)].id)}>← Back</button>}{step !== 'review' && <button className="mts-primary" onClick={() => setStep(steps[Math.min(steps.length - 1, steps.findIndex(x => x.id === step) + 1)].id)}>Continue →</button>}</div></footer>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mts-field"><span>{label}</span>{children}</label>; }
function Rule({ title, text, value, setValue }: { title: string; text: string; value: boolean; setValue: (value: boolean) => void }) { return <button className="mts-rule" onClick={() => setValue(!value)}><span><b>{title}</b><small>{text}</small></span><i className={value ? 'on' : ''}>{value ? '✓' : ''}</i></button>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

const css = `
.mts-backdrop{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.72);backdrop-filter:blur(18px);display:grid;place-items:center;padding:18px}.mts-modal{width:min(1120px,100%);max-height:94vh;overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:28px;background:#0d1113;color:#edf2f3;box-shadow:0 40px 140px rgba(0,0,0,.6);font-family:Inter,ui-sans-serif,system-ui}.mts-header{display:flex;justify-content:space-between;gap:24px;padding:28px 30px 22px;border-bottom:1px solid rgba(255,255,255,.07);position:sticky;top:0;background:rgba(13,17,19,.94);backdrop-filter:blur(18px);z-index:2}.mts-header>div>span,.mts-card-title span,.mts-toolbar>div>span,.mts-review-hero span{font-size:9px;font-weight:950;letter-spacing:.18em;color:#58d0c0}.mts-header h1{font-size:34px;letter-spacing:-.06em;margin:8px 0}.mts-header p{margin:0;color:#77858d;font-size:13px}.mts-close{border:0;background:rgba(255,255,255,.06);color:#9ba7ad;width:34px;height:34px;border-radius:10px;font-size:21px;cursor:pointer}.mts-steps{display:flex;gap:6px;padding:12px 30px;border-bottom:1px solid rgba(255,255,255,.06);overflow:auto}.mts-steps button{border:0;background:transparent;color:#69767e;padding:8px 11px;border-radius:11px;display:flex;gap:7px;align-items:center;font:inherit;font-size:10px;font-weight:850;white-space:nowrap;cursor:pointer}.mts-steps button b{width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.05);display:grid;place-items:center}.mts-steps button.active{background:rgba(88,208,192,.08);color:#dfe9e9}.mts-steps button.active b{background:#58d0c0;color:#071011}.mts-section{padding:24px 30px}.mts-grid{display:grid;gap:12px}.mts-grid.two{grid-template-columns:1fr 1fr}.mts-grid.three{grid-template-columns:repeat(3,1fr)}.mts-field{display:block;color:#7d8990;font-size:10px;font-weight:850}.mts-field>span{display:block}.mts-field input,.mts-field select,.mts-field textarea{width:100%;box-sizing:border-box;margin-top:7px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025);color:#e8edef;padding:11px 12px;font:inherit;font-size:12px;outline:none}.mts-field textarea{min-height:95px;resize:vertical;line-height:1.5}.mts-card{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:18px;padding:18px;margin:14px 0}.mts-card-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.mts-card-title h3{margin:5px 0 0;font-size:18px;letter-spacing:-.04em}.mts-card-title>b{font-size:11px;color:#58d0c0}.mts-subjects{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:14px}.mts-subject{display:grid;grid-template-columns:1fr 72px;gap:8px;align-items:center;padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:13px}.mts-subject strong,.mts-subject small{display:block}.mts-subject small{font-size:9px;color:#68757d;margin-top:3px}.mts-subject input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.08);background:#11171a;color:#e8edef;border-radius:9px;padding:8px;font-weight:900}.mts-subject>span{grid-column:1/-1;color:#69767e;font-size:9px}.mts-note{margin-top:12px;padding:10px 12px;border-radius:11px;background:rgba(88,208,192,.05);color:#7e8c93;font-size:10px;line-height:1.5}.mts-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px}.mts-toolbar h2{margin:5px 0 0;font-size:24px;letter-spacing:-.05em}.mts-primary{border:0;border-radius:12px;background:#58d0c0;color:#071011;padding:11px 14px;font:inherit;font-size:11px;font-weight:950;cursor:pointer}.mts-primary:disabled{opacity:.5;cursor:wait}.mts-tabs{display:flex;gap:5px;overflow:auto;margin:15px 0 9px}.mts-tabs button,.mts-selection button,.mts-publish>button:first-child,.mts-footer>button,.mts-footer div button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#829097;border-radius:10px;padding:9px 11px;font:inherit;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.mts-tabs button.active{background:rgba(88,208,192,.09);color:#58d0c0;border-color:rgba(88,208,192,.22)}.mts-search input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#edf2f3;border-radius:11px;padding:11px;font:inherit;font-size:11px;outline:none}.mts-pool{max-height:410px;overflow:auto;border:1px solid rgba(255,255,255,.07);border-radius:14px;margin-top:9px}.mts-pool button,.mts-students button{width:100%;display:grid;grid-template-columns:24px 1fr;gap:8px;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.05);background:transparent;color:#e4eaec;padding:11px;cursor:pointer}.mts-pool button:hover,.mts-pool button.picked,.mts-students button.picked{background:rgba(88,208,192,.06)}.mts-pool button>span,.mts-students button>span{color:#58d0c0;font-weight:950}.mts-pool small,.mts-pool b,.mts-students small,.mts-students b{display:block}.mts-pool small,.mts-students small{font-size:9px;color:#65727a}.mts-pool b{font-size:10px;line-height:1.4;margin-top:3px}.mts-selection{display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:#77848b;font-size:10px}.mts-rule-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.mts-rule{display:flex;justify-content:space-between;align-items:center;text-align:left;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);border-radius:13px;padding:12px;color:#e7ecee;cursor:pointer}.mts-rule b,.mts-rule small{display:block}.mts-rule b{font-size:11px}.mts-rule small{color:#69767e;font-size:9px;margin-top:3px}.mts-rule i{width:25px;height:25px;border-radius:8px;border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;color:transparent;font-style:normal}.mts-rule i.on{background:#58d0c0;color:#071011;border-color:#58d0c0}.mts-access-tabs{display:flex;gap:6px;margin:12px 0}.mts-access-tabs button{border:1px solid rgba(255,255,255,.08);background:transparent;color:#7b888f;border-radius:10px;padding:9px 11px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.mts-access-tabs button.active{background:rgba(88,208,192,.08);color:#58d0c0}.mts-students{max-height:230px;overflow:auto;border:1px solid rgba(255,255,255,.07);border-radius:12px}.mts-students button{grid-template-columns:24px 1fr}.mts-review-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;border:1px solid rgba(88,208,192,.14);border-radius:19px;padding:20px;background:radial-gradient(circle at 90% 20%,rgba(88,208,192,.1),transparent 35%),rgba(255,255,255,.025)}.mts-review-hero h2{font-size:28px;letter-spacing:-.05em;margin:7px 0}.mts-review-hero p{color:#738088;font-size:11px}.mts-review-hero>div:last-child{display:grid;grid-template-columns:repeat(3,auto);gap:3px 13px;text-align:right}.mts-review-hero strong{font-size:22px;grid-row:1}.mts-review-hero small{font-size:8px;color:#68757d}.mts-summary{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-top:12px}.mts-summary>div{background:#101517;padding:12px}.mts-summary span,.mts-summary b{display:block}.mts-summary span{color:#68757d;font-size:9px}.mts-summary b{font-size:10px;margin-top:4px}.mts-message{margin-top:12px;border:1px solid rgba(88,208,192,.18);background:rgba(88,208,192,.06);color:#9dc8c3;padding:10px 12px;border-radius:11px;font-size:10px}.mts-publish{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.mts-footer{display:flex;justify-content:space-between;padding:14px 30px;border-top:1px solid rgba(255,255,255,.07);position:sticky;bottom:0;background:rgba(13,17,19,.94);backdrop-filter:blur(18px)}.mts-footer div{display:flex;gap:7px}.mts-loading{padding:80px;text-align:center;color:#7e8b92}.mts-empty{padding:35px;text-align:center;color:#6e7a81;font-size:11px}
@media(max-width:760px){.mts-modal{max-height:96vh;border-radius:20px}.mts-header,.mts-section,.mts-footer{padding-left:17px;padding-right:17px}.mts-grid.two,.mts-grid.three,.mts-subjects,.mts-rule-grid{grid-template-columns:1fr}.mts-review-hero{display:block}.mts-review-hero>div:last-child{margin-top:18px;text-align:left}.mts-summary{grid-template-columns:1fr}.mts-steps{padding-left:17px;padding-right:17px}}
`;