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
  RECIPIENTS      : ['correo1@css.gob.pa', 'correo2@css.gob.pa'],
  MIN_LEVEL_TO_SEND: 'RIESGO',   // 'VENCIDO' | 'CRITICO' | 'RIESGO'
  DASHBOARD_URL   : 'https://torredecontrolcss.github.io/Curvas_de_Inventario/',
  SYSTEM_NAME     : 'Torre de Control de Operaciones Logísticas — CEDIS Panamá CSS',
  MAX_ROWS_CRITICO: 10,   // top 10 críticos en tabla de vencimientos
  MAX_ROWS_AGOTADO: 20    // top 20 agotados en tabla de abastecimiento
};

// Orden de prioridad (mayor índice = mayor prioridad)
var NIVELES_PRIORIDAD = { RIESGO: 2, CRITICO: 3, AGOTADO: 4, VENCIDO: 4 };

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

// STATUS a incluir — ALERTA y OK excluidos en vencimientos; BAJO, OPTIMO, EXCESO excluidos en abastecimiento
var STATUS_VENC_ALERTAR  = { VENCIDO: true, CRITICO: true, RIESGO: true };
var STATUS_ABAST_ALERTAR = { AGOTADO: true, CRITICO: true };

// ──────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — configurar como trigger diario
// ──────────────────────────────────────────────────────────────

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

function getAlertSummary_() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // ── Leer Reporte_Vencimientos ──────────────────────────────
  var vencSheet = ss.getSheetByName('Reporte_Vencimientos');
  var vencRows  = vencSheet ? vencSheet.getDataRange().getValues() : [];
  var vencData  = vencRows.slice(1);
  var fechaCorteVenc = (vencData.length > 0) ? vencData[0][COL_VENC.FECHA_CORTE] : '';

  var alertasVenc = [];
  // Contadores: cantidad de SKUs y totales monetarios por nivel
  var contVenc = {
    VENCIDO : { count: 0, cantidad: 0, valor: 0 },
    CRITICO : { count: 0, cantidad: 0, valor: 0 },
    RIESGO  : { count: 0, cantidad: 0, valor: 0 }
  };

  vencData.forEach(function(row) {
    var status = String(row[COL_VENC.STATUS] || '').toUpperCase().trim();
    if (!STATUS_VENC_ALERTAR[status]) return;
    var cantidad = Number(row[COL_VENC.CANTIDAD])     || 0;
    var valor    = Number(row[COL_VENC.VALOR_RIESGO]) || 0;
    contVenc[status].count++;
    contVenc[status].cantidad += cantidad;
    contVenc[status].valor    += valor;
    alertasVenc.push({
      codigo      : row[COL_VENC.CODIGO],
      suministro  : row[COL_VENC.SUMINISTRO],
      grupo       : row[COL_VENC.GRUPO],
      lote        : row[COL_VENC.LOTE],
      fechaVto    : formatFecha_(row[COL_VENC.FECHA_VTO]),
      diasVto     : row[COL_VENC.DIAS_VTO],
      cantidad    : cantidad,
      valorRiesgo : valor,
      nivel       : status
    });
  });

  // ── Leer Reporte_Abastecimiento ────────────────────────────
  var abastSheet = ss.getSheetByName('Reporte_Abastecimiento');
  var abastRows  = abastSheet ? abastSheet.getDataRange().getValues() : [];
  var abastData  = abastRows.slice(1);
  var fechaCorteAbast = (abastData.length > 0) ? abastData[0][COL_ABAST.FECHA_CORTE] : '';

  var alertasAbast = [];
  var contAbast = {
    AGOTADO : { count: 0, demanda: 0 },
    CRITICO : { count: 0, demanda: 0 }
  };

  abastData.forEach(function(row) {
    var status  = String(row[COL_ABAST.STATUS] || '').toUpperCase().trim();
    if (!STATUS_ABAST_ALERTAR[status]) return;
    var demanda = Number(row[COL_ABAST.DEMANDA_MENSUAL]) || 0;
    contAbast[status].count++;
    contAbast[status].demanda += demanda;
    alertasAbast.push({
      codigo     : row[COL_ABAST.CODIGO],
      suministro : row[COL_ABAST.SUMINISTRO],
      grupo      : row[COL_ABAST.GRUPO],
      invProy    : row[COL_ABAST.INV_PROY],
      mesesCob   : row[COL_ABAST.MESES_COB],
      demanda    : demanda,
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

  var minP = NIVELES_PRIORIDAD[ALERT_CONFIG.MIN_LEVEL_TO_SEND] || 2;
  var hayAlertas = nivelMax >= minP;

  return {
    hayAlertas     : hayAlertas,
    nivelMax       : nombreNivelMax,
    fechaCorteVenc : fechaCorteVenc,
    fechaCorteAbast: fechaCorteAbast,
    vencimientos   : alertasVenc,
    abastecimiento : alertasAbast,
    contVenc       : contVenc,
    contAbast      : contAbast
  };
}

// ──────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL CORREO
// ──────────────────────────────────────────────────────────────

function buildAsunto_(summary) {
  var emoji      = iconNivel_(summary.nivelMax);
  // Contar solo SKUs críticos reales (VENCIDO+CRITICO+RIESGO / AGOTADO+CRITICO)
  var totalVenc  = summary.contVenc.VENCIDO.count + summary.contVenc.CRITICO.count + summary.contVenc.RIESGO.count;
  var totalAbast = summary.contAbast.AGOTADO.count + summary.contAbast.CRITICO.count;
  return emoji + ' [SALMI CEDIS Panamá] ' + totalVenc + ' SKUs en riesgo de vencimiento · ' + totalAbast + ' SKUs desabastecidos';
}

function buildHtml_(summary) {
  var BADGE_BG  = { VENCIDO:'#c62828', AGOTADO:'#c62828', CRITICO:'#e65100', RIESGO:'#f9a825' };
  var BADGE_TXT = { VENCIDO:'#fff',    AGOTADO:'#fff',    CRITICO:'#fff',    RIESGO:'#222'    };
  var ROW_BG    = { VENCIDO:'#ffd5d5', AGOTADO:'#ffd5d5', CRITICO:'#ffe0b2', RIESGO:'#fff9c4' };

  var TH = 'style="background:#2c3e50;color:#fff;padding:6px 10px;text-align:left;white-space:nowrap;"';
  var TH_R = 'style="background:#2c3e50;color:#fff;padding:6px 10px;text-align:right;white-space:nowrap;"';
  var TD  = 'style="padding:5px 10px;border-bottom:1px solid #e0e0e0;vertical-align:top;"';
  var TD_R = 'style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;vertical-align:top;"';

  function badge(nivel) {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;' +
           'background:' + (BADGE_BG[nivel]||'#888') + ';color:' + (BADGE_TXT[nivel]||'#fff') + ';">' +
           iconNivel_(nivel) + ' ' + nivel + '</span>';
  }

  function counterSpan(nivel, count) {
    return '<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:bold;' +
           'background:' + (BADGE_BG[nivel]||'#888') + ';color:' + (BADGE_TXT[nivel]||'#fff') + ';">' +
           iconNivel_(nivel) + ' ' + nivel + ': ' + count + '</span>';
  }

  var fc = formatFecha_(summary.fechaCorteVenc || summary.fechaCorteAbast);
  var html = '<div style="font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:16px;">';

  // ── Header ────────────────────────────────────────────────
  html += '<h2 style="margin:0 0 4px;font-size:18px;">📦 Vigilancia — Inventario SALMI · CEDIS Panamá CSS</h2>';
  html += '<p style="margin:0 0 12px;font-size:12px;color:#555;">Resumen ejecutivo de alertas críticas basado en lotes activos al corte en el sistema SALMI.</p>';
  if (fc) {
    html += '<p style="margin:0 0 16px;">Fecha de corte: <strong>' + esc_(fc) + '</strong></p>';
  }

  // ── Resumen ejecutivo ─────────────────────────────────────
  html += '<h3 style="margin:0 0 8px;font-size:15px;">📊 Resumen ejecutivo</h3>';

  // Vencimientos counters + totales
  html += '<p style="margin:4px 0 6px;"><strong>Vencimientos:</strong></p>';
  ['VENCIDO','CRITICO','RIESGO'].forEach(function(n) {
    var c = summary.contVenc[n];
    if (!c || c.count === 0) return;
    html += counterSpan(n, c.count);
  });
  html += '<br>';

  // Tabla de totales por nivel — vencimientos
  var filasTotVenc = ['VENCIDO','CRITICO','RIESGO'].filter(function(n){ return summary.contVenc[n].count > 0; });
  if (filasTotVenc.length > 0) {
    html += '<table style="border-collapse:collapse;margin:8px 0 16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH + '>Nivel</th>' +
            '<th ' + TH_R + '>SKUs</th>' +
            '<th ' + TH_R + '>Cantidad total</th>' +
            '<th ' + TH_R + '>Valor en Riesgo</th>' +
            '</tr></thead><tbody>';
    filasTotVenc.forEach(function(n) {
      var c  = summary.contVenc[n];
      var bg = ROW_BG[n] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td ' + TD  + '>' + badge(n) + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(c.count)    + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(c.cantidad)  + '</td>' +
              '<td ' + TD_R + '>' + fmtMoneda_(c.valor)  + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // Abastecimiento counters + totales
  html += '<p style="margin:4px 0 6px;"><strong>Abastecimiento:</strong></p>';
  ['AGOTADO','CRITICO'].forEach(function(n) {
    var c = summary.contAbast[n];
    if (!c || c.count === 0) return;
    html += counterSpan(n, c.count);
  });
  html += '<br>';

  var filasTotAbast = ['AGOTADO','CRITICO'].filter(function(n){ return summary.contAbast[n].count > 0; });
  if (filasTotAbast.length > 0) {
    html += '<table style="border-collapse:collapse;margin:8px 0 16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH + '>Nivel</th>' +
            '<th ' + TH_R + '>SKUs</th>' +
            '<th ' + TH_R + '>Demanda Mensual total</th>' +
            '</tr></thead><tbody>';
    filasTotAbast.forEach(function(n) {
      var c  = summary.contAbast[n];
      var bg = ROW_BG[n] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td ' + TD   + '>' + badge(n) + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(c.count)   + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(c.demanda)  + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Top 10 CRITICO — Vencimientos ─────────────────────────
  var topCritico = summary.vencimientos
    .filter(function(r) { return r.nivel === 'CRITICO'; })
    .sort(function(a, b) { return Number(b.valorRiesgo) - Number(a.valorRiesgo); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_CRITICO);

  if (topCritico.length > 0) {
    html += '<h3 style="margin:16px 0 6px;font-size:15px;">🔴 Top ' + topCritico.length + ' Críticos — Vencimientos (por Valor en Riesgo)</h3>';
    html += '<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH   + '>Nivel</th>' +
            '<th ' + TH   + '>Código</th>' +
            '<th ' + TH   + '>Suministro</th>' +
            '<th ' + TH   + '>Grupo</th>' +
            '<th ' + TH   + '>Lote</th>' +
            '<th ' + TH   + '>Fecha VTO</th>' +
            '<th ' + TH_R + '>Días a VTO</th>' +
            '<th ' + TH_R + '>Cantidad</th>' +
            '<th ' + TH_R + '>Valor en Riesgo</th>' +
            '</tr></thead><tbody>';
    topCritico.forEach(function(r) {
      var bg = ROW_BG[r.nivel] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td ' + TD   + '>' + badge(r.nivel)         + '</td>' +
              '<td ' + TD   + '>' + esc_(r.codigo)         + '</td>' +
              '<td ' + TD   + '>' + esc_(r.suministro)     + '</td>' +
              '<td ' + TD   + '>' + esc_(r.grupo)          + '</td>' +
              '<td ' + TD   + '>' + esc_(r.lote)           + '</td>' +
              '<td ' + TD   + '>' + esc_(r.fechaVto)       + '</td>' +
              '<td ' + TD_R + '>' + esc_(String(r.diasVto))+ '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.cantidad)    + '</td>' +
              '<td ' + TD_R + '>' + fmtMoneda_(r.valorRiesgo) + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Top 20 AGOTADO — Abastecimiento ───────────────────────
  var topAgotado = summary.abastecimiento
    .filter(function(r) { return r.nivel === 'AGOTADO'; })
    .sort(function(a, b) { return Number(b.demanda) - Number(a.demanda); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_AGOTADO);

  if (topAgotado.length > 0) {
    html += '<h3 style="margin:16px 0 6px;font-size:15px;">🔴 Top ' + topAgotado.length + ' Agotados — Abastecimiento (por Demanda Mensual)</h3>';
    html += '<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH   + '>Nivel</th>' +
            '<th ' + TH   + '>Código</th>' +
            '<th ' + TH   + '>Suministro</th>' +
            '<th ' + TH   + '>Grupo</th>' +
            '<th ' + TH_R + '>Meses Cob.</th>' +
            '<th ' + TH_R + '>Inv. Proyectado</th>' +
            '<th ' + TH_R + '>Demanda Mensual</th>' +
            '</tr></thead><tbody>';
    topAgotado.forEach(function(r) {
      var bg = ROW_BG[r.nivel] || '#fff';
      html += '<tr style="background:' + bg + ';">' +
              '<td ' + TD   + '>' + badge(r.nivel)          + '</td>' +
              '<td ' + TD   + '>' + esc_(r.codigo)          + '</td>' +
              '<td ' + TD   + '>' + esc_(r.suministro)      + '</td>' +
              '<td ' + TD   + '>' + esc_(r.grupo)           + '</td>' +
              '<td ' + TD_R + '>' + fmtDecimal_(r.mesesCob) + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.invProy)      + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.demanda)      + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Footer ─────────────────────────────────────────────────
  html += '<div style="margin-top:20px;font-size:11px;color:#888;border-top:1px solid #e0e0e0;padding-top:10px;">' +
          'Generado por el sistema automatizado de vigilancia de inventario, en base a los lotes activos al corte registrado en el sistema SALMI' +
          (fc ? ' (corte: ' + esc_(fc) + ')' : '') + '. ' +
          'Gestionado por la Torre de Control de Operaciones Logísticas — CEDIS Panamá CSS. ' +
          '<a href="' + esc_(ALERT_CONFIG.DASHBOARD_URL) + '" style="color:#1a73e8;">Ver Dashboard</a>' +
          '</div>';

  html += '</div>';
  return html;
}

// ──────────────────────────────────────────────────────────────
// GESTIÓN DE TRIGGERS
// ──────────────────────────────────────────────────────────────

function configurarTriggerDiario() {
  eliminarTriggerAlertas();
  ScriptApp.newTrigger('enviarAlertasAutomaticas')
    .timeBased().everyDays(1).atHour(7).create();
  Logger.log('Trigger diario configurado para las 07:00.');
}

function eliminarTriggerAlertas() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'enviarAlertasAutomaticas') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Triggers de alertas eliminados.');
}

// ──────────────────────────────────────────────────────────────
// FUNCIONES DE PRUEBA
// ──────────────────────────────────────────────────────────────

function testEnviarAlertas() {
  var summary = getAlertSummary_();
  Logger.log('=== RESUMEN DE ALERTAS ===');
  Logger.log('Nivel máximo    : ' + summary.nivelMax);
  Logger.log('Vencimientos    : ' + summary.vencimientos.length);
  Logger.log('Abastecimiento  : ' + summary.abastecimiento.length);
  Logger.log('¿Enviar correo? : ' + summary.hayAlertas);
  if (!summary.hayAlertas) {
    Logger.log('No hay alertas que superen el nivel mínimo (' + ALERT_CONFIG.MIN_LEVEL_TO_SEND + ').');
    return;
  }
  var dest = ALERT_CONFIG.RECIPIENTS[0];
  MailApp.sendEmail({ to: dest, subject: '[TEST] ' + buildAsunto_(summary), htmlBody: buildHtml_(summary) });
  Logger.log('Correo de prueba enviado a: ' + dest);
}

// ──────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ──────────────────────────────────────────────────────────────

function iconNivel_(nivel) {
  var icons = { VENCIDO:'🔴', AGOTADO:'🔴', CRITICO:'🟠', RIESGO:'🟡' };
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
