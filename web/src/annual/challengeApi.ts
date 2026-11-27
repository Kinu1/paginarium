import { auth } from '../auth'

export async function challengeRequest<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const user = auth?.currentUser
  if (!user) throw new Error('Entre na sua conta para abrir seus desafios.')
  const base = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')).replace(/\/$/, '')
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: 'Bearer ' + await user.getIdToken(), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.message === 'string' ? body.message : 'Não foi possível carregar o desafio. Tente novamente.')
  }
  return res.json()
}
