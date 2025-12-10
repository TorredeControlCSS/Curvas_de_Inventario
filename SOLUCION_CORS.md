# 🔧 Solución al Error CORS

## ¿Qué es el error CORS?

Si ves este mensaje en la consola del navegador:

```
Access to fetch at 'https://script.google.com/macros/s/AKfycbw...' from origin 
'https://torredecontrolcss.github.io' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Esto significa**: Tu navegador está bloqueando la comunicación entre tu página web (GitHub Pages) y tu Google Apps Script porque el servidor no está permitiendo solicitudes desde otros dominios.

## ¿Por qué ocurre?

CORS (Cross-Origin Resource Sharing) es una medida de seguridad del navegador. Cuando tu dashboard en GitHub Pages intenta obtener datos de Google Apps Script:

1. **GitHub Pages** está en: `https://torredecontrolcss.github.io`
2. **Google Apps Script** está en: `https://script.google.com`

Como son dominios diferentes, el navegador necesita que el servidor (Google Apps Script) diga explícitamente: "Sí, permito que este otro dominio me consulte".

## ✅ Solución Rápida

### El archivo `Code.gs` de este repositorio YA tiene la solución

Si usaste el `Code.gs` proporcionado en este repositorio, **la corrección ya está incluida**. Solo necesitas:

1. **Reimplementar el Web App**:
   - Abre tu Google Apps Script
   - Click en **Implementar → Administrar implementaciones**
   - Click en el ícono de lápiz (editar) de tu implementación actual
   - Click en **Implementar**
   - Esto genera una nueva versión con los cambios

2. **Verificar la URL**: Asegúrate de que `index.html` use la URL correcta del Web App (línea 313)

3. **Limpiar caché**: En tu navegador, presiona `Ctrl+F5` (o `Cmd+Shift+R` en Mac) para recargar sin caché

### Si usas tu propio Code.gs

Si tienes tu propio script de Google Apps, necesitas modificar la función `doGet()` para agregar los encabezados CORS:

**ANTES** (sin CORS):
```javascript
function doGet(e){
  const p = e.parameter;
  if (p.list === 'true') return getMetadata();
  return getSerie(p);
}
```

**DESPUÉS** (con CORS):
```javascript
function doGet(e){
  const p = e.parameter;
  
  // Add CORS headers to allow cross-origin requests from GitHub Pages
  const output = (p.list === 'true') ? getMetadata() : getSerie(p);
  
  // Apply CORS headers
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

### Explicación de los encabezados:

- **`Access-Control-Allow-Origin: *`**: Permite solicitudes desde cualquier dominio
  - Si quieres mayor seguridad, cambia `*` por `https://torredecontrolcss.github.io`
  
- **`Access-Control-Allow-Methods: GET, POST, OPTIONS`**: Métodos HTTP permitidos

- **`Access-Control-Allow-Headers: Content-Type`**: Encabezados HTTP permitidos

## 🚀 Pasos Detallados

### Paso 1: Actualizar Code.gs

1. Abre tu **Google Sheet** "Inventario Consolidado"
2. Ve a **Extensiones → Apps Script**
3. Busca la función `doGet(e)`
4. Reemplázala con la versión que incluye los encabezados CORS (ver arriba)
5. **Guardar** (Ctrl+S)

### Paso 2: Reimplementar

1. En Apps Script, click en **Implementar** (arriba a la derecha)
2. Selecciona **Administrar implementaciones**
3. En tu implementación activa, click en el ícono de **lápiz** (editar)
4. Click en **Implementar**
5. Aparecerá un mensaje: "Implementación actualizada exitosamente"

**IMPORTANTE**: No crees una nueva implementación, actualiza la existente. De lo contrario, la URL cambiará y deberás actualizar `index.html`.

### Paso 3: Verificar

1. Copia la **URL de la aplicación web** desde la ventana de implementación
2. Abre esa URL en tu navegador
3. Deberías ver un JSON con datos (algo como `{"codigos":["..."],...}`)
4. Verifica que la URL en `index.html` (línea 313) coincida:
   ```javascript
   const API_BASE = 'https://script.google.com/macros/s/TU_ID_AQUI/exec';
   ```

### Paso 4: Probar el Dashboard

1. Ve a tu dashboard: `https://torredecontrolcss.github.io/Curvas_de_Inventario/`
2. Abre la **Consola del navegador** (F12)
3. Recarga la página (Ctrl+F5 para forzar sin caché)
4. El error CORS **no debería aparecer**
5. El dashboard debería cargar datos normalmente

## 🔍 Verificación con cURL (Opcional)

Si quieres verificar que los encabezados CORS están configurados correctamente desde la línea de comandos:

```bash
curl -I "https://script.google.com/macros/s/TU_ID_AQUI/exec?list=true"
```

Deberías ver en la respuesta:
```
Access-Control-Allow-Origin: *
```

## ❓ Preguntas Frecuentes

### ¿Es seguro usar `Access-Control-Allow-Origin: *`?

Para este caso de uso (dashboard público que consume datos públicos), es aceptable. Si tu dashboard es privado o maneja datos sensibles, considera:

1. **Cambiar `*` por tu dominio específico**:
   ```javascript
   .setHeader('Access-Control-Allow-Origin', 'https://torredecontrolcss.github.io')
   ```

2. **Configurar autenticación** en el Web App:
   - En la implementación, cambia "Quién tiene acceso" a "Solo yo" o "Cualquier persona en mi organización"

### ¿Por qué funcionaba antes y ahora no?

Posibles causas:

1. **Nueva implementación**: Si recreaste el Web App, los encabezados CORS se perdieron
2. **Cambio de dominio**: Si moviste el dashboard a otro dominio (de localhost a GitHub Pages)
3. **Actualización del navegador**: Algunos navegadores han vuelto más estrictas las políticas CORS

### ¿El error ocurre solo en algunos navegadores?

Es raro, pero puede suceder. CORS es un estándar web, pero algunos navegadores (especialmente versiones antiguas) lo implementan diferente. Solución:

- Asegúrate de usar navegadores modernos (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)
- Si el problema persiste, verifica con las **Herramientas de desarrollo** (F12) si hay otros errores

### ¿Qué pasa con el error del PWA Install Prompt?

El mensaje:
```
Banner not shown: beforeinstallpromptevent.preventDefault() called
```

**No es un error crítico**. Es solo una notificación informativa del navegador. El código actual:

- Captura el evento `beforeinstallprompt`
- Llama a `preventDefault()` para controlarlo manualmente
- Muestra el botón "Instalar app" cuando es apropiado

El comportamiento es **correcto e intencional**. El banner solo se mostrará cuando el usuario haga click en "Instalar app".

## 📞 Soporte Adicional

Si después de seguir estos pasos sigues teniendo problemas:

1. Verifica que ejecutaste `consolidate()` al menos una vez
2. Confirma que el Google Sheet "Inventario Consolidado" tiene datos en la hoja "Data"
3. Abre directamente la URL del Web App en el navegador y verifica que devuelve JSON
4. Comparte el mensaje de error completo de la consola del navegador

---

**Resumen**: El archivo `Code.gs` de este repositorio **ya tiene la solución CORS**. Solo necesitas reimplementar tu Web App para aplicar los cambios. 🚀
