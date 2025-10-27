from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router
from app.database import engine, Base
import time

# Crear aplicación FastAPI
app = FastAPI(
    title="Excel Loader API", 
    version="2.0",
    description="API para cargar y procesar archivos Excel"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especifica los orígenes permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear tablas en la base de datos con reintentos
print("🔄 Intentando conectar a la base de datos...")
max_retries = 5
for i in range(max_retries):
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Base de datos conectada y tablas creadas exitosamente")
        print("📊 Tablas: excel_records, process_logs")
        break
    except Exception as e:
        if i < max_retries - 1:
            print(f"⚠️  Intento {i+1}/{max_retries} fallido. Reintentando en 5 segundos...")
            time.sleep(5)
        else:
            print(f"❌ Error crítico conectando a la base de datos: {e}")
            raise

# Incluir rutas
app.include_router(router)

# Ruta raíz
@app.get("/")
async def root():
    return {
        "message": "Excel Loader API v2.0",
        "status": "running",
        "port": 9200,
        "endpoints": {
            "upload": "/upload/excel",
            "logs": "/logs",
            "records": "/records",
            "stats": "/stats",
            "health": "/health",
            "docs": "/docs"
        }
    }

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "excel-loader-backend",
        "port": 9200,
        "database": "connected"
    }