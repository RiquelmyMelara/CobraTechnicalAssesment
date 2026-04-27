'use client';

import { type FormEvent, useState } from 'react';
import type { Pet } from '../../../lib/api';

export interface PetFormValues {
  name: string;
  species: string;
  breed: string;
  ageYears: number;
  description: string;
  status?: Pet['status'];
}

interface PetFormProps {
  initial?: Partial<PetFormValues>;
  /** When provided, render a status select (edit mode). */
  showStatus?: boolean;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  details: string[] | null;
  onSubmit: (values: PetFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

export function PetForm({
  initial,
  showStatus = false,
  submitLabel,
  busy,
  error,
  details,
  onSubmit,
  onCancel,
}: PetFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [species, setSpecies] = useState(initial?.species ?? 'dog');
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [ageYears, setAgeYears] = useState<number>(initial?.ageYears ?? 1);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<Pet['status']>(
    initial?.status ?? 'available',
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      species: species.trim(),
      breed: breed.trim(),
      ageYears,
      description: description.trim(),
      ...(showStatus ? { status } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="spaced">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="row" style={{ gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="species">Species</label>
          <select
            id="species"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="rabbit">Rabbit</option>
            <option value="parrot">Parrot</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="breed">Breed (optional)</label>
          <input
            id="breed"
            maxLength={120}
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          />
        </div>
        <div style={{ width: 120 }}>
          <label htmlFor="ageYears">Age (yrs)</label>
          <input
            id="ageYears"
            type="number"
            min={0}
            max={60}
            required
            value={ageYears}
            onChange={(e) => setAgeYears(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={5}
          required
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {showStatus && (
        <div>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Pet['status'])}
          >
            <option value="available">Available</option>
            <option value="pending">Pending</option>
            <option value="adopted">Adopted</option>
          </select>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
            Once a pet is adopted, the API will refuse to change it back.
          </p>
        </div>
      )}

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

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
