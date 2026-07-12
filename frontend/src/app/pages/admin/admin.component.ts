import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StorageService } from '../../core/services/storage.service';
import { EMOJI } from '../../core/data/profiles.data';
import { Informe } from '../../core/models/test.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <section class="screen animate-in admin">
      <div class="admin-head">
        <div>
          <p class="eyebrow">Equipo UNIAGRARIA</p>
          <h1>Panel de respuestas</h1>
        </div>
        <a routerLink="/avatar" class="btn-ghost small">← Volver al test</a>
      </div>

      <div class="toolbar">
        <button class="btn-ghost small" (click)="refrescar()">Actualizar</button>
        <button class="btn-ghost small" (click)="descargarCsv()" [disabled]="!informes().length">
          Descargar CSV
        </button>
        <button class="btn-ghost small danger" (click)="limpiar()" [disabled]="!informes().length">
          Vaciar
        </button>
        <span class="count mono">{{ informes().length }} informe(s)</span>
      </div>

      @if (informes().length) {
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Estudiante</th><th>Contacto</th>
                <th>Colegio</th><th>Ciudad</th><th>Grado</th><th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              @for (r of informes(); track r.id) {
                <tr>
                  <td class="mono">{{ r.fecha | date: 'short' }}</td>
                  <td>{{ r.registro.nombre }} {{ r.registro.apellidos }}</td>
                  <td class="mono">
                    {{ r.registro.correo }}<br />{{ r.registro.celular }}
                  </td>
                  <td>{{ r.registro.colegio }}</td>
                  <td>{{ r.registro.ciudad }}</td>
                  <td>{{ r.registro.grado }}</td>
                  <td><span class="res">{{ emoji(r) }} {{ r.carrera }}</span></td>
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
  informes = signal<Informe[]>(this.storage.list());

  emoji(r: Informe): string {
    return EMOJI[r.letra] ?? '🎓';
  }

  refrescar(): void {
    this.informes.set(this.storage.list());
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
