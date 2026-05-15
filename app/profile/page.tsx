'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';
import regionsCities from '@/data/regions-cities.json';
import roleCatalog from '@/data/role-catalog.json';
import universities from '@/data/universities.json';

const opportunityTypeOptions = [
  { value: 'full_time', labelKey: 'profile.opportunity_types' }, // Note: We should probably have more keys or just use the label
  { value: 'internship', label: 'Internship' },
  { value: 'coop', label: 'COOP' },
  { value: 'training', label: 'Training program' }
];

const interestOptions = [
  'Artificial Intelligence', 'Data Science', 'Web Development', 'Mobile Apps', 
  'Cybersecurity', 'Cloud Computing', 'UI/UX Design', 'Product Management'
];

export default function ProfilePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<any>(null);
  
  // Profile state
  const [profile, setProfile] = useState<any>({});
  
  // Experiences
  const [experiences, setExperiences] = useState<any[]>([]);
  const [showAddExp, setShowAddExp] = useState(false);
  const [expForm, setExpForm] = useState({ type: 'certificate', title: '', issuer: '', date_completed: '', file: null as File | null });
  const [expVerifying, setExpVerifying] = useState(false);
  const [newInterest, setNewInterest] = useState('');
  const [newRole, setNewRole] = useState('');

  // Transcript
  const [courses, setCourses] = useState<any[]>([]);
  const [transcriptParsing, setTranscriptParsing] = useState(false);
  const [coursesSaving, setCoursesSaving] = useState(false);

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
          setSession(data);
          return fetchProfile();
        }
        return null;
      })
      .catch(err => console.error('Profile auth error:', err))
      .finally(() => setLoading(false));
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/students/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          university: data.university || '',
          region: data.region || '',
          specialty: data.specialty || '',
          year_of_study: data.year_of_study || '',
          gpa_scale: data.gpa_scale || '5.0',
          gpa_value: data.gpa_value || 0,
          city: data.city || '',
          opportunity_types: Array.isArray(data.opportunity_types) ? data.opportunity_types : [],
          target_role: Array.isArray(data.target_role) ? data.target_role : (data.target_role ? [data.target_role] : []),
          hours_per_week: data.hours_per_week || 20,
          interests: Array.isArray(data.interests) ? data.interests : [],
          employment_experience: data.employment_experience || '',
          cluster: data.cluster || ''
        });
        setExperiences(data.experiences || []);
        setCourses(data.courses || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProfileChange = (field: string, value: any) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/students/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpVerifying(true);
    try {
      const formData = new FormData();
      formData.append('type', expForm.type);
      formData.append('title', expForm.title);
      formData.append('issuer', expForm.issuer);
      formData.append('date_completed', expForm.date_completed);
      if (expForm.file) {
        formData.append('cert_image', expForm.file);
      } else {
        setExpVerifying(false);
        return;
      }

      const res = await fetch('/api/students/experiences', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setExperiences([data.experience, ...experiences]);
        setShowAddExp(false);
        setExpForm({ type: 'certificate', title: '', issuer: '', date_completed: '', file: null });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExpVerifying(false);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      const res = await fetch(`/api/students/experiences/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExperiences(experiences.filter(exp => exp.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setTranscriptParsing(true);
    try {
      const formData = new FormData();
      formData.append('transcript_image', e.target.files[0]);
      
      const res = await fetch('/api/students/transcript/parse', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setCourses(data.courses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTranscriptParsing(false);
    }
  };

  const saveCourses = async () => {
    setCoursesSaving(true);
    try {
      const res = await fetch('/api/students/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses })
      });
      if (res.ok) {
        // Success
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCoursesSaving(false);
    }
  };

  const toggleArrayItem = (field: string, item: string) => {
    setProfile((prev: any) => {
      const arr = prev[field] || [];
      if (arr.includes(item)) return { ...prev, [field]: arr.filter((x: string) => x !== item) };
      return { ...prev, [field]: [...arr, item] };
    });
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!session) return null;

  const currentRegion = regionsCities.find(r => r.key === profile.region);
  const cities = currentRegion ? currentRegion.cities : [];
  const validRoles = roleCatalog.filter(r => r.cluster === profile.cluster || profile.cluster === 'unsupported' || !profile.cluster);

  return (
    <div className="profile-page">
      <h1 className="auth-title" style={{ marginBottom: '2rem' }}>{t('nav.profile')}</h1>
      
      {/* Section A: Basic Info */}
      <section className="profile-section">
        <h2 className="profile-section-title">{t('profile.section_basic')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">{t('profile.name')}</label>
            <input type="text" className="input" value={profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.email')}</label>
            <input type="email" className="input" value={profile.email} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.phone')}</label>
            <input type="tel" className="input" value={profile.phone} onChange={e => handleProfileChange('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.university')}</label>
            <select className="input" value={profile.university} onChange={e => handleProfileChange('university', e.target.value)}>
              <option value="">{t('onboarding.university_placeholder')}</option>
              {universities.map((u: any) => <option key={u.name_en} value={lang === 'ar' ? u.name_ar : u.name_en}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.region')}</label>
            <select className="input" value={profile.region} onChange={e => handleProfileChange('region', e.target.value)}>
              <option value="">{t('onboarding.region_label')}</option>
              {regionsCities.map(r => <option key={r.key} value={r.key}>{lang === 'ar' ? r.name_ar : r.name_en}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.specialty')}</label>
            <input type="text" className="input" value={profile.specialty} onChange={e => handleProfileChange('specialty', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.year')}</label>
            <select className="input" value={profile.year_of_study} onChange={e => handleProfileChange('year_of_study', e.target.value)}>
              <option value="">{t('onboarding.year_label')}</option>
              {[1,2,3,4,5,6,'graduate'].map(y => <option key={y} value={y.toString()}>{t(`onboarding.year_${y}`)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t('profile.gpa_scale')}</label>
              <select className="input" value={profile.gpa_scale} onChange={e => handleProfileChange('gpa_scale', e.target.value)}>
                <option value="4.0">4.0</option>
                <option value="5.0">5.0</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t('profile.gpa_value')}</label>
              <input type="number" step="0.01" className="input" value={profile.gpa_value} onChange={e => handleProfileChange('gpa_value', parseFloat(e.target.value))} />
            </div>
          </div>
        </div>
      </section>

      {/* Section B: Goals */}
      <section className="profile-section">
        <h2 className="profile-section-title">{t('profile.section_goals')}</h2>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">{t('profile.city')}</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Enter your city"
              value={profile.city || ''} 
              onChange={e => handleProfileChange('city', e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.opportunity_types')}</label>
            <div className="chips-grid">
              {['full_time', 'internship', 'coop', 'training'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleArrayItem('opportunity_types', opt)}
                  className={`btn-secondary ${profile.opportunity_types?.includes(opt) ? 'active' : ''}`}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '20px', 
                    fontSize: '0.875rem',
                    backgroundColor: profile.opportunity_types?.includes(opt) ? 'var(--primary)' : 'var(--bg)',
                    color: profile.opportunity_types?.includes(opt) ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)'
                  }}
                >{opt.replace('_', ' ').toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.target_role')}</label>
            <div className="chips-grid" style={{ marginBottom: '1rem' }}>
              {validRoles.map((r: any) => {
                const roleName = lang === 'ar' ? r.name_ar : r.name_en;
                const isActive = profile.target_role?.includes(roleName);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleArrayItem('target_role', roleName)}
                    className={`btn-secondary ${isActive ? 'active' : ''}`}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      backgroundColor: isActive ? 'var(--primary)' : 'var(--bg)',
                      color: isActive ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {roleName}
                    {isActive && (
                      <span onClick={(e) => { e.stopPropagation(); toggleArrayItem('target_role', roleName); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                    )}
                  </button>
                );
              })}
              {/* Custom roles */}
              {profile.target_role?.filter((role: string) => !validRoles.some(vr => (lang === 'ar' ? vr.name_ar : vr.name_en) === role)).map((role: string) => (
                <button
                  key={role}
                  type="button"
                  className="active"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {role}
                  <span onClick={() => toggleArrayItem('target_role', role)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Add custom role..."
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newRole.trim()) {
                    e.preventDefault();
                    if (!profile.target_role?.includes(newRole.trim())) {
                      toggleArrayItem('target_role', newRole.trim());
                    }
                    setNewRole('');
                  }
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (newRole.trim() && !profile.target_role?.includes(newRole.trim())) {
                    toggleArrayItem('target_role', newRole.trim());
                    setNewRole('');
                  }
                }}
              >Add</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.hours_per_week')}: {profile.hours_per_week}</label>
            <input type="range" min="1" max="40" style={{ width: '100%' }} value={profile.hours_per_week} onChange={e => handleProfileChange('hours_per_week', parseInt(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.interests')}</label>
            <div className="chips-grid" style={{ marginBottom: '1rem' }}>
              {interestOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleArrayItem('interests', opt)}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '20px', 
                    fontSize: '0.875rem',
                    backgroundColor: profile.interests?.includes(opt) ? 'var(--primary)' : 'var(--bg)',
                    color: profile.interests?.includes(opt) ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {opt}
                  {profile.interests?.includes(opt) && (
                    <span onClick={(e) => { e.stopPropagation(); toggleArrayItem('interests', opt); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                  )}
                </button>
              ))}
              {/* Custom interests */}
              {profile.interests?.filter((opt: string) => !interestOptions.includes(opt)).map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  className="active"
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '20px', 
                    fontSize: '0.875rem',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {opt}
                  <span onClick={() => toggleArrayItem('interests', opt)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Add custom interest..." 
                value={newInterest}
                onChange={e => setNewInterest(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newInterest.trim()) {
                    e.preventDefault();
                    if (!profile.interests?.includes(newInterest.trim())) {
                      toggleArrayItem('interests', newInterest.trim());
                    }
                    setNewInterest('');
                  }
                }}
              />
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  if (newInterest.trim() && !profile.interests?.includes(newInterest.trim())) {
                    toggleArrayItem('interests', newInterest.trim());
                    setNewInterest('');
                  }
                }}
              >Add</button>
            </div>
          </div>
        </div>
        <button onClick={saveProfile} className="btn-primary" disabled={saving} style={{ marginTop: '1.5rem' }}>
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
      </section>

      {/* Section C: Experience */}
      <section className="profile-section">
        <h2 className="profile-section-title">{t('profile.section_experience')}</h2>
        
        <div className="experience-list" style={{ marginBottom: '2rem' }}>
          {experiences.map(exp => (
            <div key={exp.id} className="experience-row">
              <div className="experience-info">
                <p className="experience-title-text">{exp.title}</p>
                <p className="experience-meta">{exp.type} • {exp.issuer} • {exp.date_completed ? new Date(exp.date_completed).toLocaleDateString() : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge badge-${exp.verification_status}`}>
                  {t(`profile.${exp.verification_status}`)}
                </span>
                <span className="badge points-badge" style={{ marginLeft: '0.5rem' }}>{(() => {
                  const { type, verification_status } = exp;
                  if (type === 'certificate' || type === 'training' || type === 'internship') {
                    return verification_status === 'verified' ? '+20 pts' : verification_status === 'pending' ? '+5 pts' : '';
                  } else if (type === 'hackathon' || type === 'event') {
                    if (verification_status === 'verified') return '+8 pts';
                    if (verification_status === 'pending') return '+5 pts';
                    if (verification_status === 'unverified') return '+3 pts';
                  }
                  return '';
                })()}</span>
                <button onClick={() => handleDeleteExperience(exp.id)} className="btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)' }}>{t('profile.delete')}</button>
              </div>
            </div>
          ))}
          {experiences.length === 0 && <p className="experience-meta">{t('common.no')}</p>}
        </div>

        {!showAddExp ? (
          <button onClick={() => setShowAddExp(true)} className="btn-secondary">{t('profile.add_experience')}</button>
        ) : (
          <form onSubmit={handleAddExperience} className="alert-banner" style={{ borderLeftColor: 'var(--primary)' }}>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t('profile.experience_type')}</label>
                <select className="input" value={expForm.type} onChange={e => setExpForm({...expForm, type: e.target.value})}>
                  <option value="certificate">Certificate</option>
                  <option value="training">Training</option>
                  <option value="internship">Internship</option>
                  <option value="hackathon">Hackathon</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('profile.experience_title')}</label>
                <input type="text" className="input" required value={expForm.title} onChange={e => setExpForm({...expForm, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('profile.experience_issuer')}</label>
                <input type="text" className="input" value={expForm.issuer} onChange={e => setExpForm({...expForm, issuer: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('profile.experience_date')}</label>
                <input type="date" className="input" value={expForm.date_completed} onChange={e => setExpForm({...expForm, date_completed: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('profile.upload_image')}</label>
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  required={['certificate', 'training', 'internship'].includes(expForm.type)}
                  onChange={e => setExpForm({ ...expForm, file: e.target.files ? e.target.files[0] : null })}
                />
                {['certificate', 'training', 'internship'].includes(expForm.type) && <p className="experience-meta">{t('profile.upload_cert_hint')}</p>}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={expVerifying || (['certificate', 'training', 'internship'].includes(expForm.type) && !expForm.file)}>{expVerifying ? t('profile.verifying') : t('common.submit')}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddExp(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Section D: Transcript */}
      <section className="profile-section">
        <h2 className="profile-section-title">{t('profile.section_transcript')}</h2>
        
        <div className="form-group">
          <label className="btn-secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
            {transcriptParsing ? t('profile.reading_transcript') : t('profile.upload_transcript')}
            <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={handleTranscriptUpload} disabled={transcriptParsing} />
          </label>
          <p className="experience-meta" style={{ marginTop: '0.5rem' }}>{t('profile.transcript_hint')}</p>
        </div>

        {courses.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>{t('profile.course_name')}</th>
                  <th style={{ padding: '0.75rem' }}>{t('profile.grade')}</th>
                  <th style={{ padding: '0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{c.course_name}</td>
                    <td style={{ padding: '0.75rem' }}>{c.grade}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <button onClick={() => setCourses(courses.filter((_, idx) => idx !== i))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('profile.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={saveCourses} className="btn-primary" disabled={coursesSaving} style={{ marginTop: '1.5rem' }}>
              {coursesSaving ? t('profile.saving') : t('profile.save_courses')}
            </button>
          </div>
        )}
      </section>

      <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '4rem' }}>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary">{t('common.back')}</button>
      </div>
    </div>
  );
}
