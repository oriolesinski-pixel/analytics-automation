export default function ShippingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shipping Information</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Shipping Options</h2>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-2">Standard Shipping (5-7 business days)</h3>
              <p className="text-gray-600">Free on orders over $50</p>
              <p className="text-gray-600">$5.99 for orders under $50</p>
            </div>
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-2">Express Shipping (2-3 business days)</h3>
              <p className="text-gray-600">$12.99 for all orders</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Next Day Delivery</h3>
              <p className="text-gray-600">$24.99 for all orders</p>
              <p className="text-sm text-gray-500">Order before 2 PM for next day delivery</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Shipping Regions</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 mb-4">We currently ship to all 50 US states and territories.</p>
            <p className="text-gray-700 mb-4">International shipping coming soon!</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Tracking Your Order</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 mb-4">
              Once your order ships, you'll receive an email with tracking information.
              You can also track your order by logging into your account.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Shipping FAQ</h2>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">How long does processing take?</h3>
              <p className="text-gray-600">Orders are typically processed within 1-2 business days.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you ship on weekends?</h3>
              <p className="text-gray-600">Orders placed on weekends will be processed on the next business day.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I change my shipping address?</h3>
              <p className="text-gray-600">You can change your shipping address before the order is processed.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
