import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcedurepageComponent } from './procedurepage.component';

describe('ProcedurepageComponent', () => {
  let component: ProcedurepageComponent;
  let fixture: ComponentFixture<ProcedurepageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcedurepageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProcedurepageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
