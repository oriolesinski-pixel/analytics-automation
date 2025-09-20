export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">About TestShop</h1>
      
      <div className="prose max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
          <p className="text-gray-700 mb-4">
            TestShop is a demonstration e-commerce platform built to showcase comprehensive analytics tracking capabilities.
            Our platform serves as a fully functional online store while providing rich data for analytics automation testing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-gray-700 mb-4">
            We aim to provide a realistic e-commerce experience that generates diverse user interaction data,
            enabling thorough testing of analytics tracking and automation systems.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Complete e-commerce functionality</li>
            <li>User authentication and profiles</li>
            <li>Product browsing and search</li>
            <li>Shopping cart and wishlist</li>
            <li>Secure checkout process</li>
            <li>Order tracking and history</li>
            <li>Rich analytics event tracking</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p className="text-gray-700">
            Email: demo@testshop.com<br />
            Phone: (555) 123-4567<br />
            Address: 123 Demo Street, Test City, TC 12345
          </p>
        </section>
      </div>
    </div>
  );
}
