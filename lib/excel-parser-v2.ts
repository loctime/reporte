import * as XLSX from "xlsx"
import type { AuditFile, AuditItem, AuditStatus } from "./types"
import { loadExcelConfig, findCustomField, type ExcelConfig } from "./excel-config"
import { formatDate } from "./utils"

/**
 * Nuevo parser de Excel que usa la configuración flexible
 * Sin hardcodeo - todo se basa en la configuración del usuario
 */
export async function parseExcelFileV2(file: File): Promise<AuditFile> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: "array" })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

  // Convertir a JSON con header en fila 0
  const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

  // Cargar configuración
  const config = loadExcelConfig()

  if (!config) {
    throw new Error(
      "No hay configuración de Excel guardada. Por favor, configura las columnas y campos primero."
    )
  }

  // Validar configuración
  const validation = {
    valid: true,
    errors: [] as string[],
  }

  if (config.columnMapping.pregunta < 0) {
    validation.errors.push("La columna de 'Pregunta' no está configurada")
    validation.valid = false
  }
  if (config.columnMapping.cumple < 0) {
    validation.errors.push("La columna 'Cumple' no está configurada")
    validation.valid = false
  }
  if (config.columnMapping.cumpleParcial < 0) {
    validation.errors.push("La columna 'Cumple Parcial' no está configurada")
    validation.valid = false
  }
  if (config.columnMapping.noCumple < 0) {
    validation.errors.push("La columna 'No Cumple' no está configurada")
    validation.valid = false
  }
  if (config.columnMapping.noAplica < 0) {
    validation.errors.push("La columna 'No Aplica' no está configurada")
    validation.valid = false
  }
  if (config.columnMapping.headerRowIndex < 0) {
    validation.errors.push("La fila de encabezado no está configurada")
    validation.valid = false
  }

  if (!validation.valid) {
    throw new Error("Configuración incompleta: " + validation.errors.join(", "))
  }

  // Función para leer una celda específica
  const readCell = (row: number, col: number): any => {
    if (row < 0 || row >= jsonData.length) return null
    const rowData = jsonData[row]
    if (!rowData || col < 0 || col >= rowData.length) return null
    return rowData[col]
  }

  // Función para leer una celda como string
  const readCellString = (row: number, col: number): string => {
    const value = readCell(row, col)
    if (value === null || value === undefined) return ""
    return String(value).trim()
  }

  // Función para leer una celda como fecha
  const readCellDate = (row: number, col: number): Date => {
    const value = readCell(row, col)
    if (value === null || value === undefined) return new Date()

    // Si es un número, podría ser un serial de Excel
    if (typeof value === "number") {
      if (value > 0 && value < 100000) {
        // Serial de Excel
        const excelEpoch = new Date(1899, 11, 30)
        const jsDate = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000)
        if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 2000 && jsDate.getFullYear() < 2100) {
          return jsDate
        }
      }
    }

    // Intentar parsear como string
    const dateStr = String(value).trim()
    if (dateStr.length > 0) {
      // Usar la función formatDate que ya existe para parsear
      const parsed = parseDateString(dateStr)
      if (parsed && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
        return parsed
      }
    }

    return new Date()
  }

  // Función para leer una celda como número
  const readCellNumber = (row: number, col: number): number | null => {
    const value = readCell(row, col)
    if (value === null || value === undefined || value === "") return null

    if (typeof value === "number") {
      return value
    }

    const numValue = Number.parseFloat(String(value).replace(",", "."))
    if (!isNaN(numValue)) {
      return numValue
    }

    return null
  }

  // Leer campos personalizados
  const customFieldValues: Record<string, any> = {}
  config.customFields.forEach((field) => {
    if (field.type === "cell") {
      const value = readCell(field.location.row, field.location.col)
      if (value !== null && value !== undefined && value !== "") {
        // Determinar el tipo de dato
        if (field.dataType === "date") {
          customFieldValues[field.name] = readCellDate(field.location.row, field.location.col)
        } else if (field.dataType === "number" || field.dataType === "percentage") {
          customFieldValues[field.name] = readCellNumber(field.location.row, field.location.col)
        } else {
          customFieldValues[field.name] = readCellString(field.location.row, field.location.col)
        }
      } else if (field.required) {
        throw new Error(`El campo requerido '${field.name}' está vacío en la celda configurada`)
      }
    } else if (field.type === "column") {
      // Para columnas, leer el valor de la fila de encabezado o la primera fila de datos
      const value = readCellString(field.location.row, field.location.col)
      if (value) {
        customFieldValues[field.name] = value
      } else if (field.required) {
        throw new Error(`El campo requerido '${field.name}' está vacío en la columna configurada`)
      }
    }
  })

  // Extraer valores comunes usando campos personalizados (si están configurados)
  const operacion = findCustomField(config, "operación") || findCustomField(config, "operacion")
    ? customFieldValues["Operación"] || customFieldValues["operación"] || customFieldValues["Operacion"] || customFieldValues["operacion"] || ""
    : ""
  
  const responsable = findCustomField(config, "responsable")
    ? customFieldValues["Responsable"] || customFieldValues["responsable"] || ""
    : ""
  
  const cliente = findCustomField(config, "cliente")
    ? customFieldValues["Cliente"] || customFieldValues["cliente"] || ""
    : ""
  
  const fecha = findCustomField(config, "fecha")
    ? (customFieldValues["Fecha"] || customFieldValues["fecha"] || new Date())
    : new Date()
  
  const auditor = findCustomField(config, "auditor")
    ? customFieldValues["Auditor"] || customFieldValues["auditor"] || ""
    : ""

  // Validar que fecha sea válida
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) {
    throw new Error("No se pudo leer la fecha. Por favor, verifica la configuración del campo 'Fecha'.")
  }

  // Procesar items de la tabla
  const items: AuditItem[] = []
  const headerRowIndex = config.columnMapping.headerRowIndex
  let currentCategoria = ""
  let itemCounter = 0

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || row.length === 0) continue

    // Detectar categoría (filas con número en columna 0 y texto largo en mayúsculas)
    if (row[0] && (typeof row[0] === "number" || (typeof row[0] === "string" && /^\d+$/.test(String(row[0]))))) {
      if (row[1] && typeof row[1] === "string") {
        const possibleCategoria = String(row[1]).trim()
        const upperCategoria = possibleCategoria.toUpperCase()
        if (
          possibleCategoria.length > 10 &&
          (upperCategoria === possibleCategoria || !possibleCategoria.includes("¿")) &&
          !possibleCategoria.toLowerCase().includes("x") &&
          !possibleCategoria.includes("?")
        ) {
          currentCategoria = possibleCategoria
          continue
        }
      }
    }

    // Obtener pregunta
    const preguntaCol = config.columnMapping.pregunta
    let pregunta = readCellString(i, preguntaCol)

    if (!pregunta || pregunta.length < 5) {
      continue
    }

    // Detectar estado usando las columnas configuradas
    const estado = detectEstado(row, config.columnMapping)
    if (!estado) {
      continue
    }

    itemCounter++

    // Obtener observación
    const observacionCol = config.columnMapping.observacion
    const observacion = observacionCol !== null ? readCellString(i, observacionCol) : ""

    items.push({
      id: `${file.name}-${itemCounter}`,
      operacion,
      responsable,
      cliente,
      fecha: fecha instanceof Date ? fecha : new Date(),
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
  const totalItems = items.length
  const cumple = items.filter((i) => i.estado === "Cumple").length
  const cumpleParcial = items.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumple = items.filter((i) => i.estado === "No cumple").length
  const noAplica = items.filter((i) => i.estado === "No aplica").length
  const itemsEvaluados = totalItems - noAplica

  // Calcular cumplimiento
  const cumplimiento =
    itemsEvaluados > 0 ? ((cumple + cumpleParcial * 0.5) / itemsEvaluados) * 100 : 0

  return {
    fileName: file.name,
    operacion,
    responsable,
    cliente,
    fecha: fecha instanceof Date ? fecha : new Date(),
    auditor,
    items,
    cumplimiento: Number.parseFloat(cumplimiento.toFixed(2)),
    totalItems,
    cumple,
    cumpleParcial,
    noCumple,
    noAplica,
  }
}

/**
 * Detecta el estado de un item basándose en las columnas configuradas
 */
function detectEstado(row: any[], columnMapping: ExcelConfig["columnMapping"]): AuditStatus | null {
  const checks = [
    { col: columnMapping.cumple, estado: "Cumple" as AuditStatus },
    { col: columnMapping.cumpleParcial, estado: "Cumple parcialmente" as AuditStatus },
    { col: columnMapping.noCumple, estado: "No cumple" as AuditStatus },
    { col: columnMapping.noAplica, estado: "No aplica" as AuditStatus },
  ]

  for (const check of checks) {
    if (check.col >= 0 && check.col < row.length) {
      const cell = String(row[check.col] || "").trim().toLowerCase()
      if (cell === "x" || cell === "X" || cell === "✓" || cell === "v" || cell === "si" || cell === "sí") {
        return check.estado
      }
    }
  }

  return null
}

/**
 * Parsea una fecha desde un string
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim().length === 0) {
    return null
  }

  // Limpiar el string
  let cleaned = dateStr.trim()

  // Intentar formato DD/MM/YYYY
  const parts = cleaned.split(/[\/\-]/)
  if (parts.length === 3) {
    const part1 = Number.parseInt(parts[0])
    const part2 = Number.parseInt(parts[1])
    let part3 = Number.parseInt(parts[2])

    // Manejar años de 2 dígitos
    if (part3 < 100) {
      if (part3 < 50) {
        part3 = 2000 + part3
      } else {
        part3 = 1900 + part3
      }
    }

    // Validar y crear fecha en formato DD/MM/YYYY
    if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12 && part3 >= 2000 && part3 < 2100) {
      const parsedDate = new Date(part3, part2 - 1, part1)
      if (
        parsedDate.getDate() === part1 &&
        parsedDate.getMonth() === part2 - 1 &&
        parsedDate.getFullYear() === part3
      ) {
        return parsedDate
      }
    }
  }

  // Intentar parseo estándar
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
    return parsed
  }

  return null
}
