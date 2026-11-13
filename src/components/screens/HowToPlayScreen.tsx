/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, Dices, Shield, Swords, Home, Trophy, Repeat, ArrowRight } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface HowToPlayScreenProps {
  onBack: () => void;
  onPlayNow: () => void;
}

export const HowToPlayScreen: React.FC<HowToPlayScreenProps> = ({
  onBack,
  onPlayNow,
}) => {
  const rules = [
    {
      icon: Dices,
      title: '1. Leaving the Yard',
      description:
        'All 4 of your tokens start locked in your colored corner yard. You must roll a 6 to bring a token out onto your colored starting square (step 0).',
      tag: 'Need a 6',
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    },
    {
      icon: Repeat,
      title: '2. Bonus Rolls & Extra Turns',
      description:
        'You earn an immediate extra roll whenever you: (1) Roll a 6, (2) Capture an opponent’s token, or (3) Successfully bring a token into the center Home. Note: Rolling three 6s in a row forfeits your turn!',
      tag: 'Bonus Turn',
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    },
    {
      icon: Swords,
      title: '3. Capturing Opponents',
      description:
        'If your token lands on an unsafe track square occupied by an opponent’s token, their token is captured and sent back to their starting yard! You also earn an extra roll as a reward.',
      tag: 'Capture & Reset',
      color: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    },
    {
      icon: Shield,
      title: '4. Safe Star Cells',
      description:
        'There are 8 designated Safe Squares on the board: the 4 colored starting squares and 4 squares marked with a golden Star (★). Tokens on safe cells cannot be captured by anyone!',
      tag: 'Immunity Zones',
      color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    },
    {
      icon: Home,
      title: '5. The Colored Home Stretch',
      description:
        'After completing a full circuit around the 52-cell outer track, your tokens turn into your private colored home lane. Opponents cannot enter your home lane.',
      tag: 'Protected Lane',
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    },
    {
      icon: Trophy,
      title: '6. Entering Home & Victory',
      description:
        'To land in the center Home triangle (step 56), you must roll the exact number required. The first player to bring all 4 tokens into Home wins the match!',
      tag: 'Exact Roll Wins',
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onBack();
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display text-white">
              Official MUDO Game Rules
            </h1>
            <p className="text-xs text-slate-400">
              Complete international Ludo rules &amp; strategic masterclass
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onPlayNow();
          }}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow"
        >
          <span>Play Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rules Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule, idx) => {
          const Icon = rule.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-slate-800 text-white">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${rule.color}`}
                  >
                    {rule.tag}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white pt-1">
                  {rule.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Board Layout Diagram Guide */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white">
          Board Orientation &amp; Colors
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
            <span className="font-bold block">Red Yard</span>
            <span className="text-[11px] text-slate-400">Bottom-Left</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
            <span className="font-bold block">Green Yard</span>
            <span className="text-[11px] text-slate-400">Top-Left</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300">
            <span className="font-bold block">Yellow Yard</span>
            <span className="text-[11px] text-slate-400">Top-Right</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-300">
            <span className="font-bold block">Blue Yard</span>
            <span className="text-[11px] text-slate-400">Bottom-Right</span>
          </div>
        </div>
      </div>
    </div>
  );
};
