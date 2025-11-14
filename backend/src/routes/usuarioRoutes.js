// src/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();

// Rotas placeholder - vamos implementar depois
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API de Usuários - Em desenvolvimento',
    endpoints: {
      listar: 'GET /api/usuarios',
      buscar: 'GET /api/usuarios/:id',
      criar: 'POST /api/usuarios'
    }
  });
});

module.exports = router;