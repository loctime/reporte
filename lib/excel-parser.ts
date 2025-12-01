import * as XLSX from "xlsx"
import type { AuditFile, AuditItem, AuditStatus } from "./types"

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

    if (rowText.includes("operación:") || rowText.includes("operacion:")) {
      operacion = extractValue(row.join(" "), "Operación:") || extractValue(row.join(" "), "Operacion:")
    }
    if (rowText.includes("responsable")) {
      responsable = extractValue(row.join(" "), "Responsable de la Operación:") || 
                    extractValue(row.join(" "), "Responsable:")
    }
    if (rowText.includes("cliente:")) {
      cliente = extractValue(row.join(" "), "Cliente:")
    }
    if (rowText.includes("fecha:")) {
      const fechaStr = extractValue(row.join(" "), "Fecha:")
      fecha = parseFecha(fechaStr)
    }
    if (rowText.includes("auditor:")) {
      auditor = extractValue(row.join(" "), "Auditor:")
    }
  }

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
        
        // Detectar columna de pregunta
        if (!columnMapping.pregunta && (cell.includes("pregunta") || cell.includes("item") || cell.includes("criterio"))) {
          columnMapping.pregunta = col
        }
        
        // Detectar columnas de estado
        if (cell.includes("cumple") && !cell.includes("parcial") && !cell.includes("no")) {
          if (!columnMapping.cumple) columnMapping.cumple = col
        } else if (cell.includes("parcial") || cell.includes("cp")) {
          if (!columnMapping.cumpleParcial) columnMapping.cumpleParcial = col
        } else if (cell.includes("no cumple") || cell.includes("nc") || (cell.includes("no") && cell.includes("cumple"))) {
          if (!columnMapping.noCumple) columnMapping.noCumple = col
        } else if (cell.includes("no aplica") || cell.includes("na") || (cell.includes("no") && cell.includes("aplica"))) {
          if (!columnMapping.noAplica) columnMapping.noAplica = col
        }
        
        // Detectar columna de observación
        if (!columnMapping.observacion && (cell.includes("observación") || cell.includes("observacion") || cell.includes("comentario"))) {
          columnMapping.observacion = col
        }
      }
      
      // Si no encontramos las columnas por nombre, usar detección por posición
      if (!columnMapping.cumple && !columnMapping.cumpleParcial && !columnMapping.noCumple && !columnMapping.noAplica) {
        // Buscar columnas con "x" en las primeras filas de datos para inferir posiciones
        for (let testRow = i + 1; testRow < Math.min(i + 5, jsonData.length); testRow++) {
          const testData = jsonData[testRow]
          if (!testData) continue
          
          for (let col = 0; col < testData.length; col++) {
            const cell = String(testData[col] || "").trim().toLowerCase()
            if (cell === "x" || cell === "X") {
              // Asignar según orden típico si no tenemos mapeo
              if (columnMapping.cumple === null) {
                columnMapping.cumple = col
              } else if (columnMapping.cumpleParcial === null && col !== columnMapping.cumple) {
                columnMapping.cumpleParcial = col
              } else if (columnMapping.noCumple === null && col !== columnMapping.cumple && col !== columnMapping.cumpleParcial) {
                columnMapping.noCumple = col
              } else if (columnMapping.noAplica === null && col !== columnMapping.cumple && col !== columnMapping.cumpleParcial && col !== columnMapping.noCumple) {
                columnMapping.noAplica = col
              }
            }
          }
        }
      }
      
      break
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("No se encontró la estructura de la tabla de auditoría")
  }

  // Si no encontramos columna de pregunta, buscar en las primeras columnas
  if (columnMapping.pregunta === null) {
    for (let col = 0; col < Math.min(5, jsonData[headerRowIndex]?.length || 0); col++) {
      const cell = String(jsonData[headerRowIndex]?.[col] || "").toLowerCase()
      if (cell.includes("pregunta") || cell.includes("item") || cell.length === 0) {
        columnMapping.pregunta = col
        break
      }
    }
    // Si aún no encontramos, usar columna 0 o 1 por defecto
    if (columnMapping.pregunta === null) {
      columnMapping.pregunta = 0
    }
  }

  // Procesar items
  const items: AuditItem[] = []
  let currentCategoria = ""
  let itemCounter = 0

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || row.length === 0) continue

    // Detectar categoría (filas con número y texto en mayúsculas o texto largo sin pregunta)
    if (row[0] && typeof row[0] === "number" && row[1] && typeof row[1] === "string") {
      const possibleCategoria = String(row[1]).trim()
      const upperCategoria = possibleCategoria.toUpperCase()
      // Es categoría si es texto largo en mayúsculas o no tiene signo de interrogación
      if (possibleCategoria.length > 10 && (upperCategoria === possibleCategoria || !possibleCategoria.includes("¿"))) {
        currentCategoria = possibleCategoria
        continue
      }
    }

    // Obtener pregunta
    const preguntaCol = columnMapping.pregunta ?? 0
    const pregunta = findPregunta(row, preguntaCol)
    if (!pregunta || pregunta.length < 10) continue

    // Detectar estado usando el mapeo de columnas
    const estado = detectEstado(row, columnMapping)
    if (!estado) continue

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

  // Calcular estadísticas
  const cumple = items.filter((i) => i.estado === "Cumple").length
  const cumpleParcial = items.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumple = items.filter((i) => i.estado === "No cumple").length
  const noAplica = items.filter((i) => i.estado === "No aplica").length
  const itemsEvaluados = items.length - noAplica
  const cumplimiento = itemsEvaluados > 0 ? ((cumple + cumpleParcial * 0.5) / itemsEvaluados) * 100 : 0

  return {
    fileName: file.name,
    operacion,
    responsable,
    cliente,
    fecha,
    auditor,
    items,
    cumplimiento: Number.parseFloat(cumplimiento.toFixed(2)), // Redondear a 2 decimales
    totalItems: items.length,
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
  // Limpiar hasta el siguiente campo
  const nextFields = ["Fecha:", "Auditor:", "Cliente:", "Responsable", "Operación:", "Operacion:"]
  for (const field of nextFields) {
    if (value.includes(field)) {
      value = value.split(field)[0].trim()
    }
  }
  return value
}

function parseFecha(fechaStr: string): Date {
  // Intentar diferentes formatos de fecha
  const cleaned = fechaStr.replace(/[^\d/\-]/g, "").trim()
  
  // Formato: MM/DD/YYYY o DD/MM/YYYY
  const parts = cleaned.split(/[\/\-]/)
  if (parts.length === 3) {
    const part1 = Number.parseInt(parts[0])
    const part2 = Number.parseInt(parts[1])
    const part3 = Number.parseInt(parts[2])
    
    // Si el primer número es > 12, asumir formato DD/MM/YYYY
    if (part1 > 12) {
      return new Date(part3, part2 - 1, part1)
    } else {
      // Asumir MM/DD/YYYY
      return new Date(part3, part1 - 1, part2)
    }
  }
  
  // Intentar parsear directamente
  const parsed = new Date(fechaStr)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }
  
  return new Date()
}

function findPregunta(row: any[], preferredCol?: number): string {
  // Si tenemos una columna preferida, usarla primero
  if (preferredCol !== undefined && row[preferredCol] && typeof row[preferredCol] === "string") {
    const text = String(row[preferredCol]).trim()
    if (text.length > 10) {
      return text
    }
  }

  // Buscar en las primeras columnas
  for (let i = 0; i < Math.min(6, row.length); i++) {
    if (row[i] && typeof row[i] === "string") {
      const text = String(row[i]).trim()
      // Pregunta es texto largo (más de 15 caracteres) y puede tener signo de interrogación
      if (text.length > 15) {
        return text
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
