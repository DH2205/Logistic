'use client';

export default function DatabasePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Database View</h1>
      
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-6xl mb-4">💾</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Raw Database Access</h2>
        <p className="text-gray-600 mb-6">
          View and export your database contents
        </p>
        <p className="text-sm text-gray-500">
          This feature allows you to view the raw JSON database for debugging purposes.
        </p>
      </div>
    </div>
  );
}
