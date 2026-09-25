// src/components/SearchOverlay.jsx
// CINE-04: Barra de búsqueda flotante estilo Spotlight/Command bar. Al buscar, solo
// actualiza `matchedMovieIds` en el store — el grafo (GraphCanvas) no se remonta ni
// reinicia su física, solo re-pinta la opacidad de los nodos.

import { useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import useCineStore from '../store/useCineStore';
import { semanticSearch } from '../services/api';

export default function SearchOverlay() {
    const [inputValue, setInputValue] = useState('');
    const searchQuery = useCineStore((s) => s.searchQuery);
    const isSearching = useCineStore((s) => s.isSearching);
    const searchError = useCineStore((s) => s.searchError);
    const matchedMovieIds = useCineStore((s) => s.matchedMovieIds);
    const setSearchQuery = useCineStore((s) => s.setSearchQuery);
    const setIsSearching = useCineStore((s) => s.setIsSearching);
    const setSearchError = useCineStore((s) => s.setSearchError);
    const setMatchedMovieIds = useCineStore((s) => s.setMatchedMovieIds);
    const clearSearch = useCineStore((s) => s.clearSearch);

    const handleSubmit = useCallback(
        async (e) => {
            e.preventDefault();
            const trimmed = inputValue.trim();
            if (!trimmed) return;

            setIsSearching(true);
            setSearchError(null);
            setSearchQuery(trimmed);

            try {
                const data = await semanticSearch(trimmed, 15);
                setMatchedMovieIds(data.results || []);
            } catch (err) {
                setSearchError(err.message);
                setMatchedMovieIds([]);
            } finally {
                setIsSearching(false);
            }
        },
        [inputValue, setIsSearching, setSearchError, setSearchQuery, setMatchedMovieIds]
    );

    const handleClear = useCallback(() => {
        setInputValue('');
        clearSearch();
    }, [clearSearch]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') handleClear();
        },
        [handleClear]
    );

    const hasActiveSearch = matchedMovieIds.size > 0 || searchQuery;

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
            <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900/90 px-4 py-3 shadow-2xl backdrop-blur"
            >
                {isSearching ? (
                    <Loader2 size={18} className="animate-spin text-neutral-400" />
                ) : (
                    <Search size={18} className="text-neutral-400" />
                )}
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Busca por tema, tono o sensación (ej. 'thriller psicológico sobre identidad')..."
                    className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 outline-none"
                />
                {hasActiveSearch && (
                    <button
                        type="button"
                        onClick={handleClear}
                        aria-label="Limpiar búsqueda"
                        className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                )}
            </form>

            {searchError && (
                <p className="mt-2 text-center text-xs text-red-400">{searchError}</p>
            )}
            {hasActiveSearch && !searchError && (
                <p className="mt-2 text-center text-xs text-neutral-400">
                    {matchedMovieIds.size} resultado{matchedMovieIds.size !== 1 ? 's' : ''} para "{searchQuery}"
                </p>
            )}
        </div>
    );
}
