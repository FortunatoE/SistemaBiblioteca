// src/middleware/auth.js
const authMiddleware = (req, res, next) => {
    // Simulação de autenticação - em produção usar JWT
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Acesso não autorizado. Token necessário.'
        });
    }

    try {
        // Em produção, validar JWT aqui
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // req.user = decoded;
        
        // Por enquanto, apenas simulação
        req.user = { id: '1', nome: 'Usuário Teste', tipo: 'admin' };
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Token inválido'
        });
    }
};

module.exports = authMiddleware;