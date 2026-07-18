import { useSubscription } from '@/hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Zap } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: [
      'Access to public courses',
      '5 AI-generated questions/month',
      'Community posts & discussions',
      'Basic progress tracking',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    features: [
      'All Free features',
      'Unlimited AI-generated questions',
      'AI-powered study plans',
      'Offline access to courses',
      'Priority support',
      'Advanced analytics',
      'No ads',
    ],
    highlighted: true,
  },
]

export default function SubscriptionPage() {
  const { startCheckout, loading } = useSubscription()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-slate-600">Unlock unlimited learning potential</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.highlighted ? 'md:scale-105 border-2 border-blue-500 shadow-2xl' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Most Popular
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-slate-600">{plan.period}</span>}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'pro' && (
                  <button
                    onClick={() => startCheckout(plan.id)}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {loading ? 'Processing...' : 'Upgrade to Pro'}
                  </button>
                )}
                {plan.id === 'free' && (
                  <button
                    disabled
                    className="w-full px-6 py-3 bg-slate-200 text-slate-500 rounded-lg font-semibold"
                  >
                    Current Plan
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-slate-700">
            All plans include a 7-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
