import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService, ROL_ADMIN } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="screen animate-in login-screen">
      <div class="login-card card">
        <div class="login-head">
          <div class="badge-lock">🔐</div>
          <p class="eyebrow">Panel del equipo</p>
          <h1>Acceso <span class="grad-text">administrativo</span></h1>
          <p class="lede">
            Ingresa con tu cuenta institucional para ver las métricas del test,
            administrar el banco de preguntas y configurar el asesor IA.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="entrar()" novalidate>
          <label class="field">
            <span class="field-label">Correo institucional</span>
            <input type="email" formControlName="correo" autocomplete="username"
                   placeholder="nombre@uniagraria.edu.co" maxlength="150" />
            @if (invalido('correo')) {
              <span class="err">Ingresa un correo válido.</span>
            }
          </label>

          <label class="field">
            <span class="field-label">Contraseña</span>
            <input [type]="verClave() ? 'text' : 'password'" formControlName="password"
                   autocomplete="current-password" maxlength="128" />
            <button type="button" class="ver-clave" (click)="verClave.set(!verClave())">
              {{ verClave() ? 'Ocultar' : 'Mostrar' }}
            </button>
            @if (invalido('password')) {
              <span class="err">Entre 6 y 128 caracteres.</span>
            }
          </label>

          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }

          <button type="submit" class="btn-primary full" [disabled]="cargando()">
            {{ cargando() ? 'Verificando…' : 'Entrar al panel →' }}
          </button>
        </form>

        <div class="login-foot">
          <a routerLink="/" class="btn-ghost small">← Volver al test</a>
          <span class="hint">Requiere rol {{ rolAdmin }}</span>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .login-screen {
        display: grid;
        place-items: center;
        min-height: 70vh;
        padding: 20px 0;
      }
      .login-card {
        width: 100%;
        max-width: 460px;
        padding: 38px 34px 30px;
      }
      .login-head {
        text-align: center;
        margin-bottom: 26px;
      }
      .badge-lock {
        width: 62px;
        height: 62px;
        margin: 0 auto 16px;
        border-radius: 20px;
        display: grid;
        place-items: center;
        font-size: 1.7rem;
        background: var(--grad-brand);
        box-shadow: 0 12px 26px -10px rgba(11, 194, 176, 0.7),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }
      h1 {
        font-size: clamp(1.6rem, 3.4vw, 2.1rem);
        margin-bottom: 10px;
      }
      .lede {
        font-size: 0.96rem;
        margin: 0 auto;
        max-width: 40ch;
      }
      .field {
        display: block;
        position: relative;
        margin-bottom: 18px;
      }
      .ver-clave {
        position: absolute;
        right: 12px;
        top: 31px;
        background: none;
        border: none;
        color: var(--ink-faint);
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        padding: 6px;
      }
      .ver-clave:hover {
        color: var(--uni-green);
      }
      .err {
        display: block;
        color: #ffb4b4;
        font-size: 0.78rem;
        margin-top: 5px;
      }
      .form-error {
        background: rgba(255, 120, 120, 0.1);
        border: 1px solid rgba(255, 120, 120, 0.3);
        border-radius: var(--radius-sm);
        padding: 11px 14px;
        color: #ffc4c4;
        font-size: 0.88rem;
        margin: 0 0 16px;
      }
      .btn-primary.full {
        display: block;
        width: 100%;
      }
      .login-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--rule);
      }
      .hint {
        font-size: 0.8rem;
        color: var(--ink-faint);
      }
    `,
  ],
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly rolAdmin = ROL_ADMIN;
  verClave = signal(false);
  cargando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(128)]],
  });

  invalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  entrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.cargando.set(true);

    const { correo, password } = this.form.getRawValue();
    this.auth.login(correo, password).subscribe((r) => {
      this.cargando.set(false);
      if (!r.ok) {
        this.error.set(r.motivo);
        return;
      }
      if (r.sesion.rol !== ROL_ADMIN) {
        this.auth.logout();
        this.error.set(
          `Tu cuenta tiene el rol "${r.sesion.rol}". El panel requiere ${ROL_ADMIN}.`,
        );
        return;
      }
      const destino = this.route.snapshot.queryParamMap.get('redirect') || '/admin';
      this.router.navigateByUrl(destino);
    });
  }
}
