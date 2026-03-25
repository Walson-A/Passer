import { Navbar } from '@/components/layout/Navbar';
import { Hero } from '@/components/sections/Hero';
import { Features } from '@/components/sections/Features';
import { Shortcuts } from '@/components/sections/Shortcuts';
import { Footer } from '@/components/layout/Footer';

function App() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white selection:bg-blue-500/30">
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
