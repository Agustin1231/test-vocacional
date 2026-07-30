import { Routes } from '@angular/router';
import { flowGuard } from './core/guards/flow.guard';
import { adminGuard, loginGuard } from './core/guards/admin.guard';

/**
 * Cada pantalla del test es una ruta. El `flowGuard` evita que alguien
 * salte a una pantalla para la que aún no completó los pasos previos
 * (p. ej. entrar al quiz sin haber registrado sus datos).
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Brújula Vocacional UNIAGRARIA',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'avatar',
    title: 'Crea tu avatar · Brújula Vocacional',
    loadComponent: () =>
      import('./pages/avatar/avatar.component').then((m) => m.AvatarComponent),
  },
  {
    path: 'datos',
    title: 'Tus datos · Brújula Vocacional',
    canActivate: [flowGuard],
    loadComponent: () =>
      import('./pages/datos/datos.component').then((m) => m.DatosComponent),
  },
  {
    path: 'inicio',
    title: 'Comencemos · Brújula Vocacional',
    canActivate: [flowGuard],
    loadComponent: () =>
      import('./pages/hero/hero.component').then((m) => m.HeroComponent),
  },
  {
    path: 'quiz',
    title: 'Test · Brújula Vocacional',
    canActivate: [flowGuard],
    loadComponent: () =>
      import('./pages/quiz/quiz.component').then((m) => m.QuizComponent),
  },
  {
    path: 'resultado',
    title: 'Tu resultado · Brújula Vocacional',
    canActivate: [flowGuard],
    loadComponent: () =>
      import('./pages/report/report.component').then((m) => m.ReportComponent),
  },
  {
    path: 'asesor',
    title: 'Asesor IA · Brújula Vocacional',
    canActivate: [flowGuard],
    loadComponent: () =>
      import('./pages/chat/chat.component').then((m) => m.ChatComponent),
  },
  // ---- Panel de administración ----
  {
    path: 'admin/login',
    title: 'Acceso administrativo · Brújula Vocacional',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./pages/admin/login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Métricas · Panel UNIAGRARIA',
        loadComponent: () =>
          import('./pages/admin/metricas.component').then((m) => m.AdminMetricasComponent),
      },
      {
        path: 'informes',
        title: 'Informes · Panel UNIAGRARIA',
        loadComponent: () =>
          import('./pages/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'preguntas',
        title: 'Preguntas · Panel UNIAGRARIA',
        loadComponent: () =>
          import('./pages/admin/preguntas.component').then((m) => m.AdminPreguntasComponent),
      },
      {
        path: 'agente',
        title: 'Agente IA · Panel UNIAGRARIA',
        loadComponent: () =>
          import('./pages/admin/agente.component').then((m) => m.AdminAgenteComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
