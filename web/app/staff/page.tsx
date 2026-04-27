'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type ApiError,
  type Application,
  type PaginatedApplications,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function StaffPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      setData(await api.listApplications(token, 'pending'));
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'staff') {
      router.replace('/pets');
      return;
    }
    void reload();
  }, [ready, user, reload, router]);

  const decide = async (app: Application, action: 'approve' | 'reject') => {
    if (!token) return;
    setBusyId(app.id);
    try {
      if (action === 'approve') await api.approve(token, app.id);
      else await api.reject(token, app.id);
      await reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || !user || user.role !== 'staff') return null;

  return (
    <section className="spaced">
      <h1>Pending applications</h1>
      {error && <div className="error">{error}</div>}
      {data && data.data.length === 0 && (
        <p className="muted">No pending applications. The queue is empty.</p>
      )}
      <div className="spaced">
        {data?.data.map((app) => (
          <div key={app.id} className="card spaced">
            <div className="row between">
              <Link href={`/pets/${app.petId}`}>Pet {app.petId.slice(0, 8)}…</Link>
              <span className={`pill ${app.status}`}>{app.status}</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Applicant {app.userId.slice(0, 8)}… · submitted{' '}
              {new Date(app.createdAt).toLocaleString()}
            </p>
            {app.message && (
              <blockquote
                style={{
                  margin: 0,
                  paddingLeft: '0.8rem',
                  borderLeft: '3px solid var(--border)',
                }}
              >
                {app.message}
              </blockquote>
            )}
            <div className="row">
              <button
                className="success"
                disabled={busyId === app.id}
                onClick={() => decide(app, 'approve')}
              >
                {busyId === app.id ? 'Working…' : 'Approve'}
              </button>
              <button
                className="ghost"
                disabled={busyId === app.id}
                onClick={() => decide(app, 'reject')}
              >
                Reject
              </button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
              Approving will mark the pet as adopted and reject every other
              pending application for the same pet.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
