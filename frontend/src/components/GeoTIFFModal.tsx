import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileCode2,
  CheckCircle2,
  Layers,
  Compass,
  Zap,
  Globe,
  Maximize2,
  Radar,
  Eye,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { GeoTIFFMetadata, ModalityMode } from '../types';
import { SAMPLE_GEOTIFFS } from '../config/tacticalData';
import { uploadDatasetFile, fetchPrecalibratedGeoTIFFs } from '../services/api';

interface GeoTIFFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGeoTIFF: (tiff: GeoTIFFMetadata) => void;
}

export const GeoTIFFModal: React.FC<GeoTIFFModalProps> = ({
  isOpen,
  onClose,
  onSelectGeoTIFF,
}) => {
  const [tiffs, setTiffs] = useState<GeoTIFFMetadata[]>(SAMPLE_GEOTIFFS);
  const [selectedTiff, setSelectedTiff] = useState<GeoTIFFMetadata>(SAMPLE_GEOTIFFS[0]);
  const [dragActive, setDragActive] = useState(false);
  const [customUploadName, setCustomUploadName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPrecalibratedGeoTIFFs().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setTiffs(data);
        setSelectedTiff(data[0]);
      }
    }).catch((err) => {
      console.warn('GeoTIFF precalibration load fallback:', err);
    });
  }, []);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setCustomUploadName(file.name);
    setIsUploading(true);
    setUploadStatusMsg('Analyzing geospatial headers and uploading...');

    try {
      const res = await uploadDatasetFile(file);
      if (res.file_type === 'geojson') {
        const customTiff: GeoTIFFMetadata = {
          id: `upload-${Date.now()}`,
          fileName: file.name,
          sensor: 'Cartosat-2S',
          modality: 'single_image',
          gsd: 'Vector Geometry',
          crs: 'EPSG:4326',
          radiometric: 'GeoJSON FeatureCollection',
          cloudCoverPercent: 0,
          bands: ['Vector Polygons', `${res.features_count} Features`],
          acquiredAt: new Date().toISOString(),
          bbox: res.bbox || [72.48, 23.00, 72.54, 23.05],
          previewUrl: '',
          locationName: `Imported Vector (${file.name})`,
        };
        setSelectedTiff(customTiff);
        setTiffs((prev) => [customTiff, ...prev]);
        setUploadStatusMsg(`Parsed ${res.features_count} features successfully.`);
      } else {
        const isSar = file.name.toLowerCase().includes('sar') || file.name.toLowerCase().includes('s1');
        const customTiff: GeoTIFFMetadata = {
          id: `upload-${Date.now()}`,
          fileName: res.filename || file.name,
          sensor: res.sensor || (isSar ? 'Synthetic Aperture Radar (SAR C-Band)' : 'Sentinel-2 MSI / Cartosat-2S'),
          modality: res.modality || (isSar ? 'cross_modal' : 'single_image'),
          gsd: res.gsd || 'Calibrated GSD',
          crs: res.crs || 'EPSG:4326',
          radiometric: `${res.bands_count || 1} Bands (${res.format || 'GeoTIFF'})`,
          cloudCoverPercent: 0.0,
          bands: res.bands_descriptions || (isSar ? ['C-SAR VV', 'C-SAR VH'] : ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B8 (NIR)']),
          acquiredAt: new Date().toISOString(),
          bbox: res.bbox || [72.50, 23.01, 72.54, 23.04],
          previewUrl: res.preview_url || '',
          locationName: `Uploaded Raster (${res.filename || file.name})`,
        };
        setSelectedTiff(customTiff);
        setTiffs((prev) => [customTiff, ...prev]);
        setUploadStatusMsg(`Calibrated ${res.width || 512}x${res.height || 512}px raster ready.`);
      }
    } catch (err: any) {
      setUploadStatusMsg(`Upload error: ${err?.message || 'Server error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  return (
    <div
      id="geotiff-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
      onClick={onClose}
    >
      <div
        id="geotiff-modal-container"
        className="w-full max-w-4xl bg-gradient-to-b from-[#151A26] to-[#0D1018] border border-[#232B3E] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#202838] bg-gradient-to-b from-[#182030] to-[#111622]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-[#161D2C] border border-[#26334A] text-slate-300">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-100 font-mono tracking-wide">
                  GeoTIFF / TIFF Production GIS Ingestion Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-gradient-to-b from-[#20293C] to-[#151B27] text-slate-300 border border-slate-500/40">
                  SIH26167 MANDATORY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingest calibrated multispectral (VNIR/SWIR) & Synthetic Aperture Radar (SAR) raster assets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2536] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Pre-Loaded ISRO / ESA Sample Chips + Upload */}
          <div className="lg:col-span-5 space-y-4">
            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-all ${
                dragActive
                  ? 'border-slate-400 bg-[#1A2232]'
                  : 'border-[#232B3E] hover:border-slate-500/60 bg-gradient-to-b from-[#141924] to-[#0E121B]'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-200">
                Drop GeoTIFF (.tif / .tiff) here
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Supports GeoTIFF with embedded CRS tags, multi-band rasters, or benchmark pairs.
              </p>
              <label className="mt-3 inline-block px-3 py-1.5 rounded-md bg-gradient-to-b from-[#1E2738] to-[#141A25] hover:from-[#263147] hover:to-[#18202D] border border-[#2C3B54] text-xs font-mono text-slate-200 cursor-pointer transition-colors shadow-sm">
                {isUploading ? 'Uploading...' : 'Browse Files'}
                <input
                  type="file"
                  accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg,.geojson,.json"
                  onChange={handleFileInput}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {isUploading && (
                <div className="mt-3 p-2 rounded-md bg-[#131A26] border border-[#24344E] text-[11px] text-blue-300 font-mono flex items-center justify-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              {customUploadName && !isUploading && (
                <div className="mt-3 p-2 rounded-md bg-[#131E1E] border border-[#224036] text-[11px] text-emerald-300 font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{uploadStatusMsg || `Loaded: ${customUploadName}`}</span>
                </div>
              )}
            </div>

            {/* Preloaded Dataset Chips */}
            <div>
              <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider">
                Select Calibrated Evaluation Raster:
              </div>
              <div className="space-y-2">
                {tiffs.map((tiff) => {
                  const isSelected = selectedTiff.id === tiff.id;
                  return (
                    <div
                      key={tiff.id}
                      onClick={() => setSelectedTiff(tiff)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#1F2B3E] to-[#151D2B] border-slate-400/60 shadow-md'
                          : 'bg-gradient-to-b from-[#141924] to-[#0E121B] border-[#202838] hover:border-slate-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{tiff.locationName}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[220px]">
                            {tiff.fileName}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#0D1118] text-slate-300 border border-[#242D3D]">
                          {tiff.sensor}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-3 text-[10px] font-mono text-slate-400">
                        <span>GSD: {tiff.gsd.split(' ')[0]}</span>
                        <span>•</span>
                        <span>Cloud: {tiff.cloudCoverPercent}%</span>
                        <span>•</span>
                        <span className="capitalize">{tiff.modality.replace('_', ' ')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata Inspector */}
          <div className="lg:col-span-7 bg-gradient-to-b from-[#141924] to-[#0E121B] border border-[#202838] rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#202838]">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Selected Raster Asset</span>
                  <h3 className="text-sm font-semibold text-slate-100 font-mono">{selectedTiff.fileName}</h3>
                </div>
                <span className="px-2 py-1 rounded bg-[#171E2C] border border-[#252E40] text-slate-300 font-mono text-[10px]">
                  {selectedTiff.sensor}
                </span>
              </div>

              {/* Grid Metadata Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-[#10141E] border border-[#1F2736]">
                  <div className="text-[10px] text-slate-500 font-mono">GROUND SAMPLING DISTANCE (GSD)</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{selectedTiff.gsd}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#10141E] border border-[#1F2736]">
                  <div className="text-[10px] text-slate-500 font-mono">COORDINATE REFERENCE SYSTEM (CRS)</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{selectedTiff.crs}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#10141E] border border-[#1F2736]">
                  <div className="text-[10px] text-slate-500 font-mono">RADIOMETRIC RESOLUTION</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{selectedTiff.radiometric}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#10141E] border border-[#1F2736]">
                  <div className="text-[10px] text-slate-500 font-mono">CLOUD COVER OBSTRUCTION</div>
                  <div className="text-xs font-semibold text-slate-300 mt-0.5">
                    {selectedTiff.cloudCoverPercent}%
                    {selectedTiff.cloudCoverPercent > 80 && (
                      <span className="ml-1.5 text-[10px] text-slate-400 font-mono">(SAR Recommended)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Spectral Bands & Polarizations */}
              <div className="p-3 rounded-lg bg-[#10141E] border border-[#1F2736]">
                <div className="text-[10px] text-slate-500 font-mono uppercase mb-1.5">
                  Spectral Bands & Polarization Config
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTiff.bands.map((band, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-[#0A0D14] border border-[#20293A] text-[10px] font-mono text-slate-300"
                    >
                      {band}
                    </span>
                  ))}
                  {selectedTiff.polarization && (
                    <span className="px-2 py-0.5 rounded bg-[#0A0D14] border border-[#20293A] text-[10px] font-mono text-slate-300">
                      {selectedTiff.polarization}
                    </span>
                  )}
                </div>
              </div>

              {/* Bounding Coordinates */}
              <div className="p-3 rounded-lg bg-[#10141E] border border-[#1F2736] font-mono text-xs text-slate-300">
                <div className="text-[10px] text-slate-500 uppercase mb-1">Evaluated Bounding Box (WGS84)</div>
                <div className="text-[11px] text-slate-200">
                  [{selectedTiff.bbox.join(', ')}]
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Acquired: {selectedTiff.acquiredAt}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-5 pt-3 border-t border-[#202838] flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#161B24] hover:bg-[#1E2533] border border-[#263042] text-xs font-mono text-slate-300 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  onSelectGeoTIFF(selectedTiff);
                  onClose();
                }}
                className="px-5 py-2 rounded-lg bg-gradient-to-b from-[#2A5288] to-[#1E3B63] hover:from-[#3564A3] hover:to-[#254A7C] border border-blue-400/30 text-xs font-mono text-white font-semibold transition-all shadow-sm flex items-center space-x-2 active:from-[#1A3457] active:to-[#142844]"
              >
                <span>INGEST RASTER & SET TARGET</span>
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
