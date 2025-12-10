# Integración con Tu Código Existente

## 📋 Resumen

He actualizado el `Code.gs` para integrarse perfectamente con tu código existente, manteniendo toda tu lógica actual y agregando solo la funcionalidad de vencimientos.

---

## ✅ Lo que se mantuvo de tu código original

### 1. Estructura y Configuración
- ✅ `CONFIG.FOLDER_ID` = '1zHezlIPxR1KK33rVlVFLv-YVEAvw6pmH' (tu carpeta actual)
- ✅ `CONFIG.SHEET_NAME` = 'SALMI' (nombre de hoja en archivos Excel)
- ✅ `CONFIG.DATA_SHEET` = 'Data'
- ✅ `CONFIG.INDEX_SHEET` = 'Index'
- ✅ `CONFIG.LEAD` = 45
- ✅ `CONFIG.Z` = 1.65
- ✅ `CONFIG.WINDOW` = 90

### 2. Funciones Utilitarias (Sin cambios)
- ✅ `dateKey()` - Conversión de fechas a timestamp
- ✅ `fmtDate()` - Formato de fecha YYYY-MM-DD
- ✅ `parseDate()` - Parse de fechas (Excel serial, string, Date)
- ✅ `toNumber()` - Conversión segura a número
- ✅ `json()` - Response JSON para API
- ✅ `median()` - Cálculo de mediana
- ✅ `mad()` - Cálculo de MAD (Median Absolute Deviation)

### 3. Setup de Hojas
- ✅ `setup()` - Mantiene tu lógica de creación de hojas
- ✅ `ensureSheet()` - Sin cambios
- ✅ Limpieza de hojas vacías
- ✅ Encabezados congelados

### 4. Detección ESTRICTA de Encabezados
- ✅ `normalizeHeader()` - Sin cambios (normalización con NFD)
- ✅ `REQUIRED_HDR` - Mismas columnas requeridas: FECHA, CODIGO, SUMINISTRO, GRUPO, CANTIDAD
- ✅ `detectHeaderStrict()` - Mantiene tu lógica estricta (busca en primeras 5 filas)

### 5. Consolidación Recursiva
- ✅ `consolidate()` - Mantiene tu estructura de procesamiento
- ✅ `processFolder()` - Recursión en subcarpetas sin cambios
- ✅ Soporte para shortcuts
- ✅ `processExcelFile()` - Lógica de conversión temporal sin cambios

### 6. API Web
- ✅ `doGet()` - Misma estructura
- ✅ `getMetadata()` - Sin cambios
- ✅ `getSerie()` - Mantiene filtros: codigo, suministro, grupo, from, to
- ✅ `calcStats()` - Sin cambios (mediana, MAD, mu_d, sigma_d, kb_min, inventario_critico)

### 7. Trigger
- ✅ `createDailyTrigger()` - Sin cambios (3:00 AM)

---

## 🆕 Lo que se agregó (SIN romper tu código)

### 1. Nueva Configuración
```javascript
VENCIMIENTOS_SHEET: 'Vencimientos'  // Nueva hoja para datos de vencimiento
```

### 2. Nuevas Constantes para Detección
```javascript
const VENC_HDR_OPTIONS = ["FECHA VTO","FECHA_VTO","FECHAVTO","VENCIMIENTO",...];
const LOTE_HDR_OPTIONS = ["Nº DE LOTE","N DE LOTE","LOTE","BATCH",...];
```

### 3. Detección Automática en `detectHeaderStrict()`
**AGREGADO** (no reemplaza tu lógica):
```javascript
// Después de encontrar las columnas requeridas
const vencIdx = { fechaVto: -1, lote: -1 };
for (const vOpt of VENC_HDR_OPTIONS){
  const pos = norm.indexOf(vOpt);
  if (pos !== -1){ vencIdx.fechaVto = pos; break; }
}
// ... busca lote ...
return { row: r, idx, vencIdx }; // ← Ahora también devuelve vencIdx
```

### 4. Procesamiento de Vencimientos en `processExcelFile()`
**AGREGADO** (solo si encuentra columna "Fecha Vto"):
```javascript
const hasVenc = vencIdx.fechaVto !== -1;

if (hasVenc){
  // Guarda cada registro con su fecha de vencimiento
  vencimientos.push([fechaStr, codigo, suministro, grupo, fechaVtoStr, cantidad]);
  
  // Agrega inventario total por fecha y código
  inventoryAgg.set(key, { fecha, codigo, suministro, grupo, total: ... });
} else {
  // Sin vencimientos, procesa como SIEMPRE (tu lógica original)
  data.push([fechaStr, codigo, suministro, grupo, cantidad]);
}
```

### 5. Nuevas Funciones de API
**AGREGADO**:
```javascript
function getVencimientosForSerie(vencData, p){
  // Filtra y agrupa vencimientos por fecha y código
  // Devuelve objeto: { "2024-01-15_101097501": [{fecha_vencimiento, cantidad}, ...] }
}
```

**MODIFICADO** en `getSerie()`:
```javascript
// Después de construir la serie básica
const vencimientos = getVencimientosForSerie(vencData, p);

// Para cada punto
if (vencimientos[key] && vencimientos[key].length > 0){
  punto.vencimientos = vencimientos[key]; // ← AGREGA vencimientos al punto
}
```

### 6. Nueva Función de Prueba
```javascript
function testVencimientos(){
  // Muestra registros de la hoja Vencimientos
}
```

---

## 🔍 Diferencias Clave vs Mi Código Original

### Mi código original (que reemplazaste):
- Usaba nombres genéricos: `FOLDER_ID = 'TU_FOLDER_ID_AQUI'`
- Buscaba hoja "Inventario" o primera hoja
- No tenía detección estricta de encabezados
- No soportaba shortcuts ni recursión profunda
- Funciones helper diferentes

### Código integrado (nuevo):
- ✅ Usa TU `FOLDER_ID` = '1zHezlIPxR1KK33rVlVFLv-YVEAvw6pmH'
- ✅ Busca hoja "SALMI" específicamente
- ✅ Mantiene tu detección ESTRICTA de encabezados (primeras 5 filas)
- ✅ Soporta shortcuts y recursión (tu lógica)
- ✅ Usa TUS funciones helper (dateKey, parseDate, etc.)

---

## 📊 Ejemplo de Funcionamiento

### Tu archivo Excel (estructura actual):
```
Modulo | SERIE | FECHA      | Código    | Grupo | Suministro | Nº de Lote | Fecha Vto  | Cantidad
ALMACEN| INV   | 04/12/2025 | 101097501 | G1    | Abacavir...| E231419A   | 31/03/2026 | 6,000
ALMACEN| INV   | 04/12/2025 | 101097501 | G1    | Abacavir...| E231419A   | 31/03/2026 | 1,380
```

### Procesamiento:
1. **Detección estricta**: ✅ Encuentra FECHA, Código, Grupo, Suministro, Cantidad
2. **Detección vencimientos**: ✅ Encuentra "Fecha Vto" (opcional)
3. **Si encuentra "Fecha Vto"**:
   - Extrae cada registro a hoja "Vencimientos"
   - Suma total por fecha+código para hoja "Data"
4. **Si NO encuentra "Fecha Vto"**:
   - Procesa como SIEMPRE (tu lógica original)

### Resultado en Google Sheets:

**Hoja "Data"** (como siempre):
```
FECHA      | Código    | Suministro  | Grupo | Cantidad
2025-12-04 | 101097501 | Abacavir... | G1    | 7,380    ← Total sumado
```

**Hoja "Vencimientos"** (NUEVA):
```
FECHA      | Código    | Suministro  | Grupo | Fecha_Vencimiento | Cantidad
2025-12-04 | 101097501 | Abacavir... | G1    | 2026-03-31        | 6,000
2025-12-04 | 101097501 | Abacavir... | G1    | 2026-03-31        | 1,380
```

### API Response (con vencimientos):
```json
{
  "serie": [
    {
      "fecha": "2025-12-04",
      "inventario": 7380,
      "vencimientos": [
        {"fecha_vencimiento": "2026-03-31", "cantidad": 7380}
      ]
    }
  ],
  "subject_code": "101097501",
  "mu_d": ...,
  "kb_min": ...,
  ...
}
```

---

## ⚠️ Puntos Importantes

### 1. Compatibilidad Total
- ✅ Si tus archivos NO tienen "Fecha Vto", el código funciona EXACTAMENTE como antes
- ✅ Si tus archivos SÍ tienen "Fecha Vto", se detecta automáticamente
- ✅ Puedes tener archivos con y sin "Fecha Vto" mezclados

### 2. No Rompe Nada
- ✅ Todos los filtros de API siguen funcionando igual
- ✅ Estadísticas (mu_d, sigma_d, kb_min) se calculan igual
- ✅ La hoja "Data" tiene la misma estructura
- ✅ La hoja "Index" no cambia

### 3. Agregados Opcionales
- ✅ Hoja "Vencimientos" solo se usa si se encuentran datos
- ✅ Campo `vencimientos` en API solo aparece si existen datos
- ✅ Frontend ya sabe manejar ambos casos

---

## 🚀 Cómo Usar

### Paso 1: Reemplazar Code.gs
```
1. Abre tu Google Apps Script
2. Borra TODO el código actual
3. Copia y pega el nuevo Code.gs (de este repo)
4. Guarda
```

### Paso 2: Ejecutar setup()
```javascript
setup()
```
Esto creará la nueva hoja "Vencimientos" (las demás ya existen).

### Paso 3: Ejecutar consolidate()
```javascript
consolidate()
```
El script:
- ✅ Procesa tus 60+ archivos como siempre
- ✅ Detecta automáticamente si tienen "Fecha Vto"
- ✅ Extrae vencimientos si existen
- ✅ Consolida todo en las hojas correspondientes

### Paso 4: Verificar
```javascript
testVencimientos()
```
Verás en los logs cuántos registros de vencimiento se encontraron.

---

## 🔄 Migración Suave

### Opción A: Todos los archivos tienen "Fecha Vto"
✅ Perfecto. El script detectará y procesará automáticamente.

### Opción B: Solo algunos archivos tienen "Fecha Vto"
✅ También perfecto. Los que tienen se procesan con vencimientos, los demás como siempre.

### Opción C: Ningún archivo tiene "Fecha Vto" aún
✅ El código funciona exactamente como tu versión original. Cuando agregues "Fecha Vto" a los archivos, automáticamente se detectará.

---

## 📝 Resumen de Cambios en el Código

| Función | Estado | Cambios |
|---------|--------|---------|
| `CONFIG` | ✅ Extendido | +1 propiedad (VENCIMIENTOS_SHEET) |
| Utilidades | ✅ Sin cambios | dateKey, fmtDate, parseDate, toNumber, json, median, mad |
| `setup()` | ✅ Extendido | +1 hoja (Vencimientos) |
| `ensureSheet()` | ✅ Sin cambios | Igual |
| `normalizeHeader()` | ✅ Sin cambios | Igual |
| `detectHeaderStrict()` | ✅ Extendido | +detección opcional de Fecha Vto y Lote |
| `consolidate()` | ✅ Extendido | +procesamiento hoja Vencimientos |
| `processFolder()` | ✅ Sin cambios | Igual (recursión, shortcuts) |
| `processExcelFile()` | ✅ Extendido | +extracción de vencimientos si existen |
| `doGet()` | ✅ Sin cambios | Igual |
| `getMetadata()` | ✅ Sin cambios | Igual |
| `getSerie()` | ✅ Extendido | +incluye vencimientos en respuesta |
| `getVencimientosForSerie()` | 🆕 Nueva | Agrupa vencimientos por fecha+código |
| `calcStats()` | ✅ Sin cambios | Igual |
| `createDailyTrigger()` | ✅ Sin cambios | Igual |
| `testVencimientos()` | 🆕 Nueva | Diagnóstico de vencimientos |

**Total**: 2 funciones nuevas, 6 extendidas (backward compatible), 9 sin cambios.

---

## ✅ Checklist de Verificación

Después de actualizar Code.gs:

- [ ] Código copiado y guardado en Apps Script
- [ ] Ejecutado `setup()` → Hoja "Vencimientos" creada
- [ ] Ejecutado `consolidate()` → Datos procesados
- [ ] Ejecutado `testVencimientos()` → Ver registros en logs
- [ ] Verificado hoja "Data" → Tiene datos (como siempre)
- [ ] Verificado hoja "Vencimientos" → Tiene datos (si archivos tienen "Fecha Vto")
- [ ] Probado API: `?codigo=101097501` → Response incluye vencimientos
- [ ] Dashboard funciona → Muestra dos líneas en gráfica

---

## 🆘 Si Algo Sale Mal

### Problema: No veo datos en hoja "Vencimientos"
**Causa**: Tus archivos no tienen columna "Fecha Vto" o está mal nombrada.

**Solución**:
1. Abre uno de tus archivos Excel
2. Verifica que la columna se llame exactamente: "Fecha Vto" o "Fecha_Vto" o "Vencimiento"
3. Si tiene otro nombre, agrégalo a `VENC_HDR_OPTIONS` en Code.gs
4. Ejecuta `consolidate()` de nuevo

### Problema: Error en `consolidate()`
**Causa**: Posible conflicto con código anterior.

**Solución**:
1. Verifica que copiaste TODO el código nuevo (reemplaza completamente)
2. Verifica que `setup()` se ejecutó correctamente
3. Revisa los logs para ver el mensaje de error específico

### Problema: API no devuelve vencimientos
**Causa**: Datos no consolidados o filtro incorrecto.

**Solución**:
1. Ejecuta `testVencimientos()` para verificar que hay datos
2. Verifica que el código que buscas existe en la hoja "Vencimientos"
3. Prueba sin filtros primero: `?list=true`

---

## 💡 Conclusión

He integrado la funcionalidad de vencimientos **preservando completamente tu código existente**. Los cambios son:
- ✅ **Mínimos**: Solo 2 funciones nuevas + 6 extendidas
- ✅ **Compatibles**: Tu código actual sigue funcionando igual
- ✅ **Opcionales**: Solo se usan si encuentran datos de vencimientos
- ✅ **Automáticos**: Detección sin configuración manual

**Tu inversión en el código actual está protegida. Solo agregamos nueva funcionalidad sin romper nada existente.**
