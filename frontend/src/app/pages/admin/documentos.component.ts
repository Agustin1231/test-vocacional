import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { AdminService, DocumentoRag } from '../../core/services/admin.service';

/**
 * Documentos del plan de estudios que consulta el agente (RAG).
 *
 * Subir un PDF acá lo deja disponible para el asesor: el servicio de IA le saca el
 * texto, lo trocea, lo convierte en vectores y el agente lo busca cuando un
 * estudiante pregunta algo concreto. Borrarlo lo saca de circulación.
 *
 * Actualizar un documento es borrarlo y subirlo de nuevo: el nombre es único, así
 * que subir uno repetido devuelve un error explícito en lugar de dejar dos
 * versiones del mismo plan compitiendo por la respuesta.
 *
 * La confirmación de borrado es un estado del componente y no un `confirm()` del
 * navegador: un diálogo nativo bloquea la pestaña entera y no se puede estilar.
 */
@Component({
  selector: 'app-admin-documentos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="animate-in">
      <header class="sec-head">
        <div>
          <h2>Documentos del agente</h2>
          <p class="sub">
            Lo que subas acá es lo único que el asesor puede citar sobre la institución.
            Si un dato no está en estos PDF, el agente responde que no lo tiene en lugar
            de inventarlo.
          </p>
        </div>
        <button class="btn-ghost small" (click)="cargar()" [disabled]="cargando()">
          {{ cargando() ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </header>

      <div class="card subida">
        <label class="archivo">
          <input type="file" accept="application/pdf,.pdf" (change)="elegir($event)"
                 [disabled]="subiendo()" />
          <span class="falso-boton">📄 Elegir PDF</span>
          <span class="nombre-archivo">{{ elegido()?.name || 'Ningún archivo elegido' }}</span>
        </label>

        <button class="btn-primary small" (click)="subir()"
                [disabled]="!elegido() || subiendo()">
          {{ subiendo() ? 'Indexando…' : 'Subir e indexar' }}
        </button>
      </div>

      @if (subiendo()) {
        <p class="aviso info">
          Extrayendo el texto y generando los vectores. Un plan de estudios largo puede
          tardar varios segundos: no cierres la pestaña.
        </p>
      }

      @if (mensaje()) {
        <p class="aviso" [class.error]="esError()" [class.ok]="!esError()">{{ mensaje() }}</p>
      }

      @if (documentos() === null) {
        <p class="aviso error">
          No se pudo leer la lista de documentos. Revisá que el servicio de IA esté
          arriba y que tenga configurada su base de documentos.
        </p>
      } @else if (documentos()!.length === 0) {
        <div class="card vacio">
          <p class="ico">📚</p>
          <p><b>Todavía no hay documentos indexados.</b></p>
          <p class="sub">
            Subí el plan de estudios en PDF. Tiene que ser un PDF con texto: si es el
            escaneo de un papel, no se le puede extraer nada y se rechaza.
          </p>
        </div>
      } @else {
        <div class="card tabla-wrap">
          <table class="tabla">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Páginas</th>
                <th>Fragmentos</th>
                <th>Tamaño</th>
                <th>Subido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (d of documentos(); track d.id) {
                <tr>
                  <td class="nombre">{{ d.nombre }}</td>
                  <td>{{ d.paginas }}</td>
                  <td>
                    <span [class.sin-fragmentos]="d.fragmentos === 0">{{ d.fragmentos }}</span>
                    @if (d.fragmentos === 0) {
                      <span class="etiqueta-alerta" title="El agente no puede consultarlo">
                        no consultable
                      </span>
                    }
                  </td>
                  <td>{{ mb(d.tamano_bytes) }}</td>
                  <td>{{ fecha(d.subido_en) }}</td>
                  <td class="acciones">
                    @if (confirmando() === d.id) {
                      <span class="confirmar">
                        ¿Borrar?
                        <button class="btn-peligro small" (click)="borrar(d)"
                                [disabled]="borrando() === d.id">
                          {{ borrando() === d.id ? 'Borrando…' : 'Sí, borrar' }}
                        </button>
                        <button class="btn-ghost small" (click)="confirmando.set(null)">
                          No
                        </button>
                      </span>
                    } @else {
                      <button class="btn-ghost small" (click)="confirmando.set(d.id)">
                        Eliminar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="nota">
          Para actualizar un documento, eliminá el actual y subí la versión nueva: los
          nombres no se repiten, así que no pueden quedar dos versiones del mismo plan
          respondiéndole al estudiante.
        </p>
      }
    </section>
  `,
  styles: [
    `
      .sec-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .sub {
        color: var(--muted, #9aa);
        font-size: 0.92rem;
        max-width: 62ch;
      }
      .subida {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        padding: 16px;
        margin-bottom: 14px;
      }
      .archivo {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        cursor: pointer;
      }
      .archivo input[type='file'] {
        /* Se oculta el input nativo pero se deja accesible: el label lo activa. */
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }
      .falso-boton {
        border: 1px solid var(--line, #2a3a3a);
        border-radius: 10px;
        padding: 8px 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      .nombre-archivo {
        color: var(--muted, #9aa);
        font-size: 0.9rem;
        word-break: break-all;
      }
      .tabla-wrap {
        padding: 0;
        overflow-x: auto;
      }
      .tabla {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.92rem;
      }
      .tabla th,
      .tabla td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line, #22312f);
      }
      .tabla th {
        font-size: 0.74rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted, #9aa);
      }
      .tabla tbody tr:last-child td {
        border-bottom: 0;
      }
      .nombre {
        font-weight: 600;
        word-break: break-all;
      }
      .acciones {
        text-align: right;
        white-space: nowrap;
      }
      .confirmar {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.86rem;
      }
      .sin-fragmentos {
        color: #ffb4a2;
        font-weight: 700;
      }
      .etiqueta-alerta {
        margin-left: 8px;
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 120, 90, 0.16);
        color: #ffb4a2;
      }
      .btn-peligro {
        border: 1px solid rgba(255, 120, 90, 0.5);
        background: rgba(255, 120, 90, 0.12);
        color: #ffb4a2;
        border-radius: 10px;
        padding: 6px 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-peligro:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .aviso {
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 0.9rem;
        margin: 0 0 14px;
      }
      .aviso.ok {
        background: rgba(80, 220, 160, 0.12);
        color: #9ff0cd;
      }
      .aviso.error {
        background: rgba(255, 120, 90, 0.14);
        color: #ffb4a2;
      }
      .aviso.info {
        background: rgba(120, 180, 255, 0.12);
        color: #bcd8ff;
      }
      .vacio {
        text-align: center;
        padding: 34px 20px;
      }
      .vacio .ico {
        font-size: 2.2rem;
        margin-bottom: 8px;
      }
      .nota {
        color: var(--muted, #9aa);
        font-size: 0.85rem;
        margin-top: 12px;
        max-width: 70ch;
      }
    `,
  ],
})
export class AdminDocumentosComponent {
  private admin = inject(AdminService);

  /** `null` = no se pudo leer la lista (distinto de lista vacía). */
  documentos = signal<DocumentoRag[] | null>([]);
  cargando = signal(false);
  elegido = signal<File | null>(null);
  subiendo = signal(false);
  mensaje = signal<string | null>(null);
  esError = signal(false);
  confirmando = signal<number | null>(null);
  borrando = signal<number | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.admin.listarDocumentos().subscribe((docs) => {
      this.documentos.set(docs);
      this.cargando.set(false);
    });
  }

  elegir(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.elegido.set(input.files?.[0] ?? null);
    this.mensaje.set(null);
  }

  subir(): void {
    const archivo = this.elegido();
    if (!archivo) return;

    this.subiendo.set(true);
    this.mensaje.set(null);

    this.admin.subirDocumento(archivo).subscribe((r) => {
      this.subiendo.set(false);
      this.esError.set(!r.ok);

      if (r.ok && r.documento) {
        const d = r.documento;
        this.mensaje.set(
          `"${d.nombre}" quedó indexado: ${d.paginas} página(s) en ${d.fragmentos} fragmento(s). ` +
            'El agente ya puede consultarlo.',
        );
        this.elegido.set(null);
        this.cargar();
      } else {
        this.mensaje.set(r.motivo ?? 'No se pudo subir el documento.');
      }
    });
  }

  borrar(documento: DocumentoRag): void {
    this.borrando.set(documento.id);
    this.admin.borrarDocumento(documento.id).subscribe((r) => {
      this.borrando.set(null);
      this.confirmando.set(null);
      this.esError.set(!r.ok);
      this.mensaje.set(
        r.ok
          ? `"${documento.nombre}" se eliminó. El agente ya no lo puede consultar.`
          : r.motivo ?? 'No se pudo borrar el documento.',
      );
      if (r.ok) this.cargar();
    });
  }

  mb(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  fecha(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }
}
