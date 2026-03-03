import { cn } from "@/lib/utils";
import { getResponsiveSrcSet, getTransformedImageUrl } from "@/lib/imageUrlOptions";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean;
    defaultWidth?: number;
}

export function OptimizedImage({
    src,
    alt,
    className,
    priority = false,
    defaultWidth = 800,
    ...props
}: OptimizedImageProps) {
    const srcSet = getResponsiveSrcSet(src);
    const defaultSrc = srcSet ? getTransformedImageUrl(src, defaultWidth) : src;

    return (
        <img
            {...props}
            src={defaultSrc}
            srcSet={srcSet}
            sizes={props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
            alt={alt || "Imagem do produto"}
            className={cn("object-cover", className)}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            // @ts-ignore - React team expects fetchPriority but typical prop syntax is string
            fetchPriority={priority ? "high" : "auto"}
        />
    );
}
