import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { TestStateService } from '../../core/services/test-state.service';
import { AvatarService } from '../../core/services/avatar.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="screen animate-in hero">
      <div class="hero-copy">
        <p class="eyebrow">Paso 3 de 4 · Comencemos</p>
        <h1>
          {{ saludo }}<br />
          tu <span class="grad-text">brújula</span> está lista.
        </h1>
        <p class="lede">
          Vas a responder {{ total }} preguntas. No hay respuestas correctas ni
          incorrectas: elige lo que de verdad te mueve. Al final, la aguja
          apuntará hacia el área profesional que mejor encaja contigo dentro de
          la oferta de UNIAGRARIA.
        </p>
        <div class="cta-row">
          <button class="btn-primary" (click)="empezar()">Iniciar el test →</button>
          <span class="hint mono">≈ 4 minutos</span>
        </div>
      </div>

      <div class="hero-compass" [innerHTML]="compass"></div>
    </section>
  `,
  styles: [
    `
      .hero {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 40px;
        align-items: center;
        padding-top: 14px;
      }
      .hero-copy h1 {
        font-size: clamp(2.3rem, 5vw, 3.4rem);
        line-height: 1.04;
        margin-bottom: 18px;
      }
      .hl {
        color: var(--uni-green);
      }
      .cta-row {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .hint {
        color: var(--ink-faint);
        font-size: 0.78rem;
      }
      .hero-compass {
        max-width: 360px;
        margin: 0 auto;
        filter: drop-shadow(0 24px 50px rgba(0, 0, 0, 0.5));
        animation: floaty 6s ease-in-out infinite;
      }
      @keyframes floaty {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @media (max-width: 760px) {
        .hero {
          grid-template-columns: 1fr;
        }
        .hero-compass {
          order: -1;
          max-width: 260px;
        }
      }
    `,
  ],
})
export class HeroComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private avatarSvc = inject(AvatarService);
  private state = inject(TestStateService);

  total = this.state.totalPreguntas;
  compass: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    this.avatarSvc.buildCompassSVG(null, 320),
  );

  get saludo(): string {
    const n = this.state.primerNombre();
    return n ? `${n},` : 'Explorador,';
  }

  empezar(): void {
    this.router.navigate(['/quiz']);
  }
}
