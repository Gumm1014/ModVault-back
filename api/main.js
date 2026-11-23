const router = require("express").Router();

const categoriasRouter = require("./categorias/main");
const juegosRouter = require("./juegos/main");

router.use("/categorias", categoriasRouter);
router.use("/juegos", juegosRouter);

module.exports = router;