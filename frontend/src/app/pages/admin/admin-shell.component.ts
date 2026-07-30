import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

/**
 * Marco del panel de administración: cabecera con la sesión, navegación por
 * secciones y el contenido de cada una. Usa el mismo lenguaje visual que la
 * app del estudiante (tokens de `styles.scss`).
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="admin-shell animate-in">
      <header class="shell-head">
        <div>
          <p class="eyebrow">Panel de administración</p>
          <h1>Brújula <span class="grad-text">UNIAGRARIA</span></h1>
        </div>

        <div class="sesion">
          <div class="quien">
            <span class="nombre">{{ auth.nombre() || 'Administrador' }}</span>
            <span class="rol">{{ auth.sesion()?.rol }}</span>
          </div>
          <div class="avatar-admin">{{ inicial() }}</div>
          <button class="btn-ghost small" (click)="salir()">Cerrar sesión</button>
        </div>
      </header>

      <nav class="tabs" aria-label="Secciones del panel">
        @for (t of tabs; track t.path) {
          <a [routerLink]="t.path" routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: t.exact }" class="tab">
            <span class="tab-ico">{{ t.icon }}</span>
            <span class="tab-txt">{{ t.label }}</span>
          </a>
        }
        <a routerLink="/" class="tab volver">
          <span class="tab-ico">↩</span>
          <span class="tab-txt">Ver el test</span>
        </a>
      </nav>

      <div class="shell-body">
        <router-outlet />
      </div>
    </section>
  `,
  styles: [
    `
      .admin-shell {
        max-width: 1060px;
        margin: 0 auto;
      }
      .shell-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 22px;
      }
      h1 {
        font-size: clamp(1.7rem, 3.6vw, 2.3rem);
      }
      .sesion {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .quien {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.25;
      }
      .nombre {
        font-weight: 700;
        font-size: 0.94rem;
      }
      .rol {
        font-size: 0.76rem;
        color: var(--uni-green);
      }
      .avatar-admin {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 800;
        color: #04140e;
        background: var(--grad-brand);
        box-shadow: 0 8px 18px -8px rgba(11, 194, 176, 0.7);
      }

      .tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        padding: 6px;
        border-radius: 999px;
        background: rgba(7, 20, 17, 0.6);
        border: 1px solid var(--rule);
        margin-bottom: 26px;
        backdrop-filter: blur(10px);
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 999px;
        text-decoration: none;
        color: var(--ink-dim);
        font-weight: 600;
        font-size: 0.9rem;
        transition: 0.22s var(--ease);
        border: 1px solid transparent;
      }
      .tab:hover {
        color: var(--ink);
        background: rgba(244, 247, 242, 0.05);
      }
      .tab.active {
        color: #04140e;
        background: var(--grad-brand);
        box-shadow: 0 8px 20px -10px rgba(11, 194, 176, 0.8);
      }
      .tab.volver {
        margin-left: auto;
        color: var(--ink-faint);
      }
      .tab-ico {
        font-size: 1rem;
      }

      @media (max-width: 700px) {
        .tab-txt {
          display: none;
        }
        .tab {
          padding: 10px 14px;
        }
        .tab.volver {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class AdminShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  tabs = [
    { path: '/admin', label: 'Métricas', icon: '📊', exact: true },
    { path: '/admin/informes', label: 'Informes', icon: '🗂️', exact: false },
    { path: '/admin/preguntas', label: 'Preguntas', icon: '❓', exact: false },
    { path: '/admin/agente', label: 'Agente IA', icon: '🤖', exact: false },
  ];

  inicial(): string {
    const n = this.auth.nombre().trim();
    return (n ? n[0] : 'A').toUpperCase();
  }

  salir(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
