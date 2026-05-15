'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface Student {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  region: string;
  specialty: string;
  cluster: string;
  year_of_study: string;
  gpa_scale: string;
  gpa_value: number;
  onboarding_completed_at: string;
  city?: string;
  opportunity_types: any[];
  hours_per_week?: number;
  target_role?: string;
  interests: any[];
  profile_completed_at?: string;
  updated_at: string;
}

interface Dimensions {
  general_readiness: number;
}

interface CareerMatch {
  key: string;
  name_en: string;
  name_ar: string;
  score: number;
  job_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [student, setStudent] = useState<Student | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [stats, setStats] = useState({ expCount: 0, certCount: 0, completedNodes: 0, mockAvg: 0 });
  const [matches, setMatches] = useState<CareerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) { router.push('/login'); return; }

      const [profileRes, readinessRes, statsRes, matchesRes] = await Promise.all([
        fetch('/api/students/profile'),
        fetch('/api/readiness'),
        fetch('/api/students/stats'),
        fetch('/api/students/career-matches'),
      ]);

      if (profileRes.ok) setStudent(await profileRes.json());
      if (readinessRes.ok) setDimensions(await readinessRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.matches ?? []);
      }
      setLoading(false);
    }
    load().catch(err => { console.error('Dashboard load error:', err); setLoading(false); });
  }, []);

  const handleGenerateRoadmap = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/roadmap/generate', { method: 'POST' });
      if (res.ok) {
        router.push('/roadmap');
      } else {
        const data = await res.json();
        alert(data.error || 'Generation failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setGenerating(false);
    }
  }, [router]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!student) return null;

  const generalReadiness = dimensions?.general_readiness ?? 0;
  const showProfileBanner = !student.profile_completed_at;
  const timeSinceUpdate = new Date(student.updated_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');

  // Safely coerce target_role to string regardless of what the API returns
  const targetRoleStr = String(student.target_role ?? '').replace(/_/g, ' ');

  // Show generate roadmap CTA when profile has the minimum required fields
  const canGenerateRoadmap = !!student.target_role &&
    student.opportunity_types?.length > 0 &&
    !!student.hours_per_week;

  // Score color bands
  const readinessColor = generalReadiness >= 70 ? '#00b894' : generalReadiness >= 40 ? '#f39c12' : '#e74c3c';

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{t('dashboard.welcome').replace('{name}', student.name.split(' ')[0])}</h1>
          <p className="auth-subtitle">{t('dashboard.last_updated').replace('{time}', timeSinceUpdate)}</p>
        </div>
      </header>

      <div className="dashboard-grid">

        {/* ── Profile completion banner ────────────────────────────────────── */}
        {showProfileBanner && (
          <div className="alert-banner" style={{ gridColumn: '1 / -1' }}>
            <h3 className="experience-title-text">{t('dashboard.complete_profile_title')}</h3>
            <p className="experience-meta" style={{ marginTop: '4px' }}>{t('dashboard.complete_profile_desc')}</p>
            <button onClick={() => router.push('/profile')} className="btn-primary" style={{ marginTop: '1rem' }}>
              {t('dashboard.complete_profile_cta')}
            </button>
          </div>
        )}

        {/* ── Generate Roadmap CTA (visible when profile is ready) ─────────── */}
        {canGenerateRoadmap && (
          <div
            className="profile-section"
            style={{
              gridColumn: '1 / -1',
              background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,180,166,0.06))',
              border: '1px solid rgba(108,92,231,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 className="experience-title-text" style={{ marginBottom: '4px' }}>
                ✨ {lang === 'ar' ? 'خارطة طريقك جاهزة للتوليد' : 'Your roadmap is ready to generate'}
              </h3>
              <p className="experience-meta">
                {lang === 'ar'
                  ? `Claude سيُنشئ خطة مخصصة لدورك المستهدف: ${targetRoleStr}`
                  : `Claude will create a personalized plan for your target role: ${targetRoleStr}`}
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={handleGenerateRoadmap}
              disabled={generating}
              style={{ flexShrink: 0 }}
            >
              {generating ? t('dashboard.generating') : t('dashboard.generate_roadmap')}
            </button>
          </div>
        )}

        {/* ── Readiness ring ────────────────────────────────────────────────── */}
        <div className="profile-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <h2 className="profile-section-title">{t('dashboard.general_readiness')}</h2>
          <div style={{ position: 'relative', width: '160px', height: '160px' }}>
            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(108,92,231,0.1)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="url(#dashGrad)" strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * generalReadiness) / 100}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
              <defs>
                <linearGradient id="dashGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#6c5ce7" />
                  <stop offset="1" stopColor="#00cec9" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: readinessColor }}>
                {Math.round(generalReadiness)}%
              </span>
            </div>
          </div>
          {showProfileBanner && (
            <p className="experience-meta" style={{ textAlign: 'center', fontSize: '0.78rem' }}>
              {t('dashboard.readiness_partial')}
            </p>
          )}
        </div>

        {/* ── Top Career Matches ────────────────────────────────────────────── */}
        <div className="profile-section">
          <h2 className="profile-section-title">{t('dashboard.top_matches')}</h2>
          {matches.length === 0 ? (
            <p className="experience-meta" style={{ fontSize: '0.82rem' }}>
              {lang === 'ar' ? 'أكمل ملفك الشخصي لرؤية التطابقات' : 'Complete your profile to see matches'}
            </p>
          ) : (
            <div className="experience-list">
              {matches.map((match) => {
                const matchColor = match.score >= 70 ? '#00b894' : match.score >= 40 ? '#f39c12' : '#e74c3c';
                return (
                  <div key={match.key} className="experience-row">
                    <div className="experience-info">
                      <p className="experience-title-text" style={{ fontSize: '0.9rem' }}>
                        {lang === 'ar' ? match.name_ar : match.name_en}
                      </p>
                      {match.job_count > 0 && (
                        <p className="experience-meta" style={{ fontSize: '0.72rem' }}>
                          {match.job_count} {lang === 'ar' ? 'وظيفة مفتوحة' : 'open jobs'}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'rgba(108,92,231,0.1)', overflow: 'hidden' }}>
                        <div style={{ width: `${match.score}%`, height: '100%', borderRadius: '3px', background: matchColor, transition: 'width 1s ease' }} />
                      </div>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem', color: matchColor, minWidth: '36px' }}>
                        {match.score}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Progress stats ────────────────────────────────────────────────── */}
        <div className="profile-section" style={{ gridColumn: '1 / -1' }}>
          <h2 className="profile-section-title">{t('dashboard.progress_title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {[
              { label: t('dashboard.skills_count'), value: stats.expCount },
              { label: t('dashboard.certs_count'), value: stats.certCount },
              { label: t('dashboard.nodes_completed'), value: stats.completedNodes },
              { label: t('dashboard.interview_score'), value: stats.mockAvg > 0 ? stats.mockAvg.toFixed(1) : '--' },
            ].map((stat, i) => (
              <div key={i} className="experience-row">
                <div className="experience-info">
                  <p className="experience-meta">{stat.label}</p>
                  <p className="experience-title-text" style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <div className="profile-section" style={{ gridColumn: '1 / -1' }}>
          <h2 className="profile-section-title">{t('dashboard.quick_actions')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { label: t('dashboard.go_skills'), desc: t('landing.feature2_desc'), path: '/skills', icon: '🎯' },
              { label: t('dashboard.go_roadmap'), desc: t('landing.feature3_desc'), path: '/roadmap', icon: '🗺️' },
              { label: t('dashboard.go_simulator'), desc: t('landing.feature4_desc'), path: '/simulator', icon: '⚡' },
            ].map(action => (
              <button
                key={action.path}
                className="btn-secondary"
                onClick={() => router.push(action.path)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '1.25rem', gap: '6px', height: 'auto', textAlign: lang === 'ar' ? 'right' : 'left' }}
              >
                <span style={{ fontSize: '1.5rem' }}>{action.icon}</span>
                <span style={{ fontWeight: '700' }}>{action.label}</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>{action.desc}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}