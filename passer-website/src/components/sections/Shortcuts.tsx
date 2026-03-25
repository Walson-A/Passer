import { useTranslation } from 'react-i18next';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/TiltCard';
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
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
            {t('shortcuts.title')}
          </h2>
          <p className="text-xl text-gray-400 mb-16 max-w-2xl mx-auto font-light leading-relaxed">
            {t('shortcuts.subtitle')}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {shortcuts.map((shortcut, index) => (
            <Reveal key={shortcut.id} delay={index * 0.1}>
              <TiltCard className="h-full">
                <a
                  href={shortcut.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group glass-panel p-10 rounded-[40px] hover:bg-white/[0.04] transition-all duration-700 hover:scale-[1.02] border border-white/[0.05] flex flex-col items-center h-full"
                >
                  <div className="w-20 h-20 rounded-[24px] bg-white/[0.03] flex items-center justify-center mb-8 group-hover:bg-white/[0.06] transition-all duration-500 group-hover:scale-110 border border-white/[0.05]">
                    {shortcut.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white tracking-tight">
                    {t(`shortcuts.${shortcut.id}.title`)}
                  </h3>
                  <p className="text-gray-400 text-sm mb-8 min-h-[60px] font-light leading-relaxed">
                    {t(`shortcuts.${shortcut.id}.description`)}
                  </p>
                  <span className="flex items-center gap-2 text-white/40 text-sm font-medium group-hover:text-blue-400 transition-colors duration-300">
                    <Plus className="w-4 h-4" />
                    {t('shortcuts.add_button')}
                  </span>
                </a>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
