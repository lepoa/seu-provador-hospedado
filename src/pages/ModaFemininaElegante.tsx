import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { Sparkles, CheckCircle2, Diamond, Briefcase, Star } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

const ModaFemininaElegante = () => {
    return (
        <div className="min-h-screen flex flex-col bg-[#f8f3e8] text-[#151515] overflow-x-hidden">
            <Helmet>
                <title>Moda Feminina Elegante | Le.Poá</title>
                <meta
                    name="description"
                    content="Descubra o verdadeiro significado da moda feminina elegante com a Le.Poá. Roupas sofisticadas com curadoria autoral para mulheres modernas e confiantes."
                />
                <link rel="canonical" href="https://lepoa.com.br/moda-feminina-elegante" />
                <meta property="og:title" content="Moda Feminina Elegante | Le.Poá" />
                <meta property="og:description" content="Descubra o verdadeiro significado da moda feminina elegante com a Le.Poá. Roupas sofisticadas com curadoria autoral para mulheres modernas e confiantes." />
                <meta property="og:type" content="article" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": [
                            {
                                "@type": "Question",
                                "name": "O que é moda feminina elegante?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Moda feminina elegante é um estilo que prioriza sofisticação, equilíbrio e qualidade nas peças, com modelagens estruturadas e tecidos nobres."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Como se vestir de forma elegante para o trabalho?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Para um visual elegante no trabalho, aposte em alfaiataria feminina moderna, vestidos midi estruturados, blazers sofisticados e cores neutras."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Como montar um guarda-roupa elegante e funcional?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Um guarda-roupa elegante é construído com peças-chave combináveis, cores atemporais e modelagens clássicas que oferecem versatilidade."
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Onde comprar roupas femininas sofisticadas?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": "Na Le.Poá você encontra uma curadoria exclusiva de moda feminina elegante, pensada para mulheres modernas que valorizam sofisticação e identidade."
                                }
                            }
                        ]
                    })}
                </script>
            </Helmet>

            <BenefitsBar />
            <Header />

            {/* 1. HERO SECTION - Verde Profundo e Dourado */}
            <section className="relative bg-[#11251f] py-24 md:py-36 flex items-center justify-center overflow-hidden">
                {/* Subtle texture/gradient overlay */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#b28a40] via-transparent to-transparent mix-blend-overlay"></div>

                <div className="relative z-10 container mx-auto px-5 text-center max-w-4xl">
                    <span className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b28a40]">
                        <Sparkles className="h-4 w-4" />
                        Curadoria Premium
                    </span>
                    <h1 className="mb-6 font-serif text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-[#f8f3e8]">
                        Moda Feminina Elegante
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg md:text-xl text-[#d9c4a1] font-light leading-relaxed">
                        A sofisticação atemporal como ferramenta de poder. Bem-vinda à experiência Le.Poá, onde o vestir se encontra com a inteligência e a feminilidade refinada.
                    </p>
                </div>
            </section>

            {/* MAIN CONTENT AREA */}
            <main className="container mx-auto px-5 py-16 md:py-24 max-w-4xl font-serif text-lg leading-relaxed text-[#322f29]">

                {/* H2 - O que é moda feminina elegante? */}
                <section className="mb-20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-px bg-[#c8ad76] flex-1"></div>
                        <Diamond className="text-[#a37d38] h-6 w-6" />
                        <div className="h-px bg-[#c8ad76] flex-1"></div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-6 text-center">
                        O que é moda feminina elegante?
                    </h2>
                    <div className="space-y-6">
                        <p>
                            A <strong>moda feminina elegante</strong> transcende tendências passageiras. Ela não se define pelo excesso, mas pela intenção por trás de cada escolha. Vestir-se com elegância é comunicar confiança, presença e sofisticação antes mesmo de pronunciar uma única palavra.
                        </p>
                        <p>
                            No universo da moda contemporânea, as <span className="border-b-2 border-[#b28a40]/30 pb-0.5">roupas femininas sofisticadas</span> são desenhadas para valorizar a arquitetura do corpo da mulher da mulher com naturalidade, priorizando a excelência do corte, a nobreza dos tecidos e o caimento impecável. Uma mulher elegante compreende que o verdadeiro luxo reside no conforto aliado à estética impecável.
                        </p>
                        <p>
                            Na Le.Poá, acreditamos que a elegância é um estado de espírito refletido no vestir. Nossas coleções são pensadas para mulheres modernas que não abrem mão da qualidade e buscam um visual limpo, estruturado e inegavelmente chic para todos os momentos de sua jornada.
                        </p>
                    </div>
                </section>

                {/* Blocos Visuais Suaves (Blush/Mármore Simulada) */}
                <div className="my-16 bg-gradient-to-br from-[#fffcf6] to-[#f9f3e3] p-10 md:p-14 rounded-2xl border border-[#d8c4a0]/50 shadow-[0_10px_40px_rgba(185,150,83,0.05)]">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#11251f] mb-6 flex items-center gap-3">
                        <Briefcase className="text-[#b28a40]" />
                        Moda elegante para trabalho
                    </h2>
                    <div className="space-y-6 text-[#4a463e]">
                        <p>
                            O ambiente corporativo moderno exige um dress code que transite perfeitamente entre o profissionalismo irretocável e o estilo pessoal. Encontrar a <strong>moda elegante para trabalho</strong> ideal é o segredo para construir uma imagem de autoridade incontestável.
                        </p>
                        <p>
                            A base desse guarda-roupa está na <Link to="/catalogo?category=Alfaiataria" className="text-[#a37d38] font-semibold hover:underline">alfaiataria feminina moderna</Link>. Cortes precisos estruturam a silhueta, conferindo um ar de poder quase imediato. Peças como <strong>blazers sofisticados</strong> com modelagem acinturada e calças de alfaiataria reta são pilares indispensáveis.
                        </p>
                        <p>
                            Para dias que pedem fluidez sem perder a formalidade, <Link to="/catalogo?category=Vestidos" className="text-[#a37d38] font-semibold hover:underline">vestidos elegantes</Link> em comprimento midi oferecem a solução perfeita de <em>"one-piece wonder"</em>. Já os <Link to="/catalogo?category=Conjuntos" className="text-[#a37d38] font-semibold hover:underline">conjuntos modernos</Link> monocromáticos alongam a silhueta e transmitem uma imagem intencional e extremamente polida com esforço mínimo.
                        </p>
                    </div>
                </div>

                {/* H2 - Como montar um guarda-roupa elegante e funcional */}
                <section className="mb-20">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-8 relative inline-block">
                        Como montar um guarda-roupa elegante e funcional
                        <span className="absolute -bottom-2 left-0 w-1/3 h-1 bg-[#b28a40]"></span>
                    </h2>

                    <p className="mb-8">
                        Um <strong>guarda-roupa elegante</strong> não precisa ser necessariamente infinito, ele precisa ser inteligente. A chave para a sofisticação diária é a versatilidade. Quando suas peças conversam entre si, o ato de vestir-se pela manhã deixa de ser um desafio e passa a ser um momento de celebração do próprio estilo.
                    </p>

                    <ul className="space-y-5 mb-8">
                        {[
                            "Invista fortemente em peças de alfaiataria feminina de qualidade ímpar.",
                            "Priorize uma paleta de cores atemporal: neutros refinados intercalados com tons puros.",
                            "Busque caimentos que respeitem a arquitetura natural do seu corpo.",
                            "Tenha ao menos dois blazers sofisticados como peças de sobreposição curinga.",
                            "Fuja dos excessos: a elegância frequentemente reside naquilo que você escolhe retirar do look."
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-4">
                                <CheckCircle2 className="h-6 w-6 text-[#a37d38] flex-shrink-0 mt-0.5" />
                                <span className="text-lg">{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Fotografia Editorial Simulada / Banner CTA */}
                <div className="relative w-full h-[450px] md:h-[500px] rounded-2xl overflow-hidden mb-20 group shadow-2xl">
                    <OptimizedImage
                        src="/lovable-uploads/lepoa-brand-detail.jpg"
                        alt="Detalhe institucional da marca Le.Poá com tag verde profundo e dourado sobre tecido blush."
                        className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105"
                    />
                    {/* Overlay editorial verde profundo / degradê */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#11251f]/90 via-[#11251f]/30 to-transparent flex items-center p-8 md:p-20">
                        <blockquote className="text-left max-w-2xl">
                            <p className="font-serif text-2xl md:text-4xl lg:text-5xl italic font-light text-[#f8f3e8] leading-[1.2] mb-8">
                                "A verdadeira elegância para mim não é só passar despercebida, é ser lembrada após sair da sala."
                            </p>
                            <div className="w-24 h-px bg-[#b28a40] shadow-[0_0_10px_rgba(178,138,64,0.5)]"></div>
                        </blockquote>
                    </div>
                </div>

                {/* H2 - Loja de moda feminina elegante: por que escolher a Le.Poá? */}
                <section className="mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-6">
                        Loja de moda feminina elegante: por que escolher a Le.Poá?
                    </h2>

                    <p className="mb-8">
                        Encontrar a <strong>loja de moda feminina elegante</strong> ideal significa encontrar uma aliada na construção da sua imagem pessoal. A Le.Poá nasceu do desejo de democratizar a sofisticação através de uma experiência puramente aspiracional e extremamente prática.
                    </p>

                    <div className="grid md:grid-cols-2 gap-8 mt-10">
                        <div className="bg-white p-8 rounded-xl border border-[#d8c4a0]/40">
                            <Star className="text-[#a37d38] h-8 w-8 mb-4" />
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Curadoria Autoral</h3>
                            <p className="text-base text-[#6f685a]">
                                Ausência absoluta de fast-fashion comum. Cada peça do nosso catálogo é minuciosamente selecionada sob filtros estritos de caimento, paleta e durabilidade.
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-xl border border-[#d8c4a0]/40">
                            <Star className="text-[#a37d38] h-8 w-8 mb-4" />
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Live Shop Exclusiva</h3>
                            <p className="text-base text-[#6f685a]">
                                Dinamismo e transparência. Nossas Lives proporcionam um olhar real e próximo sobre o tecido e os caimentos, revolucionando a confiança na compra digital.
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-xl border border-[#d8c4a0]/40">
                            <Star className="text-[#a37d38] h-8 w-8 mb-4" />
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Atendimento Próximo</h3>
                            <p className="text-base text-[#6f685a]">
                                Você não fala com robôs. Contamos com um serviço de consultoria atenta via WhatsApp para sanar dúvidas de medidas e ajudar na construção de looks reais para você.
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-xl border border-[#d8c4a0]/40">
                            <Star className="text-[#a37d38] h-8 w-8 mb-4" />
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Identidade Forte</h3>
                            <p className="text-base text-[#6f685a]">
                                Do unboxing que cheira a luxo contemporâneo até o impacto visual da vestimenta. Vista uma marca que compartilha dos mesmos valores de presença e requinte que você.
                            </p>
                        </div>
                    </div>
                </section>

                {/* H2 - FAQ */}
                <section className="mb-20 bg-[#fffcf6] p-8 md:p-12 rounded-2xl border border-[#d8c4a0]/50 shadow-[0_4px_20px_rgba(185,150,83,0.03)]">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#11251f] mb-8 text-center">
                        Perguntas Frequentes sobre Moda Feminina Elegante
                    </h2>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">O que é moda feminina elegante?</h3>
                            <p className="text-[#4a463e]">Moda feminina elegante é um estilo que prioriza sofisticação, equilíbrio e qualidade nas peças. Envolve modelagens estruturadas, tecidos nobres e combinações inteligentes que transmitem presença e confiança sem excessos.</p>
                        </div>
                        <div className="h-px w-full bg-[#d8c4a0]/30"></div>
                        <div>
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Como se vestir de forma elegante para o trabalho?</h3>
                            <p className="text-[#4a463e]">Para um visual elegante no ambiente profissional, aposte em alfaiataria feminina moderna, vestidos midi estruturados, blazers sofisticados e cores neutras. A chave está no caimento impecável e na versatilidade das peças.</p>
                        </div>
                        <div className="h-px w-full bg-[#d8c4a0]/30"></div>
                        <div>
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Como montar um guarda-roupa elegante e funcional?</h3>
                            <p className="text-[#4a463e]">Um guarda-roupa elegante é construído com peças-chave combináveis, cores atemporais e modelagens clássicas. Investir em qualidade e versatilidade reduz excessos e aumenta possibilidades de combinação.</p>
                        </div>
                        <div className="h-px w-full bg-[#d8c4a0]/30"></div>
                        <div>
                            <h3 className="text-xl font-bold text-[#11251f] mb-3">Onde comprar roupas femininas sofisticadas?</h3>
                            <p className="text-[#4a463e]">Na Le.Poá, você encontra uma curadoria exclusiva de moda feminina elegante, pensada para mulheres modernas que valorizam sofisticação, praticidade e identidade no vestir.</p>
                        </div>
                    </div>
                </section>

                {/* CTA final */}
                <div className="text-center mt-20 pb-10">
                    <h3 className="font-serif text-2xl font-bold md:text-3xl text-[#11251f] mb-6">
                        Explore a elegância no seu dia a dia
                    </h3>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/catalogo">
                            <button className="w-full rounded-md border border-[#b8944e] bg-[#11251f] px-10 py-4 text-sm font-medium uppercase tracking-[0.2em] text-[#f3e5c1] transition-colors duration-300 hover:bg-[#183229] sm:w-auto">
                                Ver Coleção Atual
                            </button>
                        </Link>
                        <Link to="/sobre">
                            <button className="w-full rounded-md border border-[#c7aa6b] bg-transparent px-10 py-4 text-sm font-medium uppercase tracking-[0.2em] text-[#2f2a22] transition-colors duration-300 hover:bg-[#f2e6cc] sm:w-auto">
                                Nossa História
                            </button>
                        </Link>
                    </div>
                </div>

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

export default ModaFemininaElegante;
