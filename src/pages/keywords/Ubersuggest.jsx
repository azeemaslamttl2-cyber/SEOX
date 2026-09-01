import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  Globe,
  Link2,
  Loader2,
  MessageCircleQuestion,
  Search,
  Table2,
} from "lucide-react";
import {
  AUTOCOMPLETE_REGIONS,
  UBERSUGGEST_CATEGORIES,
  downloadCsv,
  fetchAutocompleteBatch,
  uniqueKeywords,
} from "../../lib/keywordTools.js";

const categoryIcons = {
  questions: MessageCircleQuestion,
  prepositions: Link2,
  comparisons: ArrowLeftRight,
};

export default function Ubersuggest() {
  const [query, setQuery] = useState("");
  const [regionCode, setRegionCode] = useState("US");
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegion, setShowRegion] = useState(false);
  const [results, setResults] = useState(null);
  const [activeCategory, setActiveCategory] = useState("questions");
  const [viewMode, setViewMode] = useState("data");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const regionRef = useRef(null);

  const region = AUTOCOMPLETE_REGIONS.find((item) => item.gl === regionCode) || AUTOCOMPLETE_REGIONS[0];
  const filteredRegions = useMemo(() => {
    const needle = regionSearch.trim().toLowerCase();
    return AUTOCOMPLETE_REGIONS.filter((item) => (
      !needle ||
      item.name.toLowerCase().includes(needle) ||
      item.gl.toLowerCase().includes(needle)
    ));
  }, [regionSearch]);
  const categories = Object.entries(UBERSUGGEST_CATEGORIES).map(([key, category]) => {
    const count = Object.values(results?.[key] || {}).reduce((sum, items) => sum + items.length, 0);
    return { key, ...category, count, icon: categoryIcons[key] };
  });
  const currentData = results?.[activeCategory] || {};
  const totalKeywords = useMemo(() => {
    if (!results) return 0;
    return Object.values(results).reduce(
      (sum, category) => sum + Object.values(category).reduce((inner, keywords) => inner + keywords.length, 0),
      0
    );
  }, [results]);

  useEffect(() => {
    const close = (event) => {
      if (!regionRef.current?.contains(event.target)) setShowRegion(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function handleSearch() {
    const seed = query.trim();
    if (!seed) return;

    setIsLoading(true);
    setProgress(0);
    setError("");
    setResults(null);

    try {
      const tasks = [];
      Object.entries(UBERSUGGEST_CATEGORIES).forEach(([catKey, category]) => {
        category.modifiers.forEach((modifier) => {
          tasks.push({
            key: `${catKey}:${modifier}`,
            query: category.buildQuery(seed, modifier),
            region,
          });
          category.subModifiers?.[modifier]?.forEach((subModifier) => {
            tasks.push({
              key: `${catKey}:${modifier}`,
              query: category.buildQuery(seed, subModifier),
              region,
            });
          });
        });
      });

      const fetched = await fetchAutocompleteBatch(tasks, {
        batchSize: 4,
        onProgress: setProgress,
      });
      const nextResults = {};
      Object.entries(UBERSUGGEST_CATEGORIES).forEach(([catKey, category]) => {
        nextResults[catKey] = Object.fromEntries(
          category.modifiers.map((modifier) => [
            modifier,
            uniqueKeywords(fetched[`${catKey}:${modifier}`] || []),
          ])
        );
      });
      setResults(nextResults);
    } catch (err) {
      setError(err?.message || "Could not fetch Ubersuggest keyword ideas");
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }

  async function copyCurrent() {
    const keywords = Object.values(currentData).flat();
    await navigator.clipboard.writeText(keywords.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function exportCsv() {
    if (!results) return;
    const rows = [["Keyword", "Category", "Modifier"]];
    Object.entries(results).forEach(([catKey, group]) => {
      Object.entries(group).forEach(([modifier, keywords]) => {
        keywords.forEach((keyword) => rows.push([keyword, UBERSUGGEST_CATEGORIES[catKey].label, modifier]));
      });
    });
    downloadCsv(`${query.trim().replace(/\s+/g, "-") || "ubersuggest"}-keywords.csv`, rows);
  }

  return (
    <div className="ubersuggest-page space-y-5">
      <div className="flex flex-col items-center py-6">
        <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2">
          <Search className="h-4 w-4 text-white" />
          <span className="text-sm font-bold text-white">Ubersuggest</span>
        </div>
        <p className="mt-3 max-w-md text-center text-sm text-white/35">
          Discover live Google autocomplete ideas organized by questions, prepositions, and comparisons.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0d1117] px-4 py-3">
          <Search className="h-4 w-4 text-white/25" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSearch()}
            className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
            placeholder="Enter keyword, e.g. Pakistan"
          />
        </div>
        <div ref={regionRef} className="relative">
          <button
            type="button"
            onClick={() => setShowRegion((value) => !value)}
            className="ubersuggest-region-trigger flex h-full w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#0d1117] px-4 py-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Globe className="h-4 w-4 flex-shrink-0 text-blue-400" />
              <span className="truncate text-sm text-white/60">{region.name}</span>
            </span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/30 transition-transform ${showRegion ? "rotate-180" : ""}`} />
          </button>
          {showRegion && (
            <div className="ubersuggest-region-menu absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d1117] shadow-2xl shadow-black/40">
              <div className="border-b border-white/[0.06] p-2">
                <input
                  value={regionSearch}
                  onChange={(event) => setRegionSearch(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#010409] px-3 py-2 text-xs text-white/65 placeholder:text-white/20 focus:outline-none"
                  placeholder="Search country..."
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredRegions.map((item) => (
                  <button
                    key={item.gl}
                    type="button"
                    onClick={() => {
                      setRegionCode(item.gl);
                      setShowRegion(false);
                      setRegionSearch("");
                    }}
                    className={`ubersuggest-region-option flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-orange-500/10 ${
                      regionCode === item.gl ? "bg-orange-500/10 text-orange-300" : "text-white/60"
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-[10px] text-white/30">{item.gl}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {isLoading ? `${progress}%` : "Search"}
        </button>
      </div>

      {isLoading && (
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}

      {!results ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0d1117] p-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10">
            <Search className="h-6 w-6 text-orange-400/50" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/25">Enter a keyword to explore</h3>
          <p className="mt-1 text-sm text-white/15">Questions, prepositions, and comparisons will appear here.</p>
        </div>
      ) : (
        <>
          <div className="ubersuggest-category-stats grid grid-cols-3 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`ubersuggest-category-card rounded-xl border p-4 text-center transition ${
                    activeCategory === cat.key
                      ? "border-orange-500/30 bg-orange-500/[0.05]"
                      : "border-white/[0.06] bg-[#0d1117] hover:bg-white/[0.02]"
                  }`}
                >
                  <Icon className={`mx-auto h-5 w-5 ${activeCategory === cat.key ? "text-orange-400" : "text-blue-400"}`} />
                  <div className={`mt-2 font-display text-3xl font-black ${activeCategory === cat.key ? "text-orange-400" : "text-blue-400"}`}>
                    {cat.count}
                  </div>
                  <div className="mt-0.5 text-xs text-white/40">{cat.label}</div>
                </button>
              );
            })}
          </div>

          <div className="ubersuggest-results rounded-2xl border border-white/[0.08] bg-[#0d1117]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
              <div className="flex items-center gap-4">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`flex items-center gap-1.5 text-sm font-semibold transition ${
                        activeCategory === cat.key ? "text-orange-400" : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {cat.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
                  <button
                    onClick={() => setViewMode("visualization")}
                    className={`rounded-md px-3 py-1 text-[11px] font-bold ${viewMode === "visualization" ? "bg-orange-500 text-white" : "text-white/30"}`}
                  >
                    <Eye className="mr-1 inline h-3 w-3" />
                    Visualization
                  </button>
                  <button
                    onClick={() => setViewMode("data")}
                    className={`rounded-md px-3 py-1 text-[11px] font-bold ${viewMode === "data" ? "bg-orange-500 text-white" : "text-white/30"}`}
                  >
                    <Table2 className="mr-1 inline h-3 w-3" />
                    Data
                  </button>
                </div>
                <button onClick={copyCurrent} className="flex items-center gap-1 text-[11px] font-semibold text-white/30 hover:text-white/50">
                  {copied ? <Check className="h-3 w-3" /> : <CopyIcon />}
                  Copy Category
                </button>
                <button onClick={exportCsv} className="flex items-center gap-1 text-[11px] font-semibold text-white/30 hover:text-white/50">
                  <Download className="h-3 w-3" /> Export CSV
                </button>
              </div>
            </div>

            {viewMode === "data" ? (
              <div className="grid gap-4 p-5 md:grid-cols-3">
                {Object.entries(currentData).map(([modifier, keywords]) => (
                    <div key={modifier} className="ubersuggest-data-card rounded-xl border border-white/[0.06] bg-[#010409]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                      <span className="text-sm font-bold text-white/70">{modifier}</span>
                      <span className="text-[10px] font-bold text-orange-400">{keywords.length} keywords</span>
                    </div>
                    <div className="space-y-2 px-4 py-3">
                      {keywords.length ? (
                        keywords.map((item) => (
                          <div key={item} className="cursor-pointer text-[12px] text-white/50 transition hover:text-white/70">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="text-[12px] text-white/20">No suggestions</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Visualization query={query} data={currentData} />
            )}
          </div>

          <p className="text-center text-[11px] text-white/20">{totalKeywords} keyword ideas fetched from Google autocomplete.</p>
        </>
      )}
    </div>
  );
}

function CopyIcon() {
  return <span className="inline-block h-3 w-3 rounded-sm border border-current" />;
}

function radialLinkPath(parentAngle, parentRadius, childAngle, childRadius) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const px = parentRadius * Math.cos(toRad(parentAngle - 90));
  const py = parentRadius * Math.sin(toRad(parentAngle - 90));
  const cx = childRadius * Math.cos(toRad(childAngle - 90));
  const cy = childRadius * Math.sin(toRad(childAngle - 90));
  const mx = (px + cx) / 2;
  const my = (py + cy) / 2;
  return `M${px},${py}C${mx},${py},${mx},${cy},${cx},${cy}`;
}

function Visualization({ query, data }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.55, rotation: 0 });
  const canvas = 1400;
  const center = canvas / 2;
  const branchRadius = 290;
  const leafRadius = 560;
  const orange = "#f16434";
  const linkColor = "#bcbcbc";

  const layout = useMemo(() => {
    const activeMods = Object.entries(data).filter(([, keywords]) => keywords.length > 0);
    if (!activeMods.length) return { branches: [], links: [] };
    const anglePerMod = 360 / activeMods.length;
    const links = [];
    const branches = activeMods.map(([modifier, keywords], modifierIndex) => {
      const modifierAngle = modifierIndex * anglePerMod;
      const spread = keywords.length > 1 ? anglePerMod * 0.85 : 0;
      const startAngle = modifierAngle - spread / 2;
      links.push(radialLinkPath(0, 0.0001, modifierAngle, branchRadius));
      const leaves = keywords.map((text, leafIndex) => {
        const leafAngle = keywords.length > 1 ? startAngle + (spread * leafIndex) / (keywords.length - 1) : modifierAngle;
        links.push(radialLinkPath(modifierAngle, branchRadius, leafAngle, leafRadius));
        return { text, angle: leafAngle };
      });
      return { modifier, angle: modifierAngle, leaves };
    });
    return { branches, links };
  }, [branchRadius, data, leafRadius]);

  const onMouseDown = useCallback((event) => {
    dragRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startTx: transform.x,
      startTy: transform.y,
    };
  }, [transform]);

  const onMouseMove = useCallback((event) => {
    if (!dragRef.current.dragging) return;
    setTransform((current) => ({
      ...current,
      x: dragRef.current.startTx + (event.clientX - dragRef.current.startX),
      y: dragRef.current.startTy + (event.clientY - dragRef.current.startY),
    }));
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const handler = (event) => {
      event.preventDefault();
      setTransform((current) => ({
        ...current,
        scale: Math.max(0.2, Math.min(4, current.scale + (event.deltaY > 0 ? -0.08 : 0.08))),
      }));
    };
    element.addEventListener("wheel", handler, { passive: false });
    return () => element.removeEventListener("wheel", handler);
  }, []);

  function exportImage() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const svgData = new XMLSerializer().serializeToString(clone);
    const image = new Image();
    const canvasElement = document.createElement("canvas");
    canvasElement.width = canvas;
    canvasElement.height = canvas;
    const context = canvasElement.getContext("2d");
    image.onload = () => {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas, canvas);
      context.drawImage(image, 0, 0);
      const link = document.createElement("a");
      link.download = `${query.trim().replace(/\s+/g, "-") || "ubersuggest"}-visualization.png`;
      link.href = canvasElement.toDataURL("image/png");
      link.click();
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

  const toolButton = "flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-xs font-bold text-slate-500 transition hover:bg-slate-100";
  const getTextProps = (angle) => {
    const normalized = ((angle % 360) + 360) % 360;
    const left = normalized > 90 && normalized < 270;
    return {
      textAnchor: left ? "end" : "start",
      transform: left ? "rotate(180)translate(-8)scale(0.91)" : "translate(8)scale(0.91)",
    };
  };

  if (!layout.branches.length) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-10 text-sm text-white/25">
        No suggestions to visualize for this category.
      </div>
    );
  }

  return (
    <div className="relative p-5">
      <div className="relative overflow-hidden rounded-sm border border-slate-300 bg-white">
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <button className={toolButton} title="Zoom in" onClick={() => setTransform((current) => ({ ...current, scale: Math.min(4, current.scale + 0.15) }))}>+</button>
            <button className={toolButton} title="Zoom out" onClick={() => setTransform((current) => ({ ...current, scale: Math.max(0.2, current.scale - 0.15) }))}>-</button>
          </div>
          <div className="flex flex-col gap-0.5">
            <button className={toolButton} title="Move up" onClick={() => setTransform((current) => ({ ...current, y: current.y + 60 }))}>^</button>
            <button className={toolButton} title="Move down" onClick={() => setTransform((current) => ({ ...current, y: current.y - 60 }))}>v</button>
            <button className={toolButton} title="Move left" onClick={() => setTransform((current) => ({ ...current, x: current.x + 60 }))}>{"<"}</button>
            <button className={toolButton} title="Move right" onClick={() => setTransform((current) => ({ ...current, x: current.x - 60 }))}>{">"}</button>
          </div>
          <div className="flex flex-col gap-0.5">
            <button className={toolButton} title="Rotate left" onClick={() => setTransform((current) => ({ ...current, rotation: current.rotation - 15 }))}>L</button>
            <button className={toolButton} title="Rotate right" onClick={() => setTransform((current) => ({ ...current, rotation: current.rotation + 15 }))}>R</button>
            <button className={toolButton} title="Center view" onClick={() => setTransform({ x: 0, y: 0, scale: 0.55, rotation: 0 })}>C</button>
          </div>
        </div>

        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-xs font-bold text-slate-800">
          {query}
        </div>
        <button
          onClick={exportImage}
          className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export IMG
        </button>

        <div
          ref={containerRef}
          className="relative h-[760px] cursor-grab overflow-hidden active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          <svg
            ref={svgRef}
            width={canvas}
            height={canvas}
            viewBox={`0 0 ${canvas} ${canvas}`}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "center",
            }}
          >
            <rect width={canvas} height={canvas} fill="#ffffff" />
            <g transform={`translate(${center - 25}, ${center - 25})`}>
              <rect width="50" height="50" fill="none" stroke={orange} strokeWidth="2" rx="2" opacity="0.5" />
              <text x="25" y="32" textAnchor="middle" fontSize="22" fontWeight="700" fill={orange} opacity="0.5">U</text>
            </g>
            <g transform={`translate(${center}, ${center}) rotate(${transform.rotation - 90})`}>
              {layout.links.map((path, index) => (
                <path key={`link-${index}`} d={path} stroke={linkColor} strokeWidth="0.5" fill="none" />
              ))}
              {layout.branches.map((branch) => (
                branch.leaves.map((leaf, index) => {
                  const textProps = getTextProps(leaf.angle + transform.rotation - 90);
                  return (
                    <g key={`${branch.modifier}-${index}`} transform={`rotate(${leaf.angle}) translate(${leafRadius})`}>
                      <circle r="5.5" fill="white" stroke={orange} strokeWidth="2" />
                      <text
                        textAnchor={textProps.textAnchor}
                        transform={textProps.transform}
                        dy=".35em"
                        style={{
                          fontSize: 12,
                          paintOrder: "stroke",
                          stroke: "white",
                          strokeWidth: 3,
                          fontFamily: "Inter, sans-serif",
                          fill: "#202020",
                        }}
                      >
                        {leaf.text}
                      </text>
                    </g>
                  );
                })
              ))}
              {layout.branches.map((branch) => {
                const textProps = getTextProps(branch.angle + transform.rotation - 90);
                return (
                  <g key={branch.modifier} transform={`rotate(${branch.angle}) translate(${branchRadius})`}>
                    <circle r="5.5" fill={orange} stroke={orange} strokeWidth="2" />
                    <text
                      textAnchor={textProps.textAnchor}
                      transform={textProps.transform}
                      dy=".35em"
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        paintOrder: "stroke",
                        stroke: "white",
                        strokeWidth: 3,
                        fontFamily: "Inter, sans-serif",
                        fill: "#202020",
                      }}
                    >
                      {branch.modifier}
                    </text>
                  </g>
                );
              })}
              <g transform="rotate(0) translate(0.000001)">
                <circle r="5.5" fill={orange} stroke={orange} strokeWidth="4" />
                <text
                  textAnchor="start"
                  transform="translate(8)scale(0.91)"
                  dy=".35em"
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    fontFamily: "Inter, sans-serif",
                    fill: "#202020",
                  }}
                >
                  {query}
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
