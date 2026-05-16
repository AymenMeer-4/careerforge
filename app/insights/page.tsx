'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface CareerFit {
  key: string;
  name_en: string;
  name_ar: string;
  score: number;
  job_count: number;
}

interface Demand {
  skill: string;
  count: number;
}

interface Explanation {
  why_this_role_en: string;
  why_this_role_ar: string;
  growth_trajectory_en: string;
  growth_trajectory_ar: string;
}

export default function InsightsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [careerFit, setCareerFit] = useState<CareerFit[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [topRoleName, setTopRoleName] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/login'); return; }

      const [fitRes, demandRes] = await Promise.all([
        fetch('/api/insights/career-fit'),
        fetch('/api/insights/market-demand'),
      ]);
      if (fitRes.ok) setCareerFit((await fitRes.json()).distribution ?? []);
      if (demandRes.ok) setDemand((await demandRes.json()).demand ?? []);
      if (!fitRes.ok && !demandRes.ok) setError('Failed to load insights');
      setLoading(false);

      // AI explanation — real Claude call, cached in component state.
      const aiRes = await fetch('/api/insights/ai-explanation', { method: 'POST' });
      if (aiRes.ok) {
        const data = await aiRes.json();
        setExplanation(data.explanation);
        setTopRoleName(lang === 'ar' ? data.top_role?.name_ar : data.top_role?.name_en);
      } else {
        const d = await aiRes.json().catch(() => ({}));
        setAiError(d.error || 'Failed to generate AI explanation');
      }
      setAiLoading(false);
    }
    load().catch((e) => { console.error(e); setError('Network error'); setLoading(false); setAiLoading(false); });
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const maxDemand = Math.max(1, ...demand.map((d) => d.count));

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="auth-title">{t('insights.title')}</h1>
      </header>

      {error && <div className="alert-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── Career Fit Distribution ──────────────────────────────────────── */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('insights.career_fit')}</h2>
        {careerFit.length === 0 ? (
          <p className="experience-meta">{lang === 'ar' ? 'لا توجد بيانات.' : 'No data available.'}</p>
        ) : (
          <div className="insight-bars" style={{ marginBottom: '32px' }}>
            {careerFit.map((c) => (
              <div
                key={c.key}
                className="insight-bar"
                style={{ height: `${Math.max(2, c.score)}%` }}
                title={`${lang === 'ar' ? c.name_ar : c.name_en}: ${c.score}%`}
              >
                <span>{(lang === 'ar' ? c.name_ar : c.name_en)} · {c.score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Market Demand Trends ─────────────────────────────────────────── */}
      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('insights.market_demand')}</h2>
        {demand.length === 0 ? (
          <p className="experience-meta">{lang === 'ar' ? 'لا توجد بيانات.' : 'No data available.'}</p>
        ) : (
          <div className="insight-bars" style={{ marginBottom: '32px' }}>
            {demand.map((d) => (
              <div
                key={d.skill}
                className="insight-bar"
                style={{ height: `${Math.max(2, (d.count / maxDemand) * 100)}%` }}
                title={`${d.skill}: ${d.count}`}
              >
                <span>{d.skill} · {d.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Decision Explanation ──────────────────────────────────────── */}
      <div className="profile-section">
        <h2 className="profile-section-title">
          {lang === 'ar' ? 'تفسير القرار بالذكاء الاصطناعي' : 'AI Decision Explanation'}
          {topRoleName ? ` — ${topRoleName}` : ''}
        </h2>
        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0' }}>
            <div className="spinner" />
            <p className="experience-meta">{t('insights.loading_ai')}</p>
          </div>
        )}
        {!aiLoading && aiError && <div className="alert-banner">{aiError}</div>}
        {!aiLoading && explanation && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div className="profile-section" style={{ flex: 1, minWidth: '260px', background: 'rgba(108,92,231,0.04)' }}>
              <h3 className="experience-title-text">{t('insights.why_role')}</h3>
              <p className="experience-meta" style={{ lineHeight: 1.7, marginTop: '6px' }}>
                {lang === 'ar' ? explanation.why_this_role_ar : explanation.why_this_role_en}
              </p>
            </div>
            <div className="profile-section" style={{ flex: 1, minWidth: '260px', background: 'rgba(0,206,201,0.05)' }}>
              <h3 className="experience-title-text">{t('insights.growth')}</h3>
              <p className="experience-meta" style={{ lineHeight: 1.7, marginTop: '6px' }}>
                {lang === 'ar' ? explanation.growth_trajectory_ar : explanation.growth_trajectory_en}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
