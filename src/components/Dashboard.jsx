import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const chartStyle = { height: '100%', minHeight: 0, width: '100%' };
const MemoChart = React.memo(({ option }) => (
  <ReactECharts option={option} style={chartStyle} />
));

const TimeCursor = ({ currentFrame, totalFrames, leftOffset, rightOffset, topOffset = 10, bottomOffset = 20 }) => {
  const percentage = totalFrames > 1 ? currentFrame / (totalFrames - 1) : 0;
  return (
    <div style={{
      position: 'absolute',
      top: topOffset,
      bottom: bottomOffset,
      left: `calc(${leftOffset}px + calc(100% - ${leftOffset + rightOffset}px) * ${percentage})`,
      width: '2px',
      background: '#1A202C',
      pointerEvents: 'none',
      zIndex: 10
    }} />
  );
};

const fingerNames = ['食指', '中指', '无名指', '小指', '拇指'];
const jointNames = ['MCP', 'PIP'];
const forceRegions = ['食指尖', '中指尖', '无名指尖', '小指尖', '拇指尖', '手掌1', '手掌2', '手掌3', 
                     '食指近节', '中指近节', '无名指近节', '小指近节', '拇指近节', '拇指根部'];
const triboRegions = ['食指', '中指', '无名指', '小指', '拇指桡侧', '拇指尺侧', '手掌内侧', '手掌外侧'];

// 颜色方案
const jointColors = ['#1890FF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD'];
const forceColors = ['#EF4444', '#F87171', '#FB7185', '#F43F5E', '#E11D48', '#DC2626', '#B91C1C', 
                     '#991B1B', '#FCA5A5', '#FECDD3', '#FEE2E2', '#FEF2F2', '#FECACA', '#FCA5A5'];
const triboColors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#14B8A6', '#2DD4BF', '#4ADE80', '#22C55E'];

export default function Dashboard({ data, currentFrame, showAllMetrics = false }) {
  const [activeTab, setActiveTab] = useState('joint');

  const parsedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const xAxis = data.map(row => row[0].toFixed(2));
    const joints = Array.from({ length: 10 }).map((_, i) => data.map(row => row[1 + i]));
    const forces = Array.from({ length: 14 }).map((_, i) => {
      const baseIdx = 11 + i * 3;
      return {
        fx: data.map(row => parseFloat(row[baseIdx].toFixed(2))),
        fy: data.map(row => parseFloat(row[baseIdx + 1].toFixed(2))),
        fz: data.map(row => parseFloat(row[baseIdx + 2].toFixed(2)))
      };
    });
    const tribos = Array.from({ length: 8 }).map((_, i) => data.map(row => row[53 + i].toFixed(2)));
    return { xAxis, joints, forces, tribos };
  }, [data]);

  const baseOption = useMemo(() => {
    return {
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: {
        type: 'category',
        data: parsedData ? parsedData.xAxis : [],
        boundaryGap: false,
        axisLabel: { color: '#718096', fontSize: 10 },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#718096', fontSize: 10 },
        splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } }
      },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#E2E8F0' },
    };
  }, [parsedData]);

  const getOption = (seriesName, seriesColor, seriesData) => ({
    ...baseOption,
    series: [
      {
        name: seriesName,
        type: 'line',
        data: seriesData,
        itemStyle: { color: seriesColor },
        lineStyle: { width: 2 },
        showSymbol: false,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${seriesColor}66` },
              { offset: 1, color: `${seriesColor}00` }
            ]
          }
        }
      }
    ]
  });

  const jointOptions = useMemo(() => {
    if (!parsedData) return [];
    return Array.from({ length: 10 }).map((_, i) => getOption('屈曲角度', '#0ea5e9', parsedData.joints[i]));
  }, [parsedData, baseOption]);

  const forceOptions = useMemo(() => {
    if (!parsedData) return [];
    
    const getMultiForceOption = (fx, fy, fz) => ({
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: 'rgba(255,255,255,0.9)', 
        borderColor: '#E2E8F0',
        textStyle: { fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: '#1A202C' } }
      },
      grid: [
        { top: 5, right: 10, height: '27%', left: 55 },
        { top: '36%', right: 10, height: '27%', left: 55 },
        { top: '68%', right: 10, height: '27%', left: 55 }
      ],
      xAxis: [
        { gridIndex: 0, type: 'category', data: parsedData.xAxis, show: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
        { gridIndex: 1, type: 'category', data: parsedData.xAxis, show: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
        { gridIndex: 2, type: 'category', data: parsedData.xAxis, show: true, axisLabel: { color: '#718096', fontSize: 10 }, axisLine: { lineStyle: { color: '#E2E8F0' } } }
      ],
      yAxis: [
        { gridIndex: 0, name: 'Fx (N)', nameLocation: 'middle', nameRotate: 0, nameGap: 35, nameTextStyle: { color: '#ef4444', fontWeight: 'bold' }, type: 'value', splitNumber: 2, axisLabel: { color: '#718096', fontSize: 9, showMinLabel: true, showMaxLabel: true, hideOverlap: true }, splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } } },
        { gridIndex: 1, name: 'Fy (N)', nameLocation: 'middle', nameRotate: 0, nameGap: 35, nameTextStyle: { color: '#10b981', fontWeight: 'bold' }, type: 'value', splitNumber: 2, axisLabel: { color: '#718096', fontSize: 9, showMinLabel: true, showMaxLabel: true, hideOverlap: true }, splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } } },
        { gridIndex: 2, name: 'Fz (N)', nameLocation: 'middle', nameRotate: 0, nameGap: 35, nameTextStyle: { color: '#3b82f6', fontWeight: 'bold' }, type: 'value', splitNumber: 2, axisLabel: { color: '#718096', fontSize: 9, showMinLabel: true, showMaxLabel: true, hideOverlap: true }, splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } } }
      ],
      series: [
        { name: 'Fx(N)', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: fx, itemStyle: { color: '#ef4444' }, showSymbol: false, lineStyle: { width: 1.5 } },
        { name: 'Fy(N)', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: fy, itemStyle: { color: '#10b981' }, showSymbol: false, lineStyle: { width: 1.5 } },
        { name: 'Fz(N)', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: fz, itemStyle: { color: '#3b82f6' }, showSymbol: false, lineStyle: { width: 1.5 } }
      ]
    });

    return Array.from({ length: 14 }).map((_, i) => getMultiForceOption(parsedData.forces[i].fx, parsedData.forces[i].fy, parsedData.forces[i].fz));
  }, [parsedData]);

  const triboOptions = useMemo(() => {
    if (!parsedData) return [];
    return Array.from({ length: 8 }).map((_, i) => getOption('静电势', '#0ea5e9', parsedData.tribos[i]));
  }, [parsedData, baseOption]);

  // 生成所有关节角数据
  const jointCharts = useMemo(() => {
    if (!parsedData || jointOptions.length === 0) return null;
    
    if (!showAllMetrics) {
      // 默认只显示第一个关节
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '120px', flexShrink: 0, marginBottom: '16px' }}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '2px', color: '#0ea5e9', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
            首个关节
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px', position: 'relative' }}>
            <MemoChart option={jointOptions[0]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={56} rightOffset={26} topOffset={26} bottomOffset={36} />
          </div>
        </div>
      );
    }

    // 显示所有10组关节角
    return Array.from({ length: 10 }).map((_, i) => {
      const fingerIdx = Math.floor(i / 2);
      const jointIdx = i % 2;
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '120px', flexShrink: 0, marginBottom: '16px' }} key={`joint-${i}`}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '2px', color: '#0ea5e9', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
            {fingerNames[fingerIdx]} { jointNames[jointIdx] }
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px', position: 'relative' }}>
            <MemoChart option={jointOptions[i]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={56} rightOffset={26} topOffset={26} bottomOffset={36} />
          </div>
        </div>
      );
    });
  }, [parsedData, currentFrame, showAllMetrics, jointOptions]);

  // 生成所有三维力数据
  const forceCharts = useMemo(() => {
    if (!parsedData || forceOptions.length === 0) return null;

    if (!showAllMetrics) {
      // 默认只显示第一个力传感器
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '180px', flexShrink: 0, marginBottom: '16px' }}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '4px', color: '#0ea5e9', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
            第一节点
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px 16px 16px 8px', position: 'relative' }}>
            <MemoChart option={forceOptions[0]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={63} rightOffset={26} topOffset={21} bottomOffset={30} />
          </div>
        </div>
      );
    }

    // 显示所有14组三维力
    return Array.from({ length: 14 }).map((_, i) => {
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '180px', flexShrink: 0, marginBottom: '16px' }} key={`force-${i}`}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '4px', color: '#0ea5e9', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
            {forceRegions[i]}
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px 16px 16px 8px', position: 'relative' }}>
            <MemoChart option={forceOptions[i]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={63} rightOffset={26} topOffset={21} bottomOffset={26} />
          </div>
        </div>
      );
    });
  }, [parsedData, currentFrame, showAllMetrics, forceOptions]);

  // 生成所有摩擦电数据
  const triboCharts = useMemo(() => {
    if (!parsedData || triboOptions.length === 0) return null;
    
    if (!showAllMetrics) {
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '120px', flexShrink: 0, marginBottom: '16px' }}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '4px', color: '#0ea5e9', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
            首个区域
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px', position: 'relative' }}>
            <MemoChart option={triboOptions[0]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={56} rightOffset={26} topOffset={26} bottomOffset={36} />
          </div>
        </div>
      );
    }

    // 分离出 8 组独立的摩擦电卡片
    return Array.from({ length: 8 }).map((_, i) => {
      return (
        <div style={{ display: 'flex', gap: '12px', minHeight: '120px', flexShrink: 0, marginBottom: '16px' }} key={`tribo-${i}`}>
          <div style={{ width: '40px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontWeight: 'bold', letterSpacing: '4px', color: '#0ea5e9', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
            {triboRegions[i]}
          </div>
          <div className="chart-card" style={{ flex: 1, margin: 0, height: '100%', padding: '16px', position: 'relative' }}>
            <MemoChart option={triboOptions[i]} />
            <TimeCursor currentFrame={currentFrame} totalFrames={parsedData.xAxis.length} leftOffset={56} rightOffset={26} topOffset={26} bottomOffset={36} />
          </div>
        </div>
      );
    });
  }, [parsedData, currentFrame, showAllMetrics, triboOptions]);

  if (!data || data.length === 0) return <div className="sidebar">等待数据接入...</div>;

  return (
    <>
      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeTab === 'joint' ? 'active' : ''}`} onClick={() => setActiveTab('joint')}>关节角波形</button>
        <button className={`tab-btn ${activeTab === 'force' ? 'active' : ''}`} onClick={() => setActiveTab('force')}>三维力监测</button>
        <button className={`tab-btn ${activeTab === 'tribo' ? 'active' : ''}`} onClick={() => setActiveTab('tribo')}>摩擦电信号</button>
      </div>
      <div className="sidebar">
        {activeTab === 'joint' && jointCharts}
        {activeTab === 'force' && forceCharts}
        {activeTab === 'tribo' && triboCharts}
      </div>
    </>
  );
}
