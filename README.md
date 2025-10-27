# 📊 Excel Loader Pro v2.5

Sistema completo de carga, previsualización y procesamiento de archivos Excel con vista previa interactiva, edición de datos y almacenamiento en MySQL.

![Version](https://img.shields.io/badge/version-2.5-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)

## ✨ Características

- 📁 Carga de archivos Excel (.xlsx, .xls, .xlsm)
- 👁️ Vista previa sin guardar en BD
- 📑 Detección de múltiples hojas
- 🗑️ Edición de datos antes de insertar
- 📈 Gráficos estadísticos
- ⚠️ Validación de hojas vacías
- 💾 Inserción controlada con progreso 0-100%
- 🔍 Logs de auditoría

## 🚀 Instalación Rápida

```bash
git clone https://github.com/TU-USUARIO/excel-loader-app.git
cd excel-loader-app
docker-compose up --build -d
```

Accede en: **http://localhost:5500**

## 📖 Documentación

API Docs: **http://localhost:9200/docs**

## 🛠️ Stack Tecnológico

- **Frontend:** React 18.2, Tailwind CSS, Vite
- **Backend:** FastAPI 0.104, SQLAlchemy, Pandas
- **Database:** MySQL 8.0
- **Infrastructure:** Docker Compose

## 📊 Puertos

| Servicio | Puerto |
|----------|--------|
| Frontend | 5500   |
| Backend  | 9200   |
| MySQL    | 3388   |

## 🔧 Uso

1. Sube un archivo Excel
2. Haz clic en "Previsualizar"
3. Selecciona una hoja
4. Edita si es necesario
5. Inserta a la base de datos

## 📄 Licencia

MIT License

## 👨‍💻 Autor

Tu Nombre - [@tu-usuario](https://github.com/tu-usuario)
EOF

# 2. Inicializar Git
echo "🔧 Inicializando repositorio Git..."
git init

# 3. Agregar archivos
echo "📦 Agregando archivos..."
git add .

# 4. Primer commit
echo "✅ Creando primer commit..."
git commit -m "feat: Initial commit - Excel Loader Pro v2.5

- Frontend React con vista previa interactiva
- Backend FastAPI con endpoints de preview e insert
- Base de datos MySQL para almacenamiento
- Docker Compose para orquestación
- Detección de múltiples hojas Excel
- Edición de datos antes de insertar
- Gráficos de estadísticas
- Validación de hojas vacías
- Barra de progreso 0-100%
- Logs de auditoría"

# 5. Crear rama main (si no existe)
git branch -M main

echo ""
echo "✅ Repositorio Git inicializado correctamente!"
echo ""
echo "📌 SIGUIENTES PASOS:"
echo ""
echo "1. Crea un nuevo repositorio en GitHub: https://github.com/new"
echo "   - Nombre: excel-loader-app"
echo "   - Descripción: Sistema de carga y procesamiento de archivos Excel"
echo "   - Visibilidad: Public o Private"
echo "   - NO inicialices con README, .gitignore o license"
echo ""
echo "2. Conecta tu repositorio local con GitHub:"
echo "   git remote add origin https://github.com/TU-USUARIO/excel-loader-app.git"
echo ""
echo "3. Sube tu código:"
echo "   git push -u origin main"
echo ""