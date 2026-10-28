// Cliente HTTP del módulo. Usa rutas relativas: en Docker Nginx reenvía /api/ a la API,
// y en desarrollo (npm run dev) lo hace el proxy de vite.config.ts.
const BASE = '/api/finanzas';
 
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
 
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifica que la API esté en ejecución.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Nest devuelve `message` como texto (reglas de negocio) o como arreglo (errores del DTO).
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new ApiError(response.status, (Array.isArray(message) ? message.join(' ') : message) ?? 'No se pudo completar la operación.');
  }
  return body as T;
}
 
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });