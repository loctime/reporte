"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { parseExcelFile } from "@/lib/excel-parser"
import type { AuditFile } from "@/lib/types"
import { cn } from "@/lib/utils"

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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
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
    },
    [onFilesProcessed],
  )

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
