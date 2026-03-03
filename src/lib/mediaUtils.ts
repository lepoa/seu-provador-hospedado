import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
    const options = {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 2000,
        useWebWorker: true,
        fileType: 'image/webp' as const,
        initialQuality: 0.92,
    };

    try {
        const compressedFile = await imageCompression(file, options);
        // browser-image-compression might return a Blob. Ensure it's returned as a File with correct name and type
        return new File([compressedFile], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: "image/webp",
            lastModified: Date.now(),
        });
    } catch (error) {
        console.error("Error compressing image:", error);
        throw error;
    }
};

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

export const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;

    const normalized = normalizeUrl(url);
    if (!normalized) return null;

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const pathSegments = parsed.pathname.split("/").filter(Boolean);

        let id: string | null = null;

        if (host === "youtu.be") {
            id = pathSegments[0] || null;
        } else if (
            host.endsWith("youtube.com") ||
            host.endsWith("youtube-nocookie.com")
        ) {
            if (pathSegments[0] === "watch") {
                id = parsed.searchParams.get("v");
            } else if (["embed", "shorts", "v", "live"].includes(pathSegments[0])) {
                id = pathSegments[1] || null;
            } else if (!pathSegments[0] && parsed.searchParams.get("v")) {
                id = parsed.searchParams.get("v");
            }
        }

        if (id && YOUTUBE_ID_REGEX.test(id)) {
            return id;
        }
    } catch {
        // Fall back to regex parsing below.
    }

    const fallbackMatch = normalized.match(
        /(?:youtube\.com\/(?:watch\?v=|watch\?.+&v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );

    return fallbackMatch?.[1] && YOUTUBE_ID_REGEX.test(fallbackMatch[1])
        ? fallbackMatch[1]
        : null;
};

export const extractVideoId = (url: string): { type: 'youtube' | 'vimeo' | null, id: string | null } => {
    if (!url) return { type: null, id: null };

    const ytId = extractYouTubeId(url);
    if (ytId) {
        return { type: 'youtube', id: ytId };
    }

    const normalized = normalizeUrl(url);
    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const segments = parsed.pathname.split("/").filter(Boolean);

        if (host.endsWith("vimeo.com")) {
            // Supports:
            // - vimeo.com/123456789
            // - player.vimeo.com/video/123456789
            // - vimeo.com/channels/.../123456789
            const numericSegment = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
            if (numericSegment) {
                return { type: 'vimeo', id: numericSegment };
            }
        }
    } catch {
        // Ignore and fall back to regex.
    }

    const vimeoMatch = normalized.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
    if (vimeoMatch?.[1]) {
        return { type: 'vimeo', id: vimeoMatch[1] };
    }

    return { type: null, id: null };
};

export const getEmbedUrl = (videoUrl: string): string | null => {
    const { type, id } = extractVideoId(videoUrl);
    if (type === 'youtube') {
        return `https://www.youtube.com/embed/${id}`;
    }
    if (type === 'vimeo') {
        return `https://player.vimeo.com/video/${id}`;
    }
    // Return the original URL if it's an MP4 from supabase storage
    if (videoUrl.includes('supabase.co')) {
        return videoUrl;
    }
    return null;
};
