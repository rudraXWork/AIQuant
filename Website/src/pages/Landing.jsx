import React from 'react';
import { Link } from 'react-router-dom';
import aiquantLogo from '../assets/image.png';

const STATS = [
  { label: 'Active traders', value: '250K+' },
  { label: 'Paper trades placed', value: '10M+' },
  { label: 'Markets covered', value: '45+ global' },
  { label: 'No-credit-card trials', value: '100% free' },
];

const FEATURES = [
  {
    title: 'Real-time market data',
    body: 'Stream live NSE/BSE prices, depth, and movers in one cockpit.',
  },
  {
    title: 'AI-driven insights',
    body: 'Signal layers that flag trend shifts, volatility spikes, and momentum.',
  },
  {
    title: 'Paper trading mode',
    body: 'Practice with virtual cash and realistic fills without risk.',
  },
  {
    title: 'Portfolio intelligence',
    body: 'Track P&L, exposure, and allocation with clean summaries.',
  },
  {
    title: 'Strategy sandbox',
    body: 'Backtest ideas and compare outcomes with leaderboard benchmarks.',
  },
  {
    title: 'Secure access',
    body: 'OTP login, wallet overview, and privacy-first data handling.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Register in seconds and unlock a $100,000 paper wallet.',
  },
  {
    step: '02',
    title: 'Practice & trade',
    body: 'Use live prices, insights, and charts to test every idea.',
  },
  {
    step: '03',
    title: 'Analyze & improve',
    body: 'Review performance, spot strengths, and iterate faster.',
  },
];

const Landing = () => {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 landing-grid" />
      <div className="pointer-events-none absolute -top-40 right-0 h-[420px] w-[420px] rounded-full bg-emerald-400/25 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-0 h-[380px] w-[380px] rounded-full bg-emerald-500/15 blur-[140px]" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-16 lg:flex-row lg:items-center lg:gap-14">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <div className="logo-frame">
              <img src={aiquantLogo} alt="AIQuant logo" className="logo-glow" />
            </div>
            <div className="text-base sm:text-lg font-semibold uppercase tracking-[0.35em] text-emerald-300 transition hover:text-emerald-200">
              AIQuant
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Live + paper trading platform
          </div>
          <div className="space-y-4">
            <h1 className="landing-heading text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Paper trading meets
              <span className="text-emerald-400"> real-time AI insights</span>
            </h1>
            <p className="max-w-xl text-base text-slate-300 sm:text-lg">
              AIQuant helps you practice, analyze, and master the markets with live data,
              smart signals, and a risk-free trading simulator built for serious traders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/login?mode=register"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-slate-500"
            >
              Log in
            </Link>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex -space-x-2">
                <div className="h-8 w-8 rounded-full border border-slate-800 bg-slate-700" />
                <div className="h-8 w-8 rounded-full border border-slate-800 bg-slate-600" />
                <div className="h-8 w-8 rounded-full border border-slate-800 bg-slate-500" />
              </div>
              4.8/5 rating from active traders
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="relative mx-auto max-w-lg rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-emerald-500/10 float-slow">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Paper Account</span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                +2.4% today
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-400">Balance</p>
                <p className="text-3xl font-semibold text-white">₹100,000.00</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Total P&L</p>
                <p className="text-lg font-semibold text-emerald-400">+₹5,678.90</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Market Momentum</span>
                <span className="text-emerald-300">LIVE</span>
              </div>
              <div className="mt-4 h-32 w-full">
                <svg viewBox="0 0 320 120" className="h-full w-full">
                  <defs>
                    <linearGradient id="chartGlow" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M10 90 L50 70 L90 78 L130 55 L170 68 L210 35 L250 42 L310 18"
                    fill="none"
                    stroke="url(#chartGlow)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 90 L50 70 L90 78 L130 55 L170 68 L210 35 L250 42 L310 18 L310 120 L10 120 Z"
                    fill="url(#chartGlow)"
                    opacity="0.12"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-slate-500">NIFTY 50</p>
                <p className="text-base font-semibold text-emerald-300">+1.8%</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-slate-500">BANKNIFTY</p>
                <p className="text-base font-semibold text-emerald-300">+2.1%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-emerald-500/10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="space-y-2">
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20 pt-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Features</p>
            <h2 className="landing-heading mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Everything you need to trade smarter
            </h2>
          </div>
          <div className="hidden text-sm text-slate-400 lg:block">
            Real-time signals. Clean execution. Confidence builders.
          </div>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:-translate-y-1 hover:border-emerald-500/40"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <span className="text-lg">◆</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">How it works</p>
              <h2 className="landing-heading mt-4 text-3xl font-semibold text-white sm:text-4xl">
                Build a repeatable trading edge
              </h2>
              <p className="mt-4 text-sm text-slate-400">
                Onboard in minutes, practice with live market flows, and sharpen every move with
                structured reviews.
              </p>
            </div>
            <div className="flex-1 space-y-4">
              {STEPS.map((step) => (
                <div key={step.step} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-sm font-semibold text-emerald-300">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <h2 className="landing-heading text-3xl font-semibold text-white sm:text-4xl">
            Ready to level up your trading?
          </h2>
          <p className="mt-4 text-sm text-emerald-100">
            Join AIQuant today and get full access to insights, simulations, and live dashboards.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/login?mode=register"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              Create free account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-400/60 bg-transparent px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-500/10"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
