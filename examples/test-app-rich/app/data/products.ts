export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  specs?: Record<string, string>;
}

export const products: Product[] = [
  {
    id: 1,
    name: "MacBook Pro 16\"",
    price: 2499.99,
    category: "Electronics",
    image: "/images/products/macbook-pro.jpg",
    description: "Powerful laptop with M3 Pro chip, stunning Liquid Retina XDR display, and all-day battery life.",
    rating: 4.8,
    reviews: 342,
    inStock: true,
    specs: {
      "Processor": "Apple M3 Pro",
      "Memory": "32GB Unified Memory",
      "Storage": "1TB SSD",
      "Display": "16.2-inch Liquid Retina XDR"
    }
  },
  {
    id: 2,
    name: "iPhone 15 Pro",
    price: 1199.99,
    category: "Electronics",
    image: "/images/products/iphone-15-pro.jpg",
    description: "The most powerful iPhone ever with A17 Pro chip, titanium design, and advanced camera system.",
    rating: 4.9,
    reviews: 1250,
    inStock: true,
    specs: {
      "Display": "6.1-inch Super Retina XDR",
      "Chip": "A17 Pro",
      "Camera": "48MP Main | 12MP Ultra Wide",
      "Storage": "256GB"
    }
  },
  {
    id: 3,
    name: "Sony WH-1000XM5",
    price: 399.99,
    category: "Electronics",
    image: "/images/products/sony-headphones.jpg",
    description: "Industry-leading noise canceling headphones with exceptional sound quality and comfort.",
    rating: 4.7,
    reviews: 891,
    inStock: true,
    specs: {
      "Type": "Over-ear, Wireless",
      "Battery": "30 hours",
      "Features": "Active Noise Canceling",
      "Connectivity": "Bluetooth 5.2"
    }
  },
  {
    id: 4,
    name: "Apple Watch Ultra",
    price: 799.99,
    category: "Electronics",
    image: "/images/products/apple-watch.jpg",
    description: "The most rugged and capable Apple Watch ever, designed for exploration and adventure.",
    rating: 4.8,
    reviews: 567,
    inStock: true,
    specs: {
      "Display": "49mm Always-On Retina",
      "Battery": "36 hours",
      "Water Resistance": "100m",
      "GPS": "Precision dual-frequency"
    }
  },
  {
    id: 5,
    name: "Samsung Galaxy Tab S9",
    price: 849.99,
    category: "Electronics",
    image: "/images/products/samsung-tablet.jpg",
    description: "Premium Android tablet with stunning AMOLED display and S Pen included.",
    rating: 4.6,
    reviews: 234,
    inStock: true,
    specs: {
      "Display": "11-inch AMOLED",
      "Processor": "Snapdragon 8 Gen 2",
      "Storage": "256GB",
      "S Pen": "Included"
    }
  },
  {
    id: 6,
    name: "Google Pixel 8 Pro",
    price: 999.99,
    category: "Electronics",
    image: "/images/products/android-phone.jpg",
    description: "Google's most advanced phone with AI-powered features and exceptional camera capabilities.",
    rating: 4.5,
    reviews: 128,
    inStock: true,
    specs: {
      "Display": "6.7-inch LTPO OLED",
      "Chip": "Google Tensor G3",
      "Camera": "50MP Main | 48MP Ultra Wide",
      "Battery": "5050mAh"
    }
  },
  {
    id: 7,
    name: "Beats Studio Pro",
    price: 349.99,
    category: "Electronics",
    image: "/images/products/beats-headphones.jpg",
    description: "Premium wireless headphones with powerful, balanced sound and active noise canceling.",
    rating: 4.4,
    reviews: 445,
    inStock: true,
    specs: {
      "Type": "Over-ear, Wireless",
      "Battery": "40 hours",
      "Features": "ANC & Transparency",
      "Compatibility": "iOS & Android"
    }
  },
  {
    id: 8,
    name: "Dell XPS 15",
    price: 1899.99,
    category: "Electronics",
    image: "/images/products/dell-laptop.jpg",
    description: "Premium Windows laptop with InfinityEdge display and powerful performance.",
    rating: 4.6,
    reviews: 289,
    inStock: true,
    specs: {
      "Processor": "Intel Core i7-13700H",
      "Memory": "32GB DDR5",
      "Storage": "1TB NVMe SSD",
      "Display": "15.6-inch 3.5K OLED"
    }
  },
  {
    id: 9,
    name: "Microsoft Surface Pro 9",
    price: 1299.99,
    category: "Electronics",
    image: "/images/products/microsoft-surface.jpg",
    description: "Versatile 2-in-1 device that's a powerful laptop and a portable tablet.",
    rating: 4.5,
    reviews: 167,
    inStock: true,
    specs: {
      "Display": "13-inch PixelSense",
      "Processor": "Intel Core i7",
      "Memory": "16GB",
      "Storage": "512GB SSD"
    }
  },
  {
    id: 10,
    name: "PlayStation 5",
    price: 499.99,
    category: "Gaming",
    image: "/images/products/ps5-console.jpg",
    description: "Experience lightning-fast loading with an ultra-high speed SSD and immersive gaming.",
    rating: 4.9,
    reviews: 2341,
    inStock: false,
    specs: {
      "CPU": "AMD Ryzen Zen 2",
      "GPU": "10.28 TFLOPS",
      "Memory": "16GB GDDR6",
      "Storage": "825GB SSD"
    }
  },
  {
    id: 11,
    name: "AirPods Pro 2",
    price: 249.99,
    category: "Electronics",
    image: "/images/products/airpods-pro.jpg",
    description: "Advanced Active Noise Cancellation and Adaptive Transparency for immersive sound.",
    rating: 4.7,
    reviews: 892,
    inStock: true,
    specs: {
      "Type": "In-ear, Wireless",
      "Battery": "6 hours (ANC on)",
      "Case Battery": "30 hours total",
      "Features": "ANC, Spatial Audio"
    }
  },
  {
    id: 12,
    name: "DJI Mini 3 Pro",
    price: 759.99,
    category: "Electronics",
    image: "/images/products/drone-dji.jpg",
    description: "Lightweight drone with 4K/60fps video, obstacle avoidance, and 34-min flight time.",
    rating: 4.8,
    reviews: 423,
    inStock: true,
    specs: {
      "Camera": "4K/60fps HDR",
      "Flight Time": "34 minutes",
      "Weight": "249g",
      "Range": "12km"
    }
  }
];

export const categories = ["All", "Electronics", "Gaming", "Accessories"];

export const carouselItems = [
  {
    id: 1,
    image: "/images/carousel/tech-banner-1.jpg",
    title: "Latest Tech Deals",
    subtitle: "Save up to 30% on selected items",
    link: "/products"
  },
  {
    id: 2,
    image: "/images/carousel/tech-banner-2.jpg",
    title: "New Arrivals",
    subtitle: "Check out the latest products",
    link: "/products"
  },
  {
    id: 3,
    image: "/images/carousel/tech-banner-3.jpg",
    title: "Premium Collection",
    subtitle: "Discover our premium range",
    link: "/products"
  }
];
