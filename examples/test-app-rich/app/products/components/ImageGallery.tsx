"use client"

import { useState } from "react"
import Image from "next/image"

export default function ImageGallery({ images }: { images: string[] }) {
  const [selectedImage, setSelectedImage] = useState(0)
  
  // Use first image or fallback
  const displayImages = images?.length > 0 ? images : [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop"
  ]
  
  return (
    <div>
      <div className="relative h-96 rounded-lg mb-4 overflow-hidden bg-gray-100">
        <Image 
          src={displayImages[selectedImage]} 
          alt="Product"
          fill
          className="object-cover"
        />
      </div>
      {displayImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {displayImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedImage(i)}
              className={`relative h-20 rounded overflow-hidden ${
                selectedImage === i ? 'ring-2 ring-blue-600' : ''
              }`}
            >
              <Image 
                src={img} 
                alt={`View ${i + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
