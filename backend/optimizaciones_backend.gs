/**
 * optimizaciones_backend.gs — Parche de optimización de rendimiento
 * ─────────────────────────────────────────────────────────────────
 * Cómo aplicar:
 *  1. Copia este archivo en el editor de Google Apps Script.
 *  2. En Code.gs (o donde estén las funciones originales), reemplaza
 *     las llamadas directas a las funciones F8 por las versiones "_Cached":
 *       - getRecepcionYTransitoMap_DesdeF8()  →  getRecepcionYTransitoMap_DesdeF8_Cached()
 *       - getReservasMap_DesdeF8()            →  getReservasMap_DesdeF8_Cached()
 *       - getForecastMensualMap_DesdeUE()     →  getForecastMensualMap_DesdeUE_Cached()
 *  3. En doGet(), reemplaza la lógica del bloque "list=true" por la versión
 *     optimizada (ver función doGet_list_optimizado_ más abajo).
 *  4. En doGet(), excluye el parámetro "ts" de la cache key (ver ejemplo al final).
 *
 * Estas funciones dependen de las funciones originales (getRecepcionYTransitoMap_DesdeF8,
 * etc.) que deben seguir existiendo en Code.gs tal como están.
 *
 * TTL del caché: 300 segundos (5 minutos). Ajusta la constante CACHE_TTL_SECONDS.
 */

var CACHE_TTL_SECONDS = 300; // 5 minutos

// ──────────────────────────────────────────────────────────────
// WRAPPERS CON CACHÉ PARA LECTURAS DEL LIBRO EXTERNO F8
// ──────────────────────────────────────────────────────────────

/**
 * Versión con caché de getRecepcionYTransitoMap_DesdeF8().
 * Evita abrir el spreadsheet externo F8 en cada petición.
 * @return {Map}
 */
function getRecepcionYTransitoMap_DesdeF8_Cached() {
  return getMapFromCache_('f8_rt_v1', getRecepcionYTransitoMap_DesdeF8);
}

/**
 * Versión con caché de getReservasMap_DesdeF8().
 * @return {Map}
 */
function getReservasMap_DesdeF8_Cached() {
  return getMapFromCache_('f8_reservas_v1', getReservasMap_DesdeF8);
}

/**
 * Versión con caché de getForecastMensualMap_DesdeUE().
 * @return {Map}
 */
function getForecastMensualMap_DesdeUE_Cached() {
  return getMapFromCache_('f8_forecast_v1', getForecastMensualMap_DesdeUE);
}

/**
 * Invalida manualmente los cachés de F8.
 * Útil para forzar una relectura después de una actualización de datos.
 * Llamar desde el editor si se necesita refrescar antes de que expire el TTL.
 */
function invalidarCacheF8() {
  var cache = CacheService.getScriptCache();
  cache.removeAll(['f8_rt_v1', 'f8_reservas_v1', 'f8_forecast_v1']);
  Logger.log('Caché de F8 invalidado.');
}

// ──────────────────────────────────────────────────────────────
// OPTIMIZACIÓN DEL ENDPOINT ?list=true
// ──────────────────────────────────────────────────────────────

/**
 * Reemplaza la lógica del bloque "list=true" en doGet().
 *
 * Lee la hoja Index (que ya tiene los valores únicos precalculados) en lugar de
 * escanear toda la hoja Data. Esto reduce el tiempo de respuesta de ~8-15 s a <1 s.
 *
 * Estructura esperada de la hoja "Index":
 *   Columna A: códigos únicos
 *   Columna B: suministros únicos
 *   Columna C: grupos únicos
 *   Columna D (fila 1 o 2): fecha mínima
 *   Columna E (fila 1 o 2): fecha máxima
 *
 * Si tu hoja Index tiene una estructura distinta, ajusta los índices de columna.
 *
 * Uso en doGet():
 *   if (e.parameter.list === 'true') {
 *     return doGet_list_optimizado_(ss);
 *   }
 *
 * @param {Spreadsheet} ss  El spreadsheet activo (SpreadsheetApp.getActiveSpreadsheet()).
 * @return {TextOutput}     JSON con { codigos, suministros, grupos, min_fecha, max_fecha }.
 */
function doGet_list_optimizado_(ss) {
  // Intentar desde caché primero
  var cache    = CacheService.getScriptCache();
  var CACHE_KEY = 'list_v1';
  var hit = cache.get(CACHE_KEY);
  if (hit) {
    return ContentService
      .createTextOutput(hit)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Leer hoja Index
  var idxSh = ss.getSheetByName('Index');
  if (!idxSh) {
    // Fallback: leer desde Data si no existe Index
    return doGet_list_desde_data_(ss, cache, CACHE_KEY);
  }

  var vals = idxSh.getDataRange().getValues();
  // Asume fila 0 como encabezados; ajusta si la hoja no tiene encabezados
  var codigos     = [];
  var suministros = [];
  var grupos      = [];
  var minFecha    = '';
  var maxFecha    = '';

  vals.forEach(function(row, i) {
    if (i === 0) {
      // Primera fila: encabezados o primera fecha — leer fechas si están aquí
      if (row[3]) minFecha = formatFechaGs_(row[3]);
      if (row[4]) maxFecha = formatFechaGs_(row[4]);
      return;
    }
    if (row[0]) codigos.push(String(row[0]).trim());
    if (row[1]) suministros.push(String(row[1]).trim());
    if (row[2]) grupos.push(String(row[2]).trim());
    var f3 = row[3] ? formatFechaGs_(row[3]) : '';
    var f4 = row[4] ? formatFechaGs_(row[4]) : '';
    if (f3 && (!minFecha || f3 < minFecha)) minFecha = f3;
    if (f4 && (!maxFecha || f4 > maxFecha)) maxFecha = f4;
  });

  // Deduplicar y ordenar
  codigos     = Array.from(new Set(codigos)).sort();
  suministros = Array.from(new Set(suministros)).sort();
  grupos      = Array.from(new Set(grupos.filter(Boolean))).sort();

  var payload = JSON.stringify({ codigos: codigos, suministros: suministros, grupos: grupos, min_fecha: minFecha, max_fecha: maxFecha });

  try { cache.put(CACHE_KEY, payload, CACHE_TTL_SECONDS); } catch(e) { Logger.log('Cache put error: ' + e); }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fallback: construye la lista leyendo la hoja Data completa.
 * Solo se usa si la hoja Index no existe.
 * @private
 */
function doGet_list_desde_data_(ss, cache, cacheKey) {
  var dataSh = ss.getSheetByName('Data');
  if (!dataSh) {
    var empty = JSON.stringify({ codigos: [], suministros: [], grupos: [], min_fecha: '', max_fecha: '' });
    return ContentService.createTextOutput(empty).setMimeType(ContentService.MimeType.JSON);
  }

  var rows    = dataSh.getDataRange().getValues();
  var header  = rows[0] || [];
  var iCod    = header.indexOf('Código');
  var iSup    = header.indexOf('Suministro');
  var iGrp    = header.indexOf('Grupo');
  var iFecha  = header.indexOf('Fecha');
  var codigos     = new Set();
  var suministros = new Set();
  var grupos      = new Set();
  var fechas      = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (iCod   >= 0 && r[iCod])   codigos.add(String(r[iCod]).trim());
    if (iSup   >= 0 && r[iSup])   suministros.add(String(r[iSup]).trim());
    if (iGrp   >= 0 && r[iGrp])   grupos.add(String(r[iGrp]).trim());
    if (iFecha >= 0 && r[iFecha])  fechas.push(formatFechaGs_(r[iFecha]));
  }

  fechas.sort();
  var payload = JSON.stringify({
    codigos     : Array.from(codigos).sort(),
    suministros : Array.from(suministros).sort(),
    grupos      : Array.from(grupos).filter(Boolean).sort(),
    min_fecha   : fechas[0] || '',
    max_fecha   : fechas[fechas.length - 1] || ''
  });

  try { cache.put(cacheKey, payload, CACHE_TTL_SECONDS); } catch(e) {}

  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────────────────────
// OPTIMIZACIÓN DE LA CACHE KEY EN doGet() — EXCLUIR "ts"
// ──────────────────────────────────────────────────────────────

/**
 * Construye la cache key del servidor excluyendo el parámetro "ts".
 *
 * El parámetro "ts" (timestamp) lo envía el frontend solo en refreshes forzados
 * para invalidar el caché del navegador/CDN. No debe invalidar el caché del servidor.
 *
 * Reemplaza en doGet() cualquier construcción de cache key que incluya "ts" por:
 *   var cacheKey = buildServerCacheKey_(e.parameter);
 *
 * @param {Object} params  e.parameter de doGet()
 * @return {string}        Cache key sin "ts"
 */
function buildServerCacheKey_(params) {
  // Usar array con pares clave-valor ordenados para garantizar determinismo
  var parts = [
    ['list',       params.list       || ''],
    ['codigo',     params.codigo     || ''],
    ['suministro', params.suministro || ''],
    ['grupo',      params.grupo      || ''],
    ['from',       params.from       || ''],
    ['to',         params.to         || ''],
    ['report',     params.report     || '']
    // "ts" excluido intencionalmente: solo sirve para cache-busting en el cliente
  ];
  return 'q:' + JSON.stringify(parts);
}

// ──────────────────────────────────────────────────────────────
// HELPER PRIVADO — caché genérico para Maps
// ──────────────────────────────────────────────────────────────

/**
 * Obtiene un Map desde caché o llama a la función original si no hay hit.
 * @param {string}   key     Clave única en CacheService
 * @param {Function} loader  Función sin argumentos que devuelve el Map original
 * @return {Map}
 * @private
 */
function getMapFromCache_(key, loader) {
  var cache = CacheService.getScriptCache();
  var hit   = cache.get(key);

  if (hit) {
    try {
      var obj = JSON.parse(hit);
      var m   = new Map();
      Object.keys(obj).forEach(function(k) { m.set(k, obj[k]); });
      return m;
    } catch (e) {
      Logger.log('Error deserializando caché "' + key + '": ' + e);
    }
  }

  // Llamar a la función original (acceso real al spreadsheet externo)
  var map = loader();

  // Serializar y guardar en caché
  try {
    var obj = {};
    map.forEach(function(v, k) { obj[k] = v; });
    cache.put(key, JSON.stringify(obj), CACHE_TTL_SECONDS);
  } catch (e) {
    Logger.log('Error guardando caché "' + key + '": ' + e);
  }

  return map;
}

// ──────────────────────────────────────────────────────────────
// HELPER DE FORMATO DE FECHA (GAS)
// ──────────────────────────────────────────────────────────────

/**
 * Formatea una celda de fecha de Sheets a "YYYY-MM-DD".
 * @param {*} v  Valor crudo de la celda (Date o string).
 * @return {string}
 * @private
 */
function formatFechaGs_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' +
           String(v.getMonth() + 1).padStart(2, '0') + '-' +
           String(v.getDate()).padStart(2, '0');
  }
  return String(v).substring(0, 10);
}
