export default function ReturnsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Return Policy</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">30-Day Return Policy</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 mb-4">
              We want you to be completely satisfied with your purchase. If you're not happy with your order,
              you can return it within 30 days of delivery for a full refund or exchange.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Return Conditions</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Items must be unused and in original packaging</li>
              <li>Include all accessories and documentation</li>
              <li>Provide proof of purchase (order number or receipt)</li>
              <li>Some items may be subject to restocking fees</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">How to Return</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <ol className="list-decimal pl-6 text-gray-700 space-y-2">
              <li>Log into your account and go to Order History</li>
              <li>Select the order containing the item(s) you want to return</li>
              <li>Click "Return Items" and follow the instructions</li>
              <li>Print the prepaid shipping label</li>
              <li>Pack the items securely and attach the label</li>
              <li>Drop off at any authorized shipping location</li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Refund Processing</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 mb-4">
              Once we receive your return, we'll inspect the items and process your refund within 5-7 business days.
              The refund will be credited to your original payment method.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Non-Returnable Items</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Digital products and software licenses</li>
              <li>Opened electronic media (CDs, DVDs, etc.)</li>
              <li>Personal care items</li>
              <li>Customized or personalized items</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Support</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 mb-4">
              Have questions about returns? Contact our customer support team:
            </p>
            <p className="text-gray-700">
              Email: returns@testshop.com<br />
              Phone: (555) 123-4567<br />
              Hours: Monday-Friday, 9 AM - 5 PM EST
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
