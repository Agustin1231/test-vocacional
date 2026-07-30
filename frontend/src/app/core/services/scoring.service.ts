import { Injectable } from '@angular/core';
import { Counts, Letter, Tiebreak } from '../models/test.models';
import { ORDER } from '../data/profiles.data';
import { bancoActivo } from '../data/banco';
import { TIEBREAKS } from '../data/tiebreaks.data';

/** Resultado de evaluar las respuestas del test. */
export interface ScoreResult {
  counts: Counts;
  /** Ganador único, o null si hace falta un desempate. */
  winner: Letter | null;
  /** Pregunta de desempate a mostrar, si aplica. */
  tiebreak: { key: string; data: Tiebreak } | null;
  /** true si el ganador se resolvió por orden alfabético (empate múltiple sin pregunta). */
  fallback: boolean;
}

@Injectable({ providedIn: 'root' })
export class ScoringService {
  /** Contadores en cero para las 11 letras. */
  emptyCounts(): Counts {
    return ORDER.reduce((acc, L) => ({ ...acc, [L]: 0 }), {} as Counts);
  }

  /** Cuenta las respuestas principales (sin desempate). */
  tally(answers: Record<number, Letter>): Counts {
    const counts = this.emptyCounts();
    for (const q of bancoActivo()) {
      const a = answers[q.id];
      if (a) counts[a]++;
    }
    return counts;
  }

  /**
   * Evalúa las respuestas y decide el ganador. Si hay empate exacto entre dos
   * letras, devuelve la pregunta de desempate correspondiente. Si el empate es
   * de tres o más, resuelve por orden alfabético (fallback).
   */
  evaluate(answers: Record<number, Letter>): ScoreResult {
    const counts = this.tally(answers);
    const max = Math.max(...ORDER.map((L) => counts[L]));
    const tied = ORDER.filter((L) => counts[L] === max);

    if (tied.length === 1) {
      return { counts, winner: tied[0], tiebreak: null, fallback: false };
    }

    if (tied.length === 2) {
      const key = [...tied].sort().join('');
      const data = TIEBREAKS[key];
      if (data) {
        return { counts, winner: null, tiebreak: { key, data }, fallback: false };
      }
    }

    // Empate múltiple sin pregunta: primer letra por orden alfabético.
    return { counts, winner: [...tied].sort()[0], tiebreak: null, fallback: true };
  }

  /** Aplica la respuesta de desempate: suma un punto y devuelve el ganador. */
  applyTiebreak(counts: Counts, letter: Letter): Counts {
    return { ...counts, [letter]: counts[letter] + 1 };
  }

  /** Segunda letra con mayor afinidad (excluyendo la ganadora). */
  secondaryLetter(counts: Counts, winner: Letter): Letter {
    return ORDER
      .filter((L) => L !== winner)
      .sort((a, b) => counts[b] - counts[a])[0];
  }
}
