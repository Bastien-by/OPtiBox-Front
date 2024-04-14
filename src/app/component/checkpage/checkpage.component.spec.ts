import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckpageComponent } from './checkpage.component';

describe('CheckpageComponent', () => {
  let component: CheckpageComponent;
  let fixture: ComponentFixture<CheckpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CheckpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
