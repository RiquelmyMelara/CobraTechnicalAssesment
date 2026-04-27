'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { PetForm, type PetFormValues } from '../PetForm';

export default function NewPetPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'staff') {
      router.replace('/pets');
    }
  }, [ready, user, router]);

  const onSubmit = async (values: PetFormValues) => {
    if (!token) return;
    setError(null);
    setDetails(null);
    setBusy(true);
    try {
      const created = await api.createPet(token, {
        name: values.name,
        species: values.species,
        breed: values.breed || undefined,
        ageYears: values.ageYears,
        description: values.description,
      });
      router.push(`/pets/${created.id}`);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to create pet.');
      if (Array.isArray(e.details)) setDetails(e.details as string[]);
      setBusy(false);
    }
  };

  if (!ready || !user || user.role !== 'staff') return null;

  return (
    <section className="spaced" style={{ maxWidth: 720 }}>
      <Link href="/staff" className="muted">← Back to staff dashboard</Link>
      <h1>Add a new pet</h1>
      <PetForm
        submitLabel="Create pet"
        busy={busy}
        error={error}
        details={details}
        onSubmit={onSubmit}
        onCancel={() => router.push('/staff')}
      />
    </section>
  );
}
