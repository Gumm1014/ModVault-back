const jwt = require("jsonwebtoken");

const { TOKEN_SECRET } = process.env;

function verificarToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Falta el token" });
  }

  try {
    req.usuario = jwt.verify(token, TOKEN_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido o vencido" });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "No tenés permiso para esta acción" });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };