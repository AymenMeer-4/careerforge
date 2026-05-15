'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

type Level = 'low' | 'mid' | 'high';

interface SkillDescription {
  skill_key: string;
  skill_canonical_name: string;
  description_en: string;
  description_ar: string;
  suggested_level: Level;
  reasoning_en: string;
  reasoning_ar: string;
}

interface CurrentSkill {
  id: string;
  skill_key: string;
  skill_canonical_name: string;
  description_en: string;
  description_ar: string;
  proficiency_level: Level;
  proficiency_score: number;
  ai_suggested_level: string | null;
  reasoning_en: string;
  reasoning_ar: string;
  fully_approved: boolean;
  validation_status: string;
  validation_questions: any;
  validation_responses: any;
  validation_score: number | null;
  validation_notes: string | null;
  market_demand_count: number;
}

interface DerivedSkill {
  skill_key: string;
  skill_canonical_name: string;
  source: string;
  source_detail: string;
}

interface RequiredSkill {
  skill_key: string;
  avg_importance: number;
  job_count: number;
}

interface VQuestion { id: string; question_en: string; question_ar: string; }
interface VScore { question_id: string; score: number; feedback_en: string; feedback_ar: string; }

const LEVEL_KEY: Record<Level, string> = {
  low: 'skills.level_low', mid: 'skills.level_mid', high: 'skills.level_high',
};

export default function SkillsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // Section A — conversational flow
  const [input, setInput] = useState('');
  const [describing, setDescribing] = useState(false);
  const [bubble, setBubble] = useState<SkillDescription | null>(null);
  const [iterations, setIterations] = useState<{ ai_output: SkillDescription; student_feedback: string }[]>([]);
  const [showRefine, setShowRefine] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flowError, setFlowError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Section B/C data
  const [current, setCurrent] = useState<CurrentSkill[]>([]);
  const [derived, setDerived] = useState<DerivedSkill[]>([]);
  const [required, setRequired] = useState<RequiredSkill[]>([]);
  const [targetRole, setTargetRole] = useState<string | null>(null);

  // modals
  const [validationDraft, setValidationDraft] = useState<{ desc: SkillDescription; iteration_count: number; fully_approved: boolean } | null>(null);
  const [detail, setDetail] = useState<CurrentSkill | DerivedSkill | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const tr = (key: string, vars: Record<string, string | number>) => {
    let s = t(key);
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  const refresh = useCallback(async () => {
    const [cRes, rRes] = await Promise.all([
      fetch('/api/skills/current'),
      fetch('/api/skills/required'),
    ]);
    if (cRes.ok) {
      const d = await cRes.json();
      setCurrent(d.current || []);
      setDerived(d.derived || []);
    }
    if (rRes.ok) {
      const d = await rRes.json();
      setRequired(d.required || []);
      setTargetRole(d.target_role || null);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => { if (r.status === 401) { router.push('/login'); return null; } return r.json(); })
      .then(async data => { if (data) { setSession(data); await refresh(); } })
      .finally(() => setLoading(false));
  }, [router, refresh]);

  // ── conversational flow ──────────────────────────────────────────────────────
  const describe = async (skillInput: string, history: typeof iterations) => {
    setDescribing(true);
    setFlowError('');
    try {
      const res = await fetch('/api/skills/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_input: skillInput, iteration_history: history }),
      });
      const data = await res.json();
      if (!res.ok) { setFlowError(data.error || 'Failed to analyze skill.'); return null; }
      return data as SkillDescription;
    } catch {
      setFlowError('Network error. Please try again.');
      return null;
    } finally {
      setDescribing(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || describing) return;
    setSaveError('');
    const desc = await describe(input.trim(), []);
    if (desc) {
      setBubble(desc);
      setIterations([]);
      setShowRefine(false);
      setRefineText('');
    }
  };

  const handleRefine = async () => {
    if (!bubble || !refineText.trim() || describing) return;
    const newHistory = [...iterations, { ai_output: bubble, student_feedback: refineText.trim() }];
    const desc = await describe(bubble.skill_canonical_name, newHistory);
    if (!desc) return;
    setIterations(newHistory);
    setBubble(desc);
    setShowRefine(false);
    setRefineText('');
    // 5-iteration hard cap: force-save (unvalidated) at the AI-suggested level.
    if (newHistory.length >= 5) {
      const ok = await persistSkill({
        desc, level: desc.suggested_level, validation_status: 'skipped',
        iteration_count: newHistory.length, fully_approved: false,
      });
      if (ok) resetFlow();
    }
  };

  const persistSkill = async (opts: {
    desc: SkillDescription; level: Level; validation_status: string;
    iteration_count: number; fully_approved: boolean;
    validation_questions?: any; validation_responses?: any;
    validation_score?: number | null; validation_notes?: string | null;
  }): Promise<boolean> => {
    setSaveError('');
    try {
      const res = await fetch('/api/skills/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_key: opts.desc.skill_key,
          skill_canonical_name: opts.desc.skill_canonical_name,
          description_en: opts.desc.description_en,
          description_ar: opts.desc.description_ar,
          proficiency_level: opts.level,
          ai_suggested_level: opts.desc.suggested_level,
          reasoning_en: opts.desc.reasoning_en,
          reasoning_ar: opts.desc.reasoning_ar,
          iteration_count: opts.iteration_count,
          fully_approved: opts.fully_approved,
          validation_status: opts.validation_status,
          validation_questions: opts.validation_questions ?? null,
          validation_responses: opts.validation_responses ?? null,
          validation_score: opts.validation_score ?? null,
          validation_notes: opts.validation_notes ?? null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error || 'Could not save the skill. Please try again.');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setSaveError('Network error while saving. Please try again.');
      return false;
    }
  };

  const resetFlow = () => {
    setBubble(null);
    setInput('');
    setIterations([]);
    setShowRefine(false);
    setRefineText('');
    setEditingId(null);
  };

  // Every skill — whatever its level — goes through the 3-question check.
  const handleValidateAndSave = () => {
    if (!bubble) return;
    setSaveError('');
    setValidationDraft({ desc: bubble, iteration_count: iterations.length, fully_approved: true });
  };

  const handleEdit = (s: CurrentSkill) => {
    const desc: SkillDescription = {
      skill_key: s.skill_key,
      skill_canonical_name: s.skill_canonical_name,
      description_en: s.description_en,
      description_ar: s.description_ar,
      suggested_level: (s.ai_suggested_level as Level) || s.proficiency_level,
      reasoning_en: s.reasoning_en,
      reasoning_ar: s.reasoning_ar,
    };
    setBubble(desc);
    setIterations([]);
    setEditingId(s.id);
    setDetail(null);
    setSaveError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
  };

  // ── validation modal completion ──────────────────────────────────────────────
  const onValidationComplete = async (opts: {
    level: Level; validation_status: string;
    validation_questions?: any; validation_responses?: any;
    validation_score?: number | null; validation_notes?: string | null;
  }) => {
    if (!validationDraft) return;
    const ok = await persistSkill({
      desc: validationDraft.desc,
      level: opts.level,
      validation_status: opts.validation_status,
      iteration_count: validationDraft.iteration_count,
      fully_approved: validationDraft.fully_approved,
      validation_questions: opts.validation_questions,
      validation_responses: opts.validation_responses,
      validation_score: opts.validation_score,
      validation_notes: opts.validation_notes,
    });
    setValidationDraft(null);
    if (ok) resetFlow();
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!session) return null;

  const desc = (o: { description_en: string; description_ar: string }) => ar ? o.description_ar : o.description_en;
  const reason = (o: { reasoning_en: string; reasoning_ar: string }) => ar ? o.reasoning_ar : o.reasoning_en;

  // Section C — status chips
  const haveKeys = new Set([...current.map(s => s.skill_key), ...derived.map(s => s.skill_key)]);
  const needSkills = required.filter(r => !haveKeys.has(r.skill_key));

  return (
    <div className="skills-page">
      <header className="skills-page-header">
        <h1 className="auth-title">{t('skills.title')}</h1>
        <p className="skills-page-subtitle">{t('skills.subtitle')}</p>
      </header>

      {/* ══ SECTION A — Add a skill ══ */}
      <div className="profile-section">
        <h2 className="profile-section-title">{t('skills.add_title')}</h2>
        <form className="skill-input-row" onSubmit={handleAdd}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('skills.add_placeholder')}
            disabled={describing}
          />
          <button type="submit" className="btn-save" disabled={describing || !input.trim()}>
            {t('skills.add_button')}
          </button>
        </form>

        {describing && (
          <div className="skill-loading"><div className="spinner" />{t('skills.analyzing')}</div>
        )}
        {flowError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.6rem' }}>{flowError}</p>}

        {bubble && !describing && (
          <div className="skill-bubble">
            <div className="skill-bubble-name">{bubble.skill_canonical_name}</div>
            <p className="skill-bubble-desc">{desc(bubble)}</p>
            <p className="skill-bubble-reasoning">{reason(bubble)}</p>
            <p className="skill-bubble-reasoning" style={{ marginTop: 0 }}>
              {t('skills.validation_intro')}
            </p>

            <div className="skill-bubble-actions">
              <button className="btn-save" onClick={handleValidateAndSave}>
                {t('skills.validate_and_save')}
              </button>
              {iterations.length < 5 && (
                <button className="btn-ghost" onClick={() => setShowRefine(s => !s)}>{t('skills.not_quite')}</button>
              )}
            </div>

            {showRefine && (
              <div className="skill-refine">
                <textarea
                  value={refineText}
                  onChange={e => setRefineText(e.target.value)}
                  placeholder={t('skills.refine_placeholder')}
                />
                <div className="skill-bubble-actions" style={{ marginTop: '0.5rem' }}>
                  <button className="btn-save" onClick={handleRefine} disabled={!refineText.trim()}>
                    {t('skills.refine_submit')}
                  </button>
                </div>
              </div>
            )}
            {iterations.length >= 4 && (
              <p className="skill-bubble-reasoning" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                {iterations.length}/5 {t('skills.needs_review')}
              </p>
            )}
            {saveError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.6rem' }}>{saveError}</p>
            )}
          </div>
        )}
        {bubble && (
          <button className="btn-ghost" style={{ marginTop: '0.8rem' }} onClick={resetFlow}>
            {t('skills.done_adding')}
          </button>
        )}
      </div>

      {/* ══ SECTION B — current + required ══ */}
      <div className="skills-two-col">
        <div className="profile-section">
          <h2 className="profile-section-title">{t('skills.your_skills')}</h2>
          {current.length === 0 && derived.length === 0 && (
            <p className="experience-meta">{t('skills.empty_current')}</p>
          )}
          {current.map(s => (
            <SkillRow key={s.id} s={s} t={t} tr={tr} onInfo={() => setDetail(s)} onDelete={() => handleDelete(s.id)} />
          ))}
          {derived.length > 0 && (
            <p className="experience-meta" style={{ marginTop: '1rem', marginBottom: '0.3rem' }}>
              {t('skills.derived_label')}
            </p>
          )}
          {derived.map(d => (
            <div key={d.skill_key} className="skill-row derived">
              <div className="skill-row-top">
                <span className="skill-row-name">{d.skill_canonical_name}</span>
                <button className="skill-info-btn" onClick={() => setDetail(d)}>i</button>
              </div>
              <div className="skill-bar"><div className="skill-bar-fill" style={{ width: '25%' }} /></div>
            </div>
          ))}
        </div>

        <div className="profile-section">
          <h2 className="profile-section-title">
            {tr('skills.required_skills', { role: String(targetRole || '').replace(/_/g, ' ') })}
          </h2>
          {required.length === 0 && <p className="experience-meta">{t('skills.no_required')}</p>}
          {required.map(r => (
            <div key={r.skill_key} className="req-skill-row">
              <span className="req-skill-name">{r.skill_key.replace(/-/g, ' ')}</span>
              <span className="import-stars">{'★'.repeat(Math.round(r.avg_importance))}</span>
              <span className="req-skill-meta">{tr('skills.jobs_count', { n: r.job_count })}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SECTION C — status overview ══ */}
      <div className="profile-section">
        <h2 className="profile-section-title">{t('skills.status_have')} / {t('skills.status_need')}</h2>
        <div className="status-chips">
          {[...current.map(s => s.skill_canonical_name), ...derived.map(d => d.skill_canonical_name)].map((n, i) => (
            <span key={`h${i}`} className="status-chip have">✓ {n}</span>
          ))}
          {needSkills.map(r => (
            <span key={`n${r.skill_key}`} className="status-chip need">+ {r.skill_key.replace(/-/g, ' ')}</span>
          ))}
        </div>
      </div>

      {/* ══ Validation modal ══ */}
      {validationDraft && (
        <ValidationModal
          draft={validationDraft}
          t={t} tr={tr} ar={ar}
          onClose={() => setValidationDraft(null)}
          onComplete={onValidationComplete}
        />
      )}

      {/* ══ Detail modal ══ */}
      {detail && (
        <DetailModal detail={detail} t={t} tr={tr} ar={ar}
          onClose={() => setDetail(null)}
          onEdit={'id' in detail ? () => handleEdit(detail as CurrentSkill) : undefined}
        />
      )}
    </div>
  );
}

// ════════════ Skill row ════════════
function SkillRow({ s, t, tr, onInfo, onDelete }: {
  s: CurrentSkill; t: (k: string) => string; tr: any; onInfo: () => void; onDelete: () => void;
}) {
  // Validation now applies to every skill, not just High.
  let badge: { cls: string; label: string } | null = null;
  if (s.validation_status === 'validated')
    badge = { cls: 'badge-valid', label: t('skills.validated') };
  else if (s.validation_status === 'skipped' || s.validation_status === 'failed')
    badge = { cls: 'badge-unvalid', label: t('skills.unvalidated') };

  const hoverText = s.validation_notes
    ? `${s.validation_notes}${s.validation_score != null ? ` (${tr('skills.avg_score', { score: s.validation_score })})` : ''}`
    : '';

  return (
    <div className="skill-row">
      <div className="skill-row-top">
        <span className="skill-row-name">{s.skill_canonical_name}</span>
        <span className="badge badge-level">{t(LEVEL_KEY[s.proficiency_level])}</span>
        {badge && <span className={`badge ${badge.cls}`} title={hoverText}>{badge.label}</span>}
        {s.market_demand_count >= 3 && <span className="badge badge-demand">🔥 {t('skills.in_demand')}</span>}
        {!s.fully_approved && <span className="badge badge-review">{t('skills.needs_review')}</span>}
        <button className="skill-info-btn" onClick={onInfo}>i</button>
      </div>
      <div className="skill-bar">
        <div className="skill-bar-fill" style={{ width: `${s.proficiency_score}%` }} />
      </div>
      <div className="skill-bar-pct">
        {s.proficiency_score}%
        <button className="skill-del-btn" style={{ marginInlineStart: '0.6rem' }} onClick={onDelete}>
          {t('skills.delete')}
        </button>
      </div>
    </div>
  );
}

// ════════════ Validation modal ════════════
function ValidationModal({ draft, t, tr, ar, onClose, onComplete }: {
  draft: { desc: SkillDescription; iteration_count: number; fully_approved: boolean };
  t: (k: string) => string; tr: any; ar: boolean;
  onClose: () => void;
  onComplete: (o: any) => void;
}) {
  type Phase = 'initial' | 'answering' | 'scoring' | 'result' | 'start_error';
  const [phase, setPhase] = useState<Phase>('initial');
  const [questions, setQuestions] = useState<VQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    scores: VScore[]; avg_score: number; reasoning_en: string; reasoning_ar: string;
    determined_level: 'low' | 'mid' | 'high';
  } | null>(null);

  const { desc } = draft;
  const levelLabel = (lvl: 'low' | 'mid' | 'high') => t(LEVEL_KEY[lvl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/skills/validate-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skill_key: desc.skill_key,
            skill_canonical_name: desc.skill_canonical_name,
            description_en: desc.description_en,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setPhase('start_error'); return; }
        setQuestions(data.questions || []);
        setPhase('answering');
      } catch {
        if (!cancelled) setPhase('start_error');
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allAnswered = questions.length > 0 &&
    questions.every(q => (answers[q.id] || '').trim().length >= 30);

  const responsesPayload = () =>
    questions.map(q => ({ question_id: q.id, answer: (answers[q.id] || '').trim() }));

  const submitAnswers = async () => {
    setPhase('scoring');
    const responses = responsesPayload();
    try {
      const res = await fetch('/api/skills/validate-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_canonical_name: desc.skill_canonical_name,
          questions, responses,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.scoring_failed) {
        // Real failure — save at the AI-suggested level, marked failed. No fake level.
        onComplete({
          level: desc.suggested_level, validation_status: 'failed',
          validation_questions: questions, validation_responses: responses,
          validation_notes: data.validation_notes || data.error || 'Scoring failed',
        });
        return;
      }
      setResult(data);
      setPhase('result');
    } catch {
      onComplete({
        level: desc.suggested_level, validation_status: 'failed',
        validation_questions: questions, validation_responses: responses,
        validation_notes: 'Scoring failed — network error',
      });
    }
  };

  const skip = () => onComplete({ level: desc.suggested_level, validation_status: 'skipped' });

  const saveDetermined = () => onComplete({
    level: result!.determined_level,
    validation_status: 'validated',
    validation_questions: questions,
    validation_responses: responsesPayload(),
    validation_score: result!.avg_score,
    validation_notes: ar ? result!.reasoning_ar : result!.reasoning_en,
  });

  return (
    <div className="cf-modal-overlay" onClick={onClose}>
      <div className="cf-modal" onClick={e => e.stopPropagation()}>
        <div className="cf-modal-title">{t('skills.validation_title')}</div>
        <div className="cf-modal-sub">{desc.skill_canonical_name}</div>

        {(phase === 'initial' || phase === 'scoring') && (
          <div className="skill-loading">
            <div className="spinner" />
            {phase === 'initial' ? t('skills.generating_questions') : t('skills.scoring')}
          </div>
        )}

        {phase === 'start_error' && (
          <>
            <div className="result-card warn">{t('skills.validation_failed_msg')}</div>
            <div className="cf-modal-actions">
              <button className="btn-save" onClick={skip}>{t('skills.save_high_unvalidated')}</button>
              <button className="btn-ghost" onClick={onClose}>{t('skills.close')}</button>
            </div>
          </>
        )}

        {phase === 'answering' && (
          <>
            {questions.map((q, i) => (
              <div key={q.id} className="cf-modal-q">
                <label>{i + 1}. {ar ? q.question_ar : q.question_en}</label>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  placeholder={t('skills.validation_answer_placeholder')}
                />
                <div className="char-count">{(answers[q.id] || '').trim().length}/30</div>
              </div>
            ))}
            <div className="cf-modal-actions">
              <button className="btn-save" onClick={submitAnswers} disabled={!allAnswered}>
                {t('skills.submit_answers')}
              </button>
              <button className="btn-ghost" onClick={skip}>{t('skills.skip_validation')}</button>
            </div>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <div className="result-card good">
              <strong>{tr('skills.determined_level', { level: levelLabel(result.determined_level) })}</strong>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                {ar ? result.reasoning_ar : result.reasoning_en}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {tr('skills.avg_score', { score: result.avg_score.toFixed(1) })}
              </p>
            </div>
            {questions.map((q, i) => {
              const sc = result.scores.find(x => x.question_id === q.id);
              return (
                <div key={q.id} className="cf-modal-q">
                  <label>{i + 1}. {ar ? q.question_ar : q.question_en}</label>
                  {sc && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {tr('skills.score', {})}: {sc.score}/10 — {ar ? sc.feedback_ar : sc.feedback_en}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="cf-modal-actions">
              <button className="btn-save" onClick={saveDetermined}>
                {tr('skills.save_as_level', { level: levelLabel(result.determined_level) })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════ Detail modal ════════════
function DetailModal({ detail, t, tr, ar, onClose, onEdit }: {
  detail: CurrentSkill | DerivedSkill;
  t: (k: string) => string; tr: any; ar: boolean;
  onClose: () => void; onEdit?: () => void;
}) {
  const isCurrent = 'id' in detail;

  return (
    <div className="cf-modal-overlay" onClick={onClose}>
      <div className="cf-modal" onClick={e => e.stopPropagation()}>
        <div className="cf-modal-title">{detail.skill_canonical_name}</div>

        {!isCurrent && (
          <>
            <div className="cf-modal-sub">{t('skills.derived_label')}</div>
            <p style={{ fontSize: '0.88rem' }}>{(detail as DerivedSkill).source_detail}</p>
          </>
        )}

        {isCurrent && (() => {
          const s = detail as CurrentSkill;
          let qs: VQuestion[] = [];
          let rs: { question_id: string; answer: string }[] = [];
          try { qs = Array.isArray(s.validation_questions) ? s.validation_questions : []; } catch {}
          try { rs = Array.isArray(s.validation_responses) ? s.validation_responses : []; } catch {}
          return (
            <>
              <p className="skill-bubble-desc">{ar ? s.description_ar : s.description_en}</p>
              {s.ai_suggested_level && (
                <p className="skill-bubble-reasoning">
                  {tr('skills.suggested_level', {
                    level: t(LEVEL_KEY[s.ai_suggested_level as Level]),
                    chosen: t(LEVEL_KEY[s.proficiency_level]),
                  })}
                </p>
              )}
              <p style={{ fontSize: '0.85rem' }}>{ar ? s.reasoning_ar : s.reasoning_en}</p>
              <p className="req-skill-meta" style={{ marginTop: '0.6rem' }}>
                {`Required by ${s.market_demand_count} open jobs in your cluster.`}
              </p>

              {qs.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{t('skills.validation_qna')}</strong>
                  {s.validation_score != null && (
                    <p className="req-skill-meta">{tr('skills.avg_score', { score: s.validation_score })}</p>
                  )}
                  {qs.map((q, i) => {
                    const answer = rs.find(r => r.question_id === q.id)?.answer || '—';
                    return (
                      <div key={q.id} className="cf-modal-q">
                        <label>{i + 1}. {ar ? q.question_ar : q.question_en}</label>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                          {t('skills.your_answer')}: {answer}
                        </p>
                      </div>
                    );
                  })}
                  {s.validation_notes && (
                    <p className="skill-bubble-reasoning">{s.validation_notes}</p>
                  )}
                </div>
              )}
            </>
          );
        })()}

        <div className="cf-modal-actions" style={{ marginTop: '1rem' }}>
          {onEdit && <button className="btn-save" onClick={onEdit}>{t('skills.edit')}</button>}
          <button className="btn-ghost" onClick={onClose}>{t('skills.close')}</button>
        </div>
      </div>
    </div>
  );
}
