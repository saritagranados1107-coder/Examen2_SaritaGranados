import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

/**
 * TODO [M1] Cliente HTTP único de la aplicación (8 pts).
 *
 * api<T>(ruta, { method, body, params }) debe:
 *  1. Construir la URL como BASE_URL + ruta y agregar como query string solo los params
 *     que tengan valor (ni undefined ni '').           ej. api('/equipos', { params: { page: 2, q: '' } })
 *  2. Enviar siempre "Accept: application/json".
 *  3. Si hay token (obtenerToken()), enviar "Authorization: Bearer <token>". Nunca en la URL.
 *  4. Si hay body, enviarlo como JSON ("Content-Type: application/json" + JSON.stringify).
 *  5. Cancelar la petición si tarda más de TIEMPO_MAXIMO_MS (AbortController).
 *     Si fetch falla sin respuesta (sin red, tiempo agotado, CORS), lanzar
 *     new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' }).
 *  6. Si la respuesta es 204, devolver null.
 *  7. Si response.ok es false, lanzar new ErrorApi(status, cuerpoJson).
 *     Si el estado es 401 (y la ruta no es /login): await olvidarSesion() y router.replace('/login').
 *  8. En cualquier otro caso, devolver el cuerpo JSON.
 */

/**-----Cliente HTTP único de la aplicación-------------*/
export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;

  // 1. URL y query string solo con params que tengan valor
  const query = new URLSearchParams();
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        query.append(clave, String(valor));
      }
    }
  }
  const qs = query.toString();
  const url = `${BASE_URL}${ruta}${qs ? `?${qs}` : ''}`;

  // 2, 3, 4. Cabeceras
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const tieneCuerpo = body !== undefined;
  if (tieneCuerpo) {
    headers['Content-Type'] = 'application/json';
  }

  // 5. Tiempo máximo con AbortController
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method,
      headers,
      body: tieneCuerpo ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(temporizador);
  }

  // 6. 204 sin contenido
  if (respuesta.status === 204) {
    return null as T;
  }

  // Leer el cuerpo JSON de forma segura (puede venir vacío o no ser JSON)
  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }

  // 7. Errores HTTP
  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== '/login' && ruta !== '/api/login') {
      await olvidarSesion();
      await router.replace('/login');
    }
    throw new ErrorApi(respuesta.status, cuerpo);
  }

  // 8. Éxito
  return cuerpo as T;
}
