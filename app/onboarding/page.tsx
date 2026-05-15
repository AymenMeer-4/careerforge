'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import universitiesData from '@/data/universities.json';
import regionsData from '@/data/regions-cities.json';
import { mapSpecialtyToCluster } from '@/lib/cluster';

export default function OnboardingPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [university, setUniversity] = useState('');
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [region, setRegion] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [gpaScale, setGpaScale] = useState('5.0');
  const [gpaValue, setGpaValue] = useState(5.0);
  const [isEditing, setIsEditing] = useState(false);

  const detectedCluster = specialty ? mapSpecialtyToCluster(specialty) : '';

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data) {
          return loadProfile();
        }
        return null;
      })
      .catch(err => console.error('Onboarding auth error:', err))
      .finally(() => setLoading(false));
  }, []);

  async function loadProfile() {
    try {
      const res = await fetch('/api/students/profile');
      if (res.ok) {
        const profile = await res.json();
        if (profile.onboarding_completed_at) {
          setIsEditing(true);
          setUniversity(profile.university === 'Not Enrolled' ? '' : profile.university);
          setNotEnrolled(profile.university === 'Not Enrolled');
          setRegion(profile.region || '');
          setSpecialty(profile.specialty || '');
          setYearOfStudy(profile.year_of_study || '');
          setGpaScale(profile.gpa_scale || '5.0');
          setGpaValue(Number(profile.gpa_value) || 5.0);
        }
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  }

  useEffect(() => {
    if (gpaScale === '4.0') setGpaValue(4.0);
    else if (gpaScale === '5.0') setGpaValue(5.0);
    else if (gpaScale === '100') setGpaValue(100);
  }, [gpaScale]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        university: notEnrolled ? 'Not Enrolled' : university,
        region,
        specialty,
        cluster: detectedCluster,
        year_of_study: yearOfStudy,
        gpa_scale: gpaScale,
        gpa_value: gpaValue,
        onboarding_completed_at: new Date().toISOString()
      };

      const res = await fetch('/api/students/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetch('/api/readiness/recompute', { method: 'POST' });
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return notEnrolled || university.trim() !== '';
      case 2: return region !== '';
      case 3: return specialty.trim() !== '';
      case 4: return yearOfStudy !== '';
      case 5: return gpaScale !== '';
      case 6: return true;
      default: return false;
    }
  };

  const years = ['1', '2', '3', '4', '5', '6', 'Graduate'];
  const scales = ['4.0', '5.0', '100'];

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div style={{ marginBottom: '2rem' }}>
          <p className="experience-meta">{t('onboarding.step_of').replace('{current}', step.toString())}</p>
          <div style={{ height: '4px', backgroundColor: 'var(--border)', width: '100%', borderRadius: '2px', marginTop: '0.5rem' }}>
            <div style={{ height: '100%', backgroundColor: 'var(--primary)', width: `${(step / 6) * 100}%`, borderRadius: '2px', transition: 'width 0.3s' }}></div>
          </div>
        </div>

        <div style={{ minHeight: '300px' }}>
          {step === 1 && (
            <div>
              <h2 className="step-title">{t('onboarding.university_label')}</h2>
              <input 
                type="text" 
                list="universities-list"
                className="input" 
                value={university}
                onChange={(e) => { setUniversity(e.target.value); setNotEnrolled(false); }}
                placeholder={t('onboarding.university_placeholder')}
                disabled={notEnrolled}
              />
              <datalist id="universities-list">
                {universitiesData.map(u => (
                  <option key={u.key} value={lang === 'ar' ? u.name_ar : u.name_en} />
                ))}
              </datalist>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                <input type="checkbox" checked={notEnrolled} onChange={(e) => {
                  setNotEnrolled(e.target.checked);
                  if (e.target.checked) setUniversity('');
                }} />
                <span className="form-label">{t('onboarding.not_enrolled')}</span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="step-title">{t('onboarding.region_label')}</h2>
              <div className="chips-grid">
                {regionsData.map(r => (
                  <button
                    key={r.key}
                    className={`btn-secondary ${region === r.key ? 'active' : ''}`}
                    onClick={() => setRegion(r.key)}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '20px',
                      backgroundColor: region === r.key ? 'var(--primary)' : 'var(--bg)',
                      color: region === r.key ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {lang === 'ar' ? r.name_ar : r.name_en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="step-title">{t('onboarding.specialty_label')}</h2>
              <input 
                type="text" 
                className="input"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={t('onboarding.specialty_placeholder')}
              />
              {specialty && (
                <div style={{ marginTop: '1rem' }}>
                  <p className="experience-meta">{t('onboarding.cluster_detected')}: <span className="badge badge-verified">{detectedCluster}</span></p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="step-title">{t('onboarding.year_label')}</h2>
              <div className="chips-grid">
                {years.map(y => (
                  <button
                    key={y}
                    className={`btn-secondary ${yearOfStudy === y.toLowerCase() ? 'active' : ''}`}
                    onClick={() => setYearOfStudy(y.toLowerCase())}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '20px',
                      backgroundColor: yearOfStudy === y.toLowerCase() ? 'var(--primary)' : 'var(--bg)',
                      color: yearOfStudy === y.toLowerCase() ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {t(`onboarding.year_${y.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="step-title">{t('onboarding.gpa_scale_label')}</h2>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {scales.map(s => (
                  <button
                    key={s}
                    className={`btn-secondary ${gpaScale === s ? 'active' : ''}`}
                    onClick={() => setGpaScale(s)}
                    style={{ 
                      flex: 1, 
                      padding: '1.5rem', 
                      fontSize: '1.25rem', 
                      fontWeight: '700',
                      backgroundColor: gpaScale === s ? 'var(--primary)' : 'var(--bg)',
                      color: gpaScale === s ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="step-title">{t('onboarding.gpa_value_label')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="range" 
                  min={0} 
                  max={gpaScale === '100' ? 100 : parseFloat(gpaScale)} 
                  step={gpaScale === '100' ? 1 : 0.01}
                  value={gpaValue}
                  onChange={(e) => setGpaValue(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span className="auth-title" style={{ minWidth: '4rem', textAlign: 'right' }}>
                  {gpaValue.toFixed(gpaScale === '100' ? 0 : 2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="step-actions">
          {step > 1 && (
            <button 
              onClick={handleBack} 
              className="btn-secondary"
              disabled={submitting}
            >
              {t('onboarding.back')}
            </button>
          )}
          
          {step < 6 ? (
            <button 
              onClick={handleNext} 
              className="btn-primary"
              disabled={!isStepValid()}
            >
              {t('onboarding.continue')}
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? t('auth.creating_account') : t('onboarding.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
