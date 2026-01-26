import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Shortcuts } from './components/Shortcuts';
import { Footer } from './components/Footer';

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
