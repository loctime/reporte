export type AuditStatus = "Cumple" | "Cumple parcialmente" | "No cumple" | "No aplica"

export interface AuditItem {
  id: string
  operacion: string
  responsable: string
  cliente: string
  fecha: Date
  auditor: string
  categoria: string
  item: string
  pregunta: string
  estado: AuditStatus
  observacion: string
  oportunidadMejora: string
  normativa: string
}

export interface AuditFile {
  fileName: string
  operacion: string
  responsable: string
  cliente: string
  fecha: Date
  auditor: string
  items: AuditItem[]
  cumplimiento: number
  totalItems: number
  cumple: number
  cumpleParcial: number
  noCumple: number
  noAplica: number
  // Porcentajes leídos desde Excel (opcionales)
  cumplePct?: number
  cumpleParcialPct?: number
  noCumplePct?: number
  noAplicaPct?: number
}

export interface AuditStats {
  totalAuditorias: number
  totalItems: number
  cumplimientoPromedio: number
  cumple: number
  cumpleParcial: number
  noCumple: number
  noAplica: number
  porOperacion: Record<
    string,
    {
      total: number
      cumplimiento: number
      auditorias: number
    }
  >
  porAuditor: Record<
    string,
    {
      total: number
      cumplimiento: number
      auditorias: number
    }
  >
  porMes: Record<
    string,
    {
      total: number
      cumplimiento: number
      auditorias: number
    }
  >
  itemsMasProblematicos: Array<{
    pregunta: string
    categoria: string
    noCumple: number
    frecuencia: number
  }>
}
