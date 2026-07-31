import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { RecordsService, ResultadoListItem } from '../../core/services/records.service';
import { StorageService } from '../../core/services/storage.service';
import { EMOJI } from '../../core/data/profiles.data';
import { Informe } from '../../core/models/test.models';

/** Fila de la tabla: unifica lo que llega del backend con la copia local. */
interface Fila {
  id: string;
  fecha: string;
  estudiante: string;
  correo: string;
  celular: string;
  colegio: string;
  ciudad: string;
  grado: string;
  resultado: string;
  emoji: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="animate-in admin">
      <div class="toolbar">
        <button class="btn-ghost small" (click)="refrescar()" [disabled]="cargando()">
          {{ cargando() ? 'Cargando…' : 'Actualizar' }}
        </button>
        <button class="btn-ghost small" (click)="descargarCsv()">
          Descargar CSV (copia local)
        </button>
        <button class="btn-ghost small danger" (click)="limpiar()">
          Vaciar copia local
        </button>
        <span class="count mono">
          {{ origen() === 'backend' ? 'backend' : 'copia local' }} ·
          {{ filas().length }} informe(s)
        </span>
      </div>

      @if (filas().length) {
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Estudiante</th><th>Contacto</th>
                <th>Colegio</th><th>Ciudad</th><th>Grado</th><th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              @for (f of filas(); track f.id) {
                <tr>
                  <td class="mono">{{ f.fecha | date: 'short' }}</td>
                  <td>{{ f.estudiante }}</td>
                  <td class="mono">{{ f.correo }}<br />{{ f.celular }}</td>
                  <td>{{ f.colegio }}</td>
                  <td>{{ f.ciudad }}</td>
                  <td>{{ f.grado }}</td>
                  <td><span class="res">{{ f.emoji }} {{ f.resultado }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="empty">Aún no hay informes registrados. Completa un test para ver datos aquí.</p>
      }
    </section>
  `,
  styles: [
    `
      .admin {
        max-width: 1000px;
        margin: 0 auto;
      }
      .admin-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 22px;
      }
      .admin-head h1 {
        font-size: 1.8rem;
      }
      .toolbar {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .danger:hover {
        color: #ffb4b4 !important;
        border-color: #ffb4b4 !important;
      }
      .count {
        margin-left: auto;
        font-size: 0.78rem;
        color: var(--ink-faint);
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--rule);
        border-radius: var(--radius);
      }
      .admin-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
        min-width: 720px;
      }
      .admin-table th,
      .admin-table td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--rule);
        vertical-align: top;
      }
      .admin-table th {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.66rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-faint);
        background: var(--surface);
      }
      .admin-table td {
        color: var(--ink-dim);
      }
      .admin-table tbody tr:hover {
        background: var(--surface);
      }
      .res {
        color: var(--ink);
        font-weight: 600;
        white-space: nowrap;
      }
      .empty {
        color: var(--ink-faint);
        text-align: center;
        padding: 50px 0;
      }
    `,
  ],
})
export class AdminComponent {
  private storage = inject(StorageService);
  private records = inject(RecordsService);

  filas = signal<Fila[]>([]);
  /** De dónde salieron las filas que se están mostrando. */
  origen = signal<'backend' | 'local'>('local');
  cargando = signal(false);

  constructor() {
    this.refrescar();
  }

  /**
   * Intenta traer los informes del backend (requiere JWT) y cae a la copia
   * local si no hay token o si la petición falla.
   *
   * TODO: falta el login del panel. Hoy el JWT se lee de localStorage
   * (clave TOKEN_KEY de records.service.ts); cuando exista la pantalla de
   * login será ella la que lo guarde ahí.
   */
  refrescar(): void {
    this.cargando.set(true);
    this.records.listarResultados().subscribe((remotos) => {
      if (remotos) {
        this.filas.set(remotos.map(filaDelBackend));
        this.origen.set('backend');
      } else {
        this.filas.set(this.storage.list().map(filaLocal));
        this.origen.set('local');
      }
      this.cargando.set(false);
    });
  }

  limpiar(): void {
    this.storage.clear();
    this.refrescar();
  }

  descargarCsv(): void {
    const csv = this.storage.toCsv();
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'informes-vocacionales-uniagraria.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

/** Informe guardado en el navegador → fila de la tabla. */
function filaLocal(r: Informe): Fila {
  return {
    id: 'local-' + r.id + '-' + r.fecha,
    fecha: r.fecha,
    estudiante: `${r.registro.nombre} ${r.registro.apellidos}`.trim(),
    correo: r.registro.correo,
    celular: r.registro.celular,
    colegio: r.registro.colegio,
    ciudad: r.registro.ciudad,
    grado: r.registro.grado,
    resultado: r.carrera,
    emoji: EMOJI[r.letra] ?? '🎓',
  };
}

/**
 * Informe del backend → fila de la tabla.
 *
 * El guion largo es solo para lo que llega vacío: `celular` y `colegio` cuando el
 * estudiante no los completó, y `ciudad` o `grado` cuando el texto enviado no
 * coincidió con el catálogo y la FK quedó en null (ver api-contract.md). Antes se
 * mostraban siempre vacíos porque el DTO del backend no traía estos cuatro campos,
 * aunque sí estuvieran guardados.
 */
function filaDelBackend(r: ResultadoListItem): Fila {
  return {
    id: 'api-' + r.id,
    fecha: r.fecha,
    estudiante: r.nombreEstudiante,
    correo: r.correoEstudiante,
    celular: r.celular || '—',
    colegio: r.colegio || '—',
    ciudad: r.ciudad || '—',
    grado: r.grado || '—',
    resultado: r.programaAcademico || r.perfilVocacional || 'Sin programa asignado',
    emoji: '🎓',
  };
}
