import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="py-12 px-4 border-t border-white/5 bg-black/40 text-center">
      <p className="text-gray-400 mb-2">
        {t('footer.built_with')}
      </p>
      <p className="text-gray-600 text-sm">
        {t('footer.author')}
      </p>
    </footer>
  );
};
