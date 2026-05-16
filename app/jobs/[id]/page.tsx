'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import { cityLabel, regionLabel } from '@/lib/locations';

/**
 * Per policy, never surface a raw AI-provided URL (it may not exist) and never
 * reference any source outside Amazon, edX, Coursera, Udemy. Map the resource's
 * provider to one of those four and send the user to that site's SEARCH page.
 */
function resourceSearch(r: { title: string; provider?: string }): { provider: string; href: string } {
  const p = (r.provider ?? '').toLowerCase();
  const q = encodeURIComponent(r.title);
  if (p.includes('udemy')) return { provider: 'Udemy', href: `https://www.udemy.com/courses/search/?q=${q}` };
  if (p.includes('edx')) return { provider: 'edX', href: `https://www.edx.org/search?q=${q}` };
  if (p.includes('amazon') || p.includes('aws'))
    return { provider: 'Amazon', href: `https://www.amazon.com/s?k=${q}` };
  return { provider: 'Coursera', href: `https://www.coursera.org/search?query=${q}` };
}

interface JobDetail {
  id: string;
  title: string;
  description: string;
  description_ar: string | null;
  posting_type: string;
  role_category: string;
  location_region: string;
  location_city: string;
  salary_min: number | null;
  salary_max: number | null;
  required_skills: { skill: string; importance: number }[];
  required_certs: string[];
  required_experience_years: number;
  required_education_level: string;
  dimension_requirements: Record<string, number>;
  company_name: string;
  verification_status: string;
}

interface DimDelta {
  dim: string;
  student: number;
  required: number;
  delta: number;
}

interface PathStep {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  dimension_target: string;
  estimated_hours: number;
  expected_lift: number;
  resources: { title: string; url: string; provider: string }[];
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

function ringColor(v: number): string {
  return v >= 80 ? '#00b894' : v >= 60 ? '#f39c12' : '#e74c3c';
}

function Ring({ value, label }: { value: number; label: string }) {
  const color = ringColor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, minWidth: '180px' }}>
      <h3 className="experience-title-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>{label}</h3>
      <div style={{ position: 'relative', width: '150px', height: '150px' }}>
        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(108,92,231,0.1)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * value) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.9rem', fontWeight: 800, color }}>{Math.round(value)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = String(params.id);
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobDetail | null>(null);
  const [generalReadiness, setGeneralReadiness] = useState(0);
  const [jobReadiness, setJobReadiness] = useState(0);
  const [breakdown, setBreakdown] = useState<{
    strengths: DimDelta[]; gaps: DimDelta[]; haveSkills: string[]; missingSkills: string[];
  } | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const [pathLoading, setPathLoading] = useState(true);
  const [pathError, setPathError] = useState('');
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [addedSteps, setAddedSteps] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/login'); return; }

      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load job');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJob(data.job);
      setGeneralReadiness(data.general_readiness ?? 0);
      setJobReadiness(data.job_readiness ?? 0);
      setBreakdown(data.breakdown ?? null);
      setAlreadyApplied(!!data.already_applied);
      setLoading(false);
    }
    load().catch((e) => { console.error(e); setError('Network error'); setLoading(false); });
  }, [jobId]);

  // Close the Gap — fetched once per page-view session, cached in state.
  useEffect(() => {
    if (loading || error) return;
    let cancelled = false;
    async function loadPath() {
      setPathLoading(true);
      setPathError('');
      const res = await fetch(`/api/jobs/${jobId}/path`);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps ?? []);
      } else {
        const d = await res.json().catch(() => ({}));
        setPathError(d.error || 'Failed to generate path');
      }
      setPathLoading(false);
    }
    loadPath();
    return () => { cancelled = true; };
  }, [loading, error, jobId]);

  const subtitle = useMemo(() => {
    if (!job || !breakdown) return '';
    const reqEntries = Object.entries(job.dimension_requirements || {})
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 2)
      .map(([k]) => DIM_LABEL[k]?.[lang] ?? k);
    const strongest = breakdown.strengths[0]
      ? DIM_LABEL[breakdown.strengths[0].dim]?.[lang] ?? breakdown.strengths[0].dim
      : (lang === 'ar' ? 'غير متاح' : 'n/a');
    const biggestGap = breakdown.gaps[0]
      ? DIM_LABEL[breakdown.gaps[0].dim]?.[lang] ?? breakdown.gaps[0].dim
      : (lang === 'ar' ? 'لا يوجد' : 'none');
    if (lang === 'ar') {
      return `تركّز هذه الوظيفة على ${reqEntries.join(' و')}. أقوى بُعد مساهم لديك هنا هو ${strongest}؛ وأكبر فجوة لديك هي ${biggestGap}.`;
    }
    return `This job emphasizes ${reqEntries.join(' and ')}. Your strongest contributing dimension here is ${strongest}; your biggest gap is ${biggestGap}.`;
  }, [job, breakdown, lang]);

  async function handleAddToRoadmap(step: PathStep, idx: number) {
    if (!job) return;
    const note = lang === 'ar'
      ? `من: ${job.title} في ${job.company_name}`
      : `From: ${job.title} at ${job.company_name}`;
    const res = await fetch('/api/roadmap/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title_en: step.title_en,
        title_ar: step.title_ar,
        description_en: `[${note}] ${step.description_en}`,
        description_ar: `[${note}] ${step.description_ar}`,
        dimension_target: step.dimension_target,
        difficulty: 3,
        hours: step.estimated_hours,
        tier: 2,
        resources: step.resources,
      }),
    });
    if (res.ok) {
      setAddedSteps((prev) => new Set(prev).add(idx));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Failed to add to roadmap');
    }
  }

  async function handleApply() {
    setApplying(true);
    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: 'POST' });
    if (res.ok) {
      router.push('/applications?applied=1');
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Failed to apply');
      setApplying(false);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (error) return <div className="dashboard-page"><div className="alert-banner">{error}</div></div>;
  if (!job) return null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{job.title}</h1>
          <p className="auth-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {job.company_name}
            {job.verification_status === 'verified' && <span style={{ color: '#00b894' }}>✓</span>}
            {' · '}{cityLabel(job.location_city, lang)}, {regionLabel(job.location_region, lang)}
          </p>
        </div>
      </header>

      {/* ── Dual Readiness Display ───────────────────────────────────────── */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
          <Ring
            value={generalReadiness}
            label={lang === 'ar' ? 'جاهزيتك العامة' : 'Your General Readiness'}
          />
          <Ring
            value={jobReadiness}
            label={lang === 'ar' ? 'جاهزيتك لهذه الوظيفة' : 'Your Readiness for This Job'}
          />
        </div>
        {subtitle && (
          <p className="experience-meta" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.86rem' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{lang === 'ar' ? 'الوصف' : 'Description'}</h2>
        <p className="experience-meta" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {lang === 'ar' ? (job.description_ar || job.description) : job.description}
        </p>

        <h2 className="profile-section-title" style={{ marginTop: '1.25rem' }}>
          {lang === 'ar' ? 'المهارات المطلوبة' : 'Required Skills'}
        </h2>
        <div className="experience-list">
          {job.required_skills.map((s) => (
            <div key={s.skill} className="experience-row">
              <span className="experience-title-text" style={{ fontSize: '0.9rem' }}>{s.skill}</span>
              <span style={{ letterSpacing: '2px', color: '#6c5ce7' }}>
                {'●'.repeat(s.importance)}{'○'.repeat(Math.max(0, 5 - s.importance))}
              </span>
            </div>
          ))}
          {job.required_skills.length === 0 && (
            <p className="experience-meta">{lang === 'ar' ? 'لا توجد' : 'None specified'}</p>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1rem' }}>
          <div>
            <p className="experience-meta" style={{ fontWeight: 700 }}>{lang === 'ar' ? 'الشهادات المطلوبة' : 'Required Certifications'}</p>
            <p className="experience-meta">{job.required_certs.length ? job.required_certs.join(', ') : (lang === 'ar' ? 'لا توجد' : 'None')}</p>
          </div>
          <div>
            <p className="experience-meta" style={{ fontWeight: 700 }}>{lang === 'ar' ? 'سنوات الخبرة' : 'Experience Required'}</p>
            <p className="experience-meta">{job.required_experience_years} {lang === 'ar' ? 'سنوات' : 'years'}</p>
          </div>
          <div>
            <p className="experience-meta" style={{ fontWeight: 700 }}>{lang === 'ar' ? 'المستوى التعليمي' : 'Education Level'}</p>
            <p className="experience-meta">{job.required_education_level}</p>
          </div>
        </div>
      </div>

      {/* ── Match breakdown ──────────────────────────────────────────────── */}
      {breakdown && (
        <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
          <h2 className="profile-section-title">{lang === 'ar' ? 'تحليل التطابق' : 'Match Breakdown'}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <p className="experience-meta" style={{ fontWeight: 700, color: '#00b894' }}>{t('jobs.strengths')}</p>
              {breakdown.strengths.length === 0 && <p className="experience-meta">—</p>}
              {breakdown.strengths.map((s) => (
                <p key={s.dim} className="experience-meta">
                  ✓ {DIM_LABEL[s.dim]?.[lang] ?? s.dim} ({Math.round(s.student)} / {Math.round(s.required)})
                </p>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <p className="experience-meta" style={{ fontWeight: 700, color: '#e74c3c' }}>{t('jobs.gaps')}</p>
              {breakdown.gaps.length === 0 && <p className="experience-meta">—</p>}
              {breakdown.gaps.map((g) => (
                <p key={g.dim} className="experience-meta">
                  ↓ {DIM_LABEL[g.dim]?.[lang] ?? g.dim} ({Math.round(g.student)} / {Math.round(g.required)})
                </p>
              ))}
              {breakdown.missingSkills.length > 0 && (
                <p className="experience-meta" style={{ marginTop: '6px' }}>
                  {lang === 'ar' ? 'مهارات ناقصة: ' : 'Missing skills: '}{breakdown.missingSkills.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Close the Gap ────────────────────────────────────────────────── */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('jobs.close_the_gap')}</h2>

        {pathLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0' }}>
            <div className="spinner" />
            <p className="experience-meta">{t('jobs.generating_path')}</p>
          </div>
        )}

        {!pathLoading && pathError && (
          <div className="alert-banner">{pathError}</div>
        )}

        {!pathLoading && !pathError && steps.length === 0 && (
          <p className="experience-meta">{t('jobs.already_matched')}</p>
        )}

        {!pathLoading && !pathError && steps.length > 0 && (
          <div className="experience-list">
            {steps.map((step, idx) => {
              const added = addedSteps.has(idx);
              return (
                <div key={idx} className="profile-section" style={{ background: 'rgba(108,92,231,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 className="experience-title-text">{lang === 'ar' ? step.title_ar : step.title_en}</h3>
                    <span className="status-chip have">+{step.expected_lift}% {t('jobs.job_readiness')}</span>
                  </div>
                  <p className="experience-meta" style={{ marginTop: '6px' }}>
                    {lang === 'ar' ? step.description_ar : step.description_en}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <span className="status-chip" style={{ background: 'rgba(108,92,231,0.12)', color: '#6c5ce7' }}>
                      {DIM_LABEL['dim_' + step.dimension_target]?.[lang] ?? step.dimension_target}
                    </span>
                  </div>
                  {step.resources.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {step.resources.map((r, ri) => {
                        const rs = resourceSearch(r);
                        return (
                          <a key={ri} href={rs.href} target="_blank" rel="noreferrer"
                            className="experience-meta" style={{ display: 'block', color: '#6c5ce7' }}>
                            🔎 {lang === 'ar'
                              ? `ابحث في ${rs.provider} عن: ${r.title}`
                              : `On ${rs.provider}, search: ${r.title}`}
                          </a>
                        );
                      })}
                    </div>
                  )}
                  <button
                    className={added ? 'btn-secondary' : 'btn-primary'}
                    style={{ marginTop: '10px' }}
                    disabled={added}
                    onClick={() => handleAddToRoadmap(step, idx)}
                  >
                    {added ? t('jobs.added_to_roadmap') : t('jobs.add_to_roadmap')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Apply ────────────────────────────────────────────────────────── */}
      <div className="profile-section" style={{ textAlign: 'center' }}>
        <button
          className="btn-primary"
          disabled={applying || alreadyApplied}
          onClick={handleApply}
          style={{ minWidth: '200px' }}
        >
          {alreadyApplied ? t('jobs.applied') : applying ? '...' : t('jobs.apply')}
        </button>
      </div>
    </div>
  );
}
