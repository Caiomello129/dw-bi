require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

/* CONEXÃO MYSQL */
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

/* TESTE MYSQL */
db.connect((err) => {

  if (err) {
    console.error('Erro MySQL:', err);
    return;
  }

  console.log('MySQL conectado.');
});

/* API */
app.get('/api/vendas', (req, res) => {

  const sql = `
    SELECT
      fv.venda_id AS id,
      dt.data_completa AS data,
      dp.nome_produto AS produto,
      cat.nome_categoria AS categoria,
      fv.quantidade,
      fv.valor_total AS valor

    FROM fato_vendas fv

    INNER JOIN dim_produto dp
      ON fv.produto_id = dp.produto_id

    INNER JOIN dim_categoria cat
      ON fv.categoria_id = cat.categoria_id

    INNER JOIN dim_tempo dt
      ON fv.tempo_id = dt.tempo_id

    WHERE fv.status_venda = 'CONCLUIDA'

    ORDER BY dt.data_completa DESC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      console.error(err);

      return res.status(500).json({
        erro: 'Erro ao buscar vendas'
      });
    }

    res.json(results);
  });
});

/* FRONT-END */
app.use(express.static('public'));

/* PORTA */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});