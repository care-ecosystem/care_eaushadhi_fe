import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { cn } from "@/lib/utils";
import { I18NNAMESPACE } from "@/lib/contants";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProductKnowledge } from "@/types/productKnowledge";

type ProductKnowledgeComboboxProps = {
  facilityId: string;
  value: ProductKnowledge | null;
  onChange: (productKnowledge: ProductKnowledge) => void;
  categorySlug?: string;
};

const ProductKnowledgeCombobox: FC<ProductKnowledgeComboboxProps> = ({
  facilityId,
  value,
  onChange,
  categorySlug,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["product-knowledge-search", facilityId, categorySlug, debouncedSearch],
    queryFn: () =>
      request<{ results: ProductKnowledge[] }>(
        `/api/v1/product_knowledge/`,
        HttpMethod.GET,
        {
          facility: facilityId,
          include_instance: "true",
          name: debouncedSearch || undefined,
          category: categorySlug || undefined,
          limit: 10,
        },
      ),
    enabled: open && !!categorySlug,
  });

  const results = data?.results ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={!categorySlug}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-gray-500")}>
            {value ? value.name : t("product_knowledge_placeholder")}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <div className="flex h-9 items-center gap-2 border-b border-gray-200 px-3">
          <SearchIcon className="size-4 shrink-0 opacity-50" />
          <input
            autoFocus
            placeholder={t("search_product_knowledge")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0 placeholder:text-gray-500"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {isLoading && (
            <p className="py-6 text-center text-sm text-gray-500">
              {t("loading")}
            </p>
          )}
          {!isLoading && results.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              {t("no_product_knowledge_found")}
            </p>
          )}
          {results.map((productKnowledge) => (
            <button
              key={productKnowledge.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-gray-100 focus-visible:bg-gray-100"
              onClick={() => {
                onChange(productKnowledge);
                setOpen(false);
              }}
            >
              <CheckIcon
                className={cn(
                  "size-4 shrink-0 text-gray-900",
                  value?.id === productKnowledge.id
                    ? "opacity-100"
                    : "opacity-0",
                )}
              />
              {productKnowledge.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProductKnowledgeCombobox;
