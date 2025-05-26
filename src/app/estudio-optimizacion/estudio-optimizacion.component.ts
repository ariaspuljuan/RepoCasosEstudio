import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { CommonModule } from '@angular/common';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

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

interface ResultadoCursos {
  puntuacion_total: number;
  asignacion: {
    curso: string;
    dias: number;
  }[];
  tabla_decisiones: {
    dia: number;
    curso: string;
    dias_acumulados: number;
    puntuacion: number;
  }[];
  puntuaciones_cursos: {
    curso: string;
    dias_asignados: number;
    puntuacion: number;
  }[];
  tabla_puntuaciones: number[][];
  distribucion_dias: {
    [key: string]: number;
  };
  contribucion_porcentual: {
    [key: string]: number;
  };
  estados_explorados: {
    dias_restantes: number;
    asignados: number[];
    mejor_puntuacion: number;
    mejor_decision: number | null;
  }[];
  total_estados_explorados: number;
  tablas_etapas: {
    etapa: number;
    curso: string;
    filas: {
      estado: number;
      decisiones: {
        dias: number;
        valor: number;
        calculo: string;
      }[];
      valor_optimo: number;
      decision_optima: number;
    }[];
  }[];
  descripcion: string;
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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HttpClientModule],
  templateUrl: './estudio-optimizacion.component.html',
  styleUrls: ['./estudio-optimizacion.component.scss']
})
export class EstudioOptimizacionComponent implements OnInit, AfterViewInit {
  @ViewChild('rutaOptimaCanvas') rutaOptimaCanvas: ElementRef | undefined;
  estudianteForm: FormGroup;
  temasForm: FormGroup;
  formulario: FormGroup;
  resultado: ResultadoOptimizacion | null = null;
  resultadoCursos: ResultadoCursos | null = null;
  rutaOptimaChart: Chart | undefined;
  calculando: boolean = false;
  error: string | null = null;

  dias: string[] = [];
  temas: string[] = [];
  etapasAnalisis: EtapaAnalisis[] = [];
  conexionesSVG: { x1: number, x2: number }[] = [];

  // Tabla de puntuaciones editable
  tablaPuntuaciones: number[][] = [
    [5, 4, 5, 7],  // 1 día
    [6, 6, 6, 8],  // 2 días
    [7, 6, 7, 9],  // 3 días
    [9, 8, 8, 10]  // 4 días
  ];

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
    
    this.formulario = this.fb.group({
      diasDisponibles: [7, [Validators.required, Validators.min(4), Validators.max(20)]]
    });
  }

  ngOnInit(): void {
    this.agregarTema('Matemáticas', 30, 8, 6);
    this.agregarTema('Física', 25, 7, 5);
    this.agregarTema('Programación', 25, 6, 8);
    this.agregarTema('Historia', 20, 4, 7);
  }
  
  ngAfterViewInit(): void {
    // El canvas podría no estar disponible inicialmente
    if (this.resultadoCursos && this.rutaOptimaCanvas) {
      this.crearGrafoRutaOptima();
    }
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

  calcularOptimizacionCursos(): void {
    this.calculando = true;
    this.error = null;
    
    // Obtenemos los valores de la tabla de puntuaciones
    const puntuaciones = this.obtenerTablaPuntuaciones();
    
    // Preparamos los datos para enviar al backend
    const datos = {
      dias_disponibles: this.formulario.get('diasDisponibles')?.value,
      puntuaciones: puntuaciones,
      dias_minimos: 1,
      dias_maximos: 4
    };
    
    // Enviamos los datos al backend
    this.http.post<ResultadoCursos>('http://localhost:5000/api/optimizar-cursos', datos)
      .subscribe({
        next: (response) => {
          this.resultadoCursos = response;
          this.calculando = false;
          console.log('Resultado:', this.resultadoCursos);
          
          // Una vez que tenemos los resultados, creamos el grafo de ruta óptima
          setTimeout(() => {
            this.crearGrafoRutaOptima();
          }, 100);
        },
        error: (error) => {
          this.error = 'Error al calcular la optimización: ' + (error.error?.error || error.message);
          this.calculando = false;
          console.error('Error al calcular la optimización:', error);
        }
      });
  }

  obtenerTablaPuntuaciones(): number[][] {
    return this.tablaPuntuaciones;
  }

  crearGrafoRutaOptima(): void {
    if (!this.resultadoCursos || !this.rutaOptimaCanvas) return;

    // Destruir el gráfico anterior si existe
    if (this.rutaOptimaChart) {
      this.rutaOptimaChart.destroy();
    }

    const ctx = this.rutaOptimaCanvas.nativeElement.getContext('2d');

    // Preparar los datos para el grafo
    const etapas = this.resultadoCursos.tablas_etapas;

    // Crear nodos y conexiones para el grafo
    const nodos: {x: number, y: number, label: string, estado: number, etapa: number}[] = [];
    const conexiones: {from: number, to: number, label: string}[] = [];

    // Crear un mapa para rastrear la ruta óptima
    const rutaOptima = new Map<string, number>();

    // Obtener la asignación óptima
    const asignacionOptima = this.resultadoCursos.asignacion.map(a => a.dias);

    // Calcular los días disponibles iniciales
    const diasDisponiblesIniciales = this.formulario.get('diasDisponibles')?.value;

    // Crear nodos para cada etapa y estado
    let diasRestantes = diasDisponiblesIniciales;
    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i];

      // Encontrar la fila correspondiente al estado actual (días restantes)
      const filaActual = etapa.filas.find(f => f.estado === diasRestantes);

      if (filaActual) {
        // Guardar la decisión óptima para este estado
        rutaOptima.set(`${i}_${diasRestantes}`, filaActual.decision_optima);

        // Actualizar los días restantes para la siguiente etapa
        diasRestantes -= filaActual.decision_optima;
      }
    }

    // Preparar datos para el gráfico
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    // Añadir el estado inicial
    labels.push(`Estado Inicial (${diasDisponiblesIniciales} días)`);
    data.push(0);
    backgroundColors.push('rgba(54, 162, 235, 0.2)');

    // Añadir cada decisión en la ruta óptima
    diasRestantes = diasDisponiblesIniciales;
    let puntuacionAcumulada = 0;

    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i];
      const decision = rutaOptima.get(`${i}_${diasRestantes}`) || 0;

      if (decision > 0) {
        // Calcular la puntuación para esta decisión
        const puntuacion = this.resultadoCursos.tabla_puntuaciones[decision-1][i];
        puntuacionAcumulada += puntuacion;

        labels.push(`${etapa.curso}: ${decision} día(s) → ${puntuacionAcumulada} pts`);
        data.push(puntuacionAcumulada);
        backgroundColors.push('rgba(75, 192, 192, 0.2)');

        // Actualizar días restantes
        diasRestantes -= decision;
      }
    }

    // Crear el gráfico
    this.rutaOptimaChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Puntuación Acumulada',
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          pointBackgroundColor: backgroundColors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Ruta Óptima de Decisiones',
            font: {
              size: 16
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Puntuación: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Puntuación Acumulada'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Etapas de Decisión'
            }
          }
        }
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
