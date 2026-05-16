'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface DimDelta { dim: string; student: number; required: number; delta: number }
interface Applicant {
  application_id: string;
  name: string;
  university: string;
  year_of_study: string;
  status: string;
  match_score: number;
  strengths: DimDelta[];
  gaps: DimDelta[];
}

const DIM_LABEL: Record<string, { en: string; ar: string }> = {
  dim_academic: { en: 'Academic', ar: 'الأكاديمي' },
  dim_credentialing: { en: 'Credentialing', ar: 'الشهادات' },
  dim_practical: { en: 'Practical', ar: 'الخبرة' },
  dim_portfolio: { en: 'Portfolio', ar: 'الأعمال' },
  dim_domain: { en: 'Domain', ar: 'التخصص' },
  dim_prof_dev: { en: 'Prof. Dev.', ar: 'التطوير المهني' },
  dim_soft_skills: { en: 'Soft Skills', ar: 'المهارات الناعمة' },
};

function band(v: number) {
  return v >= 80 ? '#00b894' : v >= 60 ? '#f39c12' : '#e74c3c';
}

export default function ApplicantsListPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = String(params.id);
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/corporate/login'); return; }
      const res = await fetch(`/api/corporates/jobs/${jobId}/applicants`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJobTitle(data.job?.title ?? '');
      setApplicants(data.applicants ?? []);
      setLoading(false);
    })().catch(() => { setError('Network error'); setLoading(false); });
  }, [jobId, router]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (error) return <div className="dashboard-page"><div className="alert-banner">{error}</div></div>;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{t('corporate.applicants')}</h1>
          <p className="auth-subtitle">{jobTitle}</p>
        </div>
      </header>

      {applicants.length === 0 && (
        <div className="profile-section"><p className="experience-meta">{t('corporate.no_applicants')}</p></div>
      )}

      <div className="experience-list">
        {applicants.map((a) => (
          <Link key={a.application_id}
            href={`/corporate/jobs/${jobId}/applicants/${a.application_id}`}
            className="profile-section"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 className="experience-title-text">{a.name}</h3>
                <p className="experience-meta">{a.university} · {t('corporate.year')} {a.year_of_study}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: band(a.match_score) }}>
                  {Math.round(a.match_score)}%
                </div>
                <div className="experience-meta">{t('applications.match_score')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '8px' }}>
              <div>
                <p className="experience-meta" style={{ fontWeight: 700, color: '#00b894' }}>{t('jobs.strengths')}</p>
                {a.strengths.length === 0 && <p className="experience-meta">—</p>}
                {a.strengths.map((s) => (
                  <p key={s.dim} className="experience-meta">✓ {DIM_LABEL[s.dim]?.[lang] ?? s.dim}</p>
                ))}
              </div>
              <div>
                <p className="experience-meta" style={{ fontWeight: 700, color: '#e74c3c' }}>{t('jobs.gaps')}</p>
                {a.gaps.length === 0 && <p className="experience-meta">—</p>}
                {a.gaps.map((g) => (
                  <p key={g.dim} className="experience-meta">↓ {DIM_LABEL[g.dim]?.[lang] ?? g.dim}</p>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
