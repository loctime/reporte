/**
 * Sistema de configuración flexible para Excel
 * Permite definir campos personalizados con nombres del usuario
 */

export type FieldType = "cell" | "column" | "row"

export interface ExcelField {
  id: string // ID único del campo
  name: string // Nombre personalizado del campo (ej: "Operación", "Responsable", "Fecha")
  type: FieldType // Tipo: celda individual, columna completa, o fila completa
  location: {
    row: number // Fila (índice base 0)
    col: number // Columna (índice base 0)
  }
  required: boolean // Si es requerido o opcional
  dataType?: "text" | "number" | "date" | "percentage" // Tipo de dato esperado
}

export interface ExcelColumnMapping {
  // Columnas de estados (requeridas)
  pregunta: number // Columna con las preguntas/items
  cumple: number // Columna "Cumple"
  cumpleParcial: number // Columna "Cumple Parcial"
  noCumple: number // Columna "No Cumple"
  noAplica: number // Columna "No Aplica"
  observacion: number | null // Columna de observaciones (opcional)
  headerRowIndex: number // Fila donde está el encabezado de la tabla
}

export interface ExcelConfig {
  // Mapeo de columnas de la tabla de items
  columnMapping: ExcelColumnMapping
  
  // Campos personalizados (metadatos, estadísticas, etc.)
  customFields: ExcelField[]
  
  // Versión de la configuración (para migraciones futuras)
  version: string
}

const CONFIG_STORAGE_KEY = "excel-config-v2"

/**
 * Guarda la configuración en localStorage
 */
export function saveExcelConfig(config: ExcelConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  }
}

/**
 * Carga la configuración desde localStorage
 */
export function loadExcelConfig(): ExcelConfig | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored) as ExcelConfig
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Limpia la configuración guardada
 */
export function clearExcelConfig(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  }
}

/**
 * Valida que la configuración tenga todos los campos requeridos
 */
export function validateExcelConfig(config: ExcelConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validar columnas requeridas
  if (config.columnMapping.pregunta === undefined || config.columnMapping.pregunta === null) {
    errors.push("La columna de 'Pregunta' es requerida")
  }
  if (config.columnMapping.cumple === undefined || config.columnMapping.cumple === null) {
    errors.push("La columna 'Cumple' es requerida")
  }
  if (config.columnMapping.cumpleParcial === undefined || config.columnMapping.cumpleParcial === null) {
    errors.push("La columna 'Cumple Parcial' es requerida")
  }
  if (config.columnMapping.noCumple === undefined || config.columnMapping.noCumple === null) {
    errors.push("La columna 'No Cumple' es requerida")
  }
  if (config.columnMapping.noAplica === undefined || config.columnMapping.noAplica === null) {
    errors.push("La columna 'No Aplica' es requerida")
  }
  if (config.columnMapping.headerRowIndex === undefined || config.columnMapping.headerRowIndex === null) {
    errors.push("La fila de encabezado es requerida")
  }

  // Validar campos personalizados requeridos
  const requiredFields = config.customFields.filter((f) => f.required)
  for (const field of requiredFields) {
    if (!field.name || field.name.trim().length === 0) {
      errors.push(`El campo requerido '${field.id}' debe tener un nombre`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Busca un campo personalizado por nombre
 */
export function findCustomField(config: ExcelConfig, name: string): ExcelField | undefined {
  return config.customFields.find((f) => f.name.toLowerCase() === name.toLowerCase())
}

/**
 * Busca un campo personalizado por ID
 */
export function findCustomFieldById(config: ExcelConfig, id: string): ExcelField | undefined {
  return config.customFields.find((f) => f.id === id)
}

/**
 * Crea una configuración por defecto vacía
 */
export function createDefaultConfig(): ExcelConfig {
  return {
    columnMapping: {
      pregunta: -1,
      cumple: -1,
      cumpleParcial: -1,
      noCumple: -1,
      noAplica: -1,
      observacion: null,
      headerRowIndex: -1,
    },
    customFields: [],
    version: "2.0",
  }
}
