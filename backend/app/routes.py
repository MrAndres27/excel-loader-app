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


@router.post("/preview/excel")
async def preview_excel_file(file: UploadFile = File(...)):
    """
    Endpoint para previsualizar el archivo Excel sin guardarlo en BD
    """
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsm')):
        raise HTTPException(
            status_code=400, 
            detail="Solo se permiten archivos Excel (.xlsx, .xls, .xlsm)"
        )
    
    try:
        print(f"📖 Previsualizando archivo: {file.filename}")
        contents = await file.read()
        excel_file = pd.ExcelFile(contents, engine='openpyxl')
        
        sheets_data = {}
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            sheets_data[sheet_name] = {
                "total_rows": len(df),
                "columns": df.columns.tolist(),
                "preview_data": df.head(100).to_dict('records'),
                "is_empty": len(df) == 0
            }
        
        print(f"✅ Preview exitoso: {len(excel_file.sheet_names)} hojas encontradas")
        
        return {
            "filename": file.filename,
            "total_sheets": len(excel_file.sheet_names),
            "sheet_names": excel_file.sheet_names,
            "sheets_data": sheets_data
        }
        
    except Exception as e:
        print(f"❌ Error en preview: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error previsualizando archivo: {str(e)}"
        )


@router.post("/insert/excel")
async def insert_excel_data(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Endpoint para insertar datos previsualizados en la base de datos
    """
    try:
        filename = data.get("filename")
        sheet_name = data.get("sheet_name")
        rows = data.get("data", [])
        
        if not rows:
            raise HTTPException(status_code=400, detail="No hay datos para insertar")
        
        batch_id = str(uuid.uuid4())[:8]
        total_rows = len(rows)
        processed = 0
        
        print(f"💾 Insertando {total_rows} filas de {filename} ({sheet_name})")
        
        response = {
            "filename": filename,
            "batch_id": batch_id,
            "rows_inserted": 0,
            "progress_updates": []
        }
        
        batch_size = max(1, total_rows // 10)
        
        for i in range(0, total_rows, batch_size):
            batch = rows[i:i+batch_size]
            
            for row in batch:
                record = ExcelRecord(
                    filename=filename,
                    row_data=json.dumps(row, default=str),
                    upload_batch=batch_id
                )
                db.add(record)
            
            db.commit()
            processed += len(batch)
            progress_pct = int((processed / total_rows) * 100)
            
            response["progress_updates"].append({
                "percentage": progress_pct,
                "rows_done": processed,
                "timestamp": datetime.now().isoformat()
            })
            
            print(f"✅ Progreso: {progress_pct}% ({processed}/{total_rows})")
            time.sleep(0.15)
        
        response["rows_inserted"] = processed
        
        # Guardar log
        log = ProcessLog(
            filename=filename,
            status="completed",
            total_rows=total_rows,
            success_rows=processed
        )
        db.add(log)
        db.commit()
        
        print(f"🎉 Inserción completada: {processed} filas guardadas")
        
        return response
        
    except Exception as e:
        print(f"❌ Error insertando: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error insertando datos: {str(e)}"
        )


@router.post("/upload/excel")
async def upload_excel_file(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """
    Endpoint original para procesar y guardar archivos Excel directamente
    """
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsm')):
        raise HTTPException(
            status_code=400, 
            detail="Solo se permiten archivos Excel (.xlsx, .xls, .xlsm)"
        )
    
    batch_id = str(uuid.uuid4())[:8]
    
    try:
        print(f"📖 Leyendo archivo: {file.filename}")
        contents = await file.read()
        df = pd.read_excel(contents, engine='openpyxl')
        
        total_rows = len(df)
        print(f"📊 Total de filas: {total_rows}")
        
        if total_rows == 0:
            raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
        
        response = {
            "filename": file.filename,
            "batch_id": batch_id,
            "total_rows": total_rows,
            "columns": df.columns.tolist(),
            "progress_updates": [],
            "errors": [],
            "success": True
        }
        
        batch_size = max(1, total_rows // 10)
        processed = 0
        success_count = 0
        
        print(f"🔄 Procesando en lotes de {batch_size} filas...")
        
        for i in range(0, total_rows, batch_size):
            batch = df.iloc[i:i+batch_size]
            
            try:
                for idx, row in batch.iterrows():
                    record = ExcelRecord(
                        filename=file.filename,
                        row_data=json.dumps(row.to_dict(), default=str),
                        upload_batch=batch_id
                    )
                    db.add(record)
                
                db.commit()
                processed += len(batch)
                success_count += len(batch)
                
                progress_pct = int((processed / total_rows) * 100)
                
                response["progress_updates"].append({
                    "percentage": progress_pct,
                    "rows_done": processed,
                    "timestamp": datetime.now().isoformat()
                })
                
                print(f"✅ Progreso: {progress_pct}% ({processed}/{total_rows} filas)")
                time.sleep(0.15)
                
            except Exception as e:
                db.rollback()
                error_msg = f"Error en lote (filas {i+1} a {i+len(batch)}): {str(e)}"
                print(f"❌ {error_msg}")
                response["errors"].append({
                    "batch": f"Filas {i+1} a {i+len(batch)}",
                    "error": str(e)
                })
        
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
        "api_version": "2.5",
        "port": 9200
    }
