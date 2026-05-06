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
 *  - Hoja "Reporte_Vencimientos" con columnas (0-based):
 *    0:FECHA_CORTE | 1:Código | 2:Suministro | 3:Grupo | 4:Tipo | 5:Lote |
 *    6:Fecha_VTO | 7:FMD | 8:Días_a_FMD | 9:Días_a_VTO | 10:Cantidad |
 *    11:Costo_Unit | 12:Valor_Riesgo | 13:STATUS | 14:Demanda_Mensual | 15:Cobertura_Meses
 *  - Hoja "Reporte_Abastecimiento" con columnas (0-based):
 *    0:FECHA_CORTE | 1:CODIGO | 2:SUMINISTRO | 3:GRUPO | 4:INV_ACTUAL |
 *    5:RECEPCION_7D | 6:TRANSITO | 7:RESERVA | 8:INV_PROY | 9:MESES_COB |
 *    10:STATUS | 11:DEMANDA_MENSUAL
 */

// ──────────────────────────────────────────────────────────────
// CONFIGURACIÓN — ajustar antes de activar el trigger
// ──────────────────────────────────────────────────────────────

var SS_ID = '1ca5JUgogB25yAq2hvlLNSobUOMdTMe2oua6iUJ3c_Ew';

var ALERT_CONFIG = {
  RECIPIENTS: ['correo1@css.gob.pa', 'correo2@css.gob.pa'],
  // Nivel mínimo para disparar el envío: 'VENCIDO' | 'CRITICO' | 'RIESGO' | 'ALERTA'
  MIN_LEVEL_TO_SEND: 'RIESGO',
  // Enlace al dashboard
  DASHBOARD_URL: 'https://torrdecontrolcss.github.io/Curvas_de_Inventario/',
  // Nombre que aparece en el asunto del correo
  SYSTEM_NAME: 'Torre de Control CSS — Inventario',
  // Máximo de filas en las tablas del correo
  MAX_ROWS_TABLE: 20
};

// Orden de prioridad (mayor índice = mayor prioridad)
var NIVELES_PRIORIDAD = { ALERTA: 1, BAJO: 1, RIESGO: 2, CRITICO: 3, AGOTADO: 4, VENCIDO: 4 };

// Índices de columnas (base 0) — Reporte_Vencimientos
var COL_VENC = {
  FECHA_CORTE: 0, CODIGO: 1, SUMINISTRO: 2, GRUPO: 3, TIPO: 4, LOTE: 5,
  FECHA_VTO: 6, FMD: 7, DIAS_FMD: 8, DIAS_VTO: 9, CANTIDAD: 10,
  COSTO_UNIT: 11, VALOR_RIESGO: 12, STATUS: 13, DEMANDA_MENSUAL: 14, COBERTURA_MESES: 15
};

// Índices de columnas (base 0) — Reporte_Abastecimiento
var COL_ABAST = {
  FECHA_CORTE: 0, CODIGO: 1, SUMINISTRO: 2, GRUPO: 3, INV_ACTUAL: 4,
  RECEPCION_7D: 5, TRANSITO: 6, RESERVA: 7, INV_PROY: 8, MESES_COB: 9,
  STATUS: 10, DEMANDA_MENSUAL: 11
};

// STATUS a incluir en alertas
var STATUS_VENC_ALERTAR  = { VENCIDO: true, CRITICO: true, RIESGO: true, ALERTA: true };
var STATUS_ABAST_ALERTAR = { AGOTADO: true, CRITICO: true, BAJO: true };

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
  var ss = SpreadsheetApp.openById(SS_ID);

  // ── Leer Reporte_Vencimientos ──────────────────────────────
  var vencSheet = ss.getSheetByName('Reporte_Vencimientos');
  var vencRows  = vencSheet ? vencSheet.getDataRange().getValues() : [];
  var vencData  = vencRows.slice(1);
  var fechaCorteVenc = (vencData.length > 0) ? vencData[0][COL_VENC.FECHA_CORTE] : '';

  var alertasVenc = [];
  var contVenc    = { VENCIDO: 0, CRITICO: 0, RIESGO: 0, ALERTA: 0 };

  vencData.forEach(function(row) {
    var status = String(row[COL_VENC.STATUS] || '').toUpperCase().trim();
    if (!STATUS_VENC_ALERTAR[status]) return;
    if (contVenc[status] !== undefined) contVenc[status]++;
    alertasVenc.push({
      codigo      : row[COL_VENC.CODIGO],
      suministro  : row[COL_VENC.SUMINISTRO],
      grupo       : row[COL_VENC.GRUPO],
      lote        : row[COL_VENC.LOTE],
      fechaVto    : formatFecha_(row[COL_VENC.FECHA_VTO]),
      diasVto     : row[COL_VENC.DIAS_VTO],
      cantidad    : row[COL_VENC.CANTIDAD],
      valorRiesgo : row[COL_VENC.VALOR_RIESGO],
      nivel       : status
    });
  });

  // ── Leer Reporte_Abastecimiento ────────────────────────────
  var abastSheet = ss.getSheetByName('Reporte_Abastecimiento');
  var abastRows  = abastSheet ? abastSheet.getDataRange().getValues() : [];
  var abastData  = abastRows.slice(1);
  var fechaCorteAbast = (abastData.length > 0) ? abastData[0][COL_ABAST.FECHA_CORTE] : '';

  var alertasAbast = [];
  var contAbast    = { AGOTADO: 0, CRITICO: 0, BAJO: 0 };

  abastData.forEach(function(row) {
    var status = String(row[COL_ABAST.STATUS] || '').toUpperCase().trim();
    if (!STATUS_ABAST_ALERTAR[status]) return;
    if (contAbast[status] !== undefined) contAbast[status]++;
    alertasAbast.push({
      codigo     : row[COL_ABAST.CODIGO],
      suministro : row[COL_ABAST.SUMINISTRO],
      grupo      : row[COL_ABAST.GRUPO],
      invProy    : row[COL_ABAST.INV_PROY],
      mesesCob   : row[COL_ABAST.MESES_COB],
      demanda    : row[COL_ABAST.DEMANDA_MENSUAL],
      nivel      : status
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
    fechaCorteVenc: fechaCorteVenc,
    fechaCorteAbast: fechaCorteAbast,
    vencimientos  : alertasVenc,
    abastecimiento: alertasAbast,
    contVenc      : contVenc,
    contAbast     : contAbast
  };
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
  // Estilos inline para compatibilidad con clientes de correo
  var S = {
    body    : 'font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:16px;',
    h2      : 'margin:0 0 8px;font-size:18px;',
    h3      : 'margin:16px 0 6px;font-size:15px;',
    p       : 'margin:4px 0;',
    table   : 'border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;',
    th      : 'background:#2c3e50;color:#fff;padding:6px 10px;text-align:left;white-space:nowrap;',
    td      : 'padding:5px 10px;border-bottom:1px solid #e0e0e0;vertical-align:top;',
    tdR     : 'padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;vertical-align:top;',
    counter : 'display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:bold;',
    footer  : 'margin-top:20px;font-size:11px;color:#888;border-top:1px solid #e0e0e0;padding-top:10px;'
  };
  var BADGE_BG = { VENCIDO:'#c62828', AGOTADO:'#c62828', CRITICO:'#e65100', RIESGO:'#f9a825', ALERTA:'#558b2f', BAJO:'#f9a825' };
  var BADGE_TXT = { VENCIDO:'#fff', AGOTADO:'#fff', CRITICO:'#fff', RIESGO:'#222', ALERTA:'#fff', BAJO:'#222' };
  var ROW_BG   = { VENCIDO:'#ffd5d5', AGOTADO:'#ffd5d5', CRITICO:'#ffe0b2', RIESGO:'#fff9c4', ALERTA:'#e8f5e9', BAJO:'#fff9c4' };

  function badge(nivel) {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;' +
           'background:' + (BADGE_BG[nivel]||'#888') + ';color:' + (BADGE_TXT[nivel]||'#fff') + ';">' +
           iconNivel_(nivel) + ' ' + nivel + '</span>';
  }

  var html = '<div style="' + S.body + '">';
  html += '<h2 style="' + S.h2 + '">📦 ' + esc_(ALERT_CONFIG.SYSTEM_NAME) + ' — Alertas de Inventario</h2>';

  if (summary.fechaCorteVenc || summary.fechaCorteAbast) {
    var fc = summary.fechaCorteVenc || summary.fechaCorteAbast;
    html += '<p style="' + S.p + '">Fecha de corte: <strong>' + esc_(formatFecha_(fc)) + '</strong></p>';
  }

  // ── Resumen por nivel ──────────────────────────────────────
  html += '<h3 style="' + S.h3 + '">📊 Resumen ejecutivo</h3>';

  // Vencimientos counters
  html += '<p style="' + S.p + '"><strong>Vencimientos:</strong></p>';
  var ordVenc = ['VENCIDO','CRITICO','RIESGO','ALERTA'];
  ordVenc.forEach(function(n) {
    var cnt = summary.contVenc[n] || 0;
    if (cnt === 0) return;
    html += '<span style="' + S.counter + 'background:' + (BADGE_BG[n]||'#888') + ';color:' + (BADGE_TXT[n]||'#fff') + ';">' +
            iconNivel_(n) + ' ' + n + ': ' + cnt + '</span>';
  });
  if (!summary.vencimientos.length) {
    html += '<span style="' + S.p + 'color:#666;">Sin alertas de vencimiento.</span>';
  }

  // Abastecimiento counters
  html += '<p style="margin:12px 0 4px;"><strong>Abastecimiento:</strong></p>';
  var ordAbast = ['AGOTADO','CRITICO','BAJO'];
  ordAbast.forEach(function(n) {
    var cnt = summary.contAbast[n] || 0;
    if (cnt === 0) return;
    html += '<span style="' + S.counter + 'background:' + (BADGE_BG[n]||'#888') + ';color:' + (BADGE_TXT[n]||'#fff') + ';">' +
            iconNivel_(n) + ' ' + n + ': ' + cnt + '</span>';
  });
  if (!summary.abastecimiento.length) {
    html += '<span style="' + S.p + 'color:#666;">Sin alertas de abastecimiento.</span>';
  }

  // ── Top alertas críticas — Vencimientos ───────────────────
  var topVenc = summary.vencimientos
    .filter(function(r) { return r.nivel === 'VENCIDO' || r.nivel === 'CRITICO'; })
    .sort(function(a, b) { return Number(b.valorRiesgo) - Number(a.valorRiesgo); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_TABLE);

  if (topVenc.length > 0) {
    html += '<h3 style="' + S.h3 + '">🗓️ Alertas críticas — Vencimientos (top ' + topVenc.length + ' por Valor en Riesgo)</h3>';
    html += '<table style="' + S.table + '"><thead><tr>' +
            '<th style="' + S.th + '">Nivel</th>' +
            '<th style="' + S.th + '">Código</th>' +
            '<th style="' + S.th + '">Suministro</th>' +
            '<th style="' + S.th + '">Grupo</th>' +
            '<th style="' + S.th + '">Lote</th>' +
            '<th style="' + S.th + '">Fecha VTO</th>' +
            '<th style="' + S.th + 'text-align:right;">Días a VTO</th>' +
            '<th style="' + S.th + 'text-align:right;">Cantidad</th>' +
            '<th style="' + S.th + 'text-align:right;">Valor en Riesgo</th>' +
            '</tr></thead><tbody>';
    topVenc.forEach(function(r) {
      var bg = ROW_BG[r.nivel] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td style="' + S.td + '">' + badge(r.nivel) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.codigo) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.suministro) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.grupo) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.lote) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.fechaVto) + '</td>' +
              '<td style="' + S.tdR + '">' + esc_(String(r.diasVto)) + '</td>' +
              '<td style="' + S.tdR + '">' + fmtNum_(r.cantidad) + '</td>' +
              '<td style="' + S.tdR + '">' + fmtMoneda_(r.valorRiesgo) + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Top alertas críticas — Abastecimiento ─────────────────
  var topAbast = summary.abastecimiento
    .filter(function(r) { return r.nivel === 'AGOTADO' || r.nivel === 'CRITICO'; })
    .sort(function(a, b) { return Number(a.mesesCob) - Number(b.mesesCob); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_TABLE);

  if (topAbast.length > 0) {
    html += '<h3 style="' + S.h3 + '">⚠️ Alertas críticas — Abastecimiento (top ' + topAbast.length + ' por cobertura)</h3>';
    html += '<table style="' + S.table + '"><thead><tr>' +
            '<th style="' + S.th + '">Nivel</th>' +
            '<th style="' + S.th + '">Código</th>' +
            '<th style="' + S.th + '">Suministro</th>' +
            '<th style="' + S.th + '">Grupo</th>' +
            '<th style="' + S.th + 'text-align:right;">Meses Cob.</th>' +
            '<th style="' + S.th + 'text-align:right;">Inv. Proyectado</th>' +
            '<th style="' + S.th + 'text-align:right;">Demanda Mensual</th>' +
            '</tr></thead><tbody>';
    topAbast.forEach(function(r) {
      var bg = ROW_BG[r.nivel] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td style="' + S.td + '">' + badge(r.nivel) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.codigo) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.suministro) + '</td>' +
              '<td style="' + S.td + '">' + esc_(r.grupo) + '</td>' +
              '<td style="' + S.tdR + '">' + fmtDecimal_(r.mesesCob) + '</td>' +
              '<td style="' + S.tdR + '">' + fmtNum_(r.invProy) + '</td>' +
              '<td style="' + S.tdR + '">' + fmtNum_(r.demanda) + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Footer ─────────────────────────────────────────────────
  html += '<div style="' + S.footer + '">' +
          'Generado automáticamente por <strong>' + esc_(ALERT_CONFIG.SYSTEM_NAME) + '</strong>. ' +
          '<a href="' + esc_(ALERT_CONFIG.DASHBOARD_URL) + '" style="color:#1a73e8;">Abrir dashboard</a>' +
          '</div>';

  html += '</div>';
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
    return v.getFullYear() + '-' +
           String(v.getMonth() + 1).padStart(2, '0') + '-' +
           String(v.getDate()).padStart(2, '0');
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
