import { useState, useEffect } from 'react';
import { databaseAPI } from '../services/api';

const Database = () => {
  const [database, setDatabase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    fetchDatabase();
  }, []);

  const fetchDatabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await databaseAPI.getDatabase();
      setDatabase(response.data);
      // Expand all sections by default
      const sections = Object.keys(response.data);
      const expanded = {};
      sections.forEach(section => {
        expanded[section] = true;
      });
      setExpandedSections(expanded);
    } catch (err) {
      console.error('Error fetching database:', err);
      setError('Failed to load database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const downloadDatabase = () => {
    if (!database) return;
    
    const dataStr = JSON.stringify(database, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'database.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <button
            onClick={fetchDatabase}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">No database data available.</p>
      </div>
    );
  }

  const sections = Object.keys(database);
  const totalItems = sections.reduce((sum, section) => {
    return sum + (Array.isArray(database[section]) ? database[section].length : 0);
  }, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Database Viewer</h1>
          <p className="text-gray-600">
            View and download the complete database ({sections.length} collections, {totalItems} total items)
          </p>
        </div>
        <button
          onClick={downloadDatabase}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-md"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Download JSON
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const items = database[section];
          const isExpanded = expandedSections[section];
          const itemCount = Array.isArray(items) ? items.length : 0;

          return (
            <div key={section} className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => toggleSection(section)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h2 className="text-xl font-semibold capitalize">{section}</h2>
                  <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200">
                  {Array.isArray(items) && items.length > 0 ? (
                    <div className="p-6">
                      <div className="space-y-4">
                        {items.map((item, index) => (
                          <div
                            key={index}
                            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                          >
                            <pre className="text-sm overflow-x-auto">
                              {JSON.stringify(item, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-gray-500 text-center">
                      No items in this collection
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Database;
