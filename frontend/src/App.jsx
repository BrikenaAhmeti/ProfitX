
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Clients from './pages/Clients.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Categories from './pages/Categories.jsx';
import Transactions from './pages/Transactions.jsx';

const Placeholder = ({ title }) => <h2>{title}</h2>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
          <Route path="/fatura" element={<Placeholder title="Fatura" />} />
          <Route path="/klientet" element={<Clients />} />
          <Route path="/furnitoret" element={<Suppliers />} />
          <Route path="/kategorite" element={<Categories />} />
          <Route path="/transaksione" element={<Transactions />} />
          <Route path="/raportet" element={<Placeholder title="Raporte" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
