import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-primary-600">
              LogiShop
            </Link>

            <nav className="flex items-center gap-6">
              <Link to="/" className="text-gray-700 hover:text-primary-600">
                Home
              </Link>
              <Link to="/shipments" className="text-gray-700 hover:text-primary-600">
                Shipments
              </Link>
              <Link to="/database" className="text-gray-700 hover:text-primary-600">
                Database
              </Link>
              
              {user ? (
                <>
                  <Link to="/orders" className="text-gray-700 hover:text-primary-600">
                    Orders
                  </Link>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-700">Hello, {user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-primary-600"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                  >
                    Register
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">LogiShop</h3>
              <p className="text-gray-400">
                Your trusted international logistics optimization platform.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link to="/shipments" className="hover:text-white">
                    Shipments
                  </Link>
                </li>
                <li>
                  <Link to="/orders" className="hover:text-white">
                    My Orders
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <p className="text-gray-400">Email: support@logishop.com</p>
              <p className="text-gray-400">Phone: +1 (555) 123-4567</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 LogiShop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;