const router = require("express").Router();
const fileUpload = require("express-fileupload");
const path = require("path");
const db = require("../../db/conexion");
const fs = require("fs");
const { verificarToken, soloAdmin } = require("../middlewares/autenticacion");

const dirImagenes = path.join(__dirname, "..", "..", "archivos", "imagenes");

router.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: "El archivo supera el tamaño máximo permitido",
  })
);

function nombreUnico(archivo, campo) {
  const ext = archivo.name.split(".").pop();
  return `${Date.now()}-${campo}.${ext}`;
}

function esImagen(archivo) {
  return archivo.mimetype.startsWith("image/");
}

router.get("/", (req, res, next) => {
  db.query("SELECT * FROM juego")
    .then(([juegos]) => {
      res.status(200).json({ juegos });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

router.get("/:id", (req, res, next) => {
  const { id } = req.params;

  db.query("SELECT * FROM juego WHERE id_juego = ?", [id])
    .then(([juegos]) => {
      if (juegos.length === 0) {
        return res.status(404).json({ error: "Juego no encontrado" });
      }
      res.status(200).json({ juego: juegos[0] });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});


router.post("/", verificarToken, soloAdmin, (req, res, next) => {
  const { nombre } = req.body;
  const files = req.files;

  if (!nombre || !files || !files.portada || !files.encabezado || !files.icono) {
    return res.status(400).json({
      error: "Faltan datos: nombre, portada, encabezado e icono son obligatorios",
    });
  }

  if (![files.portada, files.encabezado, files.icono].every(esImagen)) {
    return res.status(400).json({
      error: "La portada, el encabezado y el icono deben ser imágenes",
    });
  }

  const campos = ["portada", "encabezado", "icono"];
  const nombres = {};
  campos.forEach((campo) => {
    nombres[campo] = nombreUnico(files[campo], campo);
  });

  Promise.all(
    campos.map((campo) => files[campo].mv(path.join(dirImagenes, nombres[campo])))
  )
    .then(() => {
      const sql =
        "INSERT INTO juego (nombre, portada, encabezado, icono, id_usuario) VALUES (?, ?, ?, ?, ?)";
      return db.query(sql, [
        nombre,
        `imagenes/${nombres.portada}`,
        `imagenes/${nombres.encabezado}`,
        `imagenes/${nombres.icono}`,
        req.usuario.id,
      ]);
    })
    .then(([result]) => {
      res.status(201).json({ id_juego: result.insertId });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

router.put("/:id", verificarToken, soloAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { nombre } = req.body || {};
  const files = req.files || {};

  if (!Object.values(files).every(esImagen)) {
    return res.status(400).json({ error: "Los archivos deben ser imágenes" });
  }

  try {
    const [juegos] = await db.query("SELECT * FROM juego WHERE id_juego = ?", [id]);
    if (juegos.length === 0) {
      return res.status(404).json({ error: "Juego no encontrado" });
    }
    const actual = juegos[0];

    const campos = ["portada", "encabezado", "icono"];
    const rutas = {};
    for (const campo of campos) {
      if (files[campo]) {
        const nuevoNombre = nombreUnico(files[campo], campo);
        await files[campo].mv(path.join(dirImagenes, nuevoNombre));
        rutas[campo] = `imagenes/${nuevoNombre}`;
      } else {
        rutas[campo] = actual[campo];
      }
    }

    const sql =
      "UPDATE juego SET nombre = ?, portada = ?, encabezado = ?, icono = ? WHERE id_juego = ?";
    await db.query(sql, [
      nombre || actual.nombre,
      rutas.portada,
      rutas.encabezado,
      rutas.icono,
      id,
    ]);

    for (const campo of campos) {
      if (rutas[campo] !== actual[campo]) {
        fs.unlink(path.join(__dirname, "..", "..", "archivos", actual[campo]), () => { });
      }
    }

    res.status(200).json({ mensaje: "Juego actualizado" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;