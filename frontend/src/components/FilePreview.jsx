import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon 
} from 'lucide-react';

export default function FilePreview({ fileUrl, fileName, mimeType }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  if (!fileUrl) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-100/70 border border-dashed border-slate-300 rounded-lg p-6 text-slate-400">
        <FileText className="w-12 h-12 stroke-[1.2] text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-500">No document attached</p>
        <p className="text-xs text-slate-400">Document preview will appear here</p>
      </div>
    );
  }

  const isPdf = fileUrl.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-sm">
      {/* Viewer Toolbar */}
      <div className="h-11 bg-slate-800 border-b border-slate-700 px-3 flex items-center justify-between text-xs text-slate-200 select-none">
        <div className="flex items-center gap-2 truncate max-w-[240px]">
          {isPdf ? (
            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate font-mono text-[11px] text-slate-300" title={fileName || fileUrl}>
            {fileName || fileUrl.split('/').pop()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isPdf && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 text-slate-400 min-w-[40px] text-center">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors ml-1"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-1 hover:bg-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition-colors"
                title="Reset View"
              >
                Reset
              </button>
            </>
          )}

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors ml-1"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Viewer Body */}
      <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 relative min-h-[350px]">
        {isPdf ? (
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full min-h-[500px] border-0 rounded bg-white"
            title="Bill PDF Viewer"
          />
        ) : (
          <div className="transition-transform duration-150 flex items-center justify-center">
            <img
              src={fileUrl}
              alt="Uploaded Bill"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              className="rounded shadow-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
