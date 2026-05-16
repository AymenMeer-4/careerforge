'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import { cityLabel, regionLabel } from '@/lib/locations';

interface Job {
  id: string;
  title: string;
  posting_type: string;
  role_category: string;
  cluster: string;
  location_region: string;
  location_city: string;
  salary_min: number | null;
  salary_max: number | null;
  required_skills: { skill: string; importance: number }[];
  deadline: string | null;
  created_at: string;
  job_readiness: number;
  company_name: string;
  verification_status: string;
}

const POSTING_LABELS: Record<string, { en: string; ar: string }> = {
  full_time: { en: 'Full-time', ar: 'دوام كامل' },
  internship: { en: 'Internship', ar: 'تدريب' },
  coop: { en: 'Co-op', ar: 'تعاوني' },
  training: { en: 'Training', ar: 'تدريب مهني' },
};

function readinessColor(v: number): string {
  return v >= 80 ? '#00b894' : v >= 60 ? '#f39c12' : '#e74c3c';
}

export default function JobsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');

  const [postingFilter, setPostingFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [sort, setSort] = useState<'readiness' | 'date' | 'deadline'>('readiness');

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/login'); return; }
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load jobs');
      }
      setLoading(false);
    }
    load().catch((e) => { console.error(e); setError('Network error'); setLoading(false); });
  }, []);

  const regions = useMemo(
    () => [...new Set(jobs.map((j) => j.location_region))].sort(),
    [jobs],
  );

  const visible = useMemo(() => {
    let list = jobs.slice();
    if (postingFilter) list = list.filter((j) => j.posting_type === postingFilter);
    if (regionFilter) list = list.filter((j) => j.location_region === regionFilter);
    if (sort === 'date') list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === 'deadline')
      list.sort((a, b) => {
        const da = a.deadline ? +new Date(a.deadline) : Infinity;
        const db = b.deadline ? +new Date(b.deadline) : Infinity;
        return da - db;
      });
    else list.sort((a, b) => b.job_readiness - a.job_readiness);
    return list;
  }, [jobs, postingFilter, regionFilter, sort]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{t('jobs.title')}</h1>
          <p className="auth-subtitle">
            {lang === 'ar'
              ? 'النسبة المعروضة هي «جاهزية الوظيفة» — مدى تطابقك مع كل وظيفة تحديدًا'
              : 'The percentage shown is your Job Readiness — how well you match each specific job.'}
          </p>
        </div>
      </header>

      {error && <div className="alert-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filter bar */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
          <div>
            <p className="experience-meta" style={{ marginBottom: '6px' }}>
              {lang === 'ar' ? 'نوع الوظيفة' : 'Posting type'}
            </p>
            <div className="chips-grid">
              {['', 'full_time', 'internship', 'coop', 'training'].map((pt) => (
                <button
                  key={pt || 'all'}
                  className={`level-chip ${postingFilter === pt ? 'selected' : ''}`}
                  onClick={() => setPostingFilter(pt)}
                >
                  {pt === '' ? (lang === 'ar' ? 'الكل' : 'All') : POSTING_LABELS[pt][lang]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="experience-meta" style={{ marginBottom: '6px' }}>
              {lang === 'ar' ? 'المنطقة' : 'Region'}
            </p>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="input"
              style={{ minWidth: '160px' }}
            >
              <option value="">{lang === 'ar' ? 'كل المناطق' : 'All regions'}</option>
              {regions.map((r) => (
                <option key={r} value={r}>{regionLabel(r, lang)}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="experience-meta" style={{ marginBottom: '6px' }}>
              {lang === 'ar' ? 'الترتيب' : 'Sort by'}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="input"
              style={{ minWidth: '180px' }}
            >
              <option value="readiness">{t('jobs.sort_readiness')}</option>
              <option value="date">{t('jobs.sort_date')}</option>
              <option value="deadline">{lang === 'ar' ? 'حسب الموعد النهائي' : 'By deadline'}</option>
            </select>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="profile-section">
          <p className="experience-meta">
            {lang === 'ar' ? 'لا توجد وظائف مطابقة حاليًا.' : 'No matching jobs right now.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {visible.map((job) => {
            const color = readinessColor(job.job_readiness);
            const salary =
              job.salary_min && job.salary_max
                ? `${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()} SAR`
                : lang === 'ar' ? 'غير محدد' : 'Not specified';
            return (
              <div key={job.id} className="profile-section" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h3 className="experience-title-text" style={{ fontSize: '1.05rem' }}>{job.title}</h3>
                    <p className="experience-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {job.company_name}
                      {job.verification_status === 'verified' && (
                        <span title="Verified company" style={{ color: '#00b894' }}>✓</span>
                      )}
                    </p>
                  </div>
                  <span
                    className="status-chip"
                    style={{ background: 'rgba(108,92,231,0.12)', color: '#6c5ce7', height: 'fit-content' }}
                  >
                    {POSTING_LABELS[job.posting_type]?.[lang] ?? job.posting_type}
                  </span>
                </div>

                <p className="experience-meta">📍 {cityLabel(job.location_city, lang)}, {regionLabel(job.location_region, lang)}</p>
                <p className="experience-meta">💰 {salary}</p>

                {/* Job Readiness — explicitly labeled, distinct from General Readiness */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="experience-meta" style={{ fontWeight: 700 }}>{t('jobs.job_readiness')}</span>
                    <span style={{ fontWeight: 800, color }}>{job.job_readiness}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(108,92,231,0.1)', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ width: `${job.job_readiness}%`, height: '100%', background: color, transition: 'width 1s ease' }} />
                  </div>
                </div>

                <button
                  className="btn-primary"
                  style={{ marginTop: '6px' }}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  {lang === 'ar' ? 'عرض' : 'View'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
