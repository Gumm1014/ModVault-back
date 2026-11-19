const router = require("express").Router();

const categoriasRouter = require("./categorias/main");

router.use("/categorias", categoriasRouter);

module.exports = router;