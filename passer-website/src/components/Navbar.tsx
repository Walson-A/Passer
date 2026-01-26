import { useTranslation } from 'react-i18next';
import { Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en');
  };

  const navLinks = [
    { name: t('nav.features'), href: '#features' },
    { name: t('nav.shortcuts'), href: '#shortcuts' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-6 py-4 backdrop-blur-md bg-black/50 border-b border-white/5 transition-all">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Passer Logo" className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-bold tracking-tight text-white">Passer</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
          >
            <Globe className="w-4 h-4" />
            {i18n.language === 'en' ? '🇺🇸 English' : '🇫🇷 Français'}
          </button>

          <a
             href="/passer-setup.exe"
             download
             className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            {t('nav.download')}
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/95 border-b border-white/10 overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-gray-300 hover:text-white text-lg font-medium"
                >
                  {link.name}
                </a>
              ))}
              <hr className="border-white/10" />
              <button
                onClick={() => {
                    toggleLanguage();
                    setIsOpen(false);
                }}
                className="flex items-center gap-2 text-gray-300 hover:text-white text-lg font-medium"
              >
                 <Globe className="w-5 h-5" />
                 {i18n.language === 'en' ? 'Switch to French' : 'Passer en Anglais'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
