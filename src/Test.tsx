// Simple test component to verify CSS is loading
export function Test() {
  return (
    <div style={{ padding: '20px' }}>
      <h1 className="text-4xl font-bold text-red-500">CSS Test</h1>
      <p className="text-lg text-blue-400 mt-4">If this text is blue and the heading is red, Tailwind is working!</p>
      <div className="bg-green-500 p-4 mt-4 rounded">
        <p className="text-white">Green background with rounded corners</p>
      </div>
      <div className="mt-4 p-4 border-2 border-yellow-400">
        <p>Yellow border test</p>
      </div>
    </div>
  );
}