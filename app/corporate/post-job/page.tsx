'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import { REGIONS } from '@/lib/locations';
import {
  ROLE_CATEGORIES,
  SKILL_ONTOLOGY,
  CERT_ONTOLOGY,
  clusterFromSector,
} from '@/lib/corporate-options';

const POSTING_TYPES = ['full_time', 'internship', 'coop', 'training'] as const;
const EDU_LEVELS = ['high_school', 'bachelor', 'master', 'phd'] as const;

export default function PostJobPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const L = (b: { en: string; ar: string }) => (lang === 'ar' ? b.ar : b.en);

  const [loading, setLoading] = useState(true);
  const [cluster, setCluster] = useState<'tech' | 'engineering' | 'medicine'>('tech');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [postingType, setPostingType] = useState<string>('full_time');
  const [roleCategory, setRoleCategory] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [certs, setCerts] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<{ key: string; label: string }[]>([]);
  const [customCerts, setCustomCerts] = useState<{ key: string; label: string }[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');
  const [expYears, setExpYears] = useState('0');
  const [eduLevel, setEduLevel] = useState<string>('bachelor');
  const [hiringOutcome, setHiringOutcome] = useState(false);
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/corporate/login'); return; }
      const p = await fetch('/api/corporates/profile').then((x) => x.json());
      if (!p.profile) { router.push('/corporate/dashboard'); return; }
      setCluster(clusterFromSector(p.profile.sector));
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [router]);

  const roles = ROLE_CATEGORIES[cluster] ?? [];
  const skillOptions = SKILL_ONTOLOGY[cluster] ?? [];
  const certOptions = CERT_ONTOLOGY[cluster] ?? [];
  const cities = useMemo(
    () => REGIONS.find((r) => r.en === region)?.cities ?? [],
    [region],
  );

  function toggleSkill(key: string) {
    setSkills((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = 3;
      return next;
    });
  }
  function toggleCert(key: string) {
    setCerts((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  const slug = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function addCustomSkill() {
    const label = newSkill.trim();
    const key = slug(label);
    if (!key) return;
    const known = skillOptions.some((s) => s.key === key) || customSkills.some((s) => s.key === key);
    if (!known) setCustomSkills((p) => [...p, { key, label }]);
    setSkills((p) => ({ ...p, [key]: p[key] ?? 3 }));
    setNewSkill('');
  }

  function addCustomCert() {
    const label = newCert.trim();
    const key = slug(label);
    if (!key) return;
    const known = certOptions.some((c) => c.key === key) || customCerts.some((c) => c.key === key);
    if (!known) setCustomCerts((p) => [...p, { key, label }]);
    setCerts((p) => (p.includes(key) ? p : [...p, key]));
    setNewCert('');
  }

  const skillRows = [
    ...skillOptions.map((s) => ({ key: s.key, label: L(s) })),
    ...customSkills,
  ];
  const certRows = [
    ...certOptions.map((c) => ({ key: c.key, label: L(c) })),
    ...customCerts,
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const skillArr = Object.entries(skills).map(([skill, importance]) => ({ skill, importance }));

    if (!title.trim()) return setError(t('postjob.err_title'));
    if (!roleCategory) return setError(t('postjob.err_role'));
    if (!description.trim()) return setError(t('postjob.err_description'));
    if (!descriptionAr.trim()) return setError(t('postjob.err_description_ar'));
    if (!region) return setError(t('postjob.err_region'));
    if (!city) return setError(t('postjob.err_city'));
    const sMin = parseInt(salaryMin, 10);
    const sMax = parseInt(salaryMax, 10);
    if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || sMin < 0 || sMax < sMin) {
      return setError(t('postjob.err_salary'));
    }
    const yrs = parseInt(expYears, 10);
    if (!Number.isFinite(yrs) || yrs < 0) return setError(t('postjob.err_experience'));
    if (!deadline) return setError(t('postjob.err_deadline'));

    setSubmitting(true);
    const res = await fetch('/api/corporates/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        posting_type: postingType,
        role_category: roleCategory,
        description: description.trim(),
        description_ar: descriptionAr.trim(),
        location_region: region,
        location_city: city,
        salary_min: sMin,
        salary_max: sMax,
        required_skills: skillArr,
        required_certs: certs,
        required_experience_years: yrs,
        required_education_level: eduLevel,
        hiring_outcome_flag: hiringOutcome,
        deadline,
      }),
    });
    if (res.ok) {
      router.push('/corporate/dashboard?posted=1');
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || t('postjob.err_generic'));
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const field: React.CSSProperties = { marginBottom: '1.1rem' };
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="auth-title">{t('corporate.post_job')}</h1>
      </header>

      {error && <div className="alert-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="profile-section">
        <div style={field}>
          <label style={labelStyle}>{t('postjob.title')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.posting_type')}</label>
          <div className="chips-grid">
            {POSTING_TYPES.map((pt) => (
              <button type="button" key={pt}
                className={`level-chip ${postingType === pt ? 'selected' : ''}`}
                onClick={() => setPostingType(pt)}>
                {t(`postjob.pt_${pt}`)}
              </button>
            ))}
          </div>
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.role_category')}</label>
          <select className="input" value={roleCategory} onChange={(e) => setRoleCategory(e.target.value)}>
            <option value="">—</option>
            {roles.map((r) => <option key={r.key} value={r.key}>{L(r)}</option>)}
          </select>
          <p className="experience-meta" style={{ marginTop: '4px' }}>
            {t('postjob.cluster_auto')}: {cluster}
          </p>
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.description')}</label>
          <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.description_ar')}</label>
          <textarea className="input" rows={5} dir="rtl" value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)} />
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.region')}</label>
          <div className="chips-grid">
            {REGIONS.map((r) => (
              <button type="button" key={r.en}
                className={`level-chip ${region === r.en ? 'selected' : ''}`}
                onClick={() => { setRegion(r.en); setCity(''); }}>
                {lang === 'ar' ? r.ar : r.en}
              </button>
            ))}
          </div>
        </div>

        {region && (
          <div style={field}>
            <label style={labelStyle}>{t('postjob.city')}</label>
            <div className="chips-grid">
              {cities.map((c) => (
                <button type="button" key={c.en}
                  className={`level-chip ${city === c.en ? 'selected' : ''}`}
                  onClick={() => setCity(c.en)}>
                  {c.en} — {c.ar}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...field, display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('postjob.salary_min')}</label>
            <input className="input" type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('postjob.salary_max')}</label>
            <input className="input" type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.required_skills')}</label>
          <p className="experience-meta" style={{ marginBottom: '8px' }}>{t('postjob.skills_optional')}</p>
          <div className="experience-list">
            {skillRows.map((s) => {
              const on = s.key in skills;
              return (
                <div key={s.key} className="experience-row">
                  <button type="button"
                    className={`level-chip ${on ? 'selected' : ''}`}
                    onClick={() => toggleSkill(s.key)}>
                    {s.label}
                  </button>
                  {on && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="range" min={1} max={5} value={skills[s.key]}
                        onChange={(e) => setSkills((p) => ({ ...p, [s.key]: Number(e.target.value) }))} />
                      <span className="status-chip">{t('postjob.importance')} {skills[s.key]}/5</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="experience-meta" style={{ margin: '10px 0 6px' }}>{t('postjob.custom_skill_hint')}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="input" value={newSkill}
              placeholder={t('postjob.custom_skill_placeholder')}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }} />
            <button type="button" className="btn-secondary" onClick={addCustomSkill}>{t('postjob.add')}</button>
          </div>
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.required_certs')}</label>
          <p className="experience-meta" style={{ marginBottom: '8px' }}>{t('postjob.certs_optional')}</p>
          <div className="chips-grid">
            {certRows.map((c) => (
              <button type="button" key={c.key}
                className={`level-chip ${certs.includes(c.key) ? 'selected' : ''}`}
                onClick={() => toggleCert(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="experience-meta" style={{ margin: '10px 0 6px' }}>{t('postjob.custom_cert_hint')}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="input" value={newCert}
              placeholder={t('postjob.custom_cert_placeholder')}
              onChange={(e) => setNewCert(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCert(); } }} />
            <button type="button" className="btn-secondary" onClick={addCustomCert}>{t('postjob.add')}</button>
          </div>
        </div>

        <div style={{ ...field, display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('postjob.experience_years')}</label>
            <input className="input" type="number" min={0} value={expYears} onChange={(e) => setExpYears(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('postjob.education_level')}</label>
            <select className="input" value={eduLevel} onChange={(e) => setEduLevel(e.target.value)}>
              {EDU_LEVELS.map((ed) => <option key={ed} value={ed}>{t(`postjob.edu_${ed}`)}</option>)}
            </select>
          </div>
        </div>

        <div style={field}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={hiringOutcome} onChange={(e) => setHiringOutcome(e.target.checked)} />
            <span>{t('postjob.hiring_outcome')}</span>
          </label>
        </div>

        <div style={field}>
          <label style={labelStyle}>{t('postjob.deadline')}</label>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <button type="submit" className="btn-primary" disabled={submitting} style={{ minWidth: '200px' }}>
          {submitting ? '...' : t('postjob.submit')}
        </button>
      </form>
    </div>
  );
}
