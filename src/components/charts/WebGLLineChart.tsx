import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { formatNumber } from '@/lib/dataUtils';

interface SkillGain {
  skill: string;
  experience: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
  dailyGain: number;
  date: string;
  level?: number;
  skillBreakdown?: SkillGain[];
}

interface WebGLLineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  lineColor?: string;
  dotColor?: string;
  valueLabel?: string;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
}

// Vertex shader for line segments
const LINE_VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;

  void main() {
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace.x, clipSpace.y, 0, 1);
  }
`;

// Vertex shader for dots
const DOT_VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform float u_pointSize;

  void main() {
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace.x, clipSpace.y, 0, 1);
    gl_PointSize = u_pointSize;
  }
`;

// Fragment shader
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 u_color;

  void main() {
    gl_FragColor = vec4(u_color, 1.0);
  }
`;

// Fragment shader for round dots with anti-aliased edges and white center
const DOT_FRAGMENT_SHADER = `
  #extension GL_OES_standard_derivatives : enable
  precision mediump float;
  uniform vec3 u_color;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    // Calculate anti-aliasing width based on rate of change
    float fw = fwidth(dist);
    float edgeWidth = max(fw * 1.5, 0.02);

    // Anti-aliased outer edge
    float outerAlpha = 1.0 - smoothstep(0.5 - edgeWidth, 0.5, dist);
    if (outerAlpha < 0.01) {
      discard;
    }

    // White inner center (40% of radius) with smooth transition
    float innerBlend = smoothstep(0.2 - edgeWidth, 0.2 + edgeWidth, dist);
    vec3 color = mix(vec3(1.0), u_color, innerBlend);

    gl_FragColor = vec4(color, outerAlpha);
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
  return [0.231, 0.510, 0.965]; // Default blue #3b82f6
}

// Smooth monotone cubic interpolation
// Uses weighted average of slopes for smoother curves while preserving monotonicity
function monotoneCubicSpline(
  points: { x: number; y: number }[],
  segments: number = 10
): { x: number; y: number }[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    // Just linear interpolation for 2 points
    const result: { x: number; y: number }[] = [];
    for (let t = 0; t <= 1; t += 1 / segments) {
      result.push({
        x: points[0].x + t * (points[1].x - points[0].x),
        y: points[0].y + t * (points[1].y - points[0].y)
      });
    }
    result.push(points[1]);
    return result;
  }

  const n = points.length;

  // Calculate slopes (secants) between consecutive points
  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  // Calculate tangents using weighted average for smoother curves
  const tangents: number[] = new Array(n);

  // First point: use first slope
  tangents[0] = slopes[0];

  // Interior points: weighted average of neighboring slopes
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      // Sign change - use zero tangent
      tangents[i] = 0;
    } else {
      // Weighted average based on segment lengths for smoother transition
      const w1 = dx[i];
      const w2 = dx[i - 1];
      tangents[i] = (w1 * slopes[i - 1] + w2 * slopes[i]) / (w1 + w2);
    }
  }

  // Last point: use last slope
  tangents[n - 1] = slopes[n - 2];

  // Gentle monotonicity constraint - only clamp extreme cases
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      // Clamp tangents to be within reasonable bounds of the slope
      const maxTangent = Math.abs(slopes[i]) * 2.5;
      tangents[i] = Math.max(-maxTangent, Math.min(maxTangent, tangents[i]));
      tangents[i + 1] = Math.max(-maxTangent, Math.min(maxTangent, tangents[i + 1]));

      // Ensure tangents don't cause overshoot
      if (slopes[i] > 0) {
        tangents[i] = Math.max(0, tangents[i]);
        tangents[i + 1] = Math.max(0, tangents[i + 1]);
      } else if (slopes[i] < 0) {
        tangents[i] = Math.min(0, tangents[i]);
        tangents[i + 1] = Math.min(0, tangents[i + 1]);
      }
    }
  }

  // Generate interpolated points using Hermite basis functions
  const result: { x: number; y: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const x0 = points[i].x;
    const y0 = points[i].y;
    const x1 = points[i + 1].x;
    const y1 = points[i + 1].y;
    const m0 = tangents[i] * dx[i];
    const m1 = tangents[i + 1] * dx[i];

    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      // Hermite basis functions
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const x = x0 + t * (x1 - x0); // Linear x interpolation
      const y = h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1;

      result.push({ x, y });
    }
  }

  return result;
}

export function WebGLLineChart({
  data,
  width = 800,
  height = 320,
  lineColor = '#3b82f6',
  dotColor = '#3b82f6',
  valueLabel = 'Value',
  onTimeRangeSelect
}: WebGLLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const lineProgramRef = useRef<WebGLProgram | null>(null);
  const dotProgramRef = useRef<WebGLProgram | null>(null);
  const lastDataIdRef = useRef<string>('');
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoverLineX, setHoverLineX] = useState<number | null>(null);
  const [glReady, setGlReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animationStarted, setAnimationStarted] = useState(false);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragEndX, setDragEndX] = useState<number | null>(null);

  const margins = useMemo(() => ({
    left: 70,
    right: 30,
    top: 20,
    bottom: 40
  }), []);

  // Calculate Y-axis domain with padding
  const yAxisDomain = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = Math.max(range * 0.1, 1);
    return {
      min: Math.max(0, min - padding),
      max: max + padding
    };
  }, [data]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 1 };
    return {
      min: data[0].timestamp,
      max: data[data.length - 1].timestamp
    };
  }, [data]);

  // Calculate Y-axis ticks
  const yAxisTicks = useMemo(() => {
    const tickCount = 5;
    const range = yAxisDomain.max - yAxisDomain.min;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round(yAxisDomain.min + (range / tickCount) * i));
    }
    return ticks;
  }, [yAxisDomain]);

  // Calculate X-axis ticks (months)
  const xAxisTicks = useMemo(() => {
    if (data.length === 0) return [];

    const ticks: { timestamp: number; label: string }[] = [];
    const startDate = new Date(data[0].timestamp);
    const endDate = new Date(data[data.length - 1].timestamp);
    const spansYears = startDate.getFullYear() !== endDate.getFullYear();

    const current = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    while (current <= endDate) {
      const label = spansYears
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

    const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Enable derivatives extension for anti-aliasing
    gl.getExtension('OES_standard_derivatives');

    // Create line program
    const lineVertexShader = createShader(gl, gl.VERTEX_SHADER, LINE_VERTEX_SHADER);
    const lineFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (lineVertexShader && lineFragmentShader) {
      lineProgramRef.current = createProgram(gl, lineVertexShader, lineFragmentShader);
    }

    // Create dot program
    const dotVertexShader = createShader(gl, gl.VERTEX_SHADER, DOT_VERTEX_SHADER);
    const dotFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, DOT_FRAGMENT_SHADER);
    if (dotVertexShader && dotFragmentShader) {
      dotProgramRef.current = createProgram(gl, dotVertexShader, dotFragmentShader);
    }

    // Enable blending for smooth edges
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    setGlReady(true);

    return () => {
      if (lineProgramRef.current) gl.deleteProgram(lineProgramRef.current);
      if (dotProgramRef.current) gl.deleteProgram(dotProgramRef.current);
      setGlReady(false);
    };
  }, []);

  // Render function with animation support
  const render = useCallback((progress: number = 1, hoveredIdx: number | null = null) => {
    const gl = glRef.current;
    const lineProgram = lineProgramRef.current;
    const dotProgram = dotProgramRef.current;
    if (!gl || !lineProgram || !dotProgram || data.length === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    gl.viewport(0, 0, scaledWidth, scaledHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const chartWidth = (width - margins.left - margins.right) * dpr;
    const chartHeight = (height - margins.top - margins.bottom) * dpr;
    const marginLeft = margins.left * dpr;
    const marginBottom = margins.bottom * dpr;

    // Convert data points to screen coordinates
    const screenPoints: { x: number; y: number }[] = [];
    data.forEach(point => {
      const normalizedX = (point.timestamp - timeRange.min) / (timeRange.max - timeRange.min);
      const normalizedY = (point.value - yAxisDomain.min) / (yAxisDomain.max - yAxisDomain.min);
      const x = marginLeft + normalizedX * chartWidth;
      const y = marginBottom + normalizedY * chartHeight;
      screenPoints.push({ x, y });
    });

    // Generate smooth spline curve
    const splinePoints = monotoneCubicSpline(screenPoints, 8);

    // Calculate how many spline points to draw based on animation progress
    const splineDrawCount = Math.floor(splinePoints.length * progress);

    // Draw lines using spline
    gl.useProgram(lineProgram);

    // Build line segments from spline points
    const lineVertices: number[] = [];
    for (let i = 0; i < splineDrawCount - 1; i++) {
      lineVertices.push(splinePoints[i].x, splinePoints[i].y);
      lineVertices.push(splinePoints[i + 1].x, splinePoints[i + 1].y);
    }

    if (lineVertices.length > 0) {
      const lineBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineVertices), gl.STATIC_DRAW);

      const linePosLoc = gl.getAttribLocation(lineProgram, 'a_position');
      gl.enableVertexAttribArray(linePosLoc);
      gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0);

      const lineResLoc = gl.getUniformLocation(lineProgram, 'u_resolution');
      gl.uniform2f(lineResLoc, scaledWidth, scaledHeight);

      const lineColorLoc = gl.getUniformLocation(lineProgram, 'u_color');
      const lineRgb = hexToRgb(lineColor);
      gl.uniform3f(lineColorLoc, lineRgb[0], lineRgb[1], lineRgb[2]);

      gl.lineWidth(2.0 * dpr);
      gl.drawArrays(gl.LINES, 0, lineVertices.length / 2);

      gl.deleteBuffer(lineBuffer);
    }

    // Calculate how many data points to show based on animation progress
    const dotDrawCount = Math.floor(data.length * progress);

    // Draw dots (only actual data points, not spline points)
    gl.useProgram(dotProgram);

    const dotPosLoc = gl.getAttribLocation(dotProgram, 'a_position');
    const dotResLoc = gl.getUniformLocation(dotProgram, 'u_resolution');
    const dotColorLoc = gl.getUniformLocation(dotProgram, 'u_color');
    const pointSizeLoc = gl.getUniformLocation(dotProgram, 'u_pointSize');

    const dotRgb = hexToRgb(dotColor);

    // First pass: draw regular sized dots (excluding hovered)
    const regularDotPositions: number[] = [];
    for (let i = 0; i < dotDrawCount; i++) {
      if (i !== hoveredIdx) {
        regularDotPositions.push(screenPoints[i].x, screenPoints[i].y);
      }
    }

    if (regularDotPositions.length > 0) {
      const regularDotBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, regularDotBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(regularDotPositions), gl.STATIC_DRAW);

      gl.enableVertexAttribArray(dotPosLoc);
      gl.vertexAttribPointer(dotPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(dotResLoc, scaledWidth, scaledHeight);
      gl.uniform3f(dotColorLoc, dotRgb[0], dotRgb[1], dotRgb[2]);
      gl.uniform1f(pointSizeLoc, 10.0 * dpr);

      gl.drawArrays(gl.POINTS, 0, regularDotPositions.length / 2);
      gl.deleteBuffer(regularDotBuffer);
    }

    // Second pass: draw hovered dot larger
    if (hoveredIdx !== null && hoveredIdx < dotDrawCount && screenPoints[hoveredIdx]) {
      const hoveredDotBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, hoveredDotBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        screenPoints[hoveredIdx].x,
        screenPoints[hoveredIdx].y
      ]), gl.STATIC_DRAW);

      gl.enableVertexAttribArray(dotPosLoc);
      gl.vertexAttribPointer(dotPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(dotResLoc, scaledWidth, scaledHeight);
      gl.uniform3f(dotColorLoc, dotRgb[0], dotRgb[1], dotRgb[2]);
      gl.uniform1f(pointSizeLoc, 16.0 * dpr); // 60% larger on hover

      gl.drawArrays(gl.POINTS, 0, 1);
      gl.deleteBuffer(hoveredDotBuffer);
    }
  }, [data, width, height, margins, timeRange, yAxisDomain, lineColor, dotColor]);

  // Cleanup animation on unmount only
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Animate when data changes (including activity/time range changes)
  useEffect(() => {
    if (!glReady || data.length === 0) return;

    // Create ID from data content - will change when activity or time range changes
    const dataId = `${data[0].timestamp}-${data[data.length - 1].timestamp}-${data.length}-${data.reduce((sum, d) => sum + d.value, 0)}`;

    if (dataId !== lastDataIdRef.current) {
      const isFirstRender = lastDataIdRef.current === '';
      lastDataIdRef.current = dataId;

      // Cancel any pending animation before starting new one
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Reset animation state for new data
      setAnimationStarted(false);
      setProgress(0);

      // Delay initial animation to let DOM settle
      const delay = isFirstRender ? 300 : 50;

      animationTimeoutRef.current = setTimeout(() => {
        animationTimeoutRef.current = null;
        setAnimationStarted(true);

        // Start animation
        const startTime = performance.now();
        const duration = 1000;

        const animate = () => {
          const elapsed = performance.now() - startTime;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic

          setProgress(eased);

          if (t < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          } else {
            animationFrameRef.current = null;
          }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      }, delay);
    }
    // No cleanup here - handled by separate unmount effect
  }, [glReady, data]);

  // Render when progress or hover changes (only after animation has started)
  useEffect(() => {
    if (!glReady || data.length === 0 || !animationStarted) return;
    render(progress, hoveredPoint);
  }, [render, glReady, data, hoveredPoint, width, height, progress, animationStarted]);

  // Handle hover for tooltips and drag selection
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Update drag end position if dragging
    if (isDragging) {
      setDragEndX(x);
    }

    const chartWidth = width - margins.left - margins.right;
    const relativeX = x - margins.left;

    if (relativeX >= 0 && relativeX <= chartWidth) {
      // Only show hover effects when not dragging
      if (!isDragging) {
        const normalizedX = relativeX / chartWidth;
        const hoverTimestamp = timeRange.min + normalizedX * (timeRange.max - timeRange.min);

        // Find closest point
        let closestIndex = 0;
        let closestDistance = Math.abs(data[0].timestamp - hoverTimestamp);

        for (let i = 1; i < data.length; i++) {
          const distance = Math.abs(data[i].timestamp - hoverTimestamp);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
          }
        }

        const pointTimestamp = data[closestIndex].timestamp;
        const pointX = margins.left + ((pointTimestamp - timeRange.min) / (timeRange.max - timeRange.min)) * chartWidth;

        setHoveredPoint(closestIndex);
        setHoverLineX(pointX);
      }
    } else if (!isDragging) {
      setHoveredPoint(null);
      setHoverLineX(null);
    }
  }, [data, width, margins, timeRange, isDragging]);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    setHoverLineX(null);
    // Cancel drag if mouse leaves
    if (isDragging) {
      setIsDragging(false);
      setDragStartX(null);
      setDragEndX(null);
    }
  }, [isDragging]);

  // Drag selection handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTimeRangeSelect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartWidth = width - margins.left - margins.right;
    const relativeX = x - margins.left;

    if (relativeX >= 0 && relativeX <= chartWidth) {
      setIsDragging(true);
      setDragStartX(x);
      setDragEndX(x);
    }
  }, [onTimeRangeSelect, width, margins]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || dragStartX === null || dragEndX === null || !onTimeRangeSelect) {
      setIsDragging(false);
      setDragStartX(null);
      setDragEndX(null);
      return;
    }

    const chartWidth = width - margins.left - margins.right;
    const startRelX = Math.max(0, Math.min(dragStartX - margins.left, chartWidth));
    const endRelX = Math.max(0, Math.min(dragEndX - margins.left, chartWidth));

    // Ensure we have a meaningful selection (at least 10 pixels)
    if (Math.abs(endRelX - startRelX) > 10) {
      const startNorm = Math.min(startRelX, endRelX) / chartWidth;
      const endNorm = Math.max(startRelX, endRelX) / chartWidth;

      const startTimestamp = timeRange.min + startNorm * (timeRange.max - timeRange.min);
      const endTimestamp = timeRange.min + endNorm * (timeRange.max - timeRange.min);

      onTimeRangeSelect(new Date(startTimestamp), new Date(endTimestamp));
    }

    setIsDragging(false);
    setDragStartX(null);
    setDragEndX(null);
  }, [isDragging, dragStartX, dragEndX, onTimeRangeSelect, width, margins, timeRange]);

  // Global mouse up handler for drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // Position helpers
  const getXPosition = useCallback((timestamp: number) => {
    const chartWidth = width - margins.left - margins.right;
    return margins.left + ((timestamp - timeRange.min) / (timeRange.max - timeRange.min)) * chartWidth;
  }, [width, margins, timeRange]);

  const getYPosition = useCallback((value: number) => {
    const chartHeight = height - margins.top - margins.bottom;
    const normalizedY = (value - yAxisDomain.min) / (yAxisDomain.max - yAxisDomain.min);
    return height - margins.bottom - normalizedY * chartHeight;
  }, [height, margins, yAxisDomain]);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
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
            y1={height - margins.top - margins.bottom - ((tick - yAxisDomain.min) / (yAxisDomain.max - yAxisDomain.min)) * (height - margins.top - margins.bottom)}
            x2={width - margins.left - margins.right}
            y2={height - margins.top - margins.bottom - ((tick - yAxisDomain.min) / (yAxisDomain.max - yAxisDomain.min)) * (height - margins.top - margins.bottom)}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="3 3"
          />
        ))}
      </svg>

      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        width={width * (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        height={height * (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        className="absolute inset-0"
        style={{ width, height, cursor: onTimeRangeSelect ? 'crosshair' : 'default' }}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onMouseDown={handleMouseDown}
      />

      {/* Drag selection overlay */}
      {isDragging && dragStartX !== null && dragEndX !== null && (
        <div
          className="absolute pointer-events-none bg-primary/20 border-x-2 border-primary"
          style={{
            left: Math.min(dragStartX, dragEndX),
            top: margins.top,
            width: Math.abs(dragEndX - dragStartX),
            height: height - margins.top - margins.bottom
          }}
        />
      )}

      {/* Vertical hover line */}
      {hoverLineX !== null && !isDragging && (
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
      {hoveredPoint !== null && data[hoveredPoint] && (() => {
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
          <p className="font-medium border-b border-border pb-1 mb-2">{data[hoveredPoint].date}</p>
          <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">
            {valueLabel}: {formatNumber(data[hoveredPoint].value)}
          </p>
          {data[hoveredPoint].dailyGain > 0 && (
            <p className="text-green-600 dark:text-green-400 mb-2">
              Gain: +{formatNumber(data[hoveredPoint].dailyGain)}
            </p>
          )}
          {data[hoveredPoint].level && (
            <p className="text-muted-foreground mb-2">
              Level: {data[hoveredPoint].level}
            </p>
          )}
          {data[hoveredPoint].skillBreakdown && data[hoveredPoint].skillBreakdown!.length > 0 && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium mb-1">Daily Gain Breakdown:</p>
              {data[hoveredPoint].skillBreakdown!.map((skill, idx) => (
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
