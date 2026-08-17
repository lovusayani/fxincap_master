import React, { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";

type OfferBanner = {
    id: number;
    imageUrl: string;
    title: string | null;
    subtitle: string | null;
    linkUrl: string | null;
};

/**
 * Promotional hero shown under the market ticker.
 *
 * Content is managed by admins (Admin → Offers) and read from the public
 * GET /api/offers. Renders nothing at all when there are no active banners, so
 * an empty offer list leaves no gap on the dashboard.
 */
export function OfferHero() {
    const [banners, setBanners] = useState<OfferBanner[]>([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        let disposed = false;
        fetch(apiUrl("/api/offers"))
            .then((res) => (res.ok ? res.json() : null))
            .then((payload) => {
                if (disposed) return;
                const rows = Array.isArray(payload?.data) ? payload.data : [];
                setBanners(rows);
            })
            .catch(() => {
                // Promotional content is optional — stay silent and render nothing.
            });
        return () => {
            disposed = true;
        };
    }, []);

    // Rotate only when there is more than one banner.
    useEffect(() => {
        if (banners.length < 2) return;
        const timer = window.setInterval(() => {
            setIndex((i) => (i + 1) % banners.length);
        }, 6000);
        return () => window.clearInterval(timer);
    }, [banners.length]);

    const current = useMemo(() => banners[index] ?? null, [banners, index]);

    if (!current) return null;

    const body = (
        <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 sm:h-36 lg:h-44">
            <img
                src={apiUrl(current.imageUrl)}
                alt={current.title || "Offer"}
                className="h-full w-full object-cover"
                loading="lazy"
            />
            {(current.title || current.subtitle) && (
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
                    {current.title && (
                        <p className="text-sm font-bold leading-tight text-white sm:text-lg">{current.title}</p>
                    )}
                    {current.subtitle && (
                        <p className="text-[11px] text-gray-200 sm:text-xs">{current.subtitle}</p>
                    )}
                </div>
            )}

            {banners.length > 1 && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            onClick={(event) => {
                                // The dots sit inside the link wrapper; don't navigate on click.
                                event.preventDefault();
                                event.stopPropagation();
                                setIndex(i);
                            }}
                            aria-label={`Show offer ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                                i === index ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    if (!current.linkUrl) return body;

    const isExternal = /^https?:\/\//i.test(current.linkUrl);
    return (
        <a
            href={current.linkUrl}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="block"
        >
            {body}
        </a>
    );
}
