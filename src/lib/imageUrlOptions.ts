/**
 * Retorna as URLs transformadas usando os parâmetros nativos do Supabase Storage V2.
 * @param url A URL completa da imagem original retornada pelo Supabase.
 * @param width A largura desejada para redimensionar.
 */
export const getTransformedImageUrl = (url: string, width: number): string => {
    if (!url) return url;

    // Se a url já tiver query params (ex: transformações antigas ou tokens), ajustamos a anexação.
    try {
        let finalUrl = url;
        if (url.includes('/storage/v1/object/public/')) {
            finalUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        }

        const urlObj = new URL(finalUrl);
        if (url.includes('supabase.co')) {
            // Adiciona ou sobrescreve o parâmetro `width` e define o redimensionamento como contido (cover)
            urlObj.searchParams.set('width', width.toString());
            urlObj.searchParams.set('resize', 'contain');
            return urlObj.toString();
        }
    } catch (e) {
        // URL inválida, apenas retorna a original
        return url;
    }
    return url;
};

export const getResponsiveSrcSet = (url: string) => {
    if (!url || !url.includes('supabase.co')) return undefined;

    return `
    ${getTransformedImageUrl(url, 400)} 400w,
    ${getTransformedImageUrl(url, 800)} 800w,
    ${getTransformedImageUrl(url, 1200)} 1200w
  `.trim();
};
