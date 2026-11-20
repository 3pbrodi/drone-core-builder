import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Save,
  Gauge,
  Weight,
  BadgeCheck,
  AlertTriangle,
  CircleHelp,
  List,
  LayoutGrid,
  ChevronRight,
  X,
  Check,
  Battery,
  Camera,
  Cpu,
  Radio,
  Fan,
  Zap,
  PanelsTopLeft,
  Settings2,
  ImageOff,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/SiteHeader";
import {
  categoryNames,
  money,
  productPriceLabel,
  type BuildSelection,
  type Category,
  type Product,
} from "@/lib/build-data";
import {
  categoryMetadata,
  droneMountedCategoryIds,
  pilotGearCategoryIds,
  sectionMetadata,
  sectionOrder,
  type ConfiguratorSection,
} from "@/lib/component-categories";
import {
  integratedRequiredFulfillments,
  sectionCategoriesForSelection,
} from "@/lib/configurator-selection";
import { evaluate, candidateCheck } from "@/lib/build-calculations";
import { createProductCatalogue, resolveBuildSelection } from "@/lib/catalogue-service";
import {
  resolveCompatibilityEvidence,
  type CatalogueEvidenceSnapshot,
} from "@/lib/catalogue-evidence";
import { getConfiguratorCatalogue, getConfiguratorComponents } from "@/lib/configurator-catalogue.server-fn";
import { DroneViewer } from "@/components/DroneViewer";
import { ComponentProductFilters } from "@/components/ComponentProductFilters";
import { ProductOptionSummary } from "@/components/ProductOptionSummary";
import { PublicCatalogueReadError, readCatalogueWithPublicFallback } from "@/lib/catalogue-public-query";
import { emptyComponentFilters, filterComponentProducts, loadAllComponentOptions, mergeComponentEvidence } from "@/lib/component-product-filters";

const icons: Record<Category, LucideIcon> = {
  frame: PanelsTopLeft,
  motors: Settings2,
  flightController: Cpu,
  esc: Zap,
  propellers: Fan,
  battery: Battery,
  camera: Camera,
  receiver: Radio,
  videoTransmitter: Radio,
  gps: Gauge,
  buzzer: AlertTriangle,
  antenna: Radio,
  powerAccessory: Zap,
  optionalModule: CircleHelp,
  radioTransmitter: Radio,
  fpvGoggles: Camera,
  batteryCharger: Battery,
  chargingAccessory: Zap,
};
function ProductThumbnail({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const image = product.image;
  return (
    <span className="flex h-[clamp(56px,8vw,76px)] w-[clamp(68px,10vw,92px)] shrink-0 items-center justify-center">
      {image && !failed ? (
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageOff
          className="size-7 text-muted-foreground/60"
          aria-label="Verified product image unavailable"
        />
      )}
    </span>
  );
}
type Props = {
  source: "Custom" | "AI Build" | "Template";
  name: string;
  initial: BuildSelection;
  products: readonly Product[];
  evidenceSnapshot: CatalogueEvidenceSnapshot;
  catalogueReady: boolean;
  catalogueMessage?: string;
  preferences?: Record<string, string | number | null | undefined>;
};
export function BuildInterface({
  source,
  name,
  initial,
  products,
  evidenceSnapshot,
  catalogueReady,
  catalogueMessage,
  preferences,
}: Props) {
  const [productSearch, setProductSearch] = useState("");
  const [catalogueAccessible,setCatalogueAccessible] = useState(catalogueReady);
  const [visibleCount, setVisibleCount] = useState(50);
  const [filters,setFilters] = useState(emptyComponentFilters);
  const [filtersOpen,setFiltersOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const [options, setOptions] = useState<Product[]>([]);
  const [loadedProducts,setLoadedProducts] = useState<Product[]>([...products]);
  const [loadedEvidence,setLoadedEvidence] = useState(evidenceSnapshot);
  const [optionsLoading,setOptionsLoading] = useState(false);
  const [optionsError,setOptionsError] = useState(false);
  const [optionsErrorMessage,setOptionsErrorMessage] = useState("");
  const [retry,setRetry] = useState(0);
  const [checkingSelection,setCheckingSelection] = useState(false);
  const [selection, setSelection] = useState<BuildSelection>(initial),
    [editing, setEditing] = useState<Category | null>(null),
    [grid, setGrid] = useState(false),
    [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<Record<ConfiguratorSection, boolean>>({
    required: true,
    optional: true,
    pilotGear: true,
  });
  const catalogue = useMemo(() => createProductCatalogue(loadedProducts), [loadedProducts]),
    selectedProducts = useMemo(() => resolveBuildSelection(selection, catalogue), [selection, catalogue]),
    compatibilityEvidence = resolveCompatibilityEvidence(selectedProducts, loadedEvidence),
    stats = evaluate(
      selectedProducts,
      compatibilityEvidence.verification,
      compatibilityEvidence.technicalEvidence,
    );
  const visibleSections = Object.fromEntries(
      sectionOrder.map((section) => [
        section,
        sectionCategoriesForSelection(section, stats.selected),
      ]),
    ) as Record<ConfiguratorSection, Category[]>,
    integratedRequired = integratedRequiredFulfillments(stats.selected);
  const droneOutOfStock = droneMountedCategoryIds.some(
      (category) => stats.selected[category]?.stockStatus === "out_of_stock",
    ),
    pilotOutOfStock = pilotGearCategoryIds.some(
      (category) => stats.selected[category]?.stockStatus === "out_of_stock",
    ),
    anyOutOfStock = droneOutOfStock || pilotOutOfStock;
  useEffect(()=>{
    if(!editing) return;
    let active=true;
    setOptionsLoading(true);setOptionsError(false);setOptionsErrorMessage("");setOptions([]);
    void loadAllComponentOptions(page=>{
      const data={category:editing,page,selectedIds:Object.values(selection),withEvidence:true,withManufacturers:false};
      return readCatalogueWithPublicFallback(()=>getConfiguratorComponents({data}),data);
    },()=>active)
      .then(result=>{
        if(!active||!result) return;
        setOptions(result.products);
        setCatalogueAccessible(true);
        setLoadedProducts(previous=>[...new Map([...previous,...result.products].map(p=>[p.id,p])).values()]);
        setLoadedEvidence(previous=>mergeComponentEvidence(previous,result.evidence));
      }).catch(error=>{if(active){setOptionsError(true);setOptionsErrorMessage(error instanceof PublicCatalogueReadError?error.message:"Components could not be loaded.");}})
      .finally(()=>{if(active)setOptionsLoading(false);});
    return ()=>{active=false;};
  },[editing,selection,retry]);
  useEffect(()=>{
    if(!editing) return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setEditing(null);}
      if(event.key!=='Tab') return;
      const controls=[...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')??[])].filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',onKeyDown);
    return ()=>{document.removeEventListener('keydown',onKeyDown);document.body.style.overflow=overflow;previous?.focus();};
  },[editing]);
  const optionChecks=useMemo(()=>new Map(options.map(product=>{
    const candidateSelection={...selectedProducts,[product.category]:product};
    const evidence=resolveCompatibilityEvidence(candidateSelection,loadedEvidence);
    return [product.id,candidateCheck(selectedProducts,product.category,product,evidence.verification,evidence.technicalEvidence)];
  })),[options,selectedProducts,loadedEvidence]);
  const filteredOptions=editing?filterComponentProducts(options,editing,productSearch,filters,product=>optionChecks.get(product.id)?.status==='incompatible'):[];
  const resetFilters=()=>{setFilters(emptyComponentFilters());setProductSearch('');setVisibleCount(50);};
  const save = () => {
    const data = { source, name, selection, ...(preferences ? { preferences } : {}) },
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "dronecores-build.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:px-7">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
          <Link to="/" className="flex items-center gap-2 rounded-xl active:scale-95">
            <LogoMark />
            <span className="hidden font-display text-base font-bold tracking-tight text-foreground sm:inline sm:text-lg">
              DroneCores
            </span>
          </Link>
          <div className="flex justify-end gap-1">
            <Button
              title="Save build as a file"
              aria-label="Save build as a file"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={save}
            >
              <Save />
            </Button>
            <Button onClick={save} className="h-11 px-3 sm:px-5">
              {saved ? "Saved" : "Save Build"}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 pb-14 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-2 py-4 sm:py-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{name}</h1>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-primary">
                {source}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Required drone parts, optional modules, and pilot gear stay clearly separated.
            </p>
          </div>
          {stats.selected.frame && (
            <span className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-primary">
              {stats.selected.frame.frameInches}″ build
            </span>
          )}
        </div>
        {!catalogueAccessible && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
            <strong>Verified catalogue unavailable</strong>
            <p className="mt-1 text-muted-foreground">
              {catalogueMessage ?? "The verified product catalogue could not be loaded."}
            </p>
          </div>
        )}
        <DroneViewer selection={selection} />
        <section
          aria-label="Build statistics"
          className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card px-2 py-3 shadow-sm sm:grid-cols-6 sm:px-3 sm:py-4"
        >
          <Stat
            icon={null}
            label="Build Score"
            value={stats.score === null ? "—/100" : `${stats.score}/100`}
            detail={
              stats.score === null
                ? "Build incomplete"
                : stats.score >= 80
                  ? "Great match"
                  : "Good match"
            }
            score={stats.score}
          />
          <Stat
            icon={Gauge}
            label="Top Speed (est.)"
            value={stats.speed === null ? "—" : `~ ${stats.speed} km/h`}
          />
          <Stat
            icon={Weight}
            label={Object.values(stats.selected).some(p => p?.weightBasis) ? "Component mass (extras excluded)" : "Drone Weight (est.)"}
            value={stats.weight === null ? "—" : `~ ${stats.weight} g`}
          />
          <Stat
            icon={null}
            label="Drone Subtotal"
            value={money(stats.dronePrice)}
          />
          <Stat
            icon={null}
            label="Pilot Gear"
            value={money(stats.pilotGearPrice)}
          />
          <Stat
            icon={null}
            label="Total of last recorded prices"
            value={money(stats.totalPrice)}
          />
        </section>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs font-medium">
          {stats.status === "verified-compatible" ? (
            <BadgeCheck className="size-5 shrink-0 text-emerald-600" />
          ) : stats.status === "incompatible" ? (
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
          ) : (
            <CircleHelp className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span
            className={
              stats.status === "verified-compatible"
                ? "text-emerald-600"
                : stats.status === "incompatible"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {stats.status === "verified-compatible"
              ? "Verified compatible"
              : stats.status === "incompatible"
                ? "Compatibility needs attention"
                : "Potentially compatible"}
          </span>
        </div>
        {(stats.warnings.length > 0 || stats.missing.length > 0) && (
          <div
            className={`mt-3 rounded-md border p-3 text-sm text-foreground ${stats.status === "incompatible" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}
          >
            <strong>Check your build</strong>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {[...stats.warnings, ...stats.missing].map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <section className="mt-4 rounded-lg border border-border bg-card p-3 sm:p-4">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div>
              <h2 className="font-display text-xl font-bold">Components</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Required, Optional, and Pilot Gear use one shared catalogue and compatibility model.
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                title="List View"
                aria-label="List View"
                aria-pressed={!grid}
                variant={!grid ? "default" : "outline"}
                size="icon"
                className="size-11 sm:w-auto sm:px-3"
                onClick={() => setGrid(false)}
              >
                <List />
                <span className="hidden sm:inline">List View</span>
              </Button>
              <Button
                title="Grid View"
                aria-label="Grid View"
                aria-pressed={grid}
                variant={grid ? "default" : "outline"}
                size="icon"
                className="size-11 sm:w-auto sm:px-3"
                onClick={() => setGrid(true)}
              >
                <LayoutGrid />
                <span className="hidden sm:inline">Grid View</span>
              </Button>
            </div>
          </div>
          <div className="space-y-5">
            {sectionOrder.map((section) => {
              const canCollapse = section !== "required",
                isOpen = expanded[section],
                info = sectionMetadata[section];
              return (
                <div key={section} data-configurator-section={section}>
                  <button
                    type="button"
                    className={`flex w-full items-start justify-between gap-3 text-left ${canCollapse ? "cursor-pointer" : "cursor-default"}`}
                    aria-expanded={isOpen}
                    onClick={() =>
                      canCollapse &&
                      setExpanded((current) => ({ ...current, [section]: !current[section] }))
                    }
                  >
                    <span>
                      <span className="block text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                        {info.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {info.description}
                      </span>
                    </span>
                    {canCollapse && (
                      <ChevronRight
                        className={`mt-1 size-5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                    )}
                  </button>
                  {isOpen && (
                    <div className={`mt-3 ${grid ? "grid grid-cols-2 gap-2 lg:grid-cols-3" : "space-y-1.5"}`}>
                      {visibleSections[section].map((category) => {
                        const item = stats.selected[category],
                          Icon = icons[category],
                          candidateSelection = item
                            ? { ...stats.selected, [category]: item }
                            : stats.selected,
                          candidateEvidence = resolveCompatibilityEvidence(
                            candidateSelection,
                            loadedEvidence,
                          ),
                          check = item
                            ? candidateCheck(
                                stats.selected,
                                category,
                                item,
                                candidateEvidence.verification,
                                candidateEvidence.technicalEvidence,
                              )
                            : null,
                          requiredMissing = section === "required" && !item;
                        return (
                          <div
                            key={category}
                            data-component-category={category}
                            className={`min-w-0 rounded-md border bg-background p-3 ${requiredMissing ? "border-primary/35" : "border-border"} ${grid ? "flex flex-col gap-2" : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[170px_minmax(0,1fr)_120px_90px_132px]"}`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`grid shrink-0 place-items-center rounded-full bg-secondary text-primary ${grid ? "size-8" : "size-10"}`}>
                                <Icon className="size-5" />
                              </span>
                              <div className="min-w-0">
                                <h3 className={`break-words font-display font-extrabold ${grid ? "text-sm sm:text-base" : "text-base sm:text-lg"}`}>
                                  {categoryNames[category]}
                                </h3>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {categoryMetadata[category].installationRole === "pilot"
                                    ? "Pilot equipment"
                                    : "Drone mounted"}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`flex min-w-0 gap-2 ${grid ? "flex-col items-start" : "items-center col-start-1 row-start-2 sm:col-auto sm:row-auto"}`}
                            >
                              {item && <ProductThumbnail key={item.id} product={item} />}
                              <div className="min-w-0">
                                <p className={`${grid ? "break-words" : "truncate"} text-sm font-semibold`}>
                                  {item?.name ??
                                    (requiredMissing ? "Missing" : "Not added")}
                                </p>
                                {item ? (
                                  <p className={`${grid ? "break-words" : "truncate"} text-xs text-muted-foreground`}>
                                    {item.spec}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {requiredMissing
                                      ? "Select a verified product to complete this build."
                                      : "Add this category only when your build needs it."}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div
                              className={`${grid ? "" : "col-start-1 row-start-3 sm:col-auto sm:row-auto"} text-xs ${check?.status === "verified-compatible" ? "text-emerald-600" : check?.status === "incompatible" ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {check?.status === "verified-compatible" ? (
                                <>
                                  <Check className="mr-1 inline size-3" />
                                  Verified
                                </>
                              ) : check?.status === "incompatible" ? (
                                "Check fit"
                              ) : item ? (
                                "Needs verification"
                              ) : requiredMissing ? (
                                "Required"
                              ) : (
                                "Optional"
                              )}
                            </div>
                            <span
                              className={`text-sm font-bold ${grid ? "" : "col-start-2 row-start-2 justify-self-end sm:col-auto sm:row-auto sm:justify-self-start"}`}
                            >
                              {item ? productPriceLabel(item) : "—"}
                            </span>
                            <Button
                              variant="outline"
                              className={`min-h-11 border-primary/30 text-primary ${grid ? "mt-auto w-full whitespace-normal px-2 text-xs" : "col-start-2 row-start-1 w-[132px] max-w-full whitespace-normal px-2 text-center text-[11px] leading-tight sm:col-auto sm:row-auto sm:text-xs"}`}
                              aria-label={`${item ? "Change" : "Select"} ${categoryNames[category]}`}
                              onClick={() => {
                                setProductSearch("");setVisibleCount(50);setOptions([]);setFilters(emptyComponentFilters());setFiltersOpen(false);setEditing(category);
                              }}
                            >
                              {item
                                ? "Change"
                                : section === "required"
                                  ? "Select Component"
                                  : "Add"}
                              <ChevronRight />
                            </Button>
                          </div>
                        );
                      })}
                      {section === "required" &&
                        integratedRequired.map(({ category, product }) => (
                          <div
                            key={category}
                            data-component-category={category}
                            className="rounded-md border border-emerald-600/20 bg-emerald-500/5 p-3 text-sm"
                          >
                            <span className="font-semibold">{categoryNames[category]}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              is already fulfilled by the documented integration or package contents
                              of {product.name}; no duplicate slot is required.
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <p className="mt-3 text-xs text-muted-foreground">
          Verified catalogue: unknown evidence remains unverified. Optional modules and Pilot Gear
          do not become compatible merely because no rule exists. This is not flight-safety advice.
        </p>
      </main>
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Select ${categoryNames[editing]}`}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-xl bg-card p-4 shadow-xl sm:rounded-xl sm:p-6"
          >
            <div className="sticky top-0 z-10 -mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
              <div>
                <h2 className="font-display text-xl font-bold">{categoryNames[editing]}</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a verified catalogue item. Missing evidence stays unknown.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={filtersOpen ? "default" : "outline"}
                  className="min-h-11 gap-2 px-3"
                  aria-label="Product filters"
                  aria-expanded={filtersOpen}
                  aria-controls="component-product-filter-menu"
                  onClick={()=>{
                    setFiltersOpen(!filtersOpen);
                    if(!filtersOpen) requestAnimationFrame(()=>document.getElementById('component-product-filter-menu')?.scrollIntoView({block:'start',behavior:'smooth'}));
                  }}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true"/>Filter
                </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Close selection"
                onClick={() => setEditing(null)}
              >
                <X />
              </Button>
              </div>
            </div>
            <div className="mt-4 flex min-w-0 items-center gap-2">
              <input aria-label="Search components" className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" placeholder="Search name, brand or SKU" value={productSearch} onChange={e => { setProductSearch(e.target.value); setVisibleCount(50); }} />
              <div role="group" aria-label="Product view" className="flex shrink-0 gap-1">
                <Button size="icon" className="size-11" aria-label="List product view" title="List view" aria-pressed={!grid} variant={!grid?"default":"outline"} onClick={()=>setGrid(false)}><List/></Button>
                <Button size="icon" className="size-11" aria-label="Grid product view" title="Grid view" aria-pressed={grid} variant={grid?"default":"outline"} onClick={()=>setGrid(true)}><LayoutGrid/></Button>
              </div>
            </div>
            <div id="component-product-filter-menu" hidden={!filtersOpen} className="scroll-mt-28">
              <ComponentProductFilters category={editing} products={options} value={filters} disabled={optionsLoading||optionsError} onChange={next=>{setFilters(next);setVisibleCount(50);}} onReset={resetFilters}/>
            </div>
            {optionsLoading&&<p role="status" className="py-3 text-sm text-muted-foreground">Loading all verified components and filters…</p>}
            {optionsError&&<p role="alert" className="py-3 text-sm text-destructive">{optionsErrorMessage||"Components could not be loaded."} <button className="min-h-11 underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
            {!optionsLoading&&!optionsError&&<p role="status" className="py-3 text-sm text-muted-foreground">{filteredOptions.length} matching products · {options.length} in this category</p>}
            <p className="text-xs text-muted-foreground">This sum uses last recorded prices. Out-of-stock or unconfirmed parts may not be currently purchasable.</p>
            <div data-product-layout={grid?"grid":"list"} className={`mt-3 ${grid?"grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3":"space-y-2"}`}>
              {!optionsLoading && !optionsError && filteredOptions.length === 0 && (
                <div className="col-span-full rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {options.length===0?'No verified catalogue products are available for this category yet.':'No products match these filters.'}
                  {options.length>0&&<button className="ml-2 min-h-11 font-medium text-primary underline" onClick={resetFilters}>Reset filters</button>}
                </div>
              )}
              {filteredOptions.slice(0,visibleCount).map((product) => {
                const check = optionChecks.get(product.id)!;
                return (
                  <div key={product.id} data-product-option={product.id} className={`min-w-0 rounded-lg border border-border bg-card p-2.5 sm:p-3 ${grid?"flex flex-col":""}`}>
                    <ProductOptionSummary product={product} check={check} grid={grid}>
                    <Button
                      className="h-11 min-h-11 w-full px-1.5 text-[11px] sm:text-xs"
                      aria-label={checkingSelection ? "Checking selection…" : selection[editing] === product.id ? "Keep selected" : "Select component"}
                      variant={check.status === "incompatible" ? "outline" : "default"}
                      disabled={checkingSelection}
                      onClick={() => {
                        const next={...selection,[editing]:product.id};
                        const ids=Object.values(next);
                        setCheckingSelection(true);
                        void readCatalogueWithPublicFallback(()=>getConfiguratorCatalogue({data:{ids}}),{mode:"ids",ids,withEvidence:true}).then(result=>{
                          if(result.status!=="ready"||ids.some(id=>!result.products.some(p=>p.id===id))) throw new Error("Selection is no longer available");
                          setLoadedProducts(previous=>[...previous.filter(p=>!ids.includes(p.id)),...result.products]);
                          setLoadedEvidence(result.evidence);
                          setSelection(next);setEditing(null);setSaved(false);
                        }).catch(error=>{setOptionsError(true);setOptionsErrorMessage(error instanceof PublicCatalogueReadError?error.message:"The selection could not be confirmed. Please retry.");}).finally(()=>setCheckingSelection(false));
                      }}
                    >
                      {checkingSelection ? "Checking…" : selection[editing] === product.id ? "Selected" : "Select"}
                    </Button>
                    </ProductOptionSummary>
                  </div>
                );
              })}
            </div>
            {filteredOptions.length>visibleCount&&<Button variant="outline" className="mt-4 min-h-11 w-full" onClick={()=>setVisibleCount(n=>n+50)}>Show more components ({filteredOptions.length-visibleCount} remaining)</Button>}
            <Button
              variant="ghost"
              className="mt-3 min-h-11"
              onClick={() => {
                setSelection((current) => {
                  const copy = { ...current };
                  delete copy[editing];
                  return copy;
                });
                setEditing(null);
                setSaved(false);
              }}
            >
              Remove component
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  detail,
  score,
}: {
  icon: LucideIcon | null;
  label: string;
  value: string;
  detail?: string;
  score?: number | null;
}) {
  const ring = score === null || score === undefined ? 0 : Math.max(1, Math.min(100, score));
  return (
    <div className="flex min-h-16 min-w-0 items-center gap-2 border-b border-border px-2 py-2 even:border-l sm:border-b-0 sm:border-l sm:px-3 sm:py-0 first:sm:border-l-0">
      <div className="grid size-11 shrink-0 place-items-center text-primary">
        {score !== undefined ? (
          <span
            className="grid size-11 place-items-center rounded-full p-[3px]"
            style={{
              background:
                score === null
                  ? "var(--muted)"
                  : `conic-gradient(var(--primary) ${ring * 3.6}deg, var(--muted) 0deg)`,
            }}
          >
            <span className="grid size-full place-items-center rounded-full bg-card text-xs font-extrabold">
              {score ?? "—"}
            </span>
          </span>
        ) : Icon ? (
          <Icon className="size-5" />
        ) : (
          <span className="text-xl font-semibold">€</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
        {detail && <p className="text-[10px] text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
