"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X, Settings } from "lucide-react"
import * as XLSX from "xlsx"
import { parseExcelFile } from "@/lib/excel-parser"
import { cn, formatDate } from "@/lib/utils"
import type { AuditFile } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ColumnConfigurator } from "@/components/column-configurator"
import { loadColumnConfig, clearColumnConfig, type ColumnConfig } from "@/lib/column-config"

interface ExcelDebugData {
  rawData: any[][]
  sheetNames: string[]
  parsedData: AuditFile | null
  error: string | null
  metadata: {
    totalRows: number
    totalColumns: number
    headerRowIndex: number | null
    foundFields: {
      operacion: boolean
      responsable: boolean
      cliente: boolean
      fecha: boolean
      auditor: boolean
    }
  }
}

export default function VerificarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [debugData, setDebugData] = useState<ExcelDebugData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [savedConfig, setSavedConfig] = useState<ColumnConfig | null>(null)

  // Cargar configuración solo en el cliente para evitar errores de hidratación
  useEffect(() => {
    setSavedConfig(loadColumnConfig())
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const selectedFile = acceptedFiles[0]
    setFile(selectedFile)
    setIsProcessing(true)

    try {
      // Leer datos crudos del Excel
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

      // Verificar si hay configuración guardada
      const config = loadColumnConfig()
      setSavedConfig(config)

      // Si no hay configuración y encontramos la fila de encabezados, mostrar configurador
      const headerRowIndex = rawData.findIndex(
        (row) => row && row.some((cell: any) => String(cell).includes("CUMPLE") || String(cell).includes("ITEMS")),
      )

      if (!config && headerRowIndex !== -1) {
        setShowConfigurator(true)
      }

      // Intentar parsear con el parser
      let parsedData: AuditFile | null = null
      let parseError: string | null = null

      try {
        parsedData = await parseExcelFile(selectedFile)
      } catch (error) {
        parseError = error instanceof Error ? error.message : "Error desconocido al parsear"
      }

      // Analizar metadata
      const rowTexts = rawData.slice(0, 10).map((row) => row?.join(" ") || "")
      const allText = rowTexts.join(" ")

      const metadata = {
        totalRows: rawData.length,
        totalColumns: Math.max(...rawData.map((row) => row?.length || 0), 0),
        headerRowIndex: rawData.findIndex(
          (row) => row && row.some((cell: any) => String(cell).includes("CUMPLE") || String(cell).includes("ITEMS")),
        ),
        foundFields: {
          operacion: allText.includes("Operación:"),
          responsable: allText.includes("Responsable de la Operación:"),
          cliente: allText.includes("Cliente:"),
          fecha: allText.includes("Fecha:"),
          auditor: allText.includes("Auditor:"),
        },
      }

      setDebugData({
        rawData,
        sheetNames: workbook.SheetNames,
        parsedData,
        error: parseError,
        metadata,
      })
    } catch (error) {
      setDebugData({
        rawData: [],
        sheetNames: [],
        parsedData: null,
        error: error instanceof Error ? error.message : "Error al leer el archivo",
        metadata: {
          totalRows: 0,
          totalColumns: 0,
          headerRowIndex: null,
          foundFields: {
            operacion: false,
            responsable: false,
            cliente: false,
            fecha: false,
            auditor: false,
          },
        },
      })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  })

  const clearFile = () => {
    setFile(null)
    setDebugData(null)
    setShowConfigurator(false)
  }

  const handleConfigComplete = async (config: ColumnConfig) => {
    setSavedConfig(config)
    setShowConfigurator(false)
    // Re-procesar el archivo con la nueva configuración
    if (file) {
      setIsProcessing(true)
      try {
        const parsedData = await parseExcelFile(file)
        setDebugData((prev) => (prev ? { ...prev, parsedData } : null))
      } catch (error) {
        // Error handling
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleConfigSkip = () => {
    setShowConfigurator(false)
  }

  const handleReconfigure = () => {
    clearColumnConfig()
    setSavedConfig(null)
    setShowConfigurator(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Verificar Lectura de Excel</h1>
            <p className="text-muted-foreground">
              Suba un archivo Excel para ver exactamente qué datos lee el sistema y cómo los interpreta
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Subir Archivo Excel</CardTitle>
              <CardDescription>Seleccione un archivo .xlsx o .xls para analizar</CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {isDragActive ? "Suelte el archivo aquí" : "Arrastre un archivo Excel o haga clic"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Soporta archivos .xlsx y .xls</p>
                  <Button type="button">Seleccionar Archivo</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {!isProcessing && debugData && !debugData.error && (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                    {!isProcessing && debugData && debugData.error && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <Button variant="ghost" size="icon" onClick={clearFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {showConfigurator && debugData && debugData.metadata.headerRowIndex !== null && (
            <ColumnConfigurator
              rawData={debugData.rawData}
              headerRowIndex={debugData.metadata.headerRowIndex}
              onConfigComplete={handleConfigComplete}
              onSkip={handleConfigSkip}
            />
          )}

          {savedConfig && !showConfigurator && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-semibold">Configuración de Columnas Activa</p>
                      <p className="text-sm text-muted-foreground">
                        Pregunta: Col {savedConfig.pregunta + 1} | Cumple: Col {savedConfig.cumple + 1} | Cumple
                        Parcial: Col {savedConfig.cumpleParcial + 1} | No Cumple: Col {savedConfig.noCumple + 1} | No
                        Aplica: Col {savedConfig.noAplica + 1}
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

          {debugData && (
            <Tabs defaultValue="metadata" className="space-y-4">
              <TabsList>
                <TabsTrigger value="metadata">Información General</TabsTrigger>
                <TabsTrigger value="raw">Datos Crudos</TabsTrigger>
                <TabsTrigger value="parsed">Datos Parseados</TabsTrigger>
                {debugData.error && <TabsTrigger value="error">Error</TabsTrigger>}
              </TabsList>

              <TabsContent value="metadata" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Información del Archivo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Hojas</p>
                        <p className="text-lg font-semibold">{debugData.sheetNames.length}</p>
                        <p className="text-xs text-muted-foreground">{debugData.sheetNames.join(", ")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Filas</p>
                        <p className="text-lg font-semibold">{debugData.metadata.totalRows}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Columnas</p>
                        <p className="text-lg font-semibold">{debugData.metadata.totalColumns}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fila de Encabezado</p>
                        <p className="text-lg font-semibold">
                          {debugData.metadata.headerRowIndex !== null && debugData.metadata.headerRowIndex !== -1
                            ? `Fila ${debugData.metadata.headerRowIndex + 1}`
                            : "No encontrada"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-3">Campos Encontrados en el Encabezado</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={debugData.metadata.foundFields.operacion ? "default" : "secondary"}>
                          Operación {debugData.metadata.foundFields.operacion ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={debugData.metadata.foundFields.responsable ? "default" : "secondary"}>
                          Responsable {debugData.metadata.foundFields.responsable ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={debugData.metadata.foundFields.cliente ? "default" : "secondary"}>
                          Cliente {debugData.metadata.foundFields.cliente ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={debugData.metadata.foundFields.fecha ? "default" : "secondary"}>
                          Fecha {debugData.metadata.foundFields.fecha ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={debugData.metadata.foundFields.auditor ? "default" : "secondary"}>
                          Auditor {debugData.metadata.foundFields.auditor ? "✓" : "✗"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="raw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Datos Crudos del Excel</CardTitle>
                    <CardDescription>
                      Primeras 50 filas del archivo tal como las lee el sistema (primeras 10 columnas)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Fila</TableHead>
                            {Array.from({ length: Math.min(10, debugData.metadata.totalColumns) }).map((_, i) => (
                              <TableHead key={i}>Col {i + 1}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debugData.rawData.slice(0, 50).map((row, rowIndex) => {
                            const isHeaderRow =
                              debugData.metadata.headerRowIndex !== null &&
                              debugData.metadata.headerRowIndex !== -1 &&
                              rowIndex === debugData.metadata.headerRowIndex
                            return (
                              <TableRow key={rowIndex} className={isHeaderRow ? "bg-primary/10 font-semibold" : ""}>
                                <TableCell className="font-mono text-xs bg-muted">{rowIndex + 1}</TableCell>
                                {Array.from({ length: Math.min(10, debugData.metadata.totalColumns) }).map((_, colIndex) => (
                                  <TableCell key={colIndex} className="max-w-xs">
                                    <div className="truncate text-sm" title={String(row[colIndex] ?? "")}>
                                      {row[colIndex] !== undefined && row[colIndex] !== null
                                        ? String(row[colIndex])
                                        : ""}
                                    </div>
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {debugData.rawData.length > 50 && (
                      <p className="text-sm text-muted-foreground mt-4">
                        Mostrando primeras 50 filas de {debugData.rawData.length} totales
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="parsed" className="space-y-4">
                {debugData.parsedData ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Datos Extraídos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Operación</p>
                            <p className="font-semibold">{debugData.parsedData.operacion || "No encontrada"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Responsable</p>
                            <p className="font-semibold">{debugData.parsedData.responsable || "No encontrado"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cliente</p>
                            <p className="font-semibold">{debugData.parsedData.cliente || "No encontrado"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Fecha</p>
                            <p className="font-semibold">
                              {formatDate(debugData.parsedData.fecha)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Auditor</p>
                            <p className="font-semibold">{debugData.parsedData.auditor || "No encontrado"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Items</p>
                            <p className="font-semibold">{debugData.parsedData.totalItems}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cumplimiento</p>
                            <p className="font-semibold">{debugData.parsedData.cumplimiento.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cumple</p>
                            <p className="font-semibold">{debugData.parsedData.cumple}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cumple Parcial</p>
                            <p className="font-semibold">{debugData.parsedData.cumpleParcial}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">No Cumple</p>
                            <p className="font-semibold">{debugData.parsedData.noCumple}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">No Aplica</p>
                            <p className="font-semibold">{debugData.parsedData.noAplica}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Análisis de Cumplimiento</CardTitle>
                        <CardDescription>Desglose del cálculo de cumplimiento</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">Items Evaluados</p>
                            <p className="text-2xl font-bold">
                              {debugData.parsedData.totalItems - debugData.parsedData.noAplica}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              de {debugData.parsedData.totalItems} totales
                            </p>
                          </div>
                          <div className="p-4 border rounded-lg bg-success/10">
                            <p className="text-sm text-muted-foreground mb-1">Cumple (100%)</p>
                            <p className="text-2xl font-bold text-success">
                              {debugData.parsedData.cumple}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {debugData.parsedData.totalItems - debugData.parsedData.noAplica > 0
                                ? (
                                    (debugData.parsedData.cumple /
                                      (debugData.parsedData.totalItems - debugData.parsedData.noAplica)) *
                                    100
                                  ).toFixed(1)
                                : 0}
                              % de evaluados
                            </p>
                          </div>
                          <div className="p-4 border rounded-lg bg-warning/10">
                            <p className="text-sm text-muted-foreground mb-1">Parcial (50%)</p>
                            <p className="text-2xl font-bold text-warning">
                              {debugData.parsedData.cumpleParcial}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {debugData.parsedData.totalItems - debugData.parsedData.noAplica > 0
                                ? (
                                    (debugData.parsedData.cumpleParcial /
                                      (debugData.parsedData.totalItems - debugData.parsedData.noAplica)) *
                                    100
                                  ).toFixed(1)
                                : 0}
                              % de evaluados
                            </p>
                          </div>
                          <div className="p-4 border rounded-lg bg-destructive/10">
                            <p className="text-sm text-muted-foreground mb-1">No Cumple (0%)</p>
                            <p className="text-2xl font-bold text-destructive">
                              {debugData.parsedData.noCumple}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {debugData.parsedData.totalItems - debugData.parsedData.noAplica > 0
                                ? (
                                    (debugData.parsedData.noCumple /
                                      (debugData.parsedData.totalItems - debugData.parsedData.noAplica)) *
                                    100
                                  ).toFixed(1)
                                : 0}
                              % de evaluados
                            </p>
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-2">Fórmula de Cálculo:</p>
                          <p className="text-sm font-mono">
                            Cumplimiento = ((Cumple × 1.0 + Cumple Parcial × 0.5) / Items Evaluados) × 100
                          </p>
                          <p className="text-sm font-mono mt-2">
                            = (({debugData.parsedData.cumple} × 1.0 + {debugData.parsedData.cumpleParcial} × 0.5) /{" "}
                            {debugData.parsedData.totalItems - debugData.parsedData.noAplica}) × 100
                          </p>
                          <p className="text-sm font-mono mt-2">
                            = ({debugData.parsedData.cumple + debugData.parsedData.cumpleParcial * 0.5} /{" "}
                            {debugData.parsedData.totalItems - debugData.parsedData.noAplica}) × 100 ={" "}
                            {debugData.parsedData.cumplimiento.toFixed(2)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Items Parseados (Primeros 20)</CardTitle>
                        <CardDescription>Vista de los primeros items que el sistema detectó</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="max-w-md">Pregunta</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="max-w-xs">Observación</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {debugData.parsedData.items.slice(0, 20).map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                      {item.categoria}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-md">
                                    <div className="truncate text-sm" title={item.pregunta}>
                                      {item.pregunta}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        item.estado === "Cumple"
                                          ? "default"
                                          : item.estado === "Cumple parcialmente"
                                            ? "secondary"
                                            : item.estado === "No cumple"
                                              ? "destructive"
                                              : "outline"
                                      }
                                    >
                                      {item.estado}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-xs">
                                    <div className="truncate text-sm text-muted-foreground" title={item.observacion}>
                                      {item.observacion || "-"}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {debugData.parsedData.items.length > 20 && (
                          <p className="text-sm text-muted-foreground mt-4">
                            Mostrando primeros 20 items de {debugData.parsedData.items.length} totales
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>JSON Completo</CardTitle>
                        <CardDescription>Estructura completa de datos parseados</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                          {JSON.stringify(debugData.parsedData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No se pudieron parsear los datos. Revisa la pestaña de Error para más detalles.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {debugData.error && (
                <TabsContent value="error">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-destructive">Error al Procesar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <p className="font-mono text-sm">{debugData.error}</p>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Posibles causas:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          <li>El formato del Excel no coincide con el esperado</li>
                          <li>Falta la fila de encabezado con "CUMPLE" o "ITEMS"</li>
                          <li>La estructura de las columnas es diferente</li>
                          <li>El archivo está corrupto o en formato incorrecto</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </main>
    </div>
  )
}

