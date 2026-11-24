const path = require("path");
const db = require("../../db/conexion");

const dirArchivos = path.join(__dirname, "..", "..", "archivos");
const MAX_MOD = 100 * 1024 * 1024;
const MAX_IMAGEN = 5 * 1024 * 1024;
const MAX_ETIQUETA = 50;

function nombreUnico(archivo, campo) {
  const ext = archivo.name.split(".").pop();
  return `${Date.now()}-${campo}.${ext}`;
}

function esImagen(archivo) {
  return archivo.mimetype.startsWith("image/");
}

function puedeBorrar(usuario, mod) {
  return usuario.rol === "admin" || mod.id_usuario === usuario.id;
}

function limpiarEtiquetas(texto) {
  if (!texto) return [];
  const lista = texto
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== "");
  return [...new Set(lista)];
}

function etiquetasValidas(lista) {
  return lista.every(
    (e) => e.length <= MAX_ETIQUETA && /^[a-z0-9áéíóúüñ -]+$/.test(e)
  );
}

async function asignarEtiquetas(idMod, lista) {
  for (const nombre of lista) {
    await db.query("INSERT IGNORE INTO etiqueta (nombre) VALUES (?)", [nombre]);
    const [filas] = await db.query(
      "SELECT id_etiqueta FROM etiqueta WHERE nombre = ?",
      [nombre]
    );
    await db.query(
      "INSERT IGNORE INTO mod_etiqueta (id_mod, id_etiqueta) VALUES (?, ?)",
      [idMod, filas[0].id_etiqueta]
    );
  }
}

async function actualizarEtiquetas(idMod, nuevas) {
  const [actuales] = await db.query(
    `SELECT e.id_etiqueta, e.nombre
     FROM mod_etiqueta me
     JOIN etiqueta e ON e.id_etiqueta = me.id_etiqueta
     WHERE me.id_mod = ?`,
    [idMod]
  );

  for (const actual of actuales) {
    if (!nuevas.includes(actual.nombre)) {
      await db.query(
        "DELETE FROM mod_etiqueta WHERE id_mod = ? AND id_etiqueta = ?",
        [idMod, actual.id_etiqueta]
      );
    }
  }

  await asignarEtiquetas(idMod, nuevas);
}

function borrarEtiquetasSinUso() {
  return db.query(
    "DELETE FROM etiqueta WHERE id_etiqueta NOT IN (SELECT id_etiqueta FROM mod_etiqueta)"
  );
}

module.exports = {
  dirArchivos,
  MAX_MOD,
  MAX_IMAGEN,
  nombreUnico,
  esImagen,
  puedeBorrar,
  limpiarEtiquetas,
  etiquetasValidas,
  asignarEtiquetas,
  actualizarEtiquetas,
  borrarEtiquetasSinUso,
};