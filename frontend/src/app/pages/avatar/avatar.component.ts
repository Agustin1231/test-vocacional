import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { TestStateService } from '../../core/services/test-state.service';
import { AvatarService } from '../../core/services/avatar.service';
import { AVATAR_COLORS, PERSONAS } from '../../core/data/avatar.data';
import { TiltDirective } from '../../shared/tilt.directive';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, FormsModule, TiltDirective],
  template: `
    <section class="screen animate-in">
      <p class="eyebrow">Paso 1 de 4 · Tu avatar</p>
      <h1 class="title">Crea tu <span class="grad-text">identidad</span> de explorador</h1>
      <p class="lede">
        Antes de emprender el viaje, dale rostro a tu aventura vocacional.
        Elige un personaje, píntalo con tu color favorito y ponle un apodo.
        ¿No te decides? Pulsa el dado y deja que la suerte elija por ti.
      </p>

      <div class="builder">
        <div class="preview-wrap">
          <div class="preview orb" appTilt [tiltMax]="14"
               [style.background]="'radial-gradient(circle at 50% 30%, ' + lighten(avatar().color) + ', ' + avatar().color + ')'">
            <div class="preview-svg" [innerHTML]="preview()"></div>
          </div>
          <p class="preview-name mono">
            {{ avatar().apodo || currentPersonaName() }}
          </p>
        </div>

        <div class="controls">
          <div class="control-block">
            <div class="block-head">
              <span class="field-label">Elige tu personaje</span>
              <button type="button" class="dice-btn" (click)="randomize()">
                🎲 Aleatorio
              </button>
            </div>
            <div class="icon-grid">
              @for (p of personas; track p.id) {
                <button type="button" class="icon-opt"
                        [class.selected]="p.id === avatar().personaId"
                        (click)="state.setPersona(p.id)"
                        [attr.aria-label]="'Personaje ' + p.name">
                  <span [innerHTML]="personaThumb(p.id)"></span>
                </button>
              }
            </div>
          </div>

          <div class="control-block">
            <span class="field-label">Color de fondo</span>
            <div class="color-grid">
              @for (c of colors; track c.hex) {
                <button type="button" class="color-opt"
                        [class.selected]="c.hex === avatar().color"
                        [style.background]="c.hex"
                        (click)="state.setColor(c.hex)"
                        [attr.aria-label]="'Color ' + c.name"></button>
              }
            </div>
          </div>

          <div class="control-block">
            <label class="field-label" for="apodo">Tu apodo (opcional)</label>
            <input id="apodo" type="text" maxlength="24"
                   placeholder="p. ej. La Exploradora"
                   [ngModel]="avatar().apodo"
                   (ngModelChange)="state.setApodo($event)" />
          </div>

          <button class="btn-primary big" (click)="continuar()">
            Continuar →
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .title {
        font-size: clamp(2rem, 4.4vw, 2.9rem);
        margin-bottom: 14px;
      }
      .builder {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 46px;
        align-items: start;
        margin-top: 10px;
      }
      .preview-wrap {
        position: sticky;
        top: 20px;
        text-align: center;
        perspective: 1000px;
      }
      .preview-wrap::before {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 34px;
        width: 74%;
        height: 42px;
        transform: translateX(-50%);
        background: radial-gradient(ellipse at center, rgba(122, 193, 67, 0.5), transparent 70%);
        filter: blur(14px);
        z-index: -1;
      }
      .preview {
        width: 100%;
        aspect-ratio: 1;
        border-radius: var(--radius-lg);
        display: grid;
        place-items: center;
        box-shadow: var(--shadow-soft), 0 30px 60px -24px rgba(0, 0, 0, 0.7);
        overflow: hidden;
        transition: background 0.4s var(--ease);
      }
      .preview-svg {
        position: relative;
        z-index: 4;
      }
      .preview-svg {
        width: 78%;
      }
      .preview-svg ::ng-deep svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .preview-name {
        margin-top: 16px;
        font-size: 1rem;
        color: var(--ink);
        font-weight: 600;
      }
      .control-block {
        margin-bottom: 26px;
      }
      .block-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .dice-btn {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.74rem;
        background: var(--surface-2);
        color: var(--ink);
        border: 1px solid var(--rule-strong);
        border-radius: 999px;
        padding: 7px 14px;
        cursor: pointer;
        transition: 0.2s var(--ease);
      }
      .dice-btn:hover {
        border-color: var(--uni-green);
        transform: translateY(-1px) rotate(-6deg);
        box-shadow: 0 6px 16px -8px rgba(122, 193, 67, 0.5);
      }
      .icon-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .icon-opt {
        aspect-ratio: 1;
        background: var(--surface);
        border: 1.5px solid var(--rule-strong);
        border-radius: var(--radius-sm);
        cursor: pointer;
        padding: 6px;
        transition: 0.2s var(--ease);
        overflow: hidden;
      }
      .icon-opt ::ng-deep svg {
        width: 100%;
        height: 100%;
      }
      .icon-opt:hover {
        border-color: var(--ink-dim);
        transform: translateY(-2px);
      }
      .icon-opt.selected {
        border-color: var(--uni-green);
        box-shadow: 0 0 0 3px rgba(122, 193, 67, 0.22);
      }
      .color-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 10px;
      }
      .color-opt {
        aspect-ratio: 1;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: 0.2s var(--ease);
      }
      .color-opt:hover {
        transform: scale(1.12);
      }
      .color-opt.selected {
        border-color: var(--ink);
        box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--ink);
      }
      .btn-primary.big {
        margin-top: 6px;
        width: 100%;
      }
      @media (max-width: 720px) {
        .builder {
          grid-template-columns: 1fr;
          gap: 30px;
        }
        .preview-wrap {
          position: static;
          max-width: 220px;
          margin: 0 auto;
        }
        .color-grid {
          grid-template-columns: repeat(8, 1fr);
        }
      }
    `,
  ],
})
export class AvatarComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private avatarSvc = inject(AvatarService);
  state = inject(TestStateService);

  personas = PERSONAS;
  colors = AVATAR_COLORS;
  avatar = this.state.avatar;

  preview = computed<SafeHtml>(() => {
    const a = this.avatar();
    const svg = this.avatarSvc.buildBustSVG(
      this.avatarSvc.getPersona(a.personaId),
      this.state.winner(),
    );
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });

  currentPersonaName(): string {
    return this.avatarSvc.getPersona(this.avatar().personaId).name;
  }

  /** Aclara un color hex para el degradado radial del orbe. */
  lighten(hex: string): string {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    const cl = (v: number) => Math.max(0, Math.min(255, v + 55));
    const r = cl(num >> 16), g = cl((num >> 8) & 0xff), b = cl(num & 0xff);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  personaThumb(id: string): SafeHtml {
    const svg = this.avatarSvc.buildBustSVG(this.avatarSvc.getPersona(id), null);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /** Genera un personaje y color al azar. */
  randomize(): void {
    const seed = 'rnd-' + Math.random().toString(36).slice(2, 10);
    this.state.setPersona(seed);
    const c = this.colors[Math.floor(Math.random() * this.colors.length)];
    this.state.setColor(c.hex);
  }

  continuar(): void {
    this.router.navigate(['/datos']);
  }
}
