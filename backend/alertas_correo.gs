/**
 * alertas_correo.gs — Sistema de alertas automáticas por correo
 * ──────────────────────────────────────────────────────────────
 * Cómo usar:
 *  1. Copia este archivo en el editor de Google Apps Script del proyecto.
 *  2. Ajusta ALERT_CONFIG: destinatarios, nivel mínimo, etc.
 *  3. Ejecuta testEnviarAlertas() para probar el envío.
 *  4. Ejecuta configurarTriggerDiario() para activar el envío automático diario.
 *
 * Requiere:
 *  - Hoja "Reporte_Vencimientos" con columnas:
 *    Código | Suministro | Grupo | Lote | Fecha VTO | Días a VTO | Cantidad | Valor en Riesgo | Estado
 *  - Hoja "Reporte_Abastecimiento" con columnas:
 *    Código | Suministro | Grupo | Estado | Cobertura (meses) | Demanda Mensual | Inv. Proyectado
 */

// ──────────────────────────────────────────────────────────────
// CONFIGURACIÓN — ajustar antes de activar el trigger
// ──────────────────────────────────────────────────────────────
var ALERT_CONFIG = {
  RECIPIENTS: ['correo1@css.gob.pa', 'correo2@css.gob.pa'],
  // Nivel mínimo para disparar el envío: 'VENCIDO' | 'CRITICO' | 'RIESGO' | 'ALERTA'
  MIN_LEVEL_TO_SEND: 'RIESGO',
  // Incluir alertas de nivel BAJO/ALERTA en el resumen
  INCLUDE_BAJO_IN_SUMMARY: true,
  // Enlace al dashboard (reemplazar con la URL real)
  DASHBOARD_URL: 'https://torrdecontrolcss.github.io/Curvas_de_Inventario/',
  // Nombre que aparece en el asunto del correo
  SYSTEM_NAME: 'Torre de Control CSS — Inventario',

  // ── Umbrales de vencimiento (en días) ─────────────────────
  DIAS_CRITICO : 0,   // FMD pasada o días = 0  → CRÍTICO
  DIAS_RIESGO  : 30,  // FMD en los próximos N días → RIESGO
  DIAS_ALERTA  : 90,  // FMD en los próximos N días → ALERTA (si INCLUDE_BAJO_IN_SUMMARY)

  // ── Umbrales de abastecimiento (en meses de cobertura) ────
  MESES_CRITICO: 1,   // Cobertura < N meses → CRÍTICO
  MESES_BAJO   : 4    // Cobertura < N meses → BAJO (si INCLUDE_BAJO_IN_SUMMARY)
};

// Orden de prioridad (mayor índice = mayor prioridad)
var NIVELES_PRIORIDAD = { ALERTA: 1, BAJO: 1, RIESGO: 2, CRITICO: 3, AGOTADO: 4, VENCIDO: 4 };

// Índices de columnas (base 0) — ajustar si cambia la estructura de las hojas
var COL_VENC = {
  CODIGO: 0, SUMINISTRO: 1, GRUPO: 2, LOTE: 3,
  FECHA_VTO: 4, DIAS_VTO: 5, CANTIDAD: 6, VALOR: 7, ESTADO: 8
};
var COL_ABAST = {
  CODIGO: 0, SUMINISTRO: 1, GRUPO: 2, ESTADO: 3,
  COBERTURA: 4, DEMANDA: 5, INV_PROY: 6
};

// ──────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — configurar como trigger diario
// ──────────────────────────────────────────────────────────────

/**
 * Envía el correo consolidado de alertas.
 * Llamar directamente o vía trigger diario.
 */
function enviarAlertasAutomaticas() {
  var summary = getAlertSummary_();

  if (!summary.hayAlertas) {
    Logger.log('Sin alertas que superen el nivel mínimo configurado. No se envía correo.');
    return;
  }

  var asunto = buildAsunto_(summary);
  var cuerpo  = buildHtml_(summary);

  ALERT_CONFIG.RECIPIENTS.forEach(function(dest) {
    MailApp.sendEmail({ to: dest, subject: asunto, htmlBody: cuerpo });
  });

  Logger.log('Correo de alertas enviado a: ' + ALERT_CONFIG.RECIPIENTS.join(', '));
}

// ──────────────────────────────────────────────────────────────
// FUNCIÓN AUXILIAR — construye resumen sin enviar (para testing)
// ──────────────────────────────────────────────────────────────

/**
 * Lee las hojas de reporte y devuelve un objeto con todas las alertas agrupadas.
 * @return {Object} summary con arrays de alertas por categoría y nivel máximo.
 */
function getAlertSummary_() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoy  = new Date();

  // ── Leer Reporte_Vencimientos ──────────────────────────────
  var vencSheet  = ss.getSheetByName('Reporte_Vencimientos');
  var vencRows   = vencSheet ? vencSheet.getDataRange().getValues() : [];
  var vencHeader = vencRows.length > 0 ? vencRows[0] : [];
  var vencData   = vencRows.slice(1);

  var alertasVenc = [];
  vencData.forEach(function(row) {
    var estado = String(row[COL_VENC.ESTADO] || '').toUpperCase().trim();
    var nivel  = mapEstadoVencimiento_(estado, Number(row[COL_VENC.DIAS_VTO]));
    if (!nivel) return;
    alertasVenc.push({
      codigo    : row[COL_VENC.CODIGO],
      suministro: row[COL_VENC.SUMINISTRO],
      grupo     : row[COL_VENC.GRUPO],
      lote      : row[COL_VENC.LOTE],
      fechaVto  : formatFecha_(row[COL_VENC.FECHA_VTO]),
      diasVto   : row[COL_VENC.DIAS_VTO],
      cantidad  : row[COL_VENC.CANTIDAD],
      valor     : row[COL_VENC.VALOR],
      nivel     : nivel
    });
  });

  // ── Leer Reporte_Abastecimiento ────────────────────────────
  var abastSheet  = ss.getSheetByName('Reporte_Abastecimiento');
  var abastRows   = abastSheet ? abastSheet.getDataRange().getValues() : [];
  var abastData   = abastRows.slice(1);

  var alertasAbast = [];
  abastData.forEach(function(row) {
    var estado    = String(row[COL_ABAST.ESTADO] || '').toUpperCase().trim();
    var cobertura = Number(row[COL_ABAST.COBERTURA]);
    var nivel     = mapEstadoAbastecimiento_(estado, cobertura);
    if (!nivel) return;
    alertasAbast.push({
      codigo    : row[COL_ABAST.CODIGO],
      suministro: row[COL_ABAST.SUMINISTRO],
      grupo     : row[COL_ABAST.GRUPO],
      estado    : estado,
      cobertura : cobertura,
      demanda   : row[COL_ABAST.DEMANDA],
      invProy   : row[COL_ABAST.INV_PROY],
      nivel     : nivel
    });
  });

  // ── Calcular nivel máximo global ───────────────────────────
  var nivelMax = 0;
  var nombreNivelMax = '';
  alertasVenc.concat(alertasAbast).forEach(function(a) {
    var p = NIVELES_PRIORIDAD[a.nivel] || 0;
    if (p > nivelMax) { nivelMax = p; nombreNivelMax = a.nivel; }
  });

  // ── Filtrar según nivel mínimo configurado ─────────────────
  var minP = NIVELES_PRIORIDAD[ALERT_CONFIG.MIN_LEVEL_TO_SEND] || 2;
  var hayAlertas = nivelMax >= minP;

  return {
    hayAlertas    : hayAlertas,
    nivelMax      : nombreNivelMax,
    fechaCorte    : hoy,
    vencimientos  : alertasVenc,
    abastecimiento: alertasAbast
  };
}

// ──────────────────────────────────────────────────────────────
// FUNCIONES DE MAPEO DE ESTADO → NIVEL
// ──────────────────────────────────────────────────────────────

function mapEstadoVencimiento_(estado, diasVto) {
  // Estado explícito en la hoja tiene prioridad
  if (estado === 'VENCIDO')  return 'VENCIDO';
  if (estado === 'CRITICO')  return 'CRITICO';
  if (estado === 'RIESGO')   return 'RIESGO';
  if (estado === 'ALERTA')   return ALERT_CONFIG.INCLUDE_BAJO_IN_SUMMARY ? 'ALERTA' : null;

  // Derivar por días si la hoja no tiene columna Estado
  var dias = Number(diasVto);
  if (isNaN(dias)) return null;
  if (dias < 0)                                              return 'VENCIDO';
  if (dias <= ALERT_CONFIG.DIAS_CRITICO)                     return 'CRITICO';
  if (dias <= ALERT_CONFIG.DIAS_RIESGO)                      return 'RIESGO';
  if (dias <= ALERT_CONFIG.DIAS_ALERTA && ALERT_CONFIG.INCLUDE_BAJO_IN_SUMMARY) return 'ALERTA';
  return null;
}

function mapEstadoAbastecimiento_(estado, cobertura) {
  if (estado === 'AGOTADO')  return 'AGOTADO';
  if (estado === 'CRITICO')  return 'CRITICO';
  if (estado === 'BAJO')     return ALERT_CONFIG.INCLUDE_BAJO_IN_SUMMARY ? 'BAJO' : null;

  // Derivar por cobertura si la hoja no tiene columna Estado
  if (isNaN(cobertura)) return null;
  if (cobertura <= 0)                                              return 'AGOTADO';
  if (cobertura < ALERT_CONFIG.MESES_CRITICO)                      return 'CRITICO';
  if (cobertura < ALERT_CONFIG.MESES_BAJO && ALERT_CONFIG.INCLUDE_BAJO_IN_SUMMARY) return 'BAJO';
  return null;
}

// ──────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL CORREO HTML
// ──────────────────────────────────────────────────────────────

function buildAsunto_(summary) {
  var emoji = iconNivel_(summary.nivelMax);
  var totalVenc  = summary.vencimientos.length;
  var totalAbast = summary.abastecimiento.length;
  return emoji + ' [' + ALERT_CONFIG.SYSTEM_NAME + '] Alertas de inventario — ' +
         totalVenc + ' vencimiento(s) · ' + totalAbast + ' desabastecimiento(s)';
}

function buildHtml_(summary) {
  var css = [
    '<style>',
    'body{font-family:Arial,sans-serif;font-size:13px;color:#222;}',
    'h2{margin:0 0 4px;} h3{margin:12px 0 4px;}',
    'table{border-collapse:collapse;width:100%;margin-bottom:16px;}',
    'th{background:#2c3e50;color:#fff;padding:6px 10px;text-align:left;font-size:12px;}',
    'td{padding:5px 10px;border-bottom:1px solid #e0e0e0;font-size:12px;}',
    'tr:hover td{background:#f5f5f5;}',
    '.nivel-vencido{background:#ffd5d5;} .nivel-critico{background:#ffe0b2;}',
    '.nivel-riesgo{background:#fff9c4;}  .nivel-alerta{background:#e8f5e9;}',
    '.nivel-agotado{background:#ffd5d5;} .nivel-bajo{background:#fff9c4;}',
    '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;}',
    '.badge-vencido{background:#c62828;color:#fff;} .badge-agotado{background:#c62828;color:#fff;}',
    '.badge-critico{background:#e65100;color:#fff;}',
    '.badge-riesgo{background:#f9a825;color:#222;}  .badge-alerta{background:#558b2f;color:#fff;}',
    '.badge-bajo{background:#f9a825;color:#222;}',
    '.footer{margin-top:20px;font-size:11px;color:#888;border-top:1px solid #e0e0e0;padding-top:10px;}',
    '</style>'
  ].join('\n');

  var html = '<!DOCTYPE html><html><head>' + css + '</head><body>';
  html += '<h2>📦 Alertas de Inventario</h2>';
  html += '<p>Fecha de corte: <strong>' + formatFecha_(summary.fechaCorte) + '</strong></p>';

  // ── Sección Vencimientos ────────────────────────────────────
  if (summary.vencimientos.length > 0) {
    html += '<h3>🗓️ Vencimientos (' + summary.vencimientos.length + ')</h3>';
    html += '<table><thead><tr>' +
            '<th>Nivel</th><th>Código</th><th>Suministro</th><th>Grupo</th>' +
            '<th>Lote</th><th>Fecha VTO</th><th>Días a VTO</th>' +
            '<th>Cantidad</th><th>Valor en Riesgo</th>' +
            '</tr></thead><tbody>';

    // Ordenar por prioridad descendente, luego por días ascendente
    summary.vencimientos.sort(function(a, b) {
      var pd = (NIVELES_PRIORIDAD[b.nivel] || 0) - (NIVELES_PRIORIDAD[a.nivel] || 0);
      return pd !== 0 ? pd : Number(a.diasVto) - Number(b.diasVto);
    }).forEach(function(r) {
      var nivelKey = r.nivel.toLowerCase();
      html += '<tr class="nivel-' + nivelKey + '">' +
              '<td><span class="badge badge-' + nivelKey + '">' + iconNivel_(r.nivel) + ' ' + r.nivel + '</span></td>' +
              '<td>' + esc_(r.codigo)     + '</td>' +
              '<td>' + esc_(r.suministro) + '</td>' +
              '<td>' + esc_(r.grupo)      + '</td>' +
              '<td>' + esc_(r.lote)       + '</td>' +
              '<td>' + esc_(r.fechaVto)   + '</td>' +
              '<td style="text-align:right">' + r.diasVto + '</td>' +
              '<td style="text-align:right">' + fmtNum_(r.cantidad) + '</td>' +
              '<td style="text-align:right">' + fmtMoneda_(r.valor) + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Sección Desabastecimiento ────────────────────────────────
  if (summary.abastecimiento.length > 0) {
    html += '<h3>⚠️ Desabastecimiento (' + summary.abastecimiento.length + ')</h3>';
    html += '<table><thead><tr>' +
            '<th>Nivel</th><th>Código</th><th>Suministro</th><th>Grupo</th>' +
            '<th>Cobertura (meses)</th><th>Demanda Mensual</th><th>Inv. Proyectado</th>' +
            '</tr></thead><tbody>';

    summary.abastecimiento.sort(function(a, b) {
      var pd = (NIVELES_PRIORIDAD[b.nivel] || 0) - (NIVELES_PRIORIDAD[a.nivel] || 0);
      return pd !== 0 ? pd : Number(a.cobertura) - Number(b.cobertura);
    }).forEach(function(r) {
      var nivelKey = r.nivel.toLowerCase();
      html += '<tr class="nivel-' + nivelKey + '">' +
              '<td><span class="badge badge-' + nivelKey + '">' + iconNivel_(r.nivel) + ' ' + r.nivel + '</span></td>' +
              '<td>' + esc_(r.codigo)     + '</td>' +
              '<td>' + esc_(r.suministro) + '</td>' +
              '<td>' + esc_(r.grupo)      + '</td>' +
              '<td style="text-align:right">' + fmtDecimal_(r.cobertura) + '</td>' +
              '<td style="text-align:right">' + fmtNum_(r.demanda)   + '</td>' +
              '<td style="text-align:right">' + fmtNum_(r.invProy)   + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Footer ─────────────────────────────────────────────────
  html += '<div class="footer">' +
          'Generado automáticamente por <strong>' + ALERT_CONFIG.SYSTEM_NAME + '</strong>. ' +
          '<a href="' + ALERT_CONFIG.DASHBOARD_URL + '">Abrir dashboard</a>' +
          '</div>';

  html += '</body></html>';
  return html;
}

// ──────────────────────────────────────────────────────────────
// GESTIÓN DE TRIGGERS
// ──────────────────────────────────────────────────────────────

/**
 * Instala un trigger diario a las 07:00 para enviarAlertasAutomaticas().
 * Ejecutar UNA SOLA VEZ desde el editor de Apps Script.
 */
function configurarTriggerDiario() {
  // Evitar duplicados
  eliminarTriggerAlertas();
  ScriptApp.newTrigger('enviarAlertasAutomaticas')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log('Trigger diario configurado para las 07:00.');
}

/**
 * Elimina todos los triggers de enviarAlertasAutomaticas().
 */
function eliminarTriggerAlertas() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'enviarAlertasAutomaticas') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('Triggers de alertas eliminados.');
}

// ──────────────────────────────────────────────────────────────
// FUNCIONES DE PRUEBA
// ──────────────────────────────────────────────────────────────

/**
 * Prueba el sistema: imprime el resumen en el log y envía correo de prueba
 * al primer destinatario de ALERT_CONFIG.RECIPIENTS.
 * Ejecutar manualmente desde el editor antes de activar el trigger.
 */
function testEnviarAlertas() {
  var summary = getAlertSummary_();
  Logger.log('=== RESUMEN DE ALERTAS ===');
  Logger.log('Nivel máximo detectado : ' + summary.nivelMax);
  Logger.log('Vencimientos           : ' + summary.vencimientos.length);
  Logger.log('Desabastecimiento      : ' + summary.abastecimiento.length);
  Logger.log('¿Se enviaría correo?   : ' + summary.hayAlertas);

  if (!summary.hayAlertas) {
    Logger.log('No hay alertas que superen el nivel mínimo (' + ALERT_CONFIG.MIN_LEVEL_TO_SEND + ').');
    return;
  }

  var dest = ALERT_CONFIG.RECIPIENTS[0];
  MailApp.sendEmail({
    to: dest,
    subject: '[TEST] ' + buildAsunto_(summary),
    htmlBody: buildHtml_(summary)
  });
  Logger.log('Correo de prueba enviado a: ' + dest);
}

// ──────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ──────────────────────────────────────────────────────────────

function iconNivel_(nivel) {
  var icons = { VENCIDO: '🔴', AGOTADO: '🔴', CRITICO: '🟠', RIESGO: '🟡', ALERTA: '🟢', BAJO: '🟡' };
  return icons[nivel] || '⚪';
}

function esc_(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatFecha_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    var d = v;
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  return String(v);
}

function fmtNum_(v) {
  var n = Number(v);
  if (isNaN(n)) return String(v || '');
  return n.toLocaleString('es-PA');
}

function fmtDecimal_(v) {
  var n = Number(v);
  if (isNaN(n)) return String(v || '');
  return n.toFixed(2);
}

function fmtMoneda_(v) {
  var n = Number(v);
  if (isNaN(n)) return String(v || '');
  return 'B/. ' + n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
