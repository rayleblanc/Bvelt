import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Check, 
  HelpCircle, 
  Heart, 
  Share2, 
  Sparkles, 
  Calendar, 
  AlertTriangle,
  Mail,
  Layers
} from 'lucide-react';

interface AboutPageProps {
  onNavigateHome?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigateHome }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const bscAddress = '0x533Fb6fb014421852184DB97e6b6E5Ae2f08D207';
  const solanaAddress = 'AsSmUDq6XuibVqhCcfVSFgW4zw2f3wxHgvVqqcLi73rU';

  const copyToClipboard = (text: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // SEO, OpenGraph & Structured Data (JSON-LD)
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Rainer Blanco – Independent Builder Behind Bvelt';

    const setMetaTag = (attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = 'The story of Bvelt, built by independent developer Rainer Blanco from Isla de la Juventud, Cuba. Local market intelligence for trade contractors.';
    setMetaTag('name', 'description', desc);
    setMetaTag('property', 'og:title', 'Rainer Blanco – Independent Builder Behind Bvelt');
    setMetaTag('property', 'og:description', desc);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:url', 'https://bvelt.app/about');
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', 'Rainer Blanco – Independent Builder Behind Bvelt');
    setMetaTag('name', 'twitter:description', desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bvelt.app/about');

    // JSON-LD Structured Data
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": "https://bvelt.app/about#creator",
          "name": "Rainer Blanco",
          "jobTitle": "Independent Developer & Creator of Bvelt",
          "worksFor": {
            "@type": "Organization",
            "name": "Bvelt",
            "url": "https://bvelt.app"
          },
          "url": "https://bvelt.app/about",
          "description": "Independent software developer based in Isla de la Juventud, Cuba, engineering local market intelligence and automation tools for contractors.",
          "knowsAbout": ["Cloudflare Workers", "React", "TypeScript", "Geospatial Data", "Local SEO"]
        },
        {
          "@type": "AboutPage",
          "@id": "https://bvelt.app/about#webpage",
          "url": "https://bvelt.app/about",
          "name": "Rainer Blanco – Independent Builder Behind Bvelt",
          "isPartOf": {
            "@type": "WebSite",
            "name": "Bvelt",
            "url": "https://bvelt.app"
          },
          "description": desc,
          "mainEntity": {
            "@id": "https://bvelt.app/about#creator"
          }
        },
        {
          "@type": "FAQPage",
          "@id": "https://bvelt.app/about#faq",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Is this a registered charity or 501(c)(3) organization?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. Any voluntary support sent here is a direct personal gift to an individual software developer in Cuba to support basic working conditions, electrical power backups, and internet connectivity. It is not tax-deductible."
              }
            },
            {
              "@type": "Question",
              "name": "Is this an investment or equity offering?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. Voluntary support conveys no equity, shares, tokens, voting rights, profit sharing, debt repayment, or financial return of any kind."
              }
            },
            {
              "@type": "Question",
              "name": "How do I verify the cryptocurrency addresses?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The only official addresses are those published directly on the canonical URL https://bvelt.app/about. You can also inspect both addresses on public blockchain explorers via the BscScan and Solscan links provided on this page."
              }
            },
            {
              "@type": "Question",
              "name": "Is Bvelt free for local businesses to test?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. Any contractor or business owner can perform a free local presence audit and test diagnostic reports directly on bvelt.app without requiring a credit card."
              }
            }
          ]
        }
      ]
    };

    const scriptId = 'about-schema-jsonld';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.text = JSON.stringify(structuredData);

    // Auto-scroll to anchor if present in URL
    if (window.location.hash) {
      const targetId = window.location.hash.replace('#', '');
      const targetElem = document.getElementById(targetId);
      if (targetElem) {
        setTimeout(() => {
          targetElem.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }

    return () => {
      document.title = prevTitle;
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, []);

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-200 selection:bg-indigo-500/30 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#06080d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a
            href="/"
            onClick={handleHomeClick}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="font-extrabold text-base tracking-tight text-white group-hover:text-indigo-400 transition-colors">
              Bvelt
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="#support"
              className="text-xs font-bold text-amber-400/90 hover:text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3.5 py-1.5 rounded-xl transition"
            >
              Support the Work
            </a>
            <a
              href="/"
              onClick={handleHomeClick}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to App</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 pb-24 space-y-16">
        
        {/* 1. Header & Trust in 5 Seconds */}
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-bold tracking-wide">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Independent Builder Story</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Rainer Blanco — Independent Builder Behind Bvelt
            </h1>
            <p className="text-slate-400 text-base sm:text-lg">
              Local market intelligence &amp; growth tools for contractors, engineered from Isla de la Juventud, Cuba.
            </p>
          </div>

          {/* Citable Paragraph */}
          <div className="p-5 sm:p-6 bg-slate-900/90 border-l-4 border-indigo-500 rounded-r-2xl border-y border-r border-slate-800/80 shadow-lg">
            <p className="text-slate-100 text-base sm:text-lg leading-relaxed font-medium">
              Bvelt is built by <strong className="text-white font-bold">Rainer Blanco</strong>, an independent software developer working from Isla de la Juventud, Cuba, primarily on a smartphone under daily power cuts and limited internet access. The platform gives trade contractors and field-service operators transparent local market intelligence, verified business presence diagnostics, and fast response tools.
            </p>
          </div>

          {/* Top Actions: Explore + Direct Email */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="https://bvelt.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-indigo-600/30"
            >
              <span>Explore Live Product</span>
              <ExternalLink size={14} />
            </a>

            <a
              href="mailto:bveltpro@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition"
            >
              <Mail size={14} className="text-indigo-400" />
              <span>Email Rainer</span>
            </a>

            <span className="text-xs text-slate-400 ml-1">
              Live in production on <span className="font-mono text-slate-300">bvelt.app</span>
            </span>
          </div>
        </section>

        {/* 2. Story: Plain Language & Realistic Constraints */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Layers size={15} className="text-indigo-400" />
            <span>The Reality &amp; Architecture</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Building Under Constraints
          </h2>

          <div className="space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed">
            <p>
              I live on Isla de la Juventud, a small island south of mainland Cuba. Daily life here includes scheduled power outages that often last 10 to 14 hours, costly and unstable mobile data, and an acute scarcity of modern computing equipment.
            </p>
            <p>
              Rather than waiting for ideal circumstances, I chose to build Bvelt directly on my smartphone and whatever hardware was within reach. Because bandwidth is precious and battery life is finite, every part of the application was engineered to be lightweight and resilient:
            </p>
            
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <li className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block">
                  Global Edge Hosting
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Code runs on Cloudflare’s worldwide edge network near US users, keeping responses under a second.
                </p>
              </li>
              <li className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl space-y-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block">
                  Works When Offline
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Core screens and stored data stay accessible even on spotty job-site coverage or unstable mobile signals.
                </p>
              </li>
              <li className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                  Minimal Bandwidth
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Map queries and data requests are strictly deduplicated and cached, eliminating wasted calls and mobile lag.
                </p>
              </li>
            </ul>

            <p className="pt-2 text-slate-300">
              Why focus on local home service trades? Plumbers, electricians, roofers, HVAC mechanics, and landscapers keep communities running every day. They don’t have time for bloated corporate dashboards; they need clean local map visibility, verified customer proof, and fast tools to respond before competitors do.
            </p>
          </div>
        </section>

        {/* 3. Product Timeline — Honest & Modest */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Calendar size={15} className="text-indigo-400" />
            <span>Milestones</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Product Timeline
          </h2>

          <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-8">
            <div className="relative">
              <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-4 border-[#06080d]" />
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400">February 2026</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Geospatial Engine &amp; Local Search</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Initial edge mapping and service-radius calculations to help contractors analyze their local service coverage without wasting API quota.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-4 border-[#06080d]" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">May 2026</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Money-First Diagnostics &amp; Free Audits</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Shifted from generic dashboards to actionable local presence audits and direct revenue opportunity calculations for trade businesses.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-amber-500 border-4 border-[#06080d]" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">August 2026</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Multi-Provider AI Fallbacks &amp; Offline Mode</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Added fallback routing between Gemini and Groq models so operations stay reliable, paired with offline support for poor mobile connections.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-sky-500 border-4 border-[#06080d]" />
              <span className="text-xs font-black uppercase tracking-wider text-sky-400">September 2026</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Production Launch on bvelt.app &amp; Pro Plans</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Deployed live production on bvelt.app, integrated live Stripe subscription flows ($49/month), and enabled verified diagnostic reports.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Support Section — Maximum Verifiability */}
        <section id="support" className="space-y-6 pt-4 scroll-mt-20">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Heart size={15} className="text-amber-400" />
            <span>Voluntary Support</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            If You Want to Support This Work
          </h2>

          <div className="p-5 sm:p-6 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Voluntary contributions directly help maintain basic working conditions—sustainable electricity backup, reliable mobile connectivity, and development equipment—while Bvelt scales toward its first paying customers.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Because conventional international banking and merchant payout transfers are restricted in Cuba, cryptocurrency transfers via stablecoins (USDT or USDC) are the only practical way to send personal support across borders.
            </p>

            {/* Warning Box */}
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed">
                <strong className="text-amber-300 font-bold block mb-0.5">Important Network Warning:</strong>
                Send only on the specified blockchain network. Sending tokens through an incompatible network or mismatched chain will result in permanent loss. Always compare the full published address character by character before confirming.
              </div>
            </div>

            {/* Address Option 1: BNB Smart Chain */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                    Option 1 (Primary)
                  </span>
                  <span className="text-xs font-bold text-slate-300">BNB Smart Chain (BEP-20)</span>
                </div>
                <span className="text-[11px] text-slate-400">USDT or USDC</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
                    BEP-20 Wallet Address
                  </span>
                  <p className="font-mono text-xs sm:text-sm text-slate-200 select-all break-all">
                    {bscAddress}
                  </p>
                  <a
                    href="https://bscscan.com/address/0x533Fb6fb014421852184DB97e6b6E5Ae2f08D207"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-1 font-medium transition"
                  >
                    <span>Verify on BscScan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(bscAddress, 'bsc')}
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-bold text-xs transition cursor-pointer self-start sm:self-center ${
                    copiedKey === 'bsc'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  {copiedKey === 'bsc' ? (
                    <>
                      <Check size={14} />
                      <span>Address Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Address Option 2: Solana */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                    Option 2 (Secondary)
                  </span>
                  <span className="text-xs font-bold text-slate-300">Solana Network</span>
                </div>
                <span className="text-[11px] text-slate-400">USDT or USDC on Solana</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-0.5">
                    Solana Wallet Address
                  </span>
                  <p className="font-mono text-xs sm:text-sm text-slate-200 select-all break-all">
                    {solanaAddress}
                  </p>
                  <a
                    href="https://solscan.io/account/AsSmUDq6XuibVqhCcfVSFgW4zw2f3wxHgvVqqcLi73rU"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 mt-1 font-medium transition"
                  >
                    <span>Verify on Solscan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(solanaAddress, 'sol')}
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-bold text-xs transition cursor-pointer self-start sm:self-center ${
                    copiedKey === 'sol'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                  }`}
                >
                  {copiedKey === 'sol' ? (
                    <>
                      <Check size={14} />
                      <span>Address Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Questions contact block near support */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300">
                Have questions before sending or want to verify an address directly?
              </span>
              <a
                href="mailto:bveltpro@gmail.com"
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
              >
                <Mail size={13} />
                <span>bveltpro@gmail.com</span>
              </a>
            </div>

            {/* Legal Notice */}
            <div className="pt-2 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong>Legal Clarity:</strong> This is voluntary direct support given to an individual creator. It is not a registered charitable organization or non-profit, conveys no equity or investment rights, and does not constitute a purchase of a Bvelt subscription.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Help Without Money */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Share2 size={15} className="text-indigo-400" />
            <span>Other Ways to Help</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            How You Can Support Without Money
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-black text-indigo-400 uppercase tracking-wider block">1. Try the Product</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Run a free market diagnosis on your own local business or client on{' '}
                <a href="https://bvelt.app/" className="text-indigo-300 underline font-semibold">bvelt.app</a>.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">2. Share with Trades</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Introduce Bvelt to contractors, plumbers, roofers, or home technicians who need better local map positioning.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">3. Report Bugs</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                If you encounter any edge issues or layout glitches, email feedback directly to{' '}
                <a href="mailto:bveltpro@gmail.com" className="text-amber-300 underline font-semibold">bveltpro@gmail.com</a>.
              </p>
            </div>
          </div>
        </section>

        {/* 6. FAQ Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <HelpCircle size={15} className="text-indigo-400" />
            <span>Frequently Asked Questions</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Questions &amp; Verification
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-1.5">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Is this a charity or non-profit organization?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                No. Any transfer is a direct personal gift to an independent software engineer living in Cuba to help sustain basic working conditions (power, connectivity, development tools). It does not qualify for tax deductions.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-1.5">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Is this an investment or equity stake?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                No. It confers no ownership, equity, shares, governance, token claim, or expectation of financial return.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-1.5">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                How can I confirm the wallet addresses are authentic?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                The addresses published on this exact canonical page (<span className="text-slate-300 font-mono">https://bvelt.app/about</span>) are the only official public addresses. You can also inspect both addresses on public blockchain explorers via the BscScan and Solscan links provided above. Never trust addresses sent over private messages or unofficial forums.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-1.5">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Is Bvelt free for businesses to try?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Yes. Any local business or contractor can run an initial local presence check and audit for free on <a href="https://bvelt.app/" className="text-indigo-400 underline font-semibold">bvelt.app</a> without entering credit card details.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-10 px-6 text-center text-xs text-slate-500 bg-[#06080d]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Bvelt Suite. Crafted by Rainer Blanco.</p>
          <div className="flex items-center gap-6">
            <a href="/" onClick={handleHomeClick} className="hover:text-slate-300 transition">
              Home
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">
              Terms
            </a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">
              Privacy
            </a>
            <a href="mailto:bveltpro@gmail.com" className="hover:text-slate-300 transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
