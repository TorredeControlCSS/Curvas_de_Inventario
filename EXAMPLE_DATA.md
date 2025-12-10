# Example Data Structures

This document provides examples of the data structures used for expiration date tracking.

## Example 1: Product Without Expiration Data

Products without expiration information continue to work as before. All inventory is considered available.

```json
{
  "serie": [
    {
      "fecha": "2024-01-01",
      "inventario": 1500
    },
    {
      "fecha": "2024-01-02",
      "inventario": 1450
    },
    {
      "fecha": "2024-01-03",
      "inventario": 1400
    }
  ],
  "subject_code": "PROD001",
  "subject_name": "Producto sin vencimiento",
  "mu_d": 50,
  "sigma_d": 15,
  "kb_min": 2250,
  "inventario_critico": 415,
  "lead": 45
}
```

**Result**: Dashboard shows identical values for "Total" and "Disponible" in the table.

---

## Example 2: Product With Expiration Data (Partially Expired)

A more realistic scenario where some batches have already expired.

```json
{
  "serie": [
    {
      "fecha": "2024-01-01",
      "inventario": 2000,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-15", "cantidad": 500 },
        { "fecha_vencimiento": "2024-02-20", "cantidad": 800 },
        { "fecha_vencimiento": "2024-04-10", "cantidad": 700 }
      ]
    },
    {
      "fecha": "2024-01-02",
      "inventario": 1950,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-15", "cantidad": 480 },
        { "fecha_vencimiento": "2024-02-20", "cantidad": 770 },
        { "fecha_vencimiento": "2024-04-10", "cantidad": 700 }
      ]
    },
    {
      "fecha": "2024-01-03",
      "inventario": 1900,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-15", "cantidad": 450 },
        { "fecha_vencimiento": "2024-02-20", "cantidad": 750 },
        { "fecha_vencimiento": "2024-04-10", "cantidad": 700 }
      ]
    }
  ],
  "subject_code": "MED001",
  "subject_name": "Medicamento con vencimiento",
  "mu_d": 50,
  "sigma_d": 15,
  "kb_min": 2250,
  "inventario_critico": 415,
  "lead": 45
}
```

**Analysis for 2024-01-01**:
- Total Inventory: 2000 units
- Expired (as of 2024-01-01): 500 units (batch from 2023-12-15)
- Available: 1500 units
- Future expirations: 800 units (2024-02-20), 700 units (2024-04-10)

**Dashboard Display**:
- Chart shows two distinct lines: "Inventario total" (gray) and "Inventario disponible" (blue)
- Table shows:
  - Fecha: 2024-01-01
  - Total: 2,000
  - Disponible: 1,500
  - Vencido: 500
  - Δ: (change from previous day)

---

## Example 3: Multiple SKUs Aggregated (Group View)

When viewing by group, the dashboard aggregates all products:

```json
{
  "serie": [
    {
      "fecha": "2024-01-01",
      "inventario": 5000,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-20", "cantidad": 800 },
        { "fecha_vencimiento": "2024-01-15", "cantidad": 600 },
        { "fecha_vencimiento": "2024-03-01", "cantidad": 1500 },
        { "fecha_vencimiento": "2024-05-15", "cantidad": 2100 }
      ]
    },
    {
      "fecha": "2024-01-02",
      "inventario": 4900,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-20", "cantidad": 780 },
        { "fecha_vencimiento": "2024-01-15", "cantidad": 580 },
        { "fecha_vencimiento": "2024-03-01", "cantidad": 1450 },
        { "fecha_vencimiento": "2024-05-15", "cantidad": 2090 }
      ]
    }
  ],
  "subject_label": "Grupo: MEDICAMENTOS",
  "mu_d": 100,
  "sigma_d": 25,
  "kb_min": 4500,
  "inventario_critico": 831,
  "lead": 45
}
```

**Analysis for 2024-01-01**:
- Total: 5000 units (sum of all SKUs in group)
- Expired: 800 units (from 2023-12-20)
- Available: 4200 units
- All statistical calculations use the 4200 available units

---

## Example 4: Testing Edge Cases

### Edge Case A: All Inventory Expired
```json
{
  "fecha": "2024-01-20",
  "inventario": 1000,
  "vencimientos": [
    { "fecha_vencimiento": "2024-01-01", "cantidad": 400 },
    { "fecha_vencimiento": "2024-01-10", "cantidad": 300 },
    { "fecha_vencimiento": "2024-01-15", "cantidad": 300 }
  ]
}
```
- Total: 1000
- Available: 0
- Expired: 1000
- **Chart**: Disponible line shows 0

### Edge Case B: No Expired Inventory (All Future)
```json
{
  "fecha": "2024-01-01",
  "inventario": 1000,
  "vencimientos": [
    { "fecha_vencimiento": "2024-06-01", "cantidad": 500 },
    { "fecha_vencimiento": "2024-12-01", "cantidad": 500 }
  ]
}
```
- Total: 1000
- Available: 1000
- Expired: 0
- **Chart**: Total and Disponible lines overlap perfectly

### Edge Case C: Mixed Data (Some Points With, Some Without Expiration)
```json
{
  "serie": [
    {
      "fecha": "2024-01-01",
      "inventario": 1000,
      "vencimientos": [
        { "fecha_vencimiento": "2023-12-15", "cantidad": 200 },
        { "fecha_vencimiento": "2024-03-01", "cantidad": 800 }
      ]
    },
    {
      "fecha": "2024-01-02",
      "inventario": 950
      // No vencimientos field
    },
    {
      "fecha": "2024-01-03",
      "inventario": 900,
      "vencimientos": []
      // Empty array
    }
  ]
}
```

**Behavior**:
- 2024-01-01: Total=1000, Available=800 (200 expired)
- 2024-01-02: Total=950, Available=950 (no expiration data, all available)
- 2024-01-03: Total=900, Available=900 (empty array, all available)

---

## Google Sheets Structure Example

### Sheet: "Vencimientos"

| Fecha      | Codigo  | Fecha_Vencimiento | Cantidad |
|------------|---------|-------------------|----------|
| 2024-01-01 | MED001  | 2023-12-15        | 500      |
| 2024-01-01 | MED001  | 2024-02-20        | 800      |
| 2024-01-01 | MED001  | 2024-04-10        | 700      |
| 2024-01-02 | MED001  | 2023-12-15        | 480      |
| 2024-01-02 | MED001  | 2024-02-20        | 770      |
| 2024-01-02 | MED001  | 2024-04-10        | 700      |
| 2024-01-01 | MED002  | 2024-03-01        | 1200     |
| 2024-01-01 | MED002  | 2024-06-15        | 800      |

This structure allows:
- Multiple expiration dates per product per day
- Easy querying by date and product code
- Clear tracking of inventory by batch

---

## Visual Results

### Chart Display
The chart will show:
1. **Inventario total** (gray line): Total inventory including expired
2. **Inventario disponible** (blue filled line): Available inventory (non-expired)
3. **Proyección 45 días** (green): Forward projection based on available inventory
4. **Proyección + pedido** (purple): Projection including planned orders
5. **Punto de Reorden** (orange dashed): Reorder point
6. **Inventario Crítico** (red dashed): Safety stock level

### Table Display
```
Fecha      | Total | Disponible | Vencido | Δ
-----------|-------|------------|---------|-----
2024-01-03 | 1,900 | 1,450      | 450     | -50
2024-01-02 | 1,950 | 1,470      | 480     | -50
2024-01-01 | 2,000 | 1,500      | 500     | -
```

### KPI Cards
- **% Abastecimiento (4 meses)**: Calculated using available inventory
- **Inventario disponible**: Shows available (non-expired) inventory only
- **Punto de Reorden**: Based on consumption of available inventory
- **Inv. Crítico (95%)**: Safety stock calculated from available inventory patterns
- **SMA_15 Inventario disponible**: Rolling average of available inventory

---

## Key Differences in Calculations

### Before (Without Expiration Tracking)
```
Inventory = Total inventory from sheet
Consumption = Daily decrease in total inventory
Projections = Based on total inventory consumption
```

### After (With Expiration Tracking)
```
Inventory = Available inventory (total - expired)
Consumption = Daily decrease in available inventory
Projections = Based on available inventory consumption

Note: This provides more accurate projections since it
excludes inventory that can't actually be used.
```

---

## Migration Example

### Step 1: Current State (No Expiration Data)
Your API returns:
```json
{"serie": [{"fecha": "2024-01-01", "inventario": 1000}]}
```
Dashboard displays normally with all inventory as available.

### Step 2: Add Expiration Data Gradually
Start tracking expiration for new products:
```json
{"serie": [
  {"fecha": "2024-01-01", "inventario": 1000},  // old product, no exp data
  {"fecha": "2024-01-01", "inventario": 500, "vencimientos": [...]}  // new product with exp
]}
```
Both display correctly on the dashboard.

### Step 3: Complete Migration
Eventually all products have expiration tracking:
```json
{"serie": [
  {"fecha": "2024-01-01", "inventario": 1000, "vencimientos": [...]},
  {"fecha": "2024-01-01", "inventario": 500, "vencimientos": [...]}
]}
```
Now you have full visibility into expired vs available inventory.
