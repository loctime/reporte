import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Navigation } from "@/components/navigation"
import { FileUp, LayoutDashboard, Building2, User, CheckCircle2, AlertCircle } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1">
        <section className="py-20 px-4 bg-gradient-to-b from-secondary/30 to-background">
          <div className="container mx-auto max-w-5xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-balance">
              Sistema de Análisis de Auditorías
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
              Consolide múltiples auditorías de higiene y seguridad en una sola plataforma. Genere reportes automáticos,
              visualice tendencias y tome decisiones informadas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/upload">
                  <FileUp className="mr-2 h-5 w-5" />
                  Subir Auditorías
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-5 w-5" />
                  Ver Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <FileUp className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Carga Múltiple</CardTitle>
                  <CardDescription>
                    Arrastre y suelte múltiples archivos Excel. El sistema consolida automáticamente todos los datos.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <CardTitle>Análisis Automático</CardTitle>
                  <CardDescription>
                    Métricas de cumplimiento, tendencias mensuales y rankings generados instantáneamente.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-chart-1/10 flex items-center justify-center mb-4">
                    <LayoutDashboard className="h-6 w-6 text-chart-1" />
                  </div>
                  <CardTitle>Visualizaciones Claras</CardTitle>
                  <CardDescription>
                    Gráficos interactivos y dashboards profesionales para entender sus datos rápidamente.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-6 w-6 text-warning" />
                  </div>
                  <CardTitle>Detección de Problemas</CardTitle>
                  <CardDescription>
                    Identifique items recurrentes con incumplimientos y oportunidades de mejora.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-chart-2" />
                  </div>
                  <CardTitle>Por Operación</CardTitle>
                  <CardDescription>
                    Compare el desempeño entre diferentes operaciones y identifique las áreas críticas.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-chart-5/10 flex items-center justify-center mb-4">
                    <User className="h-6 w-6 text-chart-5" />
                  </div>
                  <CardTitle>Por Auditor</CardTitle>
                  <CardDescription>
                    Analice el rendimiento de cada auditor y las tendencias en sus evaluaciones.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-4">Comience Ahora</h2>
            <p className="text-muted-foreground mb-8">
              Cargue sus archivos Excel y obtenga análisis completos en segundos
            </p>
            <Button asChild size="lg">
              <Link href="/upload">Cargar Primera Auditoría</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Sistema de Análisis de Auditorías - Higiene y Seguridad</p>
        </div>
      </footer>
    </div>
  )
}
