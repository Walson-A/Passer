import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, Smartphone, ArrowRight } from 'lucide-react';

export const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 pt-32 pb-20 overflow-hidden bg-black">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[140px] -z-10 animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] -z-10 translate-x-40 translate-y-20 animate-pulse-slower" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl mx-auto z-10"
      >
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer hover:border-white/20">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            {t('hero.version')} {t('hero.available_now')}
        </div>

        <h1 className="text-5xl md:text-8xl font-bold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 drop-shadow-sm">
          {t('hero.title')}
        </h1>
        <p className="text-xl md:text-3xl text-gray-400 mb-8 font-light max-w-2xl mx-auto leading-relaxed">
          {t('hero.subtitle')}
        </p>
        <p className="text-lg text-gray-500 mb-12 max-w-xl mx-auto">
            {t('hero.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/passer-setup.exe"
            download
            className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg flex items-center gap-3 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all duration-300"
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
      </motion.div>

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
