"use client"

import React from "react"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

interface ExcelViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
}

/**
 * Visualizador básico de Excel - versión simple y hardcodeada
 * Solo muestra los datos en una tabla HTML básica
 */
export function ExcelViewer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
}: ExcelViewerProps) {
  // Calcular el número máximo de columnas
  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)

  // Filas a mostrar
  const rowsToShow = rawData.slice(0, maxRows)

  // Función para formatear el valor de una celda
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return ""
    }

    // Si es un número, verificar si es un porcentaje decimal
    if (typeof value === "number") {
      // Si está entre 0 y 1 (excluyendo enteros), probablemente es un porcentaje
      if (value > 0 && value < 1 && value !== Math.floor(value)) {
        return `${(value * 100).toFixed(0)}%`
      }
      return String(value)
    }

    return String(value)
  }

  // Referencia para sincronizar el scroll horizontal
  const topScrollRef = React.useRef<HTMLDivElement>(null)
  const bottomScrollRef = React.useRef<HTMLDivElement>(null)

  // Sincronizar scroll horizontal entre las dos barras
  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleBottomScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Ancho máximo de columna
  const maxColumnWidth = 200

  return (
    <div className={cn("border border-gray-300 rounded-lg overflow-hidden bg-white", className)}>
      {/* Barra de herramientas */}
      <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs text-gray-600">
        Excel Viewer - {rawData.length} filas × {maxColumns} columnas
      </div>

      {/* Scroll horizontal superior */}
      <div
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden bg-gray-50 border-b border-gray-300"
        onScroll={handleTopScroll}
        style={{ height: "17px" }}
      >
        <div style={{ height: "1px", minWidth: `${maxColumns * maxColumnWidth + 50}px` }} />
      </div>

      {/* Contenedor con scroll */}
      <div
        ref={bottomScrollRef}
        className="overflow-auto max-h-[600px] bg-white"
        onScroll={handleBottomScroll}
      >
        <table className="border-collapse text-sm" style={{ minWidth: `${maxColumns * maxColumnWidth + 50}px` }}>
          <thead>
            <tr>
              <th className="bg-gray-200 border border-gray-400 p-1 text-xs text-center sticky left-0 z-30 bg-gray-200 w-12">
                #
              </th>
              {Array.from({ length: maxColumns }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="bg-gray-50 border border-gray-400 p-1 text-xs text-center font-semibold sticky top-0 z-20"
                  style={{ minWidth: `${maxColumnWidth}px`, maxWidth: `${maxColumnWidth}px`, width: `${maxColumnWidth}px` }}
                >
                  {String.fromCharCode(65 + (colIndex % 26))}
                  {colIndex >= 26 ? Math.floor(colIndex / 26) : ""}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rowsToShow.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="bg-gray-100 border border-gray-400 p-1 text-xs text-center sticky left-0 z-10 w-12">
                  {rowIndex + 1}
                </td>
                {Array.from({ length: maxColumns }).map((_, colIndex) => {
                  const cellValue = row[colIndex]
                  const displayValue = formatCellValue(cellValue)
                  const isSelected = selectedCells.some(
                    (cell) => cell.row === rowIndex && cell.col === colIndex
                  )
                  const highlighted = highlightedCells.find(
                    (cell) => cell.row === rowIndex && cell.col === colIndex
                  )

                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        "border border-gray-300 p-1 text-xs relative",
                        isSelected && "ring-2 ring-blue-500 bg-blue-50",
                        highlighted && !isSelected && "ring-1 ring-yellow-400 bg-yellow-50",
                        onCellClick && "cursor-pointer hover:bg-gray-50"
                      )}
                      style={{ minWidth: `${maxColumnWidth}px`, maxWidth: `${maxColumnWidth}px`, width: `${maxColumnWidth}px` }}
                      onClick={() => onCellClick?.(rowIndex, colIndex)}
                      title={highlighted?.label || displayValue || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`}
                    >
                      <div className="truncate">{displayValue}</div>
                      {highlighted?.label && (
                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded-bl z-10">
                          {highlighted.label}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
