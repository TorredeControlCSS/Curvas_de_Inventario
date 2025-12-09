# Guía de Implementación - Seguimiento de Fechas de Vencimiento

## 📋 Resumen de Cambios

### ¿Qué se modificó?

He realizado los siguientes cambios en tu repositorio:

1. **Frontend (index.html)** - Ya modificado ✅
   - Agregué código para calcular inventario disponible vs vencido
   - La gráfica ahora muestra dos líneas: inventario total (gris) e inventario disponible (azul)
   - La tabla ahora tiene columnas: Total | Disponible | Vencido | Δ
   - Todos los cálculos estadísticos usan el inventario disponible

2. **Backend (Code.gs)** - Archivo NUEVO ✅
   - Script completo de Google Apps Script
   - Lee datos de vencimiento de tus archivos Excel
   - Proporciona API con datos de vencimiento al frontend

3. **Documentación** - Archivos NUEVOS ✅
   - Ejemplos y guías de uso

### ¿Necesitas hacer algo manualmente?

**NO** - El código del frontend (index.html) ya está modificado y funcionando.

**SÍ** - Necesitas configurar el backend siguiendo los pasos de esta guía.

---

## 🚀 Pasos para Implementar el Backend

### Paso 1: Preparar tus Archivos Excel

**¡BUENAS NOTICIAS!** El script ahora es más flexible y funciona con tu estructura actual.

#### Opción A: Si ya tienes los datos de vencimiento en tu hoja de Inventario ✅ RECOMENDADO

Si tu archivo Excel ya tiene columnas como estas en la hoja "Inventario":
- **Fecha Vto** o **Fecha_Vencimiento** o **Vencimiento**
- **Nº de Lote** (opcional, se detectará automáticamente)
- **Cantidad**

**¡No necesitas hacer nada!** El script automáticamente detectará y extraerá los datos de vencimiento.

**Ejemplo de estructura que ya funciona:**
```
| Fecha      | Código  | Grupo | Suministro | Nº de Lote | Fecha Vto  | Cantidad |
|------------|---------|-------|------------|------------|------------|----------|
| 04/12/2025 | 101097501| G1   | Abacavir..| E231419A   | 31/03/2026 | 6,000    |
| 04/12/2025 | 101097501| G1   | Abacavir..| E231419A   | 31/03/2026 | 1,380    |
```

El script:
- ✅ Detecta automáticamente la columna "Fecha Vto"
- ✅ Agrupa los datos por fecha y código para el inventario total
- ✅ Extrae cada registro con su fecha de vencimiento individual

#### Opción B: Hoja "Vencimientos" separada (para compatibilidad)

Si prefieres mantener los datos separados, puedes crear una hoja llamada **"Vencimientos"** con:

```
| Fecha      | Codigo  | Fecha_Vencimiento | Cantidad |
|------------|---------|-------------------|----------|
| 2024-01-15 | MED001  | 2024-02-01        | 200      |
| 2024-01-15 | MED001  | 2024-03-15        | 800      |
```

**El script soporta ambas opciones simultáneamente.**

### Paso 2: Configurar Google Apps Script

1. **Abre tu Google Sheet** "Inventario Consolidado"

2. **Ve a Extensiones → Apps Script**

3. **Copia el contenido del archivo `Code.gs`** que acabo de crear en tu repositorio

4. **Reemplaza TODO el código** en el editor de Apps Script con el contenido de `Code.gs`

5. **Modifica la línea 18** con el ID de tu carpeta de Google Drive:
   ```javascript
   const FOLDER_ID = 'TU_FOLDER_ID_AQUI'; // ← Reemplaza esto
   ```
   
   Para obtener el ID de tu carpeta:
   - Abre tu carpeta en Google Drive
   - Copia el ID de la URL: `https://drive.google.com/drive/folders/ID_ESTA_AQUI`

6. **Guarda el script** (Ctrl+S o Cmd+S)

### Paso 3: Activar Drive API

1. En el editor de Apps Script, ve a **Servicios** (icono de +)
2. Busca **"Drive API"**
3. Haz clic en **Agregar**

### Paso 4: Ejecutar Configuración Inicial

1. En el editor de Apps Script, selecciona la función **`setup`** en el menú desplegable
2. Haz clic en **Ejecutar** (▶️)
3. Autoriza el script cuando te lo pida (primera vez)
4. Verifica que se crearon 3 hojas: `Data`, `Index`, `Vencimientos`

### Paso 5: Ejecutar Consolidación

1. Selecciona la función **`consolidate`**
2. Haz clic en **Ejecutar** (▶️)
3. Espera a que termine (puede tardar varios minutos)
4. Verifica en la hoja `Vencimientos` que se hayan cargado datos

### Paso 6: Configurar Actualización Automática

1. Selecciona la función **`createDailyTrigger`**
2. Haz clic en **Ejecutar** (▶️)
3. Esto programará la actualización diaria a las 3:00 AM

### Paso 7: Publicar como Web App

1. En Apps Script, haz clic en **Implementar** → **Nueva implementación**
2. Tipo: **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquiera con el enlace**
4. Haz clic en **Implementar**
5. **Copia la URL** que te proporciona

### Paso 8: Actualizar Frontend (Ya está hecho ✅)

El archivo `index.html` ya está configurado con el endpoint:
```javascript
const API_BASE = 'https://script.google.com/macros/s/...';
```

Si necesitas cambiar la URL:
1. Abre `index.html`
2. Busca la línea 304: `const API_BASE = '...'`
3. Reemplaza con tu nueva URL del Web App

---

## 🧪 Probar la Implementación

### Opción A: Generar Datos de Prueba

Si no tienes datos reales de vencimiento aún:

1. En Apps Script, ejecuta la función **`generarDatosPruebaVencimientos`**
2. Esto creará 20 registros de prueba con el código "TEST001"
3. Abre tu dashboard y busca "TEST001"
4. Deberías ver dos líneas en la gráfica (total y disponible)

### Opción B: Usar Datos Reales

1. Asegúrate de que tus archivos Excel tengan la hoja "Vencimientos"
2. Ejecuta `consolidate()`
3. Ejecuta `testVencimientos()` para verificar los datos cargados
4. Abre tu dashboard y busca un producto

---

## 📊 Entendiendo los Resultados

### En la Gráfica

- **Línea gris (Inventario total)**: Inventario total incluyendo productos vencidos
- **Línea azul (Inventario disponible)**: Solo productos que aún no han vencido
- **Línea verde (Proyección)**: Basada en inventario disponible
- **Líneas naranjas/rojas**: Punto de reorden e inventario crítico

### En la Tabla

```
Fecha      | Total | Disponible | Vencido | Δ
-----------|-------|------------|---------|-----
2024-01-15 | 1,000 | 800        | 200     | -50
```

- **Total**: Todo el inventario físico
- **Disponible**: Lo que puedes usar (total - vencido)
- **Vencido**: Productos que ya pasaron su fecha de vencimiento
- **Δ**: Cambio respecto al día anterior

---

## 🔍 Solución de Problemas

### No veo la columna "Vencido" en mi tabla

**Causa**: No hay datos de vencimiento para ese producto.

**Solución**: 
- Verifica que tus archivos Excel tengan la hoja "Vencimientos"
- Ejecuta `consolidate()` de nuevo
- Ejecuta `testVencimientos()` para verificar

### Las dos líneas se ven iguales (Total = Disponible)

**Causa**: Todo tu inventario es válido (nada ha vencido) o no hay datos de vencimiento.

**Solución**: Esto es normal si:
- El producto no tiene fechas de vencimiento registradas
- Todas las fechas de vencimiento son futuras

### Error "Hoja Vencimientos no existe"

**Causa**: No ejecutaste `setup()`

**Solución**: 
1. Ejecuta la función `setup()` en Apps Script
2. Verifica que se creó la hoja "Vencimientos"

### La API no devuelve datos

**Causa**: La URL del Web App cambió o no está publicada correctamente.

**Solución**:
1. Ve a Apps Script → Implementar → Administrar implementaciones
2. Copia la URL del Web App
3. Actualiza `index.html` línea 304 con la nueva URL

---

## 📝 Estructura de Datos

### Formato de la API (Automático)

El script de Apps Script automáticamente formatea los datos así:

```json
{
  "serie": [
    {
      "fecha": "2024-01-15",
      "inventario": 1000,
      "vencimientos": [
        {"fecha_vencimiento": "2024-02-01", "cantidad": 200},
        {"fecha_vencimiento": "2024-03-15", "cantidad": 800}
      ]
    }
  ]
}
```

El frontend (index.html) lee estos datos y calcula:
- Total: 1000
- Vencido al 2024-01-15: 0 (ninguno ha vencido aún)
- Disponible: 1000

El frontend (index.html) lee estos datos y si la fecha actual fuera 2024-02-05:
- Total: 1000
- Vencido: 200 (la fecha 2024-02-01 ya pasó)
- Disponible: 800

---

## ✅ Checklist de Implementación

- [ ] Paso 1: Agregar hoja "Vencimientos" a archivos Excel
- [ ] Paso 2: Copiar Code.gs a Apps Script
- [ ] Paso 3: Configurar FOLDER_ID
- [ ] Paso 4: Activar Drive API
- [ ] Paso 5: Ejecutar `setup()`
- [ ] Paso 6: Ejecutar `consolidate()`
- [ ] Paso 7: Ejecutar `createDailyTrigger()`
- [ ] Paso 8: Publicar Web App
- [ ] Paso 9: Verificar URL en index.html (ya está ✅)
- [ ] Paso 10: Probar en el dashboard

---

## 💡 Notas Importantes

1. **El frontend ya está listo**: No necesitas modificar index.html manualmente, ya lo hice por ti.

2. **Compatibilidad hacia atrás**: Los productos sin datos de vencimiento funcionarán normalmente.

3. **Migración gradual**: Puedes agregar fechas de vencimiento producto por producto.

4. **Datos históricos**: Si no tienes fechas de vencimiento para datos antiguos, esos días mostrarán Total = Disponible.

---

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:

1. Revisa los logs en Apps Script (Ver → Registros)
2. Ejecuta `testVencimientos()` para verificar datos
3. Verifica que la hoja "Vencimientos" tenga el formato correcto
4. Consulta los ejemplos en `EXAMPLE_DATA.md`

---

## 📚 Archivos de Referencia

- `Code.gs` - Script de Google Apps Script (backend)
- `index.html` - Dashboard (frontend) - Ya modificado ✅
- `BACKEND_EXPIRATION_DATES.md` - Documentación técnica detallada
- `EXAMPLE_DATA.md` - Ejemplos de datos y casos de uso
- `IMPLEMENTATION_SUMMARY.md` - Resumen de cambios técnicos
