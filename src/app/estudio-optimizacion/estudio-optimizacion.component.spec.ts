import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstudioOptimizacionComponent } from './estudio-optimizacion.component';

describe('EstudioOptimizacionComponent', () => {
  let component: EstudioOptimizacionComponent;
  let fixture: ComponentFixture<EstudioOptimizacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstudioOptimizacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstudioOptimizacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
