// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./estudio-optimizacion/estudio-optimizacion.component')
      .then(c => c.EstudioOptimizacionComponent)
  },
  { path: '**', redirectTo: '' }
];