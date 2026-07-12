import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ChatMessage } from '../models/test.models';

/** Contexto que el frontend pasa al servicio de IA para personalizar la respuesta. */
export interface ChatContext {
  carrera?: string;
  area?: string;
  perfil?: string;
  nombre?: string;
}

interface ChatResponse {
  reply: string;
}

/**
 * Cliente del asesor académico IA.
 *
 * IMPORTANTE (arquitectura desacoplada del repo): este servicio NO llama a un
 * proveedor de IA ni contiene API keys. Solo hace POST al endpoint
 * `environment.aiChatUrl` que expone el servicio de IA independiente (Agustín).
 * Ese servicio decide el proveedor/modelo (local o nube) cambiando únicamente
 * su API key, sin tocar el frontend. Así la clave nunca queda expuesta en el
 * navegador.
 */
@Injectable({ providedIn: 'root' })
export class AiChatService {
  constructor(private http: HttpClient) {}

  send(mensajes: ChatMessage[], contexto: ChatContext): Observable<string> {
    return this.http
      .post<ChatResponse>(environment.aiChatUrl, { mensajes, contexto })
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
