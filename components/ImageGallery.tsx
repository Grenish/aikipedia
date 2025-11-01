"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

interface ImageGalleryProps {
  images: string[];
  title: string;
  imageColors: string[];
}

export function ImageGallery({
  images,
  title,
  imageColors,
}: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  const openImage = (index: number) => {
    if (images[index]) {
      setSelectedImageIndex(index);
      document.body.style.overflow = "hidden";
    }
  };

  const closeImage = () => {
    setSelectedImageIndex(null);
    document.body.style.overflow = "unset";
  };

  const goToNext = useCallback(() => {
    if (selectedImageIndex !== null) {
      const nextIndex = (selectedImageIndex + 1) % images.length;
      // Skip empty images
      let attempts = 0;
      let checkIndex = nextIndex;
      while (!images[checkIndex] && attempts < images.length) {
        checkIndex = (checkIndex + 1) % images.length;
        attempts++;
      }
      if (images[checkIndex]) {
        setSelectedImageIndex(checkIndex);
      }
    }
  }, [selectedImageIndex, images]);

  const goToPrevious = useCallback(() => {
    if (selectedImageIndex !== null) {
      const prevIndex =
        selectedImageIndex === 0 ? images.length - 1 : selectedImageIndex - 1;
      // Skip empty images
      let attempts = 0;
      let checkIndex = prevIndex;
      while (!images[checkIndex] && attempts < images.length) {
        checkIndex = checkIndex === 0 ? images.length - 1 : checkIndex - 1;
        attempts++;
      }
      if (images[checkIndex]) {
        setSelectedImageIndex(checkIndex);
      }
    }
  }, [selectedImageIndex, images]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;

      if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "Escape") {
        closeImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageIndex, goToNext, goToPrevious]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 grid-rows-2 gap-2 sm:gap-4 h-[300px] sm:h-[400px] md:h-[500px]">
        {/* Main large image */}
        <button
          onClick={() => openImage(0)}
          className="col-span-2 row-span-2 rounded-2xl overflow-hidden bg-muted relative cursor-pointer group transition-transform hover:scale-[1.02]"
        >
          {images[0] ? (
            <>
              <Image
                src={images[0]}
                alt={title}
                fill
                className="object-cover transition-opacity group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  View
                </span>
              </div>
            </>
          ) : (
            <div
              className={`w-full h-full bg-linear-to-br ${imageColors[0]}`}
            ></div>
          )}
        </button>

        {/* Top right image */}
        <button
          onClick={() => openImage(1)}
          className="hidden sm:block col-span-2 row-span-1 rounded-2xl overflow-hidden bg-muted relative cursor-pointer group transition-transform hover:scale-[1.02]"
        >
          {images[1] ? (
            <>
              <Image
                src={images[1]}
                alt={title}
                fill
                className="object-cover transition-opacity group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  View
                </span>
              </div>
            </>
          ) : (
            <div
              className={`w-full h-full bg-linear-to-br ${imageColors[1]}`}
            ></div>
          )}
        </button>

        {/* Bottom right first image */}
        <button
          onClick={() => openImage(2)}
          className="hidden sm:block col-span-1 row-span-1 rounded-2xl overflow-hidden bg-muted relative cursor-pointer group transition-transform hover:scale-[1.02]"
        >
          {images[2] ? (
            <>
              <Image
                src={images[2]}
                alt={title}
                fill
                className="object-cover transition-opacity group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  View
                </span>
              </div>
            </>
          ) : (
            <div
              className={`w-full h-full bg-linear-to-br ${imageColors[2]}`}
            ></div>
          )}
        </button>

        {/* Bottom right second image */}
        <button
          onClick={() => openImage(3)}
          className="hidden sm:block col-span-1 row-span-1 rounded-2xl overflow-hidden bg-muted relative cursor-pointer group transition-transform hover:scale-[1.02]"
        >
          {images[3] ? (
            <>
              <Image
                src={images[3]}
                alt={title}
                fill
                className="object-cover transition-opacity group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  View
                </span>
              </div>
            </>
          ) : (
            <div
              className={`w-full h-full bg-linear-to-br ${imageColors[3]}`}
            ></div>
          )}
        </button>
      </div>

      {/* Fullscreen Image Viewer */}
      {selectedImageIndex !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/95 animate-in fade-in duration-300"
            onClick={closeImage}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full"
                onClick={closeImage}
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Previous Button */}
              {images.filter(Boolean).length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-50 text-white hover:bg-white/20 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              )}

              {/* Image */}
              {images[selectedImageIndex] && (
                <div
                  className="relative w-full h-full flex items-center justify-center p-12"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={images[selectedImageIndex]}
                    alt={`${title} - Image ${selectedImageIndex + 1}`}
                    fill
                    className="object-contain"
                    quality={100}
                  />
                </div>
              )}

              {/* Next Button */}
              {images.filter(Boolean).length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-50 text-white hover:bg-white/20 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              )}

              {/* Image Counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                {selectedImageIndex + 1} / {images.filter(Boolean).length}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
