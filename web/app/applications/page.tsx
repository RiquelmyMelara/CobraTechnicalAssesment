'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ApiError, type Application } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function MyApplicationsPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .myApplications(token)
      .then(setApps)
      .catch((err: ApiError) => setError(err.message));
  }, [ready, token, router]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return null;
  if (error) return <div className="error">{error}</div>;
  if (!apps) return <p className="muted">Loading…</p>;

  return (
    <section className="spaced">
      <h1>My applications</h1>
      {apps.length === 0 ? (
        <p className="muted">
          You haven't applied to any pets yet. <Link href="/pets">Browse listings</Link>.
        </p>
      ) : (
        <div className="spaced">
          {apps.map((a) => (
            <div key={a.id} className="card">
              <div className="row between">
                <Link href={`/pets/${a.petId}`}>Pet {a.petId.slice(0, 8)}…</Link>
                <span className={`pill ${a.status}`}>{a.status}</span>
              </div>
              {a.message && <p className="muted" style={{ marginTop: '0.5rem' }}>"{a.message}"</p>}
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Submitted {new Date(a.createdAt).toLocaleString()}
                {a.decidedAt
                  ? ` · decided ${new Date(a.decidedAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
