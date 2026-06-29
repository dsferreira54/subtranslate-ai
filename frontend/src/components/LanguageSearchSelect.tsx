import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterLanguages, findLanguageLabel } from "../lib/languages";

interface LanguageSearchSelectProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function LanguageSearchSelect({
  value,
  onChange,
  disabled,
  placeholder = "Search language...",
}: LanguageSearchSelectProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => filterLanguages(query), [query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectLanguage = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectLanguage(filtered[highlightIndex].code);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
    }
  };

  const displayValue = open ? query : findLanguageLabel(value);

  return (
    <div
      ref={containerRef}
      className={`language-search ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && (
        <ul id={listId} className="language-search-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="language-search-empty">No languages found</li>
          ) : (
            filtered.map((lang, index) => (
              <li
                key={lang.code}
                role="option"
                aria-selected={lang.code === value}
                className={`language-search-option ${
                  index === highlightIndex ? "highlighted" : ""
                } ${lang.code === value ? "selected" : ""}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectLanguage(lang.code)}
              >
                {lang.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
