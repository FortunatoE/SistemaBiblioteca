import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LivroList } from './livro-list';

describe('LivroList', () => {
  let component: LivroList;
  let fixture: ComponentFixture<LivroList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LivroList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LivroList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
