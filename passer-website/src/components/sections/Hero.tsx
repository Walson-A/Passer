import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, Smartphone, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';

export const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-[90vh] flex flex-col justify-center items-center text-center px-4 pt-40 pb-20 overflow-hidden bg-black">
      {/* Background Effects (Mesh Gradients) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,white,transparent)] opacity-20" />
      
      <div className="mesh-blob w-[600px] h-[600px] bg-blue-600 top-[-10%] left-[-10%] animate-pulse-slow" />
      <div className="mesh-blob w-[500px] h-[500px] bg-purple-600 bottom-[-10%] right-[-10%] animate-pulse-slower" />
      <div className="mesh-blob w-[400px] h-[400px] bg-blue-400 top-[20%] right-[10%] opacity-10 animate-pulse-slow" />

      <div className="max-w-5xl mx-auto z-10">
        <Reveal delay={0.2} blur scale yOffset={0}>
          <h1 className="text-6xl md:text-9xl font-bold mb-8 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/30 drop-shadow-2xl leading-[0.9]">
            {t('hero.title')}
          </h1>
        </Reveal>
        
        <Reveal delay={0.4} blur scale yOffset={0}>
          <p className="text-2xl md:text-4xl text-white/90 mb-8 font-medium max-w-3xl mx-auto leading-tight tracking-tight">
            {t('hero.subtitle')}
          </p>
        </Reveal>

        <Reveal delay={0.6} blur yOffset={0}>
          <p className="text-lg md:text-xl text-gray-500 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
              {t('hero.description')}
          </p>
        </Reveal>

        <Reveal delay={0.8} yOffset={20}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/passer-setup.exe"
              download
              className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg flex items-center gap-3 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all duration-300 glow-button"
            >
              <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              {t('hero.download_windows')}
            </a>
            <a
              href="#shortcuts"
              className="group px-8 py-4 glass-panel rounded-full font-semibold text-lg flex items-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all text-white"
            >
              <Smartphone className="w-5 h-5" />
              {t('hero.get_shortcuts')}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </a>
          </div>
        </Reveal>
      </div>

      {/* Screenshot Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 1, ease: "circOut" }}
        className="mt-24 w-full max-w-6xl mx-auto px-4 perspective-1000"
      >
        <div className="relative group rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#0F0F0F] transform transition-transform duration-700 hover:scale-[1.01]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-transparent to-transparent opacity-40 z-10 pointer-events-none" />
          <img
            src="/screenshot.png"
            alt="App Screenshot"
            className="w-full h-auto rounded-xl shadow-lg"
          />
        </div>
      </motion.div>
    </section>
  );
};
