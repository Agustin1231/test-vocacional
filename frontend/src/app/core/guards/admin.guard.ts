import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege el panel de administración.
 *
 * Sin sesión → manda al login conservando el destino (`redirect`) para volver
 * después. Con sesión pero sin el rol `Administrador` → también lo saca: el
 * backend devolvería 403 en `GET /api/resultados` y el panel muestra datos
 * personales de estudiantes, así que no debe abrirse "a medias".
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado() && auth.esAdmin()) return true;

  return router.createUrlTree(['/admin/login'], {
    queryParams: { redirect: state.url },
  });
};

/** Evita volver al login cuando ya hay una sesión válida. */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado() && auth.esAdmin()) {
    return router.createUrlTree(['/admin']);
  }
  return true;
};
