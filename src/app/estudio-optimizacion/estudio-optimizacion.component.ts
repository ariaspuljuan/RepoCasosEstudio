// estudio-optimizacion.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Tema {
  nombre: string;
  peso: number;
  dificultad: number;
  eficiencia: number;
}

interface ResultadoOptimizacion {
  status: string;
  nota_esperada: number;
  calendario: {
    [key: string]: {
      tema: string;
      horas: number;
    }[];
  };
  resumen_temas: {
    [key: string]: {
      horas_totales: number;
      peso: number;
      dificultad: number;
      eficiencia: number;
    };
  };
}

@Component({
  selector: 'app-estudio-optimizacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './estudio-optimizacion.component.html',
  styleUrls: ['./estudio-optimizacion.component.scss']
})
export class EstudioOptimizacionComponent implements OnInit {
  estudianteForm: FormGroup;
  temasForm: FormGroup;
  resultado: ResultadoOptimizacion | null = null;
  calculando: boolean = false;
  error: string | null = null;
  
  // Para la visualización del calendario
  dias: string[] = [];
  temas: string[] = [];
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.estudianteForm = this.fb.group({
      dias_disponibles: [5, [Validators.required, Validators.min(1), Validators.max(30)]],
      tiempo_por_dia: [8, [Validators.required, Validators.min(1), Validators.max(24)]]
    });
    
    this.temasForm = this.fb.group({
      temas: this.fb.array([])
    });
  }
  
  ngOnInit(): void {
    // Agregar algunos temas por defecto
    this.agregarTema('Matemáticas', 30, 8, 6);
    this.agregarTema('Física', 25, 7, 5);
    this.agregarTema('Programación', 25, 6, 8);
    this.agregarTema('Historia', 20, 4, 7);
  }
  
  get temasArray(): FormArray {
    return this.temasForm.get('temas') as FormArray;
  }
  
  agregarTema(nombre: string = '', peso: number = 0, dificultad: number = 5, eficiencia: number = 5): void {
    this.temasArray.push(
      this.fb.group({
        nombre: [nombre, Validators.required],
        peso: [peso, [Validators.required, Validators.min(0), Validators.max(100)]],
        dificultad: [dificultad, [Validators.required, Validators.min(1), Validators.max(10)]],
        eficiencia: [eficiencia, [Validators.required, Validators.min(1), Validators.max(10)]]
      })
    );
  }
  
  eliminarTema(index: number): void {
    this.temasArray.removeAt(index);
  }
  
  calcularOptimizacion(): void {
    if (this.estudianteForm.invalid || this.temasForm.invalid) {
      return;
    }
    
    this.calculando = true;
    this.error = null;
    this.resultado = null;
    
    const formData = {
      dias_disponibles: this.estudianteForm.value.dias_disponibles,
      tiempo_por_dia: this.estudianteForm.value.tiempo_por_dia,
      temas: this.temasArray.value.map((t: Tema) => t.nombre),
      pesos_temas: this.temasArray.value.map((t: Tema) => t.peso),
      dificultad_temas: this.temasArray.value.map((t: Tema) => t.dificultad),
      eficiencia_temas: this.temasArray.value.map((t: Tema) => t.eficiencia)
    };
    
    this.http.post<ResultadoOptimizacion>('http://localhost:5000/api/optimizar', formData)
      .subscribe({
        next: (response) => {
          this.resultado = response;
          this.calculando = false;
          
          // Preparar datos para visualización
          if (response.calendario) {
            this.dias = Object.keys(response.calendario);
            this.temas = Object.keys(response.resumen_temas);
          }
        },
        error: (error) => {
          this.error = 'Error al calcular la optimización: ' + (error.error?.error || error.message);
          this.calculando = false;
        }
      });
  }
  
  verificarPesoTotal(): number {
    return this.temasArray.value.reduce((sum: number, tema: Tema) => sum + tema.peso, 0);
  }
  
  reiniciar(): void {
    this.resultado = null;
  }
}