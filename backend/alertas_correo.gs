/**
 * alertas_correo.gs — Algoritmo de Vigilancia Automatizada · Inventario SALMI · CEDIS Panamá CSS
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * Columnas Reporte_Vencimientos (0-based):
 *   0:FECHA_CORTE 1:Código 2:Suministro 3:Grupo 4:Tipo 5:Lote
 *   6:Fecha_VTO 7:FMD 8:Días_a_FMD 9:Días_a_VTO 10:Cantidad
 *   11:Costo_Unit 12:Valor_Riesgo 13:STATUS 14:Demanda_Mensual 15:Cobertura_Meses
 *
 * Columnas Reporte_Abastecimiento (0-based):
 *   0:FECHA_CORTE 1:CODIGO 2:SUMINISTRO 3:GRUPO 4:INV_ACTUAL
 *   5:RECEPCION_7D 6:TRANSITO 7:RESERVA 8:INV_PROY 9:MESES_COB
 *   10:STATUS 11:DEMANDA_MENSUAL
 */

// ──────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ──────────────────────────────────────────────────────────────

var SS_ID = '1ca5JUgogB25yAq2hvlLNSobUOMdTMe2oua6iUJ3c_Ew';

var ALERT_CONFIG = {
  RECIPIENTS       : ['correo1@css.gob.pa', 'correo2@css.gob.pa'],
  MIN_LEVEL_TO_SEND: 'RIESGO',
  DASHBOARD_URL    : 'https://torredecontrolcss.github.io/Curvas_de_Inventario/',
  SYSTEM_NAME      : 'Torre de Control de Operaciones Logísticas — CEDIS Panamá CSS',
  MAX_ROWS_VENCIDOS: 20,   // top 20 VENCIDOS en tabla de detalle
  MAX_ROWS_CRITICO : 10,   // top 10 CRITICOS en tabla de detalle
  MAX_ROWS_AGOTADO : 20    // top 20 AGOTADOS en tabla de detalle
};

var NIVELES_PRIORIDAD = { RIESGO: 2, CRITICO: 3, AGOTADO: 4, VENCIDO: 4 };

var COL_VENC = {
  FECHA_CORTE: 0, CODIGO: 1, SUMINISTRO: 2, GRUPO: 3, TIPO: 4, LOTE: 5,
  FECHA_VTO: 6, FMD: 7, DIAS_FMD: 8, DIAS_VTO: 9, CANTIDAD: 10,
  COSTO_UNIT: 11, VALOR_RIESGO: 12, STATUS: 13, DEMANDA_MENSUAL: 14, COBERTURA_MESES: 15
};

var COL_ABAST = {
  FECHA_CORTE: 0, CODIGO: 1, SUMINISTRO: 2, GRUPO: 3, INV_ACTUAL: 4,
  RECEPCION_7D: 5, TRANSITO: 6, RESERVA: 7, INV_PROY: 8, MESES_COB: 9,
  STATUS: 10, DEMANDA_MENSUAL: 11
};

// STATUS a incluir en alertas
var STATUS_VENC_ALERTAR  = { VENCIDO: true, CRITICO: true, RIESGO: true };
// EXCESO se incluye solo en contadores del resumen (no en tablas de detalle)
var STATUS_ABAST_ALERTAR = { AGOTADO: true, CRITICO: true };

// ──────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────────────────────

function enviarAlertasAutomaticas() {
  var summary = getAlertSummary_();
  if (!summary.hayAlertas) {
    Logger.log('Sin alertas que superen el nivel mínimo. No se envía correo.');
    return;
  }
  var asunto = buildAsunto_(summary);
  var cuerpo = buildHtml_(summary);
  ALERT_CONFIG.RECIPIENTS.forEach(function(dest) {
    MailApp.sendEmail({ to: dest, subject: asunto, htmlBody: cuerpo });
  });
  Logger.log('Correo enviado a: ' + ALERT_CONFIG.RECIPIENTS.join(', '));
}

/**
 * Botón en Google Sheet → asignar esta función a un dibujo/botón en la hoja.
 * Permite enviar el correo directamente desde la hoja sin entrar al editor GAS.
 */
function enviarCorreoDesdeHoja() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    '📧 Enviar Alertas de Inventario',
    '¿Deseas enviar el correo de alertas ahora?\n\nSe enviará a: ' + ALERT_CONFIG.RECIPIENTS.join(', '),
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) {
    ui.alert('Envío cancelado.');
    return;
  }
  var summary = getAlertSummary_();
  if (!summary.hayAlertas) {
    ui.alert('✅ Sin alertas críticas', 'No se encontraron alertas que superen el nivel mínimo configurado (' + ALERT_CONFIG.MIN_LEVEL_TO_SEND + ').', ui.ButtonSet.OK);
    return;
  }
  var asunto = buildAsunto_(summary);
  var cuerpo = buildHtml_(summary);
  ALERT_CONFIG.RECIPIENTS.forEach(function(dest) {
    MailApp.sendEmail({ to: dest, subject: asunto, htmlBody: cuerpo });
  });
  var totalVenc  = summary.contVenc.VENCIDO.count;
  var totalAbast = summary.contAbast.AGOTADO.count;
  ui.alert(
    '✅ Correo enviado',
    'Se envió el correo de alertas:\n• ' + totalVenc + ' SKUs Vencidos\n• ' + totalAbast + ' SKUs Desabastecidos\n\nDestinatarios: ' + ALERT_CONFIG.RECIPIENTS.join(', '),
    ui.ButtonSet.OK
  );
}

// ──────────────────────────────────────────────────────────────
// LECTURA DE DATOS
// ──────────────────────────────────────────────────────────────

function getAlertSummary_() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // ── Reporte_Vencimientos ───────────────────────────────────
  var vencSheet = ss.getSheetByName('Reporte_Vencimientos');
  var vencRows  = vencSheet ? vencSheet.getDataRange().getValues() : [];
  var vencData  = vencRows.slice(1);
  var fechaCorteVenc = (vencData.length > 0) ? vencData[0][COL_VENC.FECHA_CORTE] : '';

  var alertasVenc = [];
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
      codigo     : row[COL_VENC.CODIGO],
      suministro : row[COL_VENC.SUMINISTRO],
      grupo      : row[COL_VENC.GRUPO],
      lote       : row[COL_VENC.LOTE],
      fechaVto   : formatFecha_(row[COL_VENC.FECHA_VTO]),
      diasVto    : row[COL_VENC.DIAS_VTO],
      cantidad   : cantidad,
      valorRiesgo: valor,
      nivel      : status
    });
  });

  // ── Reporte_Abastecimiento ────────────────────────────────
  var abastSheet = ss.getSheetByName('Reporte_Abastecimiento');
  var abastRows  = abastSheet ? abastSheet.getDataRange().getValues() : [];
  var abastData  = abastRows.slice(1);
  var fechaCorteAbast = (abastData.length > 0) ? abastData[0][COL_ABAST.FECHA_CORTE] : '';

  var alertasAbast = [];
  var contAbast = {
    AGOTADO : { count: 0, demanda: 0 },
    CRITICO : { count: 0, demanda: 0 },
    EXCESO  : { count: 0, demanda: 0 }   // incluido en resumen
  };

  abastData.forEach(function(row) {
    var status  = String(row[COL_ABAST.STATUS] || '').toUpperCase().trim();
    var demanda = Number(row[COL_ABAST.DEMANDA_MENSUAL]) || 0;
    // Contador EXCESO solo en resumen
    if (status === 'EXCESO') {
      contAbast.EXCESO.count++;
      contAbast.EXCESO.demanda += demanda;
      return;
    }
    if (!STATUS_ABAST_ALERTAR[status]) return;
    contAbast[status].count++;
    contAbast[status].demanda += demanda;
    alertasAbast.push({
      codigo      : row[COL_ABAST.CODIGO],
      suministro  : row[COL_ABAST.SUMINISTRO],
      grupo       : row[COL_ABAST.GRUPO],
      invActual   : row[COL_ABAST.INV_ACTUAL],
      recepcion7d : row[COL_ABAST.RECEPCION_7D],
      transito    : row[COL_ABAST.TRANSITO],
      invProy     : row[COL_ABAST.INV_PROY],
      mesesCob    : row[COL_ABAST.MESES_COB],
      demanda     : demanda,
      nivel       : status
    });
  });

  // ── Nivel máximo ──────────────────────────────────────────
  var nivelMax = 0, nombreNivelMax = '';
  alertasVenc.concat(alertasAbast).forEach(function(a) {
    var p = NIVELES_PRIORIDAD[a.nivel] || 0;
    if (p > nivelMax) { nivelMax = p; nombreNivelMax = a.nivel; }
  });

  var minP = NIVELES_PRIORIDAD[ALERT_CONFIG.MIN_LEVEL_TO_SEND] || 2;

  return {
    hayAlertas     : nivelMax >= minP,
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

/**
 * CAMBIO 1 — Asunto: "Inventario CEDIS Panamá — X SKUs Vencidos · Y SKUs Desabastecidos"
 * Solo cuenta STATUS=VENCIDO y STATUS=AGOTADO (los que ya expiraron / están en 0).
 */
function buildAsunto_(summary) {
  var vencidos      = summary.contVenc.VENCIDO.count;
  var desabastecidos = summary.contAbast.AGOTADO.count;
  return 'Inventario CEDIS Panamá — ' + vencidos + ' SKUs Vencidos · ' + desabastecidos + ' SKUs Desabastecidos';
}

function buildHtml_(summary) {
  // Estilos inline para compatibilidad con clientes de correo
  var DARK   = '#2c3e50';
  var BG_VEN = { VENCIDO:'#ffd5d5', CRITICO:'#ffe0b2', RIESGO:'#fff9c4' };
  var BG_ABA = { AGOTADO:'#ffd5d5', CRITICO:'#ffe0b2', EXCESO:'#e8f5e9' };
  var BADGE_BG  = { VENCIDO:'#c62828', AGOTADO:'#c62828', CRITICO:'#e65100', RIESGO:'#f9a825', EXCESO:'#2e7d32' };
  var BADGE_TXT = { VENCIDO:'#fff',    AGOTADO:'#fff',    CRITICO:'#fff',    RIESGO:'#222',    EXCESO:'#fff' };

  var TH   = 'style="background:' + DARK + ';color:#fff;padding:6px 10px;text-align:left;white-space:nowrap;font-size:12px;"';
  var TH_R = 'style="background:' + DARK + ';color:#fff;padding:6px 10px;text-align:right;white-space:nowrap;font-size:12px;"';
  var TD   = 'style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-size:12px;vertical-align:top;"';
  var TD_R = 'style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-size:12px;text-align:right;vertical-align:top;"';

  function badge(nivel) {
    return '<span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;' +
           'background:' + (BADGE_BG[nivel]||'#888') + ';color:' + (BADGE_TXT[nivel]||'#fff') + ';">' +
           iconNivel_(nivel) + ' ' + nivel + '</span>';
  }

  var fc = formatFecha_(summary.fechaCorteVenc || summary.fechaCorteAbast);
  var html = '<div style="font-family:Arial,sans-serif;font-size:13px;color:#222;padding:16px;max-width:900px;">';

  // ── CAMBIO 2 — Header ─────────────────────────────────────
  html += '<h2 style="margin:0 0 4px;font-size:18px;color:#1a237e;">🤖 Algoritmo de Vigilancia Automatizada</h2>';
  html += '<h3 style="margin:0 0 4px;font-size:15px;color:#333;">Inventario SALMI — CEDIS Panamá CSS</h3>';
  html += '<p style="margin:0 0 12px;font-size:12px;color:#555;">Resumen ejecutivo basado en lotes activos al corte en el sistema SALMI.</p>';
  if (fc) html += '<p style="margin:0 0 16px;">Fecha de corte: <strong>' + esc_(fc) + '</strong></p>';

  html += '<h3 style="margin:0 0 10px;font-size:15px;">📊 Resumen ejecutivo</h3>';

  // ── CAMBIO 3 — Tabla TRANSPUESTA Vencimientos ─────────────
  // Columnas = niveles, Filas = métricas
  var vNiveles = ['VENCIDO','CRITICO','RIESGO'].filter(function(n){ return summary.contVenc[n].count > 0; });
  if (vNiveles.length > 0) {
    html += '<p style="margin:6px 0 4px;"><strong>Vencimientos:</strong></p>';
    html += '<table style="border-collapse:collapse;margin-bottom:16px;font-size:12px;">';
    // Fila encabezado — una columna por nivel
    html += '<thead><tr>';
    html += '<th ' + TH + '>Métrica</th>';
    vNiveles.forEach(function(n) {
      html += '<th style="background:' + (BADGE_BG[n]||DARK) + ';color:' + (BADGE_TXT[n]||'#fff') + ';padding:6px 14px;text-align:center;white-space:nowrap;font-size:12px;">' +
              iconNivel_(n) + ' ' + n + '</th>';
    });
    html += '</tr></thead><tbody>';
    // Fila SKUs
    html += '<tr><td ' + TD + '><strong>SKUs</strong></td>';
    vNiveles.forEach(function(n){ html += '<td ' + TD_R + '>' + fmtNum_(summary.contVenc[n].count) + '</td>'; });
    html += '</tr>';
    // Fila Cantidad total
    html += '<tr><td ' + TD + '><strong>Cantidad total</strong></td>';
    vNiveles.forEach(function(n){ html += '<td ' + TD_R + '>' + fmtNum_(summary.contVenc[n].cantidad) + '</td>'; });
    html += '</tr>';
    // Fila Valor en Riesgo
    html += '<tr><td ' + TD + '><strong>Valor en Riesgo</strong></td>';
    vNiveles.forEach(function(n){ html += '<td ' + TD_R + '>' + fmtMoneda_(summary.contVenc[n].valor) + '</td>'; });
    html += '</tr>';
    html += '</tbody></table>';
  }

  // ── CAMBIO 3 — Tabla TRANSPUESTA Abastecimiento + CAMBIO 5 EXCESO ──
  // Columnas = niveles (AGOTADO, CRITICO, EXCESO), Filas = métricas
  var aNiveles = ['AGOTADO','CRITICO','EXCESO'].filter(function(n){ return summary.contAbast[n].count > 0; });
  if (aNiveles.length > 0) {
    html += '<p style="margin:6px 0 4px;"><strong>Abastecimiento:</strong></p>';
    html += '<table style="border-collapse:collapse;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>';
    html += '<th ' + TH + '>Métrica</th>';
    aNiveles.forEach(function(n) {
      html += '<th style="background:' + (BADGE_BG[n]||DARK) + ';color:' + (BADGE_TXT[n]||'#fff') + ';padding:6px 14px;text-align:center;white-space:nowrap;font-size:12px;">' +
              iconNivel_(n) + ' ' + n + '</th>';
    });
    html += '</tr></thead><tbody>';
    // Fila SKUs
    html += '<tr><td ' + TD + '><strong>SKUs</strong></td>';
    aNiveles.forEach(function(n){ html += '<td ' + TD_R + '>' + fmtNum_(summary.contAbast[n].count) + '</td>'; });
    html += '</tr>';
    // Fila Demanda Mensual total
    html += '<tr><td ' + TD + '><strong>Demanda Mensual total</strong></td>';
    aNiveles.forEach(function(n){ html += '<td ' + TD_R + '>' + fmtNum_(summary.contAbast[n].demanda) + '</td>'; });
    html += '</tr>';
    html += '</tbody></table>';
  }

  // ── CAMBIO 4 — Top 20 VENCIDOS ───────────────────────────
  var topVencidos = summary.vencimientos
    .filter(function(r){ return r.nivel === 'VENCIDO'; })
    .sort(function(a,b){ return Number(b.valorRiesgo) - Number(a.valorRiesgo); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_VENCIDOS);

  if (topVencidos.length > 0) {
    html += '<h3 style="margin:16px 0 6px;font-size:14px;color:#c62828;">🔴 Top ' + topVencidos.length + ' Vencidos — Mayor Valor en Riesgo</h3>';
    html += '<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH   + '>Código</th>' +
            '<th ' + TH   + '>Suministro</th>' +
            '<th ' + TH   + '>Grupo</th>' +
            '<th ' + TH   + '>Lote</th>' +
            '<th ' + TH   + '>Fecha VTO</th>' +
            '<th ' + TH_R + '>Días a VTO</th>' +
            '<th ' + TH_R + '>Cantidad</th>' +
            '<th ' + TH_R + '>Valor en Riesgo</th>' +
            '</tr></thead><tbody>';
    topVencidos.forEach(function(r) {
      html += '<tr style="background:#ffd5d5;">' +
              '<td ' + TD   + '>' + esc_(r.codigo)           + '</td>' +
              '<td ' + TD   + '>' + esc_(r.suministro)       + '</td>' +
              '<td ' + TD   + '>' + esc_(r.grupo)            + '</td>' +
              '<td ' + TD   + '>' + esc_(r.lote)             + '</td>' +
              '<td ' + TD   + '>' + esc_(r.fechaVto)         + '</td>' +
              '<td ' + TD_R + '>' + esc_(String(r.diasVto))  + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.cantidad)      + '</td>' +
              '<td ' + TD_R + '>' + fmtMoneda_(r.valorRiesgo)+ '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Top 10 CRITICOS — Vencimientos ───────────────────────
  var topCritico = summary.vencimientos
    .filter(function(r){ return r.nivel === 'CRITICO'; })
    .sort(function(a,b){ return Number(b.valorRiesgo) - Number(a.valorRiesgo); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_CRITICO);

  if (topCritico.length > 0) {
    html += '<h3 style="margin:16px 0 6px;font-size:14px;color:#e65100;">🟠 Top ' + topCritico.length + ' Críticos — Vencimientos (mayor Valor en Riesgo)</h3>';
    html += '<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>' +
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
      html += '<tr style="background:#ffe0b2;">' +
              '<td ' + TD   + '>' + esc_(r.codigo)           + '</td>' +
              '<td ' + TD   + '>' + esc_(r.suministro)       + '</td>' +
              '<td ' + TD   + '>' + esc_(r.grupo)            + '</td>' +
              '<td ' + TD   + '>' + esc_(r.lote)             + '</td>' +
              '<td ' + TD   + '>' + esc_(r.fechaVto)         + '</td>' +
              '<td ' + TD_R + '>' + esc_(String(r.diasVto))  + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.cantidad)      + '</td>' +
              '<td ' + TD_R + '>' + fmtMoneda_(r.valorRiesgo)+ '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── CAMBIO 6 — Top 20 AGOTADOS con Tránsito y Recepción ──
  var topAgotado = summary.abastecimiento
    .filter(function(r){ return r.nivel === 'AGOTADO'; })
    .sort(function(a,b){ return Number(b.demanda) - Number(a.demanda); })
    .slice(0, ALERT_CONFIG.MAX_ROWS_AGOTADO);

  if (topAgotado.length > 0) {
    html += '<h3 style="margin:16px 0 6px;font-size:14px;color:#c62828;">🔴 Top ' + topAgotado.length + ' Agotados — Abastecimiento (mayor Demanda Mensual)</h3>';
    html += '<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12px;">';
    html += '<thead><tr>' +
            '<th ' + TH   + '>Código</th>' +
            '<th ' + TH   + '>Suministro</th>' +
            '<th ' + TH   + '>Grupo</th>' +
            '<th ' + TH_R + '>Inv. Actual</th>' +
            '<th ' + TH_R + '>Recepción 7d</th>' +
            '<th ' + TH_R + '>Tránsito</th>' +
            '<th ' + TH_R + '>Inv. Proy.</th>' +
            '<th ' + TH_R + '>Meses Cob.</th>' +
            '<th ' + TH_R + '>Demanda Mensual</th>' +
            '</tr></thead><tbody>';
    topAgotado.forEach(function(r) {
      html += '<tr style="background:#ffd5d5;">' +
              '<td ' + TD   + '>' + esc_(r.codigo)           + '</td>' +
              '<td ' + TD   + '>' + esc_(r.suministro)       + '</td>' +
              '<td ' + TD   + '>' + esc_(r.grupo)            + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.invActual)     + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.recepcion7d)   + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.transito)      + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.invProy)       + '</td>' +
              '<td ' + TD_R + '>' + fmtDecimal_(r.mesesCob)  + '</td>' +
              '<td ' + TD_R + '>' + fmtNum_(r.demanda)       + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }

  // ── Footer ─────────────────────────────────────────────────
  html += '<div style="margin-top:20px;font-size:11px;color:#888;border-top:1px solid #e0e0e0;padding-top:10px;">' +
          'Generado por el Algoritmo de Vigilancia Automatizada de Inventario, en base a los lotes activos al corte registrado en el sistema SALMI' +
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
    Logger.log('Sin alertas sobre el nivel mínimo (' + ALERT_CONFIG.MIN_LEVEL_TO_SEND + ').');
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
  var icons = { VENCIDO:'🔴', AGOTADO:'🔴', CRITICO:'🟠', RIESGO:'🟡', EXCESO:'🟢' };
  return icons[nivel] || '⚪';
}

function esc_(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatFecha_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' +
           String(v.getMonth() + 1).padStart(2,'0') + '-' +
           String(v.getDate()).padStart(2,'0');
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
