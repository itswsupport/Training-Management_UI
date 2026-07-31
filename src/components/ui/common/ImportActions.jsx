"use client";

import React, { useRef } from "react";
import { Upload, FileUp } from "lucide-react";

export default function ImportActions({ onImport, acceptedFormats = ".xlsx,.xls,.csv" }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={acceptedFormats}
        className="hidden"
      />
      <button
        onClick={triggerFileInput}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded shadow hover:bg-green-700 transition-colors cursor-pointer"
      >
        <Upload className="w-4 h-4" />
        IMPORT DATA
      </button>
    </div>
  );
}