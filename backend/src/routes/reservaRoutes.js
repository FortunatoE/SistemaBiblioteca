// src/routes/reservaRoutes.js
const express = require('express');
const router = express.Router();

// Rotas placeholder
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API de Reservas - Em desenvolvimento',
    endpoints: {
      listar: 'GET /api/reservas',
      criar: 'POST /api/reservas',
      cancelar: 'PUT /api/reservas/:id/cancelar'
    }
  });
});

module.exports = router;