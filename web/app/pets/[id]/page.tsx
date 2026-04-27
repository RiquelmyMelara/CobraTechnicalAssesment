'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { api, type ApiError, type Pet } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

export default function PetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);

  const id = params.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .getPet(id)
      .then((data) => {
        if (!cancelled) setPet(data);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onApply = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !pet) return;
    setApplyError(null);
    setApplyBusy(true);
    try {
      await api.apply(token, { petId: pet.id, message: message || undefined });
      setApplySuccess(true);
      setMessage('');
    } catch (err) {
      setApplyError((err as ApiError).message);
    } finally {
      setApplyBusy(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!pet) return <p className="muted">Pet not found.</p>;

  return (
    <section className="spaced">
      <Link href="/pets" className="muted">← Back to listings</Link>
      <div className="row between">
        <h1>{pet.name}</h1>
        <div className="row" style={{ gap: '0.5rem' }}>
          <span className={`pill ${pet.status}`}>{pet.status}</span>
          {user?.role === 'staff' && (
            <Link href={`/staff/pets/${pet.id}/edit`}>
              <button className="ghost">Edit</button>
            </Link>
          )}
        </div>
      </div>
      <p className="muted">
        {pet.species}
        {pet.breed ? ` · ${pet.breed}` : ''} · {pet.ageYears} years old
      </p>
      <div className="card">
        <p style={{ margin: 0 }}>{pet.description}</p>
      </div>

      <div className="card spaced">
        <h2>Apply to adopt</h2>
        {!user && (
          <p className="muted">
            <Link href="/login">Log in</Link> or <Link href="/register">create an account</Link>{' '}
            to apply.
          </p>
        )}
        {user && pet.status !== 'available' && (
          <p className="muted">This pet is no longer accepting applications.</p>
        )}
        {user && user.role === 'staff' && (
          <p className="muted">
            You're signed in as staff. <Link href="/staff">Open the staff dashboard</Link> to
            review applications.
          </p>
        )}
        {user && user.role === 'user' && pet.status === 'available' && (
          <form onSubmit={onApply} className="spaced">
            <div>
              <label htmlFor="message">Message to staff (optional)</label>
              <textarea
                id="message"
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {applyError && <div className="error">{applyError}</div>}
            {applySuccess && (
              <div className="card" style={{ borderColor: 'rgba(22,163,74,0.5)' }}>
                Application submitted.{' '}
                <Link href="/applications">View it.</Link>
              </div>
            )}
            <div className="row">
              <button type="submit" disabled={applyBusy || applySuccess}>
                {applyBusy ? 'Submitting…' : 'Submit application'}
              </button>
              {applySuccess && (
                <button type="button" className="ghost" onClick={() => router.push('/applications')}>
                  Go to my applications
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
