"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { FileUpload } from "@/components/file-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAudit } from "@/lib/audit-context"
import type { AuditFile } from "@/lib/types"
import { ArrowRight, FileSpreadsheet, RefreshCw } from "lucide-react"
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

export default function UploadPage() {
  const router = useRouter()
  const { addAuditFiles, auditFiles, reparseFiles } = useAudit()
  const [processedFiles, setProcessedFiles] = useState<AuditFile[]>([])
  const [fileBlobs, setFileBlobs] = useState<Map<string, Blob>>(new Map())
  const [isReparsing, setIsReparsing] = useState(false)
  const [reparseDialog, setReparseDialog] = useState<{
    open: boolean
    result: { success: number; errors: Array<{ fileName: string; error: string }> } | null
  }>({ open: false, result: null })

  const handleFilesProcessed = (files: AuditFile[], blobs: Map<string, Blob>) => {
    setProcessedFiles((prev) => [...prev, ...files])
    setFileBlobs((prev) => {
      const newMap = new Map(prev)
      blobs.forEach((blob, fileName) => {
        newMap.set(fileName, blob)
      })
      return newMap
    })
  }

  const handleContinue = () => {
    if (processedFiles.length > 0) {
      addAuditFiles(processedFiles, fileBlobs)
      router.push("/dashboard")
    }
  }

  const handleReparse = async () => {
    if (auditFiles.length === 0) {
      return
    }

    setIsReparsing(true)
    try {
      const result = await reparseFiles()
      setReparseDialog({ open: true, result })
    } catch (error) {
      setReparseDialog({
        open: true,
        result: {
          success: 0,
          errors: [{ fileName: "Error general", error: error instanceof Error ? error.message : "Error desconocido" }],
        },
      })
    } finally {
      setIsReparsing(false)
    }
  }

  const totalAudits = auditFiles.length + processedFiles.length

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-[95vw] px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Cargar Auditorías</h1>
            <p className="text-muted-foreground">
              Suba uno o múltiples archivos Excel con auditorías de higiene y seguridad
            </p>
          </div>

          {totalAudits > 0 && (
            <Card className="mb-6 bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {totalAudits} auditoría{totalAudits !== 1 ? "s" : ""} en el sistema
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {processedFiles.length > 0 &&
                          `${processedFiles.length} nueva${processedFiles.length !== 1 ? "s" : ""} lista${processedFiles.length !== 1 ? "s" : ""} para agregar`}
                        {auditFiles.length > 0 && (
                          <span className="block mt-1">
                            {auditFiles.length} archivo{auditFiles.length !== 1 ? "s" : ""} ya procesado{auditFiles.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {auditFiles.length > 0 && (
                      <Button variant="outline" onClick={handleReparse} disabled={isReparsing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isReparsing ? "animate-spin" : ""}`} />
                        Re-parsear archivos existentes
                      </Button>
                    )}
                    {processedFiles.length > 0 && (
                      <Button onClick={handleContinue}>
                        Continuar al Dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <FileUpload onFilesProcessed={handleFilesProcessed} />

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Información del Formato</CardTitle>
              <CardDescription>Los archivos Excel deben contener la siguiente estructura:</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Encabezado con: Operación, Responsable, Cliente, Fecha, Auditor</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Tabla con items evaluados y columnas: Cumple, Cumple Parcialmente, No Cumple, No Aplica</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Marcas "x" en las columnas de estado para cada item</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Categorías organizadas por secciones temáticas</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Diálogo de resultado de re-parseo */}
      {reparseDialog.result && (
        <AlertDialog
          open={reparseDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setReparseDialog({ open: false, result: null })
            }
          }}
        >
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {reparseDialog.result.errors.length === 0
                  ? "Re-parseo completado exitosamente"
                  : "Re-parseo completado con errores"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reparseDialog.result.success > 0 && (
                  <span className="block mb-2">
                    {reparseDialog.result.success} archivo(s) re-parseado(s) correctamente.
                  </span>
                )}
                {reparseDialog.result.errors.length > 0 && (
                  <span className="block text-destructive">
                    {reparseDialog.result.errors.length} archivo(s) tuvieron problemas.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {reparseDialog.result.errors.length > 0 && (
              <div className="space-y-2 my-4">
                <h4 className="font-semibold text-destructive">Errores:</h4>
                {reparseDialog.result.errors.map((error, index) => (
                  <Card key={index} className="border-destructive/20">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm">{error.fileName}</p>
                      <p className="text-sm text-muted-foreground mt-1">{error.error}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setReparseDialog({ open: false, result: null })}>
                Aceptar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
