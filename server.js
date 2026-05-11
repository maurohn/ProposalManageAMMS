require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'amms_propuestas',
  password: '', // Assuming no password for local dev
  port: 5432,
});

// Initialize DB
pool.query(`
  CREATE TABLE IF NOT EXISTS propuestas (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) NOT NULL,
    version INT NOT NULL,
    cliente VARCHAR(255),
    titulo VARCHAR(255),
    estado_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(console.error);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini
// Ensure you have GEMINI_API_KEY in your .env file
const ai = new GoogleGenAI({});

app.post('/api/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('Parsing PDF...');
    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text;
    console.log(`PDF parsed. Length: ${pdfText.length} characters.`);

    console.log('Sending to Gemini for analysis...');
    
    const prompt = `
    Eres un experto comercial y técnico de AMMS Group.
    Lee el siguiente pliego de licitación y extrae la información para armar una propuesta técnica y económica.
    Devuelve la respuesta EXCLUSIVAMENTE en formato JSON válido, sin markdown, sin bloques de código, solo el JSON raw.
    
    El JSON debe tener EXACTAMENTE la siguiente estructura:
    {
      "titulo": "Título corto de la propuesta",
      "subtitulo": "Sistemas o detalle secundario",
      "cliente": "Nombre del cliente u organismo",
      "expediente": "Número de expediente o licitación",
      "resumen": "Resumen ejecutivo de 3 o 4 líneas vendiendo a AMMS Group",
      "enfoque": "Enfoque técnico (cómo vamos a resolver el problema)",
      "sugerencias_metodologia": ["Parrafo 1 de sugerencia técnica profunda...", "Parrafo 2 sugerencia de metodología...", "Parrafo 3 sobre gobernanza..."],
      "diferenciales": ["diferencial 1", "diferencial 2", "diferencial 3"],
      "capacidades": ["capacidad 1", "capacidad 2"],
      "renglones": [
        { "id": "Renglón 1", "servicio": "Descripción", "porcentaje": 50 }
      ],
      "equipo": [
        { "perfil": "Ej: Project Manager", "cantidad": 1, "horas": 40, "valor_hora": 50000, "responsabilidad": "Descripción corta" }
      ]
    }

    Intenta deducir qué perfiles se necesitan según las tecnologías mencionadas en el pliego (ej. si menciona Progress, Oracle, Java, QA, etc).
    Si no encuentras costos exactos, pon un valor_hora estimado razonable en pesos argentinos.

    Pliego:
    ${pdfText.substring(0, 30000)} // Limiting text to avoid token limits
    `;

    let response;
    let retries = 3;
    while(retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt,
          config: { temperature: 0.2 }
        });
        break; // Success
      } catch (err) {
        if ((err.status === 503 || err.status === 429) && retries > 1) {
          console.log(`Error ${err.status}, retrying in 4 seconds...`);
          await new Promise(r => setTimeout(r, 4000));
          retries--;
        } else {
          throw err;
        }
      }
    }

    let jsonStr = response.text;
    
    // Clean up potential markdown formatting from Gemini
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/, '').replace(/```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/, '').replace(/```$/, '');
    }

    const resultData = JSON.parse(jsonStr);
    console.log('Analysis successful.');
    
    res.json(resultData);
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    res.status(500).json({ error: error.message || 'Error processing PDF' });
  }
});

app.post('/api/propuestas', async (req, res) => {
  try {
    let { uuid, estado_json } = req.body;
    if (!uuid) {
      uuid = 'prop-' + Date.now();
    }
    
    const cliente = estado_json.general?.cliente || 'Sin Cliente';
    const titulo = estado_json.general?.titulo || 'Propuesta sin título';

    // Get current max version
    const verRes = await pool.query('SELECT COALESCE(MAX(version), 0) as max_v FROM propuestas WHERE uuid = $1', [uuid]);
    const nextVersion = parseInt(verRes.rows[0].max_v) + 1;

    const insert = await pool.query(
      'INSERT INTO propuestas (uuid, version, cliente, titulo, estado_json) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [uuid, nextVersion, cliente, titulo, estado_json]
    );

    res.json({ success: true, uuid, version: nextVersion });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: 'Error al guardar la propuesta' });
  }
});

app.get('/api/propuestas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT uuid, cliente, titulo, version, created_at
      FROM propuestas
      ORDER BY created_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: 'Error al listar las propuestas' });
  }
});

app.get('/api/propuestas/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const result = await pool.query('SELECT * FROM propuestas WHERE uuid = $1 ORDER BY version DESC', [uuid]);
    res.json(result.rows);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: 'Error al cargar la propuesta' });
  }
});

app.delete('/api/propuestas/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    await pool.query('DELETE FROM propuestas WHERE uuid = $1', [uuid]);
    res.json({ success: true });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: 'Error al eliminar la propuesta' });
  }
});

app.listen(port, () => {
  console.log(`AMMS Engine server running at http://localhost:${port}`);
});
