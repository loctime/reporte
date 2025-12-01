"use client"

import { useCallback, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2, Settings } from "lucide-react"
import { parseExcelFile } from "@/lib/excel-parser"
import type { AuditFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ColumnConfigurator } from "@/components/column-configurator"
import { loadColumnConfig, clearColumnConfig, type ColumnConfig } from "@/lib/column-config"
import * as XLSX from "xlsx"

interface FileUploadProps {
  onFilesProcessed: (files: AuditFile[]) => void
}

interface UploadedFile {
  file: File
  status: "pending" | "processing" | "success" | "error"
  data?: AuditFile
  error?: string
}

export function FileUpload({ onFilesProcessed }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configFile, setConfigFile] = useState<File | null>(null)
  const [rawData, setRawData] = useState<any[][]>([])
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(-1)
  const [savedConfig, setSavedConfig] = useState<ColumnConfig | null>(null)

  useEffect(() => {
    // Cargar configuración guardada al montar
    const config = loadColumnConfig()
    setSavedConfig(config)
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Verificar si hay configuración guardada
      const config = loadColumnConfig()
      setSavedConfig(config)

      // Si no hay configuración, leer el primer archivo para mostrar el configurador
      if (!config && acceptedFiles.length > 0) {
        try {
          const firstFile = acceptedFiles[0]
          const data = await firstFile.arrayBuffer()
          const workbook = XLSX.read(data, { type: "array" })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

          // Encontrar la fila de encabezados
          const headerIndex = raw.findIndex(
            (row: any) =>
              row && row.some((cell: any) => String(cell).includes("CUMPLE") || String(cell).includes("ITEMS")),
          )

          if (headerIndex !== -1) {
            setConfigFile(firstFile)
            setRawData(raw)
            setHeaderRowIndex(headerIndex)
            setShowConfigurator(true)
            return
          }
        } catch (error) {
          // Si hay error leyendo, continuar con el procesamiento normal
        }
      }

      // Si hay configuración o no se pudo leer el archivo, procesar normalmente
      await processFiles(acceptedFiles)
    },
    [onFilesProcessed],
  )

  const processFiles = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      status: "pending",
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])
    setIsProcessing(true)

    const processedFiles: AuditFile[] = []

    for (const uploadedFile of newFiles) {
      setUploadedFiles((prev) => prev.map((f) => (f.file === uploadedFile.file ? { ...f, status: "processing" } : f)))

      try {
        const data = await parseExcelFile(uploadedFile.file)
        processedFiles.push(data)

        setUploadedFiles((prev) =>
          prev.map((f) => (f.file === uploadedFile.file ? { ...f, status: "success", data } : f)),
        )
      } catch (error) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file === uploadedFile.file
              ? { ...f, status: "error", error: error instanceof Error ? error.message : "Error desconocido" }
              : f,
          ),
        )
      }
    }

    setIsProcessing(false)

    if (processedFiles.length > 0) {
      onFilesProcessed(processedFiles)
    }
  }

  const handleConfigComplete = async (config: ColumnConfig) => {
    setSavedConfig(config)
    setShowConfigurator(false)
    // Procesar el archivo que estaba esperando configuración
    if (configFile) {
      await processFiles([configFile])
      setConfigFile(null)
    }
  }

  const handleConfigSkip = async () => {
    setShowConfigurator(false)
    // Procesar con detección automática
    if (configFile) {
      await processFiles([configFile])
      setConfigFile(null)
    }
  }

  const handleReconfigure = () => {
    clearColumnConfig()
    setSavedConfig(null)
    if (configFile) {
      setShowConfigurator(true)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  })

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setUploadedFiles([])
  }

  return (
    <div className="space-y-6">
      {savedConfig && !showConfigurator && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="font-semibold">Configuración de Columnas Activa</p>
                  <p className="text-sm text-muted-foreground">
                    El sistema usará la configuración guardada para procesar los archivos
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReconfigure}>
                <Settings className="h-4 w-4 mr-2" />
                Reconfigurar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showConfigurator && rawData.length > 0 && headerRowIndex !== -1 && (
        <ColumnConfigurator
          rawData={rawData}
          headerRowIndex={headerRowIndex}
          onConfigComplete={handleConfigComplete}
          onSkip={handleConfigSkip}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? "Suelte los archivos aquí" : "Arrastre archivos Excel o haga clic"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Soporta archivos .xlsx y .xls</p>
            <Button type="button">Seleccionar Archivos</Button>
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Archivos Cargados ({uploadedFiles.length})</h3>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={isProcessing}>
              Limpiar Todo
            </Button>
          </div>

          <div className="space-y-2">
            {uploadedFiles.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.file.name}</p>
                      {item.status === "success" && item.data && (
                        <p className="text-sm text-muted-foreground">
                          {item.data.operacion} - {item.data.totalItems} items - Cumplimiento: {item.data.cumplimiento}%
                        </p>
                      )}
                      {item.status === "error" && <p className="text-sm text-destructive">{item.error}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === "processing" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {item.status === "success" && <CheckCircle2 className="h-5 w-5 text-success" />}
                      {item.status === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}

                      <Button variant="ghost" size="icon" onClick={() => removeFile(index)} disabled={isProcessing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
