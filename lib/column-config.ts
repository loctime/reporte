export interface ColumnConfig {
  pregunta: number
  cumple: number
  cumpleParcial: number
  noCumple: number
  noAplica: number
  observacion: number | null
  headerRowIndex: number
  cumplimientoCol: number | null
  cumplimientoRow: number | null
  // Celdas de estadísticas del Excel (fila y columna, índices base 0)
  totalItemsCell: { row: number; col: number } | null
  cumpleCell: { row: number; col: number } | null
  cumpleParcialCell: { row: number; col: number } | null
  noCumpleCell: { row: number; col: number } | null
  noAplicaCell: { row: number; col: number } | null
  // Celdas de metadatos para vista previa
  operacionCell: { row: number; col: number } | null
  fechaCell: { row: number; col: number } | null
}

const CONFIG_STORAGE_KEY = "excel-column-config"

export function saveColumnConfig(config: ColumnConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  }
}

export function loadColumnConfig(): ColumnConfig | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }
  }
  return null
}

export function clearColumnConfig(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  }
}

