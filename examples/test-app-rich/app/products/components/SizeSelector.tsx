export default function SizeSelector({ sizes, selected, onChange }: any) {
  return (
    <div>
      <h3 className="font-semibold mb-2">Size</h3>
      <div className="flex gap-2">
        {sizes.map((size: string) => (
          <button
            key={size}
            onClick={() => onChange(size)}
            className={`px-4 py-2 border rounded ${
              selected === size ? "bg-blue-600 text-white" : ""
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  )
}
