import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
    id: string;
    name: string;
}

interface Props {
    options: Option[];
    value: string;
    onChange: (id: string, name: string) => void;
    placeholder?: string;
}

export default function SupplierSelect({ options, value, onChange, placeholder = "Select supplier..." }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full h-9 flex items-center justify-between border border-gray-300 rounded-md px-3 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors"
            >
                <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>
                    {selected?.name ?? placeholder}
                </span>
                <ChevronDown className={`size-4 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {options.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">No options available</p>
                    ) : (
                        options.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                                onClick={() => {
                                    onChange(o.id, o.name);
                                    setOpen(false);
                                }}
                            >
                                <span className={value === o.id ? "text-green-700 font-medium" : "text-gray-800"}>
                                    {o.name}
                                </span>
                                {value === o.id && <Check className="size-3.5 text-green-600 shrink-0" />}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}