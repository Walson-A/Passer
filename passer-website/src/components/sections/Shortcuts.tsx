import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowUpFromLine, ArrowDownToLine, Share, Plus } from 'lucide-react';

export const Shortcuts = () => {
  const { t } = useTranslation();

  const shortcuts = [
    {
      id: 'push',
      icon: <ArrowUpFromLine className="w-8 h-8 text-blue-400" />,
      url: 'https://www.icloud.com/shortcuts/dd0caf23b72042beb73ed2b4f175477c',
    },
    {
      id: 'pull',
      icon: <ArrowDownToLine className="w-8 h-8 text-green-400" />,
      url: 'https://www.icloud.com/shortcuts/4293d6e1253249efa1b6401f4648641e',
    },
    {
      id: 'pass',
      icon: <Share className="w-8 h-8 text-orange-400" />,
      url: 'https://www.icloud.com/shortcuts/6a6fa41ddc2a452cb19b9f245b1709e6',
    },
  ];

  return (
    <section id="shortcuts" className="py-24 px-4 bg-white/5 relative overflow-hidden">
        {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -z-10" />

      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
          {t('shortcuts.title')}
        </h2>
        <p className="text-xl text-gray-400 mb-16 max-w-2xl mx-auto">
          {t('shortcuts.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {shortcuts.map((shortcut, index) => (
            <motion.a
              key={shortcut.id}
              href={shortcut.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group glass-panel p-8 rounded-3xl hover:bg-white/5 transition-all hover:scale-105 border border-white/5 flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 group-hover:bg-white/15 transition-colors">
                {shortcut.icon}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">
                {t(`shortcuts.${shortcut.id}.title`)}
              </h3>
              <p className="text-gray-400 text-sm mb-6 min-h-[60px]">
                {t(`shortcuts.${shortcut.id}.description`)}
              </p>
              <span className="flex items-center gap-2 text-blue-400 font-medium group-hover:text-blue-300">
                <Plus className="w-4 h-4" />
                {t('shortcuts.add_button')}
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};
