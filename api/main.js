const router = require("express").Router();

const categoriasRouter = require("./categorias/main");
const juegosRouter = require("./juegos/main");
const usuariosRouter = require("./usuarios/main");

router.use("/categorias", categoriasRouter);
router.use("/juegos", juegosRouter);
router.use("/usuarios", usuariosRouter);

module.exports = router;



