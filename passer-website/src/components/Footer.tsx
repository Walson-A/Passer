import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 px-4 border-t border-white/5 bg-black/40 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-gray-500 text-sm font-medium">
          © {currentYear} Passer. {t('footer.copyright').replace('© 2024 Passer. ', '')}
        </p>
        <p className="text-gray-600 text-xs">
          {t('footer.author')}
        </p>
      </div>
    </footer>
  );
};
