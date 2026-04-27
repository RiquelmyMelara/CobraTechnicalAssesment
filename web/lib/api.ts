const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
}

export interface AuthResponse {
  user: UserSummary;
  accessToken: string;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  ageYears: number;
  description: string;
  status: 'available' | 'pending' | 'adopted';
}

export interface PaginatedPets {
  data: Pet[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Application {
  id: string;
  petId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedApplications {
  data: Application[];
  page: number;
  pageSize: number;
  total: number;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  let body: unknown = null;
  if (res.status !== 204) {
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  }

  if (!res.ok) {
    const envelope = body as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | null;
    const err: ApiError = Object.assign(
      new Error(envelope?.error?.message ?? `HTTP ${res.status}`),
      {
        status: res.status,
        code: envelope?.error?.code,
        details: envelope?.error?.details,
      },
    );
    throw err;
  }

  return body as T;
}

export const api = {
  register: (input: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listPets: (params: { species?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params.species) qs.set('species', params.species);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return request<PaginatedPets>(`/pets${q ? `?${q}` : ''}`);
  },

  getPet: (id: string) => request<Pet>(`/pets/${id}`),

  apply: (token: string, input: { petId: string; message?: string }) =>
    request<Application>('/applications', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  myApplications: (token: string) =>
    request<Application[]>('/applications/me', { token }),

  listApplications: (token: string, status?: string) =>
    request<PaginatedApplications>(
      `/applications${status ? `?status=${status}` : ''}`,
      { token },
    ),

  approve: (token: string, id: string) =>
    request<Application>(`/applications/${id}/approve`, {
      method: 'POST',
      token,
    }),

  reject: (token: string, id: string) =>
    request<Application>(`/applications/${id}/reject`, {
      method: 'POST',
      token,
    }),
};
