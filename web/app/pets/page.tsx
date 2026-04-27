'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ApiError, type PaginatedPets } from '../../lib/api';

export default function PetsPage() {
  const [pets, setPets] = useState<PaginatedPets | null>(null);
  const [species, setSpecies] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listPets({ species: species || undefined })
      .then((data) => {
        if (!cancelled) setPets(data);
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
  }, [species]);

  return (
    <section className="spaced">
      <div className="row between">
        <h1>Available pets</h1>
        <div style={{ minWidth: 220 }}>
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="">All species</option>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="rabbit">Rabbit</option>
            <option value="parrot">Parrot</option>
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && pets && pets.data.length === 0 && (
        <p className="muted">No pets match that filter.</p>
      )}

      <div className="grid">
        {pets?.data.map((pet) => (
          <Link key={pet.id} href={`/pets/${pet.id}`} style={{ textDecoration: 'none' }}>
            <div className="card spaced" style={{ height: '100%' }}>
              <div className="row between">
                <h2 style={{ margin: 0 }}>{pet.name}</h2>
                <span className={`pill ${pet.status}`}>{pet.status}</span>
              </div>
              <div className="muted">
                {pet.species}
                {pet.breed ? ` · ${pet.breed}` : ''} · {pet.ageYears}y
              </div>
              <p style={{ margin: 0 }}>{pet.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {pets && (
        <p className="muted">
          Showing {pets.data.length} of {pets.total}
        </p>
      )}
    </section>
  );
}
