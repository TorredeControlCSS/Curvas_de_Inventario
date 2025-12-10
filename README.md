# Inv Dashboard (Apps Script + GitHub Pages)

## 🚨 ¿Tienes un error CORS?
Si ves `"blocked by CORS policy"` en la consola, **lee primero**: [`INICIO_RAPIDO.md`](INICIO_RAPIDO.md) o [`SOLUCION_CORS.md`](SOLUCION_CORS.md)

## Qué es
Backend sin servidores con **Google Apps Script** que consolida tus Excel de inventario de Drive, y frontend **HTML+JS (Chart.js)** hosteado en **GitHub Pages** con 3 series (histórico, proyección 45 días y proyección + pedido). PWA instalable en móviles.

## Pasos rápidos
1. **Google Sheets**: crea un archivo vacío llamado `Inventario Consolidado` con hojas `Data` y `Index`.
2. **Apps Script**: Extensiones → Apps Script. Activa **Drive API** en *Servicios avanzados* y en **Google Cloud Console**.
3. Copia `Code.gs` en Apps Script (reemplaza TODO). Ajusta `FOLDER_ID` si cambia tu carpeta.
4. Ejecuta `setup()` y luego `consolidate()`. Verifica que `Data` e `Index` se llenan.
5. Ejecuta `createDailyTrigger()` para programar actualización diaria (03:00).
6. **Publica Web App**: Implementar → Aplicación web → Acceso: Cualquiera con el enlace. Copia la URL.
7. **Frontend**: Sube `index.html`, `manifest.json` y `sw.js` a tu repo de GitHub. Edita `index.html` y reemplaza `API_BASE` por la URL del Web App.
8. **GitHub Pages**: Settings → Pages → habilita Pages en la rama principal. Abre la URL. ¡Listo!

## Notas
- El backend calcula **KB_min** e **Inventario Crítico**. La proyección a 45 días usa **Suavizado Exponencial Simple (SES)** en el frontend.
- El pedido planificado (campo de cantidad) se aplica en **t+45**.
- Si quieres restringir acceso, pon el Web App con autenticación de Google y sirve el frontend desde un dominio que comparta sesión (o usa un pequeño proxy).

## ⚡ Nueva funcionalidad: Seguimiento de fechas de vencimiento

El dashboard ahora soporta **fechas de vencimiento** para productos perecederos:

- **Inventario Total vs Disponible**: Visualiza tanto el inventario total como el inventario disponible (descontando productos vencidos).
- **Cálculos basados en disponible**: Todos los cálculos estadísticos (consumo, proyecciones, ROP, SS) usan el inventario real disponible.
- **Visualización mejorada**: Nueva serie en la gráfica que distingue claramente entre inventario total y disponible.
- **Tabla detallada**: Columnas adicionales muestran inventario disponible y cantidad vencida por fecha.

### Configuración Backend

Para habilitar esta funcionalidad, el backend debe proporcionar datos de vencimiento en el formato:

```json
{
  "serie": [
    {
      "fecha": "2024-01-15",
      "inventario": 1000,
      "vencimientos": [
        {"fecha_vencimiento": "2024-02-01", "cantidad": 200},
        {"fecha_vencimiento": "2024-03-15", "cantidad": 300}
      ]
    }
  ]
}
```

Ver [BACKEND_EXPIRATION_DATES.md](BACKEND_EXPIRATION_DATES.md) para detalles completos sobre:
- Estructura de datos requerida
- Cambios necesarios en Google Apps Script
- Formato de hojas de cálculo
- Ejemplos de implementación

**Nota**: La funcionalidad es completamente retrocompatible. Si no se proporcionan fechas de vencimiento, el dashboard funciona como antes, tratando todo el inventario como disponible.

## 🔧 Solución de Problemas

### Error CORS: "No 'Access-Control-Allow-Origin' header"

Si ves este error en la consola del navegador:
```
Access to fetch at 'https://script.google.com/macros/s/...' has been blocked by CORS policy
```

**Causa**: El Google Apps Script no está devolviendo los encabezados CORS necesarios para permitir solicitudes desde GitHub Pages.

**Solución**: Asegúrate de que tu `Code.gs` incluye los encabezados CORS en la función `doGet()`. El script proporcionado en este repositorio ya incluye la corrección:

```javascript
function doGet(e){
  const p = e.parameter;
  
  // Add CORS headers to allow cross-origin requests
  const output = (p.list === 'true') ? getMetadata() : getSerie(p);
  
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Pasos para aplicar**:
1. Abre tu Google Apps Script
2. Verifica que la función `doGet()` incluya los encabezados CORS
3. Guarda y vuelve a implementar el Web App
4. Prueba el dashboard nuevamente
