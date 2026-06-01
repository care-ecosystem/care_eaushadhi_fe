import { Button } from "@/components/ui/button";
import { navigate } from "raviger";

interface Props {
    facilityId: string;
    locationId: string;
}

export default function EAusdhadhiTriggerButton({ facilityId, locationId }: Props) {
    return (
        <Button
            onClick={() =>
                navigate(`/facility/${facilityId}/locations/${locationId}/eaushadhi/fetch`)
            }
            className="flex items-center gap-2"
        >
            <svg
                className="size-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Fetch from eAushadhi
        </Button>
    );
}