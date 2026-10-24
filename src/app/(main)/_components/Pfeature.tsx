'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Feature {
  name: string
  free: boolean
  premium: boolean
}

const FEATURES: Feature[] = [
  { name: 'AI career coach chat', free: true, premium: true },
  { name: 'Career quiz & personalised career', free: true, premium: true },
  { name: 'AI roadmap generation', free: true, premium: true },
  { name: 'Mock tests with checkpoints', free: true, premium: true },
  { name: 'Resume builder with print/export', free: true, premium: true },
  { name: 'Mentor session booking (credits)', free: true, premium: true },
  { name: 'Credits included', free: false, premium: true },
  { name: 'Priority support', free: false, premium: true },
]

export function PricingFeaturesTable() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          {/* Table Header */}
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Features</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Free Plan</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Pro Plan</th>
            </tr>
          </thead>
          {/* Table Body */}
          <tbody className="divide-y divide-gray-200">
            {FEATURES.map((feature, index) => (
              <tr key={index} className={cn(index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                <td className="px-6 py-4 text-sm text-gray-700">{feature.name}</td>
                <td className="px-6 py-4 text-center">
                  {feature.free ? (
                    <Check className="mx-auto h-5 w-5 text-gray-800" />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {feature.premium ? (
                    <Check className="mx-auto h-5 w-5 text-gray-800" />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
