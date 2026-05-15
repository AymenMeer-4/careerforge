'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface Resource {
  title: string;
  url: string;
  provider: string;
  type?: string;
  hours?: number;
  language?: string;
  cost?: string;
}

interface RoadmapNode {
  id: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  dimension_target: string;
  difficulty: number;
  hours: number;
  points: number;
  tier: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  order_index: number;
  resources: Resource[];
  why_this_tier: string;
  completed_at?: string;
}

interface Student {
  target_role?: string;
  profile_completed_at?: string;
  cluster: string;
}

const TIER_COLORS: Record<number, { bg: string; border: string; dot: string; label: string }> = {
  1: { bg: 'rgba(231,76,60,0.06)', border: 'rgba(231,76,60,0.3)', dot: '#e74c3c', label: 'Tier 1 — Critical' },
  2: { bg: 'rgba(230,126,34,0.06)', border: 'rgba(230,126,34,0.3)', dot: '#e67e22', label: 'Tier 2 — High Priority' },
  3: { bg: 'rgba(243,156,18,0.06)', border: 'rgba(243,156,18,0.3)', dot: '#f39c12', label: 'Tier 3 — Important' },
  4: { bg: 'rgba(108,92,231,0.06)', border: 'rgba(108,92,231,0.3)', dot: '#6c5ce7', label: 'Tier 4 — Recommended' },
  5: { bg: 'rgba(0,180,166,0.06)', border: 'rgba(0,180,166,0.3)', dot: '#00b4a6', label: 'Tier 5 — Optional' },
};

const DIM_LABELS: Record<string, { en: string; ar: string }> = {
  academic: { en: 'Academic', ar: 'أكاديمي' },
  credentialing: { en: 'Credentialing', ar: 'اعتمادات' },
  practical: { en: 'Practical', ar: 'تطبيقي' },
  portfolio: { en: 'Portfolio', ar: 'محفظة أعمال' },
  domain: { en: 'Domain', ar: 'مجال تخصصي' },
  prof_dev: { en: 'Prof. Dev.', ar: 'تطوير مهني' },
  soft_skills: { en: 'Soft Skills', ar: 'مهارات ناعمة' },
};

function ReadinessRing({ value, lang }: { value: number; lang: string }) {
  const color = value >= 70 ? '#00b894' : value >= 40 ? '#f39c12' : '#e74c3c';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(108,92,231,0.1)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="url(#roadmapGrad)" strokeWidth="8"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * value) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
          />
          <defs>
            <linearGradient id="roadmapGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#6c5ce7" />
              <stop offset="1" stopColor="#00cec9" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color }}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
        {lang === 'ar' ? 'الجاهزية العامة' : 'General Readiness'}
      </p>
    </div>
  );
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <span style={{ color: '#f39c12', letterSpacing: '2px' }}>
      {'★'.repeat(level)}{'☆'.repeat(5 - level)}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS[5];
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '50px', fontSize: '0.7rem', fontWeight: '700',
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.dot, letterSpacing: '0.5px',
    }}>
      T{tier}
    </span>
  );
}

function CertificateModal({
  nodeId, nodeTitle, lang, t, onSuccess, onClose,
}: {
  nodeId: string;
  nodeTitle: string;
  lang: string;
  t: (key: string) => string;
  onSuccess: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    type: 'certificate',
    title: nodeTitle,
    issuer: '',
    date_completed: '',
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('type', form.type);
      fd.append('title', form.title);
      fd.append('issuer', form.issuer);
      fd.append('date_completed', form.date_completed);
      if (form.file) fd.append('cert_image', form.file);
      const res = await fetch('/api/students/experiences', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        onSuccess(nodeId);
      } else {
        setError(data.error || t('common.error'));
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(26,26,46,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '28px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-hover)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
            📎 {lang === 'ar' ? 'إضافة شهادة' : 'Add Certificate'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label">{t('profile.experience_type')}</label>
            <select
              className="input"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              required
            >
              <option value="certificate">Certificate</option>
              <option value="training">Training</option>
              <option value="internship">Internship</option>
              <option value="hackathon">Hackathon</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t('profile.experience_title')}</label>
            <input
              type="text"
              className="input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="form-label">{t('profile.experience_issuer')}</label>
            <input
              type="text"
              className="input"
              value={form.issuer}
              onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">{t('profile.experience_date')}</label>
            <input
              type="date"
              className="input"
              value={form.date_completed}
              onChange={e => setForm(f => ({ ...f, date_completed: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">{t('profile.upload_cert')}</label>
            <input
              type="file"
              className="input"
              accept="image/jpeg,image/png"
              required
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              {t('profile.upload_cert_hint')}
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--danger)', padding: '8px 12px', background: 'rgba(225,112,85,0.08)', borderRadius: '6px', border: '1px solid rgba(225,112,85,0.2)' }}>
              ⚠️ {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? '...' : t('common.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NodeCard({
  node, lang, t, onMarkComplete, hasCert, onAddCert,
}: {
  node: RoadmapNode;
  lang: string;
  t: (key: string) => string;
  onMarkComplete: (id: string) => Promise<void>;
  hasCert: boolean;
  onAddCert: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [animateComplete, setAnimateComplete] = useState(false);

  const isCompleted = node.status === 'completed' || animateComplete;
  const title = lang === 'ar' ? node.title_ar : node.title_en;
  const desc = lang === 'ar' ? node.description_ar : node.description_en;
  const colors = TIER_COLORS[node.tier] ?? TIER_COLORS[5];
  const dimLabel = DIM_LABELS[node.dimension_target];

  let displayWhy = node.why_this_tier || '';
  if (displayWhy.includes('||| AR:')) {
    const parts = displayWhy.split('||| AR:');
    const enPart = parts[0].replace('EN:', '').trim();
    const arPart = parts[1].trim();
    displayWhy = lang === 'ar' ? (arPart || enPart) : (enPart || arPart);
  }

  const resources = Array.isArray(node.resources)
    ? node.resources
    : JSON.parse(String(node.resources || '[]'));

  async function handleComplete() {
    setCompleting(true);
    await onMarkComplete(node.id);
    setAnimateComplete(true);
    setCompleting(false);
  }

  function getResourceHref(r: any) {
    const p = (r.provider ?? '').toLowerCase();
    if (p.includes('coursera')) return `https://www.coursera.org/search?query=${encodeURIComponent(r.title)}`;
    if (p.includes('edx')) return `https://www.edx.org/search?q=${encodeURIComponent(r.title)}`;
    if (p.includes('udemy')) return `https://www.udemy.com/courses/search/?q=${encodeURIComponent(r.title)}`;
    return 'https://aws.amazon.com/training/';
  }

  return (
    <div
      className={`timeline-item ${isCompleted ? 'completed' : ''}`}
      style={{ opacity: isCompleted ? 0.75 : 1, transition: 'opacity 0.5s ease' }}
    >
      <div
        className="timeline-dot"
        style={isCompleted
          ? { background: '#00b894', borderColor: '#00b894', boxShadow: '0 0 12px rgba(0,184,148,0.4)' }
          : { borderColor: colors.dot, background: colors.bg }}
      />

      <div
        className="timeline-card"
        style={{
          borderColor: isCompleted ? 'rgba(0,184,148,0.3)' : colors.border,
          background: isCompleted ? 'rgba(0,184,148,0.04)' : colors.bg,
          position: 'relative', overflow: 'hidden',
        }}
      >
        {isCompleted && (
          <div style={{
            position: 'absolute', top: '12px',
            right: lang === 'ar' ? 'auto' : '12px',
            left: lang === 'ar' ? '12px' : 'auto',
            padding: '4px 12px', borderRadius: '50px',
            background: 'rgba(0,184,148,0.15)', border: '1px solid rgba(0,184,148,0.4)',
            color: '#00b894', fontSize: '0.75rem', fontWeight: '700',
          }}>
            ✓ {t('roadmap.completed')}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <TierBadge tier={node.tier} />
          <span style={{
            padding: '2px 10px', borderRadius: '50px', fontSize: '0.7rem', fontWeight: '600',
            background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.18)', color: 'var(--primary)',
          }}>
            {lang === 'ar' ? dimLabel?.ar : dimLabel?.en}
          </span>
        </div>

        <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px', lineHeight: '1.4' }}>
          {title}
        </h4>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.6' }}>
          {desc}
        </p>

        <div className="timeline-meta" style={{ marginBottom: '14px' }}>
          <span><DifficultyStars level={node.difficulty} /></span>
          <span>🏆 {t('roadmap.points').replace('{n}', String(node.points))}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {displayWhy && (
            <button
              onClick={() => setShowWhy(!showWhy)}
              style={{
                fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px',
                background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)',
                color: 'var(--primary)', cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              {t('roadmap.why_this_tier')} {showWhy ? '▲' : '▼'}
            </button>
          )}
          <button
            onClick={() => setShowResources(!showResources)}
            style={{
              fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px',
              background: 'rgba(0,180,166,0.08)', border: '1px solid rgba(0,180,166,0.2)',
              color: 'var(--accent)', cursor: 'pointer', transition: 'var(--transition)',
            }}
          >
            {lang === 'ar'
              ? (showResources ? 'المصادر ▲' : 'المصادر ▼')
              : (showResources ? 'Resources ▲' : 'Resources ▼')}
          </button>
        </div>

        {showWhy && displayWhy && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.12)',
            marginBottom: '14px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5',
          }}>
            💡 {displayWhy}
          </div>
        )}

        {showResources && (
          <div style={{ marginBottom: '14px' }}>
            {resources.map((r: any, i: number) => (<a key={i}
                href={getResourceHref(r)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              marginBottom: '6px', textDecoration: 'none',
              color: 'var(--text)', transition: 'var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(108,92,231,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
            <span style={{ fontSize: '1rem' }}>🔗</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: '600', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.title}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {r.provider}{r.cost ? ` · ${r.cost}` : ''}
              </p>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>↗</span>
          </a>
        ))}
      </div>
        )}

      {!isCompleted && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={hasCert ? handleComplete : undefined}
            disabled={completing || !hasCert}
            className="btn-primary"
            style={{
              padding: '8px 20px', fontSize: '0.85rem',
              opacity: completing ? 0.7 : hasCert ? 1 : 0.45,
              cursor: hasCert ? 'pointer' : 'not-allowed',
            }}
            title={!hasCert
              ? (lang === 'ar' ? 'أضف شهادة أولاً لتتمكن من التحديد' : 'Add a certificate first to mark complete')
              : undefined}
          >
            {completing ? '...' : t('roadmap.mark_complete')}
          </button>

          <button
            onClick={onAddCert}
            className="btn-secondary"
            style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📎 {lang === 'ar' ? 'إضافة شهادة' : 'Add Certificate'}
          </button>

          {!hasCert && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)', width: '100%' }}>
              {lang === 'ar'
                ? 'أضف شهادة لإثبات إتمامك قبل تحديد الخطوة كمكتملة'
                : 'Add a certificate to prove completion before marking this step done'}
            </p>
          )}
          {hasCert && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--success)', width: '100%' }}>
              ✓ {lang === 'ar' ? 'تمت إضافة الشهادة — يمكنك الآن التحديد كمكتمل' : 'Certificate added — you can now mark complete'}
            </p>
          )}
        </div>
      )}
    </div>
  </div>
);
}

export default function RoadmapPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [student, setStudent] = useState<Student | null>(null);
  const [nodes, setNodes] = useState<RoadmapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<number>(0);
  const [certAddedNodes, setCertAddedNodes] = useState<Set<string>>(new Set());
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);

  const handleCertAdded = useCallback((nodeId: string) => {
    setCertAddedNodes(prev => new Set(prev).add(nodeId));
    setModalNodeId(null);
  }, []);

  const fetchReadiness = useCallback(async () => {
    const res = await fetch('/api/readiness');
    if (res.ok) {
      const data = await res.json();
      setReadiness(data.general_readiness ?? 0);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) { router.push('/login'); return; }
      const [profileRes, nodesRes] = await Promise.all([
        fetch('/api/students/profile'),
        fetch('/api/roadmap'),
      ]);
      if (profileRes.ok) setStudent(await profileRes.json());
      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.nodes ?? []);
      }
      await fetchReadiness();
      setLoading(false);
    }
    load().catch(err => { console.error(err); setLoading(false); });
  }, [fetchReadiness]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/roadmap/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || 'Generation failed');
      } else {
        setNodes(data.nodes ?? []);
        await fetchReadiness();
      }
    } catch (e: any) {
      setGenerateError(e.message || 'Network error');
    } finally {
      setGenerating(false);
    }
  }, [fetchReadiness]);

  const handleMarkComplete = useCallback(async (nodeId: string) => {
    const res = await fetch(`/api/roadmap/nodes/${nodeId}/complete`, { method: 'POST' });
    if (res.ok) {
      setNodes(prev =>
        prev.map(n => n.id === nodeId
          ? { ...n, status: 'completed', completed_at: new Date().toISOString() }
          : n)
      );
      await fetchReadiness();
    }
  }, [fetchReadiness]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const hasTargetRole = !!student?.target_role;
  const hasProfile = !!student?.profile_completed_at;
  const hasNodes = nodes.length > 0;

  const tierGroups: Record<number, RoadmapNode[]> = {};
  for (const n of nodes) {
    if (!tierGroups[n.tier]) tierGroups[n.tier] = [];
    tierGroups[n.tier].push(n);
  }
  const sortedTiers = Object.keys(tierGroups).map(Number).sort();
  const roleDisplay = String(student?.target_role ?? '').replace(/_/g, ' ');

  return (
    <div className="dashboard-page">
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 2rem' }}>

        <header style={{ padding: '2rem 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="auth-title" style={{ fontSize: '1.6rem' }}>
              {hasNodes ? t('roadmap.subtitle').replace('{role}', roleDisplay) : t('roadmap.title')}
            </h1>
            {hasNodes && (
              <p className="experience-meta" style={{ marginTop: '4px' }}>
                {nodes.length} {lang === 'ar' ? 'خطوة مُولَّدة بواسطة Claude' : 'steps generated by Claude'}
                {' · '}
                {nodes.filter(n => n.status === 'completed').length} {lang === 'ar' ? 'مكتملة' : 'completed'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <ReadinessRing value={readiness} lang={lang} />
            {hasTargetRole && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ fontSize: '1rem' }}>🔄</span>
                {generating
                  ? (lang === 'ar' ? 'جارٍ التوليد...' : 'Generating...')
                  : t('roadmap.regenerate')}
              </button>
            )}
          </div>
        </header>

        {generateError && (
          <div style={{
            margin: '0 0 1.5rem', padding: '12px 20px', borderRadius: '10px',
            background: 'rgba(225,112,85,0.08)', border: '1px solid rgba(225,112,85,0.25)',
            color: 'var(--danger)', fontSize: '0.88rem',
          }}>
            ⚠️ {generateError}
          </div>
        )}

        {generating && (
          <div style={{
            textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem',
          }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>
              {lang === 'ar' ? 'Claude يُولِّد خارطة طريقك المخصصة...' : 'Claude is generating your personalized roadmap...'}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '8px' }}>
              {lang === 'ar' ? 'قد يستغرق هذا 15–30 ثانية' : 'This may take 15–30 seconds'}
            </p>
          </div>
        )}

        {!generating && !hasNodes && (
          <div className="profile-section" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🗺️</div>
            <h2 className="profile-section-title" style={{ marginBottom: '12px' }}>{t('roadmap.empty_title')}</h2>
            <p className="experience-meta" style={{ marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
              {t('roadmap.empty_desc')}
            </p>
            {!hasProfile ? (
              <button className="btn-primary" onClick={() => router.push('/profile')}>
                {t('roadmap.go_profile')}
              </button>
            ) : (
              <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
                <span>✨</span>
                {lang === 'ar' ? 'توليد خارطة الطريق' : 'Generate My Roadmap'}
              </button>
            )}
          </div>
        )}

        {!generating && hasNodes && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '2rem' }}>
              {[
                { icon: '📍', label: lang === 'ar' ? 'إجمالي الخطوات' : 'Total Steps', value: nodes.length },
                { icon: '✅', label: lang === 'ar' ? 'مكتملة' : 'Completed', value: nodes.filter(n => n.status === 'completed').length, color: 'var(--success)' },
                { icon: '🏆', label: lang === 'ar' ? 'النقاط الإجمالية' : 'Total Points', value: nodes.reduce((s, n) => s + n.points, 0), color: '#f39c12' },
              ].map((stat, i) => (
                <div key={i} className="profile-section" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                  <div>
                    <p className="experience-meta" style={{ margin: 0, fontSize: '0.72rem' }}>{stat.label}</p>
                    <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: stat.color ?? 'var(--primary)' }}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2rem' }}>
              {sortedTiers.map(tier => {
                const colors = TIER_COLORS[tier];
                return (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '50px', background: colors.bg, border: `1px solid ${colors.border}` }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.dot }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: '600', color: colors.dot }}>
                      {lang === 'ar' ? `المستوى ${tier}` : colors.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({tierGroups[tier].length})</span>
                  </div>
                );
              })}
            </div>

            <div className="timeline">
              {sortedTiers.map(tier => (
                <React.Fragment key={tier}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginLeft: '0', marginRight: '0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: TIER_COLORS[tier].dot, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '0.85rem', flexShrink: 0 }}>
                      {tier}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem', color: TIER_COLORS[tier].dot }}>
                        {lang === 'ar' ? `المستوى ${tier}` : TIER_COLORS[tier].label}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {tierGroups[tier].length} {lang === 'ar' ? 'خطوات' : 'steps'}
                      </p>
                    </div>
                  </div>
                  {tierGroups[tier].map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      lang={lang}
                      t={t}
                      onMarkComplete={handleMarkComplete}
                      hasCert={certAddedNodes.has(node.id)}
                      onAddCert={() => setModalNodeId(node.id)}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </>
        )}

      </div>

      {modalNodeId && (() => {
        const modalNode = nodes.find(n => n.id === modalNodeId);
        if (!modalNode) return null;
        return (
          <CertificateModal
            nodeId={modalNodeId}
            nodeTitle={lang === 'ar' ? modalNode.title_ar : modalNode.title_en}
            lang={lang}
            t={t}
            onSuccess={handleCertAdded}
            onClose={() => setModalNodeId(null)}
          />
        );
      })()}
    </div>
  );
}
