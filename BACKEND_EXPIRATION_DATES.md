# Backend Changes for Expiration Date Tracking

## Overview
This document describes the required changes to the Google Apps Script backend (`Code.gs`) to support expiration date tracking and calculation of available (non-expired) inventory.

## New Data Structure

### API Response Format
The backend must now return expiration date information for each inventory point. The updated `serie` array should include an optional `vencimientos` field:

```javascript
{
  "serie": [
    {
      "fecha": "2024-01-15",
      "inventario": 1000,
      "vencimientos": [  // NEW: Array of expiration records
        {
          "fecha_vencimiento": "2024-02-01",
          "cantidad": 200
        },
        {
          "fecha_vencimiento": "2024-03-15",
          "cantidad": 300
        }
      ]
    },
    // ... more data points
  ],
  "subject_code": "SKU123",
  "subject_name": "Producto ejemplo",
  // ... other existing fields
}
```

### Google Sheets Structure

#### Option 1: Separate Expiration Sheet
Create a new sheet called `Vencimientos` with the following columns:
- `Fecha` (Date): The inventory date
- `Codigo` (Text): Product code
- `Fecha_Vencimiento` (Date): Expiration date
- `Cantidad` (Number): Quantity expiring on that date

#### Option 2: Extended Data Sheet
Add columns to the existing `Data` sheet:
- Existing columns: `Fecha`, `Codigo`, `Suministro`, `Grupo`, `Inventario`
- New columns: `Fecha_Vencimiento`, `Cantidad_Vencimiento`

Multiple rows can exist for the same date/product combination to represent different expiration dates.

## Backend Logic Changes

### 1. Data Consolidation
When consolidating inventory data from source Excel files:

```javascript
function consolidate() {
  // Existing code to read inventory...
  
  // NEW: Also read expiration date data
  // Look for sheets or columns with expiration information
  // For each product and date, collect all expiration records
  
  // Store in Data sheet (existing) and Vencimientos sheet (new)
}
```

### 2. API Endpoint Updates
Modify the `doGet(e)` function to include expiration data:

```javascript
function doGet(e) {
  // ... existing parameter handling
  
  if (e.parameter.list) {
    // Existing list logic
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Query inventory data
  const serieData = queryInventoryData(params);
  
  // NEW: Query expiration data for the same products/dates
  const expirationData = queryExpirationData(params);
  
  // Merge expiration data into serie
  const serieWithExpirations = mergeExpirationData(serieData, expirationData);
  
  const response = {
    serie: serieWithExpirations,
    // ... other existing fields
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function queryExpirationData(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Vencimientos');
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const expirations = {};
  
  // Build a map: fecha_codigo -> array of {fecha_vencimiento, cantidad}
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fecha = formatDate(row[headers.indexOf('Fecha')]);
    const codigo = row[headers.indexOf('Codigo')];
    const fechaVenc = formatDate(row[headers.indexOf('Fecha_Vencimiento')]);
    const cantidad = row[headers.indexOf('Cantidad')];
    
    if (!fecha || !codigo || !fechaVenc || !cantidad) continue;
    
    // Apply filters from params (codigo, suministro, grupo, from, to)
    // ... filter logic similar to main query
    
    const key = `${fecha}_${codigo}`;
    if (!expirations[key]) {
      expirations[key] = [];
    }
    expirations[key].push({
      fecha_vencimiento: fechaVenc,
      cantidad: Number(cantidad)
    });
  }
  
  return expirations;
}

function mergeExpirationData(serieData, expirationData) {
  return serieData.map(punto => {
    const key = `${punto.fecha}_${punto.codigo}`;
    const vencimientos = expirationData[key] || [];
    
    return {
      ...punto,
      vencimientos: vencimientos
    };
  });
}

function formatDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  const d = new Date(dateValue);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

## Source Data Requirements

### Excel Files in Google Drive
Your source Excel files should now include expiration date information. Two approaches:

#### Approach A: Separate Expiration Sheet in Each Excel
Each Excel file has:
- `Inventario` sheet (existing): Date, Codigo, Suministro, Grupo, Cantidad
- `Vencimientos` sheet (new): Date, Codigo, Fecha_Vencimiento, Cantidad

#### Approach B: Combined Format
Each Excel file has:
- Extended `Inventario` sheet with columns:
  - Fecha, Codigo, Suministro, Grupo, Inventario_Total
  - Fecha_Vencimiento, Cantidad_Vencimiento (one row per expiration batch)

### Data Integrity
- The sum of all `Cantidad_Vencimiento` for a given date/product should equal or be less than `Inventario_Total`
- Dates should be in ISO format (YYYY-MM-DD)
- Products without expiration data will work normally (frontend treats missing data as "all available")

## Testing

### Test Cases
1. **No expiration data**: Products without `vencimientos` should display normally
2. **All expired**: Product with all inventory expired should show 0 available
3. **Partially expired**: Product with some expired inventory should show reduced available
4. **Future expiration**: Products expiring in the future should show full availability

### Sample API Response
```json
{
  "serie": [
    {
      "fecha": "2024-01-01",
      "inventario": 1000,
      "vencimientos": [
        {"fecha_vencimiento": "2023-12-15", "cantidad": 200},
        {"fecha_vencimiento": "2024-02-10", "cantidad": 300},
        {"fecha_vencimiento": "2024-03-20", "cantidad": 500}
      ]
    },
    {
      "fecha": "2024-01-02",
      "inventario": 950
    }
  ],
  "subject_code": "MED001",
  "subject_name": "Medicamento Ejemplo",
  "mu_d": 25,
  "sigma_d": 8,
  "kb_min": 1125,
  "inventario_critico": 208.5,
  "lead": 45
}
```

## Migration Path

### Phase 1: Backend Update (Optional)
1. Update Google Apps Script to read and serve expiration data
2. Test with sample data

### Phase 2: Data Population
1. Update source Excel files to include expiration dates
2. Run consolidation script
3. Verify `Vencimientos` sheet is populated

### Phase 3: Frontend Already Updated
The frontend has already been updated to:
- Handle expiration data when present
- Fall back gracefully when expiration data is absent
- Display both total and available inventory
- Use available inventory for all calculations

## Notes

- **Backward Compatibility**: The frontend changes are backward compatible. If no expiration data is provided, it treats all inventory as available.
- **Performance**: For large datasets, consider indexing or caching expiration data.
- **Data Source**: Ensure your source Excel files are updated to include expiration tracking.
- **Validation**: Add validation rules to ensure expiration quantities don't exceed total inventory.

## Example Implementation Snippet

Here's a minimal example for the backend:

```javascript
// In Code.gs
function doGet(e) {
  const params = e.parameter;
  
  if (params.list) {
    return getMetadata();
  }
  
  // Get inventory serie
  const serie = getInventorySerie(params);
  
  // Enhance with expiration data
  const serieWithExp = serie.map(point => {
    const exp = getExpirationsForPoint(point.fecha, point.codigo);
    return { ...point, vencimientos: exp };
  });
  
  const result = {
    serie: serieWithExp,
    // ... other fields
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```
