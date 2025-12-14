"use client"

import { useCallback, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2, Settings } from "lucide-react"
import { parseExcelFile } from "@/lib/excel-parser"
import type { AuditFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ExcelConfiguratorNew } from "@/components/excel-configurator-new"
import { loadExcelConfig, clearExcelConfig, type ExcelConfig } from "@/lib/excel-config"
import * as XLSX from "xlsx"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface FileUploadProps {
  onFilesProcessed: (files: AuditFile[], fileBlobs: Map<string, Blob>) => void
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
  const [savedConfig, setSavedConfig] = useState<ExcelConfig | null>(null)
  const [sheet, setSheet] = useState<XLSX.WorkSheet | undefined>(undefined)
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean
    errors: Array<{ fileName: string; error: string }>
    successfulFiles: AuditFile[]
    successfulBlobs: Map<string, Blob>
  } | null>(null)

  useEffect(() => {
    // Cargar configuración guardada al montar
    const config = loadExcelConfig()
    setSavedConfig(config)
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Verificar si hay configuración guardada
      const config = loadExcelConfig()
      setSavedConfig(config)

      // Si no hay configuración, leer el primer archivo para mostrar el configurador
      if (!config && acceptedFiles.length > 0) {
        try {
          const firstFile = acceptedFiles[0]
          const data = await firstFile.arrayBuffer()
          const workbook = XLSX.read(data, { type: "array" })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

          // Encontrar la fila de encabezados
          const headerIndex = raw.findIndex(
            (row: any) =>
              row && Array.isArray(row) && row.some((cell: any) => String(cell).includes("CUMPLE") || String(cell).includes("ITEMS")),
          )

          if (headerIndex !== -1) {
            setConfigFile(firstFile)
            setRawData(raw as any[][])
            setHeaderRowIndex(headerIndex)
            setSheet(firstSheet) // Guardar el objeto sheet completo para formato
            setShowConfigurator(true)
            return
          } else {
            // Si no se encuentra la fila de encabezados, mostrar error
            setErrorDialog({
              open: true,
              errors: [{
                fileName: firstFile.name,
                error: "No se pudo encontrar la fila de encabezados. Por favor, configura las columnas manualmente.",
              }],
              successfulFiles: [],
              successfulBlobs: new Map(),
            })
            return
          }
        } catch (error) {
          // Si hay error leyendo, mostrar error
          setErrorDialog({
            open: true,
            errors: [{
              fileName: acceptedFiles[0]?.name || "Archivo desconocido",
              error: error instanceof Error ? error.message : "Error al leer el archivo",
            }],
            successfulFiles: [],
            successfulBlobs: new Map(),
          })
          return
        }
      }

      // Si hay configuración, procesar normalmente
      if (config) {
        await processFiles(acceptedFiles)
      }
    },
    [],
  )

  const processFiles = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      status: "pending",
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])
    setIsProcessing(true)

    const processedFiles: AuditFile[] = []
    const fileBlobs = new Map<string, Blob>()
    const errors: Array<{ fileName: string; error: string }> = []

    for (const uploadedFile of newFiles) {
      setUploadedFiles((prev) => prev.map((f) => (f.file === uploadedFile.file ? { ...f, status: "processing" } : f)))

      try {
        const data = await parseExcelFile(uploadedFile.file)
        processedFiles.push(data)
        
        // Guardar el blob del archivo original
        fileBlobs.set(data.fileName, uploadedFile.file)

        setUploadedFiles((prev) =>
          prev.map((f) => (f.file === uploadedFile.file ? { ...f, status: "success", data } : f)),
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        errors.push({
          fileName: uploadedFile.file.name,
          error: errorMessage,
        })
        
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file === uploadedFile.file
              ? { ...f, status: "error", error: errorMessage }
              : f,
          ),
        )
      }
    }

    setIsProcessing(false)

    // Si hay errores, mostrar diálogo para preguntar al usuario
    if (errors.length > 0) {
      setErrorDialog({
        open: true,
        errors,
        successfulFiles: processedFiles,
        successfulBlobs: fileBlobs,
      })
    } else if (processedFiles.length > 0) {
      // Si no hay errores, procesar normalmente
      onFilesProcessed(processedFiles, fileBlobs)
    }
  }

  const handleConfigComplete = async (config: ExcelConfig) => {
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
    // No procesar sin configuración - el usuario debe configurar primero
    setErrorDialog({
      open: true,
      errors: [{
        fileName: configFile?.name || "Archivo",
        error: "Se requiere configuración de columnas para procesar archivos. Por favor, completa la configuración.",
      }],
      successfulFiles: [],
      successfulBlobs: new Map(),
    })
    setConfigFile(null)
  }

  const handleReconfigure = () => {
    clearExcelConfig()
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
                  <p className="font-semibold">Configuración de Excel Activa</p>
                  <p className="text-sm text-muted-foreground">
                    {savedConfig.columnMapping.pregunta >= 0 && `Pregunta: Col ${savedConfig.columnMapping.pregunta + 1} | `}
                    {savedConfig.columnMapping.cumple >= 0 && `Cumple: Col ${savedConfig.columnMapping.cumple + 1} | `}
                    {savedConfig.customFields.length > 0 && `${savedConfig.customFields.length} campos personalizados`}
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

      {showConfigurator && rawData.length > 0 && (
        <ExcelConfiguratorNew
          rawData={rawData}
          sheet={sheet}
          file={configFile || undefined}
          onConfigComplete={handleConfigComplete}
          onCancel={handleConfigSkip}
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

      {/* Diálogo de errores */}
      {errorDialog && (
        <AlertDialog open={errorDialog.open} onOpenChange={(open) => {
          if (!open) {
            setErrorDialog(null)
          }
        }}>
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Errores al procesar archivos
              </AlertDialogTitle>
              <AlertDialogDescription>
                {errorDialog.errors.length} archivo(s) tuvieron problemas al procesarse.
                {errorDialog.successfulFiles.length > 0 && (
                  <span className="block mt-2">
                    {errorDialog.successfulFiles.length} archivo(s) se procesaron correctamente.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 my-4">
              <div>
                <h4 className="font-semibold mb-2 text-destructive">Archivos con errores:</h4>
                <div className="space-y-2">
                  {errorDialog.errors.map((error, index) => (
                    <Card key={index} className="border-destructive/20">
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{error.fileName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{error.error}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {errorDialog.successfulFiles.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-success">Archivos procesados correctamente:</h4>
                  <div className="space-y-1">
                    {errorDialog.successfulFiles.map((file, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        • {file.fileName}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setErrorDialog(null)}>
                Cancelar todo
              </AlertDialogCancel>
              {errorDialog.successfulFiles.length > 0 && (
                <AlertDialogAction
                  onClick={() => {
                    onFilesProcessed(errorDialog.successfulFiles, errorDialog.successfulBlobs)
                    setErrorDialog(null)
                  }}
                >
                  Continuar con archivos exitosos ({errorDialog.successfulFiles.length})
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
