import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { I18NNAMESPACE } from "@/lib/contants";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EaushadhiDrug {
  id: string;
  name: string;
}

type EaushadhiDrugComboboxProps = {
  value: EaushadhiDrug | null;
  onChange: (drug: EaushadhiDrug) => void;
};

// TODO: Replace with API call once backend endpoint is available
const EAUSHADHI_DRUGS: EaushadhiDrug[] = [];

const EaushadhiDrugCombobox: FC<EaushadhiDrugComboboxProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDrugs = EAUSHADHI_DRUGS.filter((drug) =>
    drug.name.toLowerCase().includes(search.toLowerCase()),
  );

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
            {value ? value.name : t("eaushadhi_drug_placeholder")}
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
            placeholder={t("search_eaushadhi_drug")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0 placeholder:text-gray-500"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filteredDrugs.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              {t("no_product_knowledge_found")}
            </p>
          )}
          {filteredDrugs.map((drug) => (
            <button
              key={drug.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-gray-100 focus-visible:bg-gray-100"
              onClick={() => {
                onChange(drug);
                setOpen(false);
              }}
            >
              <CheckIcon
                className={cn(
                  "size-4 shrink-0 text-gray-900",
                  value?.id === drug.id ? "opacity-100" : "opacity-0",
                )}
              />
              {drug.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EaushadhiDrugCombobox;
