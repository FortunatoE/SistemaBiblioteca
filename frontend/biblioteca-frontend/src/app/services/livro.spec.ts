import { TestBed } from '@angular/core/testing';

import { Livro } from './livro';

describe('Livro', () => {
  let service: Livro;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Livro);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
