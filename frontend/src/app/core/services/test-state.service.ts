import { computed, Injectable, signal } from '@angular/core';
import {
  AvatarConfig, Counts, Informe, Letter, Registro,
} from '../models/test.models';
import { AVATAR_COLORS, PERSONAS } from '../data/avatar.data';
import { PROFILES } from '../data/profiles.data';
import { QUESTIONS } from '../data/questions.data';
import { ScoringService } from './scoring.service';
import { StorageService } from './storage.service';

/**
 * Estado global del flujo del test, basado en signals.
 *
 * Es la única fuente de verdad que comparten todas las pantallas (avatar →
 * datos → inicio → quiz → resultado → asesor). Un componente lee los signals
 * y llama a los métodos; nadie muta el estado directamente.
 */
@Injectable({ providedIn: 'root' })
export class TestStateService {
  // ---- Avatar ----
  readonly avatar = signal<AvatarConfig>({
    personaId: PERSONAS[0].id,
    color: AVATAR_COLORS[0].hex,
    apodo: '',
  });

  // ---- Registro ----
  readonly registro = signal<Registro | null>(null);
  readonly studentId = signal<string | null>(null);

  // ---- Respuestas del quiz ----
  readonly answers = signal<Record<number, Letter>>({});

  // ---- Resultado ----
  readonly winner = signal<Letter | null>(null);
  readonly counts = signal<Counts | null>(null);

  /** Nombre corto para saludos personalizados. */
  readonly primerNombre = computed(
    () => this.registro()?.nombre?.trim().split(/\s+/)[0] ?? '',
  );

  /** Total de preguntas del test. */
  readonly totalPreguntas = QUESTIONS.length;

  /** Cuántas preguntas se han respondido. */
  readonly respondidas = computed(() => Object.keys(this.answers()).length);

  constructor(
    private scoring: ScoringService,
    private storage: StorageService,
  ) {}

  // ---- Mutadores de avatar ----
  setPersona(id: string): void {
    this.avatar.update((a) => ({ ...a, personaId: id }));
  }
  setColor(hex: string): void {
    this.avatar.update((a) => ({ ...a, color: hex }));
  }
  setApodo(apodo: string): void {
    this.avatar.update((a) => ({ ...a, apodo }));
  }

  // ---- Registro ----
  setRegistro(reg: Registro): void {
    this.registro.set(reg);
    this.studentId.set(
      'est_' + Math.abs(hashString(reg.numeroDocumento + reg.correo)).toString(36),
    );
  }

  // ---- Quiz ----
  answer(questionId: number, letter: Letter): void {
    this.answers.update((prev) => ({ ...prev, [questionId]: letter }));
  }

  clearAnswer(questionId: number): void {
    this.answers.update((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  /** Guarda el resultado final y persiste el informe. */
  commitResult(winner: Letter, counts: Counts): Informe {
    this.winner.set(winner);
    this.counts.set(counts);

    const profile = PROFILES[winner];
    const reg = this.registro();
    const informe: Informe = {
      id: this.studentId() ?? 'anon_' + Object.keys(counts).join(''),
      fecha: new Date().toISOString(),
      registro: reg ?? emptyRegistro(),
      avatar: this.avatar(),
      letra: winner,
      carrera: profile.carrera,
      area: profile.area,
      contadores: counts,
    };
    this.storage.save(informe);
    return informe;
  }

  /** Reinicia el test para volver a empezar (conserva nada). */
  reset(): void {
    this.answers.set({});
    this.winner.set(null);
    this.counts.set(null);
    this.registro.set(null);
    this.studentId.set(null);
    this.avatar.set({
      personaId: PERSONAS[0].id,
      color: AVATAR_COLORS[0].hex,
      apodo: '',
    });
  }

  /** ¿El usuario ya registró sus datos? (usado por el guard de flujo). */
  hasRegistro(): boolean {
    return this.registro() !== null;
  }

  /** ¿Ya hay un resultado calculado? */
  hasResult(): boolean {
    return this.winner() !== null;
  }
}

/** Registro vacío de respaldo. */
function emptyRegistro(): Registro {
  return {
    nombre: '', apellidos: '', tipoDocumento: '', numeroDocumento: '',
    celular: '', correo: '', colegio: '', grado: '', ciudad: '', edad: '',
  };
}

/** Hash determinista simple (evita depender de Date.now para el id). */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
