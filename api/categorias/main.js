const router = require("express").Router();
const db = require("../../db/conexion");

router.get("/", (req, res, next) => {
    db.query("SELECT * FROM categoria")
        .then(([categorias]) => {
            console.log("id, nombre")
            res.status(200).json({ categorias });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ error });
        });
});

module.exports = router;