const router = require("express").Router({ mergeParams: true });
const db = require("../../db/conexion");
const { verificarToken } = require("../middlewares/autenticacion");

router.post("/", verificarToken, async (req, res) => {
  const { id } = req.params;
  const idUsuario = req.usuario.id;

  try {
    const [mods] = await db.query("SELECT id_mod FROM mod_ WHERE id_mod = ?", [id]);
    if (mods.length === 0) {
      return res.status(404).json({ error: "Mod no encontrado" });
    }

    const [likes] = await db.query(
      "SELECT * FROM me_gusta WHERE id_usuario = ? AND id_mod = ?",
      [idUsuario, id]
    );

    let leGusta;
    if (likes.length === 0) {
      await db.query("INSERT INTO me_gusta (id_usuario, id_mod) VALUES (?, ?)", [
        idUsuario,
        id,
      ]);
      leGusta = true;
    } else {
      await db.query("DELETE FROM me_gusta WHERE id_usuario = ? AND id_mod = ?", [
        idUsuario,
        id,
      ]);
      leGusta = false;
    }

    await db.query(
      "UPDATE mod_ SET likes = (SELECT COUNT(*) FROM me_gusta WHERE id_mod = ?) WHERE id_mod = ?",
      [id, id]
    );

    const [actualizado] = await db.query("SELECT likes FROM mod_ WHERE id_mod = ?", [id]);

    res.status(200).json({ le_gusta: leGusta, likes: actualizado[0].likes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = router;