import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://lepoa.com.br";

export const Sitemap = () => {
    useEffect(() => {
        const generateSitemap = async () => {
            try {
                const { data: products, error } = await supabase
                    .from("product_catalog")
                    .select("id, updated_at")
                    .eq("is_active", true);

                if (error) throw error;

                const currentDate = new Date().toISOString();

                const staticPages = [
                    "",
                    "/catalogo",
                    "/meu-estilo",
                    "/quiz",
                ];

                let sitemapData = `<?xml version="1.0" encoding="UTF-8"?>\n`;
                sitemapData += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

                for (const page of staticPages) {
                    sitemapData += `  <url>\n`;
                    sitemapData += `    <loc>${SITE_URL}${page}</loc>\n`;
                    sitemapData += `    <lastmod>${currentDate}</lastmod>\n`;
                    sitemapData += `    <changefreq>daily</changefreq>\n`;
                    sitemapData += `    <priority>${page === "" ? "1.0" : "0.8"}</priority>\n`;
                    sitemapData += `  </url>\n`;
                }

                if (products) {
                    for (const product of products) {
                        const lastMod = product.updated_at ? new Date(product.updated_at).toISOString() : currentDate;
                        sitemapData += `  <url>\n`;
                        sitemapData += `    <loc>${SITE_URL}/produto/${product.id}</loc>\n`;
                        sitemapData += `    <lastmod>${lastMod}</lastmod>\n`;
                        sitemapData += `    <changefreq>weekly</changefreq>\n`;
                        sitemapData += `    <priority>0.7</priority>\n`;
                        sitemapData += `  </url>\n`;
                    }
                }

                sitemapData += `</urlset>`;

                // Emite o conteúdo para a janela diretamente substituindo o HTML padrão do react
                document.open("text/xml");
                document.write(sitemapData);
                document.close();
            } catch (error) {
                console.error("Erro ao gerar sitemap:", error);
                document.body.innerHTML = "Erro ao gerar sitemap";
            }
        };

        generateSitemap();
    }, []);

    return null;
};
