import { Component, OnInit } from '@angular/core';
import { LivroService, Livro } from '../../services/livro.service';

@Component({
  selector: 'app-livro-list',
  templateUrl: './livro-list.component.html',
  styleUrls: ['./livro-list.component.css']
})
export class LivroListComponent implements OnInit {
  livros: Livro[] = [];
  carregando: boolean = true;
  erro: string = '';

  constructor(private livroService: LivroService) { }

  ngOnInit(): void {
    this.carregarLivros();
  }

  carregarLivros(): void {
    this.carregando = true;
    this.erro = '';
    
    this.livroService.getLivros().subscribe({
      next: (response) => {
        this.livros = response.data;
        this.carregando = false;
      },
      error: (error) => {
        console.error('Erro ao carregar livros:', error);
        this.erro = 'Erro ao carregar livros. Verifique se o servidor está rodando.';
        this.carregando = false;
      }
    });
  }

  get totalLivros(): number {
    return this.livros.length;
  }

  get livrosDisponiveis(): number {
    return this.livros.filter(livro => livro.quantidade_disponivel && livro.quantidade_disponivel > 0).length;
  }
}