import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Agrega `Authorization: Bearer <JWT>` a las peticiones al backend cuando hay
 * sesión de administrador.
 *
 * Solo se aplica a nuestra API (`environment.apiUrl`) para no filtrar el token
 * a terceros. Los endpoints públicos del estudiante (resultados, chat) ignoran
 * la cabecera, así que mandarla no cambia su comportamiento.
 *
 * Si una petición firmada vuelve con 401 o 403, la sesión ya no sirve: se
 * cierra y se manda al login. El guard filtra al entrar, pero el token también
 * puede vencer con el panel abierto, y sin esto cada pantalla cae a su propio
 * respaldo local y muestra datos viejos como si vinieran del backend.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const esNuestraApi =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');
  if (!esNuestraApi) return next(req);

  // El login es anónimo y su 401 significa "credenciales incorrectas", no
  // "sesión vencida": firmarlo confundiría los dos mensajes.
  if (req.url.includes('/auth/login')) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((err: unknown) => {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      if (status === 401 || status === 403) {
        const destino = router.url;
        auth.logout();
        router.navigate(['/admin/login'], {
          queryParams: { redirect: destino, motivo: 'expirada' },
        });
      }
      return throwError(() => err);
    }),
  );
};
