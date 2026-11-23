const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { SALT_ROUNDS, TOKEN_SECRET } = process.env;

async function hashPass(passNueva) {
  return await bcrypt.hash(passNueva, parseInt(SALT_ROUNDS));
}

async function verificarPass(passNueva, passHash) {
  return await bcrypt.compare(passNueva, passHash);
}

function crearToken(usuario) {
  const payload = {
    id: usuario.id_usuario,
    nombre: usuario.nombre,
    rol: usuario.rol,
  };
  return jwt.sign(payload, TOKEN_SECRET, { expiresIn: "2h" });
}

module.exports = { hashPass, verificarPass, crearToken };