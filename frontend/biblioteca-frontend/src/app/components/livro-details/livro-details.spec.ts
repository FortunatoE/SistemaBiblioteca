import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LivroDetails } from './livro-details';

describe('LivroDetails', () => {
  let component: LivroDetails;
  let fixture: ComponentFixture<LivroDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LivroDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LivroDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
