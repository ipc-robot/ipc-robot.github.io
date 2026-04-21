import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import Papa from 'papaparse';
import { Play, Pause, UploadCloud, Rewind, FastForward } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorInfo: error.toString() };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Canvas Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 20, color: 'red' }}><h1>Render Error</h1><p>{this.state.errorInfo}</p></div>;
    }
    return this.props.children;
  }
}

import HandSkeleton from './components/HandSkeleton';
import Dashboard from './components/Dashboard';
import { generateDemoData } from './utils/dataMocker';

function App() {
  const [data, setData] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const requestRef = useRef();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const datasetOptions = [
    { label: '示例数据 (Default)', value: '/demo.csv' },
    { label: '动作序列 0', value: '/demo_action_0.csv' },
    { label: '动作序列 1', value: '/demo_action_1.csv' },
    { label: '动作序列 2', value: '/demo_action_2.csv' },
    { label: '动作序列 3', value: '/demo_action_3.csv' },
    { label: '动作序列 4', value: '/demo_action_4.csv' },
    { label: '动作序列 5', value: '/demo_action_5.csv' },
    { label: '--- 上传本地文件 ---', value: 'upload' }
  ];

  const loadDataFromUrl = (url) => {
    Papa.parse(url, {
      download: true,
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const numericData = results.data.filter(row => typeof row[0] === 'number');
        if (numericData.length > 0) {
          setData(numericData);
          setCurrentFrame(0);
          setIsPlaying(true);
        }
      },
      error: (err) => {
        console.error("Error loading data:", err);
      }
    });
  };

  // Initialize with demo data
  useEffect(() => {
    loadDataFromUrl('/demo.csv');
  }, []);

  // Playback Loop
  const animate = () => {
    if (isPlaying && data.length > 0) {
      setCurrentFrame(prev => (prev + playbackSpeed) % data.length);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, data.length, playbackSpeed]);

  // 同步视频播放进度
  useEffect(() => {
    if (videoRef.current && data.length > 0) {
      const totalDuration = data[data.length - 1][0];
      const currentTime = (currentFrame / data.length) * totalDuration;
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentFrame, data]);

  // 同步播放状态
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.log("Video play error:", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && data.length > 0 && isPlaying) {
      const totalDuration = data[data.length - 1][0];
      const progress = videoRef.current.currentTime / totalDuration;
      setCurrentFrame(Math.floor(progress * data.length));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const numericData = results.data.filter(row => typeof row[0] === 'number');
        if (numericData.length > 0) {
          setData(numericData);
          setCurrentFrame(0);
          setIsPlaying(true);
        } else {
          alert('未能识别有效的数字矩阵。请检查 CSV 格式。');
        }
      }
    });
  };

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'upload') {
      fileInputRef.current.click();
    } else {
      loadDataFromUrl(val);
    }
  };

  // Guard clause
  if (!data || data.length === 0) return <div>加载中/生成数据中...</div>;

  const currentDataRow = data[Math.floor(currentFrame)];
  const currentTimeStamp = currentDataRow ? currentDataRow[0] : 0;

  return (
    <>
      <header style={{ justifyContent: 'center' }}>
        <div className="title-group" style={{ textAlign: 'center' }}>
          <h1>Meta-Glove Analytics Tracker</h1>
          <p>人手姿态追踪与接触状态重建 • 多模态触觉建模</p>
        </div>
      </header>

      <div className="app-wrapper">
        {/* 中间三大独立圆角卡片区域 */}
        <div className="content-grid">
          {/* 第一列：视频区域 */}
          <div className="card-column video-area">
            <video 
              ref={videoRef}
              className="video-player"
              onTimeUpdate={handleVideoTimeUpdate}
              controls={false}
              muted
              playsInline
            >
              <source src="/demo.mp4" type="video/mp4" />
              您的浏览器不支持视频播放
            </video>
            <div className="video-placeholder">
              <p>请上传拍摄视频文件（支持MP4格式）</p>
            </div>
          </div>

          {/* 第二列：3D手模型区域 */}
          <div className="card-column canvas-area">
            <ErrorBoundary>
              <Canvas camera={{ position: [0, 0, 8], fov: 50 }} style={{ background: 'transparent' }}>
                <ambientLight intensity={0.3} />
                <hemisphereLight skyColor="#ffffff" groundColor="#94A3B8" intensity={0.2} />
                <directionalLight position={[5, 5, 5]} intensity={0.9} color="#ffffff" castShadow shadowBias={-0.0001} />
                <spotLight position={[-5, 5, 5]} intensity={0.4} color="#93C5FD" castShadow />

                <HandSkeleton currentData={currentDataRow} />

                <OrbitControls makeDefault enableDamping minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
                <Grid position={[0, -2, 0]} args={[20, 20]} cellColor="#F1F5F9" sectionColor="#E2E8F0" fadeDistance={25} />
                <Environment preset="studio" blur={1.0} />
              </Canvas>
            </ErrorBoundary>
          </div>

          {/* 第三列：数据面板区域 */}
          <div className="card-column dashboard-area">
            <Dashboard 
              data={data} 
              currentFrame={Math.floor(currentFrame)} 
              showAllMetrics={true}
            />
          </div>
        </div>

        {/* 底部时间控制长条圆角矩阵 */}
        <div className="bottom-pill">
          <div className="controls">
            <button className="control-btn" onClick={() => setCurrentFrame(0)}>
              <Rewind size={18} />
            </button>
            <button className="control-btn" onClick={() => setIsPlaying(!isPlaying)} style={{ background: isPlaying ? '#1890FF' : '#fff', color: isPlaying ? '#fff' : '#1A202C' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="control-btn" onClick={() => setPlaybackSpeed(s => s === 1 ? 2 : (s === 2 ? 0.5 : 1))}>
              <FastForward size={18} />
            </button>
            <span style={{ fontSize: '0.85rem', color: '#718096', width: '30px', textAlign: 'center' }}>{playbackSpeed}x</span>

            <div style={{ width: '1px', height: '20px', background: '#E2E8F0', margin: '0 8px' }}></div>
            
            {/* 数据选择下拉框 */}
            <div className="select-wrapper">
              <select 
                className="control-select" 
                onChange={handleSelectChange}
                defaultValue="/demo.csv"
              >
                {datasetOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".csv" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
            </div>
          </div>

          <div className="timeline-wrapper">
            <span className="time-label">00:00:00</span>
            <input
              type="range"
              min="0"
              max={data.length - 1}
              value={Math.floor(currentFrame)}
              onChange={(e) => {
                setCurrentFrame(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="progress-bar"
              style={{ '--progress': `${(currentFrame / (data.length - 1)) * 100}%` }}
            />
            <span className="time-label">
              {data.length > 0 ? new Date(data[data.length - 1][0] * 1000).toISOString().substr(11, 8) : '00:00:00'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
