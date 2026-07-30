import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { AdminService, Metricas } from '../../core/services/admin.service';
import { RecordsService } from '../../core/services/records.service';
import { StorageService } from '../../core/services/storage.service';

type Fuente = 'backend' | 'local';

@Component({
  selector: 'app-admin-metricas',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="metricas animate-in">
      <div class="toolbar">
        <span class="fuente" [class.local]="fuente() === 'local'">
          {{ fuente() === 'backend' ? '🟢 Datos del backend' : '🟡 Copia local del navegador' }}
        </span>
        <button class="btn-ghost small" (click)="cargar()" [disabled]="cargando()">
          {{ cargando() ? 'Actualizando…' : '↻ Actualizar' }}
        </button>
      </div>

      @if (aviso()) {
        <p class="aviso">{{ aviso() }}</p>
      }

      @if (m(); as d) {
        <!-- Tarjetas resumen -->
        <div class="kpis">
          <div class="kpi card">
            <span class="kpi-label">Tests completados</span>
            <span class="kpi-num grad-text">{{ d.totalInformes }}</span>
          </div>
          <div class="kpi card">
            <span class="kpi-label">Áreas alcanzadas</span>
            <span class="kpi-num grad-text">{{ d.areasDistintas }}<small>/11</small></span>
          </div>
          <div class="kpi card">
            <span class="kpi-label">Carrera más frecuente</span>
            <span class="kpi-top">{{ topCarrera(d) }}</span>
          </div>
          <div class="kpi card">
            <span class="kpi-label">Último informe</span>
            <span class="kpi-top">
              {{ d.ultimaFecha ? (d.ultimaFecha | date: 'dd/MM/yy HH:mm') : '—' }}
            </span>
          </div>
        </div>

        @if (d.totalInformes === 0) {
          <div class="card vacio">
            <p class="vacio-emoji">📭</p>
            <h3>Todavía no hay informes</h3>
            <p>Cuando un estudiante complete el test, sus métricas aparecerán aquí.</p>
          </div>
        } @else {
          <!-- Distribución por área -->
          <div class="card panel">
            <h3>🧭 Distribución por área vocacional</h3>
            <p class="sub">Cuántos estudiantes obtuvieron cada perfil.</p>
            @for (a of d.porArea; track a.nombre) {
              <div class="bar-row">
                <span class="bar-name">{{ a.emoji }} {{ a.nombre }}</span>
                <div class="bar-track">
                  <div class="bar-fill"
                       [style.width.%]="ancho(a.total, d)"
                       [style.background]="color(a.letra)"></div>
                </div>
                <span class="bar-val">{{ a.total }}</span>
                <span class="bar-pct">{{ a.porcentaje }}%</span>
              </div>
            }
            @if (d.sinPerfil > 0) {
              <p class="nota">
                {{ d.sinPerfil }} informe(s) sin perfil resuelto en la base: el nombre del
                área no coincidió con el catálogo al guardar.
              </p>
            }
          </div>

          <!-- Programas -->
          <div class="card panel">
            <h3>🎓 Programas recomendados</h3>
            <p class="sub">Hacia dónde está dirigiendo el test.</p>
            <div class="chips-grid">
              @for (p of d.porPrograma; track p.nombre) {
                <div class="chip-prog">
                  <span class="cp-emoji">{{ p.emoji }}</span>
                  <span class="cp-name">{{ p.nombre }}</span>
                  <span class="cp-num">{{ p.total }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Línea de tiempo -->
          @if (d.linea.length > 1) {
            <div class="card panel">
              <h3>📈 Actividad por día</h3>
              <p class="sub">Tests completados (últimos {{ d.linea.length }} días con registros).</p>
              <div class="spark">
                @for (p of d.linea; track p.fecha) {
                  <div class="spark-col" [title]="p.etiqueta + ': ' + p.total">
                    <div class="spark-bar" [style.height.%]="altoLinea(p.total, d)"></div>
                    <span class="spark-lbl">{{ p.etiqueta }}</span>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
      }
      .fuente {
        font-size: 0.84rem;
        color: var(--ink-dim);
        background: rgba(134, 224, 90, 0.1);
        border: 1px solid rgba(134, 224, 90, 0.28);
        border-radius: 999px;
        padding: 7px 15px;
      }
      .fuente.local {
        background: rgba(255, 225, 77, 0.1);
        border-color: rgba(255, 225, 77, 0.3);
      }
      .toolbar .btn-ghost {
        margin-left: auto;
      }
      .aviso {
        background: rgba(255, 225, 77, 0.09);
        border: 1px solid rgba(255, 225, 77, 0.26);
        border-radius: var(--radius-sm);
        padding: 12px 16px;
        font-size: 0.88rem;
        color: var(--uni-gold-soft);
        margin: 0 0 18px;
      }

      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 22px;
      }
      .kpi {
        padding: 20px 22px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .kpi-label {
        font-size: 0.82rem;
        color: var(--ink-dim);
        font-weight: 600;
      }
      .kpi-num {
        font-size: 2.4rem;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.03em;
      }
      .kpi-num small {
        font-size: 1.1rem;
        opacity: 0.6;
      }
      .kpi-top {
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.3;
      }

      .panel {
        padding: 26px 26px 22px;
        margin-bottom: 20px;
      }
      .panel h3 {
        font-size: 1.15rem;
        margin-bottom: 5px;
      }
      .sub {
        color: var(--ink-dim);
        font-size: 0.9rem;
        margin: 0 0 20px;
      }
      .nota {
        font-size: 0.82rem;
        color: var(--ink-faint);
        margin: 14px 0 0;
      }

      .bar-row {
        display: grid;
        grid-template-columns: 210px 1fr 34px 48px;
        align-items: center;
        gap: 12px;
        margin-bottom: 11px;
      }
      .bar-name {
        font-size: 0.86rem;
        color: var(--ink-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-track {
        height: 10px;
        background: rgba(244, 247, 242, 0.07);
        border-radius: 999px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.7s var(--ease);
      }
      .bar-val {
        text-align: right;
        font-weight: 700;
        font-size: 0.9rem;
      }
      .bar-pct {
        text-align: right;
        font-size: 0.8rem;
        color: var(--ink-faint);
      }

      .chips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 12px;
      }
      .chip-prog {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 13px 16px;
        border-radius: var(--radius-sm);
        background: rgba(244, 247, 242, 0.04);
        border: 1px solid var(--rule);
      }
      .cp-emoji {
        font-size: 1.3rem;
      }
      .cp-name {
        flex: 1;
        font-size: 0.9rem;
      }
      .cp-num {
        font-weight: 800;
        color: var(--uni-green);
      }

      .spark {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        height: 150px;
        padding-top: 10px;
      }
      .spark-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        height: 100%;
        gap: 7px;
      }
      .spark-bar {
        width: 100%;
        max-width: 42px;
        border-radius: 6px 6px 0 0;
        background: var(--grad-brand);
        min-height: 4px;
        transition: height 0.6s var(--ease);
      }
      .spark-lbl {
        font-size: 0.68rem;
        color: var(--ink-faint);
        white-space: nowrap;
      }

      .vacio {
        text-align: center;
        padding: 50px 30px;
      }
      .vacio-emoji {
        font-size: 2.6rem;
        margin: 0 0 10px;
      }
      .vacio h3 {
        margin-bottom: 8px;
      }
      .vacio p {
        color: var(--ink-dim);
        margin: 0;
      }

      @media (max-width: 640px) {
        .bar-row {
          grid-template-columns: 1fr 34px 48px;
        }
        .bar-track {
          display: none;
        }
      }
    `,
  ],
})
export class AdminMetricasComponent {
  private admin = inject(AdminService);
  private records = inject(RecordsService);
  private storage = inject(StorageService);

  m = signal<Metricas | null>(null);
  fuente = signal<Fuente>('local');
  cargando = signal(false);
  aviso = signal<string | null>(null);

  /** Máximo de la distribución, para escalar las barras. */
  private maxArea = computed(() => {
    const d = this.m();
    return d ? Math.max(...d.porArea.map((a) => a.total), 1) : 1;
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.aviso.set(null);

    this.records.listarResultados(1, 500).subscribe((filas) => {
      if (filas && filas.length) {
        this.m.set(this.admin.metricasDesdeBackend(filas));
        this.fuente.set('backend');
        if (filas.length === 500) {
          this.aviso.set(
            'Se muestran las primeras 500 filas: el backend todavía no devuelve el total de registros para paginar.',
          );
        }
      } else {
        // Sin backend (o sin permisos): se resume la copia local del navegador.
        const locales = this.storage.list();
        this.m.set(
          this.admin.metricasDesdeLocal(
            locales.map((i) => ({
              letra: i.letra,
              carrera: i.carrera,
              area: i.area,
              fecha: i.fecha,
            })),
          ),
        );
        this.fuente.set('local');
        if (filas === null) {
          this.aviso.set(
            'No se pudo leer del backend (sesión sin permisos, token vencido o servicio caído). Se muestran los informes guardados en este navegador.',
          );
        }
      }
      this.cargando.set(false);
    });
  }

  ancho(total: number, _d: Metricas): number {
    return Math.round((total / this.maxArea()) * 100);
  }

  altoLinea(total: number, d: Metricas): number {
    const max = Math.max(...d.linea.map((p) => p.total), 1);
    return Math.round((total / max) * 100);
  }

  color(letra: string | null): string {
    return letra ? `var(--${letra.toLowerCase()})` : 'var(--ink-faint)';
  }

  topCarrera(d: Metricas): string {
    const top = d.porPrograma[0];
    return top ? `${top.emoji} ${top.nombre}` : '—';
  }
}
