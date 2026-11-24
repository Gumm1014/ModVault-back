const router = require("express").Router({ mergeParams: true });
const db = require("../../db/conexion");

router.get("/", (req, res) => {
  const { id } = req.params;

  const sql = `SELECT e.id_etiqueta, e.nombre
    FROM etiqueta e
    JOIN mod_etiqueta me ON me.id_etiqueta = e.id_etiqueta
    WHERE me.id_mod = ?`;

  db.query(sql, [id])
    .then(([etiquetas]) => {
      res.status(200).json({ etiquetas });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

module.exports = router;