import { FC } from "react";
import { UploadCloudIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useDragAndDrop from "@/hooks/useDragAndDrop";

type FileDropzoneProps = {
  accept: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  dropLabel: string;
  browseLabel: string;
};

const FileDropzone: FC<FileDropzoneProps> = ({
  accept,
  selectedFile,
  onFileChange,
  dropLabel,
  browseLabel,
}) => {
  const { dragOver, onDragOver, onDragLeave, setDragOver } = useDragAndDrop();

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    onFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-8 text-center transition-colors",
        dragOver ? "border-primary-500 bg-primary-100" : "border-gray-300",
      )}
    >
      <UploadCloudIcon
        className={cn("size-8", dragOver ? "text-primary-600" : "text-gray-400")}
      />
      <p className="text-sm text-gray-600">
        {selectedFile ? selectedFile.name : dropLabel}
      </p>
      <Button type="button" variant="outline" size="sm" asChild>
        <label className="cursor-pointer">
          {browseLabel}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </Button>
    </div>
  );
};

export default FileDropzone;
