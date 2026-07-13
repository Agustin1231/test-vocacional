import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TestStateService } from '../services/test-state.service';

/**
 * Evita saltar a una pantalla sin completar los pasos previos.
 * - /datos, /inicio, /quiz requieren avatar (siempre hay uno por defecto) → OK.
 * - /resultado y /asesor requieren un resultado ya calculado.
 * - /datos en adelante requiere que el avatar exista (siempre existe) pero
 *   /inicio, /quiz requieren registro.
 */
export const flowGuard: CanActivateFn = (route) => {
  const state = inject(TestStateService);
  const router = inject(Router);
  const path = route.routeConfig?.path;

  switch (path) {
    case 'datos':
      // Solo requiere haber pasado por el avatar; siempre disponible.
      return true;

    case 'inicio':
    case 'quiz':
      if (state.hasRegistro()) return true;
      return router.createUrlTree(['/datos']);

    case 'resultado':
    case 'asesor':
      if (state.hasResult()) return true;
      if (state.hasRegistro()) return router.createUrlTree(['/quiz']);
      return router.createUrlTree(['/avatar']);

    default:
      return true;
  }
};
