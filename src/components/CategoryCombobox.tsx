import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

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

interface Category {
  id: string;
  slug: string;
  title: string;
}

type CategoryComboboxProps = {
  facilityId: string;
  value: Category | null;
  onChange: (category: Category | null) => void;
};

const CategoryCombobox: FC<CategoryComboboxProps> = ({
  facilityId,
  value,
  onChange,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["resourceCategories", facilityId, "product_knowledge"],
    queryFn: () =>
      request<{
        results: Category[];
      }>(`/api/v1/facility/${facilityId}/resource_category/`, HttpMethod.GET, {
        resource_type: "product_knowledge",
      }),
    enabled: open,
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
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-gray-500")}>
            {value ? value.title : t("create_pk_select_category")}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <div className="max-h-60 overflow-y-auto p-1">
          {results.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              {t("create_pk_no_categories")}
            </p>
          )}
          {results.map((category) => (
            <button
              key={category.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-gray-100 focus-visible:bg-gray-100"
              onClick={() => {
                onChange(category);
                setOpen(false);
              }}
            >
              <CheckIcon
                className={cn(
                  "size-4 shrink-0 text-gray-900",
                  value?.id === category.id ? "opacity-100" : "opacity-0",
                )}
              />
              {category.title}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CategoryCombobox;
