import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { formatNumber } from '@/lib/dataUtils';

interface SkillGain {
  skill: string;
  experience: number;
}

interface HeatmapCell {
  date: Date;
  experience: number;
  weekIndex: number;
  dayOfWeek: number;
  month: number;
  year: number;
  dateString: string;
  skillBreakdown?: SkillGain[];
}

interface WebGLHeatmapProps {
  cells: HeatmapCell[];
  monthLabels: Array<{ label: string; weekIndex: number }>;
  width: number;
  height: number;
}

// Vertex shader for rendering rounded rectangles
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  attribute vec2 a_uv;

  uniform vec2 u_resolution;

  varying vec4 v_color;
  varying vec2 v_uv;

  void main() {
    // Convert from pixels to clip space
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1);

    v_color = a_color;
    v_uv = a_uv;
  }
`;

// Fragment shader with rounded corners using SDF
const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec4 v_color;
  varying vec2 v_uv;

  // SDF for rounded rectangle
  float roundedRectSDF(vec2 uv, vec2 size, float radius) {
    vec2 d = abs(uv) - size + radius;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - radius;
  }

  void main() {
    // UV coordinates are 0-1 within each cell, convert to -0.5 to 0.5
    vec2 centered = v_uv - vec2(0.5);

    // Cell size is 1.0, corner radius as fraction of cell
    float cornerRadius = 0.15;
    float halfSize = 0.5;

    float dist = roundedRectSDF(centered, vec2(halfSize), cornerRadius);

    // Smooth edge for anti-aliasing
    float alpha = 1.0 - smoothstep(-0.02, 0.02, dist);

    if (alpha < 0.01) {
      discard;
    }

    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

// Color thresholds matching the original component
function getIntensityColor(experience: number, isDarkMode: boolean): [number, number, number, number] {
  if (experience === 0) {
    return isDarkMode ? [31, 41, 55, 1] : [243, 244, 246, 1]; // gray-800 / gray-100
  }

  // Green scale based on XP thresholds
  if (experience < 50_000) {
    return isDarkMode ? [5, 46, 22, 1] : [220, 252, 231, 1]; // green-950 / green-100
  } else if (experience < 150_000) {
    return isDarkMode ? [20, 83, 45, 1] : [187, 247, 208, 1]; // green-900 / green-200
  } else if (experience < 300_000) {
    return isDarkMode ? [22, 101, 52, 1] : [134, 239, 172, 1]; // green-800 / green-300
  } else if (experience < 500_000) {
    return isDarkMode ? [21, 128, 61, 1] : [74, 222, 128, 1]; // green-700 / green-400
  } else if (experience < 750_000) {
    return isDarkMode ? [22, 163, 74, 1] : [34, 197, 94, 1]; // green-600 / green-500
  } else if (experience < 1_000_000) {
    return isDarkMode ? [34, 197, 94, 1] : [22, 163, 74, 1]; // green-500 / green-600
  } else if (experience < 2_000_000) {
    return isDarkMode ? [74, 222, 128, 1] : [21, 128, 61, 1]; // green-400 / green-700
  } else {
    return isDarkMode ? [134, 239, 172, 1] : [22, 101, 52, 1]; // green-300 / green-800
  }
}

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

const DEFAULT_CELL_SIZE = 12;
const DEFAULT_CELL_GAP = 4;
const MARGIN_LEFT = 40;
const MARGIN_TOP = 30;
const MIN_CELL_SIZE = 4;
const MIN_CELL_GAP = 1;

export function WebGLHeatmap({ cells, monthLabels, width, height }: WebGLHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Group cells by week
  const weeks = useMemo(() => {
    return cells.reduce((acc, cell) => {
      if (!acc[cell.weekIndex]) {
        acc[cell.weekIndex] = [];
      }
      acc[cell.weekIndex].push(cell);
      return acc;
    }, {} as Record<number, HeatmapCell[]>);
  }, [cells]);

  const weekCount = useMemo(() => Object.keys(weeks).length, [weeks]);

  // Calculate dynamic cell size based on available width
  const { cellSize, cellGap } = useMemo(() => {
    if (weekCount === 0) return { cellSize: DEFAULT_CELL_SIZE, cellGap: DEFAULT_CELL_GAP };

    const availableWidth = width - MARGIN_LEFT - 20; // 20px right margin
    const totalCellWidth = DEFAULT_CELL_SIZE + DEFAULT_CELL_GAP;

    // Check if default size fits
    if (weekCount * totalCellWidth <= availableWidth) {
      return { cellSize: DEFAULT_CELL_SIZE, cellGap: DEFAULT_CELL_GAP };
    }

    // Calculate scaled size to fit all weeks
    const scaledTotalWidth = availableWidth / weekCount;
    // Keep gap proportional but with a minimum
    const gapRatio = DEFAULT_CELL_GAP / totalCellWidth;
    let newGap = Math.max(MIN_CELL_GAP, Math.floor(scaledTotalWidth * gapRatio));
    let newSize = Math.max(MIN_CELL_SIZE, Math.floor(scaledTotalWidth - newGap));

    return { cellSize: newSize, cellGap: newGap };
  }, [weekCount, width]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    programRef.current = program;

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  // Render the heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    const program = programRef.current;

    if (!canvas || !gl || !program || cells.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    gl.viewport(0, 0, scaledWidth, scaledHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(program);

    // Build vertex data for all cells
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    const scaledCellSize = cellSize * dpr;
    const scaledCellGap = cellGap * dpr;
    const marginLeft = MARGIN_LEFT * dpr;
    const marginTop = MARGIN_TOP * dpr;

    Object.keys(weeks)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((weekIdxStr, colIdx) => {
        const weekCells = weeks[Number(weekIdxStr)];

        [0, 1, 2, 3, 4, 5, 6].forEach(dayIdx => {
          const cell = weekCells.find(c => c.dayOfWeek === dayIdx);
          if (!cell) return;

          const x = marginLeft + colIdx * (scaledCellSize + scaledCellGap);
          const y = marginTop + dayIdx * (scaledCellSize + scaledCellGap);
          const color = getIntensityColor(cell.experience, isDarkMode);

          // Two triangles for each rectangle with UV coordinates
          // Triangle 1: top-left, top-right, bottom-left
          positions.push(x, y);
          uvs.push(0, 0);
          positions.push(x + scaledCellSize, y);
          uvs.push(1, 0);
          positions.push(x, y + scaledCellSize);
          uvs.push(0, 1);

          // Triangle 2: top-right, bottom-right, bottom-left
          positions.push(x + scaledCellSize, y);
          uvs.push(1, 0);
          positions.push(x + scaledCellSize, y + scaledCellSize);
          uvs.push(1, 1);
          positions.push(x, y + scaledCellSize);
          uvs.push(0, 1);

          // 6 vertices per cell
          for (let i = 0; i < 6; i++) {
            colors.push(color[0] / 255, color[1] / 255, color[2] / 255, color[3]);
          }
        });
      });

    // Create and bind buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const colorLocation = gl.getAttribLocation(program, 'a_color');
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    const uvLocation = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    // Set resolution uniform
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    gl.uniform2f(resolutionLocation, scaledWidth, scaledHeight);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

    // Cleanup
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
    gl.deleteBuffer(uvBuffer);
  }, [cells, weeks, width, height, isDarkMode, cellSize, cellGap]);

  // Handle mouse movement for hover
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate which cell is hovered
    const cellX = Math.floor((x - MARGIN_LEFT) / (cellSize + cellGap));
    const cellY = Math.floor((y - MARGIN_TOP) / (cellSize + cellGap));

    if (cellX >= 0 && cellX < weekCount && cellY >= 0 && cellY < 7) {
      const weekKeys = Object.keys(weeks).sort((a, b) => Number(a) - Number(b));
      if (cellX < weekKeys.length) {
        const weekCells = weeks[Number(weekKeys[cellX])];
        const cell = weekCells?.find(c => c.dayOfWeek === cellY);
        if (cell) {
          setHoveredCell(cell);
          setMousePosition({ x: event.clientX, y: event.clientY - 10 });
          return;
        }
      }
    }

    setHoveredCell(null);
  }, [weeks, weekCount, cellSize, cellGap]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  // Touch support for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const cellX = Math.floor((x - MARGIN_LEFT) / (cellSize + cellGap));
    const cellY = Math.floor((y - MARGIN_TOP) / (cellSize + cellGap));

    if (cellX >= 0 && cellX < weekCount && cellY >= 0 && cellY < 7) {
      const weekKeys = Object.keys(weeks).sort((a, b) => Number(a) - Number(b));
      if (cellX < weekKeys.length) {
        const weekCells = weeks[Number(weekKeys[cellX])];
        const cell = weekCells?.find(c => c.dayOfWeek === cellY);
        if (cell) {
          setHoveredCell(cell);
          setMousePosition({ x: touch.clientX, y: touch.clientY - 10 });
          return;
        }
      }
    }
    setHoveredCell(null);
  }, [weeks, weekCount, cellSize, cellGap]);

  const handleTouchEnd = useCallback(() => {
    setTimeout(() => setHoveredCell(null), 2000);
  }, []);

  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative" style={{ width, height: height + 60 }}>
      {/* Month labels */}
      <div
        className="absolute text-xs text-muted-foreground"
        style={{ left: MARGIN_LEFT, top: 0, height: MARGIN_TOP }}
      >
        {monthLabels.map((label, idx) => (
          <div
            key={idx}
            className="absolute whitespace-nowrap"
            style={{ left: label.weekIndex * (cellSize + cellGap) }}
          >
            {label.label}
          </div>
        ))}
      </div>

      {/* Day labels */}
      <div
        className="absolute flex flex-col text-xs text-muted-foreground"
        style={{ left: 0, top: MARGIN_TOP, width: MARGIN_LEFT }}
      >
        {DAYS.map((day, idx) => (
          <div
            key={idx}
            className="flex items-center justify-end pr-2"
            style={{
              height: cellSize + cellGap,
              visibility: idx % 2 === 1 ? 'visible' : 'hidden'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* WebGL Canvas */}
      <div
        className="absolute touch-pan-x"
        style={{ left: 0, top: 0, width, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          style={{ width, height }}
        />
      </div>

      {/* Legend */}
      <div
        className="absolute flex items-center gap-2 text-xs text-muted-foreground"
        style={{ left: MARGIN_LEFT, top: height + 10 }}
      >
        <span>0</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" title="No XP" />
          <div className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-950" title="< 50k XP" />
          <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" title="50k-150k XP" />
          <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-800" title="150k-300k XP" />
          <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" title="300k-500k XP" />
          <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" title="500k-750k XP" />
          <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" title="750k-1M XP" />
          <div className="w-3 h-3 rounded-sm bg-green-700 dark:bg-green-400" title="1M-2M XP" />
          <div className="w-3 h-3 rounded-sm bg-green-800 dark:bg-green-300" title="2M+ XP" />
        </div>
        <span>2M+</span>
      </div>

      {/* Tooltip */}
      {hoveredCell && (() => {
        const tooltipWidth = 220;
        const shouldFlipLeft = mousePosition.x + tooltipWidth / 2 > window.innerWidth;
        const shouldFlipRight = mousePosition.x - tooltipWidth / 2 < 0;
        const left = shouldFlipLeft
          ? mousePosition.x - tooltipWidth / 2 - 10
          : shouldFlipRight
            ? mousePosition.x + tooltipWidth / 2 + 10
            : mousePosition.x;
        const transform = shouldFlipLeft
          ? 'translate(-100%, -100%)'
          : shouldFlipRight
            ? 'translate(0%, -100%)'
            : 'translate(-50%, -100%)';
        return (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left,
            top: mousePosition.y,
            transform
          }}
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-md shadow-lg min-w-[200px]">
            <div className="text-sm font-medium border-b border-gray-700 pb-1 mb-2">
              {hoveredCell.date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
            <div className="text-xs">
              {hoveredCell.experience > 0 ? (
                <>
                  <div className="text-green-400 font-medium mb-2">
                    Total: +{formatNumber(hoveredCell.experience)} XP
                  </div>
                  {hoveredCell.skillBreakdown && hoveredCell.skillBreakdown.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-gray-300 text-xs font-medium mb-1">Top Skills:</div>
                      {hoveredCell.skillBreakdown.map((skill, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-gray-300 capitalize">{skill.skill.toLowerCase()}</span>
                          <span className="text-green-300 ml-2">+{formatNumber(skill.experience)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-400">No experience gained</span>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
