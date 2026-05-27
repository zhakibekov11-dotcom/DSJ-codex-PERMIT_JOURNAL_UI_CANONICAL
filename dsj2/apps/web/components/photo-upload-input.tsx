"use client";

import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

type PhotoUploadInputProps = {
  name?: string;
  accept?: string;
  disabled?: boolean;
  inputClassName?: string;
  pasteAreaClassName?: string;
  pasteHint?: string;
  onFileSelected?: (file: File | null) => void | Promise<void>;
};

function getClipboardImageFile(items: DataTransferItemList | null | undefined) {
  if (!items) {
    return null;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.type.startsWith("image/")) {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    const extension =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/jpeg"
          ? ".jpg"
          : "";

    return new File([file], file.name || `clipboard-photo${extension}`, {
      type: file.type,
      lastModified: Date.now(),
    });
  }

  return null;
}

export function PhotoUploadInput({
  name,
  accept = "image/jpeg,image/png",
  disabled = false,
  inputClassName,
  pasteAreaClassName,
  pasteHint = "Кликните сюда и вставьте фото из буфера: Ctrl+V / Cmd+V",
  onFileSelected,
}: PhotoUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function syncSelectedFile(file: File | null) {
    if (!inputRef.current) {
      void onFileSelected?.(file);
      return;
    }

    if (file) {
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputRef.current.files = dataTransfer.files;
      } catch {
        // Some browsers may reject programmatic FileList updates.
      }
    } else {
      inputRef.current.value = "";
    }

    void onFileSelected?.(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    syncSelectedFile(event.target.files?.[0] ?? null);
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (disabled) {
      return;
    }

    const file = getClipboardImageFile(event.clipboardData?.items);
    if (!file) {
      return;
    }

    event.preventDefault();
    syncSelectedFile(file);
  }

  function openFilePicker() {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  }

  function handlePasteAreaKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openFilePicker();
  }

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className={inputClassName}
      />
      <div
        tabIndex={disabled ? -1 : 0}
        role="button"
        onPaste={handlePaste}
        onClick={openFilePicker}
        onKeyDown={handlePasteAreaKeyDown}
        className={pasteAreaClassName}
      >
        {pasteHint}
      </div>
    </div>
  );
}
