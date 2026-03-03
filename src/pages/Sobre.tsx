import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { Diamond, CheckCircle2, Heart, Sparkles } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

const Sobre = () => {
    return (
        <div className="min-h-screen flex flex-col bg-[#f8f3e8] text-[#151515] overflow-x-hidden">
            <Helmet>
                <title>Nossa História | Le.Poá Moda Feminina Elegante</title>
                <meta
                    name="description"
                    content="Conheça a história da Le.Poá, marca de moda feminina elegante criada para mulheres modernas que valorizam sofisticação e identidade."
                />
                <link rel="canonical" href="https://lepoa.com.br/sobre" />
                <meta property="og:title" content="Nossa História | Le.Poá Moda Feminina Elegante" />
                <meta property="og:description" content="Conheça a história da Le.Poá, marca de moda feminina elegante criada para mulheres modernas que valorizam sofisticação e identidade." />
                <meta property="og:type" content="website" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "ClothingStore",
                        "name": "Le.Poá",
                        "url": "https://lepoa.com.br",
                        "logo": "https://lepoa.com.br/logo.png",
                        "founders": [
                            {
                                "@type": "Person",
                                "name": "Laís Torres"
                            },
                            {
                                "@type": "Person",
                                "name": "Ana Carolina"
                            }
                        ],
                        "foundingDate": "2018",
                        "description": "Marca de moda feminina elegante para mulheres modernas que valorizam sofisticação e identidade."
                    })}
                </script>
            </Helmet>

            <BenefitsBar />
            <Header />

            {/* HERO SECTION DE HISTÓRIA */}
            <section className="bg-[#11251f] py-20 md:py-32 relative flex items-center justify-center text-center overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#b28a40] to-transparent"></div>
                <div className="relative z-10 container mx-auto px-5">
                    <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#b28a40]">
                        <Diamond className="h-4 w-4" />
                        A Essência da Le.Poá
                    </span>
                    <h1 className="font-serif text-4xl md:text-6xl font-bold leading-tight text-[#f8f3e8] max-w-4xl mx-auto">
                        Nossa História
                    </h1>
                </div>
            </section>

            <main className="container mx-auto px-5 py-16 md:py-24 max-w-5xl font-serif text-lg leading-relaxed text-[#322f29]">

                {/* INTRODUÇÃO */}
                <div className="grid md:grid-cols-2 gap-12 md:gap-20 mb-24 items-center">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-[#11251f] mb-8 relative inline-block">
                            Nasceu de um desejo maior
                            <span className="absolute -bottom-2 left-0 w-24 h-1 bg-[#b28a40]"></span>
                        </h2>
                        <div className="space-y-6 text-xl text-[#11251f]/90 leading-relaxed font-light">
                            <p>A Le.Poá nasceu do desejo de construir algo maior do que uma loja.</p>
                            <p>Nasceu da intenção de traduzir elegância em experiência.</p>
                            <p>Acreditamos que vestir-se bem não é vaidade — é posicionamento. É presença. É identidade.</p>
                            <p className="text-lg font-normal text-[#11251f]">
                                Desde o início, nossa missão foi clara: oferecer moda feminina elegante para mulheres modernas que valorizam sofisticação, praticidade e autenticidade.
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -inset-4 border border-[#d8c4a0]/40 rounded-2xl -z-10 translate-x-2 translate-y-2"></div>
                        <OptimizedImage
                            src="/lovable-uploads/lepoa-fachada-noturna.jpg"
                            alt="Fachada iluminada da loja física Le.Poá à noite."
                            className="w-full aspect-square rounded-2xl shadow-xl object-cover"
                        />
                    </div>
                </div>

                {/* COMO TUDO COMEÇOU COM FOTO DAS FUNDADORAS */}
                <section className="mb-24">
                    <div className="bg-white p-10 md:p-20 rounded-3xl border border-[#d8c4a0]/50 shadow-[0_20px_60px_rgba(17,37,31,0.04)]">
                        <div className="max-w-3xl mx-auto text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-8">Como tudo começou</h2>
                            <p className="text-xl font-light mb-8">
                                A Le.Poá foi fundada por Laís Torres e Ana Carolina, duas mulheres com olhares complementares e uma visão em comum: transformar a forma como a moda feminina é vivida.
                            </p>
                        </div>

                        {/* FOTO INSTITUCIONAL DAS FUNDADORAS - HORIZONTAL (via crop) */}
                        <div className="mb-12 relative group">
                            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl shadow-2xl border-4 border-white">
                                <OptimizedImage
                                    src="/lovable-uploads/lepoa-founders-paris.jpg"
                                    alt="Laís Torres e Ana Carolina, fundadoras da Le.Poá, marca de moda feminina elegante."
                                    className="w-full h-full object-cover object-center scale-100 group-hover:scale-105 transition-transform duration-[3000ms]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#11251f]/40 to-transparent"></div>
                            </div>
                            <p className="mt-4 text-center text-sm font-medium uppercase tracking-widest text-[#a37d38] italic">
                                Laís Torres e Ana Carolina — fundadoras da Le.Poá.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10 md:gap-16 text-lg font-light leading-relaxed">
                            <div className="space-y-4">
                                <p><strong>Laís</strong>, formada em Design de Moda com especialização pelo Instituto Marangoni em Paris, traz o olhar criativo, estratégico e editorial.</p>
                                <p><strong>Ana Carolina</strong>, com perfil analítico e detalhista, constrói a base sólida que sustenta cada decisão.</p>
                            </div>
                            <div className="space-y-4">
                                <p>Mas a Le.Poá sempre foi maior do que duas fundadoras.</p>
                                <p className="text-[#11251f] font-serif italic text-2xl py-4 border-y border-[#d8c4a0]/30">"Ela nasceu para ser referência."</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* EVOLUÇÃO E REINVENÇÃO */}
                <div className="mb-24 space-y-12">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-bold text-[#11251f] whitespace-nowrap">Evolução e Reinvenção</h2>
                        <div className="h-px bg-[#d8c4a0]/50 w-full"></div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-10">
                        <div className="md:col-span-2 space-y-6">
                            <p>Ao longo dos anos, crescemos, expandimos, enfrentamos desafios e nos reinventamos.</p>
                            <p>Entendemos que elegância não é tendência passageira — é construção contínua.</p>
                            <p>A Le.Poá amadureceu sua identidade, refinou sua curadoria e consolidou um posicionamento claro: luxo contemporâneo acessível, com personalidade e propósito.</p>
                            <p><strong>Cada coleção reflete essa evolução.</strong></p>
                        </div>
                        <div className="flex items-center justify-center">
                            <Sparkles className="h-32 w-32 text-[#b28a40]/30 stroke-1" />
                        </div>
                    </div>
                </div>

                {/* NOSSO DIFERENCIAL */}
                <section className="mb-24 bg-[#11251f] text-[#f8f3e8] p-10 md:p-20 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                        <Diamond className="h-64 w-64" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-10">Nosso Diferencial</h2>
                        <div className="grid md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <p className="text-xl font-light">O que torna a Le.Poá única não é apenas o produto. É a curadoria.</p>
                                <p>Selecionamos peças com rigor técnico:</p>
                                <ul className="space-y-3">
                                    {["Modelagem estruturada", "Tecidos nobres", "Caimento impecável", "Versatilidade estratégica"].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-[#b28a40]" />
                                            <span className="font-medium">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-6 border-l border-[#b28a40]/30 pl-10">
                                <p>Somos pioneiras na experiência de <strong>Live Shop</strong> como forma transparente e próxima de apresentar cada peça.</p>
                                <p className="text-lg">Aqui, você não compra apenas roupas femininas sofisticadas. Você constrói <strong>presença</strong>.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* NOSSA VISÃO */}
                <section className="mb-24 text-center max-w-3xl mx-auto">
                    <Heart className="h-10 w-10 text-[#b28a40] mx-auto mb-8" />
                    <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-8">Nossa Visão</h2>
                    <div className="space-y-8 text-xl font-light">
                        <p>Acreditamos que elegância é silenciosa, mas memorável.</p>
                        <p>Não está no excesso. Está na intenção.</p>
                        <p>A Le.Poá veste mulheres que lideram, que trabalham, que vivem intensamente — e que entendem que o vestir é uma extensão da sua força.</p>
                    </div>
                </section>

                {/* ENCERRAMENTO */}
                <section className="py-20 border-t border-[#d8c4a0]/40 text-center">
                    <h2 className="text-2xl md:text-3xl font-serif italic mb-6 text-[#11251f]">
                        Se você valoriza identidade, sofisticação e propósito, você já entende a essência da Le.Poá.
                    </h2>
                    <p className="text-lg mb-12 font-light">Explore nossa coleção e descubra a elegância que permanece.</p>
                    <Link to="/catalogo">
                        <button className="rounded-md border border-[#b8944e] bg-[#11251f] px-12 py-5 text-sm font-medium uppercase tracking-[0.3em] text-[#f3e5c1] transition-transform hover:scale-105 active:scale-95 duration-300">
                            Conheça a Coleção
                        </button>
                    </Link>
                </section>

            </main>

            <footer className="border-t border-[#d7c4a1]/80 px-5 py-10 mt-auto bg-white">
                <div className="mx-auto max-w-5xl text-center">
                    <p className="mb-2 font-serif text-xl font-bold text-[#11251f]">LE.POÁ</p>
                    <p className="text-xs font-medium text-[#6f685a] uppercase tracking-widest">
                        A elegância é agora.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Sobre;
