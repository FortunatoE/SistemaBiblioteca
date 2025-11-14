// src/controllers/livroController.js
const livroModel = require('../models/livroModel');

const livroController = {
  async listarLivros(req, res) {
    try {
      const livros = await livroModel.findAll();
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
  },

  async buscarLivro(req, res) {
    try {
      const { id } = req.params;
      const livro = await livroModel.findById(id);
      
      if (!livro) {
        return res.status(404).json({
          success: false,
          error: 'Livro não encontrado'
        });
      }

      res.json({
        success: true,
        data: livro
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar livro',
        message: error.message
      });
    }
  },

  async criarLivro(req, res) {
    try {
      const { titulo, autor, isbn, editora, ano_publicacao, categoria } = req.body;

      if (!titulo || !autor) {
        return res.status(400).json({
          success: false,
          error: 'Título e autor são obrigatórios'
        });
      }

      const novoLivro = await livroModel.create({
        titulo, autor, isbn, editora, ano_publicacao, categoria
      });

      res.status(201).json({
        success: true,
        data: novoLivro,
        message: 'Livro criado com sucesso!'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao criar livro',
        message: error.message
      });
    }
  }
};

module.exports = livroController;