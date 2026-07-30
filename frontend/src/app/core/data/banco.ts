import { Question } from '../models/test.models';
import { QUESTIONS } from './questions.data';

/** Debe coincidir con la clave que usa `AdminService`. */
const BANCO_KEY = 'uniagraria_banco_preguntas';

/**
 * Banco de preguntas vigente para el test.
 *
 * Devuelve el banco editado desde el panel de administración si existe, y si no
 * el que trae el código (`questions.data.ts`). Es el punto único que consultan
 * el quiz, el scoring y el armado del payload, para que una edición del panel
 * aplique en los tres a la vez y no queden desincronizados.
 *
 * No es reactivo a propósito: se lee al entrar al test. Un cambio hecho a mitad
 * de un quiz en curso no debe alterar las preguntas que el estudiante ya vio.
 */
export function bancoActivo(): Question[] {
  try {
    if (typeof localStorage === 'undefined') return QUESTIONS;
    const raw = localStorage.getItem(BANCO_KEY);
    if (!raw) return QUESTIONS;
    const parsed = JSON.parse(raw) as Question[];
    return Array.isArray(parsed) && parsed.length ? parsed : QUESTIONS;
  } catch {
    return QUESTIONS;
  }
}
