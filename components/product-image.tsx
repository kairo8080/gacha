"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Image from "next/image";
import { Package } from "@/components/pixel-icons";
import type { StockPrize } from "@/lib/catalog";
import { resolveProductImagePath } from "@/lib/product-images";

const ProductImagesContext = createContext<readonly string[]>([]);

export function ProductImagesProvider({
  paths,
  children,
}: {
  paths: string[];
  children: ReactNode;
}) {
  return (
    <ProductImagesContext.Provider value={paths}>
      {children}
    </ProductImagesContext.Provider>
  );
}

export default function ProductImage({
  prize,
  className = "",
}: {
  prize: StockPrize;
  className?: string;
}) {
  const available = useContext(ProductImagesContext);
  const source = resolveProductImagePath(prize, available);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span className={`product-image ${className}`}>
      {source && source !== failedSource ? (
        <Image
          src={source}
          alt={`${prize.name} · English product photo`}
          width={48}
          height={48}
          sizes="48px"
          loading="lazy"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span
          className="product-image-missing"
          role="img"
          aria-label={`Photo needed for ${prize.name}`}
        >
          <Package size={19} />
          <small>NO PHOTO</small>
        </span>
      )}
    </span>
  );
}
