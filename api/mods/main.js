const router = require("express").Router();
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const db = require("../../db/conexion");
const { verificarToken } = require("../middlewares/autenticacion");

const dirArchivos = path.join(__dirname, "..", "..", "archivos");
const MAX_MOD = 500 * 1024 * 1024;
const MAX_IMAGEN = 5 * 1024 * 1024;

router.use(
    fileUpload({
        createParentPath: true,
        limits: { fileSize: MAX_MOD },
        abortOnLimit: true,
        responseOnLimit: "El archivo supera el tamaño máximo permitido",
    })
);

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

router.get("/", (req, res, next) => {
    db.query("SELECT * FROM mod_")
        .then(([mods]) => {
            res.status(200).json({ mods });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ error });
        });
});

router.get("/:id", (req, res, next) => {
    const { id } = req.params;

    db.query("SELECT * FROM mod_ WHERE id_mod = ?", [id])
        .then(([mods]) => {
            if (mods.length === 0) {
                return res.status(404).json({ error: "Mod no encontrado" });
            }
            res.status(200).json({ mod: mods[0] });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ error });
        });
});

router.post("/", verificarToken, async (req, res, next) => {
    const {
        nombre,
        version,
        descripcion_corta,
        descripcion_larga,
        id_categoria,
        id_juego,
    } = req.body || {};
    const files = req.files || {};

    const etiquetas = limpiarEtiquetas((req.body || {}).etiquetas);
    if (!etiquetasValidas(etiquetas)) {
        return res.status(400).json({
            error: "Las etiquetas solo pueden tener letras, números, espacios y guiones, hasta 50 caracteres cada una",
        });
    }

    if (
        !nombre ||
        !version ||
        !descripcion_corta ||
        !descripcion_larga ||
        !id_categoria ||
        !id_juego ||
        !files.archivo ||
        !files.encabezado
    ) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    if (!esImagen(files.encabezado) || files.encabezado.size > MAX_IMAGEN) {
        return res
            .status(400)
            .json({ error: "El encabezado debe ser una imagen de hasta 5 MB" });
    }

    const nombreArchivo = nombreUnico(files.archivo, "archivo");
    const nombreEncabezado = nombreUnico(files.encabezado, "encabezado");

    try {
        await files.archivo.mv(path.join(dirArchivos, "mods", nombreArchivo));
        await files.encabezado.mv(path.join(dirArchivos, "imagenes", nombreEncabezado));

        const sql = `INSERT INTO mod_
      (nombre, version, descripcion_corta, descripcion_larga, archivo, encabezado,
       likes, descargas, id_usuario, id_categoria, id_juego)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`;
        const [result] = await db.query(sql, [
            nombre,
            version,
            descripcion_corta,
            descripcion_larga,
            `mods/${nombreArchivo}`,
            `imagenes/${nombreEncabezado}`,
            req.usuario.id,
            id_categoria,
            id_juego,
        ]);

        await asignarEtiquetas(result.insertId, etiquetas);

        res.status(201).json({ id_mod: result.insertId });
    } catch (error) {
        fs.unlink(path.join(dirArchivos, "mods", nombreArchivo), () => { });
        fs.unlink(path.join(dirArchivos, "imagenes", nombreEncabezado), () => { });

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ error: "El juego o la categoría no existen" });
        }
        console.log(error);
        res.status(500).json({ error });
    }
});

router.put("/:id", verificarToken, async (req, res, next) => {
    const { id } = req.params;
    const body = req.body || {};
    const files = req.files || {};

    const etiquetas = limpiarEtiquetas(body.etiquetas);
    if (!etiquetasValidas(etiquetas)) {
        return res.status(400).json({
            error: "Las etiquetas solo pueden tener letras, números, espacios y guiones, hasta 50 caracteres cada una",
        });
    }

    if (files.encabezado && (!esImagen(files.encabezado) || files.encabezado.size > MAX_IMAGEN)) {
        return res
            .status(400)
            .json({ error: "El encabezado debe ser una imagen de hasta 5 MB" });
    }

    let nuevoArchivo;
    let nuevoEncabezado;

    try {
        const [mods] = await db.query("SELECT * FROM mod_ WHERE id_mod = ?", [id]);
        if (mods.length === 0) {
            return res.status(404).json({ error: "Mod no encontrado" });
        }
        const actual = mods[0];

        if (actual.id_usuario !== req.usuario.id) {
            return res.status(403).json({ error: "Solo el dueño puede editar este mod" });
        }

        let rutaArchivo = actual.archivo;
        let rutaEncabezado = actual.encabezado;

        if (files.archivo) {
            nuevoArchivo = nombreUnico(files.archivo, "archivo");
            await files.archivo.mv(path.join(dirArchivos, "mods", nuevoArchivo));
            rutaArchivo = `mods/${nuevoArchivo}`;
        }

        if (files.encabezado) {
            nuevoEncabezado = nombreUnico(files.encabezado, "encabezado");
            await files.encabezado.mv(path.join(dirArchivos, "imagenes", nuevoEncabezado));
            rutaEncabezado = `imagenes/${nuevoEncabezado}`;
        }

        const sql = `UPDATE mod_ SET
      nombre = ?, version = ?, descripcion_corta = ?, descripcion_larga = ?,
      archivo = ?, encabezado = ?, id_categoria = ?, id_juego = ?
      WHERE id_mod = ?`;
        await db.query(sql, [
            body.nombre || actual.nombre,
            body.version || actual.version,
            body.descripcion_corta || actual.descripcion_corta,
            body.descripcion_larga || actual.descripcion_larga,
            rutaArchivo,
            rutaEncabezado,
            body.id_categoria || actual.id_categoria,
            body.id_juego || actual.id_juego,
            id,
        ]);

        if (body.etiquetas !== undefined) {
            await actualizarEtiquetas(id, etiquetas);
            await borrarEtiquetasSinUso();
        }

        if (rutaArchivo !== actual.archivo) {
            fs.unlink(path.join(dirArchivos, actual.archivo), () => { });
        }
        if (rutaEncabezado !== actual.encabezado) {
            fs.unlink(path.join(dirArchivos, actual.encabezado), () => { });
        }

        res.status(200).json({ mensaje: "Mod actualizado" });
    } catch (error) {
        if (nuevoArchivo) {
            fs.unlink(path.join(dirArchivos, "mods", nuevoArchivo), () => { });
        }
        if (nuevoEncabezado) {
            fs.unlink(path.join(dirArchivos, "imagenes", nuevoEncabezado), () => { });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ error: "El juego o la categoría no existen" });
        }
        console.log(error);
        res.status(500).json({ error });
    }
});

router.delete("/:id", verificarToken, async (req, res, next) => {
    const { id } = req.params;

    try {
        const [mods] = await db.query("SELECT * FROM mod_ WHERE id_mod = ?", [id]);
        if (mods.length === 0) {
            return res.status(404).json({ error: "Mod no encontrado" });
        }
        const actual = mods[0];

        if (!puedeBorrar(req.usuario, actual)) {
            return res.status(403).json({ error: "No tenés permiso para borrar este mod" });
        }

        const [imagenes] = await db.query("SELECT ruta FROM imagen WHERE id_mod = ?", [id]);

        await db.query("DELETE FROM mod_ WHERE id_mod = ?", [id]);

        await borrarEtiquetasSinUso();

        fs.unlink(path.join(dirArchivos, actual.archivo), () => { });
        fs.unlink(path.join(dirArchivos, actual.encabezado), () => { });

        imagenes.forEach((img) => {
            fs.unlink(path.join(dirArchivos, img.ruta), () => { });
        });

        res.status(200).json({ mensaje: "Mod eliminado" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

//--------------------------------

router.get("/:id/imagenes", (req, res, next) => {
    const { id } = req.params;

    db.query("SELECT * FROM imagen WHERE id_mod = ?", [id])
        .then(([imagenes]) => {
            res.status(200).json({ imagenes });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ error });
        });
});

router.post("/:id/imagenes", verificarToken, async (req, res, next) => {
    const { id } = req.params;
    const files = req.files || {};

    if (!files.imagenes) {
        return res.status(400).json({ error: "Falta el campo imagenes" });
    }

    const subidas = [].concat(files.imagenes);

    if (!subidas.every((img) => esImagen(img) && img.size <= MAX_IMAGEN)) {
        return res.status(400).json({
            error: "Todas las imágenes deben ser archivos de imagen de hasta 5 MB",
        });
    }

    try {
        const [mods] = await db.query("SELECT id_usuario FROM mod_ WHERE id_mod = ?", [id]);
        if (mods.length === 0) {
            return res.status(404).json({ error: "Mod no encontrado" });
        }
        if (mods[0].id_usuario !== req.usuario.id) {
            return res.status(403).json({ error: "Solo el dueño puede agregar imágenes" });
        }

        for (let i = 0; i < subidas.length; i++) {
            const nombre = nombreUnico(subidas[i], `galeria${i}`);
            await subidas[i].mv(path.join(dirArchivos, "galeria", nombre));
            await db.query("INSERT INTO imagen (ruta, id_mod) VALUES (?, ?)", [
                `galeria/${nombre}`,
                id,
            ]);
        }

        res.status(201).json({ mensaje: "Imágenes agregadas", cantidad: subidas.length });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

router.delete("/:id/imagenes/:idImagen", verificarToken, async (req, res, next) => {
    const { id, idImagen } = req.params;

    try {
        const [mods] = await db.query("SELECT id_usuario FROM mod_ WHERE id_mod = ?", [id]);
        if (mods.length === 0) {
            return res.status(404).json({ error: "Mod no encontrado" });
        }
        if (mods[0].id_usuario !== req.usuario.id) {
            return res.status(403).json({ error: "Solo el dueño puede borrar imágenes" });
        }

        const [imagenes] = await db.query(
            "SELECT * FROM imagen WHERE id_imagen = ? AND id_mod = ?",
            [idImagen, id]
        );
        if (imagenes.length === 0) {
            return res.status(404).json({ error: "Imagen no encontrada" });
        }

        await db.query("DELETE FROM imagen WHERE id_imagen = ?", [idImagen]);
        fs.unlink(path.join(dirArchivos, imagenes[0].ruta), () => { });

        res.status(200).json({ mensaje: "Imagen eliminada" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
});

//-----------------------------------------
const MAX_ETIQUETA = 50;

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

router.get("/:id/etiquetas", (req, res, next) => {
  const { id } = req.params;

  const sql = `SELECT e.id_etiqueta, e.nombre
    FROM etiqueta e
    JOIN mod_etiqueta me ON me.id_etiqueta = e.id_etiqueta
    WHERE me.id_mod = ?`;

  db.query(sql, [id])
    .then(([etiquetas]) => {
      res.status(200).json({ etiquetas });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

module.exports = router;