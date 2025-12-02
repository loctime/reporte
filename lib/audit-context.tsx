"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { AuditFile, AuditItem, AuditStats } from "./types"
import { parseExcelFile } from "./excel-parser"

interface AuditFileWithBlob extends AuditFile {
  fileBlob?: Blob
}

interface AuditContextType {
  auditFiles: AuditFile[]
  addAuditFiles: (files: AuditFile[], fileBlobs?: Map<string, Blob>) => void
  clearAuditFiles: () => void
  getAllItems: () => AuditItem[]
  getStats: () => AuditStats
  viewMode: "simple" | "advanced"
  toggleViewMode: () => void
  getFileBlob: (fileName: string) => Blob | null
  reparseFiles: () => Promise<{ success: number; errors: Array<{ fileName: string; error: string }> }>
}

const AuditContext = createContext<AuditContextType | undefined>(undefined)

export function AuditProvider({ children }: { children: ReactNode }) {
  const [auditFiles, setAuditFiles] = useState<AuditFile[]>([])
  const [fileBlobs, setFileBlobs] = useState<Map<string, Blob>>(new Map())
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple")

  const addAuditFiles = (files: AuditFile[], blobs?: Map<string, Blob>) => {
    setAuditFiles((prev) => [...prev, ...files])
    if (blobs) {
      setFileBlobs((prev) => {
        const newMap = new Map(prev)
        blobs.forEach((blob, fileName) => {
          newMap.set(fileName, blob)
        })
        return newMap
      })
    }
  }

  const getFileBlob = (fileName: string): Blob | null => {
    return fileBlobs.get(fileName) || null
  }

  const clearAuditFiles = () => {
    setAuditFiles([])
    setFileBlobs(new Map())
  }

  const getAllItems = (): AuditItem[] => {
    return auditFiles.flatMap((file) => file.items)
  }

  const getStats = (): AuditStats => {
    const allItems = getAllItems()
    
    // Sumar los totalItems de cada auditoría (que vienen del Excel)
    const totalItems = auditFiles.reduce((sum, file) => sum + file.totalItems, 0)

    // Sumar las estadísticas de cada auditoría (que vienen del Excel)
    const cumple = auditFiles.reduce((sum, file) => sum + file.cumple, 0)
    const cumpleParcial = auditFiles.reduce((sum, file) => sum + file.cumpleParcial, 0)
    const noCumple = auditFiles.reduce((sum, file) => sum + file.noCumple, 0)
    const noAplica = auditFiles.reduce((sum, file) => sum + file.noAplica, 0)

    const itemsEvaluados = totalItems - noAplica
    
    // Cumplimiento promedio: promedio de los porcentajes de cumplimiento de cada auditoría (viene del Excel)
    const cumplimientoPromedio =
      auditFiles.length > 0
        ? auditFiles.reduce((sum, file) => sum + file.cumplimiento, 0) / auditFiles.length
        : 0

    // Por operacion
    const porOperacion: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      // Usar totalItems del Excel (items evaluados = totalItems - noAplica)
      const itemsEvaluadosOp = file.totalItems - file.noAplica
      // Usar el cumplimiento del Excel en lugar de calcularlo
      const cumplimientoOp = file.cumplimiento

      if (!porOperacion[file.operacion]) {
        porOperacion[file.operacion] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porOperacion[file.operacion].total += itemsEvaluadosOp
      porOperacion[file.operacion].cumplimiento =
        (porOperacion[file.operacion].cumplimiento * porOperacion[file.operacion].auditorias + cumplimientoOp) /
        (porOperacion[file.operacion].auditorias + 1)
      porOperacion[file.operacion].auditorias += 1
    })

    // Por auditor
    const porAuditor: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      // Usar totalItems del Excel (items evaluados = totalItems - noAplica)
      const itemsEvaluadosAud = file.totalItems - file.noAplica
      // Usar el cumplimiento del Excel en lugar de calcularlo
      const cumplimientoAud = file.cumplimiento

      if (!porAuditor[file.auditor]) {
        porAuditor[file.auditor] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porAuditor[file.auditor].total += itemsEvaluadosAud
      porAuditor[file.auditor].cumplimiento =
        (porAuditor[file.auditor].cumplimiento * porAuditor[file.auditor].auditorias + cumplimientoAud) /
        (porAuditor[file.auditor].auditorias + 1)
      porAuditor[file.auditor].auditorias += 1
    })

    // Por mes
    const porMes: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
    auditFiles.forEach((file) => {
      const mes = `${file.fecha.getFullYear()}-${String(file.fecha.getMonth() + 1).padStart(2, "0")}`
      // Usar totalItems del Excel (items evaluados = totalItems - noAplica)
      const itemsEvaluadosMes = file.totalItems - file.noAplica
      // Usar el cumplimiento del Excel en lugar de calcularlo
      const cumplimientoMes = file.cumplimiento

      if (!porMes[mes]) {
        porMes[mes] = { total: 0, cumplimiento: 0, auditorias: 0 }
      }
      porMes[mes].total += itemsEvaluadosMes
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

  const reparseFiles = async (): Promise<{ success: number; errors: Array<{ fileName: string; error: string }> }> => {
    const errors: Array<{ fileName: string; error: string }> = []
    const newFiles: AuditFile[] = []
    const newBlobs = new Map<string, Blob>()

    // Re-parsear cada archivo existente
    for (const file of auditFiles) {
      const blob = fileBlobs.get(file.fileName)
      if (!blob) {
        errors.push({
          fileName: file.fileName,
          error: "No se encontró el archivo original para re-parsear",
        })
        continue
      }

      try {
        // Convertir blob a File para re-parsear
        const fileObj = new File([blob], file.fileName, { type: blob.type })
        const parsedFile = await parseExcelFile(fileObj)
        newFiles.push(parsedFile)
        newBlobs.set(parsedFile.fileName, blob)
      } catch (error) {
        errors.push({
          fileName: file.fileName,
          error: error instanceof Error ? error.message : "Error desconocido al re-parsear",
        })
      }
    }

    // Si hay archivos re-parseados exitosamente, actualizar el estado
    if (newFiles.length > 0) {
      setAuditFiles(newFiles)
      setFileBlobs(newBlobs)
    }

    return {
      success: newFiles.length,
      errors,
    }
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
        getFileBlob,
        reparseFiles,
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
