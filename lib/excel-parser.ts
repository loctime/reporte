import * as XLSX from "xlsx"
import type { AuditFile, AuditItem, AuditStatus } from "./types"
import { loadColumnConfig, type ColumnConfig } from "./column-config"

interface ColumnMapping {
  pregunta: number | null
  cumple: number | null
  cumpleParcial: number | null
  noCumple: number | null
  noAplica: number | null
  observacion: number | null
}

export async function parseExcelFile(file: File): Promise<AuditFile> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: "array" })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

  // Convertir a JSON con header en fila 0
  const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

  // Extraer información del encabezado (con celdas combinadas)
  let operacion = ""
  let responsable = ""
  let cliente = ""
  let fecha = new Date()
  let auditor = ""

  // Buscar en las primeras filas la información del encabezado
  for (let i = 0; i < Math.min(15, jsonData.length); i++) {
    const row = jsonData[i]
    if (!row) continue

    const rowText = row.join(" ").toLowerCase()
    const rowTextOriginal = row.join(" ")

    // Buscar cada campo en la fila completa
    if ((rowText.includes("operación:") || rowText.includes("operacion:")) && !operacion) {
      const opValue = extractValue(rowTextOriginal, "Operación:") || extractValue(rowTextOriginal, "Operacion:")
      if (opValue && opValue.length > 0 && !opValue.includes("Responsable") && !opValue.includes("Fecha")) {
        operacion = opValue.trim()
      }
    }
    if (rowText.includes("responsable") && !responsable) {
      const respValue = extractValue(rowTextOriginal, "Responsable de la Operación:") || 
                        extractValue(rowTextOriginal, "Responsable:")
      if (respValue && respValue.length > 0 && !respValue.includes("Operación") && !respValue.includes("Fecha")) {
        responsable = respValue.trim()
      }
    }
    if (rowText.includes("cliente:") && !cliente) {
      const cliValue = extractValue(rowTextOriginal, "Cliente:")
      // Solo tomar si no es la línea del criterio
      if (cliValue && cliValue.length > 0 && !cliValue.includes("Criterio:") && !cliValue.includes("C=")) {
        cliente = cliValue.trim()
      }
    }
    if (rowText.includes("fecha:") && fecha.getTime() === new Date().getTime()) {
      const fechaStr = extractValue(rowTextOriginal, "Fecha:")
      if (fechaStr) {
        const parsedFecha = parseFecha(fechaStr)
        if (parsedFecha.getFullYear() > 2000 && parsedFecha.getFullYear() < 2100) {
          fecha = parsedFecha
        }
      }
    }
    if (rowText.includes("auditor:") && !auditor) {
      const audValue = extractValue(rowTextOriginal, "Auditor:")
      if (audValue && audValue.length > 0) {
        auditor = audValue.trim()
      }
    }
  }

  // Verificar si hay configuración guardada - REQUERIDA
  const savedConfig = loadColumnConfig()
  
  if (!savedConfig) {
    throw new Error(
      "No hay configuración de columnas guardada. Por favor, configura las columnas del Excel primero."
    )
  }

  // Validar que la configuración tenga los campos mínimos requeridos
  if (
    savedConfig.pregunta === undefined ||
    savedConfig.cumple === undefined ||
    savedConfig.cumpleParcial === undefined ||
    savedConfig.noCumple === undefined ||
    savedConfig.noAplica === undefined ||
    savedConfig.headerRowIndex === undefined
  ) {
    throw new Error(
      "La configuración de columnas está incompleta. Por favor, vuelve a configurar las columnas del Excel."
    )
  }

  // Validar que haya configuración de fecha y operación
  if (!savedConfig.fechaCell || !savedConfig.operacionCell) {
    throw new Error(
      "La configuración no incluye las celdas de fecha u operación. Por favor, completa la configuración."
    )
  }

  // Función para convertir índice de columna a notación Excel (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
  const colIndexToExcel = (colIndex: number): string => {
    let result = ""
    let num = colIndex
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
    }
    return result
  }
  
  // Leer operación desde la celda configurada
  if (savedConfig.operacionCell) {
    const colLetter = colIndexToExcel(savedConfig.operacionCell.col)
    const cellAddress = `${colLetter}${savedConfig.operacionCell.row + 1}`
    const operacionCell = firstSheet[cellAddress]
    
    if (operacionCell && operacionCell.v) {
      operacion = String(operacionCell.v).trim()
    } else {
      // Fallback: leer desde jsonData
      const operacionRow = jsonData[savedConfig.operacionCell.row]
      if (operacionRow && operacionRow.length > savedConfig.operacionCell.col) {
        const operacionValue = operacionRow[savedConfig.operacionCell.col]
        if (operacionValue) {
          operacion = String(operacionValue).trim()
        }
      }
    }
  }

  // Leer responsable desde C6 (fila 5, columna 2) por defecto
  const responsableRow = jsonData[5] // Fila 6 (índice 5)
  if (responsableRow && responsableRow.length > 2) {
    const responsableValue = responsableRow[2] // Columna C (índice 2)
    if (responsableValue !== null && responsableValue !== undefined && responsableValue !== "") {
      responsable = String(responsableValue).trim()
    }
  }

  // Leer auditor desde K6 (fila 5, columna 10) por defecto
  if (responsableRow && responsableRow.length > 10) {
    const auditorValue = responsableRow[10] // Columna K (índice 10)
    if (auditorValue !== null && auditorValue !== undefined && auditorValue !== "") {
      auditor = String(auditorValue).trim()
    }
  }
  
  // Si hay configuración de fechaCell, usarla (REQUERIDA)
  if (savedConfig.fechaCell) {
    // Leer directamente desde la hoja usando la notación de celda
    const fechaColLetter = colIndexToExcel(savedConfig.fechaCell.col)
    const fechaCellAddress = `${fechaColLetter}${savedConfig.fechaCell.row + 1}`
    const fechaCell = firstSheet[fechaCellAddress]
    
    if (fechaCell) {
      // XLSX puede devolver fechas como números seriales o como strings
      if (typeof fechaCell.v === "number") {
        // Es un número serial de Excel
        // Excel cuenta desde 1900-01-01, pero tiene un bug donde cuenta 1900 como año bisiesto
        // La fórmula correcta es: Excel epoch es 30 de diciembre de 1899
        const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899
        const jsDate = new Date(excelEpoch.getTime() + (fechaCell.v - 1) * 24 * 60 * 60 * 1000)
        
        // Validar que la fecha sea razonable
        if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 2000 && jsDate.getFullYear() < 2100) {
          fecha = jsDate
        } else {
          console.warn(`Fecha serial de Excel inválida: ${fechaCell.v} -> ${jsDate}`)
        }
      } else if (fechaCell.v !== null && fechaCell.v !== undefined) {
        // Es un string u otro tipo, parsearlo como DD/MM/YYYY
        const fechaStr = String(fechaCell.v).trim()
        if (fechaStr.length > 0) {
          const parsedFecha = parseFecha(fechaStr)
          // Validar que la fecha parseada sea razonable
          if (!isNaN(parsedFecha.getTime()) && parsedFecha.getFullYear() > 2000 && parsedFecha.getFullYear() < 2100) {
            fecha = parsedFecha
          } else {
            console.warn(`Fecha string parseada inválida: "${fechaStr}" -> ${parsedFecha}`)
          }
        }
      }
    } else {
      // Fallback: leer desde jsonData
      const fechaRow = jsonData[savedConfig.fechaCell.row]
      if (fechaRow && fechaRow.length > savedConfig.fechaCell.col) {
        const fechaValue = fechaRow[savedConfig.fechaCell.col]
        if (fechaValue !== null && fechaValue !== undefined && fechaValue !== "") {
          // Si es un número, podría ser un serial de Excel
          if (typeof fechaValue === "number") {
            const excelEpoch = new Date(1899, 11, 30)
            const jsDate = new Date(excelEpoch.getTime() + (fechaValue - 1) * 24 * 60 * 60 * 1000)
            if (jsDate.getFullYear() > 2000 && jsDate.getFullYear() < 2100) {
              fecha = jsDate
            }
          } else {
            const fechaStr = String(fechaValue).trim()
            if (fechaStr.length > 0) {
              const parsedFecha = parseFecha(fechaStr)
              if (parsedFecha.getFullYear() > 2000 && parsedFecha.getFullYear() < 2100) {
                fecha = parsedFecha
              }
            }
          }
        }
      }
    }
  }
  
  // Validar que se haya encontrado la fecha
  if (fecha.getTime() === new Date().getTime() || isNaN(fecha.getTime())) {
    throw new Error(
      `No se pudo leer la fecha desde la celda configurada (fila ${savedConfig.fechaCell.row + 1}, columna ${colIndexToExcel(savedConfig.fechaCell.col)}). Por favor, verifica la configuración.`
    )
  }
  
  // Usar configuración guardada (REQUERIDA)
  const headerRowIndex = savedConfig.headerRowIndex
  const columnMapping: ColumnMapping = {
    pregunta: savedConfig.pregunta,
    cumple: savedConfig.cumple,
    cumpleParcial: savedConfig.cumpleParcial,
    noCumple: savedConfig.noCumple,
    noAplica: savedConfig.noAplica,
    observacion: savedConfig.observacion,
  }

  // Validar que la fila de encabezados existe
  if (headerRowIndex < 0 || headerRowIndex >= jsonData.length) {
    throw new Error(
      `La fila de encabezados configurada (fila ${headerRowIndex + 1}) no existe en el archivo. Por favor, verifica la configuración.`
    )
  }

  // Código de detección automática eliminado - ahora requiere configuración manual

  // Usar columna de cumplimiento de la configuración (opcional)
  const cumplimientoCol: number | null = savedConfig.cumplimientoCol ?? null

  // Leer el valor de cumplimiento del Excel
  let cumplimientoFromExcel: number | null = null
  if (cumplimientoCol !== null) {
    // Si hay configuración guardada con fila específica, usarla
    const searchRows = savedConfig && savedConfig.cumplimientoRow !== null
      ? [savedConfig.cumplimientoRow]
      : [5, 10, headerRowIndex + 1, headerRowIndex + 2]
    
    for (const rowIndex of searchRows) {
      if (rowIndex >= 0 && rowIndex < jsonData.length) {
        const row = jsonData[rowIndex]
        if (row && cumplimientoCol < row.length) {
          const cellValue = row[cumplimientoCol]
          if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
            // Intentar parsear como número
            const numValue = typeof cellValue === "number" ? cellValue : Number.parseFloat(String(cellValue))
            if (!isNaN(numValue) && numValue > 0) {
              // Si es un decimal (0.79375), convertirlo a porcentaje
              if (numValue < 1) {
                cumplimientoFromExcel = numValue * 100
              } else if (numValue <= 100) {
                cumplimientoFromExcel = numValue
              }
              break
            }
          }
        }
      }
    }
  }

  // Si no encontramos en la columna específica, buscar en las primeras filas cualquier número que parezca porcentaje
  if (cumplimientoFromExcel === null && !savedConfig) {
    for (let rowIndex = 0; rowIndex < Math.min(15, jsonData.length); rowIndex++) {
      const row = jsonData[rowIndex]
      if (!row) continue
      
      // Buscar en todas las columnas de esta fila
      for (let col = 0; col < row.length; col++) {
        const cellValue = row[col]
        if (cellValue !== undefined && cellValue !== null) {
          const numValue = typeof cellValue === "number" ? cellValue : Number.parseFloat(String(cellValue))
          // Si es un decimal entre 0.5 y 1.0, probablemente es el cumplimiento (0.79375 = 79.375%)
          if (!isNaN(numValue) && numValue >= 0.5 && numValue <= 1.0) {
            cumplimientoFromExcel = numValue * 100
            break
          }
        }
      }
      if (cumplimientoFromExcel !== null) break
    }
  }

  // Si no encontramos columna de pregunta, buscar en las primeras columnas
  if (columnMapping.pregunta === null) {
    for (let col = 0; col < Math.min(5, jsonData[headerRowIndex]?.length || 0); col++) {
      const cell = String(jsonData[headerRowIndex]?.[col] || "").toLowerCase()
      if (cell.includes("pregunta") || cell.includes("chequeo") || cell.includes("puntos") || 
          (cell.includes("item") && !cell.includes("items"))) {
        columnMapping.pregunta = col
        break
      }
    }
    // Si aún no encontramos, usar columna 1 por defecto (la 0 suele ser el número)
    if (columnMapping.pregunta === null) {
      columnMapping.pregunta = 1
    }
  }

  // Procesar items
  const items: AuditItem[] = []
  let currentCategoria = ""
  let itemCounter = 0

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || row.length === 0) continue

    // Detectar categoría (filas con número en columna 0 y texto largo en mayúsculas en columna 1)
    if (row[0] && (typeof row[0] === "number" || (typeof row[0] === "string" && /^\d+$/.test(String(row[0]))))) {
      if (row[1] && typeof row[1] === "string") {
        const possibleCategoria = String(row[1]).trim()
        const upperCategoria = possibleCategoria.toUpperCase()
        // Es categoría si es texto largo en mayúsculas, no tiene signo de interrogación, y no tiene "x"
        if (possibleCategoria.length > 10 && 
            (upperCategoria === possibleCategoria || !possibleCategoria.includes("¿")) &&
            !possibleCategoria.toLowerCase().includes("x") &&
            !possibleCategoria.includes("?")) {
          currentCategoria = possibleCategoria
          continue
        }
      }
    }

    // Obtener pregunta
    const preguntaCol = columnMapping.pregunta ?? 1
    let pregunta = findPregunta(row, preguntaCol)
    
    // Si no encontramos pregunta en la columna preferida, buscar en otras columnas
    if (!pregunta || pregunta.length < 5) {
      pregunta = findPregunta(row, null)
      if (!pregunta || pregunta.length < 5) {
        continue
      }
    }

    // Detectar estado usando el mapeo de columnas
    const estado = detectEstado(row, columnMapping)
    if (!estado) {
      // Si no hay estado pero hay pregunta, podría ser una fila de resumen - saltarla
      continue
    }

    itemCounter++

    // Obtener observación
    const observacionCol = columnMapping.observacion
    const observacion = observacionCol !== null ? String(row[observacionCol] || "").trim() : findObservacion(row)

    items.push({
      id: `${file.name}-${itemCounter}`,
      operacion,
      responsable,
      cliente,
      fecha,
      auditor,
      categoria: currentCategoria || "General",
      item: String(itemCounter),
      pregunta,
      estado,
      observacion: observacion || "",
      oportunidadMejora: "",
      normativa: "",
    })
  }

  // Función auxiliar para leer un valor numérico de una celda específica
  const readCellValue = (cell: { row: number; col: number } | null): number | null => {
    if (!cell) return null
    if (cell.row >= 0 && cell.row < jsonData.length && jsonData[cell.row]) {
      const row = jsonData[cell.row]
      if (cell.col >= 0 && cell.col < row.length) {
        const cellValue = row[cell.col]
        if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
          const numValue = typeof cellValue === "number" ? cellValue : Number.parseInt(String(cellValue), 10)
          if (!isNaN(numValue) && numValue >= 0) {
            return numValue
          }
        }
      }
    }
    return null
  }

  // Función auxiliar para leer un valor numérico o porcentaje de una celda específica
  const readCellValueOrPercent = (cell: { row: number; col: number } | null): number | null => {
    if (!cell) return null
    if (cell.row >= 0 && cell.row < jsonData.length && jsonData[cell.row]) {
      const row = jsonData[cell.row]
      if (cell.col >= 0 && cell.col < row.length) {
        const cellValue = row[cell.col]
        if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
          // Si es un número, puede ser porcentaje (0-100) o decimal (0-1)
          if (typeof cellValue === "number") {
            // Si es mayor a 1, asumir que es porcentaje (0-100), sino es decimal (0-1)
            return cellValue > 1 ? cellValue : cellValue * 100
          }
          // Si es string, intentar parsear
          const strValue = String(cellValue).trim().replace("%", "").replace(",", ".")
          const numValue = Number.parseFloat(strValue)
          if (!isNaN(numValue) && numValue >= 0) {
            return numValue > 1 ? numValue : numValue * 100
          }
        }
      }
    }
    return null
  }

  // Leer estadísticas del Excel usando la configuración
  const totalItemsFromExcel = savedConfig?.totalItemsCell ? readCellValue(savedConfig.totalItemsCell) : null
  const cumpleFromExcel = savedConfig?.cumpleCell ? readCellValue(savedConfig.cumpleCell) : null
  const cumpleParcialFromExcel = savedConfig?.cumpleParcialCell ? readCellValue(savedConfig.cumpleParcialCell) : null
  const noCumpleFromExcel = savedConfig?.noCumpleCell ? readCellValue(savedConfig.noCumpleCell) : null
  const noAplicaFromExcel = savedConfig?.noAplicaCell ? readCellValue(savedConfig.noAplicaCell) : null

  // Leer porcentajes desde celdas configuradas (C13, D13, E13, F13 por defecto)
  // Si no están configuradas, usar valores por defecto: C13 (fila 12, col 2), D13 (fila 12, col 3), etc.
  let cumplePctFromExcel: number | null = null
  let cumpleParcialPctFromExcel: number | null = null
  let noCumplePctFromExcel: number | null = null
  let noAplicaPctFromExcel: number | null = null

  if (savedConfig?.cumplePctCell) {
    cumplePctFromExcel = readCellValueOrPercent(savedConfig.cumplePctCell)
  } else {
    // Por defecto: C13 (fila 12, columna 2)
    cumplePctFromExcel = readCellValueOrPercent({ row: 12, col: 2 })
  }

  if (savedConfig?.cumpleParcialPctCell) {
    cumpleParcialPctFromExcel = readCellValueOrPercent(savedConfig.cumpleParcialPctCell)
  } else {
    // Por defecto: D13 (fila 12, columna 3)
    cumpleParcialPctFromExcel = readCellValueOrPercent({ row: 12, col: 3 })
  }

  if (savedConfig?.noCumplePctCell) {
    noCumplePctFromExcel = readCellValueOrPercent(savedConfig.noCumplePctCell)
  } else {
    // Por defecto: E13 (fila 12, columna 4)
    noCumplePctFromExcel = readCellValueOrPercent({ row: 12, col: 4 })
  }

  if (savedConfig?.noAplicaPctCell) {
    noAplicaPctFromExcel = readCellValueOrPercent(savedConfig.noAplicaPctCell)
  } else {
    // Por defecto: F13 (fila 12, columna 5)
    noAplicaPctFromExcel = readCellValueOrPercent({ row: 12, col: 5 })
  }

  // Usar valores del Excel si están configurados, sino calcular desde items parseados
  const totalItems = totalItemsFromExcel !== null ? totalItemsFromExcel : items.length
  const cumple = cumpleFromExcel !== null ? cumpleFromExcel : items.filter((i) => i.estado === "Cumple").length
  const cumpleParcial = cumpleParcialFromExcel !== null ? cumpleParcialFromExcel : items.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumple = noCumpleFromExcel !== null ? noCumpleFromExcel : items.filter((i) => i.estado === "No cumple").length
  const noAplica = noAplicaFromExcel !== null ? noAplicaFromExcel : items.filter((i) => i.estado === "No aplica").length
  
  const itemsEvaluados = totalItems - noAplica
  
  // Usar el cumplimiento del Excel si se encontró, sino calcularlo
  let cumplimiento: number
  if (cumplimientoFromExcel !== null) {
    cumplimiento = cumplimientoFromExcel
  } else {
    // Calcular como fallback solo si tenemos items evaluados
    cumplimiento = itemsEvaluados > 0 ? ((cumple + cumpleParcial * 0.5) / itemsEvaluados) * 100 : 0
  }

  return {
    fileName: file.name,
    operacion,
    responsable,
    cliente,
    fecha,
    auditor,
    items,
    cumplimiento: Number.parseFloat(cumplimiento.toFixed(2)), // Redondear a 2 decimales
    totalItems,
    cumple,
    cumpleParcial,
    noCumple,
    noAplica,
    // Agregar porcentajes si se leyeron desde Excel
    ...(cumplePctFromExcel !== null && { cumplePct: cumplePctFromExcel }),
    ...(cumpleParcialPctFromExcel !== null && { cumpleParcialPct: cumpleParcialPctFromExcel }),
    ...(noCumplePctFromExcel !== null && { noCumplePct: noCumplePctFromExcel }),
    ...(noAplicaPctFromExcel !== null && { noAplicaPct: noAplicaPctFromExcel }),
  }
}

function extractValue(text: string, key: string): string {
  const parts = text.split(key)
  if (parts.length < 2) return ""

  let value = parts[1].trim()
  
  // Limpiar hasta el siguiente campo o hasta un salto de línea lógico
  const nextFields = ["Fecha:", "Auditor:", "Cliente:", "Responsable de la Operación:", "Responsable:", "Operación:", "Operacion:"]
  for (const field of nextFields) {
    if (field !== key && value.includes(field)) {
      value = value.split(field)[0].trim()
    }
  }
  
  // También limpiar si hay múltiples espacios o caracteres especiales al final
  value = value.replace(/\s+/g, " ").trim()
  
  return value
}

function parseFecha(fechaStr: string): Date {
  if (!fechaStr || fechaStr.trim().length === 0) {
    return new Date()
  }
  
  // Limpiar el string de fecha
  let cleaned = fechaStr.trim()
  
  // Intentar parsear formato de texto en español: "20 de agosto del 2025" o "20 de agosto de 2025"
  const fechaEspanol = parseFechaEspanol(cleaned)
  if (fechaEspanol) {
    return fechaEspanol
  }
  
  // Si parece ser un número serial de Excel (muy grande), intentar convertirlo
  const numValue = Number.parseFloat(cleaned)
  if (!isNaN(numValue) && numValue > 40000 && numValue < 100000) {
    // Es probablemente un serial de Excel (días desde 1900-01-01)
    // Excel cuenta desde 1900-01-01, pero tiene un bug donde cuenta 1900 como año bisiesto
    // La fórmula correcta: Excel epoch es 30 de diciembre de 1899
    const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899
    const date = new Date(excelEpoch.getTime() + (numValue - 1) * 24 * 60 * 60 * 1000)
    
    // Validar que la fecha sea razonable
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100) {
      return date
    } else {
      console.warn(`Número serial de Excel inválido: ${numValue} -> ${date.toLocaleDateString()}`)
    }
  }
  
  // Intentar diferentes formatos de fecha
  cleaned = cleaned.replace(/[^\d/\-]/g, "").trim()
  
  // Formato: DD/MM/YYYY (formato argentino/español)
  const parts = cleaned.split(/[\/\-]/)
  if (parts.length === 3) {
    const part1 = Number.parseInt(parts[0])
    const part2 = Number.parseInt(parts[1])
    let part3 = Number.parseInt(parts[2])
    
    // Manejar años de 2 dígitos (25 -> 2025, 24 -> 2024)
    if (part3 < 100) {
      if (part3 < 50) {
        part3 = 2000 + part3 // 00-49 -> 2000-2049
      } else {
        part3 = 1900 + part3 // 50-99 -> 1950-1999
      }
    }
    
    // Validar que los números sean razonables
    if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12 && part3 >= 2000 && part3 < 2100) {
      // SIEMPRE asumir formato DD/MM/YYYY (formato argentino/español)
      // Día en part1, Mes en part2, Año en part3
      const parsedDate = new Date(part3, part2 - 1, part1)
      
      // Validar que la fecha creada sea correcta (evitar rollover de días)
      if (parsedDate.getDate() === part1 && parsedDate.getMonth() === part2 - 1 && parsedDate.getFullYear() === part3) {
        return parsedDate
      } else {
        console.warn(`Fecha inválida (rollover detectado): ${part1}/${part2}/${part3} -> ${parsedDate.toLocaleDateString()}`)
      }
    }
  }
  
  // NO usar new Date(fechaStr) directamente porque puede interpretar como MM/DD/YYYY
  // En su lugar, si llegamos aquí, devolver una fecha por defecto y registrar un warning
  console.warn(`No se pudo parsear la fecha: "${fechaStr}"`)
  return new Date()
}

function parseFechaEspanol(fechaStr: string): Date | null {
  // Normalizar el string: convertir a minúsculas y limpiar espacios extra
  const normalized = fechaStr.toLowerCase().trim().replace(/\s+/g, " ")
  
  // Mapeo de meses en español
  const meses: Record<string, number> = {
    "enero": 0,
    "febrero": 1,
    "marzo": 2,
    "abril": 3,
    "mayo": 4,
    "junio": 5,
    "julio": 6,
    "agosto": 7,
    "septiembre": 8,
    "octubre": 9,
    "noviembre": 10,
    "diciembre": 11,
  }
  
  // Patrones comunes:
  // "20 de agosto del 2025"
  // "20 de agosto de 2025"
  // "20 agosto 2025"
  // "20/agosto/2025"
  
  // Buscar patrón: número + "de" + mes + "de"/"del" + año
  const patron1 = /(\d{1,2})\s+de\s+(\w+)\s+(?:del\s+|de\s+)?(\d{4})/
  const match1 = normalized.match(patron1)
  if (match1) {
    const dia = Number.parseInt(match1[1], 10)
    const mesNombre = match1[2]
    const año = Number.parseInt(match1[3], 10)
    
    if (meses[mesNombre] !== undefined && dia >= 1 && dia <= 31 && año > 2000 && año < 2100) {
      return new Date(año, meses[mesNombre], dia)
    }
  }
  
  // Buscar patrón: número + mes + año (sin "de")
  const patron2 = /(\d{1,2})\s+(\w+)\s+(\d{4})/
  const match2 = normalized.match(patron2)
  if (match2) {
    const dia = Number.parseInt(match2[1], 10)
    const mesNombre = match2[2]
    const año = Number.parseInt(match2[3], 10)
    
    if (meses[mesNombre] !== undefined && dia >= 1 && dia <= 31 && año > 2000 && año < 2100) {
      return new Date(año, meses[mesNombre], dia)
    }
  }
  
  return null
}

function findPregunta(row: any[], preferredCol?: number | null): string {
  // Si tenemos una columna preferida, usarla primero
  if (preferredCol !== undefined && preferredCol !== null && preferredCol >= 0 && row[preferredCol] !== undefined && row[preferredCol] !== null) {
    const cellValue = row[preferredCol]
    if (typeof cellValue === "string") {
      const text = String(cellValue).trim()
      // Pregunta es texto, puede tener "¿" o empezar con espacios y "¿", o ser texto largo
      if (text.length >= 5 && text !== "x" && text !== "X" && !/^\d+$/.test(text) && text.toLowerCase() !== "na") {
        // Si tiene "¿" o "?" es muy probable que sea una pregunta
        if (text.includes("¿") || text.includes("?")) {
          return text
        }
        // Si es texto largo (más de 15 caracteres) probablemente es una pregunta
        if (text.length > 15) {
          return text
        }
      }
    }
  }

  // Buscar en las columnas 1 y 2 principalmente (la 0 suele ser el número de item)
  const searchCols = preferredCol !== undefined && preferredCol !== null 
    ? [preferredCol, 1, 2, 0, 3, 4] 
    : [1, 2, 0, 3, 4, 5]
  
  for (const i of searchCols) {
    if (i >= 0 && i < row.length && row[i] !== undefined && row[i] !== null) {
      const cellValue = row[i]
      if (typeof cellValue === "string") {
        const text = String(cellValue).trim()
        // Pregunta es texto (más de 5 caracteres) que no es un número ni "x"
        if (text.length >= 5 && !/^\d+$/.test(text) && text !== "x" && text !== "X" && text.toLowerCase() !== "na") {
          // Si tiene "¿" o "?" es muy probable que sea una pregunta
          if (text.includes("¿") || text.includes("?")) {
            return text
          }
          // Si es texto largo (más de 20 caracteres) probablemente es una pregunta
          if (text.length > 20) {
            return text
          }
        }
      }
    }
  }
  return ""
}

function detectEstado(row: any[], columnMapping: ColumnMapping): AuditStatus | null {
  // Usar el mapeo de columnas para detectar el estado correctamente
  const checks = [
    { col: columnMapping.cumple, estado: "Cumple" as AuditStatus },
    { col: columnMapping.cumpleParcial, estado: "Cumple parcialmente" as AuditStatus },
    { col: columnMapping.noCumple, estado: "No cumple" as AuditStatus },
    { col: columnMapping.noAplica, estado: "No aplica" as AuditStatus },
  ]

  // Verificar cada columna de estado en orden de prioridad
  for (const check of checks) {
    if (check.col !== null && check.col < row.length) {
      const cell = String(row[check.col] || "").trim().toLowerCase()
      if (cell === "x" || cell === "X" || cell === "✓" || cell === "v" || cell === "si" || cell === "sí") {
        return check.estado
      }
    }
  }

  // Si no encontramos con el mapeo, buscar cualquier "x" en el rango esperado
  const startCol = Math.min(
    columnMapping.cumple ?? 0,
    columnMapping.cumpleParcial ?? 0,
    columnMapping.noCumple ?? 0,
    columnMapping.noAplica ?? 0,
  )
  const endCol = Math.max(
    columnMapping.cumple ?? row.length,
    columnMapping.cumpleParcial ?? row.length,
    columnMapping.noCumple ?? row.length,
    columnMapping.noAplica ?? row.length,
  )

  for (let i = startCol; i <= endCol && i < row.length; i++) {
    const cell = String(row[i] || "").trim().toLowerCase()
    if (cell === "x" || cell === "X") {
      // Asignar según posición relativa
      if (columnMapping.cumple !== null && i === columnMapping.cumple) {
        return "Cumple"
      } else if (columnMapping.cumpleParcial !== null && i === columnMapping.cumpleParcial) {
        return "Cumple parcialmente"
      } else if (columnMapping.noCumple !== null && i === columnMapping.noCumple) {
        return "No cumple"
      } else if (columnMapping.noAplica !== null && i === columnMapping.noAplica) {
        return "No aplica"
      }
    }
  }

  return null
}

function findObservacion(row: any[]): string {
  // Buscar en las últimas columnas texto largo
  for (let i = Math.max(0, row.length - 6); i < row.length; i++) {
    if (row[i] && typeof row[i] === "string") {
      const text = String(row[i]).trim()
      if (text.length > 10) {
        return text
      }
    }
  }
  return ""
}
