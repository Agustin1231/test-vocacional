import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TestStateService } from '../../core/services/test-state.service';
import { ScoringService } from '../../core/services/scoring.service';
import { bancoActivo } from '../../core/data/banco';
import { Counts, Letter, Tiebreak } from '../../core/models/test.models';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="screen quiz">
      <div class="quiz-top">
        <button class="btn-ghost small" (click)="atras()">← Atrás</button>
        <div class="progress">
          <div class="progress-bar" [style.width.%]="progreso()"></div>
        </div>
        <span class="counter mono">
          @if (!tie()) { {{ idx() + 1 }} / {{ total }} }
          @else { Desempate }
        </span>
      </div>

      @if (tie(); as t) {
        <div class="q-block animate-in" [attr.key]="'tie'">
          <p class="tie-note">🧭 {{ t.data.note }}</p>
          <h2 class="q-text">{{ t.data.text }}</h2>
          <div class="options">
            @for (o of t.data.options; track o.l) {
              <button class="option" (click)="responderTie(o.l)">
                <span class="opt-text">{{ o.t }}</span>
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="q-block animate-in" [attr.key]="idx()">
          <p class="eyebrow">Pregunta {{ idx() + 1 }}</p>
          <h2 class="q-text">{{ pregunta().text }}</h2>
          <div class="options">
            @for (o of pregunta().options; track o.l) {
              <button class="option"
                      [class.selected]="seleccion() === o.l"
                      (click)="responder(o.l)">
                <span class="opt-bullet"></span>
                <span class="opt-text">{{ o.t }}</span>
              </button>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .quiz {
        max-width: 780px;
        margin: 0 auto;
      }
      .quiz-top {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 40px;
      }
      .progress {
        flex: 1;
        height: 7px;
        background: var(--surface-2);
        border-radius: 999px;
        overflow: hidden;
      }
      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--uni-green-deep), var(--uni-green));
        border-radius: 999px;
        transition: width 0.4s var(--ease);
      }
      .counter {
        font-size: 0.78rem;
        color: var(--ink-faint);
        min-width: 66px;
        text-align: right;
      }
      .q-text {
        font-size: clamp(1.4rem, 3.2vw, 2rem);
        line-height: 1.25;
        margin-bottom: 26px;
      }
      .tie-note {
        color: var(--uni-gold-soft);
        background: rgba(235, 231, 42, 0.08);
        border: 1px solid rgba(235, 231, 42, 0.22);
        border-radius: var(--radius-sm);
        padding: 12px 16px;
        font-size: 0.92rem;
        line-height: 1.5;
        margin-bottom: 18px;
      }
      .options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .option {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        text-align: left;
        background: var(--surface);
        border: 1.5px solid var(--rule-strong);
        border-radius: var(--radius-sm);
        padding: 16px 18px;
        cursor: pointer;
        color: var(--ink);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 0.98rem;
        line-height: 1.5;
        transition: 0.18s var(--ease);
      }
      .option:hover {
        border-color: var(--uni-green);
        background: var(--surface-2);
        transform: translateX(4px);
      }
      .option.selected {
        border-color: var(--uni-green);
        box-shadow: 0 0 0 3px rgba(122, 193, 67, 0.18);
      }
      .opt-bullet {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid var(--ink-faint);
        margin-top: 2px;
        flex-shrink: 0;
        transition: 0.18s var(--ease);
      }
      .option:hover .opt-bullet,
      .option.selected .opt-bullet {
        border-color: var(--uni-green);
        background: var(--uni-green);
        box-shadow: inset 0 0 0 3px var(--surface);
      }
    `,
  ],
})
export class QuizComponent {
  private router = inject(Router);
  private scoring = inject(ScoringService);
  state = inject(TestStateService);

  /** Banco vigente: se fija al entrar al quiz (ver core/data/banco.ts). */
  private readonly preguntas = bancoActivo();
  readonly total = this.preguntas.length;
  idx = signal(0);
  tie = signal<{ key: string; data: Tiebreak } | null>(null);

  /** Conteo base guardado al entrar en desempate. */
  private tieCounts: Counts | null = null;

  pregunta = computed(() => this.preguntas[this.idx()]);
  seleccion = computed(() => this.state.answers()[this.pregunta().id] ?? null);

  progreso = computed(() => {
    if (this.tie()) return 100;
    return Math.round((this.idx() / this.total) * 100);
  });

  responder(letter: Letter): void {
    const q = this.pregunta();
    this.state.answer(q.id, letter);

    if (this.idx() < this.total - 1) {
      this.idx.update((i) => i + 1);
      return;
    }
    // Última pregunta → evaluar.
    const result = this.scoring.evaluate(this.state.answers());
    if (result.winner) {
      this.state.commitResult(result.winner, result.counts);
      this.router.navigate(['/resultado']);
    } else if (result.tiebreak) {
      this.tieCounts = result.counts;
      this.tie.set(result.tiebreak);
    }
  }

  responderTie(letter: Letter): void {
    const base = this.tieCounts ?? this.scoring.tally(this.state.answers());
    const counts = this.scoring.applyTiebreak(base, letter);
    this.state.commitResult(letter, counts);
    this.router.navigate(['/resultado']);
  }

  atras(): void {
    if (this.tie()) {
      // Volver de la pregunta de desempate a la última pregunta.
      this.tie.set(null);
      this.tieCounts = null;
      return;
    }
    if (this.idx() === 0) {
      this.router.navigate(['/inicio']);
      return;
    }
    const prev = this.preguntas[this.idx()];
    this.state.clearAnswer(prev.id);
    this.idx.update((i) => i - 1);
  }
}
