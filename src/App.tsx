import React, { useState, useMemo, useCallback } from "react";
import { 
  FileUp, 
  Settings, 
  BarChart3, 
  Fingerprint, 
  PieChart, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  CheckCircle2, 
  Database, 
  Zap,
  Info,
  BrainCircuit,
  LayoutDashboard,
  ShieldAlert,
  ArrowRight,
  Download,
  FileJson,
  Image as ImageIcon,
  Loader2,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from "recharts";

import { 
  getCorrelationMatrix, 
  scaleData, 
  calculateElbow, 
  runClustering, 
  getDescriptiveStats,
  ScalerType
} from "./lib/data-utils";
import { summarizeBusinessGoals, interpretClusters } from "./services/ai-service";
import { 
  exportToCSV, 
  exportToPNG, 
  generateProfessionalPDF 
} from "./services/export-service";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface StepData {
  businessGoals: string;
  businessSummary: string;
  businessCore: string;
  rawFile: File | null;
  data: any[];
  headers: string[];
  selectedFeatures: string[];
  stats: any;
  scaledData: number[][];
  scaler: ScalerType;
  optimalK: number;
  elbowData: { k: number; error: number }[];
  clusters: number[];
  centroids: number[][];
  interpretations: any[];
}

const STEPS = [
  "Objetivos", "Carga", "Variables", "EDA", "Correlación", 
  "Normalización", "Optimización", "Clusterización", "Interpretación", "Perfiles"
];

// --- Step Sub-Components (Moved outside App to avoid re-renders on keystrokes) ---

interface StepProps {
  key?: string;
  state: StepData;
  setState: React.Dispatch<React.SetStateAction<StepData>>;
  onNext: () => void;
  onPrev?: () => void;
  handlePrev?: () => void;
  loading?: boolean;
  processBusinessSummary?: () => void;
  handleFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  calculateEDA?: () => void;
  runScaling?: (type: ScalerType) => void;
  executeClustering?: () => void;
  getAIInterpretation?: () => void;
  handleExportPDF?: () => void;
  noAnim?: boolean;
}

const StepWrapper = ({ title, description, children, onNext, onPrev, nextLabel = "Siguiente", isLoading = false, noAnim = false }: any) => (
  <motion.div 
    initial={noAnim ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={noAnim ? { duration: 0 } : {}}
    className="max-w-7xl mx-auto"
  >
    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-brand-dark/10 pb-6 gap-4">
      <div>
        <h2 className="text-4xl font-black text-brand-dark tracking-tighter uppercase">{title}</h2>
        <p className="text-brand-dark/50 mt-1 max-w-2xl text-xs font-mono uppercase">{description}</p>
      </div>
      <div className="flex gap-2">
        {onPrev && (
          <button 
            onClick={onPrev}
            className="flex items-center gap-2 px-5 py-2 border border-brand-dark text-brand-dark font-bold uppercase transition-all text-[10px] hover:bg-brand-dark hover:text-brand-bg"
          >
            <ChevronLeft size={14} /> Atrás
          </button>
        )}
        {onNext && (
          <button 
            onClick={onNext}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-brand-dark text-brand-bg font-bold uppercase transition-all text-[10px] disabled:opacity-50"
          >
            {isLoading ? "Procesando..." : nextLabel} <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
    <div className="min-h-[400px]">
      {children}
    </div>
  </motion.div>
);

const Step0Business = ({ state, setState, processBusinessSummary, loading, noAnim }: StepProps) => (
  <StepWrapper 
    title="01. Business Context"
    description="Define el marco estratégico de tu análisis."
    onNext={processBusinessSummary}
    isLoading={loading}
    noAnim={noAnim}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="export-business">
      <div className="bg-white border border-brand-dark p-8 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-[10px] font-bold text-brand-dark/40 uppercase tracking-widest font-mono">Objetivo del Análisis</label>
          <div className="flex gap-2">
            {[
              { label: "Retail", text: "Quiero segmentar mis clientes por frecuencia de compra y ticket promedio para personalizar ofertas." },
              { label: "Finanzas", text: "Busco identificar grupos de riesgo crediticio basados en ingresos y puntualidad de pagos." }
            ].map(t => (
              <button 
                key={t.label}
                onClick={() => setState(prev => ({ ...prev, businessGoals: t.text }))}
                className="text-[9px] font-mono border border-brand-dark/10 px-2 py-1 hover:bg-brand-dark hover:text-brand-bg transition-all uppercase font-bold"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <textarea 
          value={state.businessGoals}
          onChange={(e) => setState(prev => ({ ...prev, businessGoals: e.target.value }))}
          className="w-full flex-1 min-h-[300px] bg-gray-50 border border-brand-dark/10 p-5 text-brand-dark focus:outline-none focus:border-brand-dark placeholder:text-brand-dark/20 resize-none transition-all font-mono text-sm leading-relaxed"
          placeholder="Ej: Quiero segmentar mi base de clientes minoristas..."
        />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 items-start bg-white border border-brand-dark p-6">
          <Info className="text-brand-dark shrink-0 mt-1" size={20} />
          <div>
            <h4 className="text-brand-dark font-bold text-xs uppercase mb-1">Strategic Logic</h4>
            <p className="text-brand-dark/60 text-xs leading-relaxed">El clustering no tiene una 'respuesta correcta' absoluta. Los mejores clusters son los que resuelven tus preguntas de negocio específicas.</p>
          </div>
        </div>
        <div className="flex gap-4 items-start bg-brand-dark p-6 text-brand-bg">
          <BrainCircuit className="text-emerald-400 shrink-0 mt-1" size={20} />
          <div>
            <h4 className="text-brand-bg font-bold text-xs uppercase mb-1">AI Interpretation Engine</h4>
            <p className="text-brand-bg/60 text-xs leading-relaxed">Tu descripción será analizada por Gemini para sugerir KPIs y enfoques analíticos personalizados.</p>
          </div>
        </div>
      </div>
    </div>
  </StepWrapper>
);

const Step1DataLoad = ({ state, handleFileUpload, calculateEDA, handlePrev, loading }: StepProps) => (
  <StepWrapper 
    title="02. Data Ingestion"
    description="Sube tu conjunto de datos. Soportamos formatos CSV, Excel y JSON."
    onPrev={handlePrev}
    onNext={state.data.length > 0 ? calculateEDA : null}
    isLoading={loading}
  >
    <div className="bg-white border border-brand-dark h-[400px] flex flex-col items-center justify-center p-10 transition-all hover:bg-gray-100 group">
      <div className="w-16 h-16 bg-brand-dark/5 border border-brand-dark flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <FileUp size={30} className="text-brand-dark" />
      </div>
      <h3 className="text-xl font-bold text-brand-dark mb-1 uppercase">Drop dataset here</h3>
      <p className="text-brand-dark/40 mb-8 max-w-sm text-center text-[10px] font-mono uppercase">Accepted: .csv, .xlsx, .xls</p>
      <input 
        type="file" 
        onChange={handleFileUpload}
        className="hidden" 
        id="fileInput" 
        accept=".csv,.xlsx,.xls"
      />
      <label 
        htmlFor="fileInput"
        className="px-8 py-3 bg-brand-dark text-brand-bg text-[10px] font-bold uppercase cursor-pointer hover:opacity-90 transition-all"
      >
        Select File
      </label>
      {state.rawFile && (
        <div className="mt-8 flex items-center gap-3 bg-emerald-100 text-emerald-700 px-4 py-2 border border-emerald-300">
          <CheckCircle2 size={14} />
          <span className="font-mono text-[10px] uppercase font-bold">{state.rawFile.name} | {state.data.length} records detected</span>
        </div>
      )}
    </div>
  </StepWrapper>
);

const Step2Features = ({ state, setState, handlePrev, onNext }: StepProps) => (
  <StepWrapper 
    title="03. Feature Selection"
    description="Elige las variables que crees que mejor definen a tus segmentos."
    onPrev={handlePrev}
    onNext={onNext}
  >
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0 border-t border-l border-brand-dark">
      {state.headers.map(header => {
        const isSelected = state.selectedFeatures.includes(header);
        const isNumeric = state.stats[header]?.count > 0;
        return (
          <button
            key={header}
            onClick={() => {
              setState(prev => ({
                ...prev,
                selectedFeatures: isSelected 
                  ? prev.selectedFeatures.filter(f => f !== header)
                  : [...prev.selectedFeatures, header]
              }))
            }}
            className={cn(
              "p-4 border-r border-b border-brand-dark text-left transition-all relative overflow-hidden",
              isSelected 
                ? "bg-brand-dark text-brand-bg" 
                : "bg-white text-brand-dark/50 hover:bg-gray-100"
            )}
          >
            <span className="text-[9px] font-mono mb-1 block opacity-50 font-bold uppercase">{isNumeric ? "Numeric" : "Categoric"}</span>
            <span className="font-bold truncate block text-xs uppercase">{header}</span>
            {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 size={12} /></div>}
          </button>
        )
      })}
    </div>
  </StepWrapper>
);

const Step3EDA = ({ state, handlePrev, onNext, noAnim }: StepProps) => (
  <StepWrapper 
    title="04. Statistical Overview"
    description="Visualiza la distribución y salud de tus datos."
    onPrev={handlePrev}
    onNext={onNext}
    noAnim={noAnim}
  >
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="export-eda">
      <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto border border-brand-dark bg-white p-4">
         <h4 className="text-[10px] font-mono uppercase font-bold border-b border-gray-100 pb-2 mb-4">Metric Breakdowns</h4>
        {state.selectedFeatures.map(f => (
          <div key={f} className="bg-gray-50 p-4 border border-brand-dark/10">
            <h4 className="text-brand-dark font-bold text-xs uppercase mb-3">{f}</h4>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="flex justify-between border-b border-brand-dark/5 pb-1"><span className="opacity-40">Mean</span> <span>{state.stats[f]?.mean}</span></div>
              <div className="flex justify-between border-b border-brand-dark/5 pb-1"><span className="opacity-40">Max</span> <span>{state.stats[f]?.max}</span></div>
              <div className="flex justify-between border-b border-brand-dark/5 pb-1"><span className="opacity-40">STD</span> <span>{state.stats[f]?.std}</span></div>
              <div className="flex justify-between border-b border-brand-dark/5 pb-1"><span className="opacity-40">N</span> <span>{state.stats[f]?.count}</span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-2 bg-white p-8 border border-brand-dark">
         <h4 className="text-xs font-mono font-bold uppercase mb-8 border-b border-gray-100 pb-2">Distribuition Matrix (Top 5 Features)</h4>
         <div className="h-[400px]">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={state.selectedFeatures.slice(0, 5).map(f => ({ name: f, mean: parseFloat(state.stats[f]?.mean || 0) }))}>
               <CartesianGrid strokeDasharray="1 1" stroke="#14141410" vertical={false} />
               <XAxis dataKey="name" stroke="#141414" fontSize={10} axisLine={true} tickLine={false} />
               <YAxis stroke="#141414" fontSize={10} axisLine={true} tickLine={false} />
               <RechartsTooltip contentStyle={{ backgroundColor: "#141414", border: "none", borderRadius: "0px", color: "#E4E3E0", fontSize: "10px" }} />
               <Bar dataKey="mean" fill="#141414" radius={0} />
             </BarChart>
           </ResponsiveContainer>
         </div>
      </div>
    </div>
  </StepWrapper>
);

const Step4Correlation = ({ state, handlePrev, onNext, noAnim }: StepProps) => {
  const [threshold, setThreshold] = useState(0);
  const [showStrongOnly, setShowStrongOnly] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<any>(null);

  const numericFeatures = useMemo(() => 
    state.selectedFeatures.filter(f => state.stats[f]?.count > 0),
    [state.selectedFeatures, state.stats]
  );
  
  const numericData = useMemo(() => 
    state.data.map(row => 
      numericFeatures.map(f => parseFloat(row[f]) || 0)
    ),
    [state.data, numericFeatures]
  );

  const corrMatrix = useMemo(() => 
    getCorrelationMatrix(numericData, numericFeatures), 
    [numericData, numericFeatures]
  );

  const corrMap = useMemo(() => {
    const map = new Map<string, number>();
    corrMatrix.forEach(entry => {
      map.set(`${entry.x}|${entry.y}`, entry.value);
    });
    return map;
  }, [corrMatrix]);

  // Color mapping: Blue (-1) -> Blue/White -> White (0) -> Red/White -> Red (1)
  const getColor = (val: number) => {
    const absVal = Math.abs(val);
    if (showStrongOnly && absVal < 0.7 && val !== 1) return "transparent";
    if (absVal < threshold && val !== 1) return "transparent";

    if (val > 0) {
      return `rgba(239, 68, 68, ${absVal})`; // Red
    } else if (val < 0) {
      return `rgba(59, 130, 246, ${absVal})`; // Blue
    }
    return "transparent";
  };

  const getTextColor = (val: number) => {
    if (Math.abs(val) > 0.5) return "#fff";
    return "#141414";
  };

  return (
    <StepWrapper 
      title="05. Correlation Helix"
      description="Matriz exhaustiva de interdependencias. Identifica patrones de redundancia y relaciones críticas."
      onPrev={handlePrev}
      onNext={onNext}
      noAnim={noAnim}
    >
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Controls */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white border border-brand-dark p-6 space-y-8">
            <div>
              <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest text-brand-dark/40">Parámetros de Filtro</h4>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold uppercase">Umbral de fuerza</span>
                    <span className="text-[11px] font-mono font-bold bg-brand-dark text-brand-bg px-2 py-0.5">{threshold.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="0.8" 
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full h-1 bg-brand-dark/10 rounded-lg appearance-none cursor-pointer accent-brand-dark"
                  />
                  <div className="flex justify-between mt-2 text-[8px] font-mono uppercase opacity-30">
                    <span>Todas</span>
                    <span>Solo Extremas</span>
                  </div>
                </div>

                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setShowStrongOnly(!showStrongOnly)}>
                  <span className="text-[11px] font-bold uppercase group-hover:text-emerald-600 transition-colors">Modo Crítico ({">"}0.7)</span>
                  <div className={cn(
                    "w-8 h-4 rounded-full transition-all relative border border-brand-dark",
                    showStrongOnly ? "bg-emerald-500" : "bg-gray-100"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-brand-dark transition-all",
                      showStrongOnly ? "right-0.5" : "left-0.5"
                    )} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest text-brand-dark/40">Interpretación Visual</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded-sm" />
                  <span className="text-[10px] font-bold uppercase">Correlación Positiva</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 rounded-sm" />
                  <span className="text-[10px] font-bold uppercase">Correlación Negativa</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-gray-100 border border-brand-dark/10 rounded-sm" />
                  <span className="text-[10px] font-bold uppercase">Independencia</span>
                </div>
              </div>
            </div>
          </div>

          {hoveredCell ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-dark p-6 text-brand-bg space-y-4"
            >
              <div>
                <span className="text-[9px] font-mono uppercase opacity-40">Variables Comparadas</span>
                <p className="text-xs font-bold uppercase mt-1 leading-tight">{hoveredCell.x} <span className="text-emerald-400">×</span> {hoveredCell.y}</p>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[9px] font-mono uppercase opacity-40">Coeficiente Pearson</span>
                  <p className="text-3xl font-black leading-none mt-1">{hoveredCell.value.toFixed(3)}</p>
                </div>
                <div className={cn(
                  "text-[8px] font-black px-2 py-1 uppercase",
                  Math.abs(hoveredCell.value) > 0.7 ? "bg-red-500" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {Math.abs(hoveredCell.value) > 0.7 ? "Alerta: Redundancia" : "Relación Saludable"}
                </div>
              </div>
            </motion.div>
          ) : (
             <div className="bg-gray-100 border border-dashed border-brand-dark/20 p-6 text-center">
                <p className="text-[10px] font-mono uppercase opacity-40 italic">Pasa el cursor sobre un nodo para ver detalles</p>
             </div>
          )}
        </div>

        {/* The Matrix Heatmap */}
        <div className="xl:col-span-4 bg-white border border-brand-dark p-10 overflow-auto scrollbar-hide" id="export-correlation">
          <div className="inline-block min-w-full">
            <div 
              className="grid gap-1"
              style={{ 
                gridTemplateColumns: `repeat(${numericFeatures.length + 1}, minmax(60px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="h-12" />
              {numericFeatures.map(f => (
                <div key={`h-${f}`} className="h-12 flex items-center justify-center p-2">
                  <span className="text-[9px] font-black uppercase text-brand-dark/40 rotate-[-45deg] whitespace-nowrap block w-full text-center truncate">
                    {f}
                  </span>
                </div>
              ))}

              {/* Rows */}
              {numericFeatures.map((rowVar, i) => (
                <React.Fragment key={`row-${rowVar}`}>
                  {/* Row Label */}
                  <div className="flex items-center justify-end pr-4 h-12">
                    <span className="text-[9px] font-black uppercase text-brand-dark/40 text-right truncate max-w-[100px]">
                      {rowVar}
                    </span>
                  </div>
                  
                  {/* Cells */}
                  {numericFeatures.map((colVar, j) => {
                    const val = corrMap.get(`${rowVar}|${colVar}`) ?? 0;
                    const color = getColor(val);
                    const textColor = getTextColor(val);
                    const isDiagonal = i === j;

                    return (
                      <motion.div
                        key={`${rowVar}-${colVar}`}
                        whileHover={{ scale: 0.92, zIndex: 10, borderRadius: "2px" }}
                        onMouseEnter={() => setHoveredCell({ x: rowVar, y: colVar, value: val })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={cn(
                          "h-12 flex items-center justify-center cursor-crosshair transition-all duration-200 border-[0.5px] border-black/5 relative group/cell",
                          isDiagonal ? "bg-gray-100/50" : "bg-white"
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {Math.abs(val) > (threshold > 0.1 ? threshold : -1) && (
                          <span 
                            className="text-[9px] font-mono font-bold select-none pointer-events-none"
                            style={{ color: textColor, opacity: Math.abs(val) > 0.2 ? 1 : 0.1 }}
                          >
                            {val === 1 ? "1.0" : val.toFixed(2)}
                          </span>
                        )}
                        {Math.abs(val) > 0.85 && !isDiagonal && (
                          <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full shadow-sm" />
                        )}
                      </motion.div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};

const Step5Preprocess = ({ runScaling, handlePrev }: StepProps) => (
  <StepWrapper 
    title="06. Normalización"
    description="Los algoritmos basados en distancia son sensibles a la escala."
    onPrev={handlePrev}
  >
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        { id: "StandardScaler", name: "Standard Scaler", desc: "Escala a media 0 y varianza 1. Ideal para distribuciones normales.", icon: <Activity className="text-brand-dark" /> },
        { id: "MinMaxScaler", name: "Min-Max Scaler", desc: "Escala valores entre 0 y 1. Útil cuando se desea mantener la relación de magnitud relativa.", icon: <Zap className="text-brand-dark" /> },
        { id: "RobustScaler", name: "Robust Scaler", desc: "Utiliza medianas y cuartiles. Resistente a outliers.", icon: <ShieldAlert className="text-brand-dark" /> }
      ].map(s => (
        <button 
          key={s.id}
          onClick={() => runScaling && runScaling(s.id as ScalerType)}
          className="group text-left p-8 bg-white border border-brand-dark hover:bg-brand-dark hover:text-brand-bg transition-all"
        >
          <div className="w-12 h-12 bg-gray-50 border border-brand-dark flex items-center justify-center mb-6 group-hover:bg-white/10 group-hover:border-white/50">{s.icon}</div>
          <h4 className="text-lg font-bold mb-2 uppercase tracking-tight">{s.name}</h4>
          <p className="opacity-60 text-[11px] leading-relaxed mb-6 font-mono font-medium">{s.desc}</p>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
            Select method <ArrowRight size={14} />
          </div>
        </button>
      ))}
    </div>
  </StepWrapper>
);

const Step6Optimize = ({ state, setState, handlePrev, executeClustering, loading, noAnim }: StepProps) => (
  <StepWrapper 
    title="07. Active Optimization"
    description="Utiliza el 'Método del Codo' (Elbow) para encontrar el balance."
    onPrev={handlePrev}
    onNext={executeClustering}
    nextLabel="Ejecutar Clustering"
    isLoading={loading}
    noAnim={noAnim}
  >
     <div className="bg-white border border-brand-dark p-8" id="export-optimization">
       <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <h4 className="text-brand-dark font-bold uppercase text-sm">Curva de Inercia (WSCC)</h4>
            <p className="text-brand-dark/40 text-[10px] font-mono uppercase">Error cuadrático vs Cluster count</p>
          </div>
          <div className="flex items-center gap-6 bg-gray-100 p-4 border border-brand-dark">
             <div className="flex-1">
               <span className="text-brand-dark/60 text-[10px] font-bold uppercase block mb-2">Optimal K Target: {state.optimalK}</span>
               <input 
                type="range" 
                min="2"
                max="10"
                value={state.optimalK}
                onChange={(e) => setState(prev => ({ ...prev, optimalK: parseInt(e.target.value) || 2 }))}
                className="w-full h-1 bg-brand-dark/20 rounded-lg appearance-none cursor-pointer accent-brand-dark"
               />
             </div>
             <div className="w-12 h-12 bg-brand-dark flex items-center justify-center text-brand-bg font-mono font-bold text-xl">
               {state.optimalK}
             </div>
          </div>
       </div>
       <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={state.elbowData}>
              <CartesianGrid strokeDasharray="1 1" stroke="#14141410" vertical={false} />
              <XAxis dataKey="k" stroke="#141414" fontSize={10} axisLine={true} tickLine={false} />
              <YAxis stroke="#141414" fontSize={10} axisLine={true} tickLine={false} />
              <RechartsTooltip />
              <Line type="stepAfter" dataKey="error" stroke="#141414" strokeWidth={2} dot={{ r: 4, fill: "#141414" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
       </div>
     </div>
  </StepWrapper>
);

const Step7Execution = ({ state, handlePrev, getAIInterpretation, loading, noAnim }: StepProps) => (
  <StepWrapper 
    title="08. Active Clustering"
    description="Segmentación terminada. Los records han sido particionados."
    onPrev={handlePrev}
    onNext={getAIInterpretation}
    isLoading={loading}
    nextLabel="Generar Interpretación IA"
    noAnim={noAnim}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="export-execution">
      <div className="bg-white border border-brand-dark p-8 flex flex-col items-center justify-center">
          <div className="relative w-48 h-48 border-[12px] border-gray-100 rounded-full flex items-center justify-center">
            <PieChart size={60} className="text-brand-dark opacity-10 absolute" />
            <div className="text-center z-10">
              <h3 className="text-6xl font-black text-brand-dark leading-none">{state.optimalK}</h3>
              <p className="text-brand-dark/40 uppercase tracking-widest text-[8px] font-bold mt-1">Clusters</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-4 gap-2">
            {Array.from({ length: state.optimalK }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 border border-brand-dark/10 p-2 bg-gray-50">
                 <div className="w-6 h-6 bg-brand-dark" style={{ opacity: (i + 1) / state.optimalK }}></div>
                 <span className="text-[8px] text-brand-dark font-bold uppercase">SEC_{i}</span>
              </div>
            ))}
          </div>
      </div>
      <div className="bg-white border border-brand-dark h-[400px] overflow-hidden flex flex-col">
         <h4 className="text-[10px] font-mono font-bold uppercase p-4 border-b border-gray-100">Live Assignment sample</h4>
         <div className="flex-1 overflow-y-auto font-mono text-[10px]">
           {state.data.slice(0, 50).map((row, idx) => (
             <div key={idx} className="flex items-center justify-between border-b border-gray-50 px-4 py-2 hover:bg-gray-50">
               <span className="opacity-40">ITEM_{String(idx).padStart(4, '0')}</span>
               <span className="font-bold">CLUSTER_ID: {state.clusters[idx]}</span>
             </div>
           ))}
         </div>
      </div>
    </div>
  </StepWrapper>
);

const Step8Interpretation = ({ state, handlePrev, onNext, noAnim }: StepProps) => (
  <StepWrapper 
    title="09. AI Interpretation"
    description="Gemini ha analizado el comportamiento para darles nombres con sentido de negocio."
    onPrev={handlePrev}
    onNext={onNext}
    nextLabel="Ver Perfiles Detallados"
    noAnim={noAnim}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="export-interpretation">
      {state.interpretations.map((c, i) => (
        <motion.div 
          key={i} 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-6 bg-white border border-brand-dark relative group overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Fingerprint size={60} className="text-brand-dark" />
          </div>
          <span className="inline-block px-2 py-1 bg-brand-dark text-brand-bg text-[8px] font-black mb-4 uppercase font-mono">SEC_0{c.id}</span>
          <h4 className="text-sm font-black text-brand-dark mb-2 uppercase tracking-tight">{c.name}</h4>
          <p className="text-brand-dark/60 text-[10px] leading-relaxed mb-6 italic">{c.description}</p>
          <div className="pt-4 border-t border-gray-100">
            <span className="text-[8px] font-black text-emerald-600 uppercase mb-2 block">Action Strategy</span>
            <p className="text-brand-dark uppercase text-[9px] font-bold leading-tight">{c.strategy}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </StepWrapper>
);

const Step9Profiles = ({ state, handlePrev, handleExportPDF, noAnim }: StepProps) => (
  <StepWrapper 
    title="10. Profiling Dashboard"
    description="Visualiza las variables diferenciales entre tus segmentos masivamente."
    onPrev={handlePrev}
    noAnim={noAnim}
  >
    <div className="grid grid-cols-1 gap-4" id="export-profiles">
       {state.businessCore && (
         <div className="bg-white border-l-4 border-brand-dark p-8 mb-4 border-y border-r">
           <h4 className="text-[10px] font-mono font-bold uppercase mb-4 opacity-40">Core del Negocio (AI Insight)</h4>
           <p className="text-xl font-serif italic text-brand-dark leading-relaxed">"{state.businessCore}"</p>
         </div>
       )}
       <div className="bg-white border border-brand-dark p-8">
          <h4 className="text-xs font-mono font-bold uppercase mb-8 border-b border-gray-100 pb-2">Cluster Variational Centroids</h4>
          <div className="h-[450px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={state.selectedFeatures.map(f => {
                  const row: any = { name: f };
                  state.centroids.forEach((c, idx) => {
                    row[`c${idx}`] = c[state.selectedFeatures.indexOf(f)];
                  });
                  return row;
                })}>
                  <CartesianGrid strokeDasharray="1 1" stroke="#14141410" vertical={false} />
                  <XAxis dataKey="name" stroke="#141414" fontSize={9} axisLine={true} tickLine={false} />
                  <YAxis stroke="#141414" fontSize={9} axisLine={true} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#141414", border: "none", borderRadius: "0px", color: "white" }} />
                  {Array.from({ length: state.optimalK }).map((_, i) => (
                    <Bar key={i} dataKey={`c${i}`} fill="#141414" fillOpacity={(i + 1) / state.optimalK} radius={0} />
                  ))}
                </BarChart>
             </ResponsiveContainer>
          </div>
       </div>
       <div className="bg-brand-dark p-12 text-center text-brand-bg print:bg-white print:text-brand-dark">
          <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter italic font-serif">Integration Complete</h2>
          <p className="text-brand-bg/60 max-w-2xl mx-auto mb-8 text-xs font-mono uppercase tracking-widest leading-loose">Has convertido una base de datos bruta en inteligencia estratégica utilizando Ciencia de Datos avanzada y el poder de Clustera AI Engine.</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-brand-bg text-brand-dark font-black uppercase text-xs tracking-widest hover:bg-white transition-colors"
            >
              Initialize New Session
            </button>
            <button 
              onClick={handleExportPDF}
              className="px-10 py-4 border border-brand-bg text-brand-bg font-black uppercase text-xs tracking-widest hover:bg-brand-bg hover:text-brand-dark transition-all"
            >
              Export PDF Report
            </button>
          </div>
       </div>
    </div>
  </StepWrapper>
);

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOrientation, setExportOrientation] = useState<"p" | "l">("p");
  const [exportScope, setExportScope] = useState<"full" | "summary">("full");
  const [state, setState] = useState<StepData>({
    businessGoals: "",
    businessSummary: "",
    businessCore: "",
    rawFile: null,
    data: [],
    headers: [],
    selectedFeatures: [],
    stats: {},
    scaledData: [],
    scaler: "StandardScaler",
    optimalK: 3,
    elbowData: [],
    clusters: [],
    centroids: [],
    interpretations: [],
  });

  // --- Handlers ---
  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const processBusinessSummary = async () => {
    if (!state.businessGoals) return;
    setLoading(true);
    const summary = await summarizeBusinessGoals(state.businessGoals);
    setState(prev => ({ ...prev, businessSummary: summary }));
    setLoading(false);
    handleNext();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          setState(prev => ({
            ...prev,
            rawFile: file,
            data: results.data as any[],
            headers: Object.keys(results.data[0] || {}),
          }));
          setLoading(false);
        }
      });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setState(prev => ({
          ...prev,
          rawFile: file,
          data: data,
          headers: Object.keys(data[0] || {}),
        }));
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    }
  };

  const calculateEDA = () => {
    const stats = getDescriptiveStats(state.data, state.headers);
    setState(prev => ({ ...prev, stats }));
    // Auto-select numeric features
    const numericFeatures = state.headers.filter(h => {
      const vals = state.data.map(d => d[h]).filter(v => typeof v === 'number');
      return vals.length > state.data.length * 0.5;
    });
    setState(prev => ({ ...prev, selectedFeatures: numericFeatures }));
    handleNext();
  };

  const runScaling = (type: ScalerType) => {
    const numericData = state.data.map(row => 
      state.selectedFeatures.map(f => parseFloat(row[f]) || 0)
    );
    const scaled = scaleData(numericData, type);
    setState(prev => ({ ...prev, scaledData: scaled, scaler: type }));
    
    // Auto-calc elbow for next step
    const elbow = calculateElbow(scaled);
    setState(prev => ({ ...prev, elbowData: elbow }));
    handleNext();
  };

  const executeClustering = () => {
    setLoading(true);
    setTimeout(() => {
      const result = runClustering(state.scaledData, state.optimalK);
      setState(prev => ({ 
        ...prev, 
        clusters: result.clusters, 
        centroids: result.centroids 
      }));
      setLoading(false);
      handleNext();
    }, 500);
  };

  const getAIInterpretation = async () => {
    setLoading(true);
    const clusterMeans = state.centroids.map((c, i) => {
      const obj: any = { clusterId: i };
      state.selectedFeatures.forEach((f, idx) => {
        obj[f] = c[state.selectedFeatures.indexOf(f)];
      });
      return obj;
    });
    const result = await interpretClusters(
      state.businessGoals, 
      clusterMeans, 
      state.stats
    );
    setState(prev => ({ 
      ...prev, 
      interpretations: result.segments,
      businessCore: result.businessCore
    }));
    setLoading(false);
    handleNext();
  };

  const handleAdvancedExport = async (type: 'PDF' | 'CSV' | 'PNG') => {
    const fileName = `Clustera_Analysis_${Date.now()}`;
    
    if (type === 'CSV') {
      exportToCSV(state.data, fileName);
      return;
    }

    if (type === 'PNG') {
      setExporting("Generating Image...");
      await exportToPNG("export-profiles", fileName);
      setExporting(null);
      return;
    }

    if (type === 'PDF') {
      setShowExportModal(false);
      setExporting("Initializing PDF Engine...");
      
      const fullSections = [
        { id: "capture-business", title: "Business Strategy" },
        { id: "capture-eda", title: "Statistical Foundation" },
        { id: "capture-correlation", title: "Correlation Analysis" },
        { id: "capture-optimization", title: "K-Means Optimization" },
        { id: "capture-execution", title: "Cluster Distribution" },
        { id: "capture-interpretation", title: "Segment Intelligence" },
        { id: "capture-profiles", title: "Detailed Profiling" },
      ];

      const summarySections = [
        { id: "capture-business", title: "Business Strategy" },
        { id: "capture-interpretation", title: "Segment Intelligence" },
        { id: "capture-profiles", title: "Detailed Profiling" },
      ];

      const activeSections = exportScope === 'full' ? fullSections : summarySections;
      
      await generateProfessionalPDF(
        "ClusterForge Analysis",
        state,
        activeSections,
        { orientation: exportOrientation },
        (msg) => setExporting(msg)
      );
      setExporting(null);
    }
  };

  const handleExportPDF = () => {
    setShowExportModal(true);
  };

  return (
    <>
      <div className={cn(
        "h-screen flex overflow-hidden bg-brand-bg text-brand-dark font-sans selection:bg-brand-dark selection:text-brand-bg",
        "antialiased"
      )}>
      {/* --- Sidebar Navigation --- */}
      <aside className="w-64 bg-brand-dark text-brand-bg flex flex-col border-r border-brand-dark z-50">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-1">Clustera v2.4</h1>
          <p className="text-xl font-serif italic text-white">ClusterForge</p>
        </div>
        <div className="flex-1 overflow-y-auto py-6">
           <ul className="space-y-1">
             {STEPS.map((s, i) => (
               <li 
                key={i} 
                className={cn(
                  "px-6 py-2.5 flex items-center gap-3 transition-all cursor-default",
                  i === currentStep 
                    ? "bg-brand-bg text-brand-dark" 
                    : i < currentStep 
                      ? "opacity-100 text-brand-bg/80" 
                      : "opacity-30 text-brand-bg/60"
                )}
               >
                 <span className="text-[10px] font-mono">{String(i + 1).padStart(2, '0')}</span>
                 <span className="text-[11px] uppercase font-bold tracking-tight">{s}</span>
               </li>
             ))}
           </ul>
        </div>
        <div className="p-6 bg-white/5 border-t border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] uppercase opacity-50 font-bold">Analytic Health</span>
            <span className="text-[10px] text-emerald-400 font-mono">98.2%</span>
          </div>
          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-[98%] transition-all duration-1000"></div>
          </div>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Control Bar */}
        <header className="h-14 border-b border-brand-dark bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-10">
            <div>
              <span className="text-[9px] uppercase font-bold opacity-40 block leading-none mb-1">Status</span>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Engine Ready
              </div>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold opacity-40 block leading-none mb-1">Step {currentStep + 1} of {STEPS.length}</span>
              <span className="text-xs font-bold uppercase">{STEPS[currentStep]}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => window.location.reload()} className="px-4 py-1.5 border border-brand-dark text-[10px] font-bold uppercase hover:bg-brand-dark hover:text-white transition-colors">Abort Session</button>
             {currentStep === 9 && (
               <button onClick={handleExportPDF} className="px-4 py-1.5 bg-brand-dark text-brand-bg text-[10px] font-bold uppercase hover:opacity-90 transition-opacity">Export Results</button>
             )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <AnimatePresence mode="wait">
             {currentStep === 0 && (
               <Step0Business 
                key="step0"
                state={state}
                setState={setState}
                processBusinessSummary={processBusinessSummary}
                loading={loading}
                onNext={handleNext}
               />
             )}
             {currentStep === 1 && (
               <Step1DataLoad 
                key="step1"
                state={state}
                setState={setState}
                handleFileUpload={handleFileUpload}
                calculateEDA={calculateEDA}
                handlePrev={handlePrev}
                loading={loading}
                onNext={handleNext}
               />
             )}
             {currentStep === 2 && (
               <Step2Features 
                key="step2"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                onNext={handleNext}
               />
             )}
             {currentStep === 3 && (
               <Step3EDA 
                key="step3"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                onNext={handleNext}
               />
             )}
             {currentStep === 4 && (
               <Step4Correlation 
                key="step4"
                state={state}
                setState={setState} 
                handlePrev={handlePrev}
                onNext={handleNext}
               />
             )}
             {currentStep === 5 && (
               <Step5Preprocess 
                key="step5"
                state={state}
                setState={setState}
                runScaling={runScaling}
                handlePrev={handlePrev}
                onNext={handleNext}
               />
             )}
             {currentStep === 6 && (
               <Step6Optimize 
                key="step6"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                executeClustering={executeClustering}
                loading={loading}
                onNext={handleNext}
               />
             )}
             {currentStep === 7 && (
               <Step7Execution 
                key="step7"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                getAIInterpretation={getAIInterpretation}
                loading={loading}
                onNext={handleNext}
               />
             )}
             {currentStep === 8 && (
               <Step8Interpretation 
                key="step8"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                onNext={handleNext}
               />
             )}
             {currentStep === 9 && (
               <Step9Profiles 
                key="step9"
                state={state}
                setState={setState}
                handlePrev={handlePrev}
                handleExportPDF={handleExportPDF}
                onNext={handleNext}
               />
             )}
          </AnimatePresence>

          {/* HIDDEN EXPORT HUB (Renders all steps for capture) */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -100, opacity: 0 }}>
             <div className="w-[1100px] bg-brand-bg flex flex-col gap-20 p-20">
                <div id="capture-business" className="bg-brand-bg p-8 min-h-[500px]"><Step0Business state={state} setState={() => {}} onNext={() => {}} loading={false} noAnim={true} /></div>
                <div id="capture-eda" className="bg-brand-bg p-8 min-h-[700px]"><Step3EDA state={state} setState={() => {}} onNext={() => {}} noAnim={true} /></div>
                <div id="capture-correlation" className="bg-brand-bg p-8 min-h-[800px]"><Step4Correlation state={state} setState={() => {}} onNext={() => {}} noAnim={true} /></div>
                <div id="capture-optimization" className="bg-brand-bg p-8 min-h-[600px]"><Step6Optimize state={state} setState={() => {}} onNext={() => {}} noAnim={true} /></div>
                <div id="capture-execution" className="bg-brand-bg p-8 min-h-[600px]"><Step7Execution state={state} setState={() => {}} onNext={() => {}} noAnim={true} /></div>
                <div id="capture-interpretation" className="bg-brand-bg p-8 min-h-[500px]"><Step8Interpretation state={state} setState={() => {}} onNext={() => {}} noAnim={true} /></div>
                <div id="capture-profiles" className="bg-brand-bg p-8 min-h-[900px]"><Step9Profiles state={state} setState={() => {}} onNext={() => {}} handleExportPDF={() => {}} noAnim={true} /></div>
             </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <footer className="h-8 bg-gray-200 border-t border-brand-dark flex items-center justify-between px-4 shrink-0 text-[10px] font-mono uppercase">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 border-r border-brand-dark/10 pr-6">
               <span className="opacity-40">Algorithm:</span>
               <span className="font-bold">K-Means ++</span>
            </div>
            <div className="flex items-center gap-4 border-r border-brand-dark/10 pr-6">
               <span className="opacity-40">Features:</span>
               <span className="font-bold">{state.selectedFeatures.length}</span>
            </div>
            <div className="flex items-center gap-4">
               <span className="opacity-40">Scaler:</span>
               <span className="font-bold">{state.scaler}</span>
            </div>
          </div>
          <div className="flex gap-6 opacity-60">
             <span>UTC {new Date().getHours()}:{new Date().getMinutes()}</span>
             <span className="font-bold underline cursor-pointer hover:opacity-100 transition-opacity">System Logs</span>
          </div>
        </footer>
      </main>
    </div>
      
      {/* EXPORT MODAL */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-brand-dark/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-brand-bg w-full max-w-xl border border-brand-dark overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-brand-dark">
                <h3 className="text-3xl font-black uppercase tracking-tighter italic">Export Center</h3>
                <p className="text-[10px] font-mono font-bold opacity-40 uppercase tracking-widest mt-1">Select your preferred analytic output format</p>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-4 mb-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] font-mono font-bold uppercase opacity-40 block mb-2">Orientation</span>
                      <div className="flex border border-brand-dark overflow-hidden">
                        <button 
                          onClick={() => setExportOrientation("p")}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", exportOrientation === "p" ? "bg-brand-dark text-brand-bg" : "bg-white text-brand-dark/50")}
                        >
                          Portrait
                        </button>
                        <button 
                          onClick={() => setExportOrientation("l")}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", exportOrientation === "l" ? "bg-brand-dark text-brand-bg" : "bg-white text-brand-dark/50")}
                        >
                          Landscape
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-mono font-bold uppercase opacity-40 block mb-2">Scope</span>
                      <div className="flex border border-brand-dark overflow-hidden">
                        <button 
                          onClick={() => setExportScope("full")}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", exportScope === "full" ? "bg-brand-dark text-brand-bg" : "bg-white text-brand-dark/50")}
                        >
                          Full Report
                        </button>
                        <button 
                          onClick={() => setExportScope("summary")}
                          className={cn("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", exportScope === "summary" ? "bg-brand-dark text-brand-bg" : "bg-white text-brand-dark/50")}
                        >
                          Summary
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleAdvancedExport('PDF')}
                  className="flex flex-col items-center justify-center p-6 border border-brand-dark hover:bg-brand-dark hover:text-brand-bg transition-all group"
                >
                  <FileText size={32} className="mb-4 text-brand-dark group-hover:text-brand-bg transition-colors" />
                  <span className="text-xs font-black uppercase">Technical Report</span>
                  <span className="text-[8px] font-mono opacity-50 uppercase mt-1">Professional PDF</span>
                </button>
                <button 
                  onClick={() => handleAdvancedExport('CSV')}
                  className="flex flex-col items-center justify-center p-6 border border-brand-dark hover:bg-brand-dark hover:text-brand-bg transition-all group"
                >
                  <FileJson size={32} className="mb-4 text-brand-dark group-hover:text-brand-bg transition-colors" />
                  <span className="text-xs font-black uppercase">Raw Dataset</span>
                  <span className="text-[8px] font-mono opacity-50 uppercase mt-1">Structured CSV</span>
                </button>
                <button 
                  onClick={() => handleAdvancedExport('PNG')}
                  className="flex flex-col items-center justify-center p-4 border border-brand-dark hover:bg-brand-dark hover:text-brand-bg transition-all col-span-1 md:col-span-2 flex-row gap-6 group"
                >
                  <ImageIcon size={24} className="text-brand-dark group-hover:text-brand-bg transition-colors" />
                  <div className="text-left">
                    <span className="text-xs font-black uppercase block">Segmentation Snapshot</span>
                    <span className="text-[8px] font-mono opacity-50 uppercase">High-Res Image (PNG)</span>
                  </div>
                  <ArrowRight size={16} className="ml-auto opacity-20 group-hover:opacity-100 transition-all" />
                </button>
              </div>

              <div className="p-4 bg-gray-50 text-center">
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="text-[10px] font-mono underline uppercase font-bold opacity-40 hover:opacity-100 transition-opacity"
                >
                  Cancel and return to dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPORTING PROGRESS OVERLAY */}
      <AnimatePresence>
        {exporting && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-bg/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-brand-dark text-brand-bg px-10 py-6 border border-white/20 shadow-2xl flex flex-col items-center text-center max-w-xs"
            >
              <Loader2 size={32} className="animate-spin text-emerald-400 mb-4" />
              <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] font-black mb-1">Analytic Export in progress</h4>
              <p className="text-sm font-bold uppercase italic opacity-60">{exporting}</p>
              <div className="w-full h-1 bg-white/10 mt-6 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-full bg-emerald-400"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
