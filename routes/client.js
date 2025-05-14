const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Criar cliente
router.post('/', (req, res) => {
    const { Name, Adress, Habits, Accompaniment } = req.body;
    const sql = "INSERT INTO client (Name, Adress, Habits, Accompaniment) VALUES (?, ?, ?, ?)";
    db.query(sql, [Name, Adress, Habits, Accompaniment], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao cadastrar cliente" });
        }
        res.status(201).json({ id: result.insertId, ...req.body });
    });
});
// Deletar cliente por ID
router.delete('/:id', (req, res) => {
    const id = req.params.id;
    const deletePhotosSql = "DELETE FROM client_photos WHERE ClientId = ?";
    const sql = "DELETE FROM client WHERE Id = ?";
    db.query(deletePhotosSql, [id], (err) => {
        if (err) {
            console.error("Erro ao deletar fotos do cliente:", err);
            return res.status(500).json({ error: "Erro ao deletar fotos do cliente" });
        }

        db.query(sql, [id], (err, result) => {
            if (err) {
                console.error("Erro ao deletar cliente:", err);
                return res.status(500).json({ error: "Erro ao deletar cliente" });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Cliente não encontrado" });
            }
            res.status(200).json({ message: "Cliente e fotos deletados com sucesso" });
        });
    });
});
// Listar todos os clientes
router.get('/', (req, res) => {
    db.query("SELECT * FROM client", (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao buscar clientes" });
        }
        res.json(results);
    });
});

// Buscar cliente por ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.query("SELECT * FROM client WHERE id = ?", [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao buscar cliente" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }
        res.json(results[0]);
    });
});

// Atualizar um cliente existente
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { Name, Adress, Habits, Accompaniment } = req.body;
  
    const sql = `
      UPDATE client
      SET Name = ?, Adress = ?, Habits = ?, Accompaniment = ?
      WHERE id = ?
    `;
  
    db.query(sql, [Name, Adress, Habits, Accompaniment, id], (err, result) => {
      if (err) {
        console.error("Erro ao atualizar cliente:", err);
        return res.status(500).json({ error: "Erro ao atualizar cliente" });
      }
  
      res.json({ message: "Cliente atualizado com sucesso!" });
    });
});


const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.memoryStorage(); 
const upload = multer({ storage });

// Upload de fotos
router.post('/:id/fotos', upload.array('fotos', 10), (req, res) => {
    const clienteId = req.params.id;
    const fotos = req.files;
  
    if (!fotos || fotos.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma foto enviada' });
    }
  
    const values = fotos.map(f => [
      clienteId,
      f.originalname,
      f.mimetype,
      f.buffer
    ]);
  
    const sql = 'INSERT INTO client_photos (ClientId, FileName, MimeType, Data) VALUES ?';
    db.query(sql, [values], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao salvar fotos' });
      }
      res.status(201).json({ mensagem: 'Fotos enviadas com sucesso' });
    });
  });

// Buscar fotos
router.get('/:id/fotos', (req, res) => {
    const clienteId = req.params.id;
  
    db.query(
      'SELECT Id, FileName FROM client_photos WHERE ClientId = ?',
      [clienteId],
      (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar fotos' });
        res.json(results);
      }
    );
  });

// Deletar foto
router.delete('/fotos/:id', (req, res) => {
    const id = req.params.id;
  
    db.query('DELETE FROM client_photos WHERE Id = ?', [id], (err, result) => {
      if (err || result.affectedRows === 0) return res.sendStatus(404);
      res.sendStatus(204);
    });
  });

router.get('/fotos/:id/imagem', (req, res) => {
    const id = req.params.id;
    
    db.query('SELECT MimeType, Data FROM client_photos WHERE Id = ?', [id], (err, results) => {
      if (err || results.length === 0) return res.sendStatus(404);
  
      res.set('Content-Type', results[0].MimeType);
      res.send(results[0].Data);
    });
  });
module.exports = router;
