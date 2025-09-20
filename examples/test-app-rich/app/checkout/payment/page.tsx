'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/app/contexts/CartContext';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';

export default function PaymentPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
    saveCard: false
  });

  const shippingInfo = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('shippingInfo') || '{}')
    : {};

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(async () => {
      try {
        const orderData = {
          items: items.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          shippingInfo,
          paymentInfo: {
            last4: paymentData.cardNumber.slice(-4),
            cardName: paymentData.cardName
          },
          total: totalAmount * 1.1,
          userId: user?.id || 'guest'
        };

        try {
          const response = await fetch('http://localhost:3002/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify(orderData)
          });

          if (response.ok) {
            const order = await response.json();
            clearCart();
            router.push(`/checkout/success?orderId=${order.id}`);
            return;
          }
        } catch (error) {
          console.log('Backend not available, using mock order');
        }

        const mockOrderId = 'ORD' + Date.now();
        clearCart();
        router.push(`/checkout/success?orderId=${mockOrderId}`);
        
      } catch (error) {
        console.error('Payment error:', error);
        alert('Payment processing failed. Please try again.');
        setIsProcessing(false);
      }
    }, 2000);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s+/g, '');
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ') : value;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Payment</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
            <p className="text-gray-600">
              {shippingInfo.firstName} {shippingInfo.lastName}<br />
              {shippingInfo.address}<br />
              {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}<br />
              {shippingInfo.country}
            </p>
            <Link href="/checkout" className="text-blue-600 hover:underline text-sm">
              Edit Address
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  required
                  maxLength={19}
                  className="w-full px-4 py-2 border rounded-lg"
                  value={formatCardNumber(paymentData.cardNumber)}
                  onChange={(e) => setPaymentData({
                    ...paymentData, 
                    cardNumber: e.target.value.replace(/\s+/g, '')
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">Test card: 0000 0000 0000 0000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={paymentData.cardName}
                  onChange={(e) => setPaymentData({...paymentData, cardName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    required
                    maxLength={5}
                    className="w-full px-4 py-2 border rounded-lg"
                    value={paymentData.expiryDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value.length === 2 && !value.includes('/')) {
                        value = value + '/';
                      }
                      setPaymentData({...paymentData, expiryDate: value});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    placeholder="123"
                    required
                    maxLength={3}
                    className="w-full px-4 py-2 border rounded-lg"
                    value={paymentData.cvv}
                    onChange={(e) => setPaymentData({...paymentData, cvv: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="saveCard"
                  className="mr-2"
                  checked={paymentData.saveCard}
                  onChange={(e) => setPaymentData({...paymentData, saveCard: e.target.checked})}
                />
                <label htmlFor="saveCard" className="text-sm text-gray-700">
                  Save card for future purchases
                </label>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className={`w-full py-3 rounded-lg transition-colors ${
                  isProcessing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isProcessing ? 'Processing...' : `Pay $${(totalAmount * 1.1).toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${(totalAmount * 0.1).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg mt-2">
                <span>Total</span>
                <span>${(totalAmount * 1.1).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
