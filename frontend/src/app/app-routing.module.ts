import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LivroListComponent } from './components/livro-list/livro-list.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'livros', component: LivroListComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }