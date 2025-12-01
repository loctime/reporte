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

