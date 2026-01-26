import { useTranslation } from 'react-i18next';

export const Navbar = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en');
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-black/20 border-b border-white/5">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Passer Logo" className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight text-white">Passer</span>
      </div>
      <button
        onClick={toggleLanguage}
        className="glass-panel px-4 py-2 rounded-full text-sm font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        {i18n.language === 'en' ? 'FR' : 'EN'}
      </button>
    </nav>
  );
};
