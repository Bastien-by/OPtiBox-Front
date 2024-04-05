import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LightpageComponent } from './lightpage.component';

describe('LightpageComponent', () => {
  let component: LightpageComponent;
  let fixture: ComponentFixture<LightpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LightpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
