import * as Range from '@radix-ui/react-slider';
import { Box, ShieldCheck, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { money, type Category, type Product } from '@/lib/build-data';
import { componentFilterMetadata, UNKNOWN_FILTER_VALUE, type ComponentFilters } from '@/lib/component-product-filters';

type Props={category:Category;products:readonly Product[];value:ComponentFilters;onChange:(value:ComponentFilters)=>void;onReset:()=>void;disabled:boolean};
export function ComponentProductFilters({category,products,value,onChange,onReset,disabled}:Props) {
  const meta=componentFilterMetadata(category,products), price=value.price??[meta.min,meta.max];
  return <fieldset disabled={disabled} className="mt-4 min-w-0 space-y-4 rounded-xl border border-border bg-secondary/20 p-4 disabled:opacity-50">
    <legend className="flex items-center gap-2 px-1 text-sm font-semibold"><SlidersHorizontal className="size-4"/>Product filters</legend>
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm"><span id="component-price-label" className="font-medium">Price</span><output aria-live="polite">{money(price[0])} – {money(price[1])}</output></div>
      <Range.Root aria-labelledby="component-price-label" className="relative flex h-8 w-full touch-none select-none items-center" min={meta.min} max={meta.max>meta.min?meta.max:meta.min+0.01} step={0.01} minStepsBetweenThumbs={0} value={price} disabled={disabled||meta.min===meta.max} onValueChange={v=>onChange({...value,price:[v[0]!,v[1]!]})}>
        <Range.Track className="relative h-1.5 grow rounded-full bg-primary/20"><Range.Range className="absolute h-full rounded-full bg-primary"/></Range.Track>
        {['Minimum price','Maximum price'].map(label=><Range.Thumb key={label} aria-label={label} className="relative block size-5 rounded-full border-2 border-primary bg-card shadow-sm after:absolute after:-inset-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"/>)}
      </Range.Root>
      <p className="flex justify-between text-xs text-muted-foreground"><span>{money(meta.min)}</span><span>{money(meta.max)}</span></p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-3"><label htmlFor="component-compatible" className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/>Compatibility</span><Switch id="component-compatible" checked={value.compatible} onCheckedChange={compatible=>onChange({...value,compatible})} aria-describedby="component-compatible-help"/></label><p id="component-compatible-help" className="mt-2 text-xs text-muted-foreground">Hide confirmed conflicts. Unverified options remain visible.</p></div>
      <div className="rounded-lg border border-border bg-card p-3"><label htmlFor="component-3d" className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><Box className="size-4 text-primary"/>3D preview</span><Switch id="component-3d" checked={value.preview3D} onCheckedChange={preview3D=>onChange({...value,preview3D})} aria-describedby="component-3d-help"/></label><p id="component-3d-help" className="mt-2 text-xs text-muted-foreground">Only products with a real 3D preview. No product 3D previews are currently available.</p></div>
    </div>
    <label className="block space-y-1 text-sm font-medium">Brand<select aria-label="Brand" value={value.manufacturer} onChange={e=>onChange({...value,manufacturer:e.target.value})} className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">All brands</option>{meta.manufacturers.map(m=><option key={m} value={m}>{m===UNKNOWN_FILTER_VALUE?'Not specified':m}</option>)}</select></label>
    <details className="rounded-lg border border-border bg-card" open>
      <summary className="cursor-pointer px-3 py-3 text-sm font-medium">Category filters</summary>
      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">{meta.facets.map(f=><label key={f.key} className="block space-y-1 text-xs font-medium">{f.label}<select aria-label={f.label} className="min-h-11 w-full rounded-md border border-input bg-card px-2 text-sm" value={value.attributes[f.key]??''} onChange={e=>onChange({...value,attributes:{...value.attributes,[f.key]:e.target.value}})}><option value="">All</option>{f.options.map(option=><option key={option} value={option}>{option===UNKNOWN_FILTER_VALUE?'Not specified':option}</option>)}</select></label>)}</div>
    </details>
    <Button type="button" variant="ghost" className="min-h-11 px-0 text-xs text-muted-foreground" onClick={onReset}><RotateCcw className="size-3.5"/>Reset filters</Button>
  </fieldset>;
}
