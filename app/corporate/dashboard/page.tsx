'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import { cityLabel } from '@/lib/locations';

interface Job {
  id: string;
  title: string;
  posting_type: string;
  location_city: string;
  status: string;
  hiring_outcome_flag: boolean;
  applicant_count: number;
}
interface RecentApplicant {
  application_id: string;
  job_id: string;
  name: string;
  job_title: string;
  match_score: number;
  status: string;
}

export default function CorporateDashboard() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<string>('pending');
  const [company, setCompany] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recent, setRecent] = useState<RecentApplicant[]>([]);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/corporate/login'); return; }
      const meData = await me.json();
      if (meData.role !== 'corporate') { router.push('/dashboard'); return; }

      const [p, j, r] = await Promise.all([
        fetch('/api/corporates/profile').then((x) => x.json()),
        fetch('/api/corporates/jobs').then((x) => x.json()),
        fetch('/api/corporates/applicants/recent').then((x) => x.json()),
      ]);
      setVerification(p.profile?.verification_status ?? 'pending');
      setCompany(p.profile?.company_name ?? '');
      setJobs(j.jobs ?? []);
      setRecent(r.applicants ?? []);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const verified = verification === 'verified';
  const activeJobs = jobs.filter((j) => j.status === 'open').length;
  const totalApplicants = jobs.reduce((s, j) => s + (j.applicant_count ?? 0), 0);
  const awaitingReview = recent.filter((a) => a.status === 'submitted').length;

  const stats = [
    { label: t('corporate.active_jobs'), value: activeJobs },
    { label: t('corporate.total_applicants'), value: totalApplicants },
    { label: t('corporate.awaiting_review'), value: awaitingReview },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{t('corporate.dashboard_title')}</h1>
          <p className="auth-subtitle">{company}</p>
        </div>
        <Link href="/corporate/post-job" className="btn-primary">{t('corporate.post_job')}</Link>
      </header>

      <div
        className="alert-banner"
        style={{
          background: verified ? 'rgba(0,184,148,0.12)' : 'rgba(243,156,18,0.12)',
          borderColor: verified ? '#00b894' : '#f39c12',
          color: verified ? '#00b894' : '#b9770e',
          marginBottom: '1.25rem',
        }}
      >
        {verified ? t('corporate.verification_verified') : t('corporate.verification_pending')}
      </div>

      {/* Stats overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="profile-section" style={{ textAlign: 'center', padding: '1.25rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{s.value}</div>
            <div className="experience-meta">{s.label}</div>
          </div>
        ))}
      </div>

      {/* What the corporate can do here */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('corporate.todo_title')}</h2>
        <ul style={{ margin: 0, paddingInlineStart: '1.2rem', display: 'grid', gap: '0.4rem' }}>
          <li className="experience-meta">{t('corporate.todo_post')}</li>
          <li className="experience-meta">{t('corporate.todo_review')}</li>
          <li className="experience-meta">{t('corporate.todo_decide')}</li>
        </ul>
        <div style={{ marginTop: '0.9rem' }}>
          <Link href="/corporate/post-job" className="btn-primary">{t('corporate.post_job')}</Link>
        </div>
      </div>

      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('corporate.active_jobs')}</h2>
        {jobs.length === 0 && <p className="experience-meta">{t('corporate.no_jobs')}</p>}
        <div className="experience-list">
          {jobs.map((j) => (
            <Link
              key={j.id}
              href={`/corporate/jobs/${j.id}/applicants`}
              className="experience-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="experience-info">
                <span className="experience-title-text">
                  {j.title}{j.hiring_outcome_flag ? ' ⭐' : ''}
                </span>
                <span className="experience-meta">
                  {cityLabel(j.location_city, lang)} · {t(`postjob.pt_${j.posting_type}`)} · {j.status}
                </span>
              </div>
              <span className="status-chip have">
                {j.applicant_count} {t('corporate.applicants')}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="profile-section">
        <h2 className="profile-section-title">{t('corporate.recent_applicants')}</h2>
        {recent.length === 0 && <p className="experience-meta">{t('corporate.no_applicants')}</p>}
        <div className="experience-list">
          {recent.map((a) => (
            <Link
              key={a.application_id}
              href={`/corporate/jobs/${a.job_id}/applicants/${a.application_id}`}
              className="experience-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="experience-info">
                <span className="experience-title-text">{a.name}</span>
                <span className="experience-meta">{a.job_title}</span>
              </div>
              <span className="status-chip">{Math.round(a.match_score)}%</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
