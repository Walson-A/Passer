import { useTranslation } from 'react-i18next';
import { Menu, X, Github } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple SVG Flags
const USFlag = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1235 650" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="1235" height="650" fill="#B22234"/>
    <rect width="1235" height="100" y="100" fill="#fff"/>
    <rect width="1235" height="100" y="300" fill="#fff"/>
    <rect width="1235" height="100" y="500" fill="#fff"/>
    <rect width="494" height="350" fill="#3C3B6E"/>
    {/* Simplified stars pattern (dots) for small size visibility */}
    <g fill="#fff">
        <circle cx="50" cy="50" r="20" />
        <circle cx="150" cy="50" r="20" />
        <circle cx="250" cy="50" r="20" />
        <circle cx="350" cy="50" r="20" />
        <circle cx="450" cy="50" r="20" />

        <circle cx="100" cy="100" r="20" />
        <circle cx="200" cy="100" r="20" />
        <circle cx="300" cy="100" r="20" />
        <circle cx="400" cy="100" r="20" />

        <circle cx="50" cy="150" r="20" />
        <circle cx="150" cy="150" r="20" />
        <circle cx="250" cy="150" r="20" />
        <circle cx="350" cy="150" r="20" />
        <circle cx="450" cy="150" r="20" />

        <circle cx="100" cy="200" r="20" />
        <circle cx="200" cy="200" r="20" />
        <circle cx="300" cy="200" r="20" />
        <circle cx="400" cy="200" r="20" />

        <circle cx="50" cy="250" r="20" />
        <circle cx="150" cy="250" r="20" />
        <circle cx="250" cy="250" r="20" />
        <circle cx="350" cy="250" r="20" />
        <circle cx="450" cy="250" r="20" />

        <circle cx="100" cy="300" r="20" />
        <circle cx="200" cy="300" r="20" />
        <circle cx="300" cy="300" r="20" />
        <circle cx="400" cy="300" r="20" />
    </g>
  </svg>
);

const FRFlag = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 3 2" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="1" height="2" fill="#002395"/>
    <rect width="1" height="2" x="1" fill="#FFFFFF"/>
    <rect width="1" height="2" x="2" fill="#ED2939"/>
  </svg>
);

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

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-6 py-4 backdrop-blur-md bg-black/50 border-b border-white/5 transition-all">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <a href="#" onClick={scrollToTop} className="flex items-center gap-3 group">
          <img src="/logo.png" alt="Passer Logo" className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform" />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-gray-200 transition-colors">{t('hero.title')}</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
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

          {/* Github Link */}
          <a
            href="https://github.com/Walson-A/Passer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Star on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
          >
            {i18n.language === 'en' ? (
                <>
                    <USFlag className="w-5 h-3.5 rounded-[2px]" />
                    <span>{t('nav.english')}</span>
                </>
            ) : (
                <>
                    <FRFlag className="w-5 h-3.5 rounded-[2px]" />
                    <span>{t('nav.french')}</span>
                </>
            )}
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

              <a
                href="https://github.com/Walson-A/Passer"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-white text-lg font-medium"
              >
                <Github className="w-5 h-5" />
                {t('nav.github')}
              </a>

              <hr className="border-white/10" />
              <button
                onClick={() => {
                    toggleLanguage();
                    setIsOpen(false);
                }}
                className="flex items-center gap-2 text-gray-300 hover:text-white text-lg font-medium"
              >
                 {i18n.language === 'en' ? (
                    <>
                        <FRFlag className="w-5 h-3.5 rounded-[2px]" />
                        <span>{t('nav.switch_to_french')}</span>
                    </>
                 ) : (
                    <>
                        <USFlag className="w-5 h-3.5 rounded-[2px]" />
                        <span>{t('nav.switch_to_english')}</span>
                    </>
                 )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
