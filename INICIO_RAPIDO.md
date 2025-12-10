# 🚀 Inicio Rápido - Solución al Error CORS

## ⚠️ ¿Ves este error?

```
Access to fetch at 'https://script.google.com/...' has been blocked by CORS policy
```

**¡Tranquilo! Aquí está la solución rápida.**

---

## ✅ Solución en 3 Pasos (5 minutos)

### Paso 1: Verificar que tienes el código correcto

1. Abre tu **Google Apps Script** (Extensiones → Apps Script en tu Google Sheet)
2. Busca la función `doGet(e)` (debería estar cerca de la línea 363)
3. Verifica que se vea **exactamente** así:

```javascript
function doGet(e){
  const p = e.parameter;
  
  // Add CORS headers to allow cross-origin requests from GitHub Pages
  const output = (p.list === 'true') ? getMetadata() : getSerie(p);
  
  // Apply CORS headers
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Si NO se ve así**:
- Copia el archivo `Code.gs` completo de este repositorio
- Pégalo en tu Apps Script (reemplaza todo)
- No olvides cambiar el `FOLDER_ID` (línea 25)
- Guarda (Ctrl+S)

### Paso 2: Reimplementar el Web App

**IMPORTANTE**: No crees una implementación nueva, actualiza la existente.

1. En Apps Script, click en **Implementar** (arriba a la derecha)
2. Selecciona **Administrar implementaciones**
3. En tu implementación activa, click en el **ícono de lápiz** (editar)
4. Click en **Implementar**
5. Deberías ver: "Implementación actualizada exitosamente"

**¿Por qué no crear una nueva?**  
Si creas una nueva implementación, la URL cambiará y tendrás que actualizar `index.html`.

### Paso 3: Verificar

1. Abre tu dashboard: `https://torredecontrolcss.github.io/Curvas_de_Inventario/`
2. Presiona **F12** para abrir la Consola del navegador
3. Presiona **Ctrl+F5** para recargar sin caché
4. Busca un producto
5. **✅ El error CORS no debería aparecer**

---

## 🔍 Verificación Rápida

### ¿Cómo saber si está funcionando?

**En la Consola del navegador (F12), NO deberías ver**:
- ❌ "blocked by CORS policy"
- ❌ "No 'Access-Control-Allow-Origin' header"

**SÍ deberías ver**:
- ✅ El dashboard carga datos
- ✅ Aparecen los suministros en la lista
- ✅ La gráfica se dibuja correctamente

### Prueba Manual de la API

Abre esta URL en tu navegador (reemplaza con tu URL real):
```
https://script.google.com/macros/s/TU_ID_AQUI/exec?list=true
```

**Deberías ver**: Un JSON con tus códigos, suministros y grupos
```json
{
  "codigos": ["101097501", "102134567", ...],
  "suministros": ["Abacavir", "Acetaminofén", ...],
  "grupos": ["G1", "G2", ...],
  "min_fecha": "2024-01-01",
  "max_fecha": "2024-12-10"
}
```

**Si ves**: Una página en blanco o error → el Web App no está publicado correctamente

---

## ❓ Preguntas Rápidas

### ¿Tengo que hacer esto cada vez?

**No**. Solo necesitas hacerlo UNA vez. El cambio queda permanente en tu implementación.

### ¿Afecta la seguridad?

**No** para este caso de uso. Los encabezados CORS solo permiten que navegadores web lean datos públicos desde otros dominios. No expone credenciales ni datos privados.

Si quieres mayor seguridad, puedes cambiar:
```javascript
.setHeader('Access-Control-Allow-Origin', '*')
```
Por:
```javascript
.setHeader('Access-Control-Allow-Origin', 'https://torredecontrolcss.github.io')
```

### ¿Por qué aparece este error ahora?

Posibles razones:
1. **Reimplementaste el Web App** sin los encabezados CORS
2. **Copiaste un código antiguo** que no tenía los encabezados
3. **Moviste el dashboard** a GitHub Pages (antes estaba en localhost)

### ¿El error del PWA es importante?

**No**. El mensaje:
```
Banner not shown: beforeinstallpromptevent.preventDefault() called
```

Es solo informativo. El botón "Instalar app" funciona correctamente. El mensaje aparece porque el código controla manualmente cuándo mostrar el prompt de instalación.

---

## 🆘 Aún tengo problemas

Si después de seguir estos pasos **todavía** ves el error CORS:

1. **Verifica la URL** en `index.html` (línea 313):
   ```javascript
   const API_BASE = 'https://script.google.com/macros/s/TU_ID/exec';
   ```
   Debe ser exactamente la URL de tu Web App

2. **Limpia completamente el caché**:
   - Chrome: Ctrl+Shift+Delete → "Todo el tiempo" → "Imágenes y archivos en caché"
   - O usa modo incógnito: Ctrl+Shift+N

3. **Verifica los permisos**:
   - En la implementación del Web App
   - "Quién tiene acceso" debe ser: **"Cualquiera con el enlace"**

4. **Lee el archivo completo**: `SOLUCION_CORS.md` tiene todos los detalles

5. **Verifica que consolidaste datos**:
   ```javascript
   // En Apps Script, ejecuta:
   consolidate()
   ```
   Y verifica que la hoja "Data" tiene registros

---

## 📚 Documentación Completa

Si quieres entender TODO el sistema:

1. **`LEEME_PRIMERO.md`** - Resumen ejecutivo
2. **`GUIA_IMPLEMENTACION.md`** - Implementación paso a paso
3. **`SOLUCION_CORS.md`** - Todo sobre CORS (este problema)
4. **`CHECKLIST.md`** - Lista de verificación completa
5. **`ARQUITECTURA.md`** - Cómo funciona el sistema

---

## ✅ Resumen

**El problema**: CORS bloquea la comunicación entre GitHub Pages y Google Apps Script

**La solución**: Agregar encabezados CORS en la función `doGet()` del script

**El archivo correcto**: `Code.gs` en este repositorio **YA tiene la solución**

**Lo que debes hacer**: 
1. Copiar `Code.gs`
2. Reimplementar el Web App
3. Recargar el dashboard

**Tiempo total**: 5 minutos

---

🎉 **¡Listo! Tu dashboard debería funcionar ahora.**
