import { useTranslation } from 'react-i18next';
import { Zap, HardDrive, Layout, Shield } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/TiltCard';

export const Features = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      titleKey: 'instant_sync',
    },
    {
      icon: <HardDrive className="w-6 h-6 text-blue-400" />,
      titleKey: 'passer_space',
    },
    {
      icon: <Layout className="w-6 h-6 text-purple-400" />,
      titleKey: 'premium_ux',
    },
    {
      icon: <Shield className="w-6 h-6 text-green-400" />,
      titleKey: 'privacy_first',
    },
  ];

  return (
    <section id="features" className="py-24 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white tracking-tight">
            {t('features.title')}
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Reveal key={index} delay={index * 0.1}>
              <TiltCard className="h-full">
                <div className="glass-panel p-8 rounded-[32px] hover:bg-white/[0.04] transition-all duration-500 border border-white/[0.05] group h-full">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-6 border border-white/[0.05] group-hover:scale-110 transition-transform duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white tracking-tight">
                    {t(`features.${feature.titleKey}.title`)}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed font-light">
                    {t(`features.${feature.titleKey}.description`)}
                  </p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
