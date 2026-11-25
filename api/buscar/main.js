const router = require("express").Router();
const db = require("../../db/conexion");

router.get("/", async (req, res) => {
  const texto = (req.query.texto || "").trim();

  if (!texto) {
    return res.status(200).json({ juegos: [], mods: [] });
  }

  const patron = `%${texto}%`;

  try {
    const [juegos] = await db.query(
      "SELECT id_juego, nombre, icono FROM juego WHERE nombre LIKE ?",
      [patron]
    );

    const sqlMods = `SELECT m.id_mod, m.nombre, m.descripcion_corta,
        j.nombre AS nombre_juego,
        (SELECT i.ruta FROM imagen i WHERE i.id_mod = m.id_mod
         ORDER BY i.id_imagen LIMIT 1) AS imagen
      FROM mod_ m
      JOIN juego j ON j.id_juego = m.id_juego
      WHERE m.nombre LIKE ?`;
    const [mods] = await db.query(sqlMods, [patron]);

    res.status(200).json({ juegos, mods });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;