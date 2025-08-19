import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeatureCard } from '@/components/ui/feature-card';
import { StepCard } from '@/components/ui/step-card';
import { CheckCircle2, Users, Vote, BarChart3, ArrowRight, Star } from 'lucide-react';

export default function Landing() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');

  const handleGetStarted = () => {
    setLocation('/welcome-clean');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Email signup:', email);
    // TODO: Handle email signup
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-rr-surface text-white">
      {/* Sticky Navigation */}
      <header className="sticky top-4 z-50">
        <nav className="mx-auto max-w-6xl rounded-2xl bg-black/40 backdrop-blur px-4 py-3 border border-white/10">
          <div className="flex items-center justify-between">
            <a className="flex items-center gap-2 font-semibold text-white">
              <div className="h-7 w-7 rounded-xl bg-rr-accent text-black grid place-items-center font-bold text-sm">
                RR
              </div>
              RushRank
            </a>
            <ul className="hidden md:flex items-center gap-6 text-sm text-white/80">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setLocation('/welcome-clean')}
                className="text-white/80 text-sm hover:text-white transition-colors"
              >
                Log in
              </button>
              <button 
                onClick={handleGetStarted}
                className="rounded-full px-4 py-2 text-sm font-medium bg-rr-accent text-black hover:bg-rr-accent/90 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="mx-auto max-w-4xl font-display text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
          Rush management that{' '}
          <span className="text-white/70">just works.</span>
        </h1>
        <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
          Track attendance, run votes, and stay organized—built for fraternities, designed for rush chairs.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button 
            onClick={handleGetStarted}
            className="rounded-xl px-6 py-3 bg-rr-accent text-black font-semibold hover:bg-rr-accent/90 transition-all hover:scale-105 shadow-lg"
          >
            Create Chapter
          </button>
          <button 
            onClick={handleGetStarted}
            className="rounded-xl px-6 py-3 bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-all hover:scale-105"
          >
            See Demo
          </button>
          <button 
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="rounded-xl px-6 py-3 bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-all hover:scale-105"
          >
            Learn More
          </button>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center font-display text-3xl md:text-4xl font-bold text-white mb-10">
          Built for rush week chaos
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Attendance"
            icon={Users}
            iconColor="text-rr-accent"
            points={[
              "QR or tap check-ins",
              "Event caps & notes", 
              "PNM timelines"
            ]}
            onCtaClick={handleGetStarted}
          />
          <FeatureCard
            title="Voting"
            icon={Vote}
            iconColor="text-rr-secondary"
            points={[
              "Live sessions",
              "Weighted or blind ballots",
              "Auto-tallies & tie rules"
            ]}
            onCtaClick={handleGetStarted}
          />
          <FeatureCard
            title="Analytics"
            icon={BarChart3}
            iconColor="text-blue-400"
            points={[
              "Event heatmaps",
              "Member participation",
              "PNM funnel insights"
            ]}
            onCtaClick={handleGetStarted}
          />
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="mx-auto max-w-5xl px-4 pb-20">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white text-center mb-10">
          How it works
        </h2>
        <ol className="grid md:grid-cols-2 gap-6">
          <StepCard
            step={1}
            title="Create your chapter"
            description="Set roles & permissions for your brotherhood."
          />
          <StepCard
            step={2}
            title="Import PNMs"
            description="CSV, forms, or manual entry—your choice."
          />
          <StepCard
            step={3}
            title="Run events"
            description="QR check-ins, attendance tracking & notes."
          />
          <StepCard
            step={4}
            title="Vote & decide"
            description="Blind ballots with instant, transparent results."
          />
        </ol>
      </section>

      {/* Email CTA */}
      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h3 className="font-display text-3xl font-bold text-white mb-2">Join the early access list</h3>
        <p className="text-white/70 mb-8">We'll invite chapters as we scale capacity.</p>
        <form className="flex flex-col sm:flex-row gap-3 justify-center" onSubmit={handleEmailSubmit}>
          <input 
            type="email" 
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-md rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-rr-accent/50 focus:border-rr-accent/50"
            required
          />
          <button 
            type="submit"
            className="rounded-xl bg-rr-accent text-black px-6 py-3 font-semibold hover:bg-rr-accent/90 transition-colors whitespace-nowrap"
          >
            Notify me
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-10 text-white/60 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-rr-accent text-black grid place-items-center font-bold text-xs">
              RR
            </div>
            <span>© {new Date().getFullYear()} RushRank</span>
          </div>
          <ul className="flex gap-6">
            <li><a href="#" className="hover:text-white transition-colors">About</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}