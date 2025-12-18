"use client"

import React, { useEffect, useState } from "react"
import { ExcelViewer } from "./excel-viewer"

interface ExcelHtmlViewerProps {
  rawData: any[][]
  sheet?: any
  file?: File
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
  readOnly?: boolean
}

/**
 * Visualizador de Excel convirtiendo a HTML en el servidor
 * Usa ExcelJS para generar HTML con todos los estilos preservados
 */
export function ExcelHtmlViewer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
  readOnly = true,
}: ExcelHtmlViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (file) {
      setIsLoading(true)
      setError(null)
      
      const formData = new FormData()
      formData.append("file", file)

      fetch("/api/excel-to-html", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error al convertir Excel a HTML")
          }
          return response.json()
        })
        .then((data) => {
          setHtmlContent(data.html)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error("Error:", err)
          setError(err.message)
          setIsLoading(false)
          // Fallback a ExcelViewer si falla
          setHtmlContent(null)
        })
    } else {
      setHtmlContent(null)
    }
  }, [file])

  // Si no hay archivo o falló la conversión, usar ExcelViewer
  if (!file || error || !htmlContent) {
    return (
      <ExcelViewer
        rawData={rawData}
        sheet={sheet}
        file={file}
        onCellClick={onCellClick}
        selectedCells={selectedCells}
        highlightedCells={highlightedCells}
        maxRows={maxRows}
        className={className}
      />
    )
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="p-4 text-center text-muted-foreground">
          Cargando Excel...
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div 
        className="overflow-auto max-h-[600px] border rounded-lg"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          // Agregar estilos para hacer la tabla interactiva
          cursor: onCellClick ? "pointer" : "default",
        }}
        onClick={(e) => {
          if (!onCellClick) return
          
          // Intentar detectar qué celda se hizo clic
          const target = e.target as HTMLElement
          if (target.tagName === "TD") {
            const row = target.parentElement
            if (row) {
              const rowIndex = Array.from(row.parentElement?.children || []).indexOf(row)
              const colIndex = Array.from(row.children).indexOf(target)
              onCellClick(rowIndex, colIndex)
            }
          }
        }}
      />
    </div>
  )
}

