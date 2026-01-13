"use client";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * QrScanner - QR code scanner component using html5-qrcode
 * Requests camera permission, scans QR codes, handles errors gracefully
 */
interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  className?: string;
}

export function QrScanner({ onScanSuccess, onClose, className }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"requesting" | "granted" | "denied">("requesting");

  useEffect(() => {
    const startScanning = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        // Request camera permission
        const devices = await Html5Qrcode.getCameras();
        if (devices.length === 0) {
          setError("No camera found. Please use manual entry.");
          setCameraPermission("denied");
          return;
        }

        // Use the first available camera (usually back camera on mobile)
        const cameraId = devices[0].id;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success callback
            onScanSuccess(decodedText);
            stopScanning();
          },
          (errorMessage) => {
            // Error callback - ignore most errors (they're just "no QR code found" messages)
            // Only show actual errors
            if (errorMessage && !errorMessage.includes("NotFoundException")) {
              console.debug("QR scan error:", errorMessage);
            }
          }
        );

        setScanning(true);
        setCameraPermission("granted");
        setError(null);
      } catch (err: any) {
        console.error("QR scanner error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera permission denied. Please allow camera access or use manual entry.");
          setCameraPermission("denied");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No camera found. Please use manual entry.");
          setCameraPermission("denied");
        } else {
          setError(err.message || "Failed to start camera. Please use manual entry.");
          setCameraPermission("denied");
        }
      }
    };

    startScanning();

    return () => {
      stopScanning();
    };
  }, [onScanSuccess]);

  const stopScanning = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setScanning(false);
    }
  };

  return (
    <div className={cn("relative flex flex-col items-center gap-4", className)}>
      <div className="flex w-full items-center justify-between">
        <h3 className="text-lg font-semibold text-beta-navy">Scan QR Code</h3>
        <button
          onClick={() => {
            stopScanning();
            onClose();
          }}
          className="rounded-lg p-2 text-beta-gray hover:bg-beta-navy/10 hover:text-beta-navy"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={onClose}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Use Manual Entry
          </button>
        </div>
      ) : (
        <div className="relative w-full">
          <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-beta-navy">
                Scanning...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

