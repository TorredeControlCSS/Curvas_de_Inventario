/**
 * INV Dashboard — Backend (Apps Script) v2 + Vencimientos (estricto)
 * - Consolida inventario desde Drive (recursivo, soporta shortcuts).
 * - Columnas REQUERIDAS en hoja SALMI: FECHA, Código, Suministro, Grupo, Cantidad
 * - NUEVO: Detecta automáticamente columnas de vencimiento: "Fecha Vto", "Nº de Lote"
 * - API: list=true (códigos, suministros, grupos, min/max fecha).
 * - API: filtros ?grupo=, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?codigo=, ?suministro=.
 * - Encabezados congelados y orden seguro (no mueve headers).
 * - Detección ESTRICTA de encabezados (primeras 5 filas). Si falta alguna, se omite el archivo y se deja log.
 * 
 * CONFIGURACIÓN DE PERFORMANCE:
 * - PROCESS_VENCIMIENTOS = false: Solo inventario (RÁPIDO ~2-3 seg/archivo, como script original) ← POR DEFECTO
 * - PROCESS_VENCIMIENTOS = true: Procesa fechas de vencimiento (LENTO ~6-7 seg/archivo, requiere 2-3 ejecuciones)
 * - BATCH_SIZE = 10: Escribe cada 10 archivos (por defecto)
 * 
 * RECOMENDACIÓN:
 * 1. Usa PROCESS_VENCIMIENTOS = false para consolidar rápidamente (2-3 min para 60+ archivos)
 * 2. Activa PROCESS_VENCIMIENTOS = true solo cuando necesites análisis de vencimientos
 * 3. Con PROCESS_VENCIMIENTOS = true, reduce BATCH_SIZE a 3-5 para más seguridad
 * 
 * Requisitos: Drive API v2 activada en servicios avanzados de Apps Script.
 */

const CONFIG = {
  FOLDER_ID: '1zHezlIPxR1KK33rVlVFLv-YVEAvw6pmH',
  SHEET_NAME: 'SALMI',
  DATA_SHEET: 'Data',
  INDEX_SHEET: 'Index',
  VENCIMIENTOS_SHEET: 'Vencimientos', // NUEVO: Hoja para datos de vencimiento
  PROCESS_VENCIMIENTOS: false, // NUEVO: false = solo inventario (RÁPIDO, como original), true = con vencimientos (LENTO)
  BATCH_SIZE: 10, // NUEVO: Escribir cada N archivos (10 = por defecto, 3-5 = más conservador si hay timeout)
  LEAD: 45,
  Z: 1.65,
  WINDOW: 90
};

// ========= Utilidades de fechas/formatos =========
function dateKey(x) {
  if (x instanceof Date) return x.getTime();
  const d = new Date(x);
  return isNaN(d) ? 0 : d.getTime();
}
function fmtDate(d){ return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function parseDate(v){
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel serial
  return null;
}
function toNumber(v){ if (typeof v === 'number') return v; const n = Number(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n) ? 0 : n; }
function json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function median(arr){ if (!arr.length) return 0; const a=[...arr].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2? a[m]:(a[m-1]+a[m])/2; }
function mad(arr){ if (!arr.length) return 0; const m=median(arr); const d=arr.map(x=>Math.abs(x-m)); return median(d); }

// ========= Setup de hojas =========
function setup() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet(ss, CONFIG.DATA_SHEET, ['FECHA','Código','Suministro','Grupo','Cantidad']);
  ensureSheet(ss, CONFIG.INDEX_SHEET, ['Código','Suministro','Grupo']);
  ensureSheet(ss, CONFIG.VENCIMIENTOS_SHEET, ['FECHA','Código','Suministro','Grupo','Fecha_Vencimiento','Cantidad']); // NUEVO
  ss.getSheets().forEach(sh => {
    if (sh.getName().match(/^Hoja \d+$/) && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  ss.getSheetByName(CONFIG.DATA_SHEET).setFrozenRows(1);
  ss.getSheetByName(CONFIG.INDEX_SHEET).setFrozenRows(1);
  ss.getSheetByName(CONFIG.VENCIMIENTOS_SHEET).setFrozenRows(1); // NUEVO
}
function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

// ========= Detección ESTRICTA de encabezados =========
function normalizeHeader(s){
  return String(s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita acentos
    .replace(/\s+/g,' ')      // colapsa espacios
    .trim().toUpperCase();    // mayúsculas
}
// nombres requeridos (normalizados)
const REQUIRED_HDR = ["FECHA","CODIGO","SUMINISTRO","GRUPO","CANTIDAD"];

// NUEVO: Nombres opcionales para vencimientos (normalizados)
const VENC_HDR_OPTIONS = ["FECHA VTO","FECHA_VTO","FECHAVTO","VENCIMIENTO","FECHA_VENCIMIENTO","FECHAVENCIMIENTO","EXPIRY","CADUCIDAD"];
const LOTE_HDR_OPTIONS = ["NO DE LOTE","N DE LOTE","LOTE","BATCH","LOT","NUM LOTE","NUMERO DE LOTE"];

/**
 * Busca la fila de encabezado en las primeras 5 filas y devuelve {row, idx, vencIdx}
 * donde idx es un objeto con índices por nombre requerido.
 * vencIdx (NUEVO) tiene: fechaVto (índice o -1), lote (índice o -1)
 * Requiere que estén TODAS las columnas: FECHA, CODIGO, SUMINISTRO, GRUPO, CANTIDAD
 */
function detectHeaderStrict(values){
  const maxProbe = Math.min(values.length, 5);
  for (let r=0; r<maxProbe; r++){
    const row = values[r];
    if (!row || row.length === 0) continue;
    const norm = row.map(normalizeHeader);
    const idx = {};
    let foundAll = true;
    for (const req of REQUIRED_HDR){
      const pos = norm.indexOf(req);
      if (pos === -1){ foundAll=false; break; }
      idx[req] = pos;
    }
    if (!foundAll) continue;
    
    // NUEVO: Buscar columnas de vencimiento (opcionales) - SOLO SI ESTÁ ACTIVADO
    const vencIdx = { fechaVto: -1, lote: -1 };
    if (CONFIG.PROCESS_VENCIMIENTOS) {
      for (const vOpt of VENC_HDR_OPTIONS){
        const pos = norm.indexOf(vOpt);
        if (pos !== -1){ vencIdx.fechaVto = pos; break; }
      }
      for (const lOpt of LOTE_HDR_OPTIONS){
        const pos = norm.indexOf(lOpt);
        if (pos !== -1){ vencIdx.lote = pos; break; }
      }
    }
    
    return { row: r, idx, vencIdx };
  }
  return null;
}

// ========= Consolidación recursiva =========
function consolidate(){
  const ss = SpreadsheetApp.getActive();
  const dSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
  const iSheet = ss.getSheetByName(CONFIG.INDEX_SHEET);
  
  // NUEVO: Solo verificar hoja de vencimientos si está activado el procesamiento
  let vSheet = null;
  if (CONFIG.PROCESS_VENCIMIENTOS) {
    vSheet = ss.getSheetByName(CONFIG.VENCIMIENTOS_SHEET);
    if (!vSheet){
      Logger.log('ERROR: Falta hoja Vencimientos. Ejecuta setup() primero o desactiva PROCESS_VENCIMIENTOS.');
      return;
    }
  }
  
  if (!dSheet || !iSheet){
    Logger.log('ERROR: Faltan hojas Data o Index. Ejecuta setup() primero.');
    return;
  }
  
  // Limpiar hojas (mantener encabezados)
  // Usar clearContent en lugar de deleteRows para evitar problemas con filas inmovilizadas
  if (dSheet.getLastRow() > 1) {
    dSheet.getRange(2, 1, dSheet.getLastRow()-1, dSheet.getLastColumn()).clearContent();
  }
  if (iSheet.getLastRow() > 1) {
    iSheet.getRange(2, 1, iSheet.getLastRow()-1, iSheet.getLastColumn()).clearContent();
  }
  // NUEVO: Solo limpiar hoja vencimientos si está activado el procesamiento
  if (vSheet && vSheet.getLastRow() > 1) {
    vSheet.getRange(2, 1, vSheet.getLastRow()-1, vSheet.getLastColumn()).clearContent();
  }
  
  let allData = [];
  let allVenc = []; // NUEVO: array para vencimientos (solo si está activado)
  const indexMap = new Map();
  let filesProcessed = 0; // NUEVO: contador para escribir por lotes
  
  function processFolder(folderId){
    Logger.log(`→ Procesando carpeta: ${folderId}`);
    const folder = DriveApp.getFolderById(folderId);
    
    // Procesar archivos (Google Sheets y shortcuts en un solo pase)
    const files = folder.getFiles();
    while (files.hasNext()){
      const file = files.next();
      const mimeType = file.getMimeType();
      
      // Procesar shortcuts a carpetas
      if (mimeType === MimeType.SHORTCUT){
        try {
          const targetId = file.getTargetId();
          const target = DriveApp.getFolderById(targetId);
          processFolder(targetId);
        } catch(e){
          Logger.log(`  ✗ Shortcut error: ${e.message}`);
        }
        continue;
      }
      
      // Filtrar solo archivos Google Sheets
      if (mimeType !== MimeType.GOOGLE_SHEETS) {
        continue;
      }
      
      Logger.log(`  Archivo: ${file.getName()}`);
      try {
        const result = processSheetFile(file);
        if (result.data.length > 0){
          allData.push(...result.data);
          result.index.forEach(item => {
            if (!indexMap.has(item.codigo)) indexMap.set(item.codigo, item);
          });
        }
        // NUEVO: Agregar datos de vencimientos si existen y está habilitado
        if (CONFIG.PROCESS_VENCIMIENTOS && result.vencimientos && result.vencimientos.length > 0){
          allVenc.push(...result.vencimientos);
          Logger.log(`    ✓ ${result.vencimientos.length} registros de vencimiento`);
        }
        
        filesProcessed++;
        
        // NUEVO: Escribir por lotes más frecuentes para evitar timeout
        if (filesProcessed % CONFIG.BATCH_SIZE === 0 && (allData.length > 0 || allVenc.length > 0)){
          if (allData.length > 0){
            const lastRow = dSheet.getLastRow();
            dSheet.getRange(lastRow + 1, 1, allData.length, 5).setValues(allData);
            Logger.log(`  → Escritura parcial: ${allData.length} registros inventario (total: ${lastRow + allData.length - 1})`);
            allData = []; // Limpiar memoria
          }
          if (CONFIG.PROCESS_VENCIMIENTOS && allVenc.length > 0){
            const lastRow = vSheet.getLastRow();
            vSheet.getRange(lastRow + 1, 1, allVenc.length, 6).setValues(allVenc);
            Logger.log(`  → Escritura parcial: ${allVenc.length} registros vencimiento (total: ${lastRow + allVenc.length - 1})`);
            allVenc = []; // Limpiar memoria
          }
        }
        
      } catch(e){
        Logger.log(`    ✗ Error: ${e.message}`);
      }
    }
    
    // Recursión en subcarpetas
    const folders = folder.getFolders();
    while (folders.hasNext()){
      const sub = folders.next();
      processFolder(sub.getId());
    }
  }
  
  processFolder(CONFIG.FOLDER_ID);
  
  // Escribir datos finales (lo que quedó sin escribir)
  if (allData.length > 0){
    const lastRow = dSheet.getLastRow();
    dSheet.getRange(lastRow + 1, 1, allData.length, 5).setValues(allData);
    Logger.log(`✓ Escritura final: ${allData.length} registros de inventario`);
  }
  
  // NUEVO: Escribir datos finales de vencimientos (solo si está activado)
  if (CONFIG.PROCESS_VENCIMIENTOS && allVenc.length > 0){
    const lastRow = vSheet.getLastRow();
    vSheet.getRange(lastRow + 1, 1, allVenc.length, 6).setValues(allVenc);
    Logger.log(`✓ Escritura final: ${allVenc.length} registros de vencimiento`);
  }
  
  // Resumen final
  const totalInv = dSheet.getLastRow() - 1;
  Logger.log(`✓ ${totalInv} registros de inventario consolidados (total)`);
  if (CONFIG.PROCESS_VENCIMIENTOS && vSheet) {
    const totalVenc = vSheet.getLastRow() - 1;
    Logger.log(`✓ ${totalVenc} registros de vencimiento consolidados (total)`);
  }
  
  // Índice
  if (indexMap.size > 0){
    const indexData = Array.from(indexMap.values()).map(x => [x.codigo, x.suministro, x.grupo]);
    iSheet.getRange(2,1,indexData.length,3).setValues(indexData);
    Logger.log(`✓ ${indexData.length} productos en índice`);
  }
  
  Logger.log('✓ Consolidación completada');
}

function processSheetFile(file){
  try {
    // Abrir directamente el archivo Google Sheets (sin conversión)
    const ss = SpreadsheetApp.openById(file.getId());
    
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
    const values = sheet.getDataRange().getValues();
    
    const hdr = detectHeaderStrict(values);
    if (!hdr){
      Logger.log(`    ⚠ Encabezados no encontrados o incompletos`);
      return { data: [], index: [], vencimientos: [] };
    }
    
    const data = [];
    const vencimientos = []; // NUEVO
    const index = [];
    const inventoryAgg = new Map(); // NUEVO: Para agregar inventario cuando hay vencimientos
    
    const idx = hdr.idx;
    const vencIdx = hdr.vencIdx; // NUEVO
    const hasVenc = vencIdx.fechaVto !== -1; // NUEVO: flag si tiene datos de vencimiento
    
    for (let i = hdr.row + 1; i < values.length; i++){
      const row = values[i];
      if (!row || row.length === 0) continue;
      
      const fecha = parseDate(row[idx.FECHA]);
      if (!fecha) continue;
      const fechaStr = fmtDate(fecha);
      
      const codigo = String(row[idx.CODIGO]||'').trim();
      if (!codigo) continue;
      
      const suministro = String(row[idx.SUMINISTRO]||'').trim();
      const grupo = String(row[idx.GRUPO]||'').trim();
      const cantidad = toNumber(row[idx.CANTIDAD]);
      if (cantidad === 0) continue;
      
      // Índice
      if (!index.find(x => x.codigo === codigo)){
        index.push({ codigo, suministro, grupo });
      }
      
      // NUEVO: Procesar vencimientos si existen y está habilitado
      if (hasVenc && CONFIG.PROCESS_VENCIMIENTOS){
        const fechaVto = parseDate(row[vencIdx.fechaVto]);
        if (fechaVto){
          const fechaVtoStr = fmtDate(fechaVto);
          vencimientos.push([fechaStr, codigo, suministro, grupo, fechaVtoStr, cantidad]);
        }
        
        // Agregar inventario total por fecha y código
        const key = `${fechaStr}_${codigo}`;
        if (!inventoryAgg.has(key)){
          inventoryAgg.set(key, { fecha: fechaStr, codigo, suministro, grupo, total: 0 });
        }
        inventoryAgg.get(key).total += cantidad;
      } else {
        // Sin datos de vencimiento o deshabilitado, procesar como antes
        data.push([fechaStr, codigo, suministro, grupo, cantidad]);
      }
    }
    
    // NUEVO: Si procesamos vencimientos, usar inventario agregado
    if (hasVenc && CONFIG.PROCESS_VENCIMIENTOS && inventoryAgg.size > 0){
      for (const [key, item] of inventoryAgg){
        data.push([item.fecha, item.codigo, item.suministro, item.grupo, item.total]);
      }
    }
    
    return { data, index, vencimientos };
    
  } catch(e){
    Logger.log(`    ✗ Error procesando archivo: ${e.message}`);
    throw e;
  }
}

// ========= Trigger diario =========
function createDailyTrigger(){
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'consolidate') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('consolidate').timeBased().atHour(3).everyDays(1).create();
  Logger.log('✓ Trigger diario creado (3:00 AM)');
}

// ========= API Web (doGet) =========
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

function getMetadata(){
  const ss = SpreadsheetApp.getActive();
  const dSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
  const iSheet = ss.getSheetByName(CONFIG.INDEX_SHEET);
  
  const data = dSheet.getDataRange().getValues();
  const index = iSheet.getDataRange().getValues();
  
  const fechas = data.slice(1).map(r => r[0]).filter(x => x);
  const minFecha = fechas.length > 0 ? Math.min(...fechas.map(dateKey)) : 0;
  const maxFecha = fechas.length > 0 ? Math.max(...fechas.map(dateKey)) : 0;
  
  const codigos = [...new Set(index.slice(1).map(r => r[0]))].sort();
  const suministros = [...new Set(index.slice(1).map(r => r[1]))].sort();
  const grupos = [...new Set(index.slice(1).map(r => r[2]).filter(x => x))].sort();
  
  return json({
    codigos,
    suministros,
    grupos,
    min_fecha: minFecha ? fmtDate(new Date(minFecha)) : '',
    max_fecha: maxFecha ? fmtDate(new Date(maxFecha)) : ''
  });
}

function getSerie(p){
  const ss = SpreadsheetApp.getActive();
  const dSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
  const vSheet = ss.getSheetByName(CONFIG.VENCIMIENTOS_SHEET); // NUEVO
  
  const data = dSheet.getDataRange().getValues();
  const vencData = vSheet ? vSheet.getDataRange().getValues() : []; // NUEVO
  
  let filtered = data.slice(1);
  
  // Filtros
  if (p.codigo) filtered = filtered.filter(r => r[1] === p.codigo);
  if (p.suministro) filtered = filtered.filter(r => r[2] === p.suministro);
  if (p.grupo) filtered = filtered.filter(r => r[3] === p.grupo);
  if (p.from){
    const fromKey = dateKey(p.from);
    filtered = filtered.filter(r => dateKey(r[0]) >= fromKey);
  }
  if (p.to){
    const toKey = dateKey(p.to);
    filtered = filtered.filter(r => dateKey(r[0]) <= toKey);
  }
  
  if (filtered.length === 0) return json({ serie: [] });
  
  // NUEVO: Obtener vencimientos para los mismos filtros
  const vencimientos = getVencimientosForSerie(vencData, p);
  
  // Construir serie con vencimientos
  const serie = filtered.map(r => {
    const fecha = fmtDate(parseDate(r[0]));
    const codigo = r[1];
    const punto = {
      fecha: fecha,
      inventario: toNumber(r[4])
    };
    
    // NUEVO: Agregar vencimientos si existen
    const key = `${fecha}_${codigo}`;
    if (vencimientos[key] && vencimientos[key].length > 0){
      punto.vencimientos = vencimientos[key];
    }
    
    return punto;
  });
  
  serie.sort((a,b) => a.fecha.localeCompare(b.fecha));
  
  // Estadísticas
  const stats = calcStats(filtered);
  
  const firstRow = filtered[0];
  const result = {
    serie,
    subject_code: firstRow[1],
    subject_name: firstRow[2],
    subject_label: p.grupo ? `Grupo: ${p.grupo}` : firstRow[2],
    ...stats
  };
  
  return json(result);
}

// NUEVO: Obtener vencimientos agrupados por fecha y código
function getVencimientosForSerie(vencData, p){
  if (!vencData || vencData.length <= 1) return {};
  
  let filtered = vencData.slice(1);
  
  // Aplicar mismos filtros
  if (p.codigo) filtered = filtered.filter(r => r[1] === p.codigo);
  if (p.suministro) filtered = filtered.filter(r => r[2] === p.suministro);
  if (p.grupo) filtered = filtered.filter(r => r[3] === p.grupo);
  if (p.from){
    const fromKey = dateKey(p.from);
    filtered = filtered.filter(r => dateKey(r[0]) >= fromKey);
  }
  if (p.to){
    const toKey = dateKey(p.to);
    filtered = filtered.filter(r => dateKey(r[0]) <= toKey);
  }
  
  // Agrupar por fecha + código
  const grouped = {};
  for (const r of filtered){
    const fecha = fmtDate(parseDate(r[0]));
    const codigo = r[1];
    const fechaVenc = fmtDate(parseDate(r[4]));
    const cantidad = toNumber(r[5]);
    
    const key = `${fecha}_${codigo}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      fecha_vencimiento: fechaVenc,
      cantidad: cantidad
    });
  }
  
  return grouped;
}

function calcStats(data){
  if (data.length === 0) return {
    min_value: 0, min_date: '', max_value: 0, max_date: '', avg_30: 0,
    mu_d: 0, sigma_d: 0, kb_min: 0, inventario_critico: 0, lead: CONFIG.LEAD
  };
  
  const valores = data.map(r => toNumber(r[4]));
  let minValue = valores[0], minDate = data[0][0];
  let maxValue = valores[0], maxDate = data[0][0];
  
  for (let i = 0; i < valores.length; i++){
    if (valores[i] < minValue){ minValue = valores[i]; minDate = data[i][0]; }
    if (valores[i] > maxValue){ maxValue = valores[i]; maxDate = data[i][0]; }
  }
  
  const last30 = valores.slice(-30);
  const avg30 = last30.reduce((a,b) => a+b, 0) / last30.length;
  
  // Tasas de consumo
  const tasas = [];
  for (let i = 1; i < data.length; i++){
    const prev = toNumber(data[i-1][4]);
    const curr = toNumber(data[i][4]);
    const delta = Math.max(prev - curr, 0);
    const d1 = parseDate(data[i-1][0]);
    const d2 = parseDate(data[i][0]);
    const days = Math.max((d2 - d1) / 86400000, 1);
    const rate = delta / days;
    if (rate > 0) tasas.push(rate);
  }
  
  let muD = 0, sigmaD = 0;
  if (tasas.length > 0){
    muD = median(tasas);
    sigmaD = 1.4826 * mad(tasas);
  }
  
  const kbMin = muD * CONFIG.LEAD;
  const inventarioCritico = CONFIG.Z * sigmaD * Math.sqrt(CONFIG.LEAD);
  
  return {
    min_value: minValue,
    min_date: fmtDate(parseDate(minDate)),
    max_value: maxValue,
    max_date: fmtDate(parseDate(maxDate)),
    avg_30: avg30,
    mu_d: muD,
    sigma_d: sigmaD,
    kb_min: kbMin,
    inventario_critico: inventarioCritico,
    lead: CONFIG.LEAD
  };
}

// ========= Funciones de prueba =========
function testVencimientos(){
  const ss = SpreadsheetApp.getActive();
  const vSheet = ss.getSheetByName(CONFIG.VENCIMIENTOS_SHEET);
  
  if (!vSheet){
    Logger.log('Hoja Vencimientos no existe. Ejecuta setup()');
    return;
  }
  
  const data = vSheet.getDataRange().getValues();
  Logger.log(`Total registros vencimiento: ${data.length - 1}`);
  
  if (data.length > 1){
    Logger.log('Primeros 5 registros:');
    for (let i = 1; i < Math.min(6, data.length); i++){
      Logger.log(`  ${data[i][0]} | ${data[i][1]} | Vence: ${data[i][4]} | Cant: ${data[i][5]}`);
    }
  }
}
