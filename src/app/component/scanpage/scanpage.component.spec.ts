import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScanpageComponent } from './scanpage.component';

describe('ScanpageComponent', () => {
  let component: ScanpageComponent;
  let fixture: ComponentFixture<ScanpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ScanpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
