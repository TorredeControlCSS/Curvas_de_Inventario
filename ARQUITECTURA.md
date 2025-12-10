# Arquitectura del Sistema - Seguimiento de Vencimientos

## 📐 Vista General

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHIVOS EXCEL                            │
│                  (en Google Drive)                           │
│                                                              │
│  Archivo1.xlsx          Archivo2.xlsx                       │
│  ├─ Inventario         ├─ Inventario                        │
│  │  ├─ Fecha           │  ├─ Fecha                          │
│  │  ├─ Codigo          │  ├─ Codigo                         │
│  │  ├─ Cantidad        │  ├─ Cantidad                       │
│  │  └─ ...             │  └─ ...                            │
│  └─ Vencimientos ⭐    └─ Vencimientos ⭐                   │
│     ├─ Fecha              ├─ Fecha                          │
│     ├─ Codigo             ├─ Codigo                         │
│     ├─ Fecha_Venc        ├─ Fecha_Venc                     │
│     └─ Cantidad           └─ Cantidad                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (consolidate() ejecuta diariamente)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE SHEETS                                   │
│         "Inventario Consolidado"                            │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ Hoja: Data     │  │ Hoja: Index    │  │ Hoja: Venc ⭐│ │
│  │                │  │                │  │              │ │
│  │ Fecha          │  │ Codigo         │  │ Fecha        │ │
│  │ Codigo         │  │ Suministro     │  │ Codigo       │ │
│  │ Suministro     │  │ Grupo          │  │ Fecha_Venc   │ │
│  │ Grupo          │  │                │  │ Cantidad     │ │
│  │ Inventario     │  │                │  │              │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (Google Apps Script - Code.gs)
                    (doGet() expone API REST)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API REST                                  │
│          https://script.google.com/macros/s/...             │
│                                                              │
│  GET ?list=true                                             │
│  → { codigos: [...], suministros: [...], grupos: [...] }   │
│                                                              │
│  GET ?codigo=MED001                                         │
│  → {                                                        │
│      serie: [                                               │
│        {                                                    │
│          fecha: "2024-01-15",                              │
│          inventario: 1000,                                 │
│          vencimientos: [ ⭐ NUEVO                          │
│            {fecha_vencimiento: "2024-02-01", cantidad: 200}│
│            {fecha_vencimiento: "2024-03-15", cantidad: 800}│
│          ]                                                  │
│        }                                                    │
│      ]                                                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (Fetch desde navegador)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               DASHBOARD WEB                                  │
│            (index.html en GitHub Pages)                     │
│                                                              │
│  JavaScript:                                                │
│  1. Recibe datos de API                                    │
│  2. calculateAvailableInventory() ⭐ NUEVO                 │
│     → Calcula: total - vencido = disponible                │
│  3. Genera gráfica con Chart.js                            │
│     → Línea gris: Total                                    │
│     → Línea azul: Disponible ⭐ NUEVO                      │
│  4. Calcula estadísticas con inventario disponible         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              GRÁFICA                                  │ │
│  │  1000├─────────────────────────                      │ │
│  │      │         ╱╲                                     │ │
│  │   800│      ╱──  ─╲──                                │ │
│  │      │   ╱──        ─╲  Línea gris (Total)          │ │
│  │   600│──╱             ╲─────                         │ │
│  │      │                  Línea azul (Disponible) ⭐    │ │
│  │   400│                                                │ │
│  │      └──────────────────────────────────────          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              TABLA                                    │ │
│  │  Fecha      │Total│Disponible⭐│Vencido⭐│  Δ       │ │
│  │  2024-01-15 │1000 │   800     │  200   │ -50       │ │
│  │  2024-01-14 │1050 │   850     │  200   │ -30       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo de Datos

### 1. Entrada de Datos (Manual)

```
Usuario actualiza archivos Excel en Google Drive
  ├─ Hoja "Inventario": datos de stock diario
  └─ Hoja "Vencimientos": fechas de vencimiento por lote ⭐ NUEVO
```

### 2. Consolidación (Automática - 3:00 AM)

```
Apps Script ejecuta consolidate()
  ├─ Lee todos los archivos .xlsx de la carpeta
  ├─ Extrae datos de hoja "Inventario"
  ├─ Extrae datos de hoja "Vencimientos" ⭐ NUEVO
  └─ Escribe en Google Sheets consolidado
      ├─ Hoja "Data" ← datos de inventario
      └─ Hoja "Vencimientos" ← datos de vencimiento ⭐ NUEVO
```

### 3. API REST (Tiempo Real)

```
Usuario abre dashboard
  ↓
Frontend hace GET a API
  ↓
Apps Script (doGet) procesa request
  ├─ Query a hoja "Data"
  ├─ Query a hoja "Vencimientos" ⭐ NUEVO
  └─ Combina datos por fecha + código
  ↓
Retorna JSON con vencimientos incluidos ⭐ NUEVO
```

### 4. Procesamiento Frontend (Navegador)

```
Frontend recibe JSON
  ↓
Para cada punto de inventario:
  ├─ Total = inventario (del servidor)
  ├─ Expired = suma de cantidades con fecha_vencimiento < hoy ⭐ NUEVO
  └─ Available = Total - Expired ⭐ NUEVO
  ↓
Cálculos estadísticos usan Available
  ├─ Consumo diario
  ├─ Proyecciones
  ├─ ROP (Punto de Reorden)
  └─ Safety Stock
  ↓
Renderiza gráfica y tabla
```

## 🎯 Componentes Modificados

### ⭐ NUEVO: Hoja "Vencimientos"

**Propósito**: Almacenar fechas de vencimiento por lote de inventario

**Estructura**:
```
Fecha       | Codigo  | Suministro | Grupo | Fecha_Vencimiento | Cantidad
2024-01-15  | MED001  | Paracetamol| Meds  | 2024-02-01        | 200
2024-01-15  | MED001  | Paracetamol| Meds  | 2024-03-15        | 800
```

**Por qué**: 
- Un producto puede tener múltiples lotes con diferentes fechas de vencimiento
- Necesitamos rastrear cuánto de cada lote aún es válido

### ⭐ NUEVO: Función calculateAvailableInventory()

**Ubicación**: index.html línea 307-335

**Propósito**: Calcular inventario disponible restando productos vencidos

**Lógica**:
```javascript
Para cada punto de inventario con fecha X:
  Total = inventario total
  Expired = 0
  
  Para cada lote en vencimientos:
    Si fecha_vencimiento < fecha X:
      Expired += cantidad del lote
  
  Available = Total - Expired
```

### ⭐ NUEVO: Serie de Gráfica "Inventario Disponible"

**Ubicación**: index.html línea 784-785

**Propósito**: Mostrar visualmente la diferencia entre total y disponible

**Estilos**:
- Total: Línea gris clara (referencia)
- Disponible: Línea azul gruesa (principal)

## 📊 Ejemplo de Transformación de Datos

### Datos de Entrada (Excel)

**Hoja: Inventario**
```
Fecha      | Codigo  | Cantidad
2024-01-15 | MED001  | 1000
2024-01-16 | MED001  | 950
```

**Hoja: Vencimientos** ⭐
```
Fecha      | Codigo  | Fecha_Vencimiento | Cantidad
2024-01-15 | MED001  | 2023-12-31        | 200
2024-01-15 | MED001  | 2024-03-01        | 800
2024-01-16 | MED001  | 2023-12-31        | 180
2024-01-16 | MED001  | 2024-03-01        | 770
```

### Datos Consolidados (Google Sheets)

**Hoja: Data**
```
Fecha      | Codigo  | Suministro   | Grupo | Inventario
2024-01-15 | MED001  | Paracetamol  | Meds  | 1000
2024-01-16 | MED001  | Paracetamol  | Meds  | 950
```

**Hoja: Vencimientos** ⭐
```
Fecha      | Codigo  | Suministro   | Grupo | Fecha_Venc | Cantidad
2024-01-15 | MED001  | Paracetamol  | Meds  | 2023-12-31 | 200
2024-01-15 | MED001  | Paracetamol  | Meds  | 2024-03-01 | 800
2024-01-16 | MED001  | Paracetamol  | Meds  | 2023-12-31 | 180
2024-01-16 | MED001  | Paracetamol  | Meds  | 2024-03-01 | 770
```

### Respuesta API

```json
{
  "serie": [
    {
      "fecha": "2024-01-15",
      "inventario": 1000,
      "vencimientos": [
        {"fecha_vencimiento": "2023-12-31", "cantidad": 200},
        {"fecha_vencimiento": "2024-03-01", "cantidad": 800}
      ]
    },
    {
      "fecha": "2024-01-16",
      "inventario": 950,
      "vencimientos": [
        {"fecha_vencimiento": "2023-12-31", "cantidad": 180},
        {"fecha_vencimiento": "2024-03-01", "cantidad": 770}
      ]
    }
  ]
}
```

### Cálculo en Frontend (hoy = 2024-01-16)

**Para 2024-01-15:**
- Total: 1000
- Vencido: 200 (2023-12-31 < 2024-01-15)
- Disponible: 800

**Para 2024-01-16:**
- Total: 950
- Vencido: 180 (2023-12-31 < 2024-01-16)
- Disponible: 770

### Resultado en Dashboard

**Gráfica:**
- Línea gris en 1000, 950
- Línea azul en 800, 770

**Tabla:**
```
Fecha      | Total | Disponible | Vencido | Δ
2024-01-16 | 950   | 770        | 180     | -50
2024-01-15 | 1000  | 800        | 200     | -
```

## 🔐 Seguridad y Permisos

```
Google Drive Folder (Archivos Excel)
  ↓ Permisos: Solo tú
Google Sheets (Inventario Consolidado)
  ↓ Permisos: Solo tú
Apps Script (Code.gs)
  ↓ Se ejecuta como: Tu cuenta
  ↓ Acceso Web App: Cualquiera con el enlace
Dashboard (GitHub Pages)
  ↓ Público (pero API requiere URL correcta)
```

## ⚙️ Configuración Mínima Requerida

1. **Archivos Excel**: Agregar hoja "Vencimientos" ⭐
2. **Google Sheets**: Ejecutar setup() una vez
3. **Apps Script**: Configurar FOLDER_ID
4. **Apps Script**: Publicar como Web App
5. **Frontend**: URL de API en index.html (ya configurado)

## 🚀 Mejoras Futuras Posibles

- [ ] Alertas automáticas para productos próximos a vencer
- [ ] Dashboard de productos vencidos
- [ ] Exportar reportes de vencimientos
- [ ] Predicción de vencimientos futuros
- [ ] Integración con sistema de pedidos
- [ ] Notificaciones por email/Slack

---

**Leyenda**: ⭐ = Componente NUEVO agregado en esta implementación
