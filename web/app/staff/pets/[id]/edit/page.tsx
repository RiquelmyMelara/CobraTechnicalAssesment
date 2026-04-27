'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ApiError, type Pet } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth';
import { PetForm, type PetFormValues } from '../../PetForm';

export default function EditPetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const id = params.id;

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
    if (!id) return;
    let cancelled = false;
    api
      .getPet(id)
      .then((data) => {
        if (!cancelled) setPet(data);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user, id, router]);

  const onSubmit = async (values: PetFormValues) => {
    if (!token || !pet) return;
    setError(null);
    setDetails(null);
    setBusy(true);
    try {
      // Send only fields that actually changed — keeps the PATCH payload
      // honest and lets the API's status state-machine logic stay clean.
      const patch: Parameters<typeof api.updatePet>[2] = {};
      if (values.name !== pet.name) patch.name = values.name;
      if (values.species !== pet.species) patch.species = values.species;
      const breedNext = values.breed === '' ? null : values.breed;
      if (breedNext !== pet.breed) patch.breed = breedNext;
      if (values.ageYears !== pet.ageYears) patch.ageYears = values.ageYears;
      if (values.description !== pet.description) patch.description = values.description;
      if (values.status && values.status !== pet.status) patch.status = values.status;

      if (Object.keys(patch).length === 0) {
        router.push(`/pets/${pet.id}`);
        return;
      }
      const updated = await api.updatePet(token, pet.id, patch);
      setPet(updated);
      router.push(`/pets/${updated.id}`);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to update pet.');
      if (Array.isArray(e.details)) setDetails(e.details as string[]);
      setBusy(false);
    }
  };

  if (!ready || !user || user.role !== 'staff') return null;
  if (loadError) return <div className="error">{loadError}</div>;
  if (!pet) return <p className="muted">Loading…</p>;

  return (
    <section className="spaced" style={{ maxWidth: 720 }}>
      <Link href={`/pets/${pet.id}`} className="muted">← Back to pet</Link>
      <h1>Edit {pet.name}</h1>
      <PetForm
        initial={{
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          ageYears: pet.ageYears,
          description: pet.description,
          status: pet.status,
        }}
        showStatus
        submitLabel="Save changes"
        busy={busy}
        error={error}
        details={details}
        onSubmit={onSubmit}
        onCancel={() => router.push(`/pets/${pet.id}`)}
      />
    </section>
  );
}
