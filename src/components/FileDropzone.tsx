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
  onInvalidFile?: (fileName: string) => void;
};

const FileDropzone: FC<FileDropzoneProps> = ({
  accept,
  selectedFile,
  onFileChange,
  dropLabel,
  browseLabel,
  onInvalidFile,
}) => {
  const { dragOver, onDragOver, onDragLeave, setDragOver } = useDragAndDrop();

  const isFileAccepted = (file: File): boolean => {
    const extensions = accept.split(",").map((ext) => ext.trim().toLowerCase());
    return extensions.some(
      (ext) =>
        (ext.startsWith(".") && file.name.toLowerCase().endsWith(ext)) ||
        (!ext.startsWith(".") && file.type === ext),
    );
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (isFileAccepted(file)) {
      onFileChange(file);
    } else {
      onInvalidFile?.(file.name);
      onFileChange(null);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
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
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </Button>
    </div>
  );
};

export default FileDropzone;
