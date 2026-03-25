import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap, HardDrive, Layout, Shield } from 'lucide-react';

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
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white">
          {t('features.title')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-colors border border-white/5"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">
                {t(`features.${feature.titleKey}.title`)}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {t(`features.${feature.titleKey}.description`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
