import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isValidTable, setIsValidTable] = useState(true);
  const [chartData, setChartData] = useState(null);

  const API_URL = 'http://localhost:9200';
  const EXPECTED_COLUMNS = ['id', 'nombre', 'precio', 'cantidad', 'categoria', 'fecha', 'activo', 'descripcion'];

  useEffect(() => {
    if (tableData.length > 0 && columns.length > 0) {
      generateChartData();
    }
  }, [tableData, columns]);

  const generateChartData = () => {
    // Buscar columnas relevantes
    const categoriaCol = columns.find(col => col.toLowerCase().includes('categoria'));
    const precioCol = columns.find(col => col.toLowerCase().includes('precio'));
    const cantidadCol = columns.find(col => col.toLowerCase().includes('cantidad'));
    const activoCol = columns.find(col => col.toLowerCase().includes('activo'));

    const charts = {};

    // Gráfico de categorías
    if (categoriaCol) {
      const categorias = {};
      tableData.forEach(row => {
        const cat = row[categoriaCol] || 'Sin categoría';
        categorias[cat] = (categorias[cat] || 0) + 1;
      });

      charts.categorias = {
        labels: Object.keys(categorias),
        datasets: [{
          label: 'Cantidad por Categoría',
          data: Object.values(categorias),
          backgroundColor: ['#8d43ad', '#a855f7', '#5a4f7c', '#3e1a6b', '#10b981', '#14b8a6'],
        }]
      };
    }

    // Gráfico de activos
    if (activoCol) {
      const activos = { Activo: 0, Inactivo: 0 };
      tableData.forEach(row => {
        const val = String(row[activoCol]).toLowerCase();
        if (val === 'si' || val === 'sí' || val === 'true' || val === '1') {
          activos.Activo++;
        } else {
          activos.Inactivo++;
        }
      });

      charts.activos = {
        labels: Object.keys(activos),
        datasets: [{
          label: 'Estado',
          data: Object.values(activos),
          backgroundColor: ['#10b981', '#ef4444'],
        }]
      };
    }

    // Gráfico de precios
    if (precioCol) {
      const precios = tableData.map((row, idx) => ({
        x: idx + 1,
        y: parseFloat(row[precioCol]) || 0
      })).slice(0, 20);

      charts.precios = {
        labels: precios.map(p => `Item ${p.x}`),
        datasets: [{
          label: 'Precio',
          data: precios.map(p => p.y),
          borderColor: '#8d43ad',
          backgroundColor: 'rgba(141, 67, 173, 0.2)',
          tension: 0.4,
        }]
      };
    }

    setChartData(charts);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData(null);
      setSelectedSheet('');
      setTableData([]);
      setResult(null);
      setErrors([]);
      setWarnings([]);
      setProgress(0);
      setIsValidTable(true);
      setChartData(null);
    }
  };

  const validateColumns = (excelColumns) => {
    const matchingColumns = excelColumns.filter(col => {
      const colStr = String(col).trim();
      return EXPECTED_COLUMNS.some(expected => 
        String(expected).toLowerCase() === colStr.toLowerCase()
      );
    });
    
    if (matchingColumns.length === 0) {
      setWarnings([{
        type: 'column_mismatch',
        message: `❌ ERROR CRÍTICO: El Excel no contiene NINGUNA columna válida.\n\nColumnas esperadas: ${EXPECTED_COLUMNS.join(', ')}\nColumnas encontradas: ${excelColumns.join(', ')}\n\n⛔ No se puede subir este archivo.`
      }]);
      setIsValidTable(false);
      return false;
    } else if (matchingColumns.length < EXPECTED_COLUMNS.length) {
      setWarnings([{
        type: 'partial_match',
        message: `⚠️ ADVERTENCIA: Solo ${matchingColumns.length} de ${EXPECTED_COLUMNS.length} columnas esperadas fueron encontradas.\n\nCoinciden: ${matchingColumns.join(', ')}\nFaltan: ${EXPECTED_COLUMNS.filter(exp => !matchingColumns.includes(exp)).join(', ')}\n\n✅ Se puede subir de todos modos.`
      }]);
      setIsValidTable(true);
      return true;
    } else {
      setIsValidTable(true);
      return true;
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setErrors([]);
    setWarnings([]);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_URL}/preview/excel`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error previsualizando archivo');
      }
      const data = await response.json();
      const hasEmptySheets = Object.values(data.sheets_data).some(sheet => sheet.is_empty);
      if (hasEmptySheets) {
        setErrors([{
          batch: 'Advertencia',
          error: 'Algunas hojas del Excel están vacías'
        }]);
      }
      setPreviewData(data);
      if (data.sheet_names.length > 0) {
        const firstSheet = data.sheet_names[0];
        setSelectedSheet(firstSheet);
        const sheetData = data.sheets_data[firstSheet];
        setTableData(sheetData.preview_data);
        setColumns(sheetData.columns);
        validateColumns(sheetData.columns);
      }
    } catch (error) {
      setErrors([{
        batch: 'Sistema',
        error: error.message || 'Error al previsualizar archivo'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    const sheetData = previewData.sheets_data[sheetName];
    setTableData(sheetData.preview_data);
    setColumns(sheetData.columns);
    setWarnings([]);
    validateColumns(sheetData.columns);
  };

  const handleDeleteRow = (index) => {
    const newData = tableData.filter((_, i) => i !== index);
    setTableData(newData);
  };

  const handleInsertToDatabase = () => {
    if (!tableData || tableData.length === 0) {
      setErrors([{
        batch: 'Advertencia',
        error: '⚠️ No hay datos para insertar. La tabla está vacía.'
      }]);
      return;
    }
    if (!isValidTable) {
      setErrors([{
        batch: 'Error',
        error: '❌ No se puede insertar. El archivo no tiene columnas válidas.'
      }]);
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmInsert = async () => {
    setShowConfirmModal(false);
    setUploading(true);
    setProgress(0);
    setErrors([]);
    setResult(null);
    try {
      const insertData = {
        filename: previewData.filename,
        sheet_name: selectedSheet,
        data: tableData
      };
      const response = await fetch(`${API_URL}/insert/excel`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(insertData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error insertando datos');
      }
      const data = await response.json();
      if (data.progress_updates && data.progress_updates.length > 0) {
        for (let i = 0; i < data.progress_updates.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setProgress(data.progress_updates[i].percentage);
        }
      }
      setResult(data);
    } catch (error) {
      setErrors([{
        batch: 'Sistema',
        error: error.message || 'Error al insertar datos'
      }]);
    } finally {
      setUploading(false);
    }
  };

  const cancelInsert = () => {
    setShowConfirmModal(false);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#c4b5d6', font: { size: 12 } }
      }
    },
    scales: {
      x: { ticks: { color: '#c4b5d6' }, grid: { color: '#3a2d52' } },
      y: { ticks: { color: '#c4b5d6' }, grid: { color: '#3a2d52' } }
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f0b15 0%,#1a1525 50%,#251d35 100%)',padding:'1rem'}}>
      <div className="max-w-7xl mx-auto">
        <div style={{background:'#1a1525',borderRadius:'1.5rem',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.5)',padding:'1.5rem',border:'1px solid #3a2d52'}}>
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 p-4 rounded-2xl mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <h1 style={{fontSize:'2.25rem',fontWeight:'800',background:'linear-gradient(90deg,#8d43ad,#a855f7)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'0.5rem'}}>Excel Loader Pro v2.5</h1>
            <p style={{color:'#c4b5d6'}}>Vista previa, edición y carga inteligente con gráficos</p>
          </div>
          <div className="space-y-6">
            <div style={{border:'2px dashed #5a4f7c',borderRadius:'0.75rem',padding:'2rem',textAlign:'center',background:'#251d35',cursor:'pointer'}}>
              <input type="file" accept=".xlsx,.xls,.xlsm" onChange={handleFileChange} className="hidden" id="file-input" disabled={loading||uploading}/>
              <label htmlFor="file-input" className="cursor-pointer block">
                <div className="text-6xl mb-4">{file?'✅':'📁'}</div>
                <p style={{fontSize:'1.25rem',fontWeight:'bold',color:'#f1f0f7',marginBottom:'0.5rem'}}>{file?file.name:'Selecciona tu archivo Excel'}</p>
                <p style={{fontSize:'0.875rem',color:'#8b7da8'}}>Formatos: .xlsx, .xls, .xlsm</p>
              </label>
            </div>
            {file&&!previewData&&(<button onClick={handlePreview} disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#5a4f7c,#8d43ad)',color:'white',fontWeight:'bold',padding:'1rem 1.5rem',borderRadius:'0.75rem',fontSize:'1.125rem',border:'none',cursor:loading?'not-allowed':'pointer',opacity:loading?0.5:1}}>{loading?'🔄 Cargando...':'👁️ Previsualizar Excel'}</button>)}
            
            {warnings.length>0&&(<div style={{background:isValidTable?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)',border:`4px solid ${isValidTable?'#f59e0b':'#ef4444'}`,borderRadius:'0.75rem',padding:'1.5rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem'}}><span style={{fontSize:'2.5rem'}}>{isValidTable?'⚠️':'❌'}</span><h3 style={{fontSize:'1.25rem',fontWeight:'bold',color:isValidTable?'#f59e0b':'#ef4444'}}>{isValidTable?'Advertencias de Columnas':'Error Crítico de Validación'}</h3></div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>{warnings.map((warn,idx)=>(<div key={idx} style={{background:'#1a1525',padding:'0.75rem',borderRadius:'0.5rem',border:'1px solid #3a2d52'}}><p style={{fontSize:'0.875rem',color:isValidTable?'#f59e0b':'#ef4444',whiteSpace:'pre-wrap'}}>{warn.message}</p></div>))}</div>
            </div>)}

            {previewData&&(<div style={{background:'linear-gradient(135deg,#3e1a6b,#2a1f3d)',padding:'1.25rem',borderRadius:'0.75rem',border:'1px solid #5a4f7c'}}>
              <label style={{display:'block',fontSize:'1.125rem',fontWeight:'bold',color:'#f1f0f7',marginBottom:'0.75rem'}}>📑 Selecciona una hoja ({previewData.total_sheets} hojas encontradas):</label>
              <div className="flex flex-wrap gap-2">{previewData.sheet_names.map((sheetName)=>{const sheetInfo=previewData.sheets_data[sheetName];return(<button key={sheetName} onClick={()=>handleSheetChange(sheetName)} style={{padding:'0.5rem 1rem',borderRadius:'0.5rem',fontWeight:'600',border:'none',cursor:'pointer',background:selectedSheet===sheetName?'linear-gradient(90deg,#5a4f7c,#8d43ad)':'#251d35',color:'white'}}>{sheetName}<span style={{marginLeft:'0.5rem',fontSize:'0.75rem'}}>({sheetInfo.total_rows} filas)</span>{sheetInfo.is_empty&&<span style={{marginLeft:'0.5rem'}}>⚠️</span>}</button>);})}</div>
            </div>)}

            {chartData&&(<div style={{background:'#1a1525',padding:'1.5rem',borderRadius:'0.75rem',border:'1px solid #3a2d52',marginBottom:'1.5rem'}}>
              <h3 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#f1f0f7',marginBottom:'1.5rem',textAlign:'center'}}>📊 Visualización de Datos</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'1.5rem'}}>
                {chartData.categorias&&(<div style={{background:'#251d35',padding:'1rem',borderRadius:'0.5rem',border:'1px solid #3a2d52',height:'300px'}}><Bar data={chartData.categorias} options={chartOptions}/></div>)}
                {chartData.activos&&(<div style={{background:'#251d35',padding:'1rem',borderRadius:'0.5rem',border:'1px solid #3a2d52',height:'300px'}}><Pie data={chartData.activos} options={{...chartOptions,scales:undefined}}/></div>)}
                {chartData.precios&&(<div style={{background:'#251d35',padding:'1rem',borderRadius:'0.5rem',border:'1px solid #3a2d52',height:'300px'}}><Line data={chartData.precios} options={chartOptions}/></div>)}
              </div>
            </div>)}

            {tableData.length>0&&(<div className="space-y-4">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,#2a1f3d,#3e1a6b)',padding:'1rem',borderRadius:'0.5rem',border:'1px solid #5a4f7c'}}>
                <div><h3 style={{fontSize:'1.125rem',fontWeight:'bold',color:'#f1f0f7'}}>📊 Vista Previa: {selectedSheet}</h3><p style={{fontSize:'0.875rem',color:'#c4b5d6'}}>{tableData.length} filas • {columns.length} columnas</p></div>
                <button onClick={()=>setTableData([])} style={{padding:'0.5rem 0.75rem',background:'#ef4444',color:'white',borderRadius:'0.5rem',fontSize:'0.875rem',fontWeight:'600',border:'none',cursor:'pointer'}}>🗑️ Limpiar Todo</button>
              </div>
              <div style={{maxHeight:'24rem',overflow:'auto',border:'2px solid #3a2d52',borderRadius:'0.5rem',background:'#1a1525'}}>
                <table style={{width:'100%',fontSize:'0.875rem',borderCollapse:'collapse'}}>
                  <thead style={{background:'linear-gradient(135deg,#3e1a6b,#5a4f7c)',color:'white',position:'sticky',top:0}}>
                    <tr><th style={{padding:'0.75rem',textAlign:'left'}}>#</th>{columns.map((col,idx)=><th key={idx} style={{padding:'0.75rem',textAlign:'left'}}>{col}</th>)}<th style={{padding:'0.75rem',textAlign:'center'}}>Acciones</th></tr>
                  </thead>
                  <tbody>{tableData.map((row,rowIdx)=>(<tr key={rowIdx} style={{borderBottom:'1px solid #3a2d52'}}><td style={{padding:'0.75rem',fontWeight:'600',color:'#c4b5d6'}}>{rowIdx+1}</td>{columns.map((col,colIdx)=><td key={colIdx} style={{padding:'0.75rem',color:'#c4b5d6'}}>{String(row[col]||'')}</td>)}<td style={{padding:'0.75rem',textAlign:'center'}}><button onClick={()=>handleDeleteRow(rowIdx)} style={{padding:'0.25rem 0.5rem',background:'#ef4444',color:'white',borderRadius:'0.25rem',fontSize:'0.75rem',border:'none',cursor:'pointer'}}>🗑️</button></td></tr>))}</tbody>
                </table>
              </div>
              <div style={{background:'linear-gradient(135deg,#251d35,#2a1f3d)',padding:'1.25rem',borderRadius:'0.5rem',border:'1px solid #3a2d52'}}>
                <h4 style={{fontSize:'1.125rem',fontWeight:'bold',color:'#f1f0f7',marginBottom:'0.75rem'}}>📈 Estadísticas</h4>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
                  <div style={{background:'#1a1525',padding:'1rem',borderRadius:'0.5rem',textAlign:'center',border:'1px solid #3a2d52'}}><p style={{fontSize:'1.875rem',fontWeight:'bold',color:'#8d43ad'}}>{tableData.length}</p><p style={{fontSize:'0.75rem',color:'#8b7da8'}}>Filas</p></div>
                  <div style={{background:'#1a1525',padding:'1rem',borderRadius:'0.5rem',textAlign:'center',border:'1px solid #3a2d52'}}><p style={{fontSize:'1.875rem',fontWeight:'bold',color:'#5a4f7c'}}>{columns.length}</p><p style={{fontSize:'0.75rem',color:'#8b7da8'}}>Columnas</p></div>
                  <div style={{background:'#1a1525',padding:'1rem',borderRadius:'0.5rem',textAlign:'center',border:'1px solid #3a2d52'}}><p style={{fontSize:'1.875rem',fontWeight:'bold',color:'#a855f7'}}>{(tableData.length*columns.length).toLocaleString()}</p><p style={{fontSize:'0.75rem',color:'#8b7da8'}}>Celdas</p></div>
                </div>
              </div>
              {!uploading&&!result&&(<button onClick={handleInsertToDatabase} disabled={!isValidTable} style={{width:'100%',background:isValidTable?'linear-gradient(135deg,#10b981,#14b8a6)':'#3a2d52',color:'white',fontWeight:'bold',padding:'1rem 1.5rem',borderRadius:'0.75rem',fontSize:'1.125rem',border:'none',cursor:isValidTable?'pointer':'not-allowed',opacity:isValidTable?1:0.5}}>{isValidTable?'💾 Insertar a Base de Datos':'⛔ Archivo No Válido - No Se Puede Subir'}</button>)}
            </div>)}
            {uploading&&(<div style={{background:'#1a1525',padding:'1.25rem',borderRadius:'0.75rem',border:'1px solid #3a2d52'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}><span style={{fontWeight:'bold',color:'#f1f0f7'}}>Insertando datos...</span><span style={{fontSize:'1.25rem',fontWeight:'bold',color:'#10b981'}}>{progress}%</span></div>
              <div style={{width:'100%',background:'#2a1f3d',borderRadius:'9999px',height:'1.5rem',overflow:'hidden'}}><div style={{background:'linear-gradient(90deg,#10b981,#14b8a6)',height:'1.5rem',borderRadius:'9999px',transition:'width 0.3s',width:`${progress}%`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'0.75rem',fontWeight:'bold'}}>{progress>10&&`${progress}%`}</div></div>
            </div>)}
            {result&&(<div style={{background:'rgba(16,185,129,0.1)',border:'4px solid #10b981',padding:'1.5rem',borderRadius:'0.75rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}><span style={{fontSize:'3rem'}}>✅</span><div><h3 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#10b981'}}>¡Datos Insertados Exitosamente!</h3><p style={{color:'#c4b5d6'}}>{result.rows_inserted} filas guardadas</p><p style={{fontSize:'0.875rem',color:'#8b7da8'}}>Batch: {result.batch_id}</p></div></div>
            </div>)}
            {errors.length>0&&(<div style={{background:'rgba(239,68,68,0.1)',border:'4px solid #ef4444',borderRadius:'0.75rem',padding:'1.5rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem'}}><span style={{fontSize:'2.5rem'}}>❌</span><h3 style={{fontSize:'1.25rem',fontWeight:'bold',color:'#ef4444'}}>Errores ({errors.length})</h3></div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>{errors.map((error,idx)=>(<div key={idx} style={{background:'#1a1525',padding:'0.75rem',borderRadius:'0.5rem',border:'1px solid #3a2d52'}}><p style={{fontSize:'0.875rem',fontWeight:'bold',color:'#ef4444'}}>{error.batch}:</p><p style={{fontSize:'0.875rem',color:'#c4b5d6'}}>{error.error}</p></div>))}</div>
            </div>)}
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:'1.5rem',color:'#8b7da8',fontSize:'0.875rem'}}>Excel Loader Pro v2.5 | FastAPI + React + MySQL + Chart.js</div>
      </div>
      {showConfirmModal&&(<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
        <div style={{background:'#1a1525',borderRadius:'1rem',padding:'2rem',maxWidth:'500px',width:'90%',border:'2px solid #5a4f7c',boxShadow:'0 10px 40px rgba(138,67,173,0.5)'}}>
          <div style={{textAlign:'center',marginBottom:'1.5rem'}}><span style={{fontSize:'4rem'}}>⚠️</span><h2 style={{fontSize:'1.5rem',fontWeight:'bold',color:'#f1f0f7',marginTop:'1rem',marginBottom:'0.5rem'}}>¿Confirmar inserción?</h2></div>
          <div style={{background:'#251d35',padding:'1rem',borderRadius:'0.5rem',marginBottom:'1.5rem',border:'1px solid #3a2d52'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}><span style={{color:'#c4b5d6',fontWeight:'600'}}>📄 Archivo:</span><span style={{color:'#f1f0f7',fontWeight:'bold'}}>{previewData?.filename}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}><span style={{color:'#c4b5d6',fontWeight:'600'}}>📑 Hoja:</span><span style={{color:'#a855f7',fontWeight:'bold'}}>{selectedSheet}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#c4b5d6',fontWeight:'600'}}>📊 Filas a insertar:</span><span style={{color:'#10b981',fontWeight:'bold',fontSize:'1.25rem'}}>{tableData.length}</span></div>
          </div>
          <p style={{textAlign:'center',color:'#c4b5d6',marginBottom:'1.5rem',fontSize:'0.875rem'}}>¿Realmente deseas insertar estos datos en la base de datos?</p>
          <div style={{display:'flex',gap:'1rem'}}>
            <button onClick={cancelInsert} style={{flex:1,padding:'0.75rem 1.5rem',background:'#3a2d52',color:'#f1f0f7',border:'2px solid #5a4f7c',borderRadius:'0.5rem',fontSize:'1rem',fontWeight:'600',cursor:'pointer'}}>❌ Cancelar</button>
            <button onClick={confirmInsert} style={{flex:1,padding:'0.75rem 1.5rem',background:'linear-gradient(135deg,#10b981,#14b8a6)',color:'white',border:'none',borderRadius:'0.5rem',fontSize:'1rem',fontWeight:'600',cursor:'pointer'}}>✅ Confirmar</button>
          </div>
        </div>
      </div>)}
    </div>
  );
}
