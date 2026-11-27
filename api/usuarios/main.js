const router = require("express").Router();
const db = require("../../db/conexion");
const { hashPass, verificarPass, crearToken } = require("./funciones");
const { verificarToken } = require("../middlewares/autenticacion");

router.post("/registro", (req, res, next) => {
  const { nombre, correo, contrasena } = req.body || {};

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({
      error: "Faltan datos: nombre, correo y contraseña son obligatorios",
    });
  }

  hashPass(contrasena)
    .then((hash) => {
      const sql =
        "INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES (?, ?, ?, 'usuario')";
      return db.query(sql, [nombre, correo, hash]);
    })
    .then(([result]) => {
      res.status(201).json({ id_usuario: result.insertId });
    })
    .catch((error) => {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
      }
      console.log(error);
      res.status(500).json({ error });
    });
});

router.post("/login", async (req, res, next) => {
  const { correo, contrasena } = req.body || {};

  if (!correo || !contrasena) {
    return res.status(400).json({
      error: "Faltan datos: correo y contraseña son obligatorios",
    });
  }

  try {
    const sql =
      "SELECT id_usuario, nombre, contrasena, rol FROM usuario WHERE correo = ?";
    const [usuarios] = await db.query(sql, [correo]);

    if (usuarios.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const usuario = usuarios[0];
    const coincide = await verificarPass(contrasena, usuario.contrasena);

    if (!coincide) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const token = crearToken(usuario);
    res.status(200).json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

router.get("/mis-mods", verificarToken, (req, res) => {
  const sql = `SELECT m.id_mod, m.nombre, m.descripcion_corta, m.likes, m.descargas,
      m.id_categoria, m.id_juego,
      j.nombre AS nombre_juego,
      (SELECT i.ruta FROM imagen i WHERE i.id_mod = m.id_mod
       ORDER BY i.id_imagen LIMIT 1) AS imagen
    FROM mod_ m
    JOIN juego j ON j.id_juego = m.id_juego
    WHERE m.id_usuario = ?`;

  db.query(sql, [req.usuario.id])
    .then(([mods]) => {
      res.status(200).json({ mods });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

router.get("/mis-descargas", verificarToken, (req, res) => {
  const sql = `SELECT m.id_mod, m.nombre, m.descripcion_corta, m.likes, m.descargas,
      m.id_categoria, m.id_juego,
      j.nombre AS nombre_juego,
      (SELECT i.ruta FROM imagen i WHERE i.id_mod = m.id_mod
       ORDER BY i.id_imagen LIMIT 1) AS imagen
    FROM descargas d
    JOIN mod_ m ON m.id_mod = d.id_mod
    JOIN juego j ON j.id_juego = m.id_juego
    WHERE d.id_usuario = ?`;

  db.query(sql, [req.usuario.id])
    .then(([mods]) => {
      res.status(200).json({ mods });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

module.exports = router;