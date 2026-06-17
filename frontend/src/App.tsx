import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './App.css';

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  customer_id: number;
  total_amount: number;
  status: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  event_type: string;
  message: string;
  created_at: string;
  status: string;
}

interface SystemHealth {
  status: string;
  services: {
    database: string;
    scheduler: string;
    worker_lane_realtime: string;
    worker_lane_batch: string;
  };
}

interface SystemStats {
  total_products: number;
  total_inventory_value: number;
  total_revenue: number;
  total_audit_logs: number;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'system'>('inventory');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [loginError, setLoginError] = useState('');

  const fetchData = () => {
    if (!token) return;
    const API_URL = 'http://localhost:8000';
    const headers = { 'Authorization': `Bearer ${token}` };

    return Promise.all([
      fetch(`${API_URL}/products/`, { headers }).then(res => res.json()),
      fetch(`${API_URL}/orders/`, { headers }).then(res => res.json()),
      fetch(`${API_URL}/system/audit-logs`, { headers }).then(res => res.json()),
      fetch(`${API_URL}/system/health`, { headers }).then(res => res.json()),
      fetch(`${API_URL}/system/stats`, { headers }).then(res => res.json())
    ]).then(([productsData, ordersData, auditData, healthData, statsData]) => {
      // Backend returns paginated response: { data: [...], total: ... }
      setProducts(productsData.data || []);
      setOrders(ordersData.data || []);
      setAuditLogs(auditData || []);
      setHealth(healthData);
      setStats(statsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      if (err.message.includes('401')) handleLogout();
      setLoading(false);
    });
  };

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const API_URL = 'http://localhost:8000';
    
    const formData = new FormData();
    formData.append('username', loginEmail);
    formData.append('password', loginPassword);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Invalid credentials');
      }
      
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('userEmail', loginEmail);
      setToken(data.access_token);
      setUserEmail(loginEmail);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const API_URL = 'http://localhost:8000';

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          role: 'staff'
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Registration failed');
      }

      // Automatically login after registration
      const formData = new FormData();
      formData.append('username', loginEmail);
      formData.append('password', loginPassword);
      
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await loginRes.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('userEmail', loginEmail);
      setToken(data.access_token);
      setUserEmail(loginEmail);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    const API_URL = 'http://localhost:8000';
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!res.ok) throw new Error('Google authentication failed');
      
      const data = await res.json();
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('userEmail', payload.sub);
      setToken(data.access_token);
      setUserEmail(payload.sub);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setToken(null);
    setUserEmail(null);
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    const API_URL = 'http://localhost:8000';
    try {
      await fetch(`${API_URL}/system/trigger-sync`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(false);
    }
  };

  const triggerSeed = async () => {
    const API_URL = 'http://localhost:8000';
    try {
      await fetch(`${API_URL}/system/seed`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error('Seed failed', err);
    }
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="logo-section">
            <div className="logo-icon">📦</div>
            <h1>PulseStock</h1>
          </div>
          <p>Enterprise Inventory Management</p>

          <div className="auth-tabs">
            <button 
              className={!isRegistering ? 'active' : ''} 
              onClick={() => { setIsRegistering(false); setLoginError(''); }}
            >
              Sign In
            </button>
            <button 
              className={isRegistering ? 'active' : ''} 
              onClick={() => { setIsRegistering(true); setLoginError(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering && (
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  value={registerName} 
                  onChange={(e) => setRegisterName(e.target.value)} 
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)} 
                placeholder="admin@pulsetock.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                placeholder="••••••••"
                required
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-btn">
              {isRegistering ? 'Create Account' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="social-login">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setLoginError('Google Login Failed')}
              useOneTap
              theme="filled_blue"
              shape="pill"
              width="100%"
            />
          </div>

          <div className="login-footer">
            Enterprise Grade Inventory Management & Reliability Control
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">📦</div>
          <h2>PulseStock</h2>
        </div>
        <nav>
          <button 
            className={activeTab === 'inventory' ? 'active' : ''} 
            onClick={() => setActiveTab('inventory')}
          >
            <span className="icon">📊</span> Inventory
          </button>
          <button 
            className={activeTab === 'orders' ? 'active' : ''} 
            onClick={() => setActiveTab('orders')}
          >
            <span className="icon">🛒</span> Orders
          </button>
          <button 
            className={activeTab === 'system' ? 'active' : ''} 
            onClick={() => setActiveTab('system')}
          >
            <span className="icon">⚙️</span> System Depth
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="system-indicator">
            <span className="dot pulse"></span> API Operational
          </div>
          <button onClick={handleLogout} className="logout-btn">
             Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="top-bar">
          <h1>{
            activeTab === 'inventory' ? 'Inventory Overview' : 
            activeTab === 'orders' ? 'Recent Orders' : 
            'System Reliability & Audit'
          }</h1>
          <div className="user-profile">
            <span>{userEmail}</span>
            <div className="avatar">{userEmail?.substring(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <h3>Total Products</h3>
            <p className="stat-value">{stats?.total_products || 0}</p>
            <span className="stat-label">Active SKUs</span>
          </div>
          <div className="stat-card">
            <h3>Inventory Value</h3>
            <p className="stat-value">${(stats?.total_inventory_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <span className="stat-label">Current Assets</span>
          </div>
          <div className="stat-card">
            <h3>Total Revenue</h3>
            <p className="stat-value">${(stats?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <span className="stat-label">All-time sales</span>
          </div>
          <div className="stat-card">
            <h3>Audit Events</h3>
            <p className="stat-value">{stats?.total_audit_logs || 0}</p>
            <span className="stat-label">System History</span>
          </div>
        </section>

        <div className="data-section">
          {loading ? (
            <div className="skeleton-loader">Loading workspace...</div>
          ) : activeTab === 'inventory' ? (
            <div className="card table-card">
              <table>
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th>SKU</th>
                    <th>Unit Price</th>
                    <th>Stock Level</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td className="product-cell">
                        <div className="product-info">
                          <span className="p-name">{product.name}</span>
                        </div>
                      </td>
                      <td><code>{product.sku}</code></td>
                      <td>${product.price.toFixed(2)}</td>
                      <td>
                        <div className="stock-level-cell">
                          <span className={`status-pill ${product.quantity > 10 ? 'success' : product.quantity > 0 ? 'warning' : 'danger'}`}>
                            {product.quantity} units
                          </span>
                        </div>
                      </td>
                      <td>${(product.price * product.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'orders' ? (
            <div className="card table-card">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Customer ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>#ORD-{order.id.toString().padStart(4, '0')}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>Cust #{order.customer_id}</td>
                      <td className="amount-cell">${order.total_amount.toFixed(2)}</td>
                      <td>
                        <span className={`status-pill ${
                          order.status === 'delivered' ? 'success' : 
                          order.status === 'cancelled' ? 'danger' : 
                          order.status === 'shipped' ? 'info' : 
                          'warning'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="system-view">
              <div className="health-grid">
                {health && Object.entries(health.services).map(([key, val]) => (
                  <div key={key} className="health-card">
                    <span className="h-key">{key.replace(/_/g, ' ')}</span>
                    <span className="h-val success">{val}</span>
                  </div>
                ))}
              </div>
              
              <div className="card audit-card">
                <div className="card-header">
                  <h3>Deterministic Audit Trail</h3>
                  <div className="header-actions">
                    <button 
                      className="badge-btn secondary" 
                      onClick={triggerSeed}
                    >
                      Seed Database
                    </button>
                    <button 
                      className={`badge-btn ${syncing ? 'loading' : ''}`} 
                      onClick={triggerManualSync}
                      disabled={syncing}
                    >
                      {syncing ? 'Syncing...' : 'Reliability Control (Trigger Sync)'}
                    </button>
                  </div>
                </div>
                <div className="audit-list">
                  {auditLogs.map(log => (
                    <div key={log.id} className="audit-entry">
                      <div className="a-time">{new Date(log.created_at).toLocaleTimeString()}</div>
                      <div className={`a-status ${log.status.toLowerCase()}`}>[{log.status}]</div>
                      <div className="a-type">{log.event_type}</div>
                      <div className="a-msg">{log.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
