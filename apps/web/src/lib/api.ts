const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/$/,
  '',
)

function requestHeaders(token: string | null, init: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

async function errorFromResponse(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return new Error(body.error?.message ?? 'Não foi possível concluir a operação.')
  } catch {
    return new Error('Não foi possível concluir a operação.')
  }
}

export async function apiFetch<T>(
  token: string | null,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: requestHeaders(token, init),
  })
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function publicApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(null, path, init)
}

export async function apiDownload(token: string, path: string): Promise<Blob> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  return response.blob()
}
