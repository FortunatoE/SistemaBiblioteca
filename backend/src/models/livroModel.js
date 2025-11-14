// src/models/livroModel.js
const { mysqlPool } = require('../config/database');

class LivroModel {
  async findAll() {
    const connection = await mysqlPool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM livros');
      return rows;
    } finally {
      connection.release();
    }
  }

  async findById(id) {
    const connection = await mysqlPool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM livros WHERE id = ?', [id]);
      return rows[0];
    } finally {
      connection.release();
    }
  }

  async create(livroData) {
    const connection = await mysqlPool.getConnection();
    try {
      const { titulo, autor, isbn, editora, ano_publicacao, categoria } = livroData;
      const [result] = await connection.execute(
        'INSERT INTO livros (titulo, autor, isbn, editora, ano_publicacao, categoria) VALUES (?, ?, ?, ?, ?, ?)',
        [titulo, autor, isbn, editora, ano_publicacao, categoria]
      );
      return this.findById(result.insertId);
    } finally {
      connection.release();
    }
  }
}

module.exports = new LivroModel();