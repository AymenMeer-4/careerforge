'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/i18n/LanguageProvider';

export default function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      return setError(t('auth.error_email_password_required'));
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
      setError(t('auth.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <h1>{t('auth.login_title')}</h1>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
          {loading ? t('auth.logging_in') : t('auth.login')}
        </button>
      </form>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p>{t('auth.no_account')}</p>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <Link href="/signup" style={{ color: '#0070f3' }}>{t('auth.signup_student')}</Link>
          <Link href="/corporate/signup" style={{ color: '#0070f3' }}>{t('auth.signup_corporate')}</Link>
        </div>
      </div>
    </div>
  );
}
