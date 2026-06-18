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

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price_at_time: number;
}

interface Order {
  id: number;
  customer_id: number;
  total_amount: number;
  status: string;
  created_at: string;
  items?: OrderItem[];
}

interface Customer {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string;
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
  total_customers: number;
  low_stock_products: number;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'customers' | 'system'>('inventory');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // Modal & Form States
  const [showModal, setShowModal] = useState<'product' | 'customer' | 'order' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Product Form State
  const [productForm, setProductForm] = useState({ name: '', sku: '', price: 0, quantity: 0 });
  // Customer Form State
  const [customerForm, setCustomerForm] = useState({ full_name: '', email: '', phone_number: '' });
  // Order Form State
  const [orderForm, setOrderForm] = useState({ customer_id: '', items: [{ product_id: '', quantity: 1 }] });

  const [isRegistering, setIsRegistering] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchData = () => {
    if (!token) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const headers = { 'Authorization': `Bearer ${token}` };

    return Promise.all([
      fetch(`${API_URL}/products/`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); }),
      fetch(`${API_URL}/orders/`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); }),
      fetch(`${API_URL}/customers/`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); }),
      fetch(`${API_URL}/system/audit-logs`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); }),
      fetch(`${API_URL}/system/health`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); }),
      fetch(`${API_URL}/system/stats`, { headers }).then(res => { if (res.status === 401) throw new Error('401'); return res.json(); })
    ]).then(([productsData, ordersData, customersData, auditData, healthData, statsData]) => {
      // Backend returns paginated response: { data: [...], total: ... }
      setProducts(productsData.data || []);
      setOrders(ordersData.data || []);
      setCustomers(customersData.data || []);
      setAuditLogs(auditData || []);
      setHealth(healthData);
      setStats(statsData);
      setLoading(false);
    }).catch(err => {
      console.error('Fetch error:', err);
      if (err.message === '401') {
          handleLogout();
      }
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

  // --- CRUD Handlers ---

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = editingItem ? `${API_URL}/products/${editingItem.id}` : `${API_URL}/products/`;
    const method = editingItem ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(productForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(null);
      fetchData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${API_URL}/customers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(customerForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(null);
      fetchData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${API_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    // Clean up empty items
    const payload = {
      customer_id: parseInt(orderForm.customer_id),
      items: orderForm.items.filter(i => i.product_id).map(i => ({
        product_id: parseInt(i.product_id),
        quantity: parseInt(i.quantity.toString())
      }))
    };

    try {
      const res = await fetch(`${API_URL}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to create order');
      }
      setShowModal(null);
      fetchData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteOrder = async (id: number) => {
      if (!confirm('Cancel this order and restore inventory?')) return;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${API_URL}/orders/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Failed to cancel order');
        }
        fetchData();
        } catch (err: any) {
        alert(`Cancel failed: ${err.message}`);
        }
  };

  const handleDeleteOrder = async (id: number) => {
      if (!confirm('Cancel this order and restore inventory?')) return;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${API_URL}/orders/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Failed to cancel order');
        }
        fetchData();
        } catch (err: any) {
        alert(`Cancel failed: ${err.message}`);
        }
        };

  // --- End CRUD Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
            className={activeTab === 'customers' ? 'active' : ''} 
            onClick={() => setActiveTab('customers')}
          >
            <span className="icon">👥</span> Customers
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
          <div className="header-left">
            <h1>{
              activeTab === 'inventory' ? 'Inventory Overview' : 
              activeTab === 'customers' ? 'Customer Management' :
              activeTab === 'orders' ? 'Recent Orders' : 
              'System Reliability & Audit'
            }</h1>
            {activeTab === 'inventory' && (
              <button className="badge-btn" onClick={() => { setEditingItem(null); setProductForm({name:'', sku:'', price:0, quantity:0}); setShowModal('product'); }}>+ New Product</button>
            )}
            {activeTab === 'customers' && (
              <button className="badge-btn" onClick={() => { setEditingItem(null); setCustomerForm({full_name:'', email:'', phone_number:''}); setShowModal('customer'); }}>+ New Customer</button>
            )}
            {activeTab === 'orders' && (
              <button className="badge-btn" onClick={() => { setEditingItem(null); setOrderForm({customer_id: '', items: [{product_id: '', quantity: 1}]}); setShowModal('order'); }}>+ New Order</button>
            )}
          </div>
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
                    <th>Actions</th>
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
                      <td>
                        <div className="action-buttons">
                          <button className="icon-btn edit" onClick={() => { setEditingItem(product); setProductForm(product); setShowModal('product'); }}>✏️</button>
                          <button className="icon-btn delete" onClick={() => handleDeleteProduct(product.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'customers' ? (
            <div className="card table-card">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>#{customer.id}</td>
                      <td className="p-name">{customer.full_name}</td>
                      <td>{customer.email}</td>
                      <td>{customer.phone_number || 'N/A'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="icon-btn delete" onClick={() => handleDeleteCustomer(customer.id)}>🗑️</button>
                        </div>
                      </td>
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
                    <th>Actions</th>
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
                      <td>
                        {order.status !== 'cancelled' && (
                           <button className="icon-btn delete" onClick={() => handleDeleteOrder(order.id)}>🚫</button>
                        )}
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

      {/* --- Modals --- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <header className="modal-header">
              <h2>{editingItem ? 'Edit' : 'New'} {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h2>
              <button className="close-btn" onClick={() => setShowModal(null)}>×</button>
            </header>
            
            <div className="modal-body">
              {actionError && <div className="action-error">{actionError}</div>}
              
              {showModal === 'product' && (
                <form onSubmit={handleProductSubmit}>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>SKU</label>
                    <input type="text" value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} required disabled={!!editingItem} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Price ($)</label>
                      <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} required />
                    </div>
                    <div className="form-group">
                      <label>Stock Quantity</label>
                      <input type="number" value={productForm.quantity} onChange={e => setProductForm({...productForm, quantity: parseInt(e.target.value)})} required />
                    </div>
                  </div>
                  <button type="submit" className="login-btn">{editingItem ? 'Update' : 'Create'} Product</button>
                </form>
              )}

              {showModal === 'customer' && (
                <form onSubmit={handleCustomerSubmit}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={customerForm.full_name} onChange={e => setCustomerForm({...customerForm, full_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" value={customerForm.phone_number} onChange={e => setCustomerForm({...customerForm, phone_number: e.target.value})} />
                  </div>
                  <button type="submit" className="login-btn">Register Customer</button>
                </form>
              )}

              {showModal === 'order' && (
                <form onSubmit={handleOrderSubmit}>
                  <div className="form-group">
                    <label>Customer</label>
                    <select value={orderForm.customer_id} onChange={e => setOrderForm({...orderForm, customer_id: e.target.value})} required>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>)}
                    </select>
                  </div>
                  
                  <div className="order-items-builder">
                    <label>Products & Quantities</label>
                    {orderForm.items.map((item, idx) => (
                      <div key={idx} className="form-row item-row">
                        <select 
                          value={item.product_id} 
                          onChange={e => {
                            const newItems = [...orderForm.items];
                            newItems[idx].product_id = e.target.value;
                            setOrderForm({...orderForm, items: newItems});
                          }}
                          required
                        >
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price} | Stock: {p.quantity})</option>)}
                        </select>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={e => {
                            const newItems = [...orderForm.items];
                            newItems[idx].quantity = parseInt(e.target.value);
                            setOrderForm({...orderForm, items: newItems});
                          }}
                          required 
                          style={{width: '80px'}}
                        />
                        {idx > 0 && <button type="button" className="icon-btn delete" onClick={() => {
                          const newItems = orderForm.items.filter((_, i) => i !== idx);
                          setOrderForm({...orderForm, items: newItems});
                        }}>×</button>}
                      </div>
                    ))}
                    <button type="button" className="badge-btn secondary" style={{marginBottom: '1rem'}} onClick={() => setOrderForm({...orderForm, items: [...orderForm.items, {product_id: '', quantity: 1}]})}>
                      + Add Item
                    </button>
                  </div>
                  <button type="submit" className="login-btn">Create Order</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
