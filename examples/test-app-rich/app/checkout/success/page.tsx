'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || 'ORD' + Date.now();
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    // Clear any remaining cart data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shippingInfo');
    }
    
    // Remove confetti after animation
    setTimeout(() => setConfetti(false), 3000);
  }, []);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Thank you for your purchase</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <p className="text-sm text-gray-600 mb-2">Order Number</p>
          <p className="text-xl font-semibold">{orderId}</p>
          <p className="text-sm text-gray-600 mt-4">
            We've sent a confirmation email with your order details.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/products"
            className="block w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            className="block w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-600">
          <p>Estimated delivery: 5-7 business days</p>
          <p className="mt-2">
            Questions? Contact us at{' '}
            <a href="mailto:support@testshop.com" className="text-blue-600 hover:underline">
              support@testshop.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
