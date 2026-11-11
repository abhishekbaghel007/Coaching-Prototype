import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type MockQuestion = {
  id: string;
  mock_key: string;
  question_number: number;
  subject: 'Physics' | 'Chemistry' | 'Biology';
  question_text: string;
  options: string[];
  correct_index: number | null;
  explanation: string | null;
};

type Props = {
  mockKey: string;
  mockTitle: string;
  onClose: () => void;
};

type Filter = 'all' | 'incorrect' | 'unanswered';

const LABELS = ['A', 'B', 'C', 'D'];

export default function MockQuestionAnalysis({ mockKey, mockTitle, onClose }: Props) {
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const currentUserId = sessionData.session?.user.id ?? null;
        if (!currentUserId) {
          if (active) {
            setUserId(null);
            setQuestions([]);
            setLoading(false);
          }
          return;
        }

        const { data: questionRows, error: questionError } = await supabase
          .from('mock_series_questions')
          .select('id,mock_key,question_number,subject,question_text,options,correct_index,explanation')
          .eq('mock_key', mockKey)
          .order('question_number', { ascending: true });

        if (questionError) throw questionError;

        const typedQuestions = (questionRows ?? []) as MockQuestion[];
        const questionIds = typedQuestions.map(question => question.id);
        let responseRows: Array<{ question_id: string; selected_index: number }> = [];

        if (questionIds.length) {
          const { data, error } = await supabase
            .from('mock_series_responses')
            .select('question_id,selected_index')
            .eq('user_id', currentUserId)
            .in('question_id', questionIds);
          if (error) throw error;
          responseRows = (data ?? []) as Array<{ question_id: string; selected_index: number }>;
        }

        if (!active) return;
        const responseMap: Record<string, number> = {};
        responseRows.forEach(row => { responseMap[row.question_id] = row.selected_index; });
        setUserId(currentUserId);
        setQuestions(typedQuestions);
        setResponses(responseMap);
      } catch (error) {
        console.error('Could not load mock question analysis', error);
        if (active) setLoadError('Question analysis could not be loaded. Check your connection and Supabase access.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [mockKey]);

  const wrongCount = useMemo(() => questions.filter(question => {
    const selected = responses[question.id];
    return selected !== undefined && question.correct_index !== null && selected !== question.correct_index;
  }).length, [questions, responses]);

  const unansweredCount = useMemo(
    () => questions.filter(question => responses[question.id] === undefined).length,
    [questions, responses],
  );

  const visibleQuestions = useMemo(() => questions.filter(question => {
    const selected = responses[question.id];
    if (filter === 'incorrect') {
      return selected !== undefined && question.correct_index !== null && selected !== question.correct_index;
    }
    if (filter === 'unanswered') return selected === undefined;
    return true;
  }), [filter, questions, responses]);

  async function recordAnswer(question: MockQuestion, selectedIndex: number) {
    if (!userId) return;
    setSaveError('');
    setSavingId(question.id);
    const previous = responses[question.id];
    setResponses(current => ({ ...current, [question.id]: selectedIndex }));

    const { error } = await supabase
      .from('mock_series_responses')
      .upsert({
        user_id: userId,
        question_id: question.id,
        selected_index: selectedIndex,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,question_id' });

    if (error) {
      setResponses(current => {
        const next = { ...current };
        if (previous === undefined) delete next[question.id];
        else next[question.id] = previous;
        return next;
      });
      setSaveError('Your selected option could not be saved. Please retry.');
    }
    setSavingId(null);
  }

  return (
    <section className="mock-analysis">
      <style>{css}</style>
      <div className="mock-analysis-head">
        <div>
          <span className="section-kicker">QUESTION-WISE REVIEW</span>
          <h3>{mockTitle}</h3>
          <p>Text-only analysis. No question images or diagrams are displayed.</p>
        </div>
        <button className="mock-analysis-close" onClick={onClose} aria-label="Close analysis">×</button>
      </div>

      {!userId && !loading && (
        <div className="mock-analysis-empty">
          Sign in to save your selected options and review incorrect answers.
        </div>
      )}

      {loadError && <div className="mock-analysis-error">{loadError}</div>}

      {loading ? (
        <div className="mock-analysis-empty">Loading question-wise analysis…</div>
      ) : userId && !loadError && questions.length === 0 ? (
        <div className="mock-analysis-empty">
          <b>Question mapping is pending.</b>
          <span>The uploaded PDFs contain the question papers and an OMR-sheet link, but no marked options or official answer key. I have not invented which questions you got wrong. Once the correct options are mapped, you can select what you marked and this page will show only incorrect questions with your selected option and the correct answer.</span>
        </div>
      ) : questions.length > 0 ? (
        <>
          <div className="mock-analysis-stats">
            <div><small>QUESTIONS</small><b>{questions.length}</b></div>
            <div><small>INCORRECT</small><b>{wrongCount}</b></div>
            <div><small>UNANSWERED</small><b>{unansweredCount}</b></div>
          </div>
          <div className="mock-analysis-filters">
            {([
              ['all', 'All questions'],
              ['incorrect', `Incorrect · ${wrongCount}`],
              ['unanswered', `Unanswered · ${unansweredCount}`],
            ] as Array<[Filter, string]>).map(([value, label]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          {saveError && <div className="mock-analysis-error">{saveError}</div>}
          <div className="mock-analysis-list">
            {visibleQuestions.map(question => {
              const selected = responses[question.id];
              const hasKey = question.correct_index !== null;
              const isWrong = selected !== undefined && hasKey && selected !== question.correct_index;
              const isCorrect = selected !== undefined && hasKey && selected === question.correct_index;

              return (
                <article className="mock-analysis-question" key={question.id}>
                  <div className="mock-analysis-qtop">
                    <b>Q{question.question_number}</b>
                    <span>{question.subject}</span>
                    {isWrong && <em className="wrong">Incorrect</em>}
                    {isCorrect && <em className="correct">Correct</em>}
                  </div>
                  <p className="mock-analysis-stem">{question.question_text}</p>
                  <div className="mock-analysis-options">
                    {question.options.map((option, index) => {
                      const isSelected = selected === index;
                      const isAnswer = question.correct_index === index;
                      const state = isSelected && isWrong ? 'selected-wrong' : isAnswer && selected !== undefined ? 'correct-answer' : isSelected ? 'selected' : '';
                      return (
                        <button
                          key={index}
                          type="button"
                          className={state}
                          disabled={savingId === question.id}
                          onClick={() => void recordAnswer(question, index)}
                        >
                          <b>{LABELS[index]}.</b>
                          <span>{option}</span>
                          {isSelected && <small>Your choice</small>}
                          {isAnswer && selected !== undefined && <small>Correct answer</small>}
                        </button>
                      );
                    })}
                  </div>
                  {selected !== undefined && !hasKey && (
                    <p className="mock-analysis-answer-pending">Your selected option is saved. The correct answer is still being checked.</p>
                  )}
                  {isWrong && (
                    <p className="mock-analysis-correction">
                      Your answer: <b>{LABELS[selected]}</b> · Correct answer: <b>{LABELS[question.correct_index as number]}</b>
                    </p>
                  )}
                  {question.explanation && <p className="mock-analysis-explanation">{question.explanation}</p>}
                </article>
              );
            })}
            {visibleQuestions.length === 0 && (
              <div className="mock-analysis-empty">No questions match this filter yet.</div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

const css = `
.mock-analysis{margin-top:18px;padding:18px;border:1px solid var(--app-line);border-radius:17px;background:var(--app-panel)}
.mock-analysis-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.mock-analysis-head h3{margin:5px 0;color:var(--text);font-size:18px;letter-spacing:-.35px}
.mock-analysis-head p{margin:0;color:var(--app-muted);font-size:10px;line-height:1.5}
.mock-analysis-close{width:30px;height:30px;flex:none;border:1px solid var(--app-line);border-radius:9px;background:transparent;color:var(--text);font-size:19px;cursor:pointer}
.mock-analysis-empty{display:grid;gap:7px;margin-top:14px;padding:15px;border:1px dashed var(--app-line);border-radius:12px;color:var(--app-muted);font-size:11px;line-height:1.6}
.mock-analysis-empty b{color:var(--text)}
.mock-analysis-error{margin-top:12px;padding:10px 12px;border:1px solid rgba(220,90,90,.28);border-radius:10px;color:var(--app-muted);font-size:10px}
.mock-analysis-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:15px}
.mock-analysis-stats>div{padding:11px;border:1px solid var(--app-line);border-radius:11px}
.mock-analysis-stats small{display:block;color:var(--app-muted);font-size:8px;font-weight:900;letter-spacing:.08em}
.mock-analysis-stats b{display:block;margin-top:4px;color:var(--text);font-size:18px}
.mock-analysis-filters{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}
.mock-analysis-filters button{padding:8px 11px;border:1px solid var(--app-line);border-radius:9px;background:transparent;color:var(--app-muted);font-size:9px;font-weight:800;cursor:pointer}
.mock-analysis-filters button.active{border-color:var(--apple-blue);color:var(--text);background:color-mix(in srgb,var(--apple-blue) 9%,transparent)}
.mock-analysis-list{display:grid;gap:10px}
.mock-analysis-question{padding:14px;border:1px solid var(--app-line);border-radius:12px;background:color-mix(in srgb,var(--text) 2%,transparent)}
.mock-analysis-qtop{display:flex;align-items:center;gap:8px}
.mock-analysis-qtop>b{color:var(--text);font-size:11px}
.mock-analysis-qtop>span{color:var(--app-muted);font-size:9px}
.mock-analysis-qtop em{margin-left:auto;font-size:8px;font-style:normal;font-weight:900;letter-spacing:.04em}
.mock-analysis-qtop em.wrong{color:#e28b83}
.mock-analysis-qtop em.correct{color:#62c99b}
.mock-analysis-stem{margin:11px 0;color:var(--text);font-size:12px;line-height:1.65;white-space:pre-wrap}
.mock-analysis-options{display:grid;gap:6px}
.mock-analysis-options button{display:flex;align-items:flex-start;gap:8px;width:100%;padding:9px 10px;border:1px solid var(--app-line);border-radius:9px;background:transparent;color:var(--app-muted);text-align:left;font-size:10px;line-height:1.5;cursor:pointer}
.mock-analysis-options button b{flex:none;color:var(--text);font-size:10px}
.mock-analysis-options button span{flex:1}
.mock-analysis-options button small{flex:none;color:var(--app-muted);font-size:8px;font-weight:800}
.mock-analysis-options button.selected{border-color:var(--apple-blue);background:color-mix(in srgb,var(--apple-blue) 8%,transparent);color:var(--text)}
.mock-analysis-options button.selected-wrong{border-color:#d77d75;background:rgba(215,125,117,.08);color:var(--text)}
.mock-analysis-options button.correct-answer{border-color:#54b68a;background:rgba(84,182,138,.08);color:var(--text)}
.mock-analysis-answer-pending,.mock-analysis-correction,.mock-analysis-explanation{margin:9px 0 0;padding:9px 10px;border-radius:8px;background:color-mix(in srgb,var(--text) 4%,transparent);color:var(--app-muted);font-size:10px;line-height:1.5}
.mock-analysis-correction b{color:var(--text)}
.mock-analysis-explanation{white-space:pre-wrap}
@media(max-width:520px){.mock-analysis{padding:13px}.mock-analysis-stats{gap:5px}.mock-analysis-stats>div{padding:9px}.mock-analysis-stats b{font-size:16px}.mock-analysis-options button{flex-wrap:wrap}.mock-analysis-options button small{margin-left:25px}}
`;
