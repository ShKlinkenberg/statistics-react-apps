import { useState, useMemo } from "react";

function normalPDF(x, mu, sigma) {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}
function invNorm(p) {
  const a = [0,-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239];
  const b = [0,-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
  const c = [0,-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d = [0,7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
  }
}

const W = 700, H = 340;
const PAD = { top: 40, right: 20, bottom: 50, left: 50 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const X_MIN = -5, X_MAX = 9;
const N_POINTS = 500;

function xToSvg(x) { return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W; }
function yToSvg(y, yMax) { return PAD.top + PLOT_H - (y / yMax) * PLOT_H; }

const xs = Array.from({ length: N_POINTS }, (_, i) => X_MIN + (i / (N_POINTS - 1)) * (X_MAX - X_MIN));

function fillRegion(mu, x1, x2, se, yMax) {
  const pts = xs.filter(x => x >= x1 && x <= x2);
  if (pts.length < 2) return "";
  const top = pts.map(x => `${xToSvg(x)},${yToSvg(normalPDF(x, mu, se), yMax)}`).join(" ");
  return `${xToSvg(pts[0])},${yToSvg(0, yMax)} ${top} ${xToSvg(pts[pts.length-1])},${yToSvg(0, yMax)}`;
}

function curvePoints(mu, se, yMax) {
  return xs.map(x => `${xToSvg(x)},${yToSvg(normalPDF(x, mu, se), yMax)}`).join(" ");
}

// concept keys
const CONCEPTS = ["alpha", "beta", "power", "one_minus_alpha"];

const conceptMeta = {
  alpha:           { label: "α",         color: "#dc2626", bg: "#fee2e2", textColor: "#991b1b" },
  beta:            { label: "β",         color: "#d97706", bg: "#fef3c7", textColor: "#92400e" },
  power:           { label: "Power",     color: "#16a34a", bg: "#dcfce7", textColor: "#15803d" },
  one_minus_alpha: { label: "1−α",       color: "#2563eb", bg: "#dbeafe", textColor: "#1d4ed8" },
};

export default function NHSTExplainer() {
  const [effectSize, setEffectSize] = useState(0.5);
  const [sampleSize, setSampleSize] = useState(30);
  const [alpha, setAlpha] = useState(0.05);
  const [twoTailed, setTwoTailed] = useState(false);
  const [hovered, setHovered] = useState(null);

  const se = useMemo(() => 1 / Math.sqrt(sampleSize), [sampleSize]);
  const muAlt = effectSize;

  const zCritRight = useMemo(() => invNorm(twoTailed ? 1 - alpha / 2 : 1 - alpha) * se, [alpha, se, twoTailed]);
  const zCritLeft  = useMemo(() => -zCritRight, [zCritRight]);

  const power = useMemo(() => {
    if (twoTailed) return 1 - normalCDF((zCritRight - muAlt) / se) + normalCDF((zCritLeft - muAlt) / se);
    return 1 - normalCDF((zCritRight - muAlt) / se);
  }, [zCritRight, zCritLeft, muAlt, se, twoTailed]);

  const beta = 1 - power;

  const yMax = useMemo(() => {
    return Math.max(normalPDF(0, 0, se), normalPDF(muAlt, muAlt, se)) * 1.3;
  }, [se, muAlt]);

  const fmt = v => v.toFixed(3);

  // opacity helper: if something is hovered, non-hovered regions fade; hovered region pops
  function regionOpacity(concept) {
    if (!hovered) return 0.45;
    return hovered === concept ? 0.85 : 0.12;
  }
  function curveOpacity(which) {
    // which: "null" or "alt"
    if (!hovered) return 1;
    const altConcepts = ["beta", "power"];
    const nullConcepts = ["alpha", "one_minus_alpha"];
    if (which === "null") return nullConcepts.includes(hovered) ? 1 : 0.3;
    if (which === "alt")  return altConcepts.includes(hovered)  ? 1 : 0.3;
    return 1;
  }

  const ticks = [-4,-3,-2,-1,0,1,2,3,4,5,6,7,8];

  // arrow tip x position (pointing outward = to the right of right crit, left of left crit)
  const arrowRightX = xToSvg(zCritRight) + 38;
  const arrowLeftX  = xToSvg(zCritLeft)  - 38;
  const arrowY      = PAD.top + 22;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 4, fontSize: 18 }}>Null Hypothesis Significance Testing</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555" }}>
        <b style={{ color: "#2563eb" }}>Blue</b> = null distribution (H₀).{" "}
        <b style={{ color: "#dc2626" }}>Red</b> = true sampling distribution (H₁).{" "}
        Hover over any concept badge or table cell to highlight it.
      </p>

      {/* controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16, fontSize: 13 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Effect size (Cohen's d): <b>{effectSize.toFixed(2)}</b></span>
          <input type="range" min={0} max={2} step={0.05} value={effectSize} onChange={e => setEffectSize(+e.target.value)} style={{ width: 160 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Sample size (n): <b>{sampleSize}</b></span>
          <input type="range" min={5} max={200} step={1} value={sampleSize} onChange={e => setSampleSize(+e.target.value)} style={{ width: 160 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Alpha (α): <b>{alpha.toFixed(3)}</b></span>
          <input type="range" min={0.001} max={0.2} step={0.001} value={alpha} onChange={e => setAlpha(+e.target.value)} style={{ width: 160 }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-end" }}>
          <input type="checkbox" checked={twoTailed} onChange={e => setTwoTailed(e.target.checked)} />
          Two-tailed test
        </label>
      </div>

      {/* SVG plot */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa" }}>

        <defs>
          <marker id="arrowR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
          </marker>
          <marker id="arrowL" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto">
            <path d="M8,0 L8,6 L0,3 z" fill="#7c3aed" />
          </marker>
        </defs>

        {/* 1-alpha region under H0 */}
        <polygon
          points={twoTailed ? fillRegion(0, zCritLeft, zCritRight, se, yMax) : fillRegion(0, X_MIN, zCritRight, se, yMax)}
          fill="#bfdbfe" fillOpacity={regionOpacity("one_minus_alpha")}
          style={{ transition: "fill-opacity 0.2s" }}
        />

        {/* alpha region(s) under H0 */}
        <polygon points={fillRegion(0, zCritRight, X_MAX, se, yMax)}
          fill="#f87171" fillOpacity={regionOpacity("alpha")} style={{ transition: "fill-opacity 0.2s" }} />
        {twoTailed && (
          <polygon points={fillRegion(0, X_MIN, zCritLeft, se, yMax)}
            fill="#f87171" fillOpacity={regionOpacity("alpha")} style={{ transition: "fill-opacity 0.2s" }} />
        )}

        {/* beta region under H1 */}
        <polygon
          points={fillRegion(muAlt, twoTailed ? zCritLeft : X_MIN, zCritRight, se, yMax)}
          fill="#fbbf24" fillOpacity={regionOpacity("beta")} style={{ transition: "fill-opacity 0.2s" }} />

        {/* power region under H1 */}
        <polygon points={fillRegion(muAlt, zCritRight, X_MAX, se, yMax)}
          fill="#4ade80" fillOpacity={regionOpacity("power")} style={{ transition: "fill-opacity 0.2s" }} />
        {twoTailed && (
          <polygon points={fillRegion(muAlt, X_MIN, zCritLeft, se, yMax)}
            fill="#4ade80" fillOpacity={regionOpacity("power")} style={{ transition: "fill-opacity 0.2s" }} />
        )}

        {/* axes */}
        <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="#374151" strokeWidth={1.5} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="#374151" strokeWidth={1.5} />

        {ticks.map(t => (
          <g key={t}>
            <line x1={xToSvg(t)} y1={PAD.top + PLOT_H} x2={xToSvg(t)} y2={PAD.top + PLOT_H + 5} stroke="#374151" strokeWidth={1} />
            <text x={xToSvg(t)} y={PAD.top + PLOT_H + 16} textAnchor="middle" fontSize={10} fill="#374151">{t}</text>
          </g>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#374151">
          Sample mean (in SE units from H₀)
        </text>

        {/* curves */}
        <polyline points={curvePoints(0, se, yMax)} fill="none" stroke="#2563eb" strokeWidth={2.5}
          opacity={curveOpacity("null")} style={{ transition: "opacity 0.2s" }} />
        <polyline points={curvePoints(muAlt, se, yMax)} fill="none" stroke="#dc2626" strokeWidth={2.5}
          opacity={curveOpacity("alt")} style={{ transition: "opacity 0.2s" }} />

        {/* curve labels */}
        <text x={xToSvg(0)} y={PAD.top - 6} textAnchor="middle" fontSize={11} fill="#2563eb" fontWeight="bold"
          opacity={curveOpacity("null")} style={{ transition: "opacity 0.2s" }}>H₀</text>
        <text x={xToSvg(muAlt)} y={PAD.top - 6} textAnchor="middle" fontSize={11} fill="#dc2626" fontWeight="bold"
          opacity={curveOpacity("alt")} style={{ transition: "opacity 0.2s" }}>H₁</text>

        {/* critical value line + arrow + label (right) */}
        <line x1={xToSvg(zCritRight)} y1={PAD.top} x2={xToSvg(zCritRight)} y2={PAD.top + PLOT_H}
          stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="5,3" />
        {/* arrow pointing right */}
        <line
          x1={xToSvg(zCritRight)} y1={arrowY}
          x2={arrowRightX - 2} y2={arrowY}
          stroke="#7c3aed" strokeWidth={1.5} markerEnd="url(#arrowR)" />
        <text x={arrowRightX + 4} y={arrowY + 4} fontSize={10} fill="#7c3aed" fontWeight="bold">Reject H₀</text>
        <text x={xToSvg(zCritRight)} y={PAD.top + PLOT_H + 30} textAnchor="middle" fontSize={9} fill="#7c3aed">
          crit={zCritRight.toFixed(3)}
        </text>

        {/* critical value line + arrow + label (left, two-tailed) */}
        {twoTailed && (
          <>
            <line x1={xToSvg(zCritLeft)} y1={PAD.top} x2={xToSvg(zCritLeft)} y2={PAD.top + PLOT_H}
              stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="5,3" />
            <line
              x1={xToSvg(zCritLeft)} y1={arrowY}
              x2={arrowLeftX + 2} y2={arrowY}
              stroke="#7c3aed" strokeWidth={1.5} markerEnd="url(#arrowL)" />
            <text x={arrowLeftX - 4} y={arrowY + 4} fontSize={10} fill="#7c3aed" fontWeight="bold" textAnchor="end">Reject H₀</text>
            <text x={xToSvg(zCritLeft)} y={PAD.top + PLOT_H + 30} textAnchor="middle" fontSize={9} fill="#7c3aed">
              crit={zCritLeft.toFixed(3)}
            </text>
          </>
        )}

        {/* region labels on plot */}
        <text x={xToSvg(zCritRight + (X_MAX - zCritRight) / 2)} y={PAD.top + PLOT_H - 8}
          textAnchor="middle" fontSize={11} fill="#b91c1c" fontWeight="bold"
          opacity={hovered && hovered !== "alpha" ? 0.2 : 1} style={{ transition: "opacity 0.2s" }}>
          α={fmt(twoTailed ? alpha / 2 : alpha)}
        </text>
        {twoTailed && (
          <text x={xToSvg(X_MIN + (zCritLeft - X_MIN) / 2)} y={PAD.top + PLOT_H - 8}
            textAnchor="middle" fontSize={11} fill="#b91c1c" fontWeight="bold"
            opacity={hovered && hovered !== "alpha" ? 0.2 : 1} style={{ transition: "opacity 0.2s" }}>
            α/2
          </text>
        )}
        <text
          x={twoTailed ? xToSvg((zCritLeft + zCritRight) / 2) : xToSvg((X_MIN + zCritRight) / 2)}
          y={PAD.top + PLOT_H - 8}
          textAnchor="middle" fontSize={11} fill="#1d4ed8" fontWeight="bold"
          opacity={hovered && hovered !== "one_minus_alpha" ? 0.2 : 1} style={{ transition: "opacity 0.2s" }}>
          1−α={fmt(1 - alpha)}
        </text>
        {beta > 0.02 && (
          <text x={xToSvg(Math.min(muAlt, zCritRight - se * 0.5))} y={PAD.top + PLOT_H - 24}
            textAnchor="middle" fontSize={11} fill="#b45309" fontWeight="bold"
            opacity={hovered && hovered !== "beta" ? 0.2 : 1} style={{ transition: "opacity 0.2s" }}>
            β={fmt(beta)}
          </text>
        )}
        {power > 0.02 && (
          <text x={xToSvg(zCritRight + (X_MAX - zCritRight) / 2)} y={PAD.top + 44}
            textAnchor="middle" fontSize={11} fill="#15803d" fontWeight="bold"
            opacity={hovered && hovered !== "power" ? 0.2 : 1} style={{ transition: "opacity 0.2s" }}>
            Power={fmt(power)}
          </text>
        )}
      </svg>

      {/* summary badges */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
        {[
          { key: "alpha",           label: "α (Type I error)",  value: fmt(alpha) },
          { key: "beta",            label: "β (Type II error)", value: fmt(beta) },
          { key: "power",           label: "Power (1 − β)",     value: fmt(power) },
          { key: "one_minus_alpha", label: "1 − α",             value: fmt(1 - alpha) },
          { key: null,              label: "SE",                 value: (1/Math.sqrt(sampleSize)).toFixed(4) },
        ].map((s, i) => {
          const meta = s.key ? conceptMeta[s.key] : null;
          const isHov = hovered === s.key;
          return (
            <div key={i}
              onMouseEnter={() => s.key && setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: meta ? meta.bg : "#f3f4f6",
                borderRadius: 6,
                padding: "6px 12px",
                color: meta ? meta.textColor : "#374151",
                fontWeight: 600,
                cursor: s.key ? "pointer" : "default",
                outline: isHov ? `2px solid ${meta?.color}` : "2px solid transparent",
                transition: "outline 0.15s, transform 0.15s",
                transform: isHov ? "scale(1.05)" : "scale(1)",
              }}>
              {s.label}: {s.value}
            </div>
          );
        })}
      </div>

      {/* 2x2 decision table */}
      <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 15 }}>Decision Table</h3>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
        <thead>
          <tr>
            <th style={th()}>Decision \ Reality</th>
            <th style={th()}>H₀ is TRUE</th>
            <th style={th()}>H₀ is FALSE (H₁ true)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...td(), fontWeight: 700, background: "#f9fafb" }}>Reject H₀</td>
            <Cell concept="alpha" hovered={hovered} setHovered={setHovered}
              title="False Positive" sub="Type I Error" prob={`α = ${fmt(alpha)}`}
              isError={true} />
            <Cell concept="power" hovered={hovered} setHovered={setHovered}
              title="True Positive" sub="Correct Rejection" prob={`Power = ${fmt(power)}`}
              isError={false} />
          </tr>
          <tr>
            <td style={{ ...td(), fontWeight: 700, background: "#f9fafb" }}>Do not reject H₀</td>
            <Cell concept="one_minus_alpha" hovered={hovered} setHovered={setHovered}
              title="True Negative" sub="Correct Retention" prob={`1−α = ${fmt(1 - alpha)}`}
              isError={false} />
            <Cell concept="beta" hovered={hovered} setHovered={setHovered}
              title="False Negative" sub="Type II Error" prob={`β = ${fmt(beta)}`}
              isError={true} />
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>
        Distributions shown as sampling distributions of the mean. Effect size is in population SD units (Cohen's d). SE = 1/√n.
      </p>
    </div>
  );
}

function Cell({ concept, hovered, setHovered, title, sub, prob, isError }) {
  const isHov = hovered === concept;
  const baseBg = isError ? "#fee2e2" : "#dcfce7";
  const baseColor = isError ? "#991b1b" : "#166534";
  const meta = conceptMeta[concept];
  return (
    <td
      onMouseEnter={() => setHovered(concept)}
      onMouseLeave={() => setHovered(null)}
      style={{
        ...td(),
        background: isHov ? (isError ? "#fca5a5" : "#86efac") : baseBg,
        color: baseColor,
        cursor: "pointer",
        outline: isHov ? `3px solid ${meta.color}` : "3px solid transparent",
        transition: "background 0.2s, outline 0.15s",
      }}>
      <b>{title}</b><br />
      <span style={{ fontSize: 12 }}>{sub}</span><br />
      <span style={{ fontSize: 12 }}>P = <b>{prob}</b></span>
    </td>
  );
}

function th() {
  return { border: "1px solid #d1d5db", padding: "8px 12px", background: "#f3f4f6", fontWeight: 700, textAlign: "center" };
}
function td() {
  return { border: "1px solid #d1d5db", padding: "10px 14px", textAlign: "center", lineHeight: 1.6 };
}


export default normalPDF