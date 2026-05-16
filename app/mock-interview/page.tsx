'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface Scenario {
  scenario_key: string;
  cluster: string;
  type: string;
  prompt_en: string;
  prompt_ar: string;
}

interface ImprovementArea {
  area: string;
  suggestion: string;
}

interface ScoreResult {
  clarity: number;
  specificity: number;
  relevance: number;
  depth: number;
  structure: number;
  total: number;
  feedback: string;
  improvement_areas: ImprovementArea[];
}

export default function MockInterviewPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [response, setResponse] = useState('');
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState('');
  const [addedAreas, setAddedAreas] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/login'); return; }
      const res = await fetch('/api/mock-interview/scenario');
      if (res.ok) {
        const data = await res.json();
        setScenario(data.scenario);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load scenario');
      }
      setLoading(false);
    }
    load().catch((e) => { console.error(e); setError('Network error'); setLoading(false); });
  }, []);

  async function handleSubmit() {
    if (!scenario || response.trim().length < 50) return;
    setScoring(true);
    setError('');
    const res = await fetch('/api/mock-interview/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_key: scenario.scenario_key, response_text: response.trim() }),
    });
    setScoring(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data.result);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Scoring failed');
    }
  }

  async function handleAddArea(area: ImprovementArea, idx: number) {
    const res = await fetch('/api/roadmap/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title_en: `Improve: ${area.area}`,
        title_ar: `تحسين: ${area.area}`,
        description_en: `${area.suggestion} (From a mock interview)`,
        description_ar: `${area.suggestion} (من مقابلة تجريبية)`,
        dimension_target: 'soft_skills',
        difficulty: 2,
        hours: 8,
        tier: 3,
        resources: [],
      }),
    });
    if (res.ok) {
      setAddedAreas((prev) => new Set(prev).add(idx));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Failed to add to roadmap');
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const SCORE_BARS: { key: keyof ScoreResult; label: string }[] = [
    { key: 'clarity', label: t('mock.clarity') },
    { key: 'specificity', label: t('mock.specificity') },
    { key: 'relevance', label: t('mock.relevance') },
    { key: 'depth', label: t('mock.depth') },
    { key: 'structure', label: t('mock.structure') },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="auth-title">{t('mock.title')}</h1>
      </header>

      {error && <div className="alert-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!result && scenario && (
        <div className="profile-section">
          <h2 className="profile-section-title">{t('mock.scenario_label')}</h2>
          <p className="experience-meta" style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
            {lang === 'ar' ? scenario.prompt_ar : scenario.prompt_en}
          </p>
          <textarea
            className="input"
            style={{ width: '100%', minHeight: '180px', marginTop: '1rem', resize: 'vertical' }}
            placeholder={t('mock.response_placeholder')}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span className="experience-meta">{response.trim().length} / 50+</span>
            <button
              className="btn-primary"
              disabled={response.trim().length < 50 || scoring}
              onClick={handleSubmit}
            >
              {scoring ? t('mock.scoring') : t('mock.submit')}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="profile-section">
          <h2 className="profile-section-title">{t('mock.scores_title')}</h2>
          {SCORE_BARS.map((bar) => {
            const v = result[bar.key] as number;
            return (
              <div key={bar.key} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="experience-meta">{bar.label}</span>
                  <span className="experience-meta"><b>{v} / 20</b></span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(108,92,231,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${(v / 20) * 100}%`, height: '100%', background: 'var(--gradient-1)', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}

          <div style={{ textAlign: 'center', margin: '1.25rem 0' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{Math.round(result.total)}</span>
            <span className="experience-meta"> / 100 — {t('mock.total')}</span>
          </div>

          <h3 className="profile-section-title">{t('mock.feedback')}</h3>
          <p className="experience-meta" style={{ lineHeight: 1.7 }}>{result.feedback}</p>

          <h3 className="profile-section-title" style={{ marginTop: '1.25rem' }}>{t('mock.improvements')}</h3>
          <div className="experience-list">
            {result.improvement_areas.map((area, idx) => {
              const added = addedAreas.has(idx);
              return (
                <div key={idx} className="experience-row">
                  <div className="experience-info">
                    <p className="experience-title-text" style={{ fontSize: '0.9rem' }}>{area.area}</p>
                    <p className="experience-meta">{area.suggestion}</p>
                  </div>
                  <button
                    className={added ? 'btn-secondary' : 'btn-primary'}
                    disabled={added}
                    onClick={() => handleAddArea(area, idx)}
                  >
                    {added ? (lang === 'ar' ? '✓ مضاف' : '✓ Added') : t('mock.add_to_roadmap')}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            className="btn-secondary"
            style={{ marginTop: '1.25rem' }}
            onClick={async () => {
              setResult(null);
              setResponse('');
              setAddedAreas(new Set());
              const res = await fetch('/api/mock-interview/scenario');
              if (res.ok) setScenario((await res.json()).scenario);
            }}
          >
            {lang === 'ar' ? 'محاولة سيناريو آخر' : 'Try another scenario'}
          </button>
        </div>
      )}
    </div>
  );
}
