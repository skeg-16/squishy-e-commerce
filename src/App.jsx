
import { Navigate, Route, Routes } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import About from './pages/About';
import Checkout from './pages/Checkout';
import ScrollToTop from './components/ScrollToTop';

function Placeholder({ title }) {
  return (
    <section className="container" style={{ paddingBlock: '4rem' }}>
      <h1>{title}</h1>
      <p>This page is being migrated to React.</p>
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/shop.html" element={<Shop />} />
          <Route path="/product.html" element={<Product />} />
          <Route path="/checkout.html" element={<Checkout />} />
          <Route path="/about.html" element={<About />} />
          <Route path="*" element={<Placeholder title="Page Not Found" />} />
        </Route>
      </Routes>
    </>
  );
}
