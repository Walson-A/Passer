import { Navbar } from '@/components/layout/Navbar';
import { Hero } from '@/components/sections/Hero';
import { Features } from '@/components/sections/Features';
import { Shortcuts } from '@/components/sections/Shortcuts';
import { Footer } from '@/components/layout/Footer';

function App() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10 selection:text-white relative">
      <div className="noise-overlay" />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Shortcuts />
      </main>
      <Footer />
    </div>
  );
}

export default App;
