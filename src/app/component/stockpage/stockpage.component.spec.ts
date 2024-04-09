import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockpageComponent } from './stockpage.component';

describe('StockpageComponent', () => {
  let component: StockpageComponent;
  let fixture: ComponentFixture<StockpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StockpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
