import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";

type Vec3 = [number, number, number];
type ScreenPoint = { x: number; y: number; s: number };
type GridLine = [ScreenPoint, ScreenPoint];
type Axis = "x" | "y" | "z";
type TextAnchor = "middle" | "end";

type SliderProps = {
  label: string;
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
  min?: number;
  max?: number;
  step?: number;
  color: string;
};

const DEG = Math.PI / 180;

function rotatePoint(x: number, y: number, z: number, azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  const x1 = x * Math.cos(az) - y * Math.sin(az);
  const y1 = x * Math.sin(az) + y * Math.cos(az);
  const x2 = x1;
  const y2 = y1 * Math.cos(el) - z * Math.sin(el);
  const z2 = y1 * Math.sin(el) + z * Math.cos(el);
  return [x2, y2, z2];
}

const CX = 350, CY = 230, PERSP = 6.5;
const XMIN = -3, XMAX = 3, YMIN = -3, YMAX = 3;
// Fixed outcome range from -5 to 5.
// Changing the intercept translates the surface without rescaling any axis.
const ZMIN = -5, ZMAX = 5;

// Observations are generated once from the initial model, not the live sliders.
// Their X, Y, and Z values remain fixed as the regression surface changes.
const PTS_XY: [number, number][] = [[-2.7,-2.4],[-2.3,-.5],[-2.0,1.7],[-1.3,2.5],[-.8,-1.6],[-.4,.6],[0,2.5],[.4,-2.4],[.8,-.7],[1.1,1.1],[1.55,2.3],[2,-1.8],[2.35,.15],[2.65,1.7]];
const RES = [.55,-.34,.28,-.42,.18,-.62,.45,.37,-.2,.16,-.4,.34,-.3,.46];
const DATA_POINTS = PTS_XY.map(([x, y], i) => ({
  x,
  y,
  z: 2.5 + 1.0 * x - 0.5 * y + 0.8 * x * y + RES[i],
}));

function toScreen([x, y, z]: Vec3, scale: number): ScreenPoint {
  const s = PERSP / (PERSP + y);
  return { x: CX + x * scale * s, y: CY - z * scale * s, s };
}
function project(wx: number, wy: number, wz: number, az: number, el: number, scale: number): ScreenPoint {
  return toScreen(rotatePoint(wx, wy, wz, az, el), scale);
}

const fmt = (n: number, d = 2) => Number(n).toFixed(d);

// Keep the component identity stable so dragging never remounts the input.
const Slider = React.memo(function Slider({
  label, value, setValue, min = -2, max = 2, step = 0.01, color
}: SliderProps) {
  const updateValue = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.valueAsNumber);
  }, [setValue]);

  return (
    <label style={{ display:"block", marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:2 }}>
        <b style={{ color }}>{label}</b>
        <span style={{ fontVariantNumeric:"tabular-nums", color:"#344a60" }}>{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={updateValue}
        style={{ accentColor:color, width:"100%", cursor:"pointer" }}
      />
    </label>
  );
});

export default function App() {
  const [b0,  setB0]  = useState(2.5);
  const [bx,  setBx]  = useState(1.0);
  const [by,  setBy]  = useState(-0.5);
  const [bxy, setBxy] = useState(0.8);
  const [xAt, setXAt] = useState(1.0);
  const [yAt, setYAt] = useState(0.5);
  const [showPoints, setShowPoints] = useState(true);
  const [az,    setAz]    = useState(-38);
  const [el,    setEl]    = useState(22);
  const [scale, setScale] = useState(68);

  const dragActive = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });

  const onSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    dragActive.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragActive.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setAz(a => a + dx * 0.5);
      setEl(v => Math.max(-80, Math.min(80, v + dy * 0.4)));
    };
    const onUp = () => { dragActive.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      dragActive.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragActive.current || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setAz(a => a + dx * 0.5);
    setEl(v => Math.max(-80, Math.min(80, v + dy * 0.4)));
  }, []);
  const onTouchEnd = useCallback(() => { dragActive.current = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setScale(s => Math.max(30, Math.min(160, s - e.deltaY * 0.08)));
  }, []);

  const pr   = useCallback((wx: number, wy: number, wz: number) => project(wx, wy, wz, az, el, scale), [az, el, scale]);
  const zVal = useCallback((x: number, y: number) => b0 + bx * x + by * y + bxy * x * y, [b0, bx, by, bxy]);

  const zMin = ZMIN;
  const zMax = ZMAX;
  const toWorldZ = useCallback((z: number) => ((z - ZMIN) / (ZMAX - ZMIN)) * 6 - 3, []);

  // ── box geometry ──────────────────────────────────────────────────────────
  const boxVerts: Vec3[] = [
    [XMIN,YMIN,-3],[XMAX,YMIN,-3],[XMAX,YMAX,-3],[XMIN,YMAX,-3],
    [XMIN,YMIN, 3],[XMAX,YMIN, 3],[XMAX,YMAX, 3],[XMIN,YMAX, 3],
  ];
  const boxEdgePairs: [number, number][] = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

  const boxEdges = useMemo(() => boxEdgePairs.map(([a, b]) => ({
    a: pr(...boxVerts[a]), b: pr(...boxVerts[b]),
    avgY: (rotatePoint(...boxVerts[a], az, el)[1] + rotatePoint(...boxVerts[b], az, el)[1]) / 2,
  })), [pr, az, el]);

  const faceNormals = useMemo(() => [
    { normal:[0,0,-1] as Vec3, axis:'z' as Axis, val:-3 },
    { normal:[0,0, 1] as Vec3, axis:'z' as Axis, val: 3 },
    { normal:[0,-1,0] as Vec3, axis:'y' as Axis, val:YMIN },
    { normal:[0, 1,0] as Vec3, axis:'y' as Axis, val:YMAX },
    { normal:[-1,0,0] as Vec3, axis:'x' as Axis, val:XMIN },
    { normal:[ 1,0,0] as Vec3, axis:'x' as Axis, val:XMAX },
  ].map(f => {
    const [, ry] = rotatePoint(...f.normal, az, el);
    return { ...f, visible: ry < 0 };
  }), [az, el]);

  const backFaces = useMemo(() => faceNormals.filter(f => !f.visible), [faceNormals]);

  const gridLines = useMemo(() => {
    const lines: GridLine[] = [], zStep = (zMax - zMin) / 4;
    backFaces.forEach(({ axis, val }) => {
      if (axis === 'z') {
        for (let v = XMIN+1; v < XMAX; v++) lines.push([pr(v,YMIN,val), pr(v,YMAX,val)]);
        for (let v = YMIN+1; v < YMAX; v++) lines.push([pr(XMIN,v,val), pr(XMAX,v,val)]);
      } else if (axis === 'y') {
        for (let v = XMIN+1; v < XMAX; v++) lines.push([pr(v,val,-3), pr(v,val,3)]);
        for (let i = 0; i <= 4; i++) { const wz = toWorldZ(zMin+i*zStep); lines.push([pr(XMIN,val,wz), pr(XMAX,val,wz)]); }
      } else {
        for (let v = YMIN+1; v < YMAX; v++) lines.push([pr(val,v,-3), pr(val,v,3)]);
        for (let i = 0; i <= 4; i++) { const wz = toWorldZ(zMin+i*zStep); lines.push([pr(val,YMIN,wz), pr(val,YMAX,wz)]); }
      }
    });
    return lines;
  }, [backFaces, pr, zMin, zMax, toWorldZ]);

  const surface = useMemo(() => {
    const steps = 18, cells = [];
    for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
      const x1=XMIN+i*6/steps, x2=XMIN+(i+1)*6/steps;
      const y1=YMIN+j*6/steps, y2=YMIN+(j+1)*6/steps;
      const corners = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
      const avgZ = corners.reduce((s,[cx,cy])=>s+zVal(cx,cy),0)/4;
      const pts  = corners.map(([cx,cy])=>pr(cx,cy,toWorldZ(zVal(cx,cy))));
      cells.push({ pts: pts.map(p=>`${p.x},${p.y}`).join(" "), avgDepth: pts.reduce((s,p)=>s+p.s,0)/4, avgZ });
    }
    cells.sort((a,b)=>a.avgDepth-b.avgDepth);
    return cells;
  }, [pr, zVal, toWorldZ]);

  const surfaceColor = useCallback((z: number) => {
    const t = Math.max(0, Math.min(1, (z-zMin)/Math.max(zMax-zMin,0.1)));
    return `rgb(${Math.round(50+t*120)},${Math.round(100+t*80)},${Math.round(210-t*80)})`;
  }, [zMin, zMax]);

  // Observed point positions depend only on the camera, never on coefficients.
  const observedPoints = useMemo(() => DATA_POINTS.map(({ x, y, z }) =>
    pr(x, y, toWorldZ(z))
  ), [pr, toWorldZ]);

  // Only the predicted endpoints of residual lines follow the surface.
  const points = useMemo(() => DATA_POINTS.map(({ x, y }, i) => ({
    sc: observedPoints[i],
    surf: pr(x, y, toWorldZ(zVal(x, y))),
  })), [observedPoints, pr, zVal, toWorldZ]);

  const slopeX  = bx + bxy * yAt;
  const slopeY  = by + bxy * xAt;
  const zAt     = zVal(xAt, yAt);
  const xSlopeA = pr(XMIN, yAt, toWorldZ(zVal(XMIN,yAt)));
  const xSlopeB = pr(XMAX, yAt, toWorldZ(zVal(XMAX,yAt)));
  const ySlopeA = pr(xAt, YMIN, toWorldZ(zVal(xAt,YMIN)));
  const ySlopeB = pr(xAt, YMAX, toWorldZ(zVal(xAt,YMAX)));
  const selPt   = pr(xAt, yAt, toWorldZ(zAt));

  // ── Fixed axis tick marks on the box edges ────────────────────────────────
  // Tick values and outcome scaling are independent of the coefficients.
  // Projected positions change only when rotating or zooming the view.
  const fixedAxisLabels = useMemo(() => {
    const labels = [];
    const zStep  = (zMax - zMin) / 4;

    // X axis: bottom edge from (XMIN,YMIN,-3) to (XMAX,YMIN,-3)
    const xA = pr(XMIN, YMIN, -3), xB = pr(XMAX, YMIN, -3);
    for (let v = -2; v <= 2; v++) {
      const t = (v - XMIN) / (XMAX - XMIN);
      const sx = xA.x + t * (xB.x - xA.x);
      const sy = xA.y + t * (xB.y - xA.y);
      labels.push({ x: sx, y: sy + 16, text: String(v), anchor: "middle" as TextAnchor });
    }

    // Y axis: bottom edge from (XMIN,YMIN,-3) to (XMIN,YMAX,-3)
    const yA = pr(XMIN, YMIN, -3), yB = pr(XMIN, YMAX, -3);
    for (let v = -2; v <= 2; v++) {
      const t = (v - YMIN) / (YMAX - YMIN);
      const sx = yA.x + t * (yB.x - yA.x);
      const sy = yA.y + t * (yB.y - yA.y);
      labels.push({ x: sx - 14, y: sy + 4, text: String(v), anchor: "middle" as TextAnchor });
    }

    // Z axis: vertical edge from (XMIN,YMIN,-3) to (XMIN,YMIN,3)
    const zA = pr(XMIN, YMIN, -3), zB = pr(XMIN, YMIN, 3);
    for (let i = 0; i <= 4; i++) {
      const dz = zMin + i * zStep;
      const t  = i / 4;
      const sx = zA.x + t * (zB.x - zA.x);
      const sy = zA.y + t * (zB.y - zA.y);
      labels.push({ x: sx - 18, y: sy + 4, text: dz.toFixed(1), anchor: "end" as TextAnchor });
    }

    return labels;
  }, [pr, zMin, zMax]);

  // Axis names are centered along their projected box edges.
  // Small offsets keep them separate from tick labels as the view rotates.
  const AXIS_NAMES = useMemo(() => {
    const origin = pr(XMIN, YMIN, -3);
    return [
      { end: pr(XMAX, YMIN, -3), text: "X", offsetX: 0, offsetY: 34 },
      { end: pr(XMIN, YMAX, -3), text: "Y", offsetX: -34, offsetY: 4 },
      { end: pr(XMIN, YMIN, 3), text: "Z (outcome)", offsetX: -86, offsetY: 0 },
    ].map(({ end, text, offsetX, offsetY }) => ({
      x: (origin.x + end.x) / 2 + offsetX,
      y: (origin.y + end.y) / 2 + offsetY,
      text,
      anchor: "middle" as TextAnchor,
    }));
  }, [pr]);

  const tX=Math.abs(bx)+.55, tY=Math.abs(by)+.45, tI=Math.abs(bxy)+.25;
  const stdX=bx/tX, stdY=by/tY, stdI=bxy/tI;

  return (
    <div style={{ fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif", color:"#16263a", background:"#f4f7fb", borderRadius:16, padding:20, maxWidth:1160, margin:"auto", boxSizing:"border-box" }}>
      <h1 style={{ fontSize:19, fontWeight:750, marginBottom:3 }}>Interaction in multiple regression</h1>
      <p style={{ color:"#52657a", fontSize:13, lineHeight:1.5, marginBottom:14 }}>
        <b>Drag the plot</b> to rotate · <b>Scroll</b> to zoom · Use the sliders to reshape the surface. Data points stay fixed.
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14, marginBottom:14 }}>

        {/* ── Plot ── */}
        <div style={{ background:"white", borderRadius:12, border:"1px solid #dce5ef", padding:"10px 10px 4px", boxShadow:"0 2px 8px #1c385012" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, fontSize:12, color:"#43586e", marginBottom:4, paddingLeft:2 }}>
            {[["#3264d0","Surface (high)"],["#7ab0f0","Surface (low)"],["#ff825e","Data points"],["#e05c2a","X-slope"],["#0aada8","Y-slope"]].map(([c,l])=>(
              <span key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ width:13, height:13, borderRadius:3, background:c, display:"inline-block" }}/>
                {l}
              </span>
            ))}
          </div>

          <svg viewBox="0 0 700 460"
            style={{ width:"100%", height:"auto", display:"block", cursor:"grab", userSelect:"none", touchAction:"none" }}
            onMouseDown={onSvgMouseDown}
            onWheel={onWheel}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

            {/* ── rotating content ── */}
            {gridLines.map((l,i)=>(
              <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
                stroke="#c8d8e8" strokeWidth="0.8" opacity="0.9"/>
            ))}
            {boxEdges.filter(e=>e.avgY>0).map((e,i)=>(
              <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                stroke="#8aa4c0" strokeWidth="1" strokeDasharray="4 3"/>
            ))}
            {surface.map((cell,i)=>(
              <polygon key={i} points={cell.pts}
                fill={surfaceColor(cell.avgZ)} fillOpacity="0.82"
                stroke="rgba(40,80,180,0.18)" strokeWidth="0.3"/>
            ))}
            {showPoints && points.map((p,i)=>(
              <line key={i} x1={p.sc.x} y1={p.sc.y} x2={p.surf.x} y2={p.surf.y}
                stroke="#ff5533" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.7"/>
            ))}
            <line x1={xSlopeA.x} y1={xSlopeA.y} x2={xSlopeB.x} y2={xSlopeB.y}
              stroke="#e05c2a" strokeWidth="4" strokeLinecap="round"/>
            <line x1={ySlopeA.x} y1={ySlopeA.y} x2={ySlopeB.x} y2={ySlopeB.y}
              stroke="#0aada8" strokeWidth="4" strokeLinecap="round"/>
            {showPoints && points.map((p,i)=>(
              <circle key={i} cx={p.sc.x} cy={p.sc.y} r="5"
                fill="#ff825e" stroke="white" strokeWidth="1.5"/>
            ))}
            {showPoints && points.map((p,i)=>(
              <circle key={i} cx={p.surf.x} cy={p.surf.y} r="3"
                fill="white" stroke="#cc3311" strokeWidth="1.2" opacity="0.8"/>
            ))}
            <circle cx={selPt.x} cy={selPt.y} r="7"
              fill="white" stroke="#203c58" strokeWidth="2.5"/>
            {boxEdges.filter(e=>e.avgY<=0).map((e,i)=>(
              <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                stroke="#4a6a8a" strokeWidth="1.8"/>
            ))}

            {/* ── tick labels: follow box edge positions but stay upright ── */}
            {fixedAxisLabels.map((l,i)=>(
              <text key={i} x={l.x} y={l.y} fontSize="10" fill="#5a7090" textAnchor={l.anchor}>{l.text}</text>
            ))}

            {/* slope value labels — follow surface, always readable */}
            <text x={xSlopeB.x+7} y={xSlopeB.y-5} fontSize="11" fill="#e05c2a" fontWeight="700">
              X-slope = {fmt(slopeX)}
            </text>
            <text x={ySlopeB.x+7} y={ySlopeB.y-5} fontSize="11" fill="#0aada8" fontWeight="700">
              Y-slope = {fmt(slopeY)}
            </text>

            {/* ── axis names: centered along the axes, always upright ── */}
            {AXIS_NAMES.map(({ x, y, text, anchor }) => (
              <text key={text} x={x} y={y} fontSize="13" fontWeight="700"
                fill="#21374d" textAnchor={anchor} dominantBaseline="middle"
                stroke="white" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
                {text}
              </text>
            ))}
          </svg>
          <p style={{ textAlign:"center", fontSize:11.5, color:"#9fb0c0", marginTop:0, marginBottom:4 }}>
            🖱 Drag plot to rotate · Scroll to zoom · Data points and Z-axis range are fixed
          </p>
        </div>

        {/* ── Controls ── */}
        <div style={{ display:"grid", gap:12, alignContent:"start" }}>
          <div style={{ background:"white", borderRadius:12, border:"1px solid #dce5ef", padding:15, boxShadow:"0 1px 4px #1c38500d" }}>
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.07em", color:"#8090a0", fontWeight:700, marginBottom:10 }}>Coefficients</div>
            <Slider label="Intercept b₀"     value={b0}  setValue={setB0}  min={0} max={6} color="#1769aa"/>
            <Slider label="X main effect bₓ" value={bx}  setValue={setBx}  color="#d95835"/>
            <Slider label="Y main effect bᵧ" value={by}  setValue={setBy}  color="#00837f"/>
            <Slider label="Interaction bₓᵧ"  value={bxy} setValue={setBxy} color="#7446b8"/>
            <label style={{ fontSize:12.5, display:"flex", alignItems:"center", gap:7, marginTop:4, color:"#445566" }}>
              <input type="checkbox" checked={showPoints} onChange={e=>setShowPoints(e.target.checked)} style={{ width:"auto" }}/>
              Show data points
            </label>
          </div>

          <div style={{ background:"white", borderRadius:12, border:"1px solid #dce5ef", padding:15, boxShadow:"0 1px 4px #1c38500d" }}>
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.07em", color:"#8090a0", fontWeight:700, marginBottom:10 }}>Inspect a location</div>
            <Slider label="X position" value={xAt} setValue={setXAt} min={-2.5} max={2.5} color="#e05c2a"/>
            <Slider label="Y position" value={yAt} setValue={setYAt} min={-2.5} max={2.5} color="#0aada8"/>
            <div style={{ background:"#f8f4ff", border:"1px solid #d8caee", borderRadius:8, padding:"10px 12px", fontSize:12, lineHeight:1.8, marginTop:4 }}>
              <b>Ẑ = {fmt(zAt)}</b> at (X={fmt(xAt)}, Y={fmt(yAt)})<br/>
              <span style={{ color:"#e05c2a", fontWeight:700 }}>X-slope</span> = {fmt(bx)} + {fmt(bxy)}·{fmt(yAt)} = <b>{fmt(slopeX)}</b><br/>
              <span style={{ color:"#0aada8", fontWeight:700 }}>Y-slope</span> = {fmt(by)} + {fmt(bxy)}·{fmt(xAt)} = <b>{fmt(slopeY)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1.1fr 0.9fr", gap:14 }}>
        <div style={{ background:"white", borderRadius:12, border:"1px solid #dce5ef", padding:16, boxShadow:"0 1px 4px #1c38500d" }}>
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.07em", color:"#8090a0", fontWeight:700, marginBottom:10 }}>Regression equation</div>
          <div style={{ background:"#f2f7fc", borderLeft:"4px solid #4a7fc1", borderRadius:6, padding:"12px 14px", fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace", fontSize:15, lineHeight:2 }}>
            Ẑ = <span style={{ color:"#1769aa", fontWeight:800 }}>{fmt(b0)}</span>
            {" + "}<span style={{ color:"#d95835", fontWeight:800 }}>({fmt(bx)})</span>·X
            {" + "}<span style={{ color:"#00837f", fontWeight:800 }}>({fmt(by)})</span>·Y
            {" + "}<span style={{ color:"#7446b8", fontWeight:800 }}>({fmt(bxy)})</span>·X·Y
          </div>
          <div style={{ fontSize:12.5, color:"#5b6d7e", lineHeight:1.65, marginTop:10 }}>
            The <span style={{ color:"#7446b8", fontWeight:700 }}>interaction coefficient</span> makes each slope conditional on the other predictor:<br/>
            <span style={{ color:"#d95835", fontWeight:600 }}>Slope of X</span> = <span style={{ color:"#d95835" }}>{fmt(bx)}</span> + <span style={{ color:"#7446b8" }}>{fmt(bxy)}</span>·Y = <b>{fmt(slopeX)}</b> when Y = {fmt(yAt)}<br/>
            <span style={{ color:"#0aada8", fontWeight:600 }}>Slope of Y</span> = <span style={{ color:"#00837f" }}>{fmt(by)}</span> + <span style={{ color:"#7446b8" }}>{fmt(bxy)}</span>·X = <b>{fmt(slopeY)}</b> when X = {fmt(xAt)}<br/>
            When <span style={{ color:"#7446b8", fontWeight:700 }}>bₓᵧ = 0</span> the surface is flat. Increasing it twists it into a saddle shape.
          </div>
        </div>

        <div style={{ background:"white", borderRadius:12, border:"1px solid #dce5ef", padding:16, boxShadow:"0 1px 4px #1c38500d" }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:8 }}>Coefficients<sup style={{ fontSize:10 }}>a</sup></div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>{["Predictor","B","SE","β","t","p"].map(h=>(
                <th key={h} style={{ background:"#e8f0f8", color:"#304b65", fontWeight:700, padding:"6px 5px", textAlign:h==="Predictor"?"left":"right", borderBottom:"2px solid #c0d0e0" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                { label:"(Constant)", B:b0,  se:0.21, beta:null, color:"#16263a", bg:"white"   },
                { label:"X",          B:bx,  se:0.12, beta:stdX, color:"#d95835", bg:"white"   },
                { label:"Y",          B:by,  se:0.12, beta:stdY, color:"#00837f", bg:"white"   },
                { label:"X × Y",      B:bxy, se:0.10, beta:stdI, color:"#7446b8", bg:"#f7f2fd" },
              ].map(({ label, B, se, beta, color, bg })=>(
                <tr key={label} style={{ background:bg }}>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", color, fontWeight:bg!=="white"?700:400 }}>{label}</td>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", textAlign:"right", color, fontWeight:700 }}>{fmt(B)}</td>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", textAlign:"right" }}>{se.toFixed(2)}</td>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", textAlign:"right" }}>{beta!=null?fmt(beta):""}</td>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", textAlign:"right" }}>{fmt(B/se)}</td>
                  <td style={{ padding:"6px 5px", borderBottom:"1px solid #dde6ef", textAlign:"right" }}>{Math.abs(B/se)>1.96?"< .05":".ns"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize:11.5, color:"#7a8a9a", marginTop:8, lineHeight:1.4 }}>a. Dependent variable: Z. B values update live. SE and p are illustrative.</p>
        </div>
      </div>
    </div>
  );
}
