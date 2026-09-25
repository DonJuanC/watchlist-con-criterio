// src/components/GraphControls.jsx
// CINE-04B: panel flotante colapsable para filtrar el grafo en memoria — afinidad
// semántica mínima y qué tipos de arista mostrar. No dispara llamadas a la API:
// solo actualiza el store, y useFilteredLinks (en useCineStore) recalcula el
// subconjunto de enlaces que ve GraphCanvas.

import { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import useCineStore, { useFilteredLinks, MIN_SIMILARITY_RANGE } from '../store/useCineStore';

function LinkTypeChip({ active, onClick, colorClass, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/5 bg-transparent text-neutral-500 hover:text-neutral-300'
            }`}
        >
            <span className={`h-2 w-2 rounded-full ${active ? colorClass : 'bg-neutral-600'}`} />
            {label}
        </button>
    );
}

export default function GraphControls() {
    const [collapsed, setCollapsed] = useState(false);

    const minSimilarity = useCineStore((s) => s.minSimilarity);
    const showDirectorLinks = useCineStore((s) => s.showDirectorLinks);
    const showSemanticLinks = useCineStore((s) => s.showSemanticLinks);
    const setMinSimilarity = useCineStore((s) => s.setMinSimilarity);
    const toggleDirectorLinks = useCineStore((s) => s.toggleDirectorLinks);
    const toggleSemanticLinks = useCineStore((s) => s.toggleSemanticLinks);

    const visibleLinksCount = useFilteredLinks().length;

    return (
        <div className="fixed bottom-6 left-6 z-20 w-64 rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 shadow-2xl backdrop-blur-md">
            <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={!collapsed}
            >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-300">
                    <SlidersHorizontal size={14} />
                    Controles del grafo
                </span>
                {collapsed ? (
                    <ChevronUp size={16} className="text-neutral-500" />
                ) : (
                    <ChevronDown size={16} className="text-neutral-500" />
                )}
            </button>

            {!collapsed && (
                <div className="mt-3 space-y-3">
                    <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
                            <label htmlFor="min-similarity">Afinidad semántica mínima</label>
                            <span className="font-mono text-neutral-200">
                                {Math.round(minSimilarity * 100)}%
                            </span>
                        </div>
                        <input
                            id="min-similarity"
                            type="range"
                            min={MIN_SIMILARITY_RANGE.min}
                            max={MIN_SIMILARITY_RANGE.max}
                            step={MIN_SIMILARITY_RANGE.step}
                            value={minSimilarity}
                            onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                            className="w-full accent-cyan-500"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <LinkTypeChip
                            active={showDirectorLinks}
                            onClick={toggleDirectorLinks}
                            colorClass="bg-amber-400"
                            label="Mismo director"
                        />
                        <LinkTypeChip
                            active={showSemanticLinks}
                            onClick={toggleSemanticLinks}
                            colorClass="bg-cyan-400"
                            label="Afinidad semántica"
                        />
                    </div>

                    <p className="text-xs text-neutral-500">
                        {visibleLinksCount} conexión{visibleLinksCount !== 1 ? 'es' : ''} activa
                        {visibleLinksCount !== 1 ? 's' : ''}
                    </p>
                </div>
            )}
        </div>
    );
}
