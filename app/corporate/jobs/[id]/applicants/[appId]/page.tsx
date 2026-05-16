'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface DimDelta { dim: string; student: number; required: number; delta: number }
interface Detail {
  application: { id: string; status: string; match_score: number };
  job: { id: string; title: string; required_skills: { skill: string; importance: number }[] };
  student: {
    name: string; university: string; year_of_study: string;
    gpa_value: number; gpa_scale: string; cluster: string; target_role: string;
    hours_per_week: number | null; completed_roadmap_nodes: number;
    high_skills_total: number; high_skills_validated: number;
  };
  strengths: DimDelta[];
  gaps: DimDelta[];
}
interface FitSummary {
  summary_en: string; summary_ar: string;
  risk_flags: string[]; recommended_action: string | null;
  generated_at: string; stale: boolean;
}

const DIM_LABEL: Record<string, { en: string; ar: string }> = {
  dim_academic: { en: 'Academic', ar: 'الأكاديمي' },
  dim_credentialing: { en: 'Credentialing', ar: 'الشهادات' },
  dim_practical: { en: 'Practical Experience', ar: 'الخبرة العملية' },
  dim_portfolio: { en: 'Portfolio', ar: 'معرض الأعمال' },
  dim_domain: { en: 'Domain Knowledge', ar: 'المعرفة التخصصية' },
  dim_prof_dev: { en: 'Professional Development', ar: 'التطوير المهني' },
  dim_soft_skills: { en: 'Soft Skills', ar: 'المهارات الناعمة' },
};

const REJECTION_REASONS = [
  'missing_skills', 'insufficient_experience', 'missing_credential',
  'better_candidate', 'role_filled', 'other',
] as const;

const ACTION_COLOR: Record<string, string> = {
  advance: '#00b894',
  screen_first: '#f39c12',
  wait_pool: '#95a5a6',
  decline: '#e74c3c',
};
const FALLBACK_PREFIX = 'AI summary unavailable';

export default function ApplicantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = String(params.id);
  const appId = String(params.appId);
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [d, setD] = useState<Detail | null>(null);

  const [fit, setFit] = useState<FitSummary | null>(null);
  const [fitLoading, setFitLoading] = useState(true);
  const [fitError, setFitError] = useState('');

  const [actionMsg, setActionMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [gapTags, setGapTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [rejectErr, setRejectErr] = useState('');

  async function loadDetail() {
    const res = await fetch(`/api/corporates/applications/${appId}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Failed to load');
      setLoading(false);
      return;
    }
    setD(await res.json());
    setLoading(false);
  }

  async function loadFit(regenerate = false) {
    setFitLoading(true);
    setFitError('');
    const res = await fetch(
      `/api/corporates/applications/${appId}/fit-summary${regenerate ? '?regenerate=true' : ''}`,
    );
    if (res.ok) setFit(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      setFitError(j.error || 'Failed to load assessment');
    }
    setFitLoading(false);
  }

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/corporate/login'); return; }
      await loadDetail();
      loadFit(false);
    })().catch(() => { setError('Network error'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  async function setStatus(status: string) {
    setBusy(true);
    setActionMsg('');
    const res = await fetch(`/api/corporates/applications/${appId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setD((prev) => prev ? { ...prev, application: { ...prev.application, status } } : prev);
      setActionMsg(
        j.email_sent === false
          ? `${t('corporate.status_updated')} (${t('corporate.email_failed')})`
          : t('corporate.status_updated'),
      );
    } else {
      setActionMsg(j.error || 'Failed');
    }
    setBusy(false);
  }

  function toggleGap(skill: string) {
    setGapTags((p) => (p.includes(skill) ? p.filter((s) => s !== skill) : [...p, skill]));
  }

  async function submitReject() {
    setRejectErr('');
    if (!reason) { setRejectErr(t('corporate.err_reason_required')); return; }
    if (reason === 'other' && !comment.trim()) { setRejectErr(t('corporate.err_comment_required')); return; }
    setBusy(true);
    const res = await fetch(`/api/corporates/applications/${appId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryReason: reason, gapTags, comment: comment.trim() || undefined }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      // The application is removed on rejection — return to the applicants list.
      setShowReject(false);
      router.push(`/corporate/jobs/${jobId}/applicants`);
      return;
    }
    setRejectErr(j.error || 'Failed');
    setBusy(false);
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (error || !d) return <div className="dashboard-page"><div className="alert-banner">{error}</div></div>;

  const s = d.student;
  const isFallback = !!fit && fit.summary_en.startsWith(FALLBACK_PREFIX);
  const summaryText = fit ? (lang === 'ar' ? fit.summary_ar : fit.summary_en) : '';

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{s.name}</h1>
          <p className="auth-subtitle">{d.job.title} · {t(`applications.status_${d.application.status}`)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#6c5ce7' }}>
            {Math.round(d.application.match_score)}%
          </div>
          <div className="experience-meta">{t('applications.match_score')}</div>
        </div>
      </header>

      {/* Profile readout */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('corporate.profile')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <p className="experience-meta">{t('corporate.university')}: <b>{s.university}</b></p>
          <p className="experience-meta">{t('corporate.year')}: <b>{s.year_of_study}</b></p>
          <p className="experience-meta">GPA: <b>{s.gpa_value} / {s.gpa_scale}</b></p>
          <p className="experience-meta">{t('corporate.cluster')}: <b>{s.cluster}</b></p>
          <p className="experience-meta">{t('corporate.target_role')}: <b>{s.target_role || '—'}</b></p>
          <p className="experience-meta">{t('corporate.hours_week')}: <b>{s.hours_per_week ?? '—'}</b></p>
          <p className="experience-meta">{t('corporate.completed_nodes')}: <b>{s.completed_roadmap_nodes}</b></p>
          <p className="experience-meta">
            {t('corporate.validated_high')}: <b>{s.high_skills_validated} / {s.high_skills_total}</b>
          </p>
        </div>
      </div>

      {/* Deterministic strengths / gaps */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('corporate.strengths_gaps')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <p className="experience-meta" style={{ fontWeight: 700, color: '#00b894' }}>{t('jobs.strengths')}</p>
            {d.strengths.length === 0 && <p className="experience-meta">—</p>}
            {d.strengths.map((x) => (
              <p key={x.dim} className="experience-meta">
                ✓ {DIM_LABEL[x.dim]?.[lang] ?? x.dim} ({Math.round(x.student)}/{Math.round(x.required)})
              </p>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <p className="experience-meta" style={{ fontWeight: 700, color: '#e74c3c' }}>{t('jobs.gaps')}</p>
            {d.gaps.length === 0 && <p className="experience-meta">—</p>}
            {d.gaps.map((x) => (
              <p key={x.dim} className="experience-meta">
                ↓ {DIM_LABEL[x.dim]?.[lang] ?? x.dim} ({Math.round(x.student)}/{Math.round(x.required)})
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* AI Fit Summary card */}
      <div className="profile-section" style={{ marginBottom: '1.25rem', borderLeft: '3px solid #6c5ce7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h2 className="profile-section-title">{t('corporate.ai_assessment')}</h2>
          <span className="experience-meta">{t('corporate.generated_by_claude')}</span>
        </div>

        {fitLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0' }}>
            <div className="spinner" />
            <p className="experience-meta">{t('corporate.claude_reviewing')}</p>
          </div>
        )}

        {!fitLoading && fitError && <div className="alert-banner">{fitError}</div>}

        {!fitLoading && !fitError && fit && (
          <>
            <p className="experience-meta" style={{ lineHeight: 1.7, fontSize: '0.95rem' }}>
              {summaryText}
            </p>

            {!isFallback && (
              <>
                {fit.risk_flags.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {fit.risk_flags.map((rf) => (
                      <span key={rf} className="status-chip need">{rf}</span>
                    ))}
                  </div>
                )}
                {fit.recommended_action && (
                  <div style={{ marginTop: '12px' }}>
                    <span
                      className="status-chip"
                      style={{
                        background: ACTION_COLOR[fit.recommended_action] ?? '#95a5a6',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {t(`corporate.${fit.recommended_action}`)}
                    </span>
                  </div>
                )}
              </>
            )}

            {fit.stale && (
              <button
                className="btn-secondary"
                style={{ marginTop: '12px' }}
                disabled={fitLoading}
                onClick={() => loadFit(true)}
              >
                {t('corporate.regenerate')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="profile-section">
        <h2 className="profile-section-title">{t('corporate.actions')}</h2>
        {actionMsg && <div className="alert-banner" style={{ marginBottom: '0.75rem' }}>{actionMsg}</div>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" disabled={busy} onClick={() => setStatus('under_review')}>
            {t('corporate.move_under_review')}
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => setStatus('interview')}>
            {t('corporate.schedule_interview')}
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => setStatus('offered')}>
            {t('corporate.make_offer')}
          </button>
          <button className="btn-secondary" disabled={busy}
            style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
            onClick={() => setShowReject(true)}>
            {t('corporate.reject')}
          </button>
        </div>
      </div>

      {/* Rejection modal — cannot bypass */}
      {showReject && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem',
        }}>
          <div className="profile-section" style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="profile-section-title">{t('corporate.reject')}</h2>
            {rejectErr && <div className="alert-banner" style={{ marginBottom: '0.75rem' }}>{rejectErr}</div>}

            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              {t('corporate.rejection_reason')}
            </label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: '1rem' }}>
              <option value="">—</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{t(`corporate.reason_${r}`)}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              {t('corporate.rejection_gaps')}
            </label>
            <div className="chips-grid" style={{ marginBottom: '1rem' }}>
              {d.job.required_skills.map((rs) => (
                <button type="button" key={rs.skill}
                  className={`level-chip ${gapTags.includes(rs.skill) ? 'selected' : ''}`}
                  onClick={() => toggleGap(rs.skill)}>
                  {rs.skill}
                </button>
              ))}
              {d.job.required_skills.length === 0 && <p className="experience-meta">—</p>}
            </div>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              {t('corporate.rejection_comment')}{reason === 'other' ? ' *' : ''}
            </label>
            <textarea className="input" rows={3} value={comment}
              onChange={(e) => setComment(e.target.value)} style={{ marginBottom: '1rem' }} />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" disabled={busy} onClick={() => setShowReject(false)}>
                {t('corporate.cancel')}
              </button>
              <button className="btn-primary" disabled={busy}
                style={{ background: '#e74c3c' }} onClick={submitReject}>
                {t('corporate.rejection_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
