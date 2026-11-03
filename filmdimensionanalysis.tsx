import React, { useState, useMemo, Fragment } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ErrorBar,
  ReferenceLine
} from 'recharts';
import { Plus, Trash2, Settings2, ArrowUp, ArrowDown, Copy, Check, FileDown, Activity, ArrowRight, TrendingUp, TrendingDown, QrCode, X } from 'lucide-react';

// --- Constants & Helpers ---
const METRICS = [
  { key: 'A', name: 'Signal Max Dimension change' },
  { key: 'B', name: 'Dimension change at 500 ℃' },
  { key: 'C', name: '최종 Dimension change' },
  { key: 'D', name: 'Temperature at max dimension change' }
];

const createEmptySample = (id) => ({
  id,
  name: '',
  A: { MD: ['', '', ''], TD: ['', '', ''] },
  B: { MD: ['', '', ''], TD: ['', '', ''] },
  C: { MD: ['', '', ''], TD: ['', '', ''] },
  D: { MD: ['', '', ''], TD: ['', '', ''] },
});

const getValidNumbers = (arr) => arr.map(v => parseFloat(v)).filter(v => !isNaN(v));

const calculateMean = (arr) => {
  const valid = getValidNumbers(arr);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
};

const calculateSD = (arr) => {
  const valid = getValidNumbers(arr);
  if (valid.length < 2) return 0;
  const mean = calculateMean(valid);
  const variance = valid.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (valid.length - 1);
  return Math.sqrt(variance);
};

// 통계적 유의성(T-test) 검증 함수 (df=4, alpha=0.05, t-critical=2.776)
const checkSignificance = (mean1, sd1, mean2, sd2, n = 3) => {
  if (mean1 === 0 && mean2 === 0) return false;
  const variance1 = sd1 * sd1;
  const variance2 = sd2 * sd2;
  const standardError = Math.sqrt((variance1 / n) + (variance2 / n));
  if (standardError === 0) return mean1 !== mean2;
  const t = Math.abs(mean1 - mean2) / standardError;
  return t > 2.776;
};

// --- Copy Image Button Component ---
const CopyButton = ({ elementId }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    try {
      setLoading(true);
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const canvas = await window.html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('이미지 생성에 실패했습니다.');
          setLoading(false);
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.warn('Clipboard write failed, downloading instead.', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${elementId}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert('환경 권한 설정으로 인해 바로 복사되지 않아 이미지 파일로 다운로드되었습니다. PPT에 드래그하여 사용해 주세요.');
        } finally {
          setLoading(false);
        }
      }, 'image/png');

    } catch (err) {
      console.error('Failed to process image', err);
      alert('이미지 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCopy} 
      disabled={loading} 
      className="p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded flex items-center gap-1 text-xs shadow-sm transition-colors disabled:opacity-50" 
      title="Copy chart as image"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? <span className="text-green-600 font-medium">Copied!</span> : (loading ? 'Copying...' : 'Copy Image')}
    </button>
  );
};

// --- Sub-components for Charts ---
const MetricChart = ({ metric, data, chartScales, handleScaleChange }) => {
  const scale = chartScales[metric.key];
  const yMin = scale.min !== '' ? parseFloat(scale.min) : 'auto';
  const yMax = scale.max !== '' ? parseFloat(scale.max) : 'auto';
  const chartId = `chart-${metric.key}`;
  const yAxisLabel = metric.key === 'D' ? 'Temperature(℃)' : 'Dimension change(㎛)';

  return (
    <div id={chartId} className="bg-white p-4 rounded-xl shadow border border-gray-200 flex flex-col relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 flex-1">{metric.key}. {metric.name}</h3>
        
        <div className="flex items-center gap-3">
          <CopyButton elementId={chartId} />
          <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-100">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <input
              type="number"
              placeholder="Min"
              value={scale.min}
              onChange={(e) => handleScaleChange(metric.key, 'min', e.target.value)}
              className="w-16 p-1 border border-gray-300 rounded text-center text-xs focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-400">~</span>
            <input
              type="number"
              placeholder="Max"
              value={scale.max}
              onChange={(e) => handleScaleChange(metric.key, 'max', e.target.value)}
              className="w-16 p-1 border border-gray-300 rounded text-center text-xs focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 25, bottom: 5 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <YAxis 
              domain={[yMin, yMax]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#4B5563', fontSize: 13, fontWeight: 500 } }}
            />
            <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey={`${metric.key}_MD_Mean`} name="MD" fill="#3B82F6" radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey={`${metric.key}_MD_SD`} width={4} strokeWidth={2} stroke="#1E40AF" direction="y" />
            </Bar>
            <Bar dataKey={`${metric.key}_TD_Mean`} name="TD" fill="#10B981" radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey={`${metric.key}_TD_SD`} width={4} strokeWidth={2} stroke="#047857" direction="y" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const DeviationChart = ({ data, chartScales, handleScaleChange }) => {
  const scale = chartScales['Deviation'];
  const yMin = scale.min !== '' ? parseFloat(scale.min) : 'auto';
  const yMax = scale.max !== '' ? parseFloat(scale.max) : 'auto';
  const chartId = "chart-deviation";

  return (
    <div id={chartId} className="bg-white p-4 rounded-xl shadow border border-gray-200 flex flex-col col-span-1 xl:col-span-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 flex-1">MD vs TD Absolute Deviation (|MD - TD|)</h3>
        
        <div className="flex items-center gap-3">
          <CopyButton elementId={chartId} />
          <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-100">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <input
              type="number"
              placeholder="Min"
              value={scale.min}
              onChange={(e) => handleScaleChange('Deviation', 'min', e.target.value)}
              className="w-16 p-1 border border-gray-300 rounded text-center text-xs focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-400">~</span>
            <input
              type="number"
              placeholder="Max"
              value={scale.max}
              onChange={(e) => handleScaleChange('Deviation', 'max', e.target.value)}
              className="w-16 p-1 border border-gray-300 rounded text-center text-xs focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <YAxis domain={[yMin, yMax]} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="A_Dev" name="A Deviation" fill="#F87171" radius={[4, 4, 0, 0]} />
            <Bar dataKey="B_Dev" name="B Deviation" fill="#FBBF24" radius={[4, 4, 0, 0]} />
            <Bar dataKey="C_Dev" name="C Deviation" fill="#34D399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="D_Dev" name="D Deviation" fill="#60A5FA" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Comparative Analysis Component ---
const SampleComparison = ({ samples, data }) => {
  const [baseIdx, setBaseIdx] = useState(0);
  const [compIdx, setCompIdx] = useState(1);
  const chartId = "chart-comparison";

  if (samples.length < 2) {
    return (
      <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 flex items-center justify-center text-purple-700 font-medium">
        비교 분석 기능을 활성화하려면 샘플을 2개 이상 입력하세요.
      </div>
    );
  }

  const safeBaseIdx = baseIdx < samples.length ? baseIdx : 0;
  const safeCompIdx = compIdx < samples.length ? compIdx : 1;

  const baseSample = data[safeBaseIdx];
  const compSample = data[safeCompIdx];
  const baseRaw = samples[safeBaseIdx];
  const compRaw = samples[safeCompIdx];

  // 계산 로직 준비
  const comparisons = METRICS.map(m => {
    const bMD = baseSample[`${m.key}_MD_Mean`];
    const cMD = compSample[`${m.key}_MD_Mean`];
    const mdDiff = bMD !== 0 ? ((cMD - bMD) / Math.abs(bMD)) * 100 : 0;
    const mdSig = checkSignificance(bMD, baseSample[`${m.key}_MD_SD`], cMD, compSample[`${m.key}_MD_SD`], 3);

    const bTD = baseSample[`${m.key}_TD_Mean`];
    const cTD = compSample[`${m.key}_TD_Mean`];
    const tdDiff = bTD !== 0 ? ((cTD - bTD) / Math.abs(bTD)) * 100 : 0;
    const tdSig = checkSignificance(bTD, baseSample[`${m.key}_TD_SD`], cTD, compSample[`${m.key}_TD_SD`], 3);

    return {
      metric: m.key,
      name: m.name,
      bMD, cMD, mdDiff, mdSig,
      bTD, cTD, tdDiff, tdSig
    };
  });

  // 차트용 데이터 포맷 (Diverging Bar)
  const chartData = comparisons.flatMap(c => [
    { name: `${c.metric} (MD)`, Diff: Number(c.mdDiff.toFixed(2)), fill: c.mdDiff > 0 ? '#EF4444' : '#3B82F6' },
    { name: `${c.metric} (TD)`, Diff: Number(c.tdDiff.toFixed(2)), fill: c.tdDiff > 0 ? '#EF4444' : '#3B82F6' }
  ]);

  // 이방성(Anisotropy) 평가 - 평균 비율 (MD/TD)
  const calcAnisotropy = (sample) => {
    const validRatios = METRICS.map(m => {
      const md = sample[`${m.key}_MD_Mean`];
      const td = sample[`${m.key}_TD_Mean`];
      return (td !== 0 && md !== 0) ? (md / td) : null;
    }).filter(v => v !== null);
    
    if (validRatios.length === 0) return 0;
    const avgRatio = validRatios.reduce((a, b) => a + b, 0) / validRatios.length;
    return avgRatio;
  };

  const baseAnisotropy = calcAnisotropy(baseSample);
  const compAnisotropy = calcAnisotropy(compSample);
  // 등방성(1.0)에 가까운 정도 비교
  const baseDevFrom1 = Math.abs(1 - baseAnisotropy);
  const compDevFrom1 = Math.abs(1 - compAnisotropy);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
          <p className="font-bold text-gray-700 mb-1">{data.name}</p>
          <p className={data.Diff > 0 ? "text-red-600 font-semibold" : "text-blue-600 font-semibold"}>
            {data.Diff > 0 ? "+" : ""}{data.Diff}% {data.Diff > 0 ? "Increase" : "Decrease"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-purple-100 overflow-hidden flex flex-col" id={chartId}>
      {/* Header & Selectors */}
      <div className="bg-gradient-to-r from-purple-50 to-white p-4 border-b border-purple-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-800">Sample Comparative Analysis</h2>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={safeBaseIdx} 
            onChange={e => setBaseIdx(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
          >
            {samples.map((s, idx) => (
              <option key={`base-${s.id}`} value={idx}>Base: {s.name || `Sample ${idx+1}`}</option>
            ))}
          </select>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <select 
            value={safeCompIdx} 
            onChange={e => setCompIdx(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
          >
            {samples.map((s, idx) => (
              <option key={`comp-${s.id}`} value={idx}>Compare: {s.name || `Sample ${idx+1}`}</option>
            ))}
          </select>
          <div className="ml-2 border-l pl-4 border-gray-200">
             <CopyButton elementId={chartId} />
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: KPI Cards */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Anisotropy Ratio (MD/TD Avg)
            </h4>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Base</p>
                <p className="text-lg font-bold text-gray-700">{baseAnisotropy.toFixed(2)}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Compare</p>
                <p className={`text-lg font-bold ${compDevFrom1 < baseDevFrom1 ? 'text-green-600' : 'text-gray-700'}`}>
                  {compAnisotropy.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              * 1.0에 가까울수록 등방성 우수 (현재: {compDevFrom1 < baseDevFrom1 ? '비교 샘플 개선됨' : '변화 미미/악화됨'})
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex-1">
            <h4 className="text-sm font-semibold text-gray-500 mb-3">T-test Significance Info</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              우측 표에서 차이값 옆에 표시된 <strong className="text-yellow-500 text-lg">★</strong> 기호는 통계적으로 <strong>유의미한 차이(P-value &lt; 0.05)</strong>가 있음을 의미합니다.<br/><br/>
              (3회 반복 측정치 평균 및 표준편차 기준)
            </p>
          </div>
        </div>

        {/* Middle: Chart */}
        <div className="lg:col-span-2 h-[280px]">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">% Difference (Compare vs Base)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(tick) => `${tick}%`} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
              <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={2} />
              <Bar dataKey="Diff" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#4B5563', fontSize: 11, formatter: (val) => `${val}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom: Detailed Table */}
      <div className="overflow-x-auto border-t border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-600 bg-gray-50 uppercase text-center border-b border-gray-200">
            <tr>
              <th className="p-3 border-r">Metric</th>
              <th className="p-3 border-r bg-blue-50/50">MD Base</th>
              <th className="p-3 border-r bg-blue-50/50">MD Compare</th>
              <th className="p-3 border-r font-bold bg-blue-50">MD Diff (%)</th>
              <th className="p-3 border-r bg-green-50/50">TD Base</th>
              <th className="p-3 border-r bg-green-50/50">TD Compare</th>
              <th className="p-3 font-bold bg-green-50">TD Diff (%)</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {comparisons.map((c, idx) => (
              <tr key={c.metric} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="p-2 border-r font-semibold text-gray-700">{c.metric}</td>
                <td className="p-2 border-r text-gray-600">{c.bMD}</td>
                <td className="p-2 border-r text-gray-600">{c.cMD}</td>
                <td className={`p-2 border-r font-bold ${c.mdDiff > 0 ? 'text-red-500' : c.mdDiff < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                  {c.mdDiff > 0 ? '+' : ''}{c.mdDiff.toFixed(1)}%
                  {c.mdSig && <span className="text-yellow-500 ml-1" title="Statistically Significant">★</span>}
                </td>
                <td className="p-2 border-r text-gray-600">{c.bTD}</td>
                <td className="p-2 border-r text-gray-600">{c.cTD}</td>
                <td className={`p-2 font-bold ${c.tdDiff > 0 ? 'text-red-500' : c.tdDiff < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                  {c.tdDiff > 0 ? '+' : ''}{c.tdDiff.toFixed(1)}%
                  {c.tdSig && <span className="text-yellow-500 ml-1" title="Statistically Significant">★</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- Main Application Component ---
export default function App() {
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [samples, setSamples] = useState([createEmptySample(1)]);
  const [chartScales, setChartScales] = useState({
    A: { min: '', max: '' },
    B: { min: '', max: '' },
    C: { min: '', max: '' },
    D: { min: '', max: '' },
    Deviation: { min: '', max: '' }
  });
  const [showQr, setShowQr] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  React.useEffect(() => {
    // 컴포넌트가 마운트될 때 현재 URL 감지. 
    // 미리보기 환경(sandbox, blob 등)일 경우 안내용 Placeholder 제공
    const currentUrl = window.location.href;
    if (currentUrl.includes('sandbox') || currentUrl.startsWith('blob') || currentUrl.includes('google.com')) {
      setPageUrl("https://당신의-배포된-주소.com");
    } else {
      setPageUrl(currentUrl);
    }
  }, []);

  const data = useMemo(() => {
    return samples.map(sample => {
      const rowData = { name: sample.name || `Sample ${sample.id}` };
      
      METRICS.forEach(m => {
        const mdMean = calculateMean(sample[m.key].MD);
        const mdSD = calculateSD(sample[m.key].MD);
        const tdMean = calculateMean(sample[m.key].TD);
        const tdSD = calculateSD(sample[m.key].TD);

        rowData[`${m.key}_MD_Mean`] = Number(mdMean.toFixed(2));
        rowData[`${m.key}_MD_SD`] = Number(mdSD.toFixed(2));
        rowData[`${m.key}_TD_Mean`] = Number(tdMean.toFixed(2));
        rowData[`${m.key}_TD_SD`] = Number(tdSD.toFixed(2));

        rowData[`${m.key}_Dev`] = Number(Math.abs(mdMean - tdMean).toFixed(2));
      });
      return rowData;
    });
  }, [samples]);

  const addSample = () => {
    setSamples(prev => [...prev, createEmptySample(Date.now())]);
  };

  const handleScaleChange = (metricKey, axis, value) => {
    setChartScales(prev => ({
      ...prev,
      [metricKey]: {
        ...prev[metricKey],
        [axis]: value
      }
    }));
  };

  const handleBulkPaste = () => {
    if (!bulkPasteText.trim()) return;
    const rows = bulkPasteText.split('\n').map(row => row.split('\t').map(c => c.trim()));
    
    const newSamples = rows.filter(row => row.length > 0 && row.some(cell => cell !== '')).map((row, idx) => {
       const sample = createEmptySample(Date.now() + idx);
       if (row[0]) sample.name = row[0];
       
       const mapVal = (r, index) => {
          if (index < r.length && r[index] !== '') {
             const val = parseFloat(r[index].replace(/,/g, ''));
             return !isNaN(val) ? val : '';
          }
          return '';
       };

       METRICS.forEach((m, mIdx) => {
         for (let i = 0; i < 3; i++) {
            sample[m.key].MD[i] = mapVal(row, 1 + (mIdx * 3) + i);
            sample[m.key].TD[i] = mapVal(row, 13 + (mIdx * 3) + i);
         }
       });
       return sample;
    });

    if (newSamples.length > 0) {
      setSamples(prev => [...prev, ...newSamples]);
    }
    setBulkPasteText("");
    setIsBulkPasteOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans text-gray-800">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="mb-2 flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-gray-900">Film Dimension Analysis</h1>
            <p className="text-gray-500">MD/TD Comparison & Deviation</p>
          </div>
          <button
            onClick={() => setShowQr(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            Share QR
          </button>
        </header>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {METRICS.map(metric => (
            <MetricChart 
              key={metric.key} 
              metric={metric} 
              data={data}
              chartScales={chartScales}
              handleScaleChange={handleScaleChange}
            />
          ))}
          <DeviationChart 
            data={data}
            chartScales={chartScales}
            handleScaleChange={handleScaleChange}
          />
        </div>

        {/* NEW: Sample Comparison Module */}
        <SampleComparison samples={samples} data={data} />

        {/* Data Entry Section */}
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Raw Data Entry (3 Replicates per sample)</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsBulkPasteOpen(!isBulkPasteOpen)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Bulk Paste Excel
              </button>
              <button
                onClick={addSample}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Sample
              </button>
            </div>
          </div>

          {isBulkPasteOpen && (
            <div className="p-4 bg-green-50 border-b border-green-100 flex flex-col gap-3">
              <div className="text-sm text-green-800 font-medium">
                Paste multiple rows from Excel. Expected 25 columns: <br/>
                <span className="font-normal text-xs text-green-700">SampleName | MD_A(1~3) | MD_B(1~3) | MD_C(1~3) | MD_D(1~3) | TD_A(1~3) | TD_B(1~3) | TD_C(1~3) | TD_D(1~3)</span>
              </div>
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="Paste tab-separated Excel data here..."
                className="w-full h-32 p-3 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsBulkPasteOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">Cancel</button>
                <button onClick={handleBulkPaste} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">Import Data</button>
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto pb-8">
            <table className="w-full text-sm text-left border-collapse min-w-[1400px]">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 text-center">
                <tr>
                  <th rowSpan="2" className="border p-2 min-w-[180px]">Sample Name</th>
                  <th colSpan="3" className="border p-2 bg-blue-50 text-blue-800">A MD</th>
                  <th colSpan="3" className="border p-2 bg-blue-50 text-blue-800">B MD</th>
                  <th colSpan="3" className="border p-2 bg-blue-50 text-blue-800">C MD</th>
                  <th colSpan="3" className="border p-2 bg-blue-50 text-blue-800">D MD</th>
                  <th colSpan="3" className="border p-2 bg-green-50 text-green-800">A TD</th>
                  <th colSpan="3" className="border p-2 bg-green-50 text-green-800">B TD</th>
                  <th colSpan="3" className="border p-2 bg-green-50 text-green-800">C TD</th>
                  <th colSpan="3" className="border p-2 bg-green-50 text-green-800">D TD</th>
                  <th rowSpan="2" className="border p-2 min-w-[100px]">Actions</th>
                </tr>
                <tr>
                  {[...Array(8)].map((_, idx) => (
                    <Fragment key={idx}>
                      <th className="border p-1 text-[10px] bg-gray-50/50">1</th>
                      <th className="border p-1 text-[10px] bg-gray-50/50">2</th>
                      <th className="border p-1 text-[10px] bg-gray-50/50">3</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {samples.map((sample, sIdx) => (
                  <tr key={sample.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="border p-2">
                      <input
                        type="text"
                        value={sample.name}
                        onChange={(e) => {
                          const newSamples = [...samples];
                          newSamples[sIdx].name = e.target.value;
                          setSamples(newSamples);
                        }}
                        className="w-full p-1.5 border border-gray-300 rounded text-sm mb-1 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="Sample Name"
                      />
                      <input
                        type="text"
                        placeholder="Paste Excel row here..."
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData.getData('text');
                          if (!text.trim()) return;
                          const cells = text.split('\t').map(c => c.trim());
                          const newSamples = [...samples];
                          const s = newSamples[sIdx];
                          if (cells[0]) s.name = cells[0];
                          
                          const mapVal = (r, idx) => {
                            if (idx < r.length && r[idx] !== '') {
                              const val = parseFloat(r[idx].replace(/,/g, ''));
                              return !isNaN(val) ? val : '';
                            }
                            return '';
                          };
                          
                          const metrics = ['A', 'B', 'C', 'D'];
                          metrics.forEach((m, mIdx) => {
                            for (let i = 0; i < 3; i++) {
                              s[m].MD[i] = mapVal(cells, 1 + (mIdx * 3) + i);
                              s[m].TD[i] = mapVal(cells, 13 + (mIdx * 3) + i);
                            }
                          });
                          setSamples(newSamples);
                        }}
                        className="w-full p-1 border border-dashed border-blue-300 bg-blue-50/30 rounded text-xs text-blue-600 focus:bg-white placeholder-blue-400 outline-none"
                        title="Copy a single row from Excel (25 columns) and paste it here."
                      />
                    </td>
                    {['A', 'B', 'C', 'D'].map(m => (
                      <Fragment key={`${sample.id}-${m}-MD`}>
                        {[0, 1, 2].map(i => (
                          <td key={`MD-${i}`} className="border p-1 bg-blue-50/10">
                            <input
                              type="number"
                              value={sample[m].MD[i]}
                              onChange={(e) => {
                                const newSamples = [...samples];
                                newSamples[sIdx][m].MD[i] = e.target.value;
                                setSamples(newSamples);
                              }}
                              className="w-[4.5rem] p-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </td>
                        ))}
                      </Fragment>
                    ))}
                    {['A', 'B', 'C', 'D'].map(m => (
                      <Fragment key={`${sample.id}-${m}-TD`}>
                        {[0, 1, 2].map(i => (
                          <td key={`TD-${i}`} className="border p-1 bg-green-50/10">
                            <input
                              type="number"
                              value={sample[m].TD[i]}
                              onChange={(e) => {
                                const newSamples = [...samples];
                                newSamples[sIdx][m].TD[i] = e.target.value;
                                setSamples(newSamples);
                              }}
                              className="w-[4.5rem] p-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-green-500 outline-none"
                            />
                          </td>
                        ))}
                      </Fragment>
                    ))}
                    <td className="border p-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => {
                            if (sIdx === 0) return;
                            const newSamples = [...samples];
                            [newSamples[sIdx - 1], newSamples[sIdx]] = [newSamples[sIdx], newSamples[sIdx - 1]];
                            setSamples(newSamples);
                          }} 
                          disabled={sIdx === 0} 
                          className="p-1.5 bg-gray-100 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 disabled:opacity-40 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-4 h-4"/>
                        </button>
                        
                        <button 
                          onClick={() => {
                            if (sIdx === samples.length - 1) return;
                            const newSamples = [...samples];
                            [newSamples[sIdx + 1], newSamples[sIdx]] = [newSamples[sIdx], newSamples[sIdx + 1]];
                            setSamples(newSamples);
                          }} 
                          disabled={sIdx === samples.length - 1} 
                          className="p-1.5 bg-gray-100 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 disabled:opacity-40 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-4 h-4"/>
                        </button>
                        
                        <button 
                          onClick={() => {
                            setSamples(samples.filter(s => s.id !== sample.id));
                          }} 
                          disabled={samples.length === 1} 
                          className="p-1.5 bg-red-50 rounded text-red-500 hover:bg-red-100 hover:text-red-700 disabled:opacity-40 transition-colors ml-1"
                          title="Delete Sample"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                Share Application
              </h3>
              <button onClick={() => setShowQr(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="bg-white p-2 border-2 border-indigo-50 rounded-xl shadow-sm">
                {pageUrl.startsWith("http") ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}&margin=10`} 
                    alt="QR Code" 
                    className="w-48 h-48"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-400 text-sm text-center p-4">
                    유효한 URL을<br/>입력해주세요
                  </div>
                )}
              </div>
              <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-200 text-center leading-relaxed w-full">
                <strong>주의:</strong> 현재 환경은 임시 미리보기 화면입니다.<br/>
                스마트폰에서 스캔하여 접속하려면 Vercel, Netlify 등에 <strong>정식으로 웹을 배포(Deploy)</strong>한 후, 그 주소를 아래에 입력해야 합니다.
              </div>
              <div className="w-full mt-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                  Public Link URL (배포된 주소 입력)
                </label>
                <input 
                  type="text" 
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-mono text-gray-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}