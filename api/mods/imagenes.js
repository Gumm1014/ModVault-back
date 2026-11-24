const router = require("express").Router({ mergeParams: true });
const path = require("path");
const fs = require("fs");
const db = require("../../db/conexion");
const { verificarToken } = require("../middlewares/autenticacion");
const { dirArchivos, MAX_IMAGEN, nombreUnico, esImagen } = require("./funciones");

router.get("/", (req, res, next) => {
  const { id } = req.params;

  db.query("SELECT * FROM imagen WHERE id_mod = ?", [id])
    .then(([imagenes]) => {
      res.status(200).json({ imagenes });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

router.post("/", verificarToken, async (req, res, next) => {
  const { id } = req.params;
  const files = req.files || {};

  if (!files.imagenes) {
    return res.status(400).json({ error: "Falta el campo imagenes" });
  }

  const subidas = [].concat(files.imagenes);

  if (!subidas.every((img) => esImagen(img) && img.size <= MAX_IMAGEN)) {
    return res.status(400).json({
      error: "Todas las imágenes deben ser archivos de imagen de hasta 5 MB",
    });
  }

  try {
    const [mods] = await db.query("SELECT id_usuario FROM mod_ WHERE id_mod = ?", [id]);
    if (mods.length === 0) {
      return res.status(404).json({ error: "Mod no encontrado" });
    }
    if (mods[0].id_usuario !== req.usuario.id) {
      return res.status(403).json({ error: "Solo el dueño puede agregar imágenes" });
    }

    for (let i = 0; i < subidas.length; i++) {
      const nombre = nombreUnico(subidas[i], `galeria${i}`);
      await subidas[i].mv(path.join(dirArchivos, "galeria", nombre));
      await db.query("INSERT INTO imagen (ruta, id_mod) VALUES (?, ?)", [
        `galeria/${nombre}`,
        id,
      ]);
    }

    res.status(201).json({ mensaje: "Imágenes agregadas", cantidad: subidas.length });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

router.delete("/:idImagen", verificarToken, async (req, res, next) => {
  const { id, idImagen } = req.params;

  try {
    const [mods] = await db.query("SELECT id_usuario FROM mod_ WHERE id_mod = ?", [id]);
    if (mods.length === 0) {
      return res.status(404).json({ error: "Mod no encontrado" });
    }
    if (mods[0].id_usuario !== req.usuario.id) {
      return res.status(403).json({ error: "Solo el dueño puede borrar imágenes" });
    }

    const [imagenes] = await db.query(
      "SELECT * FROM imagen WHERE id_imagen = ? AND id_mod = ?",
      [idImagen, id]
    );
    if (imagenes.length === 0) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    await db.query("DELETE FROM imagen WHERE id_imagen = ?", [idImagen]);
    fs.unlink(path.join(dirArchivos, imagenes[0].ruta), () => {});

    res.status(200).json({ mensaje: "Imagen eliminada" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;