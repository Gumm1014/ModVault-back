const router = require("express").Router();

const categoriasRouter = require("./categorias/main");
const juegosRouter = require("./juegos/main");
const usuariosRouter = require("./usuarios/main");
const modsRouter = require("./mods/main");

router.use("/categorias", categoriasRouter);
router.use("/juegos", juegosRouter);
router.use("/usuarios", usuariosRouter);
router.use("/mods", modsRouter);

module.exports = router;



