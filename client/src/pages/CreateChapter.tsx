import { useState } from 'react';
import { useLocation } from 'wouter';
import { PrimaryButton, SecondaryButton } from '@/components/ui/unified-button';
import { UnifiedCard, UnifiedCardHeader, UnifiedCardBody } from '@/components/ui/unified-card';
import { ArrowLeft } from 'lucide-react';

export default function CreateChapter() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    chapterName: '',
    university: '',
    email: '',
    logo: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Handle form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setLocation('/dashboard-clean');
    }, 2000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, logo: file }));
  };

  return (
    <div className="min-h-screen bg-rr-bg">
      {/* Sticky Navigation */}
      <header className="sticky top-4 z-50">
        <nav className="mx-auto max-w-6xl rounded-2xl bg-black/40 backdrop-blur px-4 py-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLocation('/')}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <div className="h-7 w-7 rounded-xl bg-gradient-to-r from-rr-accent to-rr-accentDark text-white grid place-items-center font-bold text-sm">
                RR
              </div>
              <span className="font-semibold text-white">RushRank</span>
            </div>
            <div className="text-sm text-white/70">Creating Chapter</div>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-20">
        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white">
            Create your chapter
          </h1>
          <p className="text-rr-muted mt-3 max-w-2xl mx-auto text-lg">
            Set up RushRank for your house in minutes. Invite exec, import PNMs, and start your first event.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Form */}
          <UnifiedCard className="md:col-span-2">
            <UnifiedCardHeader 
              title="Chapter details" 
              subtitle="You can change these later in Settings." 
            />
            <UnifiedCardBody>
              <form onSubmit={handleSubmit} className="grid gap-5">
                <div>
                  <label className="block text-sm text-rr-muted mb-2">Chapter name</label>
                  <input 
                    type="text"
                    value={formData.chapterName}
                    onChange={(e) => handleInputChange('chapterName', e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-rr-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rr-accent/40 transition-all"
                    placeholder="e.g., Alpha Beta Gamma"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-rr-muted mb-2">University</label>
                  <input 
                    type="text"
                    value={formData.university}
                    onChange={(e) => handleInputChange('university', e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-rr-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rr-accent/40 transition-all"
                    placeholder="e.g., University of California"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-rr-muted mb-2">Admin email</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-rr-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rr-accent/40 transition-all"
                    placeholder="your.email@university.edu"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-rr-muted mb-2">Logo (optional)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full rounded-xl bg-white/5 border border-rr-border px-4 py-2 text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:px-3 file:py-2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <PrimaryButton 
                    type="submit"
                    disabled={isSubmitting}
                    className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Chapter'}
                  </PrimaryButton>
                  <SecondaryButton type="button">
                    Invite Exec
                  </SecondaryButton>
                </div>
              </form>
            </UnifiedCardBody>
          </UnifiedCard>

          {/* Right: Info Panel */}
          <UnifiedCard>
            <UnifiedCardHeader title="What you'll set up" />
            <UnifiedCardBody>
              <ul className="space-y-3 text-sm text-rr-muted">
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rr-accent mt-2 flex-shrink-0" />
                  Roles & permissions (admin, exec, member)
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rr-accent mt-2 flex-shrink-0" />
                  Default rush stages & voting rules
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rr-accent mt-2 flex-shrink-0" />
                  Import PNMs via CSV or Google Sheet
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rr-accent mt-2 flex-shrink-0" />
                  First event with QR check-ins
                </li>
              </ul>
              
              <div className="mt-6 rounded-xl p-4 bg-rr-accentFaint border border-rr-accent/20">
                <div className="text-sm text-white">
                  💡 Tip: You can switch to a demo chapter any time to explore features.
                </div>
              </div>
            </UnifiedCardBody>
          </UnifiedCard>
        </div>

        {/* Steps Section */}
        <section className="mt-14">
          <h2 className="text-center font-display text-2xl font-bold text-white mb-8">
            Setup Process
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Create chapter', desc: 'Basic info & branding' },
              { step: 2, title: 'Invite exec', desc: 'Add your leadership team' },
              { step: 3, title: 'Import PNMs', desc: 'Upload potential members' },
              { step: 4, title: 'Start first event', desc: 'Begin rush activities' }
            ].map(({ step, title, desc }) => (
              <div key={step} className="rounded-2xl bg-white/5 border border-rr-border p-4 hover:bg-white/10 transition-all">
                <div className="text-xs text-rr-accent font-semibold">Step {step}</div>
                <div className="mt-1 font-semibold text-white">{title}</div>
                <div className="text-xs text-rr-muted mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}