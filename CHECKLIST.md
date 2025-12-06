# ✅ Checklist de Implementación

## 📋 Lista de Verificación Rápida

Usa esta lista para verificar que has completado todos los pasos necesarios.

---

## Parte 1: Preparación (5 minutos)

- [ ] **1.1** Leí `LEEME_PRIMERO.md` para entender qué se hizo
- [ ] **1.2** Tengo acceso a mis archivos Excel en Google Drive
- [ ] **1.3** Tengo acceso a mi Google Sheet "Inventario Consolidado"
- [ ] **1.4** Conozco el ID de mi carpeta de Google Drive
  - URL de mi carpeta: `https://drive.google.com/drive/folders/___________`
  - Mi FOLDER_ID: `___________` (copia el ID aquí)

---

## Parte 2: Modificar Archivos Excel (10-15 minutos)

- [ ] **2.1** Abrí uno de mis archivos Excel de inventario
- [ ] **2.2** Creé una nueva hoja llamada **"Vencimientos"**
- [ ] **2.3** Agregué los encabezados:
  ```
  Fecha | Codigo | Fecha_Vencimiento | Cantidad
  ```
- [ ] **2.4** Agregué datos de ejemplo (al menos 3 filas)
- [ ] **2.5** Guardé el archivo Excel
- [ ] **2.6** (Opcional) Repetí 2.1-2.5 para otros archivos

**Ejemplo de datos:**
```
2024-01-15 | MED001 | 2024-02-01 | 200
2024-01-15 | MED001 | 2024-03-15 | 800
2024-01-16 | MED001 | 2024-02-01 | 180
```

---

## Parte 3: Configurar Google Apps Script (10 minutos)

### 3.1 Copiar el Código

- [ ] **3.1.1** Abrí mi Google Sheet "Inventario Consolidado"
- [ ] **3.1.2** Fui a **Extensiones → Apps Script**
- [ ] **3.1.3** Abrí el archivo `Code.gs` en este repositorio
- [ ] **3.1.4** Copié TODO el contenido de `Code.gs`
- [ ] **3.1.5** Pegué el código en el editor de Apps Script (reemplazando todo)

### 3.2 Configurar FOLDER_ID

- [ ] **3.2.1** Encontré la línea 18 en el código:
  ```javascript
  const FOLDER_ID = 'TU_FOLDER_ID_AQUI';
  ```
- [ ] **3.2.2** Reemplacé `'TU_FOLDER_ID_AQUI'` con el ID de mi carpeta:
  ```javascript
  const FOLDER_ID = 'abc123def456...'; // ← Mi ID real
  ```
- [ ] **3.2.3** Guardé el script (Ctrl+S o Cmd+S)

### 3.3 Activar Drive API

- [ ] **3.3.1** En el editor de Apps Script, clickeé el icono de **+** junto a "Servicios"
- [ ] **3.3.2** Busqué **"Drive API"**
- [ ] **3.3.3** Clickeé **Agregar**
- [ ] **3.3.4** Verifiqué que "Drive API" aparece en la lista de Servicios

---

## Parte 4: Ejecutar Funciones (15 minutos)

### 4.1 Función setup()

- [ ] **4.1.1** Seleccioné la función **`setup`** en el menú desplegable
- [ ] **4.1.2** Clickeé el botón **Ejecutar** (▶️)
- [ ] **4.1.3** Autoricé el script cuando me lo pidió
- [ ] **4.1.4** Esperé a que terminara la ejecución
- [ ] **4.1.5** Verifiqué en mi Google Sheet que se crearon 3 hojas:
  - [ ] Hoja "Data" existe
  - [ ] Hoja "Index" existe
  - [ ] Hoja "Vencimientos" existe ⭐ NUEVO

### 4.2 Función consolidate()

- [ ] **4.2.1** Seleccioné la función **`consolidate`**
- [ ] **4.2.2** Clickeé **Ejecutar** (▶️)
- [ ] **4.2.3** Esperé (puede tardar varios minutos si tienes muchos archivos)
- [ ] **4.2.4** Revisé los **Registros** (Ver → Registros de ejecución)
- [ ] **4.2.5** Verifiqué que no hay errores
- [ ] **4.2.6** Verifiqué en la hoja "Data" que hay datos
- [ ] **4.2.7** Verifiqué en la hoja "Vencimientos" que hay datos ⭐

**Si la hoja "Vencimientos" está vacía:**
- Verifica que tus archivos Excel tienen la hoja "Vencimientos"
- Ejecuta `consolidate()` de nuevo

### 4.3 Función createDailyTrigger()

- [ ] **4.3.1** Seleccioné la función **`createDailyTrigger`**
- [ ] **4.3.2** Clickeé **Ejecutar** (▶️)
- [ ] **4.3.3** Verifiqué en **Activadores** (icono de reloj ⏰) que hay un trigger
- [ ] **4.3.4** El trigger debe decir: "consolidate" ejecuta diariamente

---

## Parte 5: Publicar Web App (5 minutos)

- [ ] **5.1** En Apps Script, clickeé **Implementar → Nueva implementación**
- [ ] **5.2** Seleccioné tipo: **Aplicación web**
- [ ] **5.3** Configuré:
  - [ ] **Descripción**: "API de Inventario con Vencimientos"
  - [ ] **Ejecutar como**: Yo (mi correo)
  - [ ] **Quién tiene acceso**: Cualquiera con el enlace
- [ ] **5.4** Clickeé **Implementar**
- [ ] **5.5** Copié la **URL del Web App** (algo como: `https://script.google.com/macros/s/...`)
- [ ] **5.6** Guardé esta URL en un lugar seguro

**Mi URL del Web App:**
```
_________________________________________________________________
```

---

## Parte 6: Verificar Dashboard (5 minutos)

- [ ] **6.1** Verifiqué que `index.html` tiene la URL correcta (línea 304)
  - Si es diferente, actualicé la URL
- [ ] **6.2** Abrí mi dashboard en el navegador
- [ ] **6.3** Busqué un producto de mis datos
- [ ] **6.4** Verifiqué que veo:
  - [ ] Dos líneas en la gráfica (gris y azul) ⭐
  - [ ] Columnas: Total | Disponible | Vencido ⭐
  - [ ] Valores en la columna "Vencido" si aplica

---

## Parte 7: Pruebas (10 minutos)

### 7.1 Probar con Datos Reales

- [ ] **7.1.1** Busqué un producto que sé que tiene vencimientos
- [ ] **7.1.2** Verifiqué que:
  - [ ] Línea gris (Total) > Línea azul (Disponible)
  - [ ] Columna "Vencido" tiene valores > 0
  - [ ] Los números tienen sentido

### 7.2 Probar con Datos de Prueba (Opcional)

Si no tengo datos reales aún:

- [ ] **7.2.1** En Apps Script, ejecuté **`generarDatosPruebaVencimientos`**
- [ ] **7.2.2** Abrí el dashboard
- [ ] **7.2.3** Busqué el producto "TEST001"
- [ ] **7.2.4** Verifiqué que veo las dos líneas

### 7.3 Verificar Funciones de Diagnóstico

- [ ] **7.3.1** En Apps Script, ejecuté **`testVencimientos`**
- [ ] **7.3.2** Revisé los registros (Ver → Registros)
- [ ] **7.3.3** Verifiqué que muestra datos de vencimientos

---

## Parte 8: Finalización (2 minutos)

- [ ] **8.1** Verifiqué que el trigger diario está activo
- [ ] **8.2** Documenté mi URL del Web App
- [ ] **8.3** Agregué esta URL a mi README o documentación interna
- [ ] **8.4** (Opcional) Compartí el dashboard con mi equipo

---

## 🎉 ¡Felicidades!

Si marcaste todas las casillas, tu implementación está completa.

---

## 🆘 Solución de Problemas

### ❌ No veo la hoja "Vencimientos" en Google Sheets

**Problema**: La función `setup()` no se ejecutó correctamente.

**Solución**:
1. Ejecuta `setup()` de nuevo
2. Verifica los registros por errores
3. Verifica que tienes permisos de escritura en el Google Sheet

### ❌ La hoja "Vencimientos" está vacía

**Problema**: Tus archivos Excel no tienen la hoja "Vencimientos" o `consolidate()` falló.

**Solución**:
1. Verifica que al menos un archivo Excel tiene la hoja "Vencimientos"
2. Ejecuta `consolidate()` de nuevo
3. Revisa los registros por errores
4. Ejecuta `testVencimientos()` para diagnosticar

### ❌ Error "Unauthorized" al ejecutar funciones

**Problema**: No has autorizado el script.

**Solución**:
1. Ejecuta cualquier función
2. Cuando aparezca el diálogo de autorización, acepta
3. Sigue las instrucciones de Google
4. Intenta ejecutar la función de nuevo

### ❌ El dashboard no muestra datos de vencimientos

**Problema**: La API no está devolviendo los datos o la URL está mal.

**Solución**:
1. Abre la URL del Web App directamente en el navegador
2. Agrega `?list=true` al final: `https://script...?list=true`
3. Deberías ver un JSON con datos
4. Si ves error, verifica que publicaste el Web App correctamente

### ❌ Las dos líneas son iguales (Total = Disponible)

**Esto es NORMAL si**:
- No hay productos vencidos para ese producto
- Todas las fechas de vencimiento son futuras
- El producto no tiene datos de vencimientos

**Solución**:
- Prueba con otro producto
- O ejecuta `generarDatosPruebaVencimientos()` y busca "TEST001"

---

## 📞 Recursos de Ayuda

Si algo no funciona, consulta estos archivos en orden:

1. **`LEEME_PRIMERO.md`** - FAQ y problemas comunes
2. **`GUIA_IMPLEMENTACION.md`** - Pasos detallados
3. **`ARQUITECTURA.md`** - Cómo funciona el sistema

---

## 📊 Mi Progreso

**Fecha de inicio**: _______________  
**Fecha de finalización**: _______________  
**Tiempo total**: _______________ minutos

**Notas adicionales**:
```
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
```

---

## ✅ Checklist de Mantenimiento

Para uso futuro (mensual):

- [ ] Verificar que el trigger diario está activo
- [ ] Revisar logs por errores
- [ ] Verificar que los datos se están consolidando correctamente
- [ ] Actualizar fechas de vencimiento en archivos Excel
- [ ] Eliminar productos vencidos del inventario físico

---

**Última actualización**: Diciembre 2024  
**Versión del sistema**: 1.0 con soporte de vencimientos
