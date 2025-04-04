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

interface EtapaAnalisis {
  etapa: number;
  datos: DatoEtapa[];
}

interface DatoEtapa {
  estado: number;
  valores: number[];
  valorOptimo: number;
  decisionOptima: string;
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

  dias: string[] = [];
  temas: string[] = [];
  etapasAnalisis: EtapaAnalisis[] = [];
  conexionesSVG: { x1: number, x2: number }[] = [];

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
    if (this.estudianteForm.invalid || this.temasForm.invalid) return;

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

          if (response.calendario) {
            this.dias = Object.keys(response.calendario);
            this.temas = Object.keys(response.resumen_temas);
            this.generarTablasAnalisisDinamico();
            this.generarConexionesSVG();
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

  calcularPuntosPorDiaTema(dia: string, tema: string): number {
    if (!this.resultado || !this.resultado.calendario[dia]) return 0;

    const actividadesTema = this.resultado.calendario[dia].filter(act => act.tema === tema);
    if (actividadesTema.length === 0) return 0;

    const horasDedicadas = actividadesTema[0].horas;
    const eficiencia = this.resultado.resumen_temas[tema].eficiencia;
    const dificultad = this.resultado.resumen_temas[tema].dificultad;

    return (horasDedicadas * eficiencia / dificultad) * 10;
  }

  generarTablasAnalisisDinamico(): void {
    if (!this.resultado) return;

    this.etapasAnalisis = [];
    const diasDisponibles = this.dias.length;

    for (let s = 0; s < this.temas.length; s++) {
      const etapa: EtapaAnalisis = {
        etapa: s + 1,
        datos: []
      };

      for (let i = 1; i <= diasDisponibles; i++) {
        const dato: DatoEtapa = {
          estado: i,
          valores: [],
          valorOptimo: 0,
          decisionOptima: ""
        };

        for (let j = 1; j <= 4; j++) {
          const valorSimulado = this.calcularValorSimulado(s, i, j);
          dato.valores.push(valorSimulado);

          if (valorSimulado > dato.valorOptimo) {
            dato.valorOptimo = valorSimulado;
            dato.decisionOptima = j.toString();
          }
        }

        etapa.datos.push(dato);
      }

      this.etapasAnalisis.push(etapa);
    }
  }

  calcularValorSimulado(etapa: number, estado: number, decision: number): number {
    const tema = this.temas[etapa];
    if (!tema) return 0;

    const eficiencia = this.resultado?.resumen_temas[tema]?.eficiencia || 5;
    const dificultad = this.resultado?.resumen_temas[tema]?.dificultad || 5;
    const peso = this.resultado?.resumen_temas[tema]?.peso || 20;

    return Math.round((decision * eficiencia * peso / dificultad) * Math.sqrt(estado));
  }

  esDecisionOptima(etapa: number, estadoIndex: number, decisionIndex: number): boolean {
    const dato = this.etapasAnalisis[etapa]?.datos[estadoIndex];
    return dato?.decisionOptima === (decisionIndex + 1).toString();
  }

  esMejorResultado(etapa: number, estadoIndex: number, decisionIndex: number): boolean {
    const dato = this.etapasAnalisis[etapa]?.datos[estadoIndex];
    const valor = dato?.valores[decisionIndex];
    return valor === dato?.valorOptimo && dato?.decisionOptima === (decisionIndex + 1).toString();
  }

  obtenerValorTabla(etapa: number, estadoIndex: number, decisionIndex: number): number {
    return this.etapasAnalisis[etapa]?.datos[estadoIndex]?.valores[decisionIndex] || 0;
  }

  generarConexionesSVG(): void {
    this.conexionesSVG = [];
    for (let i = 0; i < this.dias.length - 1; i++) {
      const x1 = 130 + i * 150;
      const x2 = 70 + (i + 1) * 150;
      this.conexionesSVG.push({ x1, x2 });
    }
  }
}
