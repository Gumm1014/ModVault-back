const router = require("express").Router({ mergeParams: true });
const path = require("path");
const fs = require("fs");
const db = require("../../db/conexion");
const { verificarToken } = require("../middlewares/autenticacion");
const { dirArchivos } = require("./funciones");

router.get("/", verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [mods] = await db.query(
      "SELECT nombre, archivo FROM mod_ WHERE id_mod = ?",
      [id]
    );
    if (mods.length === 0) {
      return res.status(404).json({ error: "Mod no encontrado" });
    }

    const mod = mods[0];
    const rutaArchivo = path.join(dirArchivos, mod.archivo);

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: "El archivo del mod no está disponible" });
    }

    await db.query("UPDATE mod_ SET descargas = descargas + 1 WHERE id_mod = ?", [id]);
    await db.query("INSERT IGNORE INTO descargas (id_usuario, id_mod) VALUES (?, ?)", [
      req.usuario.id,
      id,
    ]);

    res.download(rutaArchivo, `${mod.nombre}${path.extname(mod.archivo)}`);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;