import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  facilityId: string;
}

export default function EAusdhadhiTriggerButton({
  facilityId: _facilityId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Fetch from eAushadhi
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Fetch Stock from eAushadhi</DialogTitle>
            <p className="text-sm text-gray-500">
              The selected supplier scopes the entire session — every delivery
              created from this inward record will be linked to this supplier.
            </p>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>
                Supplier <span className="text-red-500">*</span>
              </Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder" disabled>
                    Suppliers will load here
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                Pre-selected from your default supplier mapping.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Inward Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Defaults to today. Backdating is restricted by facility policy.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Note (Optional)</Label>
              <Input type="text" placeholder="Add a note..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Fetch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}