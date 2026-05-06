# Inv Dashboard (Apps Script + GitHub Pages)

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

---

## ⚡ Optimizaciones de rendimiento

### Frontend (`index.html`)

- **Eliminada la llamada duplicada a `run()`**: Al iniciar, `run()` ahora se llama una sola vez (al final de `init()`), eliminando una petición API redundante que causaba ~15-25 s de carga adicional.
- **Caché de sesión para la lista de metadatos**: `safeFetchList()` guarda la respuesta del endpoint `?list=true` en `sessionStorage` con un TTL de 5 minutos. Si el usuario recarga la página dentro de la misma sesión, la lista se sirve instantáneamente sin consultar el backend.

### Backend (`backend/optimizaciones_backend.gs`)

Para aplicar las optimizaciones del backend:

1. Copia `backend/optimizaciones_backend.gs` en el editor de Google Apps Script.
2. En `Code.gs`, reemplaza las llamadas directas a las funciones F8 por las versiones con caché:
   - `getRecepcionYTransitoMap_DesdeF8()` → `getRecepcionYTransitoMap_DesdeF8_Cached()`
   - `getReservasMap_DesdeF8()` → `getReservasMap_DesdeF8_Cached()`
   - `getForecastMensualMap_DesdeUE()` → `getForecastMensualMap_DesdeUE_Cached()`
3. En `doGet()`:
   - Reemplaza el bloque `list=true` por: `return doGet_list_optimizado_(ss);`
   - Reemplaza la construcción de la cache key por: `var cacheKey = buildServerCacheKey_(e.parameter);`

**Impacto esperado**: cada uno de los 3 accesos al libro externo F8 cuesta 2-8 s. Con caché, solo el primer acceso incurre ese costo; las peticiones siguientes dentro de los 5 minutos se resuelven en <100 ms.

---

## 📧 Alertas automáticas por correo (`backend/alertas_correo.gs`)

Sistema de notificaciones que envía un correo HTML consolidado cuando hay productos próximos a vencer o en riesgo de desabastecimiento.

### Configuración

1. Copia `backend/alertas_correo.gs` en el editor de Google Apps Script.
2. Edita la constante `ALERT_CONFIG` al inicio del archivo:

```javascript
var ALERT_CONFIG = {
  RECIPIENTS: ['correo1@css.gob.pa', 'correo2@css.gob.pa'],  // destinatarios
  MIN_LEVEL_TO_SEND: 'RIESGO',   // 'VENCIDO' | 'CRITICO' | 'RIESGO' | 'ALERTA'
  INCLUDE_BAJO_IN_SUMMARY: true,
  DASHBOARD_URL: 'https://tu-usuario.github.io/Curvas_de_Inventario/',
  SYSTEM_NAME: 'Torre de Control CSS — Inventario',
  // Umbrales de vencimiento (días)
  DIAS_CRITICO: 0, DIAS_RIESGO: 30, DIAS_ALERTA: 90,
  // Umbrales de abastecimiento (meses)
  MESES_CRITICO: 1, MESES_BAJO: 4
};
```

3. Ejecuta `testEnviarAlertas()` desde el editor para verificar que el correo se genera correctamente.
4. Ejecuta `configurarTriggerDiario()` para activar el envío automático diario a las 07:00.

### Niveles de alerta

| Tipo | Nivel | Criterio |
|------|-------|----------|
| Vencimiento | 🔴 VENCIDO | Producto ya vencido (días < 0) |
| Vencimiento | 🟠 CRÍTICO | FMD pasada o días = 0 |
| Vencimiento | 🟡 RIESGO | FMD en los próximos 30 días |
| Vencimiento | 🟢 ALERTA | FMD en los próximos 31-90 días |
| Desabastecimiento | 🔴 AGOTADO | Inventario proyectado = 0 |
| Desabastecimiento | 🟠 CRÍTICO | Cobertura < 1 mes |
| Desabastecimiento | 🟡 BAJO | Cobertura 1-4 meses |

### Hojas requeridas

El sistema espera dos hojas en el spreadsheet:

- **`Reporte_Vencimientos`**: columnas `Código | Suministro | Grupo | Lote | Fecha VTO | Días a VTO | Cantidad | Valor en Riesgo | Estado`
- **`Reporte_Abastecimiento`**: columnas `Código | Suministro | Grupo | Estado | Cobertura (meses) | Demanda Mensual | Inv. Proyectado`

Si los índices de columna son distintos, ajusta las constantes `COL_VENC` y `COL_ABAST` al inicio del archivo `.gs`.
