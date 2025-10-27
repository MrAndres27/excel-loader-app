import { useState } from 'react';

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

  const API_URL = 'http://localhost:9200';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData(null);
      setSelectedSheet('');
      setTableData([]);
      setResult(null);
      setErrors([]);
      setProgress(0);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setErrors([]);

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
  };

  const handleDeleteRow = (index) => {
    const newData = tableData.filter((_, i) => i !== index);
    setTableData(newData);
  };

  const handleInsertToDatabase = async () => {
    if (!tableData || tableData.length === 0) {
      setErrors([{
        batch: 'Advertencia',
        error: '⚠️ No hay datos para insertar. La tabla está vacía.'
      }]);
      return;
    }

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
        headers: {
          'Content-Type': 'application/json',
        },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 p-4 rounded-2xl mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
              Excel Loader Pro v2.5
            </h1>
            <p className="text-gray-600">Vista previa, edición y carga inteligente</p>
          </div>

          <div className="space-y-6">
            
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center bg-purple-50 hover:bg-purple-100 transition-all cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
                disabled={loading || uploading}
              />
              <label htmlFor="file-input" className="cursor-pointer block">
                <div className="text-6xl mb-4">
                  {file ? '✅' : '📁'}
                </div>
                <p className="text-xl font-bold text-gray-800 mb-2">
                  {file ? file.name : 'Selecciona tu archivo Excel'}
                </p>
                <p className="text-sm text-gray-600">
                  Formatos: .xlsx, .xls, .xlsm
                </p>
              </label>
            </div>

            {file && !previewData && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg text-lg disabled:opacity-50"
              >
                {loading ? '🔄 Cargando...' : '👁️ Previsualizar Excel'}
              </button>
            )}

            {previewData && (
              <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-5 rounded-xl">
                <label className="block text-lg font-bold text-gray-800 mb-3">
                  📑 Selecciona una hoja ({previewData.total_sheets} hojas encontradas):
                </label>
                <div className="flex flex-wrap gap-2">
                  {previewData.sheet_names.map((sheetName) => {
                    const sheetInfo = previewData.sheets_data[sheetName];
                    return (
                      <button
                        key={sheetName}
                        onClick={() => handleSheetChange(sheetName)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                          selectedSheet === sheetName
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {sheetName}
                        <span className="ml-2 text-xs">
                          ({sheetInfo.total_rows} filas)
                        </span>
                        {sheetInfo.is_empty && (
                          <span className="ml-2">⚠️</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tableData.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gradient-to-r from-green-100 to-cyan-100 p-4 rounded-lg">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      📊 Vista Previa: {selectedSheet}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {tableData.length} filas • {columns.length} columnas
                    </p>
                  </div>
                  <button
                    onClick={() => setTableData([])}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold"
                  >
                    🗑️ Limpiar Todo
                  </button>
                </div>

                <div className="overflow-auto max-h-96 border-2 border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-purple-500 to-blue-500 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        {columns.map((col, idx) => (
                          <th key={idx} className="px-3 py-2 text-left">
                            {col}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b hover:bg-purple-50">
                          <td className="px-3 py-2 font-semibold">{rowIdx + 1}</td>
                          {columns.map((col, colIdx) => (
                            <td key={colIdx} className="px-3 py-2">
                              {String(row[col] || '')}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(rowIdx)}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-5 rounded-lg">
                  <h4 className="text-lg font-bold text-gray-800 mb-3">📈 Estadísticas</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                      <p className="text-3xl font-bold text-purple-600">{tableData.length}</p>
                      <p className="text-xs text-gray-600">Filas</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                      <p className="text-3xl font-bold text-blue-600">{columns.length}</p>
                      <p className="text-xs text-gray-600">Columnas</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                      <p className="text-3xl font-bold text-cyan-600">
                        {(tableData.length * columns.length).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">Celdas</p>
                    </div>
                  </div>
                </div>

                {!uploading && !result && (
                  <button
                    onClick={handleInsertToDatabase}
                    className="w-full bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-700 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg text-lg"
                  >
                    💾 Insertar a Base de Datos
                  </button>
                )}
              </div>
            )}

            {uploading && (
              <div className="space-y-3 bg-gray-50 p-5 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">Insertando datos...</span>
                  <span className="text-xl font-bold text-green-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-6 rounded-full transition-all duration-300 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${progress}%` }}
                  >
                    {progress > 10 && `${progress}%`}
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-green-50 border-4 border-green-400 p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">✅</span>
                  <div>
                    <h3 className="text-2xl font-bold text-green-800">
                      ¡Datos Insertados Exitosamente!
                    </h3>
                    <p className="text-gray-700">
                      {result.rows_inserted} filas guardadas
                    </p>
                    <p className="text-sm text-gray-600">Batch: {result.batch_id}</p>
                  </div>
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-red-50 border-4 border-red-300 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">❌</span>
                  <h3 className="text-xl font-bold text-red-800">
                    Errores ({errors.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {errors.map((error, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-red-200">
                      <p className="text-sm font-bold text-red-600">{error.batch}:</p>
                      <p className="text-sm text-gray-800">{error.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-gray-600 text-sm">
          Excel Loader Pro v2.5 | FastAPI + React + MySQL
        </div>
      </div>
    </div>
  );
}
