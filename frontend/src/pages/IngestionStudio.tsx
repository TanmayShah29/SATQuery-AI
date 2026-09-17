import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  Upload,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Satellite,
  Compass,
  Download,
  ExternalLink,
  Loader2,
  Info,
  Sparkles,
  X,
  ShieldCheck,
} from 'lucide-react';
import type { GeoTIFFMetadata } from '../types';
import { SAMPLE_GEOTIFFS } from '../config/tacticalData';
import { uploadDatasetFile, fetchPrecalibratedGeoTIFFs, fetchHealth } from '../services/api';

interface IngestionStudioProps {
  onSelectGeoTIFF: (tiff: GeoTIFFMetadata) => void;
  onClose?: () => void;
}

export const IngestionStudio: React.FC<IngestionStudioProps> = ({ onSelectGeoTIFF, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [samples, setSamples] = useState<GeoTIFFMetadata[]>(SAMPLE_GEOTIFFS);
  const [selectedSample, setSelectedSample] = useState<GeoTIFFMetadata>(SAMPLE_GEOTIFFS[0]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{
    mosdac: { configured: boolean; details?: string };
    bhuvan: { configured: boolean; details?: string };
  }>({
    mosdac: { configured: false },
    bhuvan: { configured: false },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPrecalibratedGeoTIFFs().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSamples(data);
        setSelectedSample(data[0]);
      }
    }).catch((err) => {
      console.warn('Could not load precalibrated GeoTIFFs, falling back to bundled list:', err);
    });

    fetchHealth().then((h) => {
      if (h?.integrations) {
        setIntegrationStatus({
          mosdac: {
            configured: !!h.integrations.mosdac?.configured,
            details: h.integrations.mosdac?.details,
          },
          bhuvan: {
            configured: !!h.integrations.bhuvan_wms?.configured,
            details: h.integrations.bhuvan_wms?.details,
          },
        });
      }
    }).catch(() => {});
  }, []);

  const handleRealUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus(`Uploading ${file.name} to FastAPI GeoTIFFEngine...`);
    setUploadError(null);

    try {
      const res = await uploadDatasetFile(file);
      if (res.status === 'success') {
        const isGeo = res.is_geotiff === true;
        const newTiff: GeoTIFFMetadata = {
          id: `upload-${Date.now()}`,
          fileName: res.filename,
          sensor: res.sensor || (isGeo ? 'Calibrated Raster' : 'Unprojected Image'),
          modality: res.modality || 'single_image',
          gsd: res.gsd || (isGeo ? 'Calibrated GSD' : 'N/A (Unprojected)'),
          crs: res.crs || (isGeo ? 'EPSG:4326' : 'Unprojected / Non-georeferenced'),
          radiometric: `${res.bands_count || 1} Bands (${res.format || 'Raster'})`,
          cloudCoverPercent: res.cloud_cover_pct != null ? res.cloud_cover_pct : null,
          bands: res.bands_descriptions || [`${res.bands_count || 1} Bands`],
          acquiredAt: new Date().toISOString(),
          bbox: res.bbox || null,
          previewUrl: res.preview_url || '',
          locationName: `Uploaded Raster (${res.filename})`,
          isGeotiff: isGeo,
          validationNotes: res.validation_notes || [],
          validationPassed: res.validation_passed ?? true,
        };
        setSamples((prev) => [newTiff, ...prev]);
        setSelectedSample(newTiff);
        onSelectGeoTIFF(newTiff);
        setUploadStatus(
          `Ingestion Verified: ${res.filename} (${res.width}x${res.height}px, ${res.bands_count} bands, CRS: ${res.crs}, GSD: ${res.gsd}).`
        );
      } else {
        setUploadError(res.message || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Geospatial parse error on server.');
    } finally {
      setIsUploading(false);
    }
  };

  const isSelectedGeoreferenced = !!(selectedSample.isGeotiff ?? (selectedSample.crs && !selectedSample.crs.toLowerCase().includes('unprojected')));

  return (
    <div
      id="ingestion-studio-overlay"
      className="absolute top-3 left-3 right-3 sm:right-auto sm:w-[480px] max-h-[calc(100vh-140px)] bg-gradient-to-b from-[#141926]/95 via-[#0D121C]/95 to-[#080B12]/95 backdrop-blur-md border border-[#232F44] rounded-xl shadow-2xl flex flex-col z-20 text-slate-200 select-none overflow-hidden"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tif,.tiff,.geojson,.json,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleRealUpload(e.target.files[0]);
          }
        }}
      />

      {/* Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-b from-[#1A2334] to-[#101624] border-b border-[#202C40] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-100 tracking-wide">
            GEOTIFF / STAC / MOSDAC WORKBENCH
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-bold">
            SIH26167 §3 & §7
          </span>
          {onClose && (
            <button
              type="button"
              id="close-ingestion-studio-btn"
              onClick={onClose}
              title="Close Ingestion Workbench (Esc)"
              className="p-1 rounded hover:bg-[#1E293C] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto">
        {/* Drag and Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleRealUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`p-4 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-[#26344E] hover:border-cyan-500/60 hover:bg-[#0E1522] bg-[#090D15]'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 mx-auto text-cyan-400 mb-1.5 animate-spin" />
          ) : (
            <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1.5" />
          )}
          <div className="text-xs font-mono font-bold text-slate-200">
            {isUploading ? 'Ingesting Raster Headers...' : 'Click to Browse or Drag & Drop GeoTIFF Rasters'}
          </div>
          <p className="text-[10px] text-slate-400 font-sans mt-0.5">
            Real rasterio CRS extraction (WGS84 / UTM), ground resolution calculation, and band alignment.
          </p>
          <div className="mt-2 flex items-center justify-center space-x-2 text-[9px] font-mono text-slate-500">
            <span>Primary: .tif, .geotiff</span>
            <span>•</span>
            <span>Vectors: .geojson</span>
          </div>
        </div>

        {/* Upload Success Alert */}
        {uploadStatus && (
          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {/* Explicit Upload / Format Rejection Alert */}
        {uploadError && (
          <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/60 text-[10px] font-mono text-rose-200 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
              <span>FILE REJECTED BY INGESTION ENGINE</span>
            </div>
            <p className="font-sans text-rose-300/90 leading-snug">{uploadError}</p>
            <div className="pt-1 text-[9px] text-rose-400/80 border-t border-rose-900/60">
              Accepted: GeoTIFF (.tif/.tiff), GeoJSON (.geojson), max 100MB, valid coordinates.
            </div>
          </div>
        )}

        {/* Visible Pre-Query AOI & CRS Validation Panel (Zone A/B requirement) */}
        <div className="p-2.5 rounded-lg bg-[#0A0E16] border border-[#1E283C] space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between pb-1 border-b border-[#1A2333]">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>ACTIVE RASTER VALIDATION PROFILE</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                isSelectedGeoreferenced
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-950 text-amber-300 border-amber-500/40'
              }`}
            >
              {isSelectedGeoreferenced ? 'GEOREFERENCED' : 'UNPROJECTED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div>
              <span className="text-slate-500 block">CRS PROJECTION:</span>
              <span className="text-slate-200 font-bold">{selectedSample.crs || 'Unprojected'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">GROUND RESOLUTION:</span>
              <span className="text-slate-200 font-bold">{selectedSample.gsd || 'Uncalibrated'}</span>
            </div>
          </div>

          <div className="text-[10px] pt-1">
            <span className="text-slate-500 block">AOI BOUNDING BOX (WGS84):</span>
            <span className="text-cyan-300 font-bold">
              {selectedSample.bbox && Array.isArray(selectedSample.bbox)
                ? `[${selectedSample.bbox.map((n) => (typeof n === 'number' ? n.toFixed(4) : n)).join(', ')}]`
                : 'No spatial bounds (Image-space inference only)'}
            </span>
          </div>

          {selectedSample.validationNotes && selectedSample.validationNotes.length > 0 && (
            <div className="pt-1 border-t border-[#161F2E] space-y-0.5">
              {selectedSample.validationNotes.map((note, i) => (
                <div key={i} className="text-[9px] text-slate-400 flex items-start space-x-1">
                  <span className="text-cyan-400">•</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indian Sovereign Connections Status (Verified Backend Integration Check) */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded bg-[#0A0E16] border border-[#1E283C] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-200">ISRO SAC MOSDAC</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  integrationStatus.mosdac.configured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>
            <div className="text-[9px] text-slate-400">Tool: `scripts/sync_mosdac.py`</div>
            <div
              className={`text-[9px] font-bold ${
                integrationStatus.mosdac.configured ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {integrationStatus.mosdac.configured ? 'CONFIGURED (INSAT-3DR)' : 'STANDBY (Scripted Sync)'}
            </div>
          </div>
          <div className="p-2 rounded bg-[#0A0E16] border border-[#1E283C] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-200">ISRO Bhuvan WMS</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  integrationStatus.bhuvan.configured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>
            <div className="text-[9px] text-slate-400">Key: `backend/.env` (NRSC)</div>
            <div
              className={`text-[9px] font-bold ${
                integrationStatus.bhuvan.configured ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {integrationStatus.bhuvan.configured ? 'CONFIGURED (LULC Theme)' : 'NOT CONFIGURED (.env key)'}
            </div>
          </div>
        </div>

        {/* Pre-Calibrated Tactical GeoTIFF Catalog */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
            Pre-Calibrated Sovereign Rasters (Click to Ingest)
          </span>

          <div className="space-y-1">
            {samples.map((tiff) => (
              <div
                key={tiff.id}
                onClick={() => {
                  setSelectedSample(tiff);
                  onSelectGeoTIFF(tiff);
                }}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedSample.id === tiff.id
                    ? 'bg-[#172234] border-cyan-500/60 shadow-sm'
                    : 'bg-[#0A0E16] hover:bg-[#111824] border-[#1C2638]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-slate-100">{tiff.fileName}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#070A10] border border-[#1E283C] text-cyan-300">
                    {tiff.sensor}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 mt-1 text-[9px] font-mono text-slate-400">
                  <div>CRS: <span className="text-slate-300">{tiff.crs}</span></div>
                  <div>GSD: <span className="text-slate-300">{tiff.gsd}</span></div>
                  <div>Cloud: <span className="text-slate-300">{tiff.cloudCoverPercent != null ? `${tiff.cloudCoverPercent}%` : 'N/A'}</span></div>
                </div>

                <div className="mt-1 text-[9px] font-mono text-slate-500 truncate">
                  Bands: {tiff.bands.join(', ')} | Acquired: {tiff.acquiredAt}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
