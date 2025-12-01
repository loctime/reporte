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

  // Verificar si hay configuración guardada
  const savedConfig = loadColumnConfig()
  
  // Encontrar la fila de encabezados de la tabla
  let headerRowIndex = -1
  let columnMapping: ColumnMapping = {
    pregunta: null,
    cumple: null,
    cumpleParcial: null,
    noCumple: null,
    noAplica: null,
    observacion: null,
  }

  // Si hay configuración guardada, usarla directamente
  if (savedConfig) {
    headerRowIndex = savedConfig.headerRowIndex
    columnMapping = {
      pregunta: savedConfig.pregunta,
      cumple: savedConfig.cumple,
      cumpleParcial: savedConfig.cumpleParcial,
      noCumple: savedConfig.noCumple,
      noAplica: savedConfig.noAplica,
      observacion: savedConfig.observacion,
    }
  }

  // Solo buscar encabezados si no hay configuración guardada
  if (!savedConfig) {
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row) continue

      // Buscar fila que contenga encabezados de estado
      const rowText = row.map((cell) => String(cell || "").toLowerCase()).join(" ")
      
      if (rowText.includes("cumple") || rowText.includes("items") || rowText.includes("pregunta")) {
        headerRowIndex = i
      
        // Detectar columnas basándose en los encabezados
        for (let col = 0; col < row.length; col++) {
          const cell = String(row[col] || "").toLowerCase().trim()
          
          // Detectar columna de pregunta - puede ser "PUNTOS DE CHEQUEO", "PREGUNTA", etc.
          if (!columnMapping.pregunta && (
            cell.includes("pregunta") || 
            cell.includes("chequeo") || 
            cell.includes("puntos") ||
            cell.includes("item") && !cell.includes("items") ||
            cell.includes("criterio")
          )) {
            columnMapping.pregunta = col
          }
          
          // Detectar columnas de estado - orden específico para evitar conflictos
          // Primero buscar las más específicas (las que contienen múltiples palabras)
          const cellNormalized = cell.replace(/\s+/g, " ").trim()
          
          if (cellNormalized.includes("no aplica") || cellNormalized === "na" || 
              (cellNormalized.includes("no") && cellNormalized.includes("aplica") && !cellNormalized.includes("cumple"))) {
            if (columnMapping.noAplica === null) columnMapping.noAplica = col
          } else if (cellNormalized.includes("no cumple") || cellNormalized === "nc" || 
                     (cellNormalized.includes("no") && cellNormalized.includes("cumple"))) {
            if (columnMapping.noCumple === null) columnMapping.noCumple = col
          } else if (cellNormalized.includes("parcial") || cellNormalized.includes("cp") || 
                     cellNormalized.includes("cumple parcial") || cellNormalized === "cumple parcial") {
            if (columnMapping.cumpleParcial === null) columnMapping.cumpleParcial = col
          } else if (cellNormalized === "cumple" || 
                     (cellNormalized.includes("cumple") && !cellNormalized.includes("parcial") && !cellNormalized.includes("no"))) {
            if (columnMapping.cumple === null) columnMapping.cumple = col
          }
          
          // Detectar columna de observación
          if (!columnMapping.observacion && (cell.includes("observación") || cell.includes("observacion") || cell.includes("comentario"))) {
            columnMapping.observacion = col
          }
        }
        
        // Si faltan algunas columnas, usar detección por posición en las primeras filas de datos
        if (columnMapping.cumple === null || columnMapping.cumpleParcial === null || 
            columnMapping.noCumple === null || columnMapping.noAplica === null) {
          // Buscar columnas con "x" en las primeras filas de datos para inferir posiciones faltantes
          for (let testRow = i + 1; testRow < Math.min(i + 10, jsonData.length); testRow++) {
            const testData = jsonData[testRow]
            if (!testData) continue
            
            // Saltar filas que son categorías o resúmenes
            const firstCell = String(testData[0] || "").trim()
            if (firstCell.length > 0 && !/^\d+$/.test(firstCell) && firstCell.toUpperCase() === firstCell && firstCell.length > 10) {
              continue
            }
            
            for (let col = 0; col < testData.length; col++) {
              const cell = String(testData[col] || "").trim().toLowerCase()
              if (cell === "x" || cell === "X") {
                // Asignar según orden típico si no tenemos mapeo para esa columna
                if (columnMapping.cumple === null && col >= 2) {
                  columnMapping.cumple = col
                } else if (columnMapping.cumpleParcial === null && col > (columnMapping.cumple ?? 0) && col < 10) {
                  columnMapping.cumpleParcial = col
                } else if (columnMapping.noCumple === null && col > (columnMapping.cumpleParcial ?? columnMapping.cumple ?? 0) && col < 10) {
                  columnMapping.noCumple = col
                } else if (columnMapping.noAplica === null && col > (columnMapping.noCumple ?? columnMapping.cumpleParcial ?? columnMapping.cumple ?? 0) && col < 10) {
                  columnMapping.noAplica = col
                }
              }
            }
            
            // Si ya encontramos todas las columnas, salir
            if (columnMapping.cumple !== null && columnMapping.cumpleParcial !== null && 
                columnMapping.noCumple !== null && columnMapping.noAplica !== null) {
              break
            }
          }
        }
        
        break
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("No se encontró la estructura de la tabla de auditoría")
  }

  // Buscar columna de cumplimiento en el Excel
  let cumplimientoCol: number | null = null
  
  // Si hay configuración guardada, usar la columna configurada
  if (savedConfig && savedConfig.cumplimientoCol !== null) {
    cumplimientoCol = savedConfig.cumplimientoCol
  } else {
    // Buscar automáticamente en los encabezados
    const headerRow = jsonData[headerRowIndex]
    if (headerRow) {
      for (let col = 0; col < headerRow.length; col++) {
        const cell = String(headerRow[col] || "").toLowerCase().trim()
        if (cell.includes("% de cumplimiento") || cell.includes("cumplimiento") || cell.includes("% cumplimiento")) {
          cumplimientoCol = col
          break
        }
      }
    }
  }

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

  // Leer estadísticas del Excel usando la configuración
  const totalItemsFromExcel = savedConfig?.totalItemsCell ? readCellValue(savedConfig.totalItemsCell) : null
  const cumpleFromExcel = savedConfig?.cumpleCell ? readCellValue(savedConfig.cumpleCell) : null
  const cumpleParcialFromExcel = savedConfig?.cumpleParcialCell ? readCellValue(savedConfig.cumpleParcialCell) : null
  const noCumpleFromExcel = savedConfig?.noCumpleCell ? readCellValue(savedConfig.noCumpleCell) : null
  const noAplicaFromExcel = savedConfig?.noAplicaCell ? readCellValue(savedConfig.noAplicaCell) : null

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
  
  // Si parece ser un número serial de Excel (muy grande), intentar convertirlo
  const numValue = Number.parseFloat(cleaned)
  if (!isNaN(numValue) && numValue > 40000 && numValue < 100000) {
    // Es probablemente un serial de Excel (días desde 1900-01-01)
    // Excel cuenta desde 1900-01-01, pero tiene un bug donde cuenta 1900 como año bisiesto
    const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899
    const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000)
    if (date.getFullYear() > 2000 && date.getFullYear() < 2100) {
      return date
    }
  }
  
  // Intentar diferentes formatos de fecha
  cleaned = cleaned.replace(/[^\d/\-]/g, "").trim()
  
  // Formato: MM/DD/YYYY o DD/MM/YYYY
  const parts = cleaned.split(/[\/\-]/)
  if (parts.length === 3) {
    const part1 = Number.parseInt(parts[0])
    const part2 = Number.parseInt(parts[1])
    const part3 = Number.parseInt(parts[2])
    
    // Validar que los números sean razonables
    if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12 && part3 > 2000 && part3 < 2100) {
      // Si el primer número es > 12, asumir formato DD/MM/YYYY
      if (part1 > 12) {
        return new Date(part3, part2 - 1, part1)
      } else {
        // Asumir MM/DD/YYYY (formato común en Excel)
        return new Date(part3, part1 - 1, part2)
      }
    }
  }
  
  // Intentar parsear directamente
  const parsed = new Date(fechaStr)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
    return parsed
  }
  
  return new Date()
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
