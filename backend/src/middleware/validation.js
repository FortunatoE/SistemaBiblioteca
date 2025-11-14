// src/middleware/validation.js
const validateEmprestimo = (req, res, next) => {
    const { usuario_id, livro_id } = req.body;

    if (!usuario_id || !livro_id) {
        return res.status(400).json({
            success: false,
            error: 'usuario_id e livro_id são obrigatórios'
        });
    }

    if (isNaN(usuario_id) || isNaN(livro_id)) {
        return res.status(400).json({
            success: false,
            error: 'usuario_id e livro_id devem ser números'
        });
    }

    next();
};