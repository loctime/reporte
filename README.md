# Sistema de Análisis de Auditorías

Plataforma para consolidar y analizar auditorías de higiene y seguridad. Genere reportes automáticos, visualice tendencias y tome decisiones informadas.

## 🚀 Características

- **Carga Múltiple**: Arrastre y suelte múltiples archivos Excel
- **Análisis Automático**: Métricas de cumplimiento y tendencias generadas instantáneamente
- **Visualizaciones Claras**: Gráficos interactivos y dashboards profesionales
- **Detección de Problemas**: Identifique items recurrentes con incumplimientos
- **Análisis por Operación**: Compare el desempeño entre diferentes operaciones
- **Análisis por Auditor**: Analice el rendimiento de cada auditor

## 🛠️ Tecnologías

- **Next.js 16** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Recharts** - Visualización de datos
- **Radix UI** - Componentes accesibles
- **XLSX** - Procesamiento de archivos Excel

## 📦 Instalación

```bash
# Instalar dependencias
pnpm install

# Ejecutar en desarrollo
pnpm dev

# Construir para producción
pnpm build

# Ejecutar en producción
pnpm start
```

## 🌐 Deployment en Vercel

Este proyecto está configurado para desplegarse fácilmente en Vercel.

### Opción 1: Deploy desde GitHub (Recomendado)

1. **Sube tu código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <tu-repositorio-github>
   git push -u origin main
   ```

2. **Conecta con Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión con tu cuenta de GitHub
   - Haz clic en "Add New Project"
   - Importa tu repositorio
   - Vercel detectará automáticamente Next.js y configurará todo

3. **Configuración automática**
   - Framework: Next.js (detectado automáticamente)
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`
   - Output Directory: `.next` (automático)

### Opción 2: Deploy desde CLI

1. **Instala Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Inicia sesión**
   ```bash
   vercel login
   ```

3. **Despliega**
   ```bash
   vercel
   ```

4. **Para producción**
   ```bash
   vercel --prod
   ```

### Variables de Entorno

Si necesitas configurar variables de entorno:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega las variables necesarias

## 📝 Scripts Disponibles

- `pnpm dev` - Inicia el servidor de desarrollo
- `pnpm build` - Construye la aplicación para producción
- `pnpm start` - Inicia el servidor de producción
- `pnpm lint` - Ejecuta el linter

## 📄 Licencia

Este proyecto es privado.

