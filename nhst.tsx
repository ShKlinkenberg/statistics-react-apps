import { useState, type CSSProperties } from "react";

type Concept = "alpha" | "beta" | "power" | "specificity";

const W = 700, H = 340;
const PAD = { top: 40, right: 20, bottom: 50, left: 50 };
const PW = W - PAD.left - PAD.right, PH = H - PAD.top - PAD.bottom;
const MIN = -5, MAX = 9;
const xs = Array.from({ length: 500 }, (_, i) => MIN + i * (MAX - MIN) / 499);

function pdf(x: number, mu: number, sd: number) { return Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); }
function cdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const v = 1 - Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * p;
  return x >= 0 ? v : 1 - v;
}
function invNorm(p: number) {
  const a=[0,-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239], b=[0,-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572], c=[0,-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783], d=[0,.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416];
  let q,r; if(p<.02425){q=Math.sqrt(-2*Math.log(p));return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)} if(p>.97575){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)} q=p-.5;r=q*q;return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q/(((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
}
function sx(x: number) { return PAD.left + (x - MIN) / (MAX - MIN) * PW; }
function sy(y: number, max: number) { return PAD.top + PH - y / max * PH; }
function region(mu: number, lo: number, hi: number, se: number, ym: number) {
  const p = xs.filter(x => x >= lo && x <= hi); if (p.length < 2) return "";
  return `${sx(p[0])},${sy(0,ym)} ${p.map(x => `${sx(x)},${sy(pdf(x,mu,se),ym)}`).join(" ")} ${sx(p[p.length-1])},${sy(0,ym)}`;
}
function curve(mu: number, se: number, ym: number) { return xs.map(x => `${sx(x)},${sy(pdf(x,mu,se),ym)}`).join(" "); }

const meta: Record<Concept, { color: string; bg: string; text: string }> = {alpha:{color:"#dc2626",bg:"#fee2e2",text:"#991b1b"},beta:{color:"#d97706",bg:"#fef3c7",text:"#92400e"},power:{color:"#16a34a",bg:"#dcfce7",text:"#15803d"},specificity:{color:"#2563eb",bg:"#dbeafe",text:"#1d4ed8"}};
const border: CSSProperties = {border:"1px solid #d1d5db",padding:"10px 14px",textAlign:"center",lineHeight:1.6};

export default function NHSTExplainer(){
  const [d,setD]=useState(.5),[n,setN]=useState(30),[alpha,setAlpha]=useState(.05),[two,setTwo]=useState(false),[hover,setHover]=useState<Concept | null>(null);
  const se=1/Math.sqrt(n), crit=invNorm(two?1-alpha/2:1-alpha)*se, left=-crit;
  const power=two ? 1-cdf((crit-d)/se)+cdf((left-d)/se) : 1-cdf((crit-d)/se);
  const beta=1-power, ym=pdf(0,0,se)*1.3, f=(x: number)=>x.toFixed(3);
  const op=(k: Concept)=>!hover?.45:hover===k?.85:.10;
  const curveOp=(k: "null" | "alt")=>!hover?1:((k==="null")===["alpha","specificity"].includes(hover)?1:.28);
  const arrowY=PAD.top+22;
  const Cell=({k,title,sub,value,error = false}: { k: Concept; title: string; sub: string; value: string; error?: boolean })=><td onMouseEnter={()=>setHover(k)} onMouseLeave={()=>setHover(null)} style={{...border,background:hover===k?(error?"#fca5a5":"#86efac"):(error?"#fee2e2":"#dcfce7"),color:error?"#991b1b":"#166534",cursor:"pointer",outline:hover===k?`3px solid ${meta[k].color}`:"3px solid transparent",transition:".2s"}}><b>{title}</b><br/><span style={{fontSize:12}}>{sub}</span><br/><span style={{fontSize:12}}>P = <b>{value}</b></span></td>;
  const Badge=({k,label,value}: { k: Concept; label: string; value: string })=><div onMouseEnter={()=>setHover(k)} onMouseLeave={()=>setHover(null)} style={{background:meta[k].bg,color:meta[k].text,padding:"6px 12px",borderRadius:6,fontWeight:600,cursor:"pointer",outline:hover===k?`2px solid ${meta[k].color}`:"2px solid transparent",transform:hover===k?"scale(1.04)":"scale(1)",transition:".15s"}}>{label}: {value}</div>;
  return <div style={{fontFamily:"system-ui,sans-serif",maxWidth:760,margin:"auto",padding:16}}>
    <h2 style={{fontSize:18,margin:"0 0 4px"}}>Null Hypothesis Significance Testing</h2>
    <p style={{fontSize:13,color:"#555",margin:"0 0 12px"}}><b style={{color:"#2563eb"}}>Blue</b> = null distribution (H₀). <b style={{color:"#dc2626"}}>Red</b> = true sampling distribution (H₁). Hover over a region label, badge, or decision-table cell to link the concepts.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:20,marginBottom:16,fontSize:13}}>
      <label>Effect size (Cohen's d): <b>{d.toFixed(2)}</b><br/><input type="range" min="0" max="2" step=".05" value={d} onChange={e=>setD(+e.target.value)}/></label>
      <label>Sample size (n): <b>{n}</b><br/><input type="range" min="5" max="200" value={n} onChange={e=>setN(+e.target.value)}/></label>
      <label>Alpha (α): <b>{alpha.toFixed(3)}</b><br/><input type="range" min=".001" max=".2" step=".001" value={alpha} onChange={e=>setAlpha(+e.target.value)}/></label>
      <label style={{alignSelf:"end"}}><input type="checkbox" checked={two} onChange={e=>setTwo(e.target.checked)}/> Two-tailed test</label>
    </div>
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{border:"1px solid #e5e7eb",borderRadius:8,background:"#fafafa"}}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#7c3aed"/></marker>
      </defs>
      <polygon points={region(0,two?left:MIN,crit,se,ym)} fill="#bfdbfe" fillOpacity={op("specificity")}/>
      <polygon points={region(0,crit,MAX,se,ym)} fill="#f87171" fillOpacity={op("alpha")}/>
      {two && (
        <polygon points={region(0,MIN,left,se,ym)} fill="#f87171" fillOpacity={op("alpha")}/>
      )}
      <polygon points={region(d,two?left:MIN,crit,se,ym)} fill="#fbbf24" fillOpacity={op("beta")}/>
      <polygon points={region(d,crit,MAX,se,ym)} fill="#4ade80" fillOpacity={op("power")}/>
      {two && (
        <polygon points={region(d,MIN,left,se,ym)} fill="#4ade80" fillOpacity={op("power")}/>
      )}
      <line x1={PAD.left} y1={PAD.top+PH} x2={PAD.left+PW} y2={PAD.top+PH} stroke="#374151"/><line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+PH} stroke="#374151"/>
      {[-4,-3,-2,-1,0,1,2,3,4,5,6,7,8].map(t=><g key={t}><line x1={sx(t)} y1={PAD.top+PH} x2={sx(t)} y2={PAD.top+PH+5} stroke="#374151"/><text x={sx(t)} y={PAD.top+PH+16} textAnchor="middle" fontSize="10">{t}</text></g>)}
      <polyline points={curve(0,se,ym)} fill="none" stroke="#2563eb" strokeWidth="2.5" opacity={curveOp("null")}/><polyline points={curve(d,se,ym)} fill="none" stroke="#dc2626" strokeWidth="2.5" opacity={curveOp("alt")}/>
      <text x={sx(0)} y={PAD.top-6} textAnchor="middle" fontSize="11" fill="#2563eb" fontWeight="bold">H₀</text><text x={sx(d)} y={PAD.top-6} textAnchor="middle" fontSize="11" fill="#dc2626" fontWeight="bold">H₁</text>
      <line x1={sx(crit)} y1={PAD.top} x2={sx(crit)} y2={PAD.top+PH} stroke="#7c3aed" strokeDasharray="5,3"/><line x1={sx(crit)} y1={arrowY} x2={sx(crit)+38} y2={arrowY} stroke="#7c3aed" markerEnd="url(#arrow)"/><text x={sx(crit)+42} y={arrowY+4} fill="#7c3aed" fontSize="10" fontWeight="bold">Reject H₀</text>
      {two&&<><line x1={sx(left)} y1={PAD.top} x2={sx(left)} y2={PAD.top+PH} stroke="#7c3aed" strokeDasharray="5,3"/><line x1={sx(left)} y1={arrowY} x2={sx(left)-38} y2={arrowY} stroke="#7c3aed" markerEnd="url(#arrow)"/><text x={sx(left)-42} y={arrowY+4} textAnchor="end" fill="#7c3aed" fontSize="10" fontWeight="bold">Reject H₀</text></>}
      <text x={sx(crit)} y={PAD.top+PH+30} textAnchor="middle" fontSize="9" fill="#7c3aed">crit={f(crit)}</text>{two&&<text x={sx(left)} y={PAD.top+PH+30} textAnchor="middle" fontSize="9" fill="#7c3aed">crit={f(left)}</text>}
      <text x={sx(crit+(MAX-crit)/2)} y={PAD.top+PH-8} textAnchor="middle" fontSize="11" fill="#b91c1c" fontWeight="bold" opacity={hover&&!(["alpha"].includes(hover))?.2:1}>α={f(two?alpha/2:alpha)}</text>
      {two&&<text x={sx((MIN+left)/2)} y={PAD.top+PH-8} textAnchor="middle" fontSize="11" fill="#b91c1c" fontWeight="bold">α/2</text>}
      <text x={sx(two?(left+crit)/2:(MIN+crit)/2)} y={PAD.top+PH-8} textAnchor="middle" fontSize="11" fill="#1d4ed8" fontWeight="bold">1−α={f(1-alpha)}</text><text x={sx(Math.min(d,crit-se*.5))} y={PAD.top+PH-25} textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="bold">β={f(beta)}</text><text x={sx(crit+(MAX-crit)/2)} y={PAD.top+44} textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="bold">Power={f(power)}</text>
      <text x={PAD.left+PW/2} y={H-4} textAnchor="middle" fontSize="11">Sample mean (in SE units from H₀)</text>
    </svg>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:10,fontSize:13}}><Badge k="alpha" label="α (Type I error)" value={f(alpha)}/><Badge k="beta" label="β (Type II error)" value={f(beta)}/><Badge k="power" label="Power (1 − β)" value={f(power)}/><Badge k="specificity" label="1 − α" value={f(1-alpha)}/><div style={{padding:"6px 12px",background:"#f3f4f6",borderRadius:6,fontWeight:600}}>SE: {se.toFixed(4)}</div></div>
    <h3 style={{fontSize:15,marginBottom:8}}>Decision Table</h3><table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}><thead><tr><th style={border}>Decision \ Reality</th><th style={border}>H₀ is TRUE</th><th style={border}>H₀ is FALSE (H₁ true)</th></tr></thead><tbody><tr><td style={{...border,fontWeight:700}}>Reject H₀</td><Cell k="alpha" title="False Positive" sub="Type I Error" value={`α = ${f(alpha)}`} error/><Cell k="power" title="True Positive" sub="Correct Rejection" value={`Power = ${f(power)}`}/></tr><tr><td style={{...border,fontWeight:700}}>Do not reject H₀</td><Cell k="specificity" title="True Negative" sub="Correct Retention" value={`1−α = ${f(1-alpha)}`}/><Cell k="beta" title="False Negative" sub="Type II Error" value={`β = ${f(beta)}`} error/></tr></tbody></table>
    <p style={{fontSize:11,color:"#6b7280"}}>Curves are sampling distributions of the mean. The visualization assumes a population SD of 1, so SE = 1/√n.</p>
  </div>;
}
