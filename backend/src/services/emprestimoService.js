// src/services/emprestimoService.js
const livroModel = require('../models/livroModel');
const emprestimoModel = require('../models/emprestimoModel');
const Log = require('../models/Log');

class EmprestimoService {
    async realizarEmprestimo(usuarioId, livroId, userInfo = {}) {
        // Verificar se o livro está disponível
        const livro = await livroModel.findById(livroId);
        if (!livro) {
            throw new Error('Livro não encontrado');
        }

        if (livro.quantidade_disponivel < 1) {
            throw new Error('Livro não disponível para empréstimo');
        }

        // Verificar se usuário já tem este livro emprestado
        const emprestimoAtivo = await emprestimoModel.findEmprestimoAtivo(usuarioId, livroId);
        if (emprestimoAtivo) {
            throw new Error('Usuário já possui este livro emprestado');
        }

        // Verificar limite de empréstimos do usuário
        const emprestimosAtivos = await emprestimoModel.findEmprestimosAtivosPorUsuario(usuarioId);
        if (emprestimosAtivos.length >= 5) { // Limite de 5 empréstimos
            throw new Error('Limite de empréstimos atingido');
        }

        const connection = await require('../config/database').mysqlPool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Calcular data de devolução
            const dataDevolucao = new Date();
            dataDevolucao.setDate(dataDevolucao.getDate() + 15); // 15 dias

            // Criar empréstimo
            const emprestimo = await emprestimoModel.create({
                usuario_id: usuarioId,
                livro_id: livroId,
                data_emprestimo: new Date(),
                data_devolucao_prevista: dataDevolucao,
                status: 'ativo'
            }, connection);

            // Atualizar quantidade disponível
            await livroModel.updateQuantidadeDisponivel(
                livroId, 
                livro.quantidade_disponivel - 1
            );

            await connection.commit();

            // Log da ação
            await Log.create({
                acao: 'NOVO_EMPRESTIMO',
                usuario_id: usuarioId,
                usuario_nome: userInfo.nome || 'N/A',
                detalhes: {
                    livro_id: livroId,
                    livro_titulo: livro.titulo,
                    emprestimo_id: emprestimo.id
                },
                ip: userInfo.ip,
                user_agent: userInfo.user_agent
            });

            return emprestimo;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async realizarDevolucao(emprestimoId, userInfo = {}) {
        const emprestimo = await emprestimoModel.findById(emprestimoId);
        if (!emprestimo) {
            throw new Error('Empréstimo não encontrado');
        }

        if (emprestimo.status !== 'ativo') {
            throw new Error('Empréstimo já foi devolvido');
        }

        const connection = await require('../config/database').mysqlPool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Calcular multa se houver atraso
            const hoje = new Date();
            const dataPrevista = new Date(emprestimo.data_devolucao_prevista);
            let multa = 0;

            if (hoje > dataPrevista) {
                const diasAtraso = Math.ceil((hoje - dataPrevista) / (1000 * 60 * 60 * 24));
                multa = diasAtraso * 2.0; // R$ 2,00 por dia de atraso
            }

            // Atualizar empréstimo
            await emprestimoModel.update(emprestimoId, {
                data_devolucao_efetiva: hoje,
                status: 'devolvido',
                multa: multa
            }, connection);

            // Atualizar quantidade disponível do livro
            const livro = await livroModel.findById(emprestimo.livro_id);
            await livroModel.updateQuantidadeDisponivel(
                emprestimo.livro_id, 
                livro.quantidade_disponivel + 1
            );

            await connection.commit();

            // Log da ação
            await Log.create({
                acao: 'DEVOLUCAO_LIVRO',
                usuario_id: emprestimo.usuario_id,
                detalhes: {
                    emprestimo_id: emprestimoId,
                    livro_id: emprestimo.livro_id,
                    multa_calculada: multa,
                    dias_atraso: multa > 0 ? Math.ceil((hoje - dataPrevista) / (1000 * 60 * 60 * 24)) : 0
                },
                ip: userInfo.ip,
                user_agent: userInfo.user_agent
            });

            return { 
                success: true, 
                multa,
                mensagem: multa > 0 ? `Devolução com atraso. Multa: R$ ${multa.toFixed(2)}` : 'Devolução realizada com sucesso'
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new EmprestimoService();