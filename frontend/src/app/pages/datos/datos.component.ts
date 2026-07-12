import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  FormBuilder, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { TestStateService } from '../../core/services/test-state.service';
import {
  CIUDAD_OPTIONS, DOC_OPTIONS, EDAD_OPTIONS, GRADO_OPTIONS,
} from '../../core/data/form-options.data';
import { Registro } from '../../core/models/test.models';

@Component({
  selector: 'app-datos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="screen animate-in">
      <p class="eyebrow">Paso 2 de 4 · Tus datos</p>
      <h1 class="title">Ingresa tus datos</h1>
      <p class="lede">
        Los necesitamos para generar tu informe y para que un asesor de
        UNIAGRARIA pueda contactarte con la información de tu carrera ideal.
      </p>

      <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Nombre *</span>
            <input type="text" formControlName="nombre" autocomplete="given-name" />
            @if (invalid('nombre')) { <span class="err">Ingresa tu nombre.</span> }
          </label>

          <label class="field">
            <span class="field-label">Apellidos *</span>
            <input type="text" formControlName="apellidos" autocomplete="family-name" />
            @if (invalid('apellidos')) { <span class="err">Ingresa tus apellidos.</span> }
          </label>

          <label class="field">
            <span class="field-label">Tipo de documento *</span>
            <select formControlName="tipoDocumento">
              <option value="" disabled>Selecciona una opción</option>
              @for (o of docs; track o) { <option [value]="o">{{ o }}</option> }
            </select>
          </label>

          <label class="field">
            <span class="field-label">Número de documento *</span>
            <input type="text" inputmode="numeric" formControlName="numeroDocumento" />
            @if (invalid('numeroDocumento')) { <span class="err">Ingresa un número válido.</span> }
          </label>

          <label class="field">
            <span class="field-label">Celular *</span>
            <input type="tel" inputmode="tel" formControlName="celular" autocomplete="tel" />
            @if (invalid('celular')) { <span class="err">Ingresa un celular de 10 dígitos.</span> }
          </label>

          <label class="field">
            <span class="field-label">Correo electrónico *</span>
            <input type="email" formControlName="correo" autocomplete="email" />
            @if (invalid('correo')) { <span class="err">Ingresa un correo válido.</span> }
          </label>

          <label class="field">
            <span class="field-label">Colegio / Institución *</span>
            <input type="text" formControlName="colegio" />
          </label>

          <label class="field">
            <span class="field-label">Grado *</span>
            <select formControlName="grado">
              <option value="" disabled>Selecciona tu grado</option>
              @for (o of grados; track o) { <option [value]="o">{{ o }}</option> }
            </select>
          </label>

          <label class="field">
            <span class="field-label">Ciudad *</span>
            <select formControlName="ciudad">
              <option value="" disabled>Selecciona tu ciudad</option>
              @for (o of ciudades; track o) { <option [value]="o">{{ o }}</option> }
            </select>
          </label>

          <label class="field">
            <span class="field-label">Edad *</span>
            <select formControlName="edad">
              <option value="" disabled>Selecciona tu edad</option>
              @for (o of edades; track o) { <option [value]="o">{{ o }}</option> }
            </select>
          </label>
        </div>

        <label class="consent">
          <input type="checkbox" formControlName="consent" />
          <span>
            Autorizo a UNIAGRARIA para tratar mis datos personales de acuerdo con
            los artículos 5, 7 y concordantes del Decreto 1377 de 2013 y demás
            normativa aplicable.
          </span>
        </label>

        <div class="privacy-note">
          <p>
            <strong>Manejo de tus datos personales.</strong> De manera voluntaria,
            explícita, informada e inequívoca autorizas a la Fundación Universitaria
            Agraria de Colombia — UNIAGRARIA para tratar tus datos personales. Puedes
            consultar el Aviso de privacidad y la Política de tratamiento de datos en
            el sitio oficial.
          </p>
        </div>

        @if (mostrarError) {
          <p class="form-error">Completa todos los campos requeridos y acepta el tratamiento de datos.</p>
        }

        <button type="submit" class="btn-primary big" [disabled]="form.invalid">
          Continuar →
        </button>
      </form>
    </section>
  `,
  styles: [
    `
      .title {
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        margin-bottom: 12px;
      }
      form {
        max-width: 760px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        margin-bottom: 22px;
      }
      .err {
        display: block;
        color: #ffb4b4;
        font-size: 0.74rem;
        margin-top: 5px;
        font-family: 'JetBrains Mono', monospace;
      }
      .consent {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        background: var(--surface);
        border: 1px solid var(--rule);
        border-radius: var(--radius-sm);
        padding: 16px 18px;
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--ink-dim);
        cursor: pointer;
      }
      .consent input {
        margin-top: 3px;
        width: 18px;
        height: 18px;
        accent-color: var(--uni-green);
        flex-shrink: 0;
      }
      .privacy-note {
        margin: 18px 0 6px;
        font-size: 0.82rem;
        line-height: 1.6;
        color: var(--ink-faint);
      }
      .privacy-note strong {
        color: var(--ink-dim);
      }
      .form-error {
        color: #ffb4b4;
        font-size: 0.86rem;
        margin: 6px 0 0;
      }
      .btn-primary.big {
        margin-top: 22px;
      }
      @media (max-width: 620px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DatosComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private state = inject(TestStateService);

  docs = DOC_OPTIONS;
  grados = GRADO_OPTIONS;
  ciudades = CIUDAD_OPTIONS;
  edades = EDAD_OPTIONS;
  mostrarError = false;

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    tipoDocumento: ['', Validators.required],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^[0-9]{5,15}$/)]],
    celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    colegio: ['', Validators.required],
    grado: ['', Validators.required],
    ciudad: ['', Validators.required],
    edad: ['', Validators.required],
    consent: [false, Validators.requiredTrue],
  });

  constructor() {
    // Precarga si el usuario vuelve atrás.
    const reg = this.state.registro();
    if (reg) this.form.patchValue(reg);
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarError = true;
      return;
    }
    const { consent, ...rest } = this.form.getRawValue();
    this.state.setRegistro(rest as Registro);
    this.router.navigate(['/inicio']);
  }
}
