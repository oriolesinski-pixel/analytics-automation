"use client"

import Link from "next/link"
import Image from "next/image"
import { Product } from "@/lib/data/products"
import { useCart } from "@/contexts/CartContext"

interface ProductCardProps {
  product: Product
  viewMode: "grid" | "list"
}

export default function ProductCard({ product, viewMode }: ProductCardProps) {
  const { addToCart } = useCart()
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    addToCart(product)
  }
  
  if (viewMode === "list") {
    return (
      <div className="flex gap-4 p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
        <div className="relative w-32 h-32 flex-shrink-0">
          <Image 
            src={product.image || "https://via.placeholder.com/400x300/cccccc/666666?text=Product"} 
            alt={product.name}
            fill
            sizes="128px"
            className="object-cover rounded"
          />
        </div>
        <div className="flex-1">
          <Link href={`/products/${product.id}`} className="text-lg font-semibold hover:text-blue-600">
            {product.name}
          </Link>
          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.description}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xl font-bold text-blue-600">${product.price}</span>
            <div className="flex gap-2">
              <button 
                onClick={handleAddToCart}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-all">
      <Link href={`/products/${product.id}`}>
        <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
          <Image 
            src={product.image || "https://via.placeholder.com/400x300/cccccc/666666?text=Product"} 
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      </Link>
      <div className="p-4">
        <Link href={`/products/${product.id}`} className="font-semibold hover:text-blue-600 line-clamp-1">
          {product.name}
        </Link>
        <p className="text-gray-600 text-sm mt-1">{product.category}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex text-yellow-400">
            {"★".repeat(Math.floor(product.rating))}{"☆".repeat(5-Math.floor(product.rating))}
          </div>
          <span className="text-xs text-gray-500">({product.reviews})</span>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-blue-600">${product.price}</span>
          <button className="text-gray-400 hover:text-red-500 transition-colors">♡</button>
        </div>
        <button 
          onClick={handleAddToCart}
          className="w-full mt-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Add to Cart
        </button>
      </div>
    </div>
  )
}
