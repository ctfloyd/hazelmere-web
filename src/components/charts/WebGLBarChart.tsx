import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { formatNumber } from '@/lib/dataUtils';

interface SkillGain {
  skill: string;
  experience: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
  date: string;
  skillBreakdown?: SkillGain[];
}

interface WebGLBarChartProps {
  data: DataPoint[];
  yAxisMax: number;
  yAxisMinMax?: number; // Minimum value for yAxisMax when dragging (default 100)
  onYAxisMaxChange?: (max: number) => void;
  barColor?: string;
  overflowColor?: string;
  width?: number;
  height?: number;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
}

// Vertex shader - transforms bar positions based on timestamp
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute float a_value;
  attribute float a_timestamp;

  uniform vec2 u_resolution;
  uniform float u_yAxisMax;
  uniform float u_barWidth;
  uniform float u_marginLeft;
  uniform float u_marginRight;
  uniform float u_marginTop;
  uniform float u_marginBottom;
  uniform float u_minTimestamp;
  uniform float u_maxTimestamp;

  varying float v_value;
  varying float v_yAxisMax;

  void main() {
    float chartWidth = u_resolution.x - u_marginLeft - u_marginRight;
    float chartHeight = u_resolution.y - u_marginTop - u_marginBottom;

    // Calculate bar position based on timestamp (time-proportional)
    float timeRange = u_maxTimestamp - u_minTimestamp;
    float normalizedTime = (a_timestamp - u_minTimestamp) / timeRange;
    float x = u_marginLeft + normalizedTime * chartWidth + a_position.x * u_barWidth * 0.5;

    // Clamp height to yAxisMax for display
    float normalizedHeight = min(a_value / u_yAxisMax, 1.0);
    float y = u_marginBottom + a_position.y * normalizedHeight * chartHeight;

    // Convert to clip space (-1 to 1)
    vec2 clipSpace = (vec2(x, y) / u_resolution) * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, clipSpace.y, 0, 1);

    v_value = a_value;
    v_yAxisMax = u_yAxisMax;
  }
`;

// Fragment shader - colors bars that exceed yAxisMax
// yAxisMax is calculated excluding overall anomaly days, so overflow = anomaly
const FRAGMENT_SHADER = `
  precision mediump float;

  uniform vec3 u_barColor;
  uniform vec3 u_overflowColor;

  varying float v_value;
  varying float v_yAxisMax;

  void main() {
    vec3 color = v_value > v_yAxisMax ? u_overflowColor : u_barColor;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ];
  }
  return [0.063, 0.725, 0.506]; // Default green
}

export function WebGLBarChart({
  data,
  yAxisMax,
  yAxisMinMax = 100,
  onYAxisMaxChange,
  barColor = '#10b981',
  overflowColor = '#f59e0b',
  width = 800,
  height = 320,
  onTimeRangeSelect
}: WebGLBarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const isYAxisDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartMax = useRef(0);

  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoverLineX, setHoverLineX] = useState<number | null>(null);

  // Time range selection state
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [rangeStartX, setRangeStartX] = useState<number | null>(null);
  const [rangeEndX, setRangeEndX] = useState<number | null>(null);

  // Mobile gesture state
  const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; distance: number; timestamp: number } | null>(null);
  const isPinchingRef = useRef(false);

  // Responsive margins - smaller on mobile
  const margins = useMemo(() => {
    const isMobile = width < 500;
    return {
      left: isMobile ? 45 : 70,
      right: isMobile ? 10 : 30,
      top: isMobile ? 15 : 20,
      bottom: isMobile ? 30 : 40
    };
  }, [width]);

  // Calculate Y-axis ticks - always whole numbers
  const yAxisTicks = useMemo(() => {
    const tickCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round((yAxisMax / tickCount) * i));
    }
    return ticks;
  }, [yAxisMax]);

  // Calculate X-axis ticks (months)
  const xAxisTicks = useMemo(() => {
    if (data.length === 0) return [];

    const ticks: { timestamp: number; label: string }[] = [];
    const startDate = new Date(data[0].timestamp);
    const endDate = new Date(data[data.length - 1].timestamp);

    // Check if range spans multiple years
    const spansMultipleYears = startDate.getFullYear() !== endDate.getFullYear();

    const current = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    while (current <= endDate) {
      const label = spansMultipleYears
        ? `${current.getMonth() + 1}/${current.getDate()}/${String(current.getFullYear()).slice(-2)}`
        : `${current.getMonth() + 1}/${current.getDate()}`;
      ticks.push({
        timestamp: current.getTime(),
        label
      });
      current.setMonth(current.getMonth() + 1);
    }
    return ticks;
  }, [data]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Disable antialiasing for sharp edges on geometric shapes
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;

    // Get uniform locations
    uniformsRef.current = {
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_yAxisMax: gl.getUniformLocation(program, 'u_yAxisMax'),
      u_barWidth: gl.getUniformLocation(program, 'u_barWidth'),
      u_marginLeft: gl.getUniformLocation(program, 'u_marginLeft'),
      u_marginRight: gl.getUniformLocation(program, 'u_marginRight'),
      u_marginTop: gl.getUniformLocation(program, 'u_marginTop'),
      u_marginBottom: gl.getUniformLocation(program, 'u_marginBottom'),
      u_minTimestamp: gl.getUniformLocation(program, 'u_minTimestamp'),
      u_maxTimestamp: gl.getUniformLocation(program, 'u_maxTimestamp'),
      u_barColor: gl.getUniformLocation(program, 'u_barColor'),
      u_overflowColor: gl.getUniformLocation(program, 'u_overflowColor')
    };

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  // Create and update vertex buffers when data changes
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program || data.length === 0) return;

    gl.useProgram(program);

    // Build vertex data for bars (2 triangles per bar = 6 vertices)
    const vertexData: number[] = [];
    const valueData: number[] = [];
    const timestampData: number[] = [];

    data.forEach((point) => {
      // Each bar is a rectangle made of 2 triangles
      // Vertex positions relative to bar center (x: -1 to 1, y: 0 to 1)
      const positions = [
        [-1, 0], [1, 0], [1, 1],  // Triangle 1
        [-1, 0], [1, 1], [-1, 1]  // Triangle 2
      ];

      positions.forEach(([x, y]) => {
        vertexData.push(x, y);
        valueData.push(point.value);
        timestampData.push(point.timestamp);
      });
    });

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Value buffer
    const valueBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, valueBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(valueData), gl.STATIC_DRAW);

    const valueLoc = gl.getAttribLocation(program, 'a_value');
    gl.enableVertexAttribArray(valueLoc);
    gl.vertexAttribPointer(valueLoc, 1, gl.FLOAT, false, 0, 0);

    // Timestamp buffer
    const timestampBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, timestampBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(timestampData), gl.STATIC_DRAW);

    const timestampLoc = gl.getAttribLocation(program, 'a_timestamp');
    gl.enableVertexAttribArray(timestampLoc);
    gl.vertexAttribPointer(timestampLoc, 1, gl.FLOAT, false, 0, 0);

    return () => {
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(valueBuffer);
      gl.deleteBuffer(timestampBuffer);
    };
  }, [data]);

  // Calculate full time range from data
  const fullTimeRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 1 };
    return {
      min: data[0].timestamp,
      max: data[data.length - 1].timestamp
    };
  }, [data]);

  // Calculate time range and minimum gap for positioning
  const { timeRange, minGap } = useMemo(() => {
    if (data.length === 0) return { timeRange: { min: 0, max: 1 }, minGap: 1 };

    let minTimeGap = Infinity;
    for (let i = 1; i < data.length; i++) {
      const gap = data[i].timestamp - data[i - 1].timestamp;
      if (gap > 0 && gap < minTimeGap) {
        minTimeGap = gap;
      }
    }

    // Use viewRange if set (for zoom/pan), normalized to min/max
    const range = viewRange
      ? { min: viewRange.start, max: viewRange.end }
      : { min: data[0].timestamp, max: data[data.length - 1].timestamp };

    return {
      timeRange: range,
      minGap: minTimeGap === Infinity ? 1 : minTimeGap
    };
  }, [data, viewRange]);

  // Reset view range when data changes
  useEffect(() => {
    setViewRange(null);
  }, [data]);

  // Render function - only updates uniforms, GPU does the rest
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    if (!gl || !program || data.length === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    gl.useProgram(program);

    // Calculate appropriate bar width based on minimum gap to prevent overlap
    const chartWidth = width - margins.left - margins.right;
    const totalTimeRange = timeRange.max - timeRange.min;
    // Calculate the pixel width that corresponds to the minimum time gap
    const minGapPixelWidth = totalTimeRange > 0 ? (minGap / totalTimeRange) * chartWidth : chartWidth;
    // Bar width should be smaller than the minimum gap (70% of gap width, capped at 12px)
    const barWidth = Math.max(2, Math.min(minGapPixelWidth * 0.7, 12));

    // Set uniforms using scaled dimensions
    gl.uniform2f(uniforms.u_resolution, scaledWidth, scaledHeight);
    gl.uniform1f(uniforms.u_yAxisMax, yAxisMax);
    gl.uniform1f(uniforms.u_barWidth, barWidth * dpr);
    gl.uniform1f(uniforms.u_marginLeft, margins.left * dpr);
    gl.uniform1f(uniforms.u_marginRight, margins.right * dpr);
    gl.uniform1f(uniforms.u_marginTop, margins.top * dpr);
    gl.uniform1f(uniforms.u_marginBottom, margins.bottom * dpr);
    gl.uniform1f(uniforms.u_minTimestamp, timeRange.min);
    gl.uniform1f(uniforms.u_maxTimestamp, timeRange.max);

    const barRgb = hexToRgb(barColor);
    const overflowRgb = hexToRgb(overflowColor);
    gl.uniform3f(uniforms.u_barColor, barRgb[0], barRgb[1], barRgb[2]);
    gl.uniform3f(uniforms.u_overflowColor, overflowRgb[0], overflowRgb[1], overflowRgb[2]);

    // Clear and draw using scaled viewport
    gl.viewport(0, 0, scaledWidth, scaledHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw all bars (6 vertices per bar)
    gl.drawArrays(gl.TRIANGLES, 0, data.length * 6);
  }, [data, yAxisMax, width, height, margins, barColor, overflowColor, timeRange, minGap]);

  // Re-render when yAxisMax changes
  useEffect(() => {
    render();
  }, [render]);

  // Handle drag on Y-axis
  const handleYAxisMouseDown = useCallback((e: React.MouseEvent) => {
    isYAxisDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartMax.current = yAxisMax;
    e.preventDefault();
  }, [yAxisMax]);

  const handleYAxisMouseMove = useCallback((e: MouseEvent) => {
    if (!isYAxisDragging.current || !onYAxisMaxChange) return;

    const deltaY = e.clientY - dragStartY.current;
    const sensitivity = dragStartMax.current / (height - margins.top - margins.bottom);
    const magnitude = Math.log10(Math.max(dragStartMax.current, yAxisMinMax));
    const scaledSensitivity = sensitivity * (magnitude / 6);

    const newMax = Math.round(Math.max(yAxisMinMax, dragStartMax.current - deltaY * scaledSensitivity));
    onYAxisMaxChange(newMax);
  }, [onYAxisMaxChange, height, margins, yAxisMinMax]);

  const handleYAxisMouseUp = useCallback(() => {
    isYAxisDragging.current = false;
  }, []);

  // Convert X position to timestamp
  const xToTimestamp = useCallback((x: number) => {
    const chartWidth = width - margins.left - margins.right;
    const relativeX = Math.max(0, Math.min(chartWidth, x - margins.left));
    const normalizedX = relativeX / chartWidth;
    return timeRange.min + normalizedX * (timeRange.max - timeRange.min);
  }, [width, margins, timeRange]);

  // Handle range selection on canvas
  const handleRangeMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTimeRangeSelect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Only start selection if within chart area
    if (x >= margins.left && x <= width - margins.right) {
      setIsRangeSelecting(true);
      setRangeStartX(x);
      setRangeEndX(x);
    }
  }, [onTimeRangeSelect, margins, width]);

  const handleRangeMouseMove = useCallback((e: MouseEvent) => {
    if (!isRangeSelecting || rangeStartX === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(margins.left, Math.min(width - margins.right, e.clientX - rect.left));
    setRangeEndX(x);
  }, [isRangeSelecting, rangeStartX, margins, width]);

  const handleRangeMouseUp = useCallback(() => {
    if (!isRangeSelecting || rangeStartX === null || rangeEndX === null || !onTimeRangeSelect) {
      setIsRangeSelecting(false);
      setRangeStartX(null);
      setRangeEndX(null);
      return;
    }

    // Convert X positions to timestamps
    const startTimestamp = xToTimestamp(Math.min(rangeStartX, rangeEndX));
    const endTimestamp = xToTimestamp(Math.max(rangeStartX, rangeEndX));

    // Only trigger if selection is meaningful (at least some width)
    if (Math.abs(rangeEndX - rangeStartX) > 10) {
      onTimeRangeSelect(new Date(startTimestamp), new Date(endTimestamp));
    }

    setIsRangeSelecting(false);
    setRangeStartX(null);
    setRangeEndX(null);
  }, [isRangeSelecting, rangeStartX, rangeEndX, onTimeRangeSelect, xToTimestamp]);

  // Handle hover for tooltips
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Calculate which bar is hovered based on timestamp
    const chartWidth = width - margins.left - margins.right;
    const relativeX = x - margins.left;

    if (relativeX >= 0 && relativeX <= chartWidth) {
      // Convert x position to timestamp
      const normalizedX = relativeX / chartWidth;
      const hoverTimestamp = timeRange.min + normalizedX * (timeRange.max - timeRange.min);

      // Find the closest bar to this timestamp
      let closestIndex = 0;
      let closestDistance = Math.abs(data[0].timestamp - hoverTimestamp);

      for (let i = 1; i < data.length; i++) {
        const distance = Math.abs(data[i].timestamp - hoverTimestamp);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      // Only show hover if we're reasonably close to a bar
      const barTimestamp = data[closestIndex].timestamp;
      const barX = margins.left + ((barTimestamp - timeRange.min) / (timeRange.max - timeRange.min)) * chartWidth;

      setHoveredBar(closestIndex);
      setHoverLineX(barX);
    } else {
      setHoveredBar(null);
      setHoverLineX(null);
    }
  }, [data, width, margins, timeRange]);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredBar(null);
    setHoverLineX(null);
  }, []);

  // Helper to update indicator position from touch
  const updateIndicatorFromTouch = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    setMousePos({ x: clientX, y: clientY });

    const chartWidth = width - margins.left - margins.right;
    const relativeX = x - margins.left;

    if (relativeX >= 0 && relativeX <= chartWidth && data.length > 0) {
      const normalizedX = relativeX / chartWidth;
      const hoverTimestamp = timeRange.min + normalizedX * (timeRange.max - timeRange.min);

      let closestIndex = 0;
      let closestDistance = Math.abs(data[0].timestamp - hoverTimestamp);

      for (let i = 1; i < data.length; i++) {
        const distance = Math.abs(data[i].timestamp - hoverTimestamp);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      const barTimestamp = data[closestIndex].timestamp;
      const barX = margins.left + ((barTimestamp - timeRange.min) / (timeRange.max - timeRange.min)) * chartWidth;

      setHoveredBar(closestIndex);
      setHoverLineX(barX);
    }
  }, [data, width, margins, timeRange]);

  // Touch support for mobile - single finger moves indicator, two fingers for pinch zoom and pan
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    if (e.touches.length === 2) {
      // Two-finger gesture start (pinch or pan)
      isPinchingRef.current = true;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      lastTouchRef.current = { x: centerX, distance, timestamp: Date.now() };
      setHoveredBar(null);
      setHoverLineX(null);
    } else if (e.touches.length === 1) {
      // Single touch - moves the vertical indicator
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      lastTouchRef.current = { x: touch.clientX - rect.left, distance: 0, timestamp: Date.now() };
      updateIndicatorFromTouch(touch.clientX, touch.clientY, rect);
    }
  }, [data, width, margins, timeRange, updateIndicatorFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0 || !lastTouchRef.current) return;

    const chartWidth = width - margins.left - margins.right;
    const currentRange = viewRange
      ? { min: viewRange.start, max: viewRange.end }
      : fullTimeRange;
    const timeSpan = currentRange.max - currentRange.min;

    if (e.touches.length === 2 && isPinchingRef.current) {
      // Two-finger gesture: pinch to zoom + pan
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const newDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const rect = canvas.getBoundingClientRect();
      const relativeCenterX = centerX - rect.left - margins.left;
      const centerRatio = Math.max(0, Math.min(1, relativeCenterX / chartWidth));

      // Calculate zoom
      const scale = lastTouchRef.current.distance / newDistance;
      const newTimeSpan = Math.max(
        24 * 60 * 60 * 1000, // Min 1 day
        Math.min(fullTimeRange.max - fullTimeRange.min, timeSpan * scale)
      );

      // Calculate pan
      const deltaX = lastTouchRef.current.x - centerX;
      const deltaTime = (deltaX / chartWidth) * timeSpan;

      // Apply zoom centered on pinch point
      const centerTimestamp = currentRange.min + centerRatio * timeSpan;
      let newStart = centerTimestamp - centerRatio * newTimeSpan + deltaTime;
      let newEnd = centerTimestamp + (1 - centerRatio) * newTimeSpan + deltaTime;

      // Clamp to full range
      if (newStart < fullTimeRange.min) {
        newStart = fullTimeRange.min;
        newEnd = newStart + newTimeSpan;
      }
      if (newEnd > fullTimeRange.max) {
        newEnd = fullTimeRange.max;
        newStart = newEnd - newTimeSpan;
      }

      setViewRange({ start: Math.max(fullTimeRange.min, newStart), end: Math.min(fullTimeRange.max, newEnd) });
      lastTouchRef.current = { x: centerX, distance: newDistance, timestamp: Date.now() };
      setHoveredBar(null);
      setHoverLineX(null);
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      // Single finger: move the indicator
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      updateIndicatorFromTouch(touch.clientX, touch.clientY, rect);
      lastTouchRef.current = { x: touch.clientX - rect.left, distance: 0, timestamp: Date.now() };
    }
  }, [data, width, margins, viewRange, fullTimeRange, updateIndicatorFromTouch]);

  const handleTouchEnd = useCallback(() => {
    isPinchingRef.current = false;
    setTimeout(() => {
      setHoveredBar(null);
      setHoverLineX(null);
    }, 2000);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleYAxisMouseMove);
    document.addEventListener('mouseup', handleYAxisMouseUp);
    document.addEventListener('mousemove', handleRangeMouseMove);
    document.addEventListener('mouseup', handleRangeMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleYAxisMouseMove);
      document.removeEventListener('mouseup', handleYAxisMouseUp);
      document.removeEventListener('mousemove', handleRangeMouseMove);
      document.removeEventListener('mouseup', handleRangeMouseUp);
    };
  }, [handleYAxisMouseMove, handleYAxisMouseUp, handleRangeMouseMove, handleRangeMouseUp]);

  // Calculate tick positions for rendering
  const getXPosition = useCallback((timestamp: number) => {
    if (data.length === 0) return 0;
    const minTime = data[0].timestamp;
    const maxTime = data[data.length - 1].timestamp;
    const chartWidth = width - margins.left - margins.right;
    return margins.left + ((timestamp - minTime) / (maxTime - minTime)) * chartWidth;
  }, [data, width, margins]);

  const getYPosition = useCallback((value: number) => {
    const chartHeight = height - margins.top - margins.bottom;
    return height - margins.bottom - (value / yAxisMax) * chartHeight;
  }, [height, margins, yAxisMax]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Y-axis drag zone - subtle, only shows indicator on hover */}
      <div
        className="absolute cursor-ns-resize group"
        style={{
          left: 0,
          top: margins.top,
          width: margins.left,
          height: height - margins.top - margins.bottom,
          zIndex: 20
        }}
        onMouseDown={handleYAxisMouseDown}
      >
        {/* Subtle hover indicator on the right edge */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-muted-foreground/20 transition-colors"
        />
        {/* Drag hint - only visible on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col items-center text-muted-foreground/60">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <svg className="w-3 h-3 -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Y-axis labels */}
      <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: margins.left - 5 }}>
        {yAxisTicks.map((tick, i) => (
          <div
            key={i}
            className="absolute text-xs text-muted-foreground text-right pr-2"
            style={{
              right: 5,
              top: getYPosition(tick) - 8,
              width: margins.left - 10
            }}
          >
            {formatNumber(tick)}
          </div>
        ))}
      </div>

      {/* X-axis labels */}
      <div className="absolute pointer-events-none" style={{ left: margins.left, bottom: 0, right: margins.right, height: margins.bottom }}>
        {xAxisTicks.map((tick, i) => (
          <div
            key={i}
            className="absolute text-xs text-muted-foreground"
            style={{
              left: getXPosition(tick.timestamp) - margins.left,
              top: 10,
              transform: 'translateX(-50%)'
            }}
          >
            {tick.label}
          </div>
        ))}
      </div>

      {/* Grid lines */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: margins.left, top: margins.top }}
        width={width - margins.left - margins.right}
        height={height - margins.top - margins.bottom}
      >
        {yAxisTicks.map((tick, i) => (
          <line
            key={i}
            x1={0}
            y1={height - margins.top - margins.bottom - (tick / yAxisMax) * (height - margins.top - margins.bottom)}
            x2={width - margins.left - margins.right}
            y2={height - margins.top - margins.bottom - (tick / yAxisMax) * (height - margins.top - margins.bottom)}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="3 3"
          />
        ))}
      </svg>

      {/* WebGL Canvas - scaled by devicePixelRatio for sharp rendering */}
      <canvas
        ref={canvasRef}
        width={width * (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        height={height * (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        className="absolute inset-0 touch-none"
        style={{ width, height, cursor: onTimeRangeSelect ? 'crosshair' : 'default' }}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onMouseDown={handleRangeMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Reset zoom button (shown when zoomed) */}
      {viewRange && (
        <button
          onClick={() => setViewRange(null)}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-background/80 border border-border rounded shadow-sm hover:bg-accent"
        >
          Reset Zoom
        </button>
      )}

      {/* Range selection overlay */}
      {isRangeSelecting && rangeStartX !== null && rangeEndX !== null && (
        <div
          className="absolute pointer-events-none bg-primary/20 border-x-2 border-primary"
          style={{
            left: Math.min(rangeStartX, rangeEndX),
            top: margins.top,
            width: Math.abs(rangeEndX - rangeStartX),
            height: height - margins.top - margins.bottom
          }}
        />
      )}

      {/* Vertical hover line */}
      {hoverLineX !== null && !isRangeSelecting && (
        <div
          className="absolute pointer-events-none bg-white/80 dark:bg-white/60"
          style={{
            left: hoverLineX,
            top: margins.top,
            width: 1,
            height: height - margins.top - margins.bottom
          }}
        />
      )}

      {/* Tooltip */}
      {hoveredBar !== null && data[hoveredBar] && (() => {
        const tooltipWidth = 220;
        const shouldFlipLeft = mousePos.x + tooltipWidth + 10 > window.innerWidth;
        return (
        <div
          className="fixed z-50 bg-background border border-border rounded-lg p-3 shadow-lg pointer-events-none min-w-[200px]"
          style={{
            left: shouldFlipLeft ? mousePos.x - tooltipWidth - 10 : mousePos.x + 10,
            top: mousePos.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <p className="font-medium border-b border-border pb-1 mb-2">{data[hoveredBar].date}</p>
          <p className="text-green-600 dark:text-green-400 font-medium mb-2">
            Gain: +{formatNumber(data[hoveredBar].value)}
          </p>
          {data[hoveredBar].skillBreakdown && data[hoveredBar].skillBreakdown.length > 0 && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium mb-1">Top Skills:</p>
              {data[hoveredBar].skillBreakdown!.map((skill, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-foreground capitalize">{skill.skill.toLowerCase()}</span>
                  <span className="text-green-600 dark:text-green-400 ml-2">+{formatNumber(skill.experience)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
