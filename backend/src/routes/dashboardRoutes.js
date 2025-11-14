// src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { mysqlPool } = require('../config/database');

// GET /api/dashboard/estatisticas - Estatísticas do dashboard
router.get('/estatisticas', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    // Total de livros
    const [totalLivros] = await connection.execute('SELECT COUNT(*) as total FROM livros');
    
    // Empréstimos ativos
    const [emprestimosAtivos] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo"'
    );
    
    // Reservas ativas
    const [reservasAtivas] = await connection.execute(
      'SELECT COUNT(*) as total FROM reservas WHERE status = "ativa"'
    );
    
    // Empréstimos em atraso
    const [emprestimosAtraso] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo" AND data_devolucao_prevista < CURDATE()'
    );
    
    // Total de usuários
    const [totalUsuarios] = await connection.execute('SELECT COUNT(*) as total FROM usuarios WHERE ativo = true');
    
    // Livros disponíveis
    const [livrosDisponiveis] = await connection.execute(
      'SELECT SUM(quantidade_disponivel) as total FROM livros'
    );

    connection.release();

    res.json({
      success: true,
      data: {
        total_livros: totalLivros[0].total,
        emprestimos_ativos: emprestimosAtivos[0].total,
        reservas_ativas: reservasAtivas[0].total,
        emprestimos_atraso: emprestimosAtraso[0].total,
        total_usuarios: totalUsuarios[0].total,
        livros_disponiveis: livrosDisponiveis[0].total || 0
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar estatísticas',
      message: error.message
    });
  }
});

// GET /api/dashboard/emprestimos-recentes - Empréstimos recentes
router.get('/emprestimos-recentes', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [emprestimos] = await connection.execute(`
      SELECT 
        e.id,
        u.nome as usuario,
        l.titulo as livro,
        e.data_emprestimo,
        e.data_devolucao_prevista,
        e.status
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      INNER JOIN livros l ON e.livro_id = l.id
      ORDER BY e.data_emprestimo DESC
      LIMIT 10
    `);

    connection.release();

    res.json({
      success: true,
      data: emprestimos
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar empréstimos recentes',
      message: error.message
    });
  }
});

module.exports = router;