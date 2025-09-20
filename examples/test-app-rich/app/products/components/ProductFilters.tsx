"use client"

interface ProductFiltersProps {
  filters: any
  onChange: (filters: any) => void
}

export default function ProductFilters({ filters, onChange }: ProductFiltersProps) {
  const handlePriceChange = (range: string) => {
    let priceRange = [0, 10000]
    switch(range) {
      case 'under25': priceRange = [0, 25]; break
      case '25to50': priceRange = [25, 50]; break
      case '50to100': priceRange = [50, 100]; break
      case 'over100': priceRange = [100, 10000]; break
      case 'all': priceRange = [0, 10000]; break
    }
    onChange({...filters, priceRange})
  }

  const getCurrentPriceRange = () => {
    if (!filters.priceRange) return 'all'
    const [min, max] = filters.priceRange
    if (min === 0 && max === 25) return 'under25'
    if (min === 25 && max === 50) return '25to50'
    if (min === 50 && max === 100) return '50to100'
    if (min === 100) return 'over100'
    return 'all'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="category"
              value="all"
              checked={!filters.category || filters.category === 'all'}
              onChange={() => onChange({...filters, category: 'all'})}
              className="mr-2"
            />
            All Products
          </label>
          {["electronics", "clothing", "home", "sports", "books"].map(cat => (
            <label key={cat} className="flex items-center cursor-pointer hover:text-blue-600">
              <input
                type="radio"
                name="category"
                value={cat}
                checked={filters.category === cat}
                onChange={() => onChange({...filters, category: cat})}
                className="mr-2"
              />
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </label>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold mb-3">Price Range</h3>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="price"
              checked={getCurrentPriceRange() === 'all'}
              onChange={() => handlePriceChange('all')}
              className="mr-2"
            />
            All Prices
          </label>
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="price"
              checked={getCurrentPriceRange() === 'under25'}
              onChange={() => handlePriceChange('under25')}
              className="mr-2"
            />
            Under $25
          </label>
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="price"
              checked={getCurrentPriceRange() === '25to50'}
              onChange={() => handlePriceChange('25to50')}
              className="mr-2"
            />
            $25 - $50
          </label>
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="price"
              checked={getCurrentPriceRange() === '50to100'}
              onChange={() => handlePriceChange('50to100')}
              className="mr-2"
            />
            $50 - $100
          </label>
          <label className="flex items-center cursor-pointer hover:text-blue-600">
            <input
              type="radio"
              name="price"
              checked={getCurrentPriceRange() === 'over100'}
              onChange={() => handlePriceChange('over100')}
              className="mr-2"
            />
            Over $100
          </label>
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold mb-3">Size</h3>
        <div className="grid grid-cols-3 gap-2">
          {["XS", "S", "M", "L", "XL", "XXL"].map(size => (
            <button
              key={size}
              className={`py-1 px-2 border rounded text-sm transition-colors ${
                filters.size === size 
                  ? "bg-blue-600 text-white border-blue-600" 
                  : "hover:bg-gray-50 hover:border-gray-400"
              }`}
              onClick={() => onChange({...filters, size: filters.size === size ? '' : size})}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      
      <button 
        onClick={() => onChange({category: 'all', priceRange: [0, 10000], color: '', size: ''})}
        className="w-full py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  )
}
