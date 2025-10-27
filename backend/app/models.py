from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

# Modelo para almacenar registros de Excel
class ExcelRecord(Base):
    __tablename__ = "excel_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    row_data = Column(Text, nullable=False)  # JSON de la fila
    upload_batch = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
# Modelo para logs de procesamiento
class ProcessLog(Base):
    __tablename__ = "process_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)  # completed, failed, etc.
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())