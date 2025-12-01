"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { AuditFile, AuditItem, AuditStats } from "./types"

interface AuditContextType {
  auditFiles: AuditFile[]
  addAuditFiles: (files: AuditFile[]) => void
  clearAuditFiles: () => void
  getAllItems: () => AuditItem[]
  getStats: () => AuditStats
  viewMode: "simple" | "advanced"
  toggleViewMode: () => void
}

const AuditContext = createContext<AuditContextType | undefined>(undefined)

export function AuditProvider({ children }: { children: ReactNode }) {
  const [auditFiles, setAuditFiles] = useState<AuditFile[]>([])
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple")

  const addAuditFiles = (files: AuditFile[]) => {
    setAuditFiles((prev) => [...prev, ...files])
  }

  const clearAuditFiles = () => {
    setAuditFiles([])
  }

  const getAllItems = (): AuditItem[] => {
    return auditFiles.flatMap((file) => file.items)
  }

  const getStats = (): AuditStats => {
    const allItems = getAllItems()
    const totalItems = allItems.length

    const cumple = allItems.filter((i) => i.estado === "Cumple").length
    const cumpleParcial = allItems.filter((i) => i.estado === "Cumple parcialmente").length
    const noCumple = allItems.filter((i) => i.estado === "No cumple").length
    const noAplica = allItems.filter((i) => i.estado === "No aplica").length

    const itemsEvaluados = totalItems - noAplica
    const cumplimientoPromedio = itemsEvaluados > 0 ? ((cumple + cumpleParcial * 0.5) / itemsEvaluados) * 100 : 0

    // Por operacion
    const porOperacion: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      const itemsOp = file.items.filter((i) => i.estado !== "No aplica")
      const cumpleOp = file.items.filter((i) => i.estado === "Cumple" || i.estado === "Cumple parcialmente").length
      const cumplimientoOp = itemsOp.length > 0 ? (cumpleOp / itemsOp.length) * 100 : 0

      if (!porOperacion[file.operacion]) {
        porOperacion[file.operacion] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porOperacion[file.operacion].total += itemsOp.length
      porOperacion[file.operacion].cumplimiento =
        (porOperacion[file.operacion].cumplimiento * porOperacion[file.operacion].auditorias + cumplimientoOp) /
        (porOperacion[file.operacion].auditorias + 1)
      porOperacion[file.operacion].auditorias += 1
    })

    // Por auditor
    const porAuditor: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      const itemsAud = file.items.filter((i) => i.estado !== "No aplica")
      const cumpleAud = file.items.filter((i) => i.estado === "Cumple" || i.estado === "Cumple parcialmente").length
      const cumplimientoAud = itemsAud.length > 0 ? (cumpleAud / itemsAud.length) * 100 : 0

      if (!porAuditor[file.auditor]) {
        porAuditor[file.auditor] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porAuditor[file.auditor].total += itemsAud.length
      porAuditor[file.auditor].cumplimiento =
        (porAuditor[file.auditor].cumplimiento * porAuditor[file.auditor].auditorias + cumplimientoAud) /
        (porAuditor[file.auditor].auditorias + 1)
      porAuditor[file.auditor].auditorias += 1
    })

    // Por mes
    const porMes: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      const mes = `${file.fecha.getFullYear()}-${String(file.fecha.getMonth() + 1).padStart(2, "0")}`
      const itemsMes = file.items.filter((i) => i.estado !== "No aplica")
      const cumpleMes = file.items.filter((i) => i.estado === "Cumple" || i.estado === "Cumple parcialmente").length
      const cumplimientoMes = itemsMes.length > 0 ? (cumpleMes / itemsMes.length) * 100 : 0

      if (!porMes[mes]) {
        porMes[mes] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porMes[mes].total += itemsMes.length
      porMes[mes].cumplimiento =
        (porMes[mes].cumplimiento * porMes[mes].auditorias + cumplimientoMes) / (porMes[mes].auditorias + 1)
      porMes[mes].auditorias += 1
    })

    // Items mas problematicos
    const itemCounter: Record<string, { pregunta: string; categoria: string; noCumple: number }> = {}
    allItems
      .filter((i) => i.estado === "No cumple")
      .forEach((item) => {
        const key = `${item.categoria}::${item.pregunta}`
        if (!itemCounter[key]) {
          itemCounter[key] = { pregunta: item.pregunta, categoria: item.categoria, noCumple: 0 }
        }
        itemCounter[key].noCumple += 1
      })
    const itemsMasProblematicos = Object.values(itemCounter)
      .map((item) => ({ ...item, frecuencia: item.noCumple }))
      .sort((a, b) => b.noCumple - a.noCumple)
      .slice(0, 10)

    return {
      totalAuditorias: auditFiles.length,
      totalItems,
      cumplimientoPromedio,
      cumple,
      cumpleParcial,
      noCumple,
      noAplica,
      porOperacion,
      porAuditor,
      porMes,
      itemsMasProblematicos,
    }
  }

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "simple" ? "advanced" : "simple"))
  }

  return (
    <AuditContext.Provider
      value={{
        auditFiles,
        addAuditFiles,
        clearAuditFiles,
        getAllItems,
        getStats,
        viewMode,
        toggleViewMode,
      }}
    >
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const context = useContext(AuditContext)
  if (context === undefined) {
    throw new Error("useAudit must be used within an AuditProvider")
  }
  return context
}
