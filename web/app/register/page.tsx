'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { api, type ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetails(null);
    setBusy(true);
    try {
      const resp = await api.register({ email, password, name });
      login(resp);
      router.push('/pets');
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Registration failed.');
      if (Array.isArray(e.details)) setDetails(e.details as string[]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="spaced form">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} className="spaced">
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Password (8+ characters)</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="error">
            <div>{error}</div>
            {details && (
              <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem' }}>
                {details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link href="/login">Log in</Link>.
      </p>
    </section>
  );
}
