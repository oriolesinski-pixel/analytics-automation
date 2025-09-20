export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8 mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">TestShop</h3>
            <p className="text-gray-400">Your trusted e-commerce demo platform for analytics testing.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/products" className="hover:text-white transition-colors">Products</a></li>
              <li><a href="/cart" className="hover:text-white transition-colors">Cart</a></li>
              <li><a href="/wishlist" className="hover:text-white transition-colors">Wishlist</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Categories</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/products?category=Electronics" className="hover:text-white transition-colors">Electronics</a></li>
              <li><a href="/products?category=Gaming" className="hover:text-white transition-colors">Gaming</a></li>
              <li><a href="/products?category=Accessories" className="hover:text-white transition-colors">Accessories</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <p className="text-gray-400">Email: demo@testshop.com</p>
            <p className="text-gray-400">Phone: (555) 123-4567</p>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-gray-400">
          <p>&copy; 2024 TestShop. Demo application for analytics testing.</p>
        </div>
      </div>
    </footer>
  );
}
