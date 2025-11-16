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


// Rota para verificar estrutura das tabelas
app.get('/api/debug/tabelas', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [usuariosColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'
    `, [process.env.DB_NAME]);
    
    const [livrosColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'livros'
    `, [process.env.DB_NAME]);
    
    connection.release();

    res.json({
      success: true,
      usuarios: usuariosColumns,
      livros: livrosColumns
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar tabelas',
      message: error.message
    });
  }
});

// ========== ROTAS DE ESTATÍSTICAS DE MULTAS CORRIGIDAS ==========

// Estatísticas de multas para o dashboard
// ========== ROTAS DE ESTATÍSTICAS DE MULTAS - VERSÃO CORRIGIDA ==========

// Estatísticas de multas para o dashboard
// Estatísticas de multas - VERSÃO CORRIGIDA E SIMPLIFICADA
// Estatísticas de multas - VERSÃO CORRIGIDA SEM ERROS DE SINTAXE
// Estatísticas de multas - VERSÃO COM VALOR ISENTADO
app.get('/api/estatisticas/multas', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    console.log(`💰 Carregando estatísticas de multas: ${dataInicial} até ${dataFinal}`);

    const connection = await mysqlPool.getConnection();
    
    // MULTAS PENDENTES (apenas empréstimos ativos em atraso)
    const [multasPendentes] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(
          DATEDIFF(CURDATE(), data_devolucao_prevista) * 2.0
        ), 0) as valor_total
      FROM emprestimos 
      WHERE status = 'ativo' 
      AND data_devolucao_prevista < CURDATE()
      AND isento = 0
    `);
    
    // MULTAS PAGAS no período (já devolvidas e pagas)
    const [multasPagas] = await connection.execute(`
      SELECT 
        COUNT(*) as total, 
        COALESCE(SUM(multa), 0) as valor_total 
      FROM emprestimos 
      WHERE multa > 0 
      AND status = 'devolvido'
      AND isento = 0
      AND data_devolucao_efetiva BETWEEN ? AND ?
    `, [dataInicial, dataFinal]);
    
    // MULTAS ISENTAS no período - AGORA COM VALOR ISENTADO
// MULTAS ISENTAS no período - VERSÃO CORRIGIDA
const [multasIsentas] = await connection.execute(`
  SELECT 
    COUNT(*) as total,
    COALESCE(SUM(
      CASE 
        -- Se já tinha multa calculada no sistema, usa esse valor
        WHEN multa > 0 THEN multa
        -- Se não tinha multa calculada, calcula baseado no atraso
        WHEN data_devolucao_efetiva > data_devolucao_prevista THEN 
          DATEDIFF(data_devolucao_efetiva, data_devolucao_prevista) * 2.0
        -- Sem atraso, sem multa
        ELSE 0
      END
    ), 0) as valor_isentado
  FROM emprestimos 
  WHERE isento = 1
  AND status = 'devolvido'
  AND data_devolucao_efetiva BETWEEN ? AND ?
`, [dataInicial, dataFinal]);

console.log('✅ Multas isentas:', {
  total: multasIsentas[0].total,
  valor_isentado: multasIsentas[0].valor_isentado
});
    
    // EVOLUÇÃO MENSAL de multas pagas
    const [evolucaoMensal] = await connection.execute(`
      SELECT 
        DATE_FORMAT(data_devolucao_efetiva, '%Y-%m') as mes,
        COUNT(*) as quantidade,
        COALESCE(SUM(multa), 0) as valor_total
      FROM emprestimos 
      WHERE multa > 0 
      AND status = 'devolvido'
      AND isento = 0
      AND data_devolucao_efetiva IS NOT NULL
      AND data_devolucao_efetiva BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(data_devolucao_efetiva, '%Y-%m')
      ORDER BY mes
    `, [dataInicial, dataFinal]);
    
    // TOP USUÁRIOS com mais multas pagas
    const [topUsuariosMultas] = await connection.execute(`
      SELECT 
        u.nome,
        u.matricula,
        COUNT(e.id) as total_multas,
        COALESCE(SUM(e.multa), 0) as valor_total
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.multa > 0 
      AND e.status = 'devolvido'
      AND e.isento = 0
      AND e.data_devolucao_efetiva IS NOT NULL
      AND e.data_devolucao_efetiva BETWEEN ? AND ?
      GROUP BY u.id, u.nome, u.matricula
      ORDER BY valor_total DESC
      LIMIT 10
    `, [dataInicial, dataFinal]);

    connection.release();

    console.log('✅ Estatísticas de multas calculadas:', {
      pendentes: multasPendentes[0].total,
      pagas: multasPagas[0].total,
      isentas: multasIsentas[0].total,
      valor_isentado: multasIsentas[0].valor_isentado
    });

    res.json({
      success: true,
      data: {
        pendentes: {
          total: multasPendentes[0].total,
          valor_total: parseFloat(multasPendentes[0].valor_total)
        },
        pagas: {
          total: multasPagas[0].total,
          valor_total: parseFloat(multasPagas[0].valor_total)
        },
        isentas: {
          total: multasIsentas[0].total,
          valor_isentado: parseFloat(multasIsentas[0].valor_isentado) // NOVO CAMPO
        },
        evolucao_mensal: evolucaoMensal.map(item => ({
          mes: item.mes,
          quantidade: item.quantidade,
          valor_total: parseFloat(item.valor_total)
        })),
        top_usuarios: topUsuariosMultas.map(item => ({
          nome: item.nome,
          matricula: item.matricula,
          total_multas: item.total_multas,
          valor_total: parseFloat(item.valor_total)
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/multas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar estatísticas de multas',
      message: error.message
    });
  }
});

// Distribuição de multas por valor - VERSÃO CORRIGIDA
// Distribuição de multas por valor - VERSÃO CORRIGIDA
app.get('/api/estatisticas/multas-distribuicao', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    console.log(`📊 Carregando distribuição de multas: ${dataInicial} até ${dataFinal}`);

    const connection = await mysqlPool.getConnection();
    
    // Buscar todas as multas pagas no período (EXCLUINDO ISENTOS)
    const [multas] = await connection.execute(`
      SELECT multa
      FROM emprestimos 
      WHERE multa > 0 
      AND status = 'devolvido'
      AND isento = 0
      AND data_devolucao_efetiva IS NOT NULL
      AND data_devolucao_efetiva BETWEEN ? AND ?
    `, [dataInicial, dataFinal]);
    
    connection.release();

    console.log(`✅ Encontradas ${multas.length} multas para distribuição`);

    // Se não houver multas, retornar estrutura vazia
    if (multas.length === 0) {
      return res.json({
        success: true,
        data: {
          faixas: ['0-5', '6-10', '11-20', '21-50', '50+'],
          quantidades: [0, 0, 0, 0, 0]
        }
      });
    }

    // Calcular distribuição manualmente
    const distribuicao = {
      '0-5': 0,
      '6-10': 0,
      '11-20': 0,
      '21-50': 0,
      '50+': 0
    };

    multas.forEach(item => {
      const valor = parseFloat(item.multa);
      
      if (valor <= 5) {
        distribuicao['0-5']++;
      } else if (valor <= 10) {
        distribuicao['6-10']++;
      } else if (valor <= 20) {
        distribuicao['11-20']++;
      } else if (valor <= 50) {
        distribuicao['21-50']++;
      } else {
        distribuicao['50+']++;
      }
    });

    const faixas = ['0-5', '6-10', '11-20', '21-50', '50+'];
    const quantidades = faixas.map(faixa => distribuicao[faixa]);

    console.log('📈 Distribuição calculada:', quantidades);

    res.json({
      success: true,
      data: {
        faixas: faixas,
        quantidades: quantidades
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/multas-distribuicao:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar distribuição de multas',
      message: error.message
    });
  }
});

// Distribuição de multas por valor - VERSÃO CORRIGIDA
app.get('/api/estatisticas/multas-distribuicao', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    const connection = await mysqlPool.getConnection();
    
    // Consulta corrigida
    const [distribuicao] = await connection.execute(`
      SELECT 
        CASE 
          WHEN multa <= 5 THEN '0-5'
          WHEN multa <= 10 THEN '6-10' 
          WHEN multa <= 20 THEN '11-20'
          WHEN multa <= 50 THEN '21-50'
          ELSE '50+'
        END as faixa_valor,
        COUNT(*) as quantidade,
        COALESCE(SUM(multa), 0) as valor_total
      FROM emprestimos 
      WHERE multa > 0 
      AND status = 'devolvido'
      AND data_devolucao_efetiva IS NOT NULL
      AND data_devolucao_efetiva BETWEEN ? AND ?
      GROUP BY 
        CASE 
          WHEN multa <= 5 THEN '0-5'
          WHEN multa <= 10 THEN '6-10' 
          WHEN multa <= 20 THEN '11-20'
          WHEN multa <= 50 THEN '21-50'
          ELSE '50+'
        END
      ORDER BY 
        CASE 
          WHEN multa <= 5 THEN 1
          WHEN multa <= 10 THEN 2
          WHEN multa <= 20 THEN 3
          WHEN multa <= 50 THEN 4
          ELSE 5
        END
    `, [dataInicial, dataFinal]);
    
    connection.release();

    res.json({
      success: true,
      data: {
        faixas: distribuicao.map(item => item.faixa_valor),
        quantidades: distribuicao.map(item => item.quantidade),
        valores: distribuicao.map(item => parseFloat(item.valor_total))
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/multas-distribuicao:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar distribuição de multas',
      message: error.message,
      stack: error.stack
    });
  }
});

// Distribuição de multas por valor - VERSÃO CORRIGIDA
app.get('/api/estatisticas/multas-distribuicao', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    const connection = await mysqlPool.getConnection();
    
    // Consulta corrigida para evitar erro de sintaxe
    const [distribuicao] = await connection.execute(`
      SELECT 
        CASE 
          WHEN multa <= 5 THEN '0-5'
          WHEN multa <= 10 THEN '6-10' 
          WHEN multa <= 20 THEN '11-20'
          WHEN multa <= 50 THEN '21-50'
          ELSE '50+'
        END as faixa_valor,
        COUNT(*) as quantidade,
        COALESCE(SUM(multa), 0) as valor_total
      FROM emprestimos 
      WHERE multa > 0 
      AND data_devolucao_efetiva IS NOT NULL
      AND data_devolucao_efetiva BETWEEN ? AND ?
      GROUP BY 
        CASE 
          WHEN multa <= 5 THEN '0-5'
          WHEN multa <= 10 THEN '6-10' 
          WHEN multa <= 20 THEN '11-20'
          WHEN multa <= 50 THEN '21-50'
          ELSE '50+'
        END
      ORDER BY MIN(multa)
    `, [dataInicial, dataFinal]);
    
    connection.release();

    // Garantir que sempre retorne arrays mesmo vazios
    res.json({
      success: true,
      data: {
        faixas: distribuicao.map(item => item.faixa_valor) || [],
        quantidades: distribuicao.map(item => item.quantidade) || [],
        valores: distribuicao.map(item => parseFloat(item.valor_total)) || []
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/multas-distribuicao:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar distribuição de multas',
      message: error.message,
      stack: error.stack
    });
  }
});

// ========== ROTAS DE ESTATÍSTICAS E RELATÓRIOS ==========

// Estatísticas gerais do sistema - VERSÃO DEFINITIVAMENTE CORRIGIDA
// Estatísticas gerais do sistema - VERSÃO TESTADA
app.get('/api/estatisticas/geral', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    // Valores padrão se não for informado
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    console.log(`📊 Carregando estatísticas gerais: ${dataInicial} até ${dataFinal}`);

    const connection = await mysqlPool.getConnection();
    
    // Total de empréstimos no período
    const [totalEmprestimos] = await connection.execute(
      `SELECT COUNT(*) as total FROM emprestimos 
       WHERE data_emprestimo BETWEEN ? AND ?`,
      [dataInicial, dataFinal]
    );
    
    // Empréstimos ativos
    const [emprestimosAtivos] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo"'
    );
    
    // Devoluções no período
    const [devolucoes] = await connection.execute(
      `SELECT COUNT(*) as total FROM emprestimos 
       WHERE data_devolucao_efetiva BETWEEN ? AND ?`,
      [dataInicial, dataFinal]
    );
    
    // Reservas ativas
    const [reservasAtivas] = await connection.execute(
      'SELECT COUNT(*) as total FROM reservas WHERE status = "ativa"'
    );
    
    // Multas arrecadadas no período - CORRIGIDA
    const [multas] = await connection.execute(
      `SELECT COALESCE(SUM(multa), 0) as total FROM emprestimos 
       WHERE data_devolucao_efetiva BETWEEN ? AND ? 
       AND multa > 0 
       AND isento = 0`,
      [dataInicial, dataFinal]
    );
    
    // Novos usuários no período
    const [novosUsuarios] = await connection.execute(
      `SELECT COUNT(*) as total FROM usuarios 
       WHERE data_cadastro BETWEEN ? AND ?`,
      [dataInicial, dataFinal]
    );
    
    // Total de usuários ativos
    const [totalUsuarios] = await connection.execute(
      'SELECT COUNT(*) as total FROM usuarios WHERE ativo = true'
    );

    // Total de livros no acervo
    const [totalLivros] = await connection.execute(
      'SELECT COUNT(*) as total FROM livros'
    );
    
    // Livros disponíveis
    const [livrosDisponiveis] = await connection.execute(
      'SELECT SUM(quantidade_disponivel) as total FROM livros'
    );
    
    // Taxa de devolução
    const [taxaDevolucao] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN data_devolucao_efetiva IS NOT NULL AND data_devolucao_efetiva <= data_devolucao_prevista THEN 1 END) as devolvidos_prazo,
        COUNT(CASE WHEN data_devolucao_efetiva IS NOT NULL THEN 1 END) as total_devolvidos,
        COUNT(*) as total_emprestimos
      FROM emprestimos 
      WHERE data_emprestimo BETWEEN ? AND ?
    `, [dataInicial, dataFinal]);
    
    // Livro mais emprestado
    const [livroMaisEmprestado] = await connection.execute(`
      SELECT l.titulo, COUNT(e.id) as total_emprestimos
      FROM emprestimos e
      INNER JOIN livros l ON e.livro_id = l.id
      WHERE e.data_emprestimo BETWEEN ? AND ?
      GROUP BY l.id, l.titulo
      ORDER BY total_emprestimos DESC
      LIMIT 1
    `, [dataInicial, dataFinal]);
    
    connection.release();

    const taxaDevolucaoPercent = taxaDevolucao[0].total_devolvidos > 0 
      ? ((taxaDevolucao[0].devolvidos_prazo / taxaDevolucao[0].total_devolvidos) * 100).toFixed(1)
      : 0;

    console.log('✅ Estatísticas gerais calculadas com sucesso');

    res.json({
      success: true,
      data: {
        total_emprestimos: totalEmprestimos[0].total,
        emprestimos_ativos: emprestimosAtivos[0].total,
        devolucoes_periodo: devolucoes[0].total,
        reservas_ativas: reservasAtivas[0].total,
        multas_arrecadadas: parseFloat(multas[0].total) || 0,
        novos_usuarios: novosUsuarios[0].total,
        total_usuarios: totalUsuarios[0].total,
        total_livros: totalLivros[0].total,
        livros_disponiveis: livrosDisponiveis[0].total || 0,
        taxa_devolucao: parseFloat(taxaDevolucaoPercent),
        livros_mais_emprestados: livroMaisEmprestado[0]?.titulo || 'Nenhum'
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar estatísticas gerais',
      message: error.message
    });
  }
});

// Empréstimos por dia para gráfico de linha
app.get('/api/estatisticas/emprestimos-diarios', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    console.log(`📈 Carregando empréstimos diários: ${dataInicial} até ${dataFinal}`);

    const connection = await mysqlPool.getConnection();
    
    const [dados] = await connection.execute(`
      SELECT 
        DATE(data_emprestimo) as data,
        COUNT(*) as total_emprestimos,
        COUNT(CASE WHEN data_devolucao_efetiva IS NOT NULL THEN 1 END) as total_devolucoes
      FROM emprestimos 
      WHERE data_emprestimo BETWEEN ? AND ?
      GROUP BY DATE(data_emprestimo)
      ORDER BY data
    `, [dataInicial, dataFinal]);
    
    connection.release();

    // Formatar dados para o gráfico
    const dadosFormatados = {
      datas: dados.map(item => new Date(item.data).toLocaleDateString('pt-BR')),
      emprestimos: dados.map(item => item.total_emprestimos),
      devolucoes: dados.map(item => item.total_devolucoes)
    };

    res.json({
      success: true,
      data: dadosFormatados
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/emprestimos-diarios:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar empréstimos diários',
      message: error.message
    });
  }
});

// Livros por categoria para gráfico de pizza
app.get('/api/estatisticas/livros-categoria', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [dados] = await connection.execute(`
      SELECT 
        COALESCE(categoria, 'Sem categoria') as categoria,
        COUNT(*) as quantidade
      FROM livros 
      GROUP BY categoria
      ORDER BY quantidade DESC
    `);
    
    connection.release();

    res.json({
      success: true,
      data: {
        categorias: dados.map(item => item.categoria),
        quantidades: dados.map(item => item.quantidade)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/livros-categoria:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar livros por categoria',
      message: error.message
    });
  }
});

// Top 10 livros mais emprestados para gráfico de barras
// Top 10 livros mais emprestados para gráfico de barras - CORRIGIDA
app.get('/api/estatisticas/top-livros', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    const connection = await mysqlPool.getConnection();
    
    const [dados] = await connection.execute(`
      SELECT 
        l.titulo,
        COUNT(e.id) as total_emprestimos
      FROM emprestimos e
      INNER JOIN livros l ON e.livro_id = l.id
      WHERE e.data_emprestimo BETWEEN ? AND ?
      GROUP BY l.id, l.titulo
      ORDER BY total_emprestimos DESC
      LIMIT 10
    `, [dataInicial, dataFinal]);
    
    connection.release();

    res.json({
      success: true,
      data: {
        livros: dados.map(item => item.titulo),
        emprestimos: dados.map(item => item.total_emprestimos)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/top-livros:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar top livros',
      message: error.message
    });
  }
});

// Empréstimos por tipo de usuário
app.get('/api/estatisticas/emprestimos-usuario-tipo', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    const connection = await mysqlPool.getConnection();
    
    const [dados] = await connection.execute(`
      SELECT 
        u.tipo,
        COUNT(e.id) as total_emprestimos
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.data_emprestimo BETWEEN ? AND ?
      GROUP BY u.tipo
      ORDER BY total_emprestimos DESC
    `, [dataInicial, dataFinal]);
    
    connection.release();

    res.json({
      success: true,
      data: {
        tipos: dados.map(item => item.tipo),
        quantidades: dados.map(item => item.total_emprestimos)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/emprestimos-usuario-tipo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar empréstimos por tipo de usuário',
      message: error.message
    });
  }
});

// Relatório detalhado diário
// RELATÓRIO DIÁRIO - VERSÃO CORRIGIDA
// RELATÓRIO DIÁRIO - VERSÃO CORRIGIDA
app.get('/api/estatisticas/relatorio-diario', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    console.log(`📋 Carregando relatório diário: ${dataInicial} até ${dataFinal}`);

    const connection = await mysqlPool.getConnection();
    
    // CONSULTA CORRIGIDA
    const [dados] = await connection.execute(`
      SELECT 
        DATE(data_emprestimo) as data,
        COUNT(*) as emprestimos,
        COUNT(CASE WHEN data_devolucao_efetiva IS NOT NULL THEN 1 END) as devolucoes,
        COALESCE(SUM(CASE WHEN data_devolucao_efetiva IS NOT NULL AND isento = 0 THEN multa ELSE 0 END), 0) as multas,
        COUNT(DISTINCT usuario_id) as usuarios_ativos
      FROM emprestimos 
      WHERE data_emprestimo BETWEEN ? AND ?
      GROUP BY DATE(data_emprestimo)
      ORDER BY data DESC
      LIMIT 30
    `, [dataInicial, dataFinal]);
    
    connection.release();

    res.json({
      success: true,
      data: dados.map(item => ({
        data: item.data,
        emprestimos: item.emprestimos,
        devolucoes: item.devolucoes,
        reservas: 0,
        multas: parseFloat(item.multas),
        usuarios_ativos: item.usuarios_ativos
      }))
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/relatorio-diario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar relatório diário',
      message: error.message
    });
  }
});

// Estatísticas de empréstimos em atraso
// Estatísticas de empréstimos em atraso - CORRIGIDA
app.get('/api/estatisticas/emprestimos-atraso', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [dados] = await connection.execute(`
      SELECT 
        COUNT(*) as total_atraso,
        COALESCE(SUM(
          CASE 
            WHEN isento = 0 THEN DATEDIFF(CURDATE(), data_devolucao_prevista) * 2.0
            ELSE 0
          END
        ), 0) as multa_pendente,
        AVG(DATEDIFF(CURDATE(), data_devolucao_prevista)) as dias_atraso_medio
      FROM emprestimos 
      WHERE status = 'ativo' AND data_devolucao_prevista < CURDATE()
    `);
    
    connection.release();

    res.json({
      success: true,
      data: {
        total_atraso: dados[0].total_atraso,
        multa_pendente: parseFloat(dados[0].multa_pendente),
        dias_atraso_medio: parseFloat(dados[0].dias_atraso_medio) || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Erro em /api/estatisticas/emprestimos-atraso:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar empréstimos em atraso',
      message: error.message
    });
  }
});

// ========== ROTAS DE MULTAS ==========

// Listar multas
app.get('/api/multas', async (req, res) => {
    try {
        const connection = await mysqlPool.getConnection();
        
        const [multas] = await connection.execute(`
            SELECT 
                e.*,
                u.nome as usuario_nome,
                u.matricula as usuario_matricula,
                l.titulo as livro_titulo,
                l.autor as livro_autor,
                -- CALCULAR MULTAS PENDENTES
                CASE 
                    WHEN e.status = 'ativo' AND e.data_devolucao_prevista < CURDATE() THEN 
                        DATEDIFF(CURDATE(), e.data_devolucao_prevista) * 2.0
                    ELSE COALESCE(e.multa, 0)
                END as valor_multa_calculado,
                -- DEFINIR STATUS
                CASE 
                    WHEN e.isento THEN 'isento'
                    WHEN e.data_pagamento IS NOT NULL THEN 'pago'
                    WHEN e.status = 'ativo' AND e.data_devolucao_prevista < CURDATE() THEN 'pendente'
                    WHEN e.multa > 0 THEN 'pendente'
                    ELSE 'sem_multa'
                END as status_multa
            FROM emprestimos e
            INNER JOIN usuarios u ON e.usuario_id = u.id
            INNER JOIN livros l ON e.livro_id = l.id
            WHERE e.isento = TRUE 
               OR e.data_pagamento IS NOT NULL 
               OR (e.status = 'ativo' AND e.data_devolucao_prevista < CURDATE())
               OR e.multa > 0
            ORDER BY 
                CASE 
                    WHEN status_multa = 'pendente' THEN 1
                    WHEN status_multa = 'pago' THEN 2
                    WHEN status_multa = 'isento' THEN 3
                    ELSE 4
                END,
                e.data_devolucao_prevista ASC
        `);
        
        connection.release();

        // Filtrar apenas multas válidas
        const multasValidas = multas.filter(m => m.status_multa !== 'sem_multa');

        res.json({
            success: true,
            data: multasValidas,
            total: multasValidas.length
        });
    } catch (error) {
        console.error('❌ Erro em /api/multas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar multas',
            message: error.message
        });
    }
});

// Registrar pagamento de multa
app.put('/api/multas/:id/pagar', async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pagamento, comprovante } = req.body;

        const connection = await mysqlPool.getConnection();
        
        // Verificar se empréstimo existe e tem multa
        const [emprestimo] = await connection.execute(
            'SELECT * FROM emprestimos WHERE id = ? AND multa > 0',
            [id]
        );
        
        if (emprestimo.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                error: 'Empréstimo não encontrado ou sem multa'
            });
        }

        // Atualizar informações de pagamento (poderia adicionar colunas específicas para multas)
        await connection.execute(
            `UPDATE emprestimos 
             SET observacoes = CONCAT(COALESCE(observacoes, ''), ' | Multa paga via: ${metodo_pagamento} - ${comprovante || 'Sem comprovante'}')
             WHERE id = ?`,
            [id]
        );
        
        connection.release();

        res.json({
            success: true,
            message: 'Pagamento de multa registrado com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro em /api/multas/:id/pagar:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao registrar pagamento',
            message: error.message
        });
    }
});

// Isentar multa
app.put('/api/multas/:id/isentar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        const connection = await mysqlPool.getConnection();
        
        // Verificar se empréstimo existe
        const [emprestimo] = await connection.execute(
            'SELECT * FROM emprestimos WHERE id = ?',
            [id]
        );
        
        if (emprestimo.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                error: 'Empréstimo não encontrado'
            });
        }

        // Remover multa (isentar)
        await connection.execute(
            `UPDATE emprestimos 
             SET multa = 0,
                 observacoes = CONCAT(COALESCE(observacoes, ''), ' | Multa isenta: ${motivo}')
             WHERE id = ?`,
            [id]
        );
        
        connection.release();

        res.json({
            success: true,
            message: 'Multa isenta com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro em /api/multas/:id/isentar:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao isentar multa',
            message: error.message
        });
    }
});

// ========== ROTAS DE EMPRÉSTIMOS ==========

// Listar todos os empréstimos
// Listar todos os empréstimos - VERSÃO CORRIGIDA COM CÁLCULO DE MULTAS
app.get('/api/emprestimos', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    
    const [emprestimos] = await connection.execute(`
      SELECT 
        e.*,
        u.nome as usuario_nome,
        u.matricula as usuario_matricula,
        l.titulo as livro_titulo,
        l.autor as livro_autor,
        -- CALCULAR MULTAS PARA EMPRÉSTIMOS EM ATRASO
        CASE 
          WHEN e.status = 'ativo' AND e.data_devolucao_prevista < CURDATE() THEN 
            DATEDIFF(CURDATE(), e.data_devolucao_prevista) * 2.0
          ELSE COALESCE(e.multa, 0)
        END as multa_calculada,
        -- IDENTIFICAR SE TEM MULTA PENDENTE
        CASE 
          WHEN e.status = 'ativo' AND e.data_devolucao_prevista < CURDATE() THEN 'pendente'
          WHEN e.multa > 0 THEN 'paga'
          ELSE 'sem_multa'
        END as status_multa
      FROM emprestimos e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      INNER JOIN livros l ON e.livro_id = l.id
      ORDER BY e.data_emprestimo DESC
    `);
    
    connection.release();

    // Atualizar o campo multa com o valor calculado para exibição
    const emprestimosComMultas = emprestimos.map(emp => ({
      ...emp,
      multa: parseFloat(emp.multa_calculada) // Usar o valor calculado
    }));

    res.json({
      success: true,
      data: emprestimosComMultas,
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

// ========== ROTAS DE LIVROS ==========

// GET /api/livros - Listar todos os livros
app.get('/api/livros', async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    const [livros] = await connection.execute('SELECT * FROM livros ORDER BY titulo');
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

// POST /api/livros - Criar novo livro
app.post('/api/livros', async (req, res) => {
  try {
    const { titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, localizacao } = req.body;

    // Validações
    if (!titulo || !autor) {
      return res.status(400).json({
        success: false,
        error: 'Título e autor são obrigatórios'
      });
    }

    const connection = await mysqlPool.getConnection();
    
    // Verificar se ISBN já existe (se fornecido)
    if (isbn) {
      const [existeIsbn] = await connection.execute(
        'SELECT id FROM livros WHERE isbn = ?',
        [isbn]
      );
      
      if (existeIsbn.length > 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: 'ISBN já cadastrado'
        });
      }
    }

    // Inserir livro - quantidade_disponivel = quantidade_total (inicialmente)
    const [result] = await connection.execute(
      `INSERT INTO livros 
       (titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, quantidade_disponivel, localizacao) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, autor, isbn || null, editora || null, ano_publicacao || null, categoria || null, quantidade_total, quantidade_total, localizacao || null]
    );
    
    // Buscar livro criado
    const [novoLivro] = await connection.execute(
      'SELECT * FROM livros WHERE id = ?',
      [result.insertId]
    );
    
    connection.release();

    res.status(201).json({
      success: true,
      data: novoLivro[0],
      message: 'Livro adicionado com sucesso!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar livro',
      message: error.message
    });
  }
});

// PUT /api/livros/:id - Atualizar livro COM CÁLCULO CORRETO DE DISPONÍVEIS
app.put('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, localizacao } = req.body;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se livro existe
    const [livroExistente] = await connection.execute(
      'SELECT id, quantidade_total, quantidade_disponivel FROM livros WHERE id = ?',
      [id]
    );
    
    if (livroExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Livro não encontrado'
      });
    }

    const livroAtual = livroExistente[0];
    
    // Calcular nova quantidade disponível
    const quantidadeEmprestada = livroAtual.quantidade_total - livroAtual.quantidade_disponivel;
    const novaQuantidadeDisponivel = Math.max(0, quantidade_total - quantidadeEmprestada);

    // Atualizar livro COM CÁLCULO CORRETO
    await connection.execute(
      `UPDATE livros 
       SET titulo = ?, autor = ?, isbn = ?, editora = ?, ano_publicacao = ?, 
           categoria = ?, quantidade_total = ?, quantidade_disponivel = ?, localizacao = ?
       WHERE id = ?`,
      [titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, novaQuantidadeDisponivel, localizacao, id]
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
      'SELECT id, titulo FROM livros WHERE id = ?',
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

// Dashboard - Estatísticas
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
    
    // Livros emprestados - CORRIGIDO
    const [livrosEmprestados] = await connection.execute(
      'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo"'
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
    const { usuario_id, livro_id, data_reserva, data_validade, observacoes } = req.body;
    
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
    
// Livros emprestados - VERSÃO CORRIGIDA
const [livrosEmprestados] = await connection.execute(
  'SELECT COUNT(*) as total FROM emprestimos WHERE status = "ativo"'
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
// PUT /api/livros/:id - Atualizar livro COM CÁLCULO CORRETO DE DISPONÍVEIS
app.put('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, localizacao } = req.body;

    const connection = await mysqlPool.getConnection();
    
    // Verificar se livro existe
    const [livroExistente] = await connection.execute(
      'SELECT id, quantidade_total, quantidade_disponivel FROM livros WHERE id = ?',
      [id]
    );
    
    if (livroExistente.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Livro não encontrado'
      });
    }

    const livroAtual = livroExistente[0];
    
    // Calcular nova quantidade disponível
    const quantidadeEmprestada = livroAtual.quantidade_total - livroAtual.quantidade_disponivel;
    const novaQuantidadeDisponivel = Math.max(0, quantidade_total - quantidadeEmprestada);

    // Atualizar livro COM CÁLCULO CORRETO
    await connection.execute(
      `UPDATE livros 
       SET titulo = ?, autor = ?, isbn = ?, editora = ?, ano_publicacao = ?, 
           categoria = ?, quantidade_total = ?, quantidade_disponivel = ?, localizacao = ?
       WHERE id = ?`,
      [titulo, autor, isbn, editora, ano_publicacao, categoria, quantidade_total, novaQuantidadeDisponivel, localizacao, id]
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

// Rota para isentar multa - VERSÃO CORRIGIDA
app.put('/api/emprestimos/:id/isentar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        console.log(`📝 Isentando multa do empréstimo ${id}, motivo: ${motivo}`);

        const connection = await mysqlPool.getConnection();
        
        // Verificar se empréstimo existe
        const [emprestimo] = await connection.execute(
            'SELECT * FROM emprestimos WHERE id = ?',
            [id]
        );
        
        if (emprestimo.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                error: 'Empréstimo não encontrado'
            });
        }

        // Atualizar empréstimo com isenção
        await connection.execute(
            `UPDATE emprestimos 
             SET multa = 0,
                 isento = TRUE,
                 motivo_isencao = ?,
                 data_isencao = CURDATE()
             WHERE id = ?`,
            [motivo, id]
        );
        
        connection.release();

        console.log('✅ Multa isentada com sucesso');

        res.json({
            success: true,
            message: 'Multa isenta com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao isentar multa:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao isentar multa',
            message: error.message
        });
    }
});

// Rota para registrar pagamento de multa - VERSÃO CORRIGIDA
// Registrar pagamento de multa - ROTA CORRIGIDA
app.put('/api/emprestimos/:id/pagar', async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pagamento, comprovante } = req.body;

        console.log(`💰 Registrando pagamento do empréstimo ${id}`);

        const connection = await mysqlPool.getConnection();
        
        // Verificar se empréstimo existe
        const [emprestimo] = await connection.execute(
            'SELECT * FROM emprestimos WHERE id = ?',
            [id]
        );
        
        if (emprestimo.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                error: 'Empréstimo não encontrado'
            });
        }

        const emp = emprestimo[0];

        // Calcular valor da multa se for empréstimo ativo em atraso
        let valorMulta = emp.multa || 0;
        
        if (emp.status === 'ativo' && new Date(emp.data_devolucao_prevista) < new Date()) {
            const diasAtraso = Math.ceil((new Date() - new Date(emp.data_devolucao_prevista)) / (1000 * 60 * 60 * 24));
            valorMulta = diasAtraso * 2.0;
        }

        if (valorMulta <= 0) {
            connection.release();
            return res.status(400).json({
                success: false,
                error: 'Este empréstimo não possui multa pendente'
            });
        }

        // Registrar pagamento
        await connection.execute(
            `UPDATE emprestimos 
             SET multa = ?,
                 metodo_pagamento = ?,
                 comprovante_pagamento = ?,
                 data_pagamento = CURDATE(),
                 status = 'devolvido',
                 data_devolucao_efetiva = CURDATE()
             WHERE id = ?`,
            [valorMulta, metodo_pagamento, comprovante, id]
        );

        // Devolver livro ao acervo se estava emprestado
        if (emp.status === 'ativo') {
            await connection.execute(
                'UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?',
                [emp.livro_id]
            );
        }
        
        connection.release();

        console.log('✅ Pagamento registrado com sucesso');

        res.json({
            success: true,
            message: `Pagamento de R$ ${valorMulta.toFixed(2)} registrado com sucesso!`,
            data: {
                valor_pago: valorMulta,
                metodo_pagamento: metodo_pagamento
            }
        });

    } catch (error) {
        console.error('❌ Erro ao registrar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao registrar pagamento',
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

//Rota debug - Verificar multas
// Rota de debug para verificar dados de multas
app.get('/api/debug/multas-dados', async (req, res) => {
  try {
    const { data_inicial, data_final } = req.query;
    
    const dataInicial = data_inicial || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataFinal = data_final || new Date().toISOString().split('T')[0];

    const connection = await mysqlPool.getConnection();
    
    // Ver dados brutos de multas
    const [multasBrutas] = await connection.execute(`
      SELECT id, multa, status, data_devolucao_efetiva, data_devolucao_prevista
      FROM emprestimos 
      WHERE multa > 0 
      AND status = 'devolvido'
      AND data_devolucao_efetiva IS NOT NULL
      AND data_devolucao_efetiva BETWEEN ? AND ?
      LIMIT 10
    `, [dataInicial, dataFinal]);
    
    connection.release();

    res.json({
      success: true,
      dados: multasBrutas,
      total: multasBrutas.length
    });
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
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
  console.log('🚀 SERVIDOR RODANDO COM SUCESSO!');
  console.log(`📊 Banco: ${process.env.DB_NAME}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('📋 Endpoints disponíveis:');
  console.log(`   📚 Livros: http://localhost:${PORT}/api/livros`);
  console.log(`   📈 Dashboard: http://localhost:${PORT}/api/dashboard/estatisticas`);
  console.log(`   🔍 Health: http://localhost:${PORT}/api/health`);
});