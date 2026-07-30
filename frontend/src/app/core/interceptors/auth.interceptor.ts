import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Agrega `Authorization: Bearer <JWT>` a las peticiones al backend cuando hay
 * sesión de administrador.
 *
 * Solo se aplica a nuestra API (`environment.apiUrl`) para no filtrar el token
 * a terceros. Los endpoints públicos del estudiante (resultados, chat) ignoran
 * la cabecera, así que mandarla no cambia su comportamiento.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const esNuestraApi =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');
  if (!esNuestraApi) return next(req);

  const token = inject(AuthService).token();
  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
