import { Routes } from '@angular/router';
import { flowGuard } from './core/guards/flow.guard';

/**
 * Cada pantalla del test es una ruta. El `flowGuard` evita que alguien
 * salte a una pantalla para la que aún no completó los pasos previos
 * (p. ej. entrar al quiz sin haber registrado sus datos).
 */
export const routes: Routes = [
  { path: '', redirectTo: 'avatar', pathMatch: 'full' },
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
  {
    path: 'admin',
    title: 'Panel del equipo · Brújula Vocacional',
    loadComponent: () =>
      import('./pages/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'avatar' },
];
