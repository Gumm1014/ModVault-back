const router = require("express").Router();
const db = require("../../db/conexion");
const { hashPass, verificarPass, crearToken } = require("./funciones");

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
    res.status(200).json({ token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;