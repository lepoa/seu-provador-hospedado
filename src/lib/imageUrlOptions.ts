/**
 * Transformacao desativada para reduzir custo de "Storage Image Transformations".
 * Mantemos assinatura para evitar quebrar chamadas existentes.
 */
export const getTransformedImageUrl = (url: string, _width: number): string => {
    return url;
};

export const getResponsiveSrcSet = (url: string) => {
    void url;
    return undefined;
};
