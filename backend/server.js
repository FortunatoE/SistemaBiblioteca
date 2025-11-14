// server.js - VERSÃO SUPER SIMPLIFICADA E 100% FUNCIONAL
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Configuração do MySQL
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const mysqlPool = mysql.createPool(dbConfig);



// ========== ROTAS DE EMPRÉSTIMOS ==========

// Listar todos os empréstimos
app.get('/api/emprestimos', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [emprestimos] = await connection.execute(`
      SELECT 
        e.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        l.titulo as livro_titulo,
        l.autor as livro_autor
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      INNER JOIN livros l ON e.livro_id = l.id
      ORDER BY e.data_emprestimo DESC
    `);
    
    connection.release();

    res.json({
      success: true,
      data: emprestimos,
      total: emprestimos.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empréstimos',
      message: error.message
    });
  }
});

// Buscar empréstimo por ID
app.get('/api/emprestimos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysqlPool.getConnection();
    
    const [emprestimos] = await connection.execute(`
      SELECT 
        e.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.quantidade_disponivel
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      INNER JOIN livros l ON e.livro_id = l.id
      WHERE e.id = ?
    `, [id]);
    
    connection.release();

    if (emprestimos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Empréstimo não encontrado'
      });
    }

    res.json({
      success: true,
      data: emprestimos[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empréstimo',
      message: error.message
    });
  }
});

// Realizar novo empréstimo
app.post('/api/emprestimos', async (req, res) => {
  try {
    const { usuario_id, livro_id, data_devolucao_prevista } = req.body;
    
    // Validações
    if (!usuario_id || !livro_id) {
      return res.status(400).json({
        success: false,
        error: 'Usuário e livro são obrigatórios'
      });
    }

    const connection = await mysqlPool.getConnection();
    
    // Verificar se usuário existe e está ativo
    const [usuario] = await connection.execute(
      'SELECT id, nome FROM usuarios WHERE id = ? AND ativo = true',
      [usuario_id]
    );
    
    if (usuario.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Usuário não encontrado ou inativo'
      });
    }

    // Verificar se livro existe e está disponível
    const [livro] = await connection.execute(
      'SELECT id, titulo, quantidade_disponivel FROM livros WHERE id = ? AND quantidade_disponivel > 0',
      [livro_id]
    );
    
    if (livro.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Livro não encontrado ou indisponível'
      });
    }

    // Verificar se usuário já tem este livro emprestado
    const [emprestimoAtivo] = await connection.execute(
      'SELECT id FROM emprestimos WHERE usuario_id = ? AND livro_id = ? AND status = "ativo"',
      [usuario_id, livro_id]
    );
    
    if (emprestimoAtivo.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Usuário já possui este livro emprestado'
      });
    }

    // Calcular data de devolução (15 dias se não informada)
    const dataDevolucao = data_devolucao_prevista 
      ? new Date(data_devolucao_prevista)
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // +15 dias

    // Iniciar transação
    await connection.beginTransaction();

    try {
      // Criar empréstimo
      const [result] = await connection.execute(
        `INSERT INTO emprestimos 
         (usuario_id, livro_id, data_emprestimo, data_devolucao_prevista, status) 
         VALUES (?, ?, CURDATE(), ?, 'ativo')`,
        [usuario_id, livro_id, dataDevolucao.toISOString().split('T')[0]]
      );

      // Atualizar quantidade disponível do livro
      await connection.execute(
        'UPDATE livros SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = ?',
        [livro_id]
      );

      // Commit da transação
      await connection.commit();

      // Buscar empréstimo criado com dados completos
      const [novoEmprestimo] = await connection.execute(`
        SELECT 
          e.*,
          u.nome as usuario_nome,
          u.matricula as usuario_matricula,
          l.titulo as livro_titulo,
          l.autor as livro_autor
        FROM emprestimos e
        INNER JOIN usuarios u ON e.usuario_id = u.id
        INNER JOIN livros l ON e.livro_id = l.id
        WHERE e.id = ?
      `, [result.insertId]);

      connection.release();

      res.status(201).json({
        success: true,
        data: novoEmprestimo[0],
        message: 'Empréstimo realizado com sucesso!'
      });

    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao realizar empréstimo',
      message: error.message
    });
  }
});

// Registrar devolução
app.put('/api/emprestimos/:id/devolucao', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se empréstimo existe e está ativo
    const [emprestimo] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ? AND status = "ativo"',
      [id]
    );
    
    if (emprestimo.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Empréstimo não encontrado ou já devolvido'
      });
    }

    const emprestimoData = emprestimo[0];

    // Iniciar transação
    await connection.beginTransaction();

    try {
      // Calcular multa se houver atraso
      const hoje = new Date();
      const dataPrevista = new Date(emprestimoData.data_devolucao_prevista);
      let multa = 0;

      if (hoje > dataPrevista) {
        const diasAtraso = Math.ceil((hoje - dataPrevista) / (1000 * 60 * 60 * 24));
        multa = diasAtraso * 2.0; // R$ 2,00 por dia de atraso
      }

      // Atualizar empréstimo
      await connection.execute(
        `UPDATE emprestimos 
         SET data_devolucao_efetiva = CURDATE(), status = 'devolvido', multa = ?
         WHERE id = ?`,
        [multa, id]
      );

      // Devolver livro ao acervo
      await connection.execute(
        'UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?',
        [emprestimoData.livro_id]
      );

      // Commit da transação
      await connection.commit();

      // Buscar empréstimo atualizado
      const [emprestimoAtualizado] = await connection.execute(`
        SELECT 
          e.*,
          u.nome as usuario_nome,
          u.matricula as usuario_matricula,
          l.titulo as livro_titulo,
          l.autor as livro_autor
        FROM emprestimos e
        INNER JOIN usuarios u ON e.usuario_id = u.id
        INNER JOIN livros l ON e.livro_id = l.id
        WHERE e.id = ?
      `, [id]);

      connection.release();

      res.json({
        success: true,
        data: emprestimoAtualizado[0],
        message: multa > 0 
          ? `Devolução registrada com multa de R$ ${multa.toFixed(2)}` 
          : 'Devolução registrada com sucesso!'
      });

    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar devolução',
      message: error.message
    });
  }
});

// Empréstimos ativos por usuário
app.get('/api/usuarios/:id/emprestimos-ativos', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysqlPool.getConnection();
    
    const [emprestimos] = await connection.execute(`
      SELECT 
        e.*,
        l.titulo as livro_titulo,
        l.autor as livro_autor
      FROM emprestimos e
      INNER JOIN livros l ON e.livro_id = l.id
      WHERE e.usuario_id = ? AND e.status = 'ativo'
      ORDER BY e.data_devolucao_prevista ASC
    `, [id]);
    
    connection.release();

    res.json({
      success: true,
      data: emprestimos,
      total: emprestimos.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empréstimos do usuário',
      message: error.message
    });
  }
});

// ========== ROTAS PRINCIPAIS ==========

// Rota de livros (já existente)
app.get('/api/livros', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    const [livros] = await connection.execute('SELECT * FROM livros');
    connection.release();
    
    res.json({
      success: true,
      data: livros,
      total: livros.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar livros',
      message: error.message
    });
  }
});

// Dashboard - Estatísticas
app.get('/api/dashboard/estatisticas', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    // Total de livros
    const [totalLivros] = await connection.execute('SELECT COUNT(*) as total FROM livros');
    
    // Empréstimos ativos
    const [emprestimosAtivos] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo"'
    );
    
   // Reservas ativas (adicionar ao código existente)
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
        reservas_ativas: reservasAtivas[0].total, // ← NOVO CAMPO
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

// Dashboard - Empréstimos recentes
app.get('/api/dashboard/emprestimos-recentes', async (req, res) => {
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

// ========== ROTAS DE RESERVAS ==========

// Listar todas as reservas
app.get('/api/reservas', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [reservas] = await connection.execute(`
      SELECT 
        r.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        u.email as usuario_email,
        u.tipo as usuario_tipo,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.quantidade_disponivel,
        l.categoria as livro_categoria,
        l.localizacao as livro_localizacao
      FROM reservas r
      INNER JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN livros l ON r.livro_id = l.id
      ORDER BY r.data_reserva DESC, r.status
    `);
    
    connection.release();

    res.json({
      success: true,
      data: reservas,
      total: reservas.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar reservas',
      message: error.message
    });
  }
});

// Buscar reserva por ID
app.get('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysqlPool.getConnection();
    
    const [reservas] = await connection.execute(`
      SELECT 
        r.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        u.email as usuario_email,
        u.tipo as usuario_tipo,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.quantidade_disponivel,
        l.categoria as livro_categoria,
        l.localizacao as livro_localizacao
      FROM reservas r
      INNER JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN livros l ON r.livro_id = l.id
      WHERE r.id = ?
    `, [id]);
    
    connection.release();

    if (reservas.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada'
      });
    }

    res.json({
      success: true,
      data: reservas[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar reserva',
      message: error.message
    });
  }
});

// Criar nova reserva
app.post('/api/reservas', async (req, res) => {
  try {
    const { usuario_id, livro_id, data_validade, observacoes } = req.body;
    
    // Validações
    if (!usuario_id || !livro_id || !data_validade) {
      return res.status(400).json({
        success: false,
        error: 'Usuário, livro e data de validade são obrigatórios'
      });
    }

    const connection = await mysqlPool.getConnection();
    
    // Verificar se usuário existe e está ativo
    const [usuario] = await connection.execute(
      'SELECT id, nome, matricula FROM usuarios WHERE id = ? AND ativo = true',
      [usuario_id]
    );
    
    if (usuario.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Usuário não encontrado ou inativo'
      });
    }

    // Verificar se livro existe
    const [livro] = await connection.execute(
      'SELECT id, titulo, autor, quantidade_disponivel FROM livros WHERE id = ?',
      [livro_id]
    );
    
    if (livro.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Livro não encontrado'
      });
    }

    // Verificar se livro está disponível
    if (livro[0].quantidade_disponivel === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Livro não está disponível para reserva'
      });
    }

    // Verificar se já existe reserva ativa para o mesmo livro
    const [reservaLivro] = await connection.execute(
      'SELECT id FROM reservas WHERE livro_id = ? AND status = "ativa"',
      [livro_id]
    );
    
    if (reservaLivro.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Este livro já possui uma reserva ativa'
      });
    }

    // Verificar se usuário já tem reserva ativa para o mesmo livro
    const [reservaUsuario] = await connection.execute(
      'SELECT id FROM reservas WHERE usuario_id = ? AND livro_id = ? AND status = "ativa"',
      [usuario_id, livro_id]
    );
    
    if (reservaUsuario.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Usuário já possui uma reserva ativa para este livro'
      });
    }

// No server.js, na rota POST /api/reservas, atualize a validação de datas:

// Validar data de validade - VERSÃO CORRIGIDA
const dataValidade = new Date(data_validade);
const dataReserva = new Date(data_reserva); // usa a data da reserva que o usuário escolheu

// Verificar se as datas são válidas
if (isNaN(dataValidade.getTime()) || isNaN(dataReserva.getTime())) {
    connection.release();
    return res.status(400).json({
        success: false,
        error: 'Datas fornecidas são inválidas'
    });
}

// Verificar se data de validade é posterior à data da reserva
if (dataValidade <= dataReserva) {
    connection.release();
    return res.status(400).json({
        success: false,
        error: 'Data de validade deve ser posterior à data da reserva'
    });
}

// Calcular diferença em dias CORRETAMENTE
const umDiaMs = 1000 * 60 * 60 * 24;
const diferencaMs = dataValidade.getTime() - dataReserva.getTime();
const diferencaDias = Math.floor(diferencaMs / umDiaMs); // Usar Math.floor para cálculo exato

console.log(`Validação datas: Reserva=${data_reserva}, Validade=${data_validade}, Diferença=${diferencaDias} dias`);

if (diferencaDias > 7) {
    connection.release();
    return res.status(400).json({
        success: false,
        error: `Data de validade não pode ser maior que 7 dias a partir da data da reserva. Período selecionado: ${diferencaDias} dias`
    });
}

if (diferencaDias < 1) {
    connection.release();
    return res.status(400).json({
        success: false,
        error: 'Data de validade deve ser de pelo menos 1 dia a partir da data da reserva'
    });
}

    // Iniciar transação
    await connection.beginTransaction();

    try {
      // Criar reserva
const [result] = await connection.execute(
    `INSERT INTO reservas 
     (usuario_id, livro_id, data_reserva, data_validade, observacoes, status) 
     VALUES (?, ?, ?, ?, ?, 'ativa')`,
    [usuario_id, livro_id, data_reserva, data_validade, observacoes || null]
);
      // Commit da transação
      await connection.commit();

      // Buscar reserva criada com dados completos
      const [novaReserva] = await connection.execute(`
        SELECT 
          r.*,
          u.nome as usuario_nome,
          u.matricula as usuario_matricula,
          u.email as usuario_email,
          u.tipo as usuario_tipo,
          l.titulo as livro_titulo,
          l.autor as livro_autor,
          l.quantidade_disponivel,
          l.categoria as livro_categoria,
          l.localizacao as livro_localizacao
        FROM reservas r
        INNER JOIN usuarios u ON r.usuario_id = u.id
        INNER JOIN livros l ON r.livro_id = l.id
        WHERE r.id = ?
      `, [result.insertId]);

      connection.release();

      res.status(201).json({
        success: true,
        data: novaReserva[0],
        message: 'Reserva realizada com sucesso!'
      });

    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao realizar reserva',
      message: error.message
    });
  }
});

// Atualizar reserva
app.put('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, data_validade, observacoes } = req.body;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se reserva existe
    const [reservaExistente] = await connection.execute(
      'SELECT id FROM reservas WHERE id = ?',
      [id]
    );
    
    if (reservaExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada'
      });
    }

    // Validar status
    const statusValidos = ['ativa', 'concluida', 'cancelada', 'expirada'];
    if (status && !statusValidos.includes(status)) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Status inválido. Use: ativa, concluida, cancelada ou expirada'
      });
    }

    // Validar data de validade se for fornecida
    if (data_validade) {
      const dataValidade = new Date(data_validade);
      const dataAtual = new Date();
      
      if (dataValidade <= dataAtual) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: 'Data de validade deve ser futura'
        });
      }
    }

    // Construir query dinamicamente
    let updateFields = [];
    let updateValues = [];

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (data_validade) {
      updateFields.push('data_validade = ?');
      updateValues.push(data_validade);
    }

    if (observacoes !== undefined) {
      updateFields.push('observacoes = ?');
      updateValues.push(observacoes);
    }

    if (updateFields.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }

    updateValues.push(id);

    // Atualizar reserva
    await connection.execute(
      `UPDATE reservas SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Buscar reserva atualizada
    const [reservaAtualizada] = await connection.execute(`
      SELECT 
        r.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        u.email as usuario_email,
        u.tipo as usuario_tipo,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        l.quantidade_disponivel,
        l.categoria as livro_categoria,
        l.localizacao as livro_localizacao
      FROM reservas r
      INNER JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN livros l ON r.livro_id = l.id
      WHERE r.id = ?
    `, [id]);
    
    connection.release();

    res.json({
      success: true,
      data: reservaAtualizada[0],
      message: 'Reserva atualizada com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar reserva',
      message: error.message
    });
  }
});

// Excluir reserva
app.delete('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se reserva existe
    const [reservaExistente] = await connection.execute(
      'SELECT id FROM reservas WHERE id = ?',
      [id]
    );
    
    if (reservaExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada'
      });
    }

    // Excluir reserva
    await connection.execute('DELETE FROM reservas WHERE id = ?', [id]);
    
    connection.release();

    res.json({
      success: true,
      message: 'Reserva excluída com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir reserva',
      message: error.message
    });
  }
});

// Reservas ativas por usuário
app.get('/api/usuarios/:id/reservas-ativas', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysqlPool.getConnection();
    
    const [reservas] = await connection.execute(`
      SELECT 
        r.*,
        l.titulo as livro_titulo,
        l.autor as livro_autor
      FROM reservas r
      INNER JOIN livros l ON r.livro_id = l.id
      WHERE r.usuario_id = ? AND r.status = 'ativa'
      ORDER BY r.data_validade ASC
    `, [id]);
    
    connection.release();

    res.json({
      success: true,
      data: reservas,
      total: reservas.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar reservas do usuário',
      message: error.message
    });
  }
});




// ========== ROTAS DE GESTÃO DE ACERVO ==========

// GET /api/acervo/estatisticas - Estatísticas do acervo
app.get('/api/acervo/estatisticas', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    // Total de livros
    const [totalLivros] = await connection.execute('SELECT COUNT(*) as total FROM livros');
    
    // Livros disponíveis
    const [livrosDisponiveis] = await connection.execute(
      'SELECT SUM(quantidade_disponivel) as total FROM livros'
    );
    
    // Livros emprestados
    const [livrosEmprestados] = await connection.execute(
      'SELECT SUM(quantidade_total - quantidade_disponivel) as total FROM livros'
    );
    
    // Total de categorias
    const [totalCategorias] = await connection.execute(
      'SELECT COUNT(DISTINCT categoria) as total FROM livros WHERE categoria IS NOT NULL'
    );

    connection.release();

    res.json({
      success: true,
      data: {
        total_livros: totalLivros[0].total,
        livros_disponiveis: livrosDisponiveis[0].total || 0,
        livros_emprestados: livrosEmprestados[0].total || 0,
        total_categorias: totalCategorias[0].total
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar estatísticas do acervo',
      message: error.message
    });
  }
});

// GET /api/acervo/categorias - Listar categorias únicas
app.get('/api/acervo/categorias', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [categorias] = await connection.execute(
      'SELECT DISTINCT categoria FROM livros WHERE categoria IS NOT NULL ORDER BY categoria'
    );

    connection.release();

    res.json({
      success: true,
      data: categorias.map(cat => cat.categoria)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar categorias',
      message: error.message
    });
  }
});

// PUT /api/livros/:id - Atualizar livro
app.put('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, localizacao } = req.body;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se livro existe
    const [livroExistente] = await connection.execute(
      'SELECT id FROM livros WHERE id = ?',
      [id]
    );
    
    if (livroExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Livro não encontrado'
      });
    }

    // Atualizar livro
    await connection.execute(
      `UPDATE livros 
       SET titulo = ?, autor = ?, isbn = ?, editora = ?, ano_publicacao = ?, 
           categoria = ?, quantidade_total = ?, localizacao = ?
       WHERE id = ?`,
      [titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, localizacao, id]
    );
    
    // Buscar livro atualizado
    const [livroAtualizado] = await connection.execute(
      'SELECT * FROM livros WHERE id = ?',
      [id]
    );
    
    connection.release();

    res.json({
      success: true,
      data: livroAtualizado[0],
      message: 'Livro atualizado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar livro',
      message: error.message
    });
  }
});

// DELETE /api/livros/:id - Excluir livro
app.delete('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se livro existe
    const [livroExistente] = await connection.execute(
      'SELECT id FROM livros WHERE id = ?',
      [id]
    );
    
    if (livroExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Livro não encontrado'
      });
    }

    // Verificar se livro tem empréstimos ativos
    const [emprestimosAtivos] = await connection.execute(
      'SELECT id FROM emprestimos WHERE livro_id = ? AND status = "ativo"',
      [id]
    );
    
    if (emprestimosAtivos.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Não é possível excluir livro com empréstimos ativos'
      });
    }

    // Excluir livro
    await connection.execute('DELETE FROM livros WHERE id = ?', [id]);
    
    connection.release();

    res.json({
      success: true,
      message: 'Livro excluído com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir livro',
      message: error.message
    });
  }
});

// ========== ROTA DE DEVOLUÇÃO (ORIGINAL) ==========
app.put('/api/emprestimos/:id/devolucao', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se empréstimo existe e está ativo
    const [emprestimo] = await connection.execute(
      'SELECT * FROM emprestimos WHERE id = ? AND status = "ativo"',
      [id]
    );
    
    if (emprestimo.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Empréstimo não encontrado ou já devolvido'
      });
    }

    const emprestimoData = emprestimo[0];

    // Iniciar transação
    await connection.beginTransaction();

    try {
      // Calcular multa se houver atraso
      const hoje = new Date();
      const dataPrevista = new Date(emprestimoData.data_devolucao_prevista);
      let multa = 0;

      if (hoje > dataPrevista) {
        const diasAtraso = Math.ceil((hoje - dataPrevista) / (1000 * 60 * 60 * 24));
        multa = diasAtraso * 2.0; // R$ 2,00 por dia de atraso
      }

      // Atualizar empréstimo
      await connection.execute(
        `UPDATE emprestimos 
         SET data_devolucao_efetiva = CURDATE(), status = 'devolvido', multa = ?
         WHERE id = ?`,
        [multa, id]
      );

      // Devolver livro ao acervo
      await connection.execute(
        'UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?',
        [emprestimoData.livro_id]
      );

      // Commit da transação
      await connection.commit();

      // Buscar empréstimo atualizado
      const [emprestimoAtualizado] = await connection.execute(
        `SELECT 
          e.*,
          u.nome as usuario_nome,
          u.matricula as usuario_matricula,
          l.titulo as livro_titulo,
          l.autor as livro_autor
        FROM emprestimos e
        INNER JOIN usuarios u ON e.usuario_id = u.id
        INNER JOIN livros l ON e.livro_id = l.id
        WHERE e.id = ?`,
        [id]
      );

      connection.release();

      res.json({
        success: true,
        data: emprestimoAtualizado[0],
        message: multa > 0 
          ? `Devolução registrada com multa de R$ ${multa.toFixed(2)}` 
          : 'Devolução registrada com sucesso!'
      });

    } catch (error) {
      // Rollback em caso de erro
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar devolução',
      message: error.message
    });
  }
});
// ========== ROTAS DO SISTEMA ==========

// Rota principal
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API da Biblioteca Universitária - SISTEMA COMPLETO',
    aluno: 'Emmanuel Fortunato',
    faculdade: 'Uniasselvi',
    database: process.env.DB_NAME,
    status: '✅ BACKEND 100% FUNCIONAL',
    timestamp: new Date().toISOString(),
    endpoints: {
      livros: 'GET /api/livros',
      dashboard: {
        estatisticas: 'GET /api/dashboard/estatisticas',
        emprestimos_recentes: 'GET /api/dashboard/emprestimos-recentes'
      },
      health: 'GET /api/health',
      usuarios: 'GET /api/usuarios (em desenvolvimento)',
      emprestimos: 'GET /api/emprestimos (em desenvolvimento)',
      reservas: 'GET /api/reservas (em desenvolvimento)'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ ONLINE',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DB_NAME,
    port: process.env.PORT || 3000
  });
});

// ========== ROTAS DE USUÁRIOS - VERSÃO CORRIGIDA ==========

// Listar todos os usuários
app.get('/api/usuarios', async (req, res) => {
  try {
    console.log('🔍 Buscando usuários no banco...');
    
    const connection = await mysqlPool.getConnection();
    
    // VERIFICAR SE A TABELA EXISTE
    const [tabelas] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME}' 
      AND table_name = 'usuarios'
    `);
    
    if (tabelas.length === 0) {
      connection.release();
      return res.json({
        success: true,
        data: [],
        message: 'Tabela de usuários não existe ainda'
      });
    }
    
    // BUSCAR USUÁRIOS
    const [usuarios] = await connection.execute(`
      SELECT * FROM usuarios 
      WHERE ativo = true 
      ORDER BY nome
    `);
    
    connection.release();

    console.log(`✅ Encontrados ${usuarios.length} usuários`);
    
    res.json({
      success: true,
      data: usuarios,
      total: usuarios.length
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuários',
      message: error.message
    });
  }
});

// Buscar usuário por ID
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await mysqlPool.getConnection();
    const [usuarios] = await connection.execute(
      'SELECT * FROM usuarios WHERE id = ? AND ativo = true',
      [id]
    );
    connection.release();
    
    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: usuarios[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuário',
      message: error.message
    });
  }
});

// Criar novo usuário
app.post('/api/usuarios', async (req, res) => {
  try {
    const { matricula, nome, email, tipo } = req.body;
    
    // Validações
    if (!matricula || !nome || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'Matrícula, nome e tipo são obrigatórios'
      });
    }

    if (!['aluno', 'professor', 'funcionario'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve ser: aluno, professor ou funcionario'
      });
    }

    const connection = await mysqlPool.getConnection();
    
    // Verificar se matrícula já existe
    const [existeMatricula] = await connection.execute(
      'SELECT id FROM usuarios WHERE matricula = ?',
      [matricula]
    );
    
    if (existeMatricula.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Matrícula já cadastrada'
      });
    }

    // Inserir usuário
    const [result] = await connection.execute(
      'INSERT INTO usuarios (matricula, nome, email, tipo) VALUES (?, ?, ?, ?)',
      [matricula, nome, email, tipo]
    );
    
    // Buscar usuário criado
    const [novoUsuario] = await connection.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [result.insertId]
    );
    
    connection.release();

    res.status(201).json({
      success: true,
      data: novoUsuario[0],
      message: 'Usuário criado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao criar usuário',
      message: error.message
    });
  }
});

// Atualizar usuário
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, tipo, ativo } = req.body;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se usuário existe
    const [usuarioExistente] = await connection.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [id]
    );
    
    if (usuarioExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Atualizar usuário
    await connection.execute(
      'UPDATE usuarios SET nome = ?, email = ?, tipo = ?, ativo = ? WHERE id = ?',
      [nome, email, tipo, ativo, id]
    );
    
    // Buscar usuário atualizado
    const [usuarioAtualizado] = await connection.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );
    
    connection.release();

    res.json({
      success: true,
      data: usuarioAtualizado[0],
      message: 'Usuário atualizado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar usuário',
      message: error.message
    });
  }
});

// "Deletar" usuário (desativar)
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se usuário existe
    const [usuarioExistente] = await connection.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [id]
    );
    
    if (usuarioExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Desativar usuário (soft delete)
    await connection.execute(
      'UPDATE usuarios SET ativo = false WHERE id = ?',
      [id]
    );
    
    connection.release();

    res.json({
      success: true,
      message: 'Usuário desativado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao desativar usuário',
      message: error.message
    });
  }
});

// Buscar usuários por tipo
app.get('/api/usuarios/tipo/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    if (!['aluno', 'professor', 'funcionario'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve ser: aluno, professor ou funcionario'
      });
    }

    const connection = await mysqlPool.getConnection();
    const [usuarios] = await connection.execute(
      'SELECT * FROM usuarios WHERE tipo = ? AND ativo = true ORDER BY nome',
      [tipo]
    );
    connection.release();
    
    res.json({
      success: true,
      data: usuarios,
      total: usuarios.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuários',
      message: error.message
    });
  }
});

// Rota de DEBUG - Verificar estado do banco
app.get('/api/debug/banco', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    // Verificar todas as tabelas
    const [tabelas] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME}'
      ORDER BY TABLE_NAME
    `);
    
    // Contar registros em cada tabela
    const contagens = {};
    
    for (const tabela of tabelas) {
      const [result] = await connection.execute(`SELECT COUNT(*) as total FROM ${tabela.TABLE_NAME}`);
      contagens[tabela.TABLE_NAME] = result[0].total;
    }
    
    connection.release();

    res.json({
      success: true,
      database: process.env.DB_NAME,
      tabelas: tabelas,
      contagens: contagens,
      status: '✅ Banco conectado'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar banco',
      message: error.message
    });
  }
});

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨');
  console.log('🚀 SERVIDOR RODANDO COM SUCESSO!');
  console.log(`📊 Banco: ${process.env.DB_NAME}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('📋 Endpoints disponíveis:');
  console.log(`   📚 Livros: http://localhost:${PORT}/api/livros`);
  console.log(`   📈 Dashboard: http://localhost:${PORT}/api/dashboard/estatisticas`);
  console.log(`   🔍 Health: http://localhost:${PORT}/api/health`);
  console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨');
});