<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!--
        TODO [M4] Listado (10 pts)
          - ion-refresher (slot="fixed") que vuelve a la página 1.
          - Mientras carga la primera página: ion-skeleton-text (no un spinner a pantalla completa).
          - Si falla la carga: mensaje + botón "Reintentar".
          - Si no hay resultados: estado vacío (use la clase .estado-vacio de theme/variables.css).
          - ion-list con un ion-item por equipo: nombre, "código · categoría", ion-badge con el estado
            (colorEstado) y router-link a /tabs/equipos/{id}/editar.
          - ion-infinite-scroll que pide la siguiente página; se deshabilita cuando no hay más
            (meta.current_page / meta.last_page).

        TODO [M6] Eliminación (8 pts)
          - Envuelva cada ion-item en ion-item-sliding con un ion-item-option "Eliminar" (color danger).
      -->
      <ion-refresher slot="fixed" @ion-refresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Primera carga: esqueletos -->
      <ion-list v-if="cargando && equipos.length === 0 && !error">
        <ion-item v-for="n in 6" :key="n">
          <ion-label>
            <h2><ion-skeleton-text animated style="width: 60%" /></h2>
            <p><ion-skeleton-text animated style="width: 40%" /></p>
          </ion-label>
          <ion-skeleton-text slot="end" animated style="width: 64px; height: 20px" />
        </ion-item>
      </ion-list>

      <!-- Error de carga -->
      <div v-else-if="error && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" size="large" />
        <p>{{ error }}</p>
        <ion-button fill="outline" @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- Sin resultados -->
      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" size="large" />
        <p>{{ q ? 'No hay equipos que coincidan con la búsqueda.' : 'Todavía no hay equipos registrados.' }}</p>
      </div>

      <!-- Listado -->
      <ion-list v-else>
        <ion-item
          v-for="equipo in equipos"
          :key="equipo.id"
          :router-link="`/tabs/equipos/${equipo.id}/editar`"
          detail
        >
          <ion-label>
            <h2>{{ equipo.nombre }}</h2>
            <p>{{ equipo.codigo }} · {{ equipo.categoria?.nombre }}</p>
          </ion-label>
          <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll v-if="equipos.length > 0" :disabled="!hayMas" @ion-infinite="cargarMas">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

// Importaciones disponibles para usar en el template (no es necesario importarlas explícitamente):
void [IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  cloudOfflineOutline, searchOutline, trashOutline];

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

// Contador para descartar respuestas viejas (como una búsqueda anterior que responde tarde)
let peticionActual = 0;

/**
 * TODO [M4] cargar(reiniciar)
 *  - reiniciar = true  → pide la página 1 y REEMPLAZA la lista.
 *  - reiniciar = false → pide la página siguiente y la AGREGA al final.
 *  - Use listar(pagina, q) de services/equipos.ts y actualice pagina/ultimaPagina con meta.
 *  - Maneje cargando y error (un 401 ya lo resuelve api.ts).
 */
async function cargar(reiniciar = false) {
  const id = ++peticionActual;
  const paginaPedida = reiniciar ? 1 : pagina.value + 1;

  cargando.value = true;
  error.value = '';

  try {
    const respuesta = await listar(paginaPedida, q.value);
    if (id !== peticionActual) return; // llegó una petición más nueva: se descarta esta

    equipos.value = reiniciar ? respuesta.data : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (e) {
    if (id !== peticionActual) return;
    // Con un 401 api.ts ya limpió la sesión y navegó a /login
    error.value =
      e instanceof ErrorApi && e.status === 0
        ? 'No fue posible conectar con la API.'
        : 'No se pudo cargar el listado de equipos.';
  } finally {
    if (id === peticionActual) cargando.value = false;
  }
}

/**
 * TODO [M4] La lista debe recargarse CADA VEZ que la persona vuelve a esta página
 *           (por ejemplo, al regresar del formulario). Elija el hook de ciclo de vida correcto.
 */
onIonViewWillEnter(() => cargar(true));

const buscar = (evento: CustomEvent) => {
  // Se lee el valor del evento para no depender del orden con que v-model actualiza q
  q.value = (evento.detail?.value ?? '') as string;
  return cargar(true);
};

/** TODO [M4] Recargar desde la página 1 y cerrar el refresher (evento.target.complete()). */
async function refrescar(evento: RefresherCustomEvent) {
  await cargar(true);
  evento.target.complete();
}

/** TODO [M4] Cargar la página siguiente y cerrar el infinite scroll (evento.target.complete()). */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  if (hayMas.value && !cargando.value) {
    await cargar(false);
  }
  evento.target.complete();
}

/**
 * TODO [M6] confirmarEliminacion(equipo, evento)
 *  1. Cierre el ion-item-sliding.
 *  2. alertController con dos botones: role 'cancel' y role 'destructive'.
 *     Lea el role con onDidDismiss(); si no es 'destructive', no haga nada.
 *  3. eliminar(equipo.id):
 *       204 → quitar el equipo de la lista (sin recargar todo), vibrar() y toast de éxito.
 *       409 → toast con el mensaje que envía la API (regla R1: equipo prestado). El equipo sigue en la lista.
 *       404 → quitarlo de la lista y avisar que ya no existe.
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  void [equipo, evento, alertController, ErrorApi, mostrarToast, vibrar, eliminar];
}

void [refrescar, cargarMas, confirmarEliminacion, colorEstado, hayMas];
</script>