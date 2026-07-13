import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { AvatarService } from '../../core/services/avatar.service';
import { EMOJI, ORDER, PROFILES } from '../../core/data/profiles.data';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing">
      <div class="copy stagger">
        <p class="eyebrow">Orientación vocacional · UNIAGRARIA</p>
        <h1 class="mega">
          Tu futuro<br />
          tiene una<br />
          <span class="grad-text">dirección.</span>
        </h1>
        <p class="lede">
          Responde, explora y descubre en minutos cuál de las 11 carreras de
          UNIAGRARIA late con tu forma de ser. La brújula hará el resto.
        </p>
        <div class="cta-row">
          <button class="btn-primary big" (click)="empezar()">Comenzar mi viaje →</button>
          <span class="pill mono">≈ 4 min</span>
        </div>
        <div class="stats">
          <div class="stat"><span class="num grad-text">11</span><span class="lbl">carreras</span></div>
          <div class="divider"></div>
          <div class="stat"><span class="num grad-text">22</span><span class="lbl">preguntas</span></div>
          <div class="divider"></div>
          <div class="stat"><span class="num grad-text">1</span><span class="lbl">resultado tuyo</span></div>
        </div>
      </div>

      <div class="stage-visual">
        <div class="compass-halo"></div>
        <div class="compass" [innerHTML]="compass"></div>
        @for (o of orbits; track o.letter) {
          <span class="chip-orbit" [style.--i]="o.i" [style.--col]="o.col"
                [style.animation-delay.s]="o.delay">
            {{ o.emoji }}
          </span>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .landing {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 40px;
        align-items: center;
        min-height: calc(100vh - 120px);
        padding: 10px 0 40px;
      }
      .mega {
        font-size: clamp(2.8rem, 7vw, 5.4rem);
        font-weight: 800;
        letter-spacing: -0.035em;
        margin-bottom: 22px;
      }
      .grad-text { filter: drop-shadow(0 4px 24px rgba(11, 194, 176, 0.35)); }
      .lede { font-size: 1.16rem; max-width: 46ch; }
      .cta-row { display: flex; align-items: center; gap: 18px; margin-bottom: 40px; }
      .btn-primary.big { font-size: 1.08rem; padding: 18px 40px; }

      .stats { display: flex; align-items: center; gap: 26px; }
      .stat { display: flex; flex-direction: column; }
      .num { font-size: 2.4rem; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
      .lbl {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 600;
        font-size: 0.8rem;
        letter-spacing: 0.01em;
        color: var(--ink-dim);
        margin-top: 7px;
      }
      .divider { width: 1px; height: 40px; background: var(--rule-strong); }

      /* Visual centro de escena */
      .stage-visual {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 420px;
      }
      .compass {
        position: relative;
        z-index: 2;
        width: min(420px, 78%);
        animation: floaty 7s ease-in-out infinite;
        filter: drop-shadow(0 30px 60px rgba(0, 0, 0, 0.6));
      }
      .compass-halo {
        position: absolute;
        width: 78%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: var(--grad-brand);
        filter: blur(60px);
        opacity: 0.4;
        animation: pulse-halo 5s ease-in-out infinite;
      }
      @keyframes pulse-halo {
        0%, 100% { transform: scale(0.92); opacity: 0.3; }
        50% { transform: scale(1.08); opacity: 0.5; }
      }

      /* Emojis de carrera orbitando */
      .chip-orbit {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 52px;
        height: 52px;
        margin: -26px;
        display: grid;
        place-items: center;
        font-size: 1.5rem;
        border-radius: 50%;
        background: rgba(7, 20, 17, 0.85);
        border: 1px solid var(--rule-strong);
        box-shadow: 0 0 20px -4px var(--col), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(6px);
        transform: rotate(calc(var(--i) * 60deg)) translateX(230px) rotate(calc(var(--i) * -60deg));
        animation: floaty 6s ease-in-out infinite;
        z-index: 3;
      }

      @media (max-width: 860px) {
        .landing { grid-template-columns: 1fr; text-align: center; min-height: auto; }
        .copy { display: flex; flex-direction: column; align-items: center; }
        .eyebrow, .stats, .cta-row { justify-content: center; }
        .stage-visual { order: -1; min-height: 340px; }
        .chip-orbit { transform: rotate(calc(var(--i) * 60deg)) translateX(160px) rotate(calc(var(--i) * -60deg)); }
      }
    `,
  ],
})
export class LandingComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private avatarSvc = inject(AvatarService);

  compass: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    this.avatarSvc.buildCompassSVG(null, 340),
  );

  /** Seis emojis de carrera orbitando la brújula. */
  orbits = [0, 1, 2, 3, 4, 5].map((i) => {
    const L = ORDER[i * 2];
    return {
      i,
      letter: L,
      emoji: EMOJI[L],
      col: `var(--${L.toLowerCase()})`,
      delay: i * 0.4,
      area: PROFILES[L].area,
    };
  });

  empezar(): void {
    this.router.navigate(['/avatar']);
  }
}
