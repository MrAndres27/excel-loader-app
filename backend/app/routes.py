from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ExcelRecord, ProcessLog
import pandas as pd
import json
from datetime import datetime
import time
import uuid

router = APIRouter()

@router.post("/upload/excel")
async def upload_excel_file(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """
    Endpoint principal para procesar archivos Excel
    
    - Lee el archivo Excel
    - Procesa las filas
    - Guarda en base de datos
    - Retorna progreso de 0 a 100
    """
    
    # Validar extensión del archivo
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsm')):
        raise HTTPException(
            status_code=400, 
            detail="Solo se permiten archivos Excel (.xlsx, .xls, .xlsm)"
        )
    
    # Generar ID único para este lote
    batch_id = str(uuid.uuid4())[:8]
    
    try:
        # Leer archivo Excel
        print(f"📖 Leyendo archivo: {file.filename}")
        contents = await file.read()
        df = pd.read_excel(contents, engine='openpyxl')
        
        total_rows = len(df)
        print(f"📊 Total de filas: {total_rows}")
        
        if total_rows == 0:
            raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
        
        # Preparar respuesta
        response = {
            "filename": file.filename,
            "batch_id": batch_id,
            "total_rows": total_rows,
            "columns": df.columns.tolist(),
            "progress_updates": [],
            "errors": [],
            "success": True
        }
        
        # Procesar en lotes para mostrar progreso
        batch_size = max(1, total_rows // 10)  # 10 actualizaciones de progreso
        processed = 0
        success_count = 0
        
        print(f"🔄 Procesando en lotes de {batch_size} filas...")
        
        for i in range(0, total_rows, batch_size):
            batch = df.iloc[i:i+batch_size]
            
            try:
                # Insertar cada fila del lote
                for idx, row in batch.iterrows():
                    record = ExcelRecord(
                        filename=file.filename,
                        row_data=json.dumps(row.to_dict(), default=str),
                        upload_batch=batch_id
                    )
                    db.add(record)
                
                # Commit del lote
                db.commit()
                processed += len(batch)
                success_count += len(batch)
                
                # Calcular progreso
                progress_pct = int((processed / total_rows) * 100)
                
                # Agregar actualización de progreso
                response["progress_updates"].append({
                    "percentage": progress_pct,
                    "rows_done": processed,
                    "timestamp": datetime.now().isoformat()
                })
                
                print(f"✅ Progreso: {progress_pct}% ({processed}/{total_rows} filas)")
                
                # Simular tiempo de procesamiento
                time.sleep(0.15)
                
            except Exception as e:
                db.rollback()
                error_msg = f"Error en lote (filas {i+1} a {i+len(batch)}): {str(e)}"
                print(f"❌ {error_msg}")
                response["errors"].append({
                    "batch": f"Filas {i+1} a {i+len(batch)}",
                    "error": str(e)
                })
        
        # Guardar log del proceso
        log = ProcessLog(
            filename=file.filename,
            status="completed" if not response["errors"] else "completed_with_errors",
            total_rows=total_rows,
            success_rows=success_count,
            error_message=json.dumps(response["errors"]) if response["errors"] else None
        )
        db.add(log)
        db.commit()
        
        response["success"] = len(response["errors"]) == 0
        
        print(f"🎉 Proceso completado: {success_count}/{total_rows} filas guardadas")
        
        return response
        
    except Exception as e:
        print(f"❌ Error crítico: {str(e)}")
        
        # Guardar log de error
        log = ProcessLog(
            filename=file.filename,
            status="failed",
            total_rows=0,
            success_rows=0,
            error_message=str(e)
        )
        db.add(log)
        db.commit()
        
        raise HTTPException(
            status_code=500, 
            detail=f"Error procesando archivo Excel: {str(e)}"
        )

@router.get("/logs")
async def get_process_logs(db: Session = Depends(get_db), limit: int = 20):
    """Obtener logs de procesos de carga"""
    logs = db.query(ProcessLog).order_by(
        ProcessLog.created_at.desc()
    ).limit(limit).all()
    
    return [{
        "id": log.id,
        "filename": log.filename,
        "status": log.status,
        "total_rows": log.total_rows,
        "success_rows": log.success_rows,
        "created_at": log.created_at.isoformat()
    } for log in logs]

@router.get("/records")
async def get_excel_records(db: Session = Depends(get_db), limit: int = 50):
    """Obtener registros almacenados del Excel"""
    records = db.query(ExcelRecord).order_by(
        ExcelRecord.created_at.desc()
    ).limit(limit).all()
    
    return [{
        "id": record.id,
        "filename": record.filename,
        "batch": record.upload_batch,
        "data": json.loads(record.row_data),
        "created_at": record.created_at.isoformat()
    } for record in records]

@router.get("/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Obtener estadísticas generales del sistema"""
    total_records = db.query(ExcelRecord).count()
    total_uploads = db.query(ProcessLog).count()
    
    successful_uploads = db.query(ProcessLog).filter(
        ProcessLog.status == "completed"
    ).count()
    
    return {
        "total_records_stored": total_records,
        "total_uploads": total_uploads,
        "successful_uploads": successful_uploads,
        "failed_uploads": total_uploads - successful_uploads,
        "api_version": "2.0",
        "port": 9200
    }