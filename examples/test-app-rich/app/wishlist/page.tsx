'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, X } from 'lucide-react';
import { useWishlist } from '@/app/contexts/WishlistContext';
import { useCart } from '@/app/contexts/CartContext';
import { products } from '@/app/data/products';

export default function WishlistPage() {
  const { items, toggleWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  
  const wishlistProducts = products.filter(p => items.includes(p.id));

  if (wishlistProducts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Your Wishlist is Empty</h1>
        <p className="text-gray-600 mb-8">Save your favorite items for later!</p>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Wishlist ({wishlistProducts.length})</h1>
        <button
          onClick={clearWishlist}
          className="text-red-600 hover:text-red-700"
        >
          Clear All
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlistProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative h-48">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
              />
              <button
                onClick={() => toggleWishlist(product.id)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:shadow-lg transition-shadow"
              >
                <X className="w-5 h-5 text-red-500" />
              </button>
            </div>
            <div className="p-4">
              <Link href={`/products/${product.id}`}>
                <h3 className="font-semibold text-lg mb-2 hover:text-blue-600">{product.name}</h3>
              </Link>
              <p className="text-2xl font-bold text-blue-600 mb-3">${product.price}</p>
              <button
                onClick={() => {
                  addToCart(product);
                  toggleWishlist(product.id);
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Move to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
