import { useQuery } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";

interface Facility {
  id: string;
  name: string;
}

interface FacilitySelectorProps {
  value: string;
  onSelect: (facilityId: string) => void;
}

export default function FacilitySelector({
  value,
  onSelect,
}: FacilitySelectorProps) {
  const {
    data: facilitiesData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["facilities-list"],
    queryFn: () =>
      request<{ results: Facility[] }>(
        "/api/v1/getallfacilities/",
        HttpMethod.GET,
        { limit: 100 },
      ),
  });

  const facilities = facilitiesData?.results ?? [];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">
        Select Facility
      </label>
      <Select value={value} onValueChange={onSelect} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading..." : "Select a facility"} />
        </SelectTrigger>
        <SelectContent>
          {facilities.map((facility) => (
            <SelectItem key={facility.id} value={facility.id}>
              {facility.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="text-sm text-red-600">Unable to load facilities</p>
      )}
    </div>
  );
}
