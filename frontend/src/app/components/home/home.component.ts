import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  titulo = 'Sistema de Biblioteca Universitária';
  descricao = 'Gerencie o acervo de livros da sua biblioteca de forma eficiente';
}