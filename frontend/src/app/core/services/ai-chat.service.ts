import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface ChatResponse {
  reply: string;
}

/**
 * Contexto del estudiante que se manda en cada turno. Es lo que personaliza la
 * respuesta del asesor (nombre, perfil, área y carrera del informe).
 */
export interface ChatContexto {
  nombre?: string;
  perfil?: string;
  area?: string;
  carrera?: string;
}

/**
 * Cliente del asesor académico IA.
 *
 * Arquitectura vigente: el navegador NO habla con el servicio de IA ni conoce
 * su API key. Hace POST a `environment.aiChatUrl` (backend .NET) con
 * `{ texto, sesionId, contexto? }` y el backend hace de proxy hacia el servicio
 * de IA agregando el header `X-API-Key` y traduciendo los campos a snake_case
 * (`sesion_id`). La respuesta es `{ reply }` y se devuelve tal cual.
 *
 * El `contexto` SÍ viaja: el servicio de IA no puede deducir de quién es la
 * sesión (no consulta la base de resultados), así que sin él el asesor
 * responde en modo genérico. La memoria de la conversación la agrupa la IA por
 * `sesionId`.
 */
@Injectable({ providedIn: 'root' })
export class AiChatService {
  constructor(private http: HttpClient) {}

  /** Envía el turno actual del estudiante y devuelve la respuesta del asesor. */
  send(texto: string, sesionId: string, contexto?: ChatContexto): Observable<string> {
    const cuerpo = contexto && Object.keys(contexto).length
      ? { texto, sesionId, contexto }
      : { texto, sesionId };

    return this.http
      .post<ChatResponse>(environment.aiChatUrl, cuerpo)
      .pipe(
        map((res) => res.reply?.trim() || this.sinRespuesta()),
        catchError(() => of(this.errorConexion())),
      );
  }

  private sinRespuesta(): string {
    return 'No recibí una respuesta del asesor. Intenta reformular tu pregunta.';
  }

  private errorConexion(): string {
    return (
      '⚠️ No pude conectar con el asesor IA en este momento. ' +
      'Verifica que el servicio de IA esté disponible o visita ' +
      'https://www.uniagraria.edu.co para más información.'
    );
  }
}
