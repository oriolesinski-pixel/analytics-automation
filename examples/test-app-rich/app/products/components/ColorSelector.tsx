export default function ColorSelector({ colors, selected, onChange }: any) {
  return (
    <div>
      <h3 className="font-semibold mb-2">Color</h3>
      <div className="flex gap-2">
        {colors.map((color: string) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`px-4 py-2 border rounded ${
              selected === color ? "border-blue-600" : ""
            }`}
          >
            {color}
          </button>
        ))}
      </div>
    </div>
  )
}
