# 🆕 Actualización: Detección Automática de Vencimientos

## Fecha: 09/12/2024

---

## 🎯 ¿Qué cambió?

En respuesta al feedback del usuario, el script ahora **detecta automáticamente** las columnas de vencimiento en la hoja de Inventario existente.

---

## ❌ ANTES (Versión Original)

### Requería:
1. Crear una hoja "Vencimientos" separada en cada archivo Excel
2. Copiar manualmente los datos de vencimiento a esa hoja
3. Mantener dos hojas sincronizadas

### Problema:
- Usuario tiene 60+ archivos de inventario diario
- Ya tienen columnas "Fecha Vto" y "Nº de Lote" en su hoja principal
- Duplicar datos en una hoja separada es ineficiente

---

## ✅ AHORA (Versión Actualizada)

### Detecta automáticamente:
- ✅ Columnas de fecha de vencimiento: "Fecha Vto", "Fecha_Vencimiento", "Vencimiento", "Expiry", "Caducidad"
- ✅ Columnas de lote: "Nº de Lote", "Lote", "N de Lote", "Batch", "Lot"
- ✅ Cantidad (ya existente)

### Funciona con tu estructura actual:
```
Modulo | SERIE | FECHA | Código | Grupo | Suministro | U. de Emisión | Nº de Lote | Fecha Vto | Cantidad
ALMACEN| INV   |04/12  | 101... | G1    | Abacavir...| TAB, COM      | E231419A   | 31/03/26  | 6,000
ALMACEN| INV   |04/12  | 101... | G1    | Abacavir...| TAB, COM      | E231419A   | 31/03/26  | 1,380
```

### Procesamiento inteligente:
1. **Lee cada fila** con su fecha de vencimiento y lote
2. **Agrupa automáticamente** el inventario total por fecha y código
3. **Mantiene los detalles** de cada lote con su fecha de vencimiento
4. **Consolida todo** en el formato correcto para el dashboard

---

## 🔧 Cambios Técnicos

### Archivo: `Code.gs`

#### Función actualizada: `processInventarioSheet()`

**ANTES:**
```javascript
function processInventarioSheet(sheet) {
  // Solo procesaba inventario total
  // No leía datos de vencimiento
  return { data: [], index: [] };
}
```

**AHORA:**
```javascript
function processInventarioSheet(sheet) {
  // Detecta columnas de vencimiento automáticamente
  const fechaVtoCol = findColumn(headers, ['fecha vto', 'fecha_vto', 'vencimiento', ...]);
  const loteCol = findColumn(headers, ['lote', 'nº de lote', 'batch', ...]);
  
  // Extrae datos de vencimiento de la misma hoja
  if (fechaVtoCol !== -1) {
    // Procesa cada fila con su vencimiento
    vencimientos.push([fecha, codigo, suministro, grupo, fechaVto, cantidad]);
    
    // Agrupa inventario total por fecha y código
    inventoryAgg.set(key, { fecha, codigo, suministro, grupo, total: ... });
  }
  
  return { data: [], index: [], vencimientos: [] };
}
```

#### Función actualizada: `consolidate()`

**AHORA extrae vencimientos de dos fuentes:**
```javascript
// 1. De la hoja Inventario (NUEVO)
if (inventarioData.vencimientos && inventarioData.vencimientos.length > 0) {
  allVencimientos.push(...inventarioData.vencimientos);
}

// 2. De hoja Vencimientos separada (para compatibilidad)
const vencimientoSheet = tempSheet.getSheetByName('Vencimientos');
if (vencimientoSheet) {
  const vencimientoData = processVencimientoSheet(vencimientoSheet);
  allVencimientos.push(...vencimientoData);
}
```

---

## 📊 Ejemplo de Procesamiento

### Datos de Entrada (Tu Excel):
```
Fecha      | Código    | Grupo | Suministro | Lote     | Fecha Vto  | Cantidad
04/12/2025 | 101097501 | G1    | Abacavir...| E231419A | 31/03/2026 | 6,000
04/12/2025 | 101097501 | G1    | Abacavir...| E231419A | 31/03/2026 | 1,380
04/12/2025 | 101097501 | G1    | Abacavir...| F241520B | 30/06/2026 | 2,500
```

### Datos Consolidados (Hoja "Data"):
```
Fecha      | Codigo    | Suministro | Grupo | Inventario
04/12/2025 | 101097501 | Abacavir...| G1    | 9,880      ← Total agregado
```

### Datos de Vencimientos (Hoja "Vencimientos"):
```
Fecha      | Codigo    | Suministro | Grupo | Fecha_Venc | Cantidad
04/12/2025 | 101097501 | Abacavir...| G1    | 31/03/2026 | 6,000
04/12/2025 | 101097501 | Abacavir...| G1    | 31/03/2026 | 1,380
04/12/2025 | 101097501 | Abacavir...| G1    | 30/06/2026 | 2,500
```

### API Response al Dashboard:
```json
{
  "serie": [
    {
      "fecha": "2025-12-04",
      "inventario": 9880,
      "vencimientos": [
        {"fecha_vencimiento": "2026-03-31", "cantidad": 7380},
        {"fecha_vencimiento": "2026-06-30", "cantidad": 2500}
      ]
    }
  ]
}
```

### Dashboard muestra:
- **Total**: 9,880
- **Vencido** (si aplica): Calculado según fecha actual
- **Disponible**: Total - Vencido
- **Gráfica**: Dos líneas (total y disponible)

---

## 📝 Documentación Actualizada

### Archivos modificados:

1. **`Code.gs`**
   - ✅ Función `processInventarioSheet()` completamente reescrita
   - ✅ Nueva lógica de detección de columnas
   - ✅ Agregación inteligente de inventario
   - ✅ Comentarios actualizados

2. **`GUIA_IMPLEMENTACION.md`**
   - ✅ Paso 1 completamente actualizado
   - ✅ Opción A (estructura actual) como recomendada
   - ✅ Ejemplos con tu estructura real

3. **`LEEME_PRIMERO.md`**
   - ✅ Paso 1 simplificado
   - ✅ Ya no requiere crear hojas nuevas
   - ✅ Mensaje claro: "No necesitas cambiar nada"

4. **`CHECKLIST.md`**
   - ✅ Parte 2 simplificada (2 minutos vs 15 minutos)
   - ✅ Solo verificar estructura existente
   - ✅ Sin necesidad de crear/copiar datos

---

## ✅ Beneficios de la Actualización

### Para el Usuario:
1. **Ahorra tiempo**: No necesita modificar 60+ archivos
2. **Usa datos existentes**: Reutiliza columnas "Fecha Vto" y "Nº de Lote"
3. **Implementación rápida**: 30 minutos vs 2+ horas
4. **Sin duplicación**: No mantener datos en dos lugares

### Técnicos:
1. **Detección flexible**: Busca múltiples nombres de columnas
2. **Agregación automática**: Suma inventario total correctamente
3. **Backward compatible**: Sigue soportando hoja "Vencimientos" separada
4. **Robusto**: Maneja columnas opcionales (Lote, Suministro, Grupo)

---

## 🚀 Próximos Pasos para el Usuario

1. ✅ **Verificar estructura** - Confirmar que archivos tienen "Fecha Vto"
2. ✅ **Copiar Code.gs** - A Google Apps Script
3. ✅ **Configurar FOLDER_ID** - Una sola línea
4. ✅ **Ejecutar setup()** - Crear hojas en Google Sheets
5. ✅ **Ejecutar consolidate()** - El script detecta y procesa automáticamente
6. ✅ **Verificar resultados** - Ver hoja "Vencimientos" poblada
7. ✅ **Probar dashboard** - Ver dos líneas en gráfica

**Tiempo total: ~30 minutos**

---

## 🆘 Solución de Problemas

### P: No veo datos en la hoja "Vencimientos"

**R**: Verifica que:
- Tus archivos Excel tienen columna "Fecha Vto" (o similar)
- La columna tiene fechas válidas
- La columna "Cantidad" tiene valores numéricos
- Ejecutaste `consolidate()` después de copiar el nuevo código

### P: Los totales no coinciden

**R**: El script ahora:
- Suma múltiples filas del mismo producto/fecha/lote
- Agrupa por fecha + código para el total
- Mantiene detalles individuales para vencimientos

Esto es correcto si tienes múltiples registros del mismo lote.

### P: ¿Puedo seguir usando hoja "Vencimientos" separada?

**R**: ¡Sí! El script soporta ambos métodos:
- Lee de hoja "Inventario" si encuentra "Fecha Vto"
- Lee de hoja "Vencimientos" si existe
- Puede usar ambas simultáneamente

---

## 📞 Soporte

Si tienes preguntas sobre esta actualización:
1. Lee `GUIA_IMPLEMENTACION.md` - Paso 1 actualizado
2. Revisa ejemplos en `ARQUITECTURA.md`
3. Ejecuta `testVencimientos()` para diagnosticar

---

## 🎉 Conclusión

Esta actualización hace el sistema mucho más práctico para usuarios con estructura de datos existente. No requiere cambios manuales a decenas de archivos, detecta automáticamente las columnas correctas, y procesa todo de forma inteligente.

**¡Listo para usar con tu estructura actual de 60+ archivos!** 🚀
