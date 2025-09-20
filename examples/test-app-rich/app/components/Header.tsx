'use client';

import Link from 'next/link';
import { ShoppingCart, Heart, User, Menu } from 'lucide-react';
import { useCart } from '@/app/contexts/CartContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { useState } from 'react';

export default function Header() {
  const { itemCount } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-blue-600">
            TestShop
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-colors">
              Products
            </Link>
            <Link href="/about" className="text-gray-700 hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link href="/shipping" className="text-gray-700 hover:text-blue-600 transition-colors">
              Shipping
            </Link>
            <Link href="/returns" className="text-gray-700 hover:text-blue-600 transition-colors">
              Returns
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/wishlist" className="relative text-gray-700 hover:text-blue-600 transition-colors">
              <Heart className="w-6 h-6" />
            </Link>
            <Link href="/cart" className="relative text-gray-700 hover:text-blue-600 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">{user?.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/auth/login" className="text-gray-700 hover:text-blue-600 transition-colors">
                <User className="w-6 h-6" />
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-2">
              <Link href="/products" className="text-gray-700 hover:text-blue-600 py-2">
                Products
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-blue-600 py-2">
                About
              </Link>
              <Link href="/shipping" className="text-gray-700 hover:text-blue-600 py-2">
                Shipping
              </Link>
              <Link href="/returns" className="text-gray-700 hover:text-blue-600 py-2">
                Returns
              </Link>
              <Link href="/wishlist" className="text-gray-700 hover:text-blue-600 py-2">
                Wishlist
              </Link>
              <Link href="/cart" className="text-gray-700 hover:text-blue-600 py-2">
                Cart ({itemCount})
              </Link>
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-600 py-2">{user?.name}</span>
                  <button
                    onClick={logout}
                    className="text-gray-700 hover:text-blue-600 py-2 text-left"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/auth/login" className="text-gray-700 hover:text-blue-600 py-2">
                  Login
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
