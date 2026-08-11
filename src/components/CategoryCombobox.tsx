import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { I18NNAMESPACE } from "@/lib/contants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const { data } = useQuery({
    queryKey: ["resourceCategories", facilityId, "product_knowledge"],
    queryFn: () =>
      request<{
        results: Category[];
      }>(`/api/v1/facility/${facilityId}/resource_category/`, HttpMethod.GET, {
        resource_type: "product_knowledge",
      }),
  });

  const results = data?.results ?? [];

  return (
    <Select
      value={value?.id ?? ""}
      onValueChange={(categoryId) => {
        const selected = results.find((c) => c.id === categoryId);
        onChange(selected ?? null);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={t("create_pk_select_category")} />
      </SelectTrigger>
      <SelectContent>
        {results.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            {t("create_pk_no_categories")}
          </div>
        ) : (
          results.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.title}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};

export default CategoryCombobox;
