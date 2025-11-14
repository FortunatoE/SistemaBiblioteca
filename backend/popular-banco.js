// popular-banco.js - VERSÃO CORRIGIDA
require('dotenv').config();
const mysql = require('mysql2/promise');

async function popularBanco() {
  let connection;
  
  try {
    console.log('📝 Populando banco com dados de teste...\n');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // 1. PRIMEIRO: Limpar tabelas (opcional - remove se quiser dados frescos)
    console.log('🧹 Limpando tabelas...');
    await connection.execute('DELETE FROM reservas');
    await connection.execute('DELETE FROM emprestimos');
    await connection.execute('DELETE FROM usuarios');
    await connection.execute('DELETE FROM livros');
    await connection.execute('ALTER TABLE usuarios AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE livros AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE emprestimos AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE reservas AUTO_INCREMENT = 1');

    // 2. Inserir usuários de exemplo e PEGAR OS IDs
    console.log('👥 Inserindo usuários...');
    await connection.execute(`
      INSERT INTO usuarios (matricula, nome, email, tipo) VALUES 
      ('20240001', 'Ana Silva', 'ana.silva@email.com', 'aluno'),
      ('20240002', 'Carlos Oliveira', 'carlos.oliveira@email.com', 'aluno'),
      ('20240003', 'Mariana Santos', 'mariana.santos@email.com', 'aluno'),
      ('PROF001', 'Dr. João Pereira', 'joao.pereira@email.com', 'professor'),
      ('PROF002', 'Dra. Maria Costa', 'maria.costa@email.com', 'professor'),
      ('FUNC001', 'Roberto Alves', 'roberto.alves@email.com', 'funcionario')
    `);

    // 3. Inserir livros
    console.log('📚 Inserindo livros...');
    await connection.execute(`
      INSERT INTO livros (isbn, titulo, autor, editora, ano_publicacao, categoria, quantidade_total, quantidade_disponivel) VALUES 
      ('9788535902775', 'Dom Casmurro', 'Machado de Assis', 'Companhia das Letras', 1899, 'Literatura Brasileira', 5, 3),
      ('9788572327892', 'O Cortiço', 'Aluísio Azevedo', 'Penguin Classics', 1890, 'Literatura Brasileira', 3, 2),
      ('9780132350884', 'Clean Code', 'Robert C. Martin', 'Pearson', 2008, 'Programação', 8, 5),
      ('9788595086352', 'Arquitetura Limpa', 'Robert C. Martin', 'Alta Books', 2018, 'Programação', 6, 4),
      ('9788575225637', 'Introdução à Programação', 'André Duarte', 'Novatec', 2020, 'Programação', 10, 8),
      ('9788543105746', 'O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Agir', 1943, 'Literatura Estrangeira', 7, 6)
    `);

    // 4. AGORA inserir empréstimos usando IDs conhecidos
    console.log('📖 Inserindo empréstimos...');
    await connection.execute(`
      INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo, data_devolucao_prevista, status) VALUES 
      (1, 1, '2024-01-10', '2024-01-25', 'ativo'),
      (2, 3, '2024-01-15', '2024-01-30', 'ativo'),
      (3, 2, '2024-01-05', '2024-01-20', 'devolvido'),
      (4, 4, '2024-01-12', '2024-01-27', 'ativo')
    `);

    // 5. Inserir reservas
    console.log('📅 Inserindo reservas...');
    await connection.execute(`
      INSERT INTO reservas (usuario_id, livro_id, data_expiracao, status) VALUES 
      (2, 1, '2024-01-28', 'ativa'),
      (5, 3, '2024-01-29', 'ativa')
    `);

    console.log('\n🎉 BANCO POPULADO COM SUCESSO!');
    console.log('📊 Dados inseridos:');
    console.log('   👥 6 usuários');
    console.log('   📚 6 livros'); 
    console.log('   📖 4 empréstimos');
    console.log('   📅 2 reservas');
    
    // Verificar os dados inseridos
    console.log('\n🔍 Verificando dados inseridos...');
    
    const [usuarios] = await connection.execute('SELECT COUNT(*) as total FROM usuarios');
    const [livros] = await connection.execute('SELECT COUNT(*) as total FROM livros');
    const [emprestimos] = await connection.execute('SELECT COUNT(*) as total FROM emprestimos');
    const [reservas] = await connection.execute('SELECT COUNT(*) as total FROM reservas');
    
    console.log(`   ✅ Usuários: ${usuarios[0].total}`);
    console.log(`   ✅ Livros: ${livros[0].total}`);
    console.log(`   ✅ Empréstimos: ${emprestimos[0].total}`);
    console.log(`   ✅ Reservas: ${reservas[0].total}`);
    
  } catch (error) {
    console.log('❌ ERRO ao popular banco:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

popularBanco();