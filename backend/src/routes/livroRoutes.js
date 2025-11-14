// src/routes/livroRoutes.js
const express = require('express');
const router = express.Router();

// ✅ CORRIJA O CAMINHO DO CONTROLLER - use caminho relativo correto
const livroController = require('../controllers/livroController');

// GET /api/livros - Listar todos os livros
router.get('/', livroController.listarLivros);

// GET /api/livros/:id - Buscar livro por ID
router.get('/:id', livroController.buscarLivro);

// POST /api/livros - Criar novo livro
router.post('/', livroController.criarLivro);

module.exports = router;