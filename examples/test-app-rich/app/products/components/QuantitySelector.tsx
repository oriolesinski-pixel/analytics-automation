export default function QuantitySelector({ quantity, onChange, max }: any) {
  return (
    <div>
      <h3 className="font-semibold mb-2">Quantity</h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, quantity - 1))}
          className="w-10 h-10 border rounded hover:bg-gray-100"
        >
          -
        </button>
        <span className="w-12 text-center">{quantity}</span>
        <button
          onClick={() => onChange(Math.min(max, quantity + 1))}
          className="w-10 h-10 border rounded hover:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  )
}
