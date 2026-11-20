import { useState, type ReactNode } from 'react';
import { SquareCheck, SquareX, CircleHelp, ImageOff } from 'lucide-react';
import { productPriceLabel, type Product } from '@/lib/build-data';
import type { CandidateCheck } from '@/lib/build-calculations';
import { productOptionFacts } from '@/lib/product-option-facts';

export function ProductOptionSummary({product,check,children}:{product:Product;check:CandidateCheck;children?:ReactNode}) {
  const [failedImage,setFailedImage]=useState<string|null>(null);
  const image=product.image&&product.image.src!==failedImage?product.image:null;
  const verified=check.status==='verified-compatible',incompatible=check.status==='incompatible';
  const StatusIcon=verified?SquareCheck:incompatible?SquareX:CircleHelp;
  const label=verified?'Verified compatible':incompatible?'Verified incompatible':'Compatibility not verified';
  const variant=product.variant?.trim();
  return <div className="grid grid-cols-[minmax(0,1fr)_80px] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_96px] sm:gap-3">
    <div className="min-w-0">
      <h3 className="break-words text-sm font-semibold leading-snug">{product.name}</h3>
      {variant&&!/^(default title|manufacturer.default.option)$/i.test(variant)&&!product.name.toLowerCase().includes(variant.toLowerCase())&&<p className="mt-0.5 break-words text-[11px] text-muted-foreground">{variant}</p>}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><strong className="text-sm">{productPriceLabel(product)}</strong>{product.offer?.freshness!=='current'&&<span className="text-[11px] text-muted-foreground">Last recorded price</span>}{product.stockStatus==='out_of_stock'&&<span className="text-[11px] text-muted-foreground">Out of stock</span>}</div>
      <p title={check.messages.join(' ')} className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${verified?'text-emerald-600':incompatible?'text-destructive':'text-muted-foreground'}`}>
        <StatusIcon className="size-3.5 shrink-0" aria-hidden="true"/>{label}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
        {productOptionFacts(product).map(fact=><li key={fact.label} className="max-w-full break-words before:mr-1 before:text-muted-foreground/50 before:content-['•']"><span>{fact.label}:</span> <span className="font-medium text-foreground/85">{fact.value}</span></li>)}
      </ul>
    </div>
    <div className="flex w-20 flex-col items-center gap-1.5 sm:w-24">
    <div className="flex aspect-square w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-1.5 sm:w-20">
      {image?<img src={image.src} alt={image.alt||product.name} className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailedImage(image.src)}/>:<ImageOff className="size-6 text-muted-foreground/60" role="img" aria-label="Product image unavailable"/>}
    </div>
    {children}
    </div>
  </div>;
}
