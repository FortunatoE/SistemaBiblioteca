// inserir-dados.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function inserirDados() {
  try {
    console.log('📝 CONECTANDO AO MYSQL...\n');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Conectado ao MySQL!\n');

    // Dados de exemplo
    const livros = [
      {
        titulo: 'Dom Casmurro',
        autor: 'Machado de Assis',
        isbn: '9788535932875',
        editora: 'Companhia das Letras',
        ano_publicacao: 1899,
        categoria: 'Literatura Brasileira'
      },
      {
        titulo: 'O Cortiço',
        autor: 'Aluísio Azevedo', 
        isbn: '9788572327892',
        editora: 'Penguin Classics',
        ano_publicacao: 1890,
        categoria: 'Literatura Brasileira'
      },
      {
        titulo: 'Clean Code',
        autor: 'Robert C. Martin',
        isbn: '9780132350884',
        editora: 'Pearson',
        ano_publicacao: 2008,
        categoria: 'Programação'
      }
    ];

    console.log('📚 INSERINDO LIVROS NO BANCO...\n');

    for (const livro of livros) {
      const [result] = await connection.execute(
        `INSERT INTO livros (titulo, autor, isbn, editora, ano_publicacao, categoria) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [livro.titulo, livro.autor, livro.isbn, livro.editora, livro.ano_publicacao, livro.categoria]
      );
      
      console.log(`✅ "${livro.titulo}" - ID: ${result.insertId}`);
    }

    console.log('\n🎉 DADOS INSERIDOS COM SUCESSO!');
    console.log('📊 Agora teste no navegador: http://localhost:3000/api/livros');

    await connection.end();
    
  } catch (error) {
    console.log('❌ ERRO:', error.message);
    console.log('💡 Verifique se:');
    console.log('   - MySQL está rodando (XAMPP/WAMP)');
    console.log('   - O banco "biblioteca_universitaria" existe');
    console.log('   - As configurações no arquivo .env estão corretas');
  }
}

// ✅ EXECUTAR A FUNÇÃO
inserirDados();