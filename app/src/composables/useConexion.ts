import { onUnmounted, ref } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * TODO [M7] Capacidades nativas (6 pts en total: este archivo, PerfilPage.vue y AndroidManifest.xml).
 *
 * useConexion() devuelve { conectado, tipo }:
 *   - Valor inicial con Network.getStatus()                       (@capacitor/network)
 *   - Se actualiza solo con Network.addListener('networkStatusChange', ...)
 *   - El oyente se libera (handle.remove()) cuando se destruye la página que lo usa (onUnmounted).
 *   Las páginas Equipos y Formulario ya muestran el aviso "Sin conexión" y deshabilitan Guardar con `conectado`.
 */
export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  let oyente: PluginListenerHandle | null = null;
  let destruido = false;

  // Valor inicial
  Network.getStatus()
    .then((estado) => {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    })
    .catch(() => {
      // Si no se puede leer el estado, se conserva el valor por defecto (conectado).
    });

  // Actualización automática ante cambios de red
  Network.addListener('networkStatusChange', (estado) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  })
    .then((handle) => {
      // addListener devuelve una promesa: si la página ya se destruyó, se libera de inmediato
      if (destruido) handle.remove();
      else oyente = handle;
    })
    .catch(() => {
      // Sin oyente: el estado inicial sigue siendo válido.
    });

  // Liberación del oyente al destruir la página que usa el composable
  onUnmounted(() => {
    destruido = true;
    oyente?.remove();
    oyente = null;
  });

  return { conectado, tipo };
}

/**
 * TODO [M7] vibrar(): vibración breve de confirmación con Haptics.impact({ style: ImpactStyle.Light })
 *   (@capacitor/haptics). En el navegador NO debe hacer nada: use Capacitor.isNativePlatform().
 *   Se llama después de guardar y de eliminar con éxito.
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Dispositivo sin vibrador o sin soporte: no debe interrumpir el flujo.
  }
}