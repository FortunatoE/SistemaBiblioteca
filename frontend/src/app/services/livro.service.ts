import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Livro {
  id: number;
  titulo: string;
  autor: string;
  isbn?: string;
  editora?: string;
  ano_publicacao?: number;
  categoria?: string;
  quantidade_disponivel?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LivroService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getLivros(): Observable<any> {
    return this.http.get(`${this.apiUrl}/livros`);
  }

  getLivro(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/livros/${id}`);
  }

  criarLivro(livro: Livro): Observable<any> {
    return this.http.post(`${this.apiUrl}/livros`, livro);
  }
}