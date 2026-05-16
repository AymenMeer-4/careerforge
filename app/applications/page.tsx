'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface Application {
  id: string;
  status: string;
  match_score: number;
  applied_at: string;
  status_changed_at: string;
  rejection_primary_reason: string | null;
  rejection_gap_tags: string[] | null;
  rejection_comment: string | null;
  job_id: string;
  title: string;
  posting_type: string;
  role_category: string;
  location_region: string;
  location_city: string;
  salary_min: number | null;
  salary_max: number | null;
  company_name: string;
  verification_status: string;
}

const STATUS_STYLE: Record<string, string> = {
  submitted: '#6c5ce7',
  under_review: '#f39c12',
  interview: '#0984e3',
  offered: '#00b894',
  rejected: '#e74c3c',
  withdrawn: '#636e72',
};

export default function ApplicationsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [addingGaps, setAddingGaps] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('applied') === '1') {
      setToast(lang === 'ar' ? 'تم إرسال طلبك بنجاح ✓' : 'Application submitted successfully ✓');
      window.history.replaceState({}, '', '/applications');
      setTimeout(() => setToast(''), 5000);
    }
  }, [lang]);

  useEffect(() => {
    async function load() {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/login'); return; }
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApps(data.applications ?? []);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load applications');
      }
      setLoading(false);
    }
    load().catch((e) => { console.error(e); setError('Network error'); setLoading(false); });
  }, []);

  function statusLabel(status: string): string {
    const key = `applications.status_${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  }

  async function handleAddGaps(app: Application) {
    const tags = app.rejection_gap_tags ?? [];
    if (tags.length === 0) return;
    setAddingGaps(app.id);
    const res = await fetch('/api/roadmap/recompute-affected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gap_tags: tags }),
    });
    setAddingGaps(null);
    if (res.ok) {
      const d = await res.json();
      setToast(
        lang === 'ar'
          ? `تمت إضافة ${d.count} خطوة إلى خارطة الطريق`
          : `Added ${d.count} step(s) to your roadmap`,
      );
      setTimeout(() => setToast(''), 5000);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Failed to add gaps');
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="auth-title">{t('applications.title')}</h1>
      </header>

      {toast && (
        <div className="alert-banner" style={{ background: 'rgba(0,184,148,0.1)', borderColor: 'rgba(0,184,148,0.3)', marginBottom: '1rem' }}>
          {toast}
        </div>
      )}
      {error && <div className="alert-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

      {apps.length === 0 ? (
        <div className="profile-section">
          <p className="experience-meta">
            {lang === 'ar' ? 'لم تتقدم لأي وظيفة بعد.' : "You haven't applied to any jobs yet."}
          </p>
          <button className="btn-primary" style={{ marginTop: '10px' }} onClick={() => router.push('/jobs')}>
            {lang === 'ar' ? 'تصفح الوظائف' : 'Browse Jobs'}
          </button>
        </div>
      ) : (
        <div className="experience-list">
          {apps.map((app) => {
            const color = STATUS_STYLE[app.status] ?? '#636e72';
            const isOpen = expanded === app.id;
            return (
              <div key={app.id} className="profile-section" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  className="experience-row"
                  style={{ cursor: 'pointer', padding: '1rem 1.25rem' }}
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                >
                  <div className="experience-info">
                    <p className="experience-title-text">{app.title}</p>
                    <p className="experience-meta">{app.company_name} · {app.location_city}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="experience-meta">
                      {t('applications.match_score')}: <b>{Math.round(app.match_score)}%</b>
                    </span>
                    <span className="status-chip" style={{ background: `${color}22`, color }}>
                      {statusLabel(app.status)}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                    <p className="experience-meta" style={{ marginTop: '10px' }}>
                      {lang === 'ar' ? 'تاريخ التقديم: ' : 'Applied: '}
                      {new Date(app.applied_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>

                    {app.status === 'rejected' && (
                      <div style={{ marginTop: '12px' }}>
                        {app.rejection_primary_reason && (
                          <p className="experience-meta">
                            <b>{t('applications.rejection_reason')}:</b> {app.rejection_primary_reason}
                          </p>
                        )}
                        {app.rejection_gap_tags && app.rejection_gap_tags.length > 0 && (
                          <div className="status-chips" style={{ marginTop: '8px' }}>
                            {app.rejection_gap_tags.map((tag) => (
                              <span key={tag} className="status-chip need">{tag}</span>
                            ))}
                          </div>
                        )}
                        {app.rejection_comment && (
                          <p className="experience-meta" style={{ marginTop: '8px', fontStyle: 'italic' }}>
                            &ldquo;{app.rejection_comment}&rdquo;
                          </p>
                        )}
                        {app.rejection_gap_tags && app.rejection_gap_tags.length > 0 && (
                          <button
                            className="btn-primary"
                            style={{ marginTop: '12px' }}
                            disabled={addingGaps === app.id}
                            onClick={() => handleAddGaps(app)}
                          >
                            {addingGaps === app.id ? '...' : t('applications.add_gaps')}
                          </button>
                        )}
                      </div>
                    )}

                    {app.status !== 'rejected' && (
                      <button
                        className="btn-secondary"
                        style={{ marginTop: '12px' }}
                        onClick={() => router.push(`/jobs/${app.job_id}`)}
                      >
                        {lang === 'ar' ? 'عرض الوظيفة' : 'View Job'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
