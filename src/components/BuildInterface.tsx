import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Save, Gauge, Weight, BadgeCheck, AlertTriangle, CircleHelp, List, LayoutGrid, ChevronRight, X, Check, Battery, Camera, Cpu, Radio, Fan, Zap, PanelsTopLeft, Settings2, ImageOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/SiteHeader";
import { categories, categoryNames, money, type BuildSelection, type Category, type Product } from "@/lib/build-data";
import { evaluate, candidateCheck } from "@/lib/build-calculations";
import { productCatalogue, resolveBuildSelection } from "@/lib/catalogue-service";
import { DroneViewer } from "@/components/DroneViewer";

const icons: Record<Category,LucideIcon> = {frame:PanelsTopLeft,motors:Settings2,flightController:Cpu,esc:Zap,propellers:Fan,battery:Battery,camera:Camera,receiver:Radio};
function ProductThumbnail({product}:{product:Product}) {
  const [failed,setFailed] = useState(false);
  const image = product.image;
  return <span className="flex h-[clamp(56px,8vw,76px)] w-[clamp(68px,10vw,92px)] shrink-0 items-center justify-center">
    {image && !failed
      ? <img
          src={image.src}
          alt={image.alt}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      : <ImageOff className="size-7 text-muted-foreground/60" aria-label="Verified product image unavailable" />}
  </span>;
}
type Props = { source:"Custom"|"AI Build"|"Template"; name:string; initial:BuildSelection };
export function BuildInterface({source,name,initial}:Props) {
  const [selection,setSelection] = useState<BuildSelection>(initial);
  const [editing,setEditing] = useState<Category|null>(null);
  const [filter,setFilter] = useState(false);
  const [grid,setGrid] = useState(false);
  const [saved,setSaved] = useState(false);
  const selectedProducts = resolveBuildSelection(selection);
  const stats = evaluate(selectedProducts);
  const save = () => { const data = {source,name,selection}; const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="dronecores-build.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); setSaved(true); };
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:px-7">
      <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4"/> Back</Link>
      <Link to="/" className="flex items-center gap-2 rounded-xl active:scale-95"><LogoMark/><span className="hidden font-display text-base font-bold tracking-tight text-foreground sm:inline sm:text-lg">DroneCores</span></Link>
      <div className="flex justify-end gap-1"><Button title="Save build as a file" aria-label="Save build as a file" variant="ghost" size="icon" className="size-11" onClick={save}><Save/></Button><Button onClick={save} className="h-11 px-3 sm:px-5">{saved?"Saved":"Save Build"}</Button></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-3 pb-14 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-2 py-4 sm:py-5"><div><div className="flex items-center gap-3"><h1 className="font-display text-2xl font-bold sm:text-3xl">{name}</h1><span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-primary">{source}</span></div><p className="mt-1 text-sm text-muted-foreground">Build your perfect drone. Choose every component and see your build come to life in 3D.</p></div>{stats.selected.frame && <span className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-primary">{stats.selected.frame.frameInches}″ build</span>}</div>
      <DroneViewer selection={selection}/>
      <section aria-label="Build statistics" className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card px-2 py-3 shadow-sm sm:grid-cols-5 sm:px-3 sm:py-4">
        <Stat icon={null} label="Build Score" value={stats.score===null?"—/100":`${stats.score}/100`} detail={stats.score===null?"Build incomplete":stats.score>=80?"Great match":"Good match"} score={stats.score}/>
        <Stat icon={Gauge} label="Top Speed (est.)" value={stats.speed===null?"—":`~ ${stats.speed} km/h`}/>
        <Stat icon={Weight} label="Weight (est.)" value={stats.weight===null?"—":`~ ${stats.weight} g`}/>
        <Stat icon={null} label="Total Price" value={money(stats.price)} />
        <div className="col-span-2 flex items-center gap-2 border-t border-border pt-3 text-xs font-medium sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">{stats.status==="verified-compatible"?<BadgeCheck className="size-6 shrink-0 text-emerald-600"/>:stats.status==="incompatible"?<AlertTriangle className="size-6 shrink-0 text-destructive"/>:<CircleHelp className="size-6 shrink-0 text-muted-foreground"/>}<span className={stats.status==="verified-compatible"?"text-emerald-600":stats.status==="incompatible"?"text-destructive":"text-muted-foreground"}>{stats.status==="verified-compatible"?"Verified compatible":stats.status==="incompatible"?"Compatibility needs attention":"Potentially compatible"}</span></div>
      </section>
      {(stats.warnings.length>0||stats.missing.length>0) && <div className={`mt-3 rounded-md border p-3 text-sm text-foreground ${stats.status==="incompatible"?"border-destructive/30 bg-destructive/5":"border-border bg-muted/30"}`}><strong>Check your build</strong><ul className="mt-1 list-inside list-disc text-muted-foreground">{[...stats.warnings,...stats.missing].map(w=><li key={w}>{w}</li>)}</ul></div>}
      <section className="mt-4 rounded-lg border border-border bg-card p-3 sm:p-4"><div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><div className="min-w-0"><h2 className="font-display text-xl font-bold">Components</h2><p className="text-xs text-muted-foreground sm:text-sm">Select your drone components</p></div><div className="flex gap-1"><Button title="List View" aria-label="List View" aria-pressed={!grid} variant={!grid?"default":"outline"} size="icon" className="size-11 sm:w-auto sm:px-3" onClick={()=>setGrid(false)}><List/><span className="hidden sm:inline">List View</span></Button><Button title="Grid View" aria-label="Grid View" aria-pressed={grid} variant={grid?"default":"outline"} size="icon" className="size-11 sm:w-auto sm:px-3" onClick={()=>setGrid(true)}><LayoutGrid/><span className="hidden sm:inline">Grid View</span></Button></div></div>
        <div className={grid?"grid gap-2 sm:grid-cols-2":"space-y-1.5"}>{categories.map(category=>{const item=stats.selected[category]; const Icon=icons[category]; const check=item?candidateCheck(stats.selected,category,item):null; return <div key={category} className={`min-w-0 rounded-md border border-border bg-background p-3 ${grid?"flex flex-col gap-2":"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)_120px_90px_132px]"}`}>
          <div className="flex min-w-0 items-center gap-2"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Icon className="size-5"/></span><h3 className="min-w-0 font-display text-base font-extrabold leading-tight text-foreground sm:text-lg">{categoryNames[category]}</h3></div>
          <div className={`flex min-w-0 items-center gap-3 ${grid?"":"col-start-1 row-start-2 sm:col-auto sm:row-auto"}`}>{item&&<ProductThumbnail key={item.id} product={item}/>}<div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item?.name??"No component selected"}</p>{item?<p className="truncate text-xs text-muted-foreground">{item.spec}</p>:<p className="text-xs text-muted-foreground">Choose a product to continue your build.</p>}</div></div>
          <div className={`${grid?"":"col-start-1 row-start-3 sm:col-auto sm:row-auto"} text-xs ${check?.status==="verified-compatible"?"text-emerald-600":check?.status==="incompatible"?"text-destructive":"text-muted-foreground"}`}>{check?.status==="verified-compatible"?<><Check className="mr-1 inline size-3"/>Verified</>:check?.status==="incompatible"?"Check fit":item?"Needs verification":"Not selected"}</div>
          <span className={`text-sm font-bold ${grid?"":"col-start-2 row-start-2 justify-self-end sm:col-auto sm:row-auto sm:justify-self-start"}`}>{item?money(item.price):"—"}</span>
          <Button variant="outline" className={`min-h-11 border-primary/30 text-primary ${grid?"w-full":"col-start-2 row-start-1 w-[132px] max-w-full whitespace-normal px-2 text-center text-[11px] leading-tight sm:col-auto sm:row-auto sm:text-xs"}`} onClick={()=>{setEditing(category);setFilter(false)}}>{item?"Change":"Select Component"}<ChevronRight/></Button>
        </div>})}</div>
      </section><p className="mt-3 text-xs text-muted-foreground">Demo catalog: product details, prices and compatibility have not been verified. Estimates are illustrative, not flight safety advice.</p>
    </main>
    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><section role="dialog" aria-modal="true" aria-label={`Select ${categoryNames[editing]}`} className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-lg bg-card p-4 shadow-xl sm:rounded-lg sm:p-6"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><div><h2 className="font-display text-xl font-bold">{categoryNames[editing]}</h2><p className="text-sm text-muted-foreground">Choose a demo component for your build.</p></div><Button variant="ghost" size="icon" className="size-11" aria-label="Close selection" onClick={()=>setEditing(null)}><X/></Button></div><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={filter} onChange={e=>setFilter(e.target.checked)} className="size-5 accent-primary"/> Hide confirmed incompatible options</label><div className="mt-3 space-y-2">{productCatalogue.getProductsByCategory(editing).map(p=>{const check=candidateCheck(stats.selected,editing,p); if(filter&&check.status==="incompatible")return null;return <div key={p.id} className="rounded-md border border-border p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-muted-foreground">{p.spec} · {p.weight} g</p></div><strong className="shrink-0 text-sm">{money(p.price)}</strong></div><p className={`mt-2 text-xs ${check.status==="incompatible"?"text-destructive":check.status==="verified-compatible"?"text-emerald-600":"text-muted-foreground"}`}>{check.status==="incompatible"?check.messages.join(" "):check.status==="verified-compatible"?"Verified compatible against the current documented rules. This is not a flight-safety guarantee.":check.messages.join(" ")||"No confirmed conflict found, but this option is not fully verified against the current build."}</p><Button className="mt-2 min-h-11 w-full sm:w-auto" variant={check.status==="incompatible"?"outline":"default"} onClick={()=>{setSelection(s=>({...s,[editing]:p.id}));setEditing(null);setSaved(false)}}>{selection[editing]===p.id?"Keep selected":"Select component"}</Button></div>})}</div><Button variant="ghost" className="mt-3 min-h-11" onClick={()=>{setSelection(s=>{const copy={...s};delete copy[editing];return copy});setEditing(null)}}>Remove component</Button></section></div>}
  </div>;
}
function Stat({icon:Icon,label,value,detail,score}:{icon:LucideIcon|null;label:string;value:string;detail?:string;score?:number|null}){
  const ring=score===null||score===undefined?0:Math.max(1,Math.min(100,score));
  return <div className="flex min-h-16 min-w-0 items-center gap-2 border-b border-border px-2 py-2 even:border-l sm:border-b-0 sm:border-l sm:px-3 sm:py-0 first:sm:border-l-0">
    <div className="grid size-11 shrink-0 place-items-center text-primary">
      {score!==undefined?
        <span className="grid size-11 place-items-center rounded-full p-[3px]" style={{background:score===null?"var(--muted)":`conic-gradient(var(--primary) ${ring*3.6}deg, var(--muted) 0deg)`}}>
          <span className="grid size-full place-items-center rounded-full bg-card text-xs font-extrabold text-foreground">{score??"—"}</span>
        </span>
        :Icon?<Icon className="size-5"/>:<span className="text-xl font-semibold">€</span>}
    </div>
    <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate text-sm font-bold text-foreground">{value}</p>{detail&&<p className="text-[10px] text-muted-foreground">{detail}</p>}</div>
  </div>;
}
