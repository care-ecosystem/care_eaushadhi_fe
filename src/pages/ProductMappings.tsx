import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpenIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { I18NNAMESPACE } from "@/lib/contants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProductKnowledgeCombobox from "@/components/ProductKnowledgeCombobox";
import EaushadhiDrugCombobox from "@/components/EaushadhiDrugCombobox";
import { ProductKnowledge } from "@/types/productKnowledge";

interface EaushadhiDrug {
  id: string;
  name: string;
}

interface EaushadhiProductMapping {
  id: string;
  product_knowledge_id: string;
  product_knowledge_name: string;
  eaushadhi_drug_id: string;
}

type ProductMappingsProps = {
  facilityId: string;
  mappingOpen: boolean;
  onMappingOpenChange: (open: boolean) => void;
};

type MappingForm = {
  productKnowledge: ProductKnowledge | null;
  eaushadhi_drug: EaushadhiDrug | null;
};

const EMPTY_MAPPING: MappingForm = {
  productKnowledge: null,
  eaushadhi_drug: null,
};

const ProductMappings: FC<ProductMappingsProps> = ({
  facilityId,
  mappingOpen,
  onMappingOpenChange,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);

  const [mappings, setMappings] = useState<EaushadhiProductMapping[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

  const openEditMapping = (mapping: EaushadhiProductMapping) => {
    setEditingId(mapping.id);
    setMappingForm({
      productKnowledge: {
        id: mapping.product_knowledge_id,
        slug: mapping.product_knowledge_id,
        name: mapping.product_knowledge_name,
      },
      eaushadhi_drug: {
        id: mapping.eaushadhi_drug_id,
        name: mapping.eaushadhi_drug_id,
      },
    });
    onMappingOpenChange(true);
  };

  const saveMapping = () => {
    if (!mappingForm.productKnowledge || !mappingForm.eaushadhi_drug) {
      return;
    }
    const mapping = {
      product_knowledge_id: mappingForm.productKnowledge.id,
      product_knowledge_name: mappingForm.productKnowledge.name,
      eaushadhi_drug_id: mappingForm.eaushadhi_drug.id,
    };
    if (editingId) {
      setMappings((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...mapping } : m)),
      );
    } else {
      setMappings((prev) => [...prev, { id: crypto.randomUUID(), ...mapping }]);
    }
    onMappingOpenChange(false);
  };

  const deleteMapping = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div>
      <Dialog open={mappingOpen} onOpenChange={onMappingOpenChange}>
        <DialogContent className="max-w-md w-[95%] rounded-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("edit_mapping") : t("add_mapping")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("product_knowledge")}</Label>
              <ProductKnowledgeCombobox
                facilityId={facilityId}
                value={mappingForm.productKnowledge}
                onChange={(productKnowledge) =>
                  setMappingForm((prev) => ({ ...prev, productKnowledge }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eaushadhi_drug")}</Label>
              <EaushadhiDrugCombobox
                value={mappingForm.eaushadhi_drug}
                onChange={(eaushadhi_drug) =>
                  setMappingForm((prev) => ({ ...prev, eaushadhi_drug }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={
                !mappingForm.productKnowledge || !mappingForm.eaushadhi_drug
              }
              onClick={saveMapping}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mappings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-16 text-center">
          <FolderOpenIcon className="text-gray-400 size-6" />
          <p className="font-medium text-gray-900">{t("no_mappings")}</p>
          <p className="text-sm text-gray-500">
            {t("no_mappings_description")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 bg-gray-100 px-4 py-2 text-xs font-medium uppercase text-gray-500">
            <span>{t("product_knowledge")}</span>
            <span>{t("eaushadhi_drug")}</span>
            <span>{t("actions")}</span>
          </div>
          <div className="divide-y divide-gray-200 bg-white">
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-900">
                  {mapping.product_knowledge_name}
                </span>
                <span className="text-sm text-gray-500">
                  {mapping.eaushadhi_drug_id}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditMapping(mapping)}
                    aria-label={t("edit_mapping")}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMapping(mapping.id)}
                    aria-label={t("delete_mapping")}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMappings;
