import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-20 px-4 border-t border-white/[0.02] bg-black text-center relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500 cursor-default">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 grayscale" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">{t('hero.title')}</span>
        </div>
        
        <div className="flex flex-col gap-2">
          <p className="text-gray-600 text-[10px] tracking-widest uppercase font-medium">
            {t('footer.copyright', { year: currentYear })}
          </p>
          <p className="text-gray-700 text-[10px] tracking-tight">
            {t('footer.author')}
          </p>
        </div>
      </div>
    </footer>
  );
};
