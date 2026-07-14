import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, inject, ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { environment } from '../../../environments/environment';
import { TestStateService } from '../../core/services/test-state.service';
import { ScoringService } from '../../core/services/scoring.service';
import { AvatarService } from '../../core/services/avatar.service';
import { EMOJI, ORDER, PROFILES } from '../../core/data/profiles.data';
import { RESULT_PROGRAMS, UNI_PROGRAMS } from '../../core/data/programs.data';
import { Counts, Letter, Profile, Program } from '../../core/models/test.models';
import { TiltDirective } from '../../shared/tilt.directive';

interface Bar {
  letter: Letter;
  emoji: string;
  area: string;
  count: number;
  pct: number;
  winner: boolean;
}

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, RouterLink, TiltDirective],
  template: `
    @if (winner) {
      <section class="screen animate-in report">
        <!-- Encabezado -->
        <div class="report-head">
          <div class="result-avatar orb" appTilt [tiltMax]="16"
               [style.--ring]="accent"
               [style.background]="avatarBg" [innerHTML]="avatarSvg"></div>
          <div>
            <p class="eyebrow">Paso 4 de 4 · Tu resultado</p>
            <p class="area mono">{{ profile.area }}</p>
            <h1 class="carrera" [style.color]="accent">{{ profile.carrera }}</h1>
            <p class="perfil">{{ profile.perfil }}</p>
          </div>
        </div>

        <!-- Perfil en 3 columnas -->
        <div class="report-cols">
          <div class="report-card card">
            <h3>💪 Fortalezas</h3>
            <ul>@for (f of profile.fortalezas; track f) { <li>{{ f }}</li> }</ul>
          </div>
          <div class="report-card card">
            <h3>⚠️ Retos a cuidar</h3>
            <ul>@for (d of profile.debilidades; track d) { <li>{{ d }}</li> }</ul>
          </div>
          <div class="report-card card">
            <h3>✨ Tus cualidades</h3>
            <div class="chips">
              @for (c of profile.cualidades; track c) { <span class="chip">{{ c }}</span> }
            </div>
          </div>
        </div>

        <!-- Brújula + mapa de afinidades -->
        <div class="report-viz">
          <div class="compass-box">
            <div #compassEl class="compass-mount" [innerHTML]="compassSvg"></div>
            <p class="compass-cap mono">La aguja apunta a {{ winner }}</p>
          </div>

          <div class="distribution card">
            <h3>📊 Tu mapa de afinidades</h3>
            @for (b of bars; track b.letter) {
              <div class="bar-row" [class.win]="b.winner">
                <span class="bar-label mono">{{ b.letter }}</span>
                <span class="bar-name">{{ b.emoji }} {{ b.area }}</span>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="b.pct"
                       [style.background]="'var(--' + b.letter.toLowerCase() + ')'"></div>
                </div>
                <span class="bar-count mono">{{ b.count }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Programas UNIAGRARIA -->
        <div class="uni-section" [style.--ring]="accent">
          <div class="uni-glow"></div>
          <h3>🎓 Programas para ti en <span class="grad-text">UNIAGRARIA</span></h3>
          <p class="sub">Según tu perfil, estos programas de nuestra oferta académica desarrollan tu potencial:</p>
          @if (resultNote) { <p class="note">{{ resultNote }}</p> }

          <div class="program-grid">
            @for (p of primaryPrograms; track p.slug) {
              <div class="program-card primary grad-border glare" appTilt [tiltMax]="8" [tiltScale]="1.03">
                <span class="best-tag">★ Tu mejor opción</span>
                <div class="program-badge">
                  <span class="badge-emoji">{{ p.emoji }}</span>
                </div>
                <h4>{{ p.nombre }}</h4>
                <p>{{ p.resumen }}</p>
                <a [href]="p.url" target="_blank" rel="noopener" class="btn-primary small-cta">
                  Conoce el programa →
                </a>
              </div>
            }
          </div>

          @if (relatedPrograms.length) {
            <p class="related-title">También podrían interesarte</p>
            <div class="program-grid related">
              @for (p of relatedPrograms; track p.slug) {
                <div class="program-card glare" appTilt [tiltMax]="7" [tiltScale]="1.03">
                  <div class="program-badge small">
                    <span class="badge-emoji">{{ p.emoji }}</span>
                  </div>
                  <h4>{{ p.nombre }}</h4>
                  <a [href]="p.url" target="_blank" rel="noopener" class="btn-ghost small">Ver programa →</a>
                </div>
              }
            </div>
          }
        </div>

        <!-- Acciones -->
        <div class="report-actions">
          <a [href]="inscripcionUrl" target="_blank" rel="noopener" class="btn-primary">
            Quiero inscribirme →
          </a>
          <a routerLink="/asesor" class="btn-ghost">💬 Hablar con el asesor IA</a>
          <button class="btn-ghost" (click)="imprimir()">🖨️ Descargar / imprimir</button>
          <button class="btn-ghost" (click)="reiniciar()">↺ Repetir el test</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .report {
        max-width: 940px;
        margin: 0 auto;
      }
      .report-head {
        display: grid;
        grid-template-columns: 132px 1fr;
        gap: 26px;
        align-items: center;
        margin-bottom: 36px;
      }
      .result-avatar {
        width: 132px;
        height: 132px;
        border-radius: 50%;
        overflow: hidden;
        display: grid;
        place-items: center;
        box-shadow:
          0 0 0 4px var(--ring, var(--uni-green)),
          0 0 34px -4px color-mix(in srgb, var(--ring, var(--uni-green)) 55%, transparent),
          0 18px 40px -12px rgba(0, 0, 0, 0.6);
      }
      .result-avatar {
        perspective: 900px;
      }
      .result-avatar ::ng-deep svg {
        width: 86%;
        height: 86%;
        position: relative;
        z-index: 4;
      }
      .area {
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
        margin: 4px 0 2px;
      }
      .carrera {
        font-size: clamp(1.9rem, 4.4vw, 2.9rem);
        line-height: 1.05;
        margin-bottom: 12px;
      }
      .perfil {
        color: var(--ink-dim);
        font-size: 1.02rem;
        line-height: 1.6;
        max-width: 62ch;
        margin: 0;
      }

      .report-cols {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
        margin-bottom: 34px;
      }
      .report-card {
        padding: 22px 22px;
      }
      .report-card h3 {
        font-size: 1rem;
        margin-bottom: 14px;
      }
      .report-card ul {
        margin: 0;
        padding-left: 18px;
        color: var(--ink-dim);
        font-size: 0.92rem;
        line-height: 1.55;
      }
      .report-card li {
        margin-bottom: 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        background: var(--surface-2);
        border: 1px solid var(--rule);
        border-radius: 999px;
        padding: 6px 13px;
        font-size: 0.82rem;
        color: var(--ink);
      }

      .report-viz {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 24px;
        align-items: center;
        margin-bottom: 34px;
      }
      .compass-box {
        text-align: center;
      }
      .compass-mount {
        max-width: 300px;
        margin: 0 auto;
      }
      .compass-cap {
        color: var(--ink-faint);
        font-size: 0.76rem;
        margin-top: 8px;
      }
      .distribution {
        padding: 28px 26px;
      }
      .distribution h3 {
        font-size: 1rem;
        margin-bottom: 18px;
      }
      .bar-row {
        display: grid;
        grid-template-columns: 22px 190px 1fr 26px;
        align-items: center;
        gap: 12px;
        margin-bottom: 11px;
      }
      .bar-label {
        color: var(--ink-faint);
        font-size: 0.82rem;
      }
      .bar-name {
        font-size: 0.86rem;
        color: var(--ink-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-row.win .bar-name {
        color: var(--ink);
        font-weight: 600;
      }
      .bar-track {
        height: 9px;
        background: var(--surface-2);
        border-radius: 999px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.9s var(--ease);
      }
      .bar-count {
        text-align: right;
        font-size: 0.8rem;
        color: var(--ink-dim);
      }

      .uni-section {
        position: relative;
        overflow: hidden;
        padding: 38px 34px;
        margin-bottom: 32px;
        border-radius: var(--radius);
        border: 1px solid var(--rule);
        background:
          radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--ring, var(--uni-green)) 10%, transparent), transparent 60%),
          linear-gradient(180deg, rgba(18, 58, 44, 0.55) 0%, rgba(7, 20, 17, 0.6) 100%);
        box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(16px) saturate(1.15);
        -webkit-backdrop-filter: blur(16px) saturate(1.15);
      }
      .uni-glow {
        position: absolute;
        top: -120px;
        left: 50%;
        width: 340px;
        height: 340px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: var(--ring, var(--uni-green));
        filter: blur(90px);
        opacity: 0.22;
        pointer-events: none;
      }
      .uni-section h3 {
        position: relative;
        font-size: 1.55rem;
        margin-bottom: 6px;
      }
      .uni-section .sub {
        position: relative;
        color: var(--ink-dim);
        margin: 0 0 22px;
        font-size: 1rem;
        max-width: 60ch;
      }
      .note {
        position: relative;
        background: rgba(255, 225, 77, 0.1);
        border: 1px solid rgba(255, 225, 77, 0.28);
        border-radius: var(--radius-sm);
        padding: 13px 16px;
        font-size: 0.9rem;
        color: var(--uni-gold-soft);
        margin: 0 0 22px;
      }
      .program-grid {
        position: relative;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 18px;
      }
      .program-grid.related {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      .program-card {
        position: relative;
        border-radius: var(--radius-sm);
        padding: 26px 22px 24px;
        border: 1px solid var(--rule-strong);
        background: linear-gradient(180deg, rgba(20, 52, 40, 0.75) 0%, rgba(9, 24, 19, 0.85) 100%);
        box-shadow: 0 14px 30px -18px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        transition: box-shadow 0.3s var(--ease), border-color 0.3s var(--ease);
      }
      .program-card::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
        border-radius: inherit;
      }
      .program-card:hover {
        border-color: color-mix(in srgb, var(--ring, var(--uni-green)) 55%, transparent);
        box-shadow: 0 22px 44px -16px rgba(0, 0, 0, 0.85),
          0 0 30px -6px color-mix(in srgb, var(--ring, var(--uni-green)) 45%, transparent);
      }
      .program-card.primary {
        padding-top: 34px;
        background:
          radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, var(--ring, var(--uni-green)) 16%, transparent), transparent 65%),
          linear-gradient(180deg, rgba(20, 52, 40, 0.8) 0%, rgba(9, 24, 19, 0.88) 100%);
      }
      .best-tag {
        position: absolute;
        top: 14px;
        right: 14px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #04140e;
        background: var(--grad-warm);
        padding: 5px 12px;
        border-radius: 999px;
        box-shadow: 0 6px 16px -6px rgba(255, 225, 77, 0.6);
      }
      .program-badge {
        width: 60px;
        height: 60px;
        border-radius: 18px;
        background: var(--grad-brand);
        display: grid;
        place-items: center;
        margin-bottom: 16px;
        box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--ring, var(--uni-teal)) 70%, transparent),
          inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -8px 14px -6px rgba(0, 0, 0, 0.4);
      }
      .program-badge.small {
        width: 50px;
        height: 50px;
        border-radius: 15px;
        margin-bottom: 13px;
      }
      .badge-emoji {
        font-size: 1.7rem;
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
      }
      .program-badge.small .badge-emoji {
        font-size: 1.4rem;
      }
      .program-card h4 {
        font-size: 1.12rem;
        margin-bottom: 9px;
      }
      .program-card p {
        color: var(--ink-dim);
        font-size: 0.9rem;
        line-height: 1.55;
        margin: 0 0 18px;
      }
      .small-cta {
        font-size: 0.86rem;
        padding: 11px 20px;
      }
      .related-title {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 30px 0 14px;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--ink-dim);
      }
      .related-title::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--rule);
      }

      .report-actions {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
        padding-top: 30px;
        border-top: 1px solid var(--rule);
      }
      .report-actions .btn-primary {
        padding: 14px 30px;
      }

      @media (max-width: 780px) {
        .report-head,
        .report-cols,
        .report-viz {
          grid-template-columns: 1fr;
        }
        .result-avatar {
          margin: 0 auto;
        }
        .bar-row {
          grid-template-columns: 20px 1fr 24px;
        }
        .bar-track {
          display: none;
        }
      }
    `,
  ],
})
export class ReportComponent implements AfterViewInit {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private avatarSvc = inject(AvatarService);
  private scoring = inject(ScoringService);
  private state = inject(TestStateService);

  @ViewChild('compassEl') compassEl?: ElementRef<HTMLDivElement>;

  winner: Letter | null = this.state.winner();
  profile!: Profile;
  accent = '';
  avatarBg = '';
  avatarSvg: SafeHtml = '';
  compassSvg: SafeHtml = '';
  bars: Bar[] = [];
  primaryPrograms: Program[] = [];
  relatedPrograms: Program[] = [];
  resultNote?: string;
  inscripcionUrl = environment.inscripcionUrl;

  constructor() {
    const w = this.winner;
    if (!w) {
      this.router.navigate(['/avatar']);
      return;
    }
    const counts = this.state.counts() ?? this.scoring.tally(this.state.answers());
    this.profile = PROFILES[w];
    this.accent = `var(--${w.toLowerCase()})`;
    this.avatarBg = this.state.avatar().color;
    this.avatarSvg = this.sanitizer.bypassSecurityTrustHtml(
      this.avatarSvc.buildBustSVG(this.avatarSvc.getPersona(this.state.avatar().personaId), w),
    );
    this.compassSvg = this.sanitizer.bypassSecurityTrustHtml(
      this.avatarSvc.buildCompassSVG(w, 300),
    );
    this.bars = this.buildBars(counts, w);

    const rp = RESULT_PROGRAMS[w];
    this.resultNote = rp.note;
    this.primaryPrograms = rp.primary.map((s) => UNI_PROGRAMS[s]).filter(Boolean);
    this.relatedPrograms = rp.related.map((s) => UNI_PROGRAMS[s]).filter(Boolean);
  }

  ngAfterViewInit(): void {
    if (!this.winner) return;
    // Gira la aguja hacia el sector ganador tras montar.
    const needle = this.compassEl?.nativeElement.querySelector<SVGElement>('.needle');
    if (needle) {
      const angle = this.avatarSvc.needleAngle(this.winner);
      requestAnimationFrame(() => {
        needle.style.transform = `rotate(${angle}deg)`;
      });
    }
  }

  private buildBars(counts: Counts, winner: Letter): Bar[] {
    const max = Math.max(...ORDER.map((L) => counts[L]), 1);
    return ORDER.map((L) => ({
      letter: L,
      emoji: EMOJI[L],
      area: PROFILES[L].area,
      count: counts[L],
      pct: Math.round((counts[L] / max) * 100),
      winner: L === winner,
    })).sort((a, b) => b.count - a.count);
  }

  imprimir(): void {
    window.print();
  }

  reiniciar(): void {
    this.state.reset();
    this.router.navigate(['/avatar']);
  }
}
