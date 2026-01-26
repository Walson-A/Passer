import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, Smartphone } from 'lucide-react';

export const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 pt-32 pb-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] -z-10 translate-x-20 translate-y-20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto"
      >
        <img src="/logo.png" alt="Passer Logo" className="w-24 h-24 mx-auto mb-8 drop-shadow-2xl" />
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          {t('hero.title')}
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-4 font-light">
          {t('hero.subtitle')}
        </p>
        <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
            {t('hero.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/passer-setup.exe"
            download
            className="group relative px-8 py-4 bg-white text-black rounded-full font-semibold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Download className="w-5 h-5" />
            {t('hero.download_windows')}
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                {t('hero.version')}
            </span>
          </a>
          <a
            href="#shortcuts"
            className="px-8 py-4 glass-panel rounded-full font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors text-white"
          >
            <Smartphone className="w-5 h-5" />
            {t('hero.get_shortcuts')}
          </a>
        </div>
      </motion.div>

      {/* Screenshot Container */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="mt-20 w-full max-w-5xl mx-auto px-4"
      >
        <div className="relative glass-panel rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <img src="/screenshot.png" alt="App Screenshot" className="w-full h-auto" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-transparent to-transparent opacity-50" />
        </div>
      </motion.div>
    </section>
  );
};
