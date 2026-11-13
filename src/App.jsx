import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout';
import Home from './pages/Home';
import ScrollToTop from './components/ScrollToTop';
import SquishyPageLoader from './components/SquishyPageLoader';

const Shop = lazy(() => import('./pages/Shop'));
const Product = lazy(() => import('./pages/Product'));
const About = lazy(() => import('./pages/About'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/Account'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

function NotFoundPage() {
  return (
    <section className="container" style={{ paddingBlock: '5rem', textAlign: 'center' }}>
      <h1>Page Not Found</h1>
      <p style={{ marginTop: '0.75rem', opacity: 0.8 }}>
        The page you requested does not exist on the Squishies storefront.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SquishyPageLoader />

      <Suspense fallback={<SquishyPageLoader isSuspense />}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin.html" element={<AdminPage />} />
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop.html" element={<Shop />} />
            <Route path="/product" element={<Product />} />
            <Route path="/product.html" element={<Product />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout.html" element={<Checkout />} />
            <Route path="/about" element={<About />} />
            <Route path="/about.html" element={<About />} />
            <Route path="/account" element={<Account />} />
            <Route path="/account.html" element={<Account />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
