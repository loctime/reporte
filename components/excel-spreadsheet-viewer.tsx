"use client"

import React, { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"
import { ExcelViewer } from "./excel-viewer"

interface ExcelSpreadsheetViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
  readOnly?: boolean
}

/**
 * Visualizador de Excel usando React Spreadsheet
 * Si React Spreadsheet no está instalado, usa ExcelViewer como fallback
 */
export function ExcelSpreadsheetViewer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
  readOnly = true,
}: ExcelSpreadsheetViewerProps) {
  const [hasSpreadsheet, setHasSpreadsheet] = useState(false)
  const [SpreadsheetComponent, setSpreadsheetComponent] = useState<any>(null)
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

  // Intentar cargar React Spreadsheet dinámicamente
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadSpreadsheet = async () => {
      try {
        const spreadsheet = await import("react-spreadsheet")
        setSpreadsheetComponent(spreadsheet.default || spreadsheet.Spreadsheet)
        setHasSpreadsheet(true)
      } catch (error) {
        // React Spreadsheet no está instalado, usar fallback
        setHasSpreadsheet(false)
      }
    }

    loadSpreadsheet()
  }, [])

  // Cargar estilos con ExcelJS
  useEffect(() => {
    if (file) {
      setIsLoadingStyles(true)
      extractExcelStylesWithExcelJS(file)
        .then((format) => {
          setExceljsFormat(format)
          setIsLoadingStyles(false)
        })
        .catch(() => {
          setIsLoadingStyles(false)
          setExceljsFormat(null)
        })
    } else {
      setExceljsFormat(null)
    }
  }, [file])

  // Si React Spreadsheet no está disponible, usar ExcelViewer como fallback
  if (!hasSpreadsheet || !SpreadsheetComponent) {
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

  // Preparar datos para React Spreadsheet
  const spreadsheetData = useMemo(() => {
    const rowsToShow = rawData.slice(0, maxRows)
    const maxCols = Math.max(...rawData.map(row => row.length), 0)
    
    return rowsToShow.map((row, rowIndex) => {
      const newRow: any[] = []
      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        const colLetter = (() => {
          let result = ""
          let num = colIndex
          while (num >= 0) {
            result = String.fromCharCode(65 + (num % 26)) + result
            num = Math.floor(num / 26) - 1
          }
          return result
        })()
        const cellAddress = `${colLetter}${rowIndex + 1}`
        
        const value = exceljsFormat?.cellValues?.[cellAddress] !== undefined
          ? exceljsFormat.cellValues[cellAddress]
          : row[colIndex] ?? null
        
        const excelCellStyle = exceljsFormat?.cellStyles?.[cellAddress]
        
        newRow.push({
          value: value,
          className: excelCellStyle ? "excel-cell" : "",
          style: excelCellStyle ? {
            backgroundColor: excelCellStyle.backgroundColor,
            color: excelCellStyle.textColor,
            fontWeight: excelCellStyle.fontWeight,
            fontStyle: excelCellStyle.fontStyle,
            fontSize: excelCellStyle.fontSize,
            fontFamily: excelCellStyle.fontFamily,
            textAlign: excelCellStyle.textAlign,
          } : {},
        })
      }
      return newRow
    })
  }, [rawData, maxRows, exceljsFormat])

  // Configurar columnas con anchos
  const columns = useMemo(() => {
    const maxCols = Math.max(...rawData.map(row => row.length), 0)
    return Array.from({ length: maxCols }, (_, i) => {
      const width = exceljsFormat?.columnWidths[i] || 
                   (sheet?.["!cols"]?.[i]?.w ? sheet["!cols"][i].w * 7.5 : 80)
      return { width }
    })
  }, [exceljsFormat, sheet, rawData])

  return (
    <div className={className}>
      {isLoadingStyles && (
        <div className="text-sm text-muted-foreground mb-2">Cargando estilos...</div>
      )}
      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <SpreadsheetComponent
          data={spreadsheetData}
          columnLabels={columns}
          onChange={(data: any) => {
            // Solo permitir cambios si no es readOnly
            if (!readOnly) {
              // Manejar cambios si es necesario
            }
          }}
        />
      </div>
    </div>
  )
}

