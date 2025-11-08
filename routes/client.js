const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const anamnesisFields = [
  'BirthDate',
  'Occupation',
  'Phone',
  'RG',
  'CPF',
  'ShoeType',
  'SockType',
  'BladeType',
  'HasSomeoneCareNails',
  'HasSomeoneCareCuticles',
  'BitesNails',
  'Medication',
  'HasPainSensitivity',
  'HasDiabetes',
  'DiabetesType',
  'HasAllergy',
  'AllergyDetails',
  'HasHypertension',
  'HadSurgery',
  'SurgeryDetails',
  'HasInfectiousDisease',
  'InfectiousDiseaseDetails',
  'HasVascularDisease',
  'VascularDiseaseDetails',
  'UsesAnticoagulant',
  'HasThyroidCondition',
  'IsPregnant',
  'PregnancyWeeks',
  'UnderMedicalTreatment',
  'MedicalSpecialty',
  'HasCramps',
  'HasVarices',
  'OtherSymptoms',
  'ObservationsLeftFoot',
  'ObservationsRightFoot',
  'ProfessionalNotes',
  'HasOnychomycosis',
  'HasDermatophytosis',
  'HasParonychia',
  'HasDystrophy',
  'HasTorque'
];

const booleanFields = new Set([
  'HasSomeoneCareNails',
  'HasSomeoneCareCuticles',
  'BitesNails',
  'HasPainSensitivity',
  'HasDiabetes',
  'HasAllergy',
  'HasHypertension',
  'HadSurgery',
  'HasInfectiousDisease',
  'HasVascularDisease',
  'UsesAnticoagulant',
  'HasThyroidCondition',
  'IsPregnant',
  'UnderMedicalTreatment',
  'HasCramps',
  'HasVarices',
  'HasOnychomycosis',
  'HasDermatophytosis',
  'HasParonychia',
  'HasDystrophy',
  'HasTorque'
]);

const numericFields = new Set(['PregnancyWeeks']);
const dateFields = new Set(['BirthDate']);

const selectAnamnesisColumns = anamnesisFields.map((field) => `ca.${field}`).join(', ');

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeAnamnesisValue = (field, value) => {
  if (value === undefined || value === null) return null;

  if (booleanFields.has(field)) {
    if (value === '') return null;
    return value ? 1 : 0;
  }

  if (numericFields.has(field)) {
    if (value === '' || Number.isNaN(Number(value))) return null;
    return Number(value);
  }

  if (dateFields.has(field)) {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }

  if (typeof value === 'string') {
    return normalizeText(value);
  }

  return value;
};

const buildAnamnesisValues = (body) =>
  anamnesisFields.map((field) => normalizeAnamnesisValue(field, body[field]));

// Criar cliente
router.post('/', (req, res) => {
  const { Name, Adress, Habits, Accompaniment } = req.body;

  const clientValues = [
    normalizeText(Name),
    normalizeText(Adress),
    normalizeText(Habits),
    normalizeText(Accompaniment)
  ];

  const anamnesisValues = buildAnamnesisValues(req.body);

  db.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error('Erro ao iniciar transação:', transactionError);
      return res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    }

    const clientSql =
      'INSERT INTO client (Name, Adress, Habits, Accompaniment) VALUES (?, ?, ?, ?)';

    db.query(clientSql, clientValues, (clientErr, clientResult) => {
      if (clientErr) {
        console.error(clientErr);
        return db.rollback(() =>
          res.status(500).json({ error: 'Erro ao cadastrar cliente' })
        );
      }

      const clientId = clientResult.insertId;
      const placeholders = anamnesisFields.map(() => '?').join(', ');
      const anamnesisSql = `
        INSERT INTO client_anamnesis (ClientId, ${anamnesisFields.join(', ')})
        VALUES (?, ${placeholders})
      `;

      db.query(
        anamnesisSql,
        [clientId, ...anamnesisValues],
        (anamnesisErr) => {
          if (anamnesisErr) {
            console.error('Erro ao salvar anamnese:', anamnesisErr);
            return db.rollback(() =>
              res.status(500).json({ error: 'Erro ao cadastrar anamnese do cliente' })
            );
          }

          db.commit((commitErr) => {
            if (commitErr) {
              console.error('Erro ao finalizar transação:', commitErr);
              return db.rollback(() =>
                res.status(500).json({ error: 'Erro ao cadastrar cliente' })
              );
            }

            res.status(201).json({ id: clientId, ...req.body });
          });
        }
      );
    });
  });
});

// Deletar cliente por ID
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const deletePhotosSql = 'DELETE FROM client_photos WHERE ClientId = ?';
  const sql = 'DELETE FROM client WHERE Id = ?';
  db.query(deletePhotosSql, [id], (err) => {
    if (err) {
      console.error('Erro ao deletar fotos do cliente:', err);
      return res.status(500).json({ error: 'Erro ao deletar fotos do cliente' });
    }

    db.query(sql, [id], (deleteErr, result) => {
      if (deleteErr) {
        console.error('Erro ao deletar cliente:', deleteErr);
        return res.status(500).json({ error: 'Erro ao deletar cliente' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.status(200).json({ message: 'Cliente e fotos deletados com sucesso' });
    });
  });
});

// Listar todos os clientes
router.get('/', (req, res) => {
  const sql = `
    SELECT c.*${selectAnamnesisColumns ? `, ${selectAnamnesisColumns}` : ''}
    FROM client c
    LEFT JOIN client_anamnesis ca ON ca.ClientId = c.Id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
    res.json(results);
  });
});

// Buscar cliente por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT c.*${selectAnamnesisColumns ? `, ${selectAnamnesisColumns}` : ''}
    FROM client c
    LEFT JOIN client_anamnesis ca ON ca.ClientId = c.Id
    WHERE c.Id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(results[0]);
  });
});

// Atualizar um cliente existente
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { Name, Adress, Habits, Accompaniment } = req.body;

  const clientValues = [
    normalizeText(Name),
    normalizeText(Adress),
    normalizeText(Habits),
    normalizeText(Accompaniment),
    id
  ];

  const anamnesisValues = buildAnamnesisValues(req.body);
  const placeholders = anamnesisFields.map(() => '?').join(', ');
  const updateAssignments = anamnesisFields
    .map((field) => `${field} = VALUES(${field})`)
    .join(', ');

  const anamnesisSql = `
    INSERT INTO client_anamnesis (ClientId, ${anamnesisFields.join(', ')})
    VALUES (?, ${placeholders})
    ON DUPLICATE KEY UPDATE ${updateAssignments}
  `;

  db.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error('Erro ao iniciar transação:', transactionError);
      return res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }

    const sql = `
      UPDATE client
      SET Name = ?, Adress = ?, Habits = ?, Accompaniment = ?
      WHERE Id = ?
    `;

    db.query(sql, clientValues, (updateErr) => {
      if (updateErr) {
        console.error('Erro ao atualizar cliente:', updateErr);
        return db.rollback(() =>
          res.status(500).json({ error: 'Erro ao atualizar cliente' })
        );
      }

      db.query(
        anamnesisSql,
        [id, ...anamnesisValues],
        (anamnesisErr) => {
          if (anamnesisErr) {
            console.error('Erro ao atualizar anamnese:', anamnesisErr);
            return db.rollback(() =>
              res.status(500).json({ error: 'Erro ao atualizar anamnese do cliente' })
            );
          }

          db.commit((commitErr) => {
            if (commitErr) {
              console.error('Erro ao finalizar transação:', commitErr);
              return db.rollback(() =>
                res.status(500).json({ error: 'Erro ao atualizar cliente' })
              );
            }

            res.json({ message: 'Cliente atualizado com sucesso!' });
          });
        }
      );
    });
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

  const values = fotos.map((f) => [
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
