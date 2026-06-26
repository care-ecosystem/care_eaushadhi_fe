import { Button } from "@/components/ui/button";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/lib/contants";
import { DownloadIcon } from "lucide-react";

interface Props {
  facilityId: string;
  locationId: string;
}

export default function EAusdhadhiTriggerButton({
  facilityId,
  locationId,
}: Props) {
  const { t } = useTranslation(I18NNAMESPACE);
  return (
    <Button
      variant="outline_primary"
      onClick={() =>
        navigate(
          `/facility/${facilityId}/locations/${locationId}/eaushadhi/delivery/create`
        )
      }
      className="flex items-center gap-2"
    >
      <DownloadIcon />
      {t("fetch_from_eaushadhi")}
    </Button>
  );
}
