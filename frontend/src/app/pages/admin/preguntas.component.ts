import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../core/services/admin.service';
import { EMOJI, ORDER, PROFILES } from '../../core/data/profiles.data';
import { Letter, Question } from '../../core/models/test.models';

@Component({
  selector: 'app-admin-preguntas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="preguntas animate-in">
      <div class="intro card">
        <h3>❓ Banco de preguntas</h3>
        <p class="sub">
          Estas son las preguntas que responde el estudiante y con las que se calcula
          su perfil. Cada opción suma un punto a un área (A–K); cambiar la letra de una
          opción cambia el resultado del test.
        </p>
        <div class="stats-row">
          <span class="pill">{{ banco().length }} preguntas</span>
          <span class="pill">{{ totalOpciones() }} opciones</span>
          <span class="pill" [class.warn]="cobertura().faltantes.length">
            {{ cobertura().faltantes.length ? '⚠ Áreas sin cubrir: ' + cobertura().faltantes.join(', ') : '✓ Las 11 áreas están cubiertas' }}
          </span>
          @if (editado()) {
            <span class="pill edit">✎ Banco modificado</span>
          }
        </div>
      </div>

      <div class="acciones">
        <button class="btn-primary small-cta" (click)="agregar()">+ Nueva pregunta</button>
        <button class="btn-ghost small" (click)="exportar()">⬇ Exportar JSON</button>
        <label class="btn-ghost small importar">
          ⬆ Importar JSON
          <input type="file" accept="application/json" (change)="importar($event)" hidden />
        </label>
        @if (editado()) {
          <button class="btn-ghost small danger" (click)="restaurar()">↺ Restaurar original</button>
        }
      </div>

      @if (mensaje()) {
        <p class="ok-msg">{{ mensaje() }}</p>
      }

      <div class="nota-persistencia card">
        <strong>Dónde se guardan estos cambios.</strong> El cálculo del perfil vive en el
        frontend (decisión registrada en <code>docs/adr/0003</code>), así que este banco es
        la fuente real del test. Al guardar, los cambios quedan en este navegador y aplican
        de inmediato. Para que lleguen a todos los estudiantes hay que <strong>exportar el
        JSON y versionarlo</strong> en <code>core/data/questions.data.ts</code>. El backend
        todavía no expone endpoints de escritura de preguntas.
      </div>

      @for (q of banco(); track q.id; let i = $index) {
        <div class="q-card card">
          <div class="q-head">
            <span class="q-num">{{ i + 1 }}</span>
            <textarea class="q-text" rows="2" [ngModel]="q.text"
                      (ngModelChange)="setTexto(i, $event)"
                      placeholder="Enunciado de la pregunta"></textarea>
            <button class="del" (click)="eliminar(i)" title="Eliminar pregunta">✕</button>
          </div>

          <div class="opciones">
            @for (o of q.options; track $index; let j = $index) {
              <div class="op-row">
                <select class="op-letra" [ngModel]="o.l" (ngModelChange)="setLetra(i, j, $event)"
                        [style.borderColor]="'var(--' + o.l.toLowerCase() + ')'">
                  @for (L of letras; track L) {
                    <option [value]="L">{{ L }} · {{ emoji[L] }} {{ areaCorta(L) }}</option>
                  }
                </select>
                <input class="op-texto" [ngModel]="o.t" (ngModelChange)="setOpcionTexto(i, j, $event)"
                       placeholder="Texto de la opción" />
                <button class="del small" (click)="eliminarOpcion(i, j)" title="Quitar opción">✕</button>
              </div>
            }
            <button class="btn-ghost small add-op" (click)="agregarOpcion(i)">+ Opción</button>
          </div>
        </div>
      }

      <div class="guardar-barra">
        <button class="btn-primary" (click)="guardar()">Guardar cambios</button>
        <span class="hint">Se aplican de inmediato al test de este navegador.</span>
      </div>
    </div>
  `,
  styles: [
    `
      .intro {
        padding: 24px 26px;
        margin-bottom: 18px;
      }
      .intro h3 {
        font-size: 1.15rem;
        margin-bottom: 6px;
      }
      .sub {
        color: var(--ink-dim);
        font-size: 0.92rem;
        margin: 0 0 16px;
        max-width: 72ch;
      }
      .stats-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .pill.warn {
        background: rgba(255, 180, 90, 0.12);
        border-color: rgba(255, 180, 90, 0.35);
        color: #ffd9a8;
      }
      .pill.edit {
        background: rgba(134, 224, 90, 0.12);
        border-color: rgba(134, 224, 90, 0.35);
        color: var(--uni-green);
      }

      .acciones {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .importar {
        cursor: pointer;
      }
      .danger:hover {
        border-color: #ff9b9b !important;
        color: #ffc4c4 !important;
      }
      .ok-msg {
        background: rgba(134, 224, 90, 0.1);
        border: 1px solid rgba(134, 224, 90, 0.3);
        border-radius: var(--radius-sm);
        padding: 11px 15px;
        color: var(--uni-green);
        font-size: 0.88rem;
        margin: 0 0 16px;
      }
      .nota-persistencia {
        padding: 15px 18px;
        font-size: 0.86rem;
        line-height: 1.6;
        color: var(--ink-dim);
        margin-bottom: 20px;
      }
      .nota-persistencia strong {
        color: var(--ink);
      }
      code {
        background: rgba(244, 247, 242, 0.08);
        padding: 1px 6px;
        border-radius: 5px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.82em;
      }

      .q-card {
        padding: 20px 22px;
        margin-bottom: 14px;
      }
      .q-head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 14px;
      }
      .q-num {
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 0.85rem;
        color: #04140e;
        background: var(--grad-brand);
      }
      .q-text {
        flex: 1;
        background: rgba(7, 20, 17, 0.7);
        border: 1px solid var(--rule-strong);
        color: var(--ink);
        border-radius: var(--radius-sm);
        padding: 11px 13px;
        font-family: inherit;
        font-size: 0.96rem;
        line-height: 1.5;
        resize: vertical;
      }
      .q-text:focus {
        outline: none;
        border-color: var(--uni-teal);
        box-shadow: 0 0 0 3px rgba(11, 194, 176, 0.18);
      }
      .del {
        background: none;
        border: 1px solid var(--rule-strong);
        color: var(--ink-faint);
        border-radius: 8px;
        width: 32px;
        height: 32px;
        cursor: pointer;
        flex-shrink: 0;
        transition: 0.2s var(--ease);
      }
      .del:hover {
        border-color: #ff9b9b;
        color: #ffc4c4;
      }
      .del.small {
        width: 28px;
        height: 28px;
        font-size: 0.75rem;
      }

      .opciones {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 42px;
      }
      .op-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .op-letra {
        width: 190px;
        flex-shrink: 0;
        border-left-width: 3px;
        font-size: 0.84rem;
        padding: 9px 10px;
      }
      .op-texto {
        flex: 1;
        font-size: 0.9rem;
        padding: 9px 12px;
      }
      .add-op {
        align-self: flex-start;
        margin-top: 4px;
      }

      .guardar-barra {
        position: sticky;
        bottom: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        border-radius: 999px;
        background: rgba(7, 20, 17, 0.9);
        border: 1px solid var(--rule-strong);
        backdrop-filter: blur(12px);
        margin-top: 20px;
      }
      .hint {
        font-size: 0.84rem;
        color: var(--ink-faint);
      }

      @media (max-width: 700px) {
        .opciones {
          padding-left: 0;
        }
        .op-row {
          flex-wrap: wrap;
        }
        .op-letra {
          width: 100%;
        }
      }
    `,
  ],
})
export class AdminPreguntasComponent {
  private admin = inject(AdminService);

  readonly letras = ORDER;
  readonly emoji = EMOJI;

  banco = signal<Question[]>(structuredClone(this.admin.banco()));
  mensaje = signal<string | null>(null);
  editado = computed(() => this.admin.bancoEditado());

  totalOpciones = computed(() =>
    this.banco().reduce((n, q) => n + q.options.length, 0),
  );

  /** Áreas que ninguna opción alimenta: el test nunca podría dar ese resultado. */
  cobertura = computed(() => {
    const usadas = new Set<string>();
    for (const q of this.banco()) for (const o of q.options) usadas.add(o.l);
    return { faltantes: ORDER.filter((L) => !usadas.has(L)) };
  });

  areaCorta(L: Letter): string {
    const a = PROFILES[L].area;
    return a.length > 26 ? a.slice(0, 24) + '…' : a;
  }

  // ---- edición ----

  private actualizar(fn: (b: Question[]) => void): void {
    const copia = structuredClone(this.banco());
    fn(copia);
    this.banco.set(copia);
    this.mensaje.set(null);
  }

  setTexto(i: number, v: string): void {
    this.actualizar((b) => { b[i].text = v; });
  }

  setLetra(i: number, j: number, v: Letter): void {
    this.actualizar((b) => { b[i].options[j].l = v; });
  }

  setOpcionTexto(i: number, j: number, v: string): void {
    this.actualizar((b) => { b[i].options[j].t = v; });
  }

  agregar(): void {
    this.actualizar((b) => {
      const id = b.length ? Math.max(...b.map((q) => q.id)) + 1 : 1;
      b.push({
        id,
        text: 'Nueva pregunta',
        options: [
          { l: 'A', t: 'Primera opción' },
          { l: 'B', t: 'Segunda opción' },
        ],
      });
    });
  }

  eliminar(i: number): void {
    this.actualizar((b) => { b.splice(i, 1); });
  }

  agregarOpcion(i: number): void {
    this.actualizar((b) => { b[i].options.push({ l: 'A', t: '' }); });
  }

  eliminarOpcion(i: number, j: number): void {
    this.actualizar((b) => { b[i].options.splice(j, 1); });
  }

  // ---- persistencia ----

  guardar(): void {
    this.admin.guardarBanco(this.banco());
    this.mensaje.set(
      'Guardado. El test de este navegador ya usa estas preguntas. Exporta el JSON para versionarlo en el repositorio.',
    );
  }

  restaurar(): void {
    this.admin.restaurarBanco();
    this.banco.set(structuredClone(this.admin.banco()));
    this.mensaje.set('Se restauró el banco original del código.');
  }

  exportar(): void {
    const json = JSON.stringify(this.banco(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importar(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(String(lector.result)) as Question[];
        if (!Array.isArray(datos) || !datos.length) throw new Error('vacío');
        // Validación mínima: cada opción debe tener una letra válida.
        for (const q of datos) {
          if (!q.options?.length) throw new Error('pregunta sin opciones');
          for (const o of q.options) {
            if (!ORDER.includes(o.l)) throw new Error(`letra inválida: ${o.l}`);
          }
        }
        this.banco.set(datos);
        this.mensaje.set('Archivo cargado. Revisa y pulsa "Guardar cambios" para aplicarlo.');
      } catch (e) {
        this.mensaje.set(`No se pudo leer el archivo: ${(e as Error).message}`);
      }
      input.value = '';
    };
    lector.readAsText(file);
  }
}
