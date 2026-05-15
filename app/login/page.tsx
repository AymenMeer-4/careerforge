'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function Login() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      return setError(t('common.error'));
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.error_login_failed'));
      } else {
        if (data.role === 'student') {
          if (data.onboardingCompleted) {
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        } else if (data.role === 'corporate') {
          router.push('/corporate/dashboard');
        }
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.login')}</h1>
        <p className="auth-subtitle">{t('auth.no_account')} <Link href="/signup">{t('auth.sign_up_link')}</Link></p>
        
        {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? t('auth.signing_in') : t('auth.login')}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>{t('auth.or_corporate')}</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link href="/corporate/login">{t('auth.corporate_login')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
