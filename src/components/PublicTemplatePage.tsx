import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Copy, 
  Check, 
  Sparkles, 
  MessageSquare, 
  Zap, 
  ArrowRight, 
  ChevronRight, 
  Globe, 
  ShieldCheck, 
  Star,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { RESPONSE_TEMPLATES, ResponseTemplate } from '../data/templatesData';

interface PublicTemplatePageProps {
  slug: string;
  onGetStarted?: () => void;
}

export function PublicTemplatePage({ slug, onGetStarted }: PublicTemplatePageProps) {
  const [copied, setCopied] = useState(false);

  const currentTemplate: ResponseTemplate | undefined = RESPONSE_TEMPLATES[slug];
  const allTemplates = Object.values(RESPONSE_TEMPLATES);

  // SEO & OpenGraph Meta Tag Injections
  useEffect(() => {
    const titleText = currentTemplate 
      ? currentTemplate.seoTitle 
      : 'Free Local Business Message Templates | Bvelt';
    const descText = currentTemplate 
      ? currentTemplate.metaDescription 
      : 'Explore free professional WhatsApp, SMS, and email response templates for local contractors and service businesses.';

    document.title = titleText;

    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', descText);

    // OpenGraph Title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', titleText);

    // OpenGraph Description
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', descText);

    // OpenGraph Type
    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement('meta');
      ogType.setAttribute('property', 'og:type');
      document.head.appendChild(ogType);
    }
    ogType.setAttribute('content', 'website');

    // Schema.org JSON-LD
    let scriptTag = document.getElementById('json-ld-template-schema') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'json-ld-template-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const schemaData = currentTemplate ? {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": currentTemplate.h1,
      "description": currentTemplate.metaDescription,
      "category": currentTemplate.category,
      "tool": {
        "@type": "HowToTool",
        "name": "Bvelt Local Sales AI"
      },
      "step": [
        {
          "@type": "HowToStep",
          "name": "Review Customer Message",
          "text": currentTemplate.clientMessage
        },
        {
          "@type": "HowToStep",
          "name": "Send Professional Quote Reply",
          "text": currentTemplate.replyTemplate
        }
      ]
    } : {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Bvelt Local AI Response Generator",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "All",
      "description": descText,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    };

    scriptTag.text = JSON.stringify(schemaData);

    return () => {
      // Clean up script tag on unmount if needed
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.removeChild(scriptTag);
      }
    };
  }, [slug, currentTemplate]);

  const handleCopy = () => {
    if (!currentTemplate) return;
    navigator.clipboard.writeText(currentTemplate.replyTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCtaClick = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      window.location.href = '/';
    }
  };

  if (!currentTemplate) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Navigation Header */}
        <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-white font-black text-lg tracking-tight hover:opacity-90 transition">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                BV
              </div>
              <span>Bvelt</span>
            </a>
            <button
              onClick={handleCtaClick}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </header>

        {/* Directory fallback */}
        <main className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full space-y-8">
          <div className="text-center space-y-3">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-black uppercase tracking-wider inline-block">
              Free Response Templates
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Customer Response Templates for Local Services
            </h1>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Select a template below to view customer examples and copy ready-to-send professional estimates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allTemplates.map(tmpl => (
              <a
                key={tmpl.slug}
                href={`/templates/${tmpl.slug}`}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition flex flex-col justify-between space-y-3 group cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    {tmpl.category}
                  </span>
                  <h3 className="text-base font-black text-white group-hover:text-indigo-300 transition mt-1">
                    {tmpl.h1}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {tmpl.summary}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>View & Copy Template</span>
                  <ChevronRight size={14} />
                </div>
              </a>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Bvelt Local Sales AI. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white font-black text-lg tracking-tight hover:opacity-90 transition">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
              BV
            </div>
            <span>Bvelt</span>
          </a>

          <button
            onClick={handleCtaClick}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>Create yours free with Bvelt</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-8">
        {/* Breadcrumb back link */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <a href="/" className="hover:text-white transition flex items-center gap-1">
            <ArrowLeft size={12} />
            <span>Home</span>
          </a>
          <span>/</span>
          <span className="text-slate-500">Templates</span>
          <span>/</span>
          <span className="text-indigo-400 font-medium truncate">{currentTemplate.slug}</span>
        </div>

        {/* H1 Heading */}
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
              {currentTemplate.category}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Free Response Template
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
            {currentTemplate.h1}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
            {currentTemplate.summary} Copy the proven response template below or generate personalized, high-converting replies for your trade automatically using Bvelt AI.
          </p>
        </div>

        {/* 2 Main Card Boxes: Client Message & Professional Reply */}
        <div className="space-y-6">
          {/* 1. Client Message Box */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-amber-400" />
                Sample Client Message
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">
                Incoming Request
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed italic bg-slate-950/60 p-4 rounded-xl border border-slate-800/50">
              "{currentTemplate.clientMessage}"
            </p>
          </div>

          {/* 2. Professional Reply Box (Ready to Copy) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border-2 border-indigo-500/40 shadow-xl space-y-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-400" />
                  Professional Reply Template (Ready to Copy)
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Template</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed font-mono whitespace-pre-line select-all">
              {currentTemplate.replyTemplate}
            </div>
          </div>
        </div>

        {/* Primary CTA Block */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/40 shadow-2xl text-center space-y-5 my-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black uppercase tracking-wider">
            <Zap size={14} className="text-amber-300 fill-current" />
            <span>Stop Writing Messages Manually</span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight max-w-xl mx-auto">
            Generate custom, winning replies for your business in 5 seconds
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Bvelt AI analyzes incoming client WhatsApp messages, estimates prices based on your trade, and drafts ready-to-send replies that close jobs faster.
          </p>

          <div className="pt-2 flex flex-col items-center gap-3">
            <button
              onClick={handleCtaClick}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm sm:text-base rounded-2xl transition shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={18} className="text-amber-300" />
              <span>Create yours free with Bvelt</span>
              <ArrowRight size={18} />
            </button>

            {/* Mandated ROI Text */}
            <p className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck size={14} />
              <span>One job can pay for Bvelt Pro at $49/mo</span>
            </p>
          </div>
        </div>

        {/* Other Templates Directory Links */}
        <div className="border-t border-slate-800/80 pt-8 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
            More Free Response Templates
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allTemplates
              .filter(t => t.slug !== slug)
              .map(tmpl => (
                <a
                  key={tmpl.slug}
                  href={`/templates/${tmpl.slug}`}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition flex flex-col justify-between space-y-1.5 group cursor-pointer"
                >
                  <span className="text-[9px] font-black uppercase text-indigo-400">
                    {tmpl.category}
                  </span>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition truncate">
                    {tmpl.h1}
                  </h4>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-indigo-400 transition">
                    <span>View template</span>
                    <ChevronRight size={12} />
                  </div>
                </a>
              ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 font-bold">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-[10px]">BV</div>
            <span>Bvelt Local Sales AI</span>
          </div>
          <p>© {new Date().getFullYear()} Bvelt. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
