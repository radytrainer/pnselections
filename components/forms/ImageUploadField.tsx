"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  value,
  onChange,
  fallback,
  accept,
  hint,
  upload,
  avatarClassName,
}: {
  value: string;
  onChange: (url: string) => void;
  fallback: string;
  accept: string;
  hint: string;
  upload: (file: File) => Promise<string>;
  avatarClassName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    try {
      const url = await upload(file);
      onChange(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className={cn("size-16", avatarClassName)}>
        <AvatarImage src={value || undefined} alt="" />
        <AvatarFallback className="text-base">{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="size-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
