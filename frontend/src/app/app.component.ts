import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd, Router, RouterLink, RouterOutlet,
} from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter, map } from 'rxjs/operators';

import { TestStateService } from './core/services/test-state.service';
import { AvatarService } from './core/services/avatar.service';

interface Step {
  path: string;
  label: string;
}

const STEPS: Step[] = [
  { path: 'avatar', label: 'Avatar' },
  { path: 'datos', label: 'Datos' },
  { path: 'inicio', label: 'Inicio' },
  { path: 'quiz', label: 'Test' },
  { path: 'resultado', label: 'Resultado' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    <div class="app">
      <header class="topbar">
        <a class="brandblock" routerLink="/avatar" aria-label="Inicio">
          <span class="brandmark" [innerHTML]="logo"></span>
          <span class="brandtext">
            <span class="name">UNIAGRARIA</span>
            <span class="sub mono">Brújula Vocacional</span>
          </span>
        </a>

        @if (state.registro(); as reg) {
          <div class="student-chip">
            <span class="mini-avatar" [style.background]="state.avatar().color"
                  [innerHTML]="chipAvatar()"></span>
            <span class="mono">{{ state.avatar().apodo || primerNombre() }}</span>
          </div>
        }
      </header>

      @if (showStepper()) {
        <nav class="stepper" aria-label="Progreso del test">
          @for (step of steps; track step.path; let i = $index) {
            <div class="step"
                 [class.done]="i < currentStepIndex()"
                 [class.active]="i === currentStepIndex()">
              <span class="step-dot mono">{{ i + 1 }}</span>
              <span class="step-label">{{ step.label }}</span>
            </div>
          }
        </nav>
      }

      <main class="stage">
        <router-outlet />
      </main>

      <footer class="foot">
        <span class="admin-link">Fundación Universitaria Agraria de Colombia · UNIAGRARIA</span>
      </footer>
    </div>
  `,
  styles: [
    `
      .app {
        position: relative;
        z-index: 1;
        max-width: 1080px;
        margin: 0 auto;
        padding: 0 24px 90px;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 24px 0 10px;
      }
      .brandblock {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }
      .brandmark {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        display: block;
      }
      .brandtext {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      .brandtext .name {
        font-weight: 800;
        font-size: 1rem;
        letter-spacing: 0.02em;
        color: var(--uni-cream);
      }
      .brandtext .sub {
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-faint);
      }
      .student-chip {
        display: flex;
        align-items: center;
        gap: 9px;
        background: var(--surface);
        border: 1px solid var(--rule);
        border-radius: 999px;
        padding: 5px 15px 5px 5px;
        font-size: 0.8rem;
        color: var(--ink-dim);
      }
      .mini-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        display: block;
      }
      .mini-avatar ::ng-deep svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .stepper {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 6px 0 26px;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px 6px 6px;
        border-radius: 999px;
        border: 1px solid transparent;
        opacity: 0.5;
        transition: 0.3s var(--ease);
      }
      .step-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 0.72rem;
        background: var(--surface-2);
        color: var(--ink-dim);
        border: 1px solid var(--rule-strong);
      }
      .step-label {
        font-size: 0.82rem;
        letter-spacing: 0.01em;
      }
      .step.active {
        opacity: 1;
        border-color: var(--rule-strong);
        background: var(--surface);
      }
      .step.active .step-dot {
        background: var(--uni-green);
        color: #06210f;
        border-color: transparent;
      }
      .step.done {
        opacity: 0.85;
      }
      .step.done .step-dot {
        background: var(--uni-green-deep);
        color: var(--uni-cream);
        border-color: transparent;
      }
      @media (max-width: 620px) {
        .step-label {
          display: none;
        }
        .step {
          padding: 5px;
        }
      }

      .stage {
        min-height: 46vh;
      }
      .foot {
        margin-top: 60px;
        padding-top: 22px;
        border-top: 1px solid var(--rule);
        text-align: center;
      }
      .admin-link {
        color: var(--ink-faint);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-decoration: none;
      }
      .admin-link:hover {
        color: var(--ink-dim);
      }
    `,
  ],
})
export class AppComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private avatarSvc = inject(AvatarService);
  state = inject(TestStateService);

  steps = STEPS;
  logo: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(compassLogo());

  primerNombre = this.state.primerNombre;

  /** URL actual como signal. */
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  currentStepIndex = computed(() => {
    const url = this.currentUrl();
    const seg = url.split('?')[0].replace(/^\//, '');
    const idx = STEPS.findIndex((s) => s.path === seg);
    // 'asesor' vive después del resultado; lo mostramos como último paso.
    if (seg === 'asesor') return STEPS.length - 1;
    return idx;
  });

  showStepper = computed(() => {
    const seg = this.currentUrl().split('?')[0].replace(/^\//, '');
    // El stepper es del flujo del estudiante: fuera de la portada y del panel.
    return seg !== '' && !seg.startsWith('admin');
  });

  chipAvatar(): SafeHtml {
    const a = this.state.avatar();
    const svg = this.avatarSvc.buildBustSVG(
      this.avatarSvc.getPersona(a.personaId),
      this.state.winner(),
    );
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}

/** Logo brújula minimalista para la topbar. */
function compassLogo(): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="none" stroke="var(--uni-green)" stroke-width="2"/>
    <circle cx="20" cy="20" r="3" fill="var(--uni-gold)"/>
    <path d="M20 6 L24 20 L20 34 L16 20 Z" fill="var(--uni-cream)" opacity="0.9"/>
    <path d="M20 6 L24 20 L20 20 Z" fill="var(--uni-green)"/>
  </svg>`;
}
