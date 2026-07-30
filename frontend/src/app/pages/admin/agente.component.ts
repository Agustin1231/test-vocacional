import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService, EstadoAgente } from '../../core/services/admin.service';
import { AiChatService } from '../../core/services/ai-chat.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-admin-agente',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="agente animate-in">
      <div class="intro card">
        <h3>🤖 Asesor académico IA</h3>
        <p class="sub">
          Las instrucciones definen cómo se comporta el asesor con los estudiantes:
          su tono, qué puede responder y qué no. Se guardan en el servicio de IA y
          aplican en vivo, sin necesidad de volver a desplegar.
        </p>
        <div class="estado-row">
          <span class="pill" [class.ok]="estado() === 'ok'"
                [class.warn]="estado() === 'no-disponible'"
                [class.err]="estado() === 'error'">
            {{ etiquetaEstado() }}
          </span>
          @if (actualizado()) {
            <span class="pill">Última edición: {{ actualizado() | date: 'dd/MM/yy HH:mm' }}</span>
          }
          <button class="btn-ghost small" (click)="cargar()" [disabled]="cargando()">
            {{ cargando() ? 'Consultando…' : '↻ Recargar' }}
          </button>
        </div>
      </div>

      @if (estado() !== 'ok') {
        <div class="bloqueo card">
          <div class="bloqueo-ico">{{ estado() === 'no-disponible' ? '🔒' : '⚠️' }}</div>
          <div>
            <h4>
              {{ estado() === 'no-disponible'
                  ? 'Falta un endpoint en el backend'
                  : 'No hay conexión con el backend' }}
            </h4>
            <p>{{ motivo() }}</p>
            <p class="detalle">
              El servicio de IA sí expone <code>GET</code> y <code>PUT /api/ia/instrucciones</code>,
              pero exigen la clave compartida <code>X-API-Key</code>, que nunca puede viajar al
              navegador. La solución es que el backend agregue esas dos rutas como
              <strong>proxy protegido con JWT</strong>, igual que ya hace con
              <code>POST /api/ia/chat</code>. Este panel ya está listo para consumirlas:
              apunta a <code>{{ ruta }}</code> y se activará solo cuando existan.
            </p>
          </div>
        </div>
      }

      <div class="card editor">
        <div class="editor-head">
          <h4>Instrucciones del agente</h4>
          <span class="chars">{{ contenido().length }} caracteres</span>
        </div>
        <textarea rows="16" [ngModel]="contenido()" (ngModelChange)="contenido.set($event)"
                  [disabled]="estado() !== 'ok'"
                  placeholder="Eres el asesor académico de UNIAGRARIA. Tu misión es orientar a los aspirantes…"></textarea>

        @if (mensaje()) {
          <p class="msg" [class.err]="msgError()">{{ mensaje() }}</p>
        }

        <div class="editor-acciones">
          <button class="btn-primary" (click)="guardar()"
                  [disabled]="estado() !== 'ok' || guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar instrucciones' }}
          </button>
          <button class="btn-ghost small" (click)="usarPlantilla()">Usar plantilla sugerida</button>
        </div>
      </div>

      <!-- Probador del asesor: esto SÍ funciona hoy -->
      <div class="card probador">
        <h4>💬 Probar el asesor</h4>
        <p class="sub">
          Envía un mensaje como si fueras un estudiante y revisa la respuesta. Usa el
          endpoint real (<code>POST /api/ia/chat</code>), así que sirve para verificar
          que el backend y la IA están conectados.
        </p>

        <div class="prueba-row">
          <input [ngModel]="prueba()" (ngModelChange)="prueba.set($event)"
                 maxlength="2000" placeholder="¿Qué salidas laborales tiene Zootecnia?"
                 (keydown.enter)="probar()" />
          <button class="btn-primary small-cta" (click)="probar()" [disabled]="probando()">
            {{ probando() ? 'Enviando…' : 'Enviar' }}
          </button>
        </div>

        @if (respuesta()) {
          <div class="respuesta">
            <span class="r-label">Respuesta del asesor</span>
            <p>{{ respuesta() }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .intro,
      .editor,
      .probador,
      .bloqueo {
        padding: 24px 26px;
        margin-bottom: 18px;
      }
      h3 {
        font-size: 1.15rem;
        margin-bottom: 6px;
      }
      h4 {
        font-size: 1.02rem;
        margin-bottom: 6px;
      }
      .sub {
        color: var(--ink-dim);
        font-size: 0.92rem;
        margin: 0 0 16px;
        max-width: 74ch;
        line-height: 1.6;
      }
      .estado-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .pill.ok {
        background: rgba(134, 224, 90, 0.12);
        border-color: rgba(134, 224, 90, 0.35);
        color: var(--uni-green);
      }
      .pill.warn {
        background: rgba(255, 225, 77, 0.1);
        border-color: rgba(255, 225, 77, 0.32);
        color: var(--uni-gold-soft);
      }
      .pill.err {
        background: rgba(255, 120, 120, 0.1);
        border-color: rgba(255, 120, 120, 0.32);
        color: #ffc4c4;
      }

      .bloqueo {
        display: flex;
        gap: 18px;
        align-items: flex-start;
        border-color: rgba(255, 225, 77, 0.28);
        background: linear-gradient(180deg, rgba(60, 52, 18, 0.35), rgba(7, 20, 17, 0.5));
      }
      .bloqueo-ico {
        font-size: 1.8rem;
        flex-shrink: 0;
      }
      .bloqueo h4 {
        color: var(--uni-gold-soft);
      }
      .bloqueo p {
        color: var(--ink-dim);
        font-size: 0.9rem;
        line-height: 1.65;
        margin: 0 0 10px;
      }
      .detalle {
        font-size: 0.86rem !important;
        color: var(--ink-faint) !important;
      }
      code {
        background: rgba(244, 247, 242, 0.08);
        padding: 1px 6px;
        border-radius: 5px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.84em;
        color: var(--ink-dim);
      }

      .editor-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .chars {
        font-size: 0.8rem;
        color: var(--ink-faint);
      }
      textarea {
        width: 100%;
        background: rgba(7, 20, 17, 0.75);
        border: 1px solid var(--rule-strong);
        color: var(--ink);
        border-radius: var(--radius-sm);
        padding: 14px 16px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.86rem;
        line-height: 1.65;
        resize: vertical;
      }
      textarea:focus {
        outline: none;
        border-color: var(--uni-teal);
        box-shadow: 0 0 0 3px rgba(11, 194, 176, 0.18);
      }
      textarea:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .editor-acciones {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
        flex-wrap: wrap;
      }
      .msg {
        margin: 14px 0 0;
        font-size: 0.88rem;
        color: var(--uni-green);
      }
      .msg.err {
        color: #ffc4c4;
      }

      .prueba-row {
        display: flex;
        gap: 10px;
      }
      .prueba-row input {
        flex: 1;
      }
      .respuesta {
        margin-top: 16px;
        padding: 16px 18px;
        border-radius: var(--radius-sm);
        background: rgba(244, 247, 242, 0.04);
        border: 1px solid var(--rule);
      }
      .r-label {
        display: block;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--uni-green);
        margin-bottom: 8px;
      }
      .respuesta p {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.65;
        font-size: 0.94rem;
      }

      @media (max-width: 600px) {
        .prueba-row {
          flex-direction: column;
        }
        .bloqueo {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class AdminAgenteComponent {
  private admin = inject(AdminService);
  private ai = inject(AiChatService);
  private sesion = inject(SessionService);

  readonly ruta = '/api/ia/instrucciones';

  estado = signal<EstadoAgente>('no-disponible');
  motivo = signal<string>('');
  contenido = signal<string>('');
  actualizado = signal<string | null>(null);
  cargando = signal(false);
  guardando = signal(false);
  mensaje = signal<string | null>(null);
  msgError = signal(false);

  prueba = signal('');
  respuesta = signal<string | null>(null);
  probando = signal(false);

  constructor() {
    this.cargar();
  }

  etiquetaEstado(): string {
    switch (this.estado()) {
      case 'ok':
        return '🟢 Conectado al servicio de IA';
      case 'no-disponible':
        return '🟡 Edición no disponible todavía';
      default:
        return '🔴 Error de conexión';
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensaje.set(null);
    this.admin.leerInstrucciones().subscribe((r) => {
      this.estado.set(r.estado);
      this.motivo.set(r.motivo ?? '');
      if (r.datos) {
        this.contenido.set(r.datos.contenido);
        this.actualizado.set(r.datos.actualizado_en);
      }
      this.cargando.set(false);
    });
  }

  guardar(): void {
    this.guardando.set(true);
    this.msgError.set(false);
    this.admin.guardarInstrucciones(this.contenido()).subscribe((r) => {
      this.guardando.set(false);
      if (r.estado === 'ok') {
        this.mensaje.set('Instrucciones guardadas. Aplican de inmediato, sin redespliegue.');
        if (r.datos) this.actualizado.set(r.datos.actualizado_en);
      } else {
        this.msgError.set(true);
        this.mensaje.set(r.motivo ?? 'No se pudo guardar.');
      }
    });
  }

  usarPlantilla(): void {
    this.contenido.set(PLANTILLA);
    this.mensaje.set('Plantilla cargada. Revísala y guárdala cuando el endpoint esté disponible.');
    this.msgError.set(false);
  }

  probar(): void {
    const t = this.prueba().trim();
    if (!t || this.probando()) return;
    this.probando.set(true);
    this.respuesta.set(null);
    // Se prueba sin contexto de estudiante: así se ve el comportamiento genérico.
    this.ai.send(t, this.sesion.sesionId()).subscribe((r) => {
      this.respuesta.set(r);
      this.probando.set(false);
    });
  }
}

/** Punto de partida razonable para las instrucciones del asesor. */
const PLANTILLA = `Eres el Asesor Académico IA de la Fundación Universitaria Agraria de Colombia (UNIAGRARIA), universidad reconocida por el Ministerio de Educación Nacional, con sede en Bogotá.

Tu misión: orientar a aspirantes de pregrado sobre los programas académicos y acompañarlos en su decisión vocacional.

Cómo respondes:
- En español, con un tono cercano y motivador, tratando al estudiante de "tú".
- Respuestas breves (2 a 4 párrafos). Nada de listas interminables.
- Si el estudiante ya hizo el test, parte de su resultado para personalizar.

Qué puedes hacer:
- Explicar en qué consiste cada programa, su campo laboral y su perfil de egreso.
- Resolver dudas sobre el proceso de inscripción y la vida universitaria.
- Ayudar a comparar dos programas cuando el estudiante duda entre ellos.

Límites:
- No inventes datos de costos, fechas de matrícula, becas ni convenios: si no los tienes,
  invita a consultar uniagraria.edu.co o a hablar con un asesor humano.
- No cambies el resultado del test: el perfil lo calcula el sistema, tú lo explicas.
- No des consejos médicos, legales ni financieros personales.
- Si preguntan algo ajeno a la orientación vocacional, redirige con amabilidad.`;
