import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenlockerComponent } from './openlocker.component';

describe('OpenlockerComponent', () => {
  let component: OpenlockerComponent;
  let fixture: ComponentFixture<OpenlockerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpenlockerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OpenlockerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
