/**
 * Google Apps Script para Dashboard de Inventario con Fechas de Vencimiento
 * 
 * Este script consolida datos de inventario de múltiples archivos Excel en Google Drive
 * y proporciona un API para el dashboard web que incluye seguimiento de fechas de vencimiento.
 * 
 * CONFIGURACIÓN INICIAL:
 * 1. Reemplaza FOLDER_ID con el ID de tu carpeta de Google Drive
 * 2. Activa Drive API en Servicios Avanzados
 * 3. Ejecuta setup() para crear las hojas necesarias
 * 4. Ejecuta consolidate() para poblar los datos
 * 5. Ejecuta createDailyTrigger() para automatizar actualizaciones
 * 
 * DETECCIÓN AUTOMÁTICA DE VENCIMIENTOS:
 * El script detecta automáticamente columnas de vencimiento en tu hoja de Inventario:
 * - "Fecha Vto", "Fecha_Vencimiento", "Vencimiento", "Expiry", etc.
 * - "Nº de Lote", "Lote", "Batch" (opcional)
 * 
 * No necesitas crear una hoja "Vencimientos" separada si ya tienes estos datos
 * en tu hoja principal de Inventario. El script soporta ambas opciones.
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const FOLDER_ID = 'TU_FOLDER_ID_AQUI'; // Reemplaza con el ID de tu carpeta
const SPREADSHEET_NAME = 'Inventario Consolidado';

// Configuración de hojas
const SHEETS = {
  DATA: 'Data',
  INDEX: 'Index',
  VENCIMIENTOS: 'Vencimientos'  // NUEVO: Hoja para fechas de vencimiento
};

// ============================================================================
// FUNCIONES DE CONFIGURACIÓN INICIAL
// ============================================================================

/**
 * Configura las hojas necesarias en el spreadsheet
 * Ejecutar una vez al inicio
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Crear hoja Data si no existe
  let dataSheet = ss.getSheetByName(SHEETS.DATA);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEETS.DATA);
    dataSheet.appendRow(['Fecha', 'Codigo', 'Suministro', 'Grupo', 'Inventario']);
    dataSheet.getRange('A1:E1').setFontWeight('bold');
  }
  
  // Crear hoja Index si no existe
  let indexSheet = ss.getSheetByName(SHEETS.INDEX);
  if (!indexSheet) {
    indexSheet = ss.insertSheet(SHEETS.INDEX);
    indexSheet.appendRow(['Codigo', 'Suministro', 'Grupo']);
    indexSheet.getRange('A1:C1').setFontWeight('bold');
  }
  
  // NUEVO: Crear hoja Vencimientos si no existe
  let vencSheet = ss.getSheetByName(SHEETS.VENCIMIENTOS);
  if (!vencSheet) {
    vencSheet = ss.insertSheet(SHEETS.VENCIMIENTOS);
    vencSheet.appendRow(['Fecha', 'Codigo', 'Suministro', 'Grupo', 'Fecha_Vencimiento', 'Cantidad']);
    vencSheet.getRange('A1:F1').setFontWeight('bold');
    Logger.log('✓ Hoja Vencimientos creada');
  }
  
  Logger.log('✓ Setup completado');
}

/**
 * Crea un trigger para ejecutar consolidate() diariamente a las 3:00 AM
 */
function createDailyTrigger() {
  // Eliminar triggers existentes
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'consolidate') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Crear nuevo trigger
  ScriptApp.newTrigger('consolidate')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  
  Logger.log('✓ Trigger diario creado para las 3:00 AM');
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE CONSOLIDACIÓN
// ============================================================================

/**
 * Consolida todos los archivos Excel de la carpeta especificada
 * Lee tanto datos de inventario como fechas de vencimiento
 */
function consolidate() {
  Logger.log('Iniciando consolidación...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEETS.DATA);
  const indexSheet = ss.getSheetByName(SHEETS.INDEX);
  const vencSheet = ss.getSheetByName(SHEETS.VENCIMIENTOS);
  
  if (!dataSheet || !indexSheet || !vencSheet) {
    throw new Error('Ejecuta setup() primero para crear las hojas necesarias');
  }
  
  // Limpiar hojas (mantener encabezados)
  if (dataSheet.getLastRow() > 1) {
    dataSheet.deleteRows(2, dataSheet.getLastRow() - 1);
  }
  if (vencSheet.getLastRow() > 1) {
    vencSheet.deleteRows(2, vencSheet.getLastRow() - 1);
  }
  
  // Obtener archivos Excel de la carpeta
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFilesByType(MimeType.MICROSOFT_EXCEL);
  
  const allData = [];
  const allVencimientos = [];
  const indexMap = new Map();
  
  let fileCount = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    Logger.log(`Procesando: ${file.getName()}`);
    
    try {
      const blob = file.getBlob();
      const tempFile = DriveApp.createFile(blob);
      const tempId = tempFile.getId();
      
      // Convertir a Google Sheets temporalmente
      const resource = {
        title: tempFile.getName(),
        mimeType: MimeType.GOOGLE_SHEETS
      };
      const converted = Drive.Files.copy(resource, tempId);
      const tempSheet = SpreadsheetApp.openById(converted.id);
      
      // Procesar hoja de Inventario
      const inventarioSheet = tempSheet.getSheetByName('Inventario') || tempSheet.getSheets()[0];
      const inventarioData = processInventarioSheet(inventarioSheet);
      allData.push(...inventarioData.data);
      
      // Actualizar índice
      inventarioData.index.forEach(item => {
        if (!indexMap.has(item.codigo)) {
          indexMap.set(item.codigo, item);
        }
      });
      
      // NUEVO: Agregar vencimientos extraídos de la hoja de Inventario
      if (inventarioData.vencimientos && inventarioData.vencimientos.length > 0) {
        allVencimientos.push(...inventarioData.vencimientos);
        Logger.log(`  ✓ ${inventarioData.vencimientos.length} registros de vencimiento encontrados en hoja Inventario`);
      }
      
      // NUEVO: Procesar hoja de Vencimientos separada si existe (para compatibilidad)
      const vencimientoSheet = tempSheet.getSheetByName('Vencimientos');
      if (vencimientoSheet) {
        const vencimientoData = processVencimientoSheet(vencimientoSheet);
        allVencimientos.push(...vencimientoData);
        Logger.log(`  ✓ ${vencimientoData.length} registros de vencimiento encontrados en hoja separada`);
      }
      
      // Limpiar archivo temporal
      Drive.Files.remove(converted.id);
      DriveApp.getFileById(tempId).setTrashed(true);
      
      fileCount++;
      
    } catch (e) {
      Logger.log(`  ✗ Error procesando ${file.getName()}: ${e.message}`);
    }
  }
  
  // Escribir datos consolidados
  if (allData.length > 0) {
    dataSheet.getRange(2, 1, allData.length, 5).setValues(allData);
    Logger.log(`✓ ${allData.length} registros de inventario escritos`);
  }
  
  // NUEVO: Escribir datos de vencimientos
  if (allVencimientos.length > 0) {
    vencSheet.getRange(2, 1, allVencimientos.length, 6).setValues(allVencimientos);
    Logger.log(`✓ ${allVencimientos.length} registros de vencimiento escritos`);
  }
  
  // Actualizar índice
  if (indexMap.size > 0) {
    if (indexSheet.getLastRow() > 1) {
      indexSheet.deleteRows(2, indexSheet.getLastRow() - 1);
    }
    const indexData = Array.from(indexMap.values()).map(item => [
      item.codigo,
      item.suministro,
      item.grupo
    ]);
    indexSheet.getRange(2, 1, indexData.length, 3).setValues(indexData);
    Logger.log(`✓ ${indexData.length} productos en índice`);
  }
  
  Logger.log(`✓ Consolidación completada: ${fileCount} archivos procesados`);
}

// ============================================================================
// FUNCIONES DE PROCESAMIENTO DE DATOS
// ============================================================================

/**
 * Procesa la hoja de Inventario de un archivo Excel
 * ACTUALIZADO: Ahora también extrae datos de vencimiento si están en la misma hoja
 */
function processInventarioSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  // Detectar columnas básicas
  const fechaCol = findColumn(headers, ['fecha', 'date']);
  const codigoCol = findColumn(headers, ['codigo', 'código', 'code', 'sku']);
  const suministroCol = findColumn(headers, ['suministro', 'producto', 'product', 'descripcion', 'descripción']);
  const grupoCol = findColumn(headers, ['grupo', 'group', 'categoria', 'categoría']);
  const cantidadCol = findColumn(headers, ['cantidad', 'inventario', 'stock', 'quantity']);
  
  // NUEVO: Detectar columnas de vencimiento en la misma hoja
  const fechaVtoCol = findColumn(headers, ['fecha vto', 'fecha_vto', 'vencimiento', 'fecha_vencimiento', 'expiry', 'caducidad']);
  const loteCol = findColumn(headers, ['lote', 'nº de lote', 'n de lote', 'batch', 'lot']);
  
  if (fechaCol === -1 || codigoCol === -1 || cantidadCol === -1) {
    Logger.log('  ⚠ Columnas requeridas no encontradas');
    return { data: [], index: [], vencimientos: [] };
  }
  
  const result = [];
  const index = [];
  const vencimientos = [];
  
  // Variable para acumular inventario total por fecha y código
  const inventoryAgg = new Map();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    const fecha = parseDate(row[fechaCol]);
    const codigo = String(row[codigoCol] || '').trim();
    const suministro = suministroCol !== -1 ? String(row[suministroCol] || '').trim() : codigo;
    const grupo = grupoCol !== -1 ? String(row[grupoCol] || '').trim() : '';
    const cantidad = Number(row[cantidadCol]) || 0;
    
    if (!fecha || !codigo || cantidad === 0) continue;
    
    // Agregar al índice
    if (!index.find(item => item.codigo === codigo)) {
      index.push({ codigo, suministro, grupo });
    }
    
    // NUEVO: Si hay columna de fecha de vencimiento, procesar datos de vencimiento
    if (fechaVtoCol !== -1) {
      const fechaVto = parseDate(row[fechaVtoCol]);
      
      if (fechaVto) {
        // Guardar registro de vencimiento
        vencimientos.push([fecha, codigo, suministro, grupo, fechaVto, cantidad]);
      }
      
      // Acumular inventario total por fecha y código
      const key = `${fecha}_${codigo}`;
      if (!inventoryAgg.has(key)) {
        inventoryAgg.set(key, {
          fecha, codigo, suministro, grupo, total: 0
        });
      }
      inventoryAgg.get(key).total += cantidad;
    } else {
      // Si no hay datos de vencimiento, procesar como antes (un registro por fila)
      result.push([fecha, codigo, suministro, grupo, cantidad]);
    }
  }
  
  // Si procesamos datos de vencimiento, crear registros agregados de inventario total
  if (fechaVtoCol !== -1 && inventoryAgg.size > 0) {
    for (const [key, item] of inventoryAgg) {
      result.push([item.fecha, item.codigo, item.suministro, item.grupo, item.total]);
    }
  }
  
  return { data: result, index, vencimientos };
}

/**
 * NUEVO: Procesa la hoja de Vencimientos de un archivo Excel
 * 
 * Formato esperado de la hoja Vencimientos:
 * Fecha | Codigo | Fecha_Vencimiento | Cantidad
 * 
 * O formato alternativo:
 * Fecha | Codigo | Suministro | Grupo | Fecha_Vencimiento | Cantidad
 */
function processVencimientoSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  // Detectar columnas
  const fechaCol = findColumn(headers, ['fecha', 'date']);
  const codigoCol = findColumn(headers, ['codigo', 'código', 'code', 'sku']);
  const suministroCol = findColumn(headers, ['suministro', 'producto', 'product', 'descripcion', 'descripción']);
  const grupoCol = findColumn(headers, ['grupo', 'group', 'categoria', 'categoría']);
  const fechaVencCol = findColumn(headers, ['fecha_vencimiento', 'vencimiento', 'expiry', 'expiration', 'caducidad']);
  const cantidadCol = findColumn(headers, ['cantidad', 'qty', 'quantity', 'cantidad_vencimiento']);
  
  if (fechaCol === -1 || codigoCol === -1 || fechaVencCol === -1 || cantidadCol === -1) {
    Logger.log('  ⚠ Columnas de vencimiento no encontradas correctamente');
    return [];
  }
  
  const result = [];
  
  // Obtener datos del índice para completar información faltante
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indexSheet = ss.getSheetByName(SHEETS.INDEX);
  const indexData = indexSheet ? indexSheet.getDataRange().getValues() : [];
  const indexMap = new Map();
  
  for (let i = 1; i < indexData.length; i++) {
    indexMap.set(indexData[i][0], {
      suministro: indexData[i][1],
      grupo: indexData[i][2]
    });
  }
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    const fecha = parseDate(row[fechaCol]);
    const codigo = String(row[codigoCol] || '').trim();
    const fechaVenc = parseDate(row[fechaVencCol]);
    const cantidad = Number(row[cantidadCol]) || 0;
    
    if (!fecha || !codigo || !fechaVenc || cantidad === 0) continue;
    
    // Obtener suministro y grupo
    let suministro = suministroCol !== -1 ? String(row[suministroCol] || '').trim() : '';
    let grupo = grupoCol !== -1 ? String(row[grupoCol] || '').trim() : '';
    
    // Si no están en la hoja, buscar en el índice
    if (!suministro || !grupo) {
      const indexItem = indexMap.get(codigo);
      if (indexItem) {
        suministro = suministro || indexItem.suministro;
        grupo = grupo || indexItem.grupo;
      }
    }
    
    // Si aún no hay suministro, usar el código
    suministro = suministro || codigo;
    
    result.push([fecha, codigo, suministro, grupo, fechaVenc, cantidad]);
  }
  
  return result;
}

/**
 * Busca una columna por varios nombres posibles
 */
function findColumn(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (names.some(name => header.includes(name))) {
      return i;
    }
  }
  return -1;
}

/**
 * Convierte varios formatos de fecha a string ISO (YYYY-MM-DD)
 */
function parseDate(value) {
  if (!value) return null;
  
  try {
    let date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      // Fecha en formato número de Excel
      date = new Date((value - 25569) * 86400 * 1000);
    } else {
      // Intentar parsear como string
      date = new Date(value);
    }
    
    if (isNaN(date.getTime())) return null;
    
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return null;
  }
}

// ============================================================================
// API WEB (doGet)
// ============================================================================

/**
 * Maneja las peticiones HTTP GET del dashboard
 * 
 * Parámetros soportados:
 * - list=true: Devuelve metadatos (códigos, suministros, grupos, fechas)
 * - codigo=XXX: Filtra por código de producto
 * - suministro=XXX: Filtra por nombre de suministro
 * - grupo=XXX: Filtra por grupo
 * - from=YYYY-MM-DD: Fecha desde
 * - to=YYYY-MM-DD: Fecha hasta
 */
function doGet(e) {
  const params = e.parameter;
  
  try {
    // Responder a peticiones de metadatos
    if (params.list === 'true') {
      return getMetadata();
    }
    
    // Responder a peticiones de series de inventario
    return getInventorySerie(params);
    
  } catch (error) {
    Logger.log('Error en doGet: ' + error.message);
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Devuelve metadatos para el dashboard (lista de productos, fechas, etc.)
 */
function getMetadata() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEETS.DATA);
  const indexSheet = ss.getSheetByName(SHEETS.INDEX);
  
  const data = dataSheet.getDataRange().getValues();
  const indexData = indexSheet.getDataRange().getValues();
  
  // Obtener fechas min/max
  const fechas = data.slice(1).map(row => row[0]).filter(f => f);
  const minFecha = fechas.length > 0 ? fechas.reduce((a, b) => a < b ? a : b) : '';
  const maxFecha = fechas.length > 0 ? fechas.reduce((a, b) => a > b ? a : b) : '';
  
  // Obtener listas únicas
  const codigos = [...new Set(indexData.slice(1).map(row => row[0]))].sort();
  const suministros = [...new Set(indexData.slice(1).map(row => row[1]))].sort();
  const grupos = [...new Set(indexData.slice(1).map(row => row[2]).filter(g => g))].sort();
  
  const result = {
    codigos,
    suministros,
    grupos,
    min_fecha: minFecha,
    max_fecha: maxFecha
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Devuelve la serie de inventario para un producto específico
 * NUEVO: Incluye datos de vencimientos si están disponibles
 */
function getInventorySerie(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEETS.DATA);
  const vencSheet = ss.getSheetByName(SHEETS.VENCIMIENTOS);
  const indexSheet = ss.getSheetByName(SHEETS.INDEX);
  
  const data = dataSheet.getDataRange().getValues();
  const vencData = vencSheet ? vencSheet.getDataRange().getValues() : [];
  
  // Aplicar filtros
  let filtered = data.slice(1);
  
  if (params.codigo) {
    filtered = filtered.filter(row => row[1] === params.codigo);
  }
  
  if (params.suministro) {
    filtered = filtered.filter(row => row[2] === params.suministro);
  }
  
  if (params.grupo) {
    filtered = filtered.filter(row => row[3] === params.grupo);
  }
  
  if (params.from) {
    filtered = filtered.filter(row => row[0] >= params.from);
  }
  
  if (params.to) {
    filtered = filtered.filter(row => row[0] <= params.to);
  }
  
  if (filtered.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ serie: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // NUEVO: Obtener datos de vencimientos para los mismos filtros
  const vencimientos = getVencimientosForSerie(vencData, params);
  
  // Construir serie
  const serie = filtered.map(row => {
    const fecha = row[0];
    const codigo = row[1];
    const punto = {
      fecha: fecha,
      inventario: row[4]
    };
    
    // NUEVO: Agregar vencimientos si existen para esta fecha/código
    const key = `${fecha}_${codigo}`;
    if (vencimientos[key] && vencimientos[key].length > 0) {
      punto.vencimientos = vencimientos[key];
    }
    
    return punto;
  });
  
  // Ordenar por fecha
  serie.sort((a, b) => a.fecha.localeCompare(b.fecha));
  
  // Calcular estadísticas
  const stats = calculateStats(filtered);
  
  // Obtener etiquetas del producto
  const firstRow = filtered[0];
  const subjectCode = firstRow[1];
  const subjectName = firstRow[2];
  const subjectGroup = firstRow[3];
  
  const result = {
    serie,
    subject_code: subjectCode,
    subject_name: subjectName,
    subject_label: params.grupo ? `Grupo: ${params.grupo}` : subjectName,
    ...stats
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * NUEVO: Obtiene vencimientos agrupados por fecha y código
 * 
 * Retorna un objeto con estructura:
 * {
 *   "2024-01-15_PROD001": [
 *     {fecha_vencimiento: "2024-02-01", cantidad: 200},
 *     {fecha_vencimiento: "2024-03-01", cantidad: 300}
 *   ]
 * }
 */
function getVencimientosForSerie(vencData, params) {
  if (!vencData || vencData.length <= 1) return {};
  
  let filtered = vencData.slice(1);
  
  // Aplicar los mismos filtros que la serie principal
  if (params.codigo) {
    filtered = filtered.filter(row => row[1] === params.codigo);
  }
  
  if (params.suministro) {
    filtered = filtered.filter(row => row[2] === params.suministro);
  }
  
  if (params.grupo) {
    filtered = filtered.filter(row => row[3] === params.grupo);
  }
  
  if (params.from) {
    filtered = filtered.filter(row => row[0] >= params.from);
  }
  
  if (params.to) {
    filtered = filtered.filter(row => row[0] <= params.to);
  }
  
  // Agrupar por fecha + código
  const grouped = {};
  
  for (const row of filtered) {
    const fecha = row[0];
    const codigo = row[1];
    const fechaVenc = row[4];
    const cantidad = row[5];
    
    const key = `${fecha}_${codigo}`;
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    
    grouped[key].push({
      fecha_vencimiento: fechaVenc,
      cantidad: cantidad
    });
  }
  
  return grouped;
}

/**
 * Calcula estadísticas básicas para la serie
 */
function calculateStats(data) {
  if (data.length === 0) {
    return {
      min_value: 0,
      min_date: '',
      max_value: 0,
      max_date: '',
      avg_30: 0,
      mu_d: 0,
      sigma_d: 0,
      kb_min: 0,
      inventario_critico: 0,
      lead: 45
    };
  }
  
  // Valores de inventario
  const valores = data.map(row => Number(row[4]));
  
  // Min y Max
  let minValue = valores[0];
  let minDate = data[0][0];
  let maxValue = valores[0];
  let maxDate = data[0][0];
  
  for (let i = 0; i < valores.length; i++) {
    if (valores[i] < minValue) {
      minValue = valores[i];
      minDate = data[i][0];
    }
    if (valores[i] > maxValue) {
      maxValue = valores[i];
      maxDate = data[i][0];
    }
  }
  
  // Promedio últimos 30 días
  const last30 = valores.slice(-30);
  const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length;
  
  // Calcular tasas de consumo diario
  const tasas = [];
  for (let i = 1; i < data.length; i++) {
    const prev = Number(data[i - 1][4]);
    const curr = Number(data[i][4]);
    const delta = Math.max(prev - curr, 0);
    
    // Días entre lecturas
    const d1 = new Date(data[i - 1][0]);
    const d2 = new Date(data[i][0]);
    const days = Math.max((d2 - d1) / (1000 * 60 * 60 * 24), 1);
    
    const rate = delta / days;
    if (rate > 0) tasas.push(rate);
  }
  
  // Estadísticas robustas (mediana y MAD)
  let muD = 0;
  let sigmaD = 0;
  
  if (tasas.length > 0) {
    tasas.sort((a, b) => a - b);
    const median = tasas[Math.floor(tasas.length / 2)];
    muD = median;
    
    const deviations = tasas.map(v => Math.abs(v - median));
    deviations.sort((a, b) => a - b);
    const mad = deviations[Math.floor(deviations.length / 2)];
    sigmaD = 1.4826 * mad;
  }
  
  const lead = 45;
  const z = 1.65; // 95%
  
  const kbMin = muD * lead;
  const inventarioCritico = z * sigmaD * Math.sqrt(lead);
  
  return {
    min_value: minValue,
    min_date: minDate,
    max_value: maxValue,
    max_date: maxDate,
    avg_30: avg30,
    mu_d: muD,
    sigma_d: sigmaD,
    kb_min: kbMin,
    inventario_critico: inventarioCritico,
    lead: lead
  };
}

// ============================================================================
// FUNCIONES DE UTILIDAD Y TESTING
// ============================================================================

/**
 * Función de prueba para verificar el procesamiento de vencimientos
 */
function testVencimientos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vencSheet = ss.getSheetByName(SHEETS.VENCIMIENTOS);
  
  if (!vencSheet) {
    Logger.log('Hoja de Vencimientos no existe. Ejecuta setup() primero.');
    return;
  }
  
  const data = vencSheet.getDataRange().getValues();
  Logger.log(`Total de registros de vencimiento: ${data.length - 1}`);
  
  if (data.length > 1) {
    Logger.log('Primeros 5 registros:');
    for (let i = 1; i < Math.min(6, data.length); i++) {
      Logger.log(`  ${data[i][0]} | ${data[i][1]} | Vence: ${data[i][4]} | Cant: ${data[i][5]}`);
    }
  }
}

/**
 * Función para generar datos de prueba de vencimientos
 */
function generarDatosPruebaVencimientos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vencSheet = ss.getSheetByName(SHEETS.VENCIMIENTOS);
  
  if (!vencSheet) {
    Logger.log('Ejecuta setup() primero');
    return;
  }
  
  // Generar algunos datos de prueba
  const hoy = new Date();
  const datos = [];
  
  for (let i = 0; i < 10; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    const fechaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Vencimiento 1: ya vencido
    const venc1 = new Date(hoy);
    venc1.setDate(venc1.getDate() - 30);
    const venc1Str = Utilities.formatDate(venc1, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Vencimiento 2: futuro
    const venc2 = new Date(hoy);
    venc2.setDate(venc2.getDate() + 60);
    const venc2Str = Utilities.formatDate(venc2, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    datos.push([fechaStr, 'TEST001', 'Producto de Prueba', 'Medicamentos', venc1Str, 200]);
    datos.push([fechaStr, 'TEST001', 'Producto de Prueba', 'Medicamentos', venc2Str, 800]);
  }
  
  if (vencSheet.getLastRow() > 1) {
    vencSheet.getRange(2, 1, vencSheet.getLastRow() - 1, 6).clear();
  }
  
  vencSheet.getRange(2, 1, datos.length, 6).setValues(datos);
  Logger.log(`✓ ${datos.length} registros de prueba generados`);
}
