'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

type BoostMatrix = Record<string, Record<string, number>>;

interface RoleMatch {
  role_key: string;
  name_en: string;
  name_ar: string;
  base_match: number;
  simulated_match: number;
}

interface SimResult {
  base_readiness: number;
  simulated_readiness: number;
  role_matches: RoleMatch[];
}

export default function SimulatorPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [matrix, setMatrix] = useState<BoostMatrix>({});
  const [topSkills, setTopSkills] = useState<string[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SimResult | null>(null);

  const tr = (key: string, vars: Record<string, string | number>) => {
    let s = t(key);
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  const compute = useCallback(async (skills: Set<string>) => {
    const res = await fetch('/api/simulator/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSkills: [...skills] }),
    });
    if (res.ok) setResult(await res.json());
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => { if (r.status === 401) { router.push('/login'); return null; } return r.json(); })
      .then(async data => {
        if (!data) return;
        setSession(data);
        const bRes = await fetch('/api/simulator/boost-matrix');
        if (bRes.ok) {
          const b = await bRes.json();
          setMatrix(b.matrix || {});
          // Top 6 skills by boost toward the target role (fallback: max boost).
          const ranked = Object.entries(b.matrix as BoostMatrix)
            .map(([skill, roles]) => {
              const toTarget = b.target_role ? (roles[b.target_role] ?? 0) : 0;
              const maxBoost = Math.max(0, ...Object.values(roles));
              return { skill, score: toTarget || maxBoost };
            })
            .sort((a, b2) => b2.score - a.score)
            .slice(0, 6)
            .map(x => x.skill);
          setTopSkills(ranked);
        }
        await compute(new Set());
      })
      .finally(() => setLoading(false));
  }, [router, compute]);

  const toggle = (skill: string) => {
    const next = new Set(active);
    if (next.has(skill)) next.delete(skill); else next.add(skill);
    setActive(next);
    compute(next);
  };

  // Top affected role for a skill (highest boost).
  const topAffected = (skill: string) => {
    const roles = matrix[skill];
    if (!roles) return null;
    let best: { role: string; boost: number } | null = null;
    for (const [role, boost] of Object.entries(roles)) {
      if (!best || boost > best.boost) best = { role, boost };
    }
    return best;
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!session) return null;

  const ring = result?.simulated_readiness ?? 0;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference * (1 - ring / 100);

  return (
    <div className="skills-page">
      <header className="skills-page-header">
        <h1 className="auth-title">{t('simulator.title')}</h1>
        <p className="skills-page-subtitle">{t('simulator.toggle_hint')}</p>
      </header>

      <div className="skills-two-col">
        {/* ── Left: skill toggles ── */}
        <div className="profile-section">
          <h2 className="profile-section-title">{t('simulator.skills_label')}</h2>
          {topSkills.length === 0 && <p className="experience-meta">{t('simulator.no_skills')}</p>}
          {topSkills.map(skill => {
            const aff = topAffected(skill);
            return (
              <div key={skill} className="sim-toggle-row">
                <div className="sim-toggle-info">
                  <div className="sim-toggle-name">{skill.replace(/-/g, ' ')}</div>
                  {aff && (
                    <div className="sim-toggle-effect">
                      {tr('simulator.affects', { n: aff.boost, role: aff.role.replace(/_/g, ' ') })}
                    </div>
                  )}
                </div>
                <div
                  className={`sim-switch${active.has(skill) ? ' on' : ''}`}
                  onClick={() => toggle(skill)}
                  role="switch"
                  aria-checked={active.has(skill)}
                />
              </div>
            );
          })}
        </div>

        {/* ── Right: simulated readiness + role matches ── */}
        <div className="profile-section">
          <h2 className="profile-section-title">{t('simulator.simulated_readiness')}</h2>
          <div className="score-card">
            <div className="score-ring">
              <svg viewBox="0 0 160 160">
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6c5ce7" />
                    <stop offset="100%" stopColor="#00cec9" />
                  </linearGradient>
                </defs>
                <circle className="bg" cx="80" cy="80" r="70" />
                <circle
                  className="progress"
                  cx="80" cy="80" r="70"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="score-value">{Math.round(ring)}</div>
            </div>
            {result && result.simulated_readiness !== result.base_readiness && (
              <div className="sim-role-delta">
                +{(result.simulated_readiness - result.base_readiness).toFixed(1)}
              </div>
            )}
          </div>

          <h3 className="profile-section-title" style={{ marginTop: '1rem' }}>
            {t('simulator.role_matches')}
          </h3>
          {(result?.role_matches || []).slice(0, 4).map(rm => (
            <div key={rm.role_key} className="sim-role-row">
              <span className="sim-role-name">{ar ? rm.name_ar : rm.name_en}</span>
              {rm.simulated_match > rm.base_match && (
                <span className="sim-role-delta">+{rm.simulated_match - rm.base_match}</span>
              )}
              <span className="sim-role-score">{rm.simulated_match}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
