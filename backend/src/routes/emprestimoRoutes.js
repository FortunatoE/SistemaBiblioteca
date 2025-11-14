// src/routes/emprestimoRoutes.js
const express = require('express');
const router = express.Router();

// Rotas placeholder
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API de Empréstimos - Em desenvolvimento',
    endpoints: {
      listar: 'GET /api/emprestimos',
      criar: 'POST /api/emprestimos',
      devolver: 'PUT /api/emprestimos/:id/devolucao'
    }
  });
});

module.exports = router;