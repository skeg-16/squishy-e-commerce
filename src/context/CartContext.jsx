import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FALLBACK_PRODUCTS } from '../data/catalogFallback';

const CartContext = createContext(null);

const CART_KEY = 'siso-squishies-cart';
const FREE_SHIPPING_THRESHOLD = 500;

const legacy = {
  'Steamed Dumpling Squishy': 'dumpling',
  'Cheese Cube Squishy': 'cheese',
  'Cat Paw Squishy': 'catpaw',
  'Pastel Toast Squishy': 'toast',
  'Butter Stick Squishy': 'butter',
  'Peanut Squishy': 'peanut',
  'Solo Squish': 'solo-squish',
  'Stress-Free Trio': 'stress-free-trio',
  "Collector's Box": 'collectors-box',
  'Wholesale / Party Pack': 'party-pack',
};

const names = Object.fromEntries(
  Object.entries(legacy).map(([name, slug]) => [slug, name])
);

const bundlePrices = {
  'solo-squish': 89,
  'stress-free-trio': 249,
  'collectors-box': 459,
  'party-pack': 1400,
};

const bundleImages = {
  'solo-squish': 'dumpling',
  'stress-free-trio': 'catpaw',
  'party-pack': 'peanut',
};

const fallbackMap = new Map(
  FALLBACK_PRODUCTS.map((product) => [product.slug, product])
);

const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,59}$/;
const SAFE_IMAGE_PATTERN = /^(\/?assets\/images\/[a-zA-Z0-9._/-]+|https?:\/\/[^\s"'<>]+)$/;

function imageFor(slug) {
  const known = fallbackMap.get(slug);
  if (known?.image) {
    return known.image;
  }
  if (slug === 'collectors-box') {
    return 'assets/images/hero-collage.svg';
  }
  return `assets/images/product-${bundleImages[slug] || slug}.svg`;
}

function safeImage(image, slug) {
  if (typeof image === 'string' && SAFE_IMAGE_PATTERN.test(image.trim())) {
    return image.trim();
  }
  return imageFor(slug);
}

function readSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

    if (!Array.isArray(saved)) return [];

    const migrated = new Map();

    for (const item of saved) {
      const hasValidSlug =
        item &&
        typeof item.slug === 'string' &&
        SLUG_PATTERN.test(item.slug);
      const slug = hasValidSlug
        ? item.slug
        : item && Object.hasOwn(legacy, item.name)
          ? legacy[item.name]
          : null;

      if (
        !slug ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 99
      ) {
        continue;
      }

      const fallback = fallbackMap.get(slug);
      const existing = migrated.get(slug);

      if (existing) {
        existing.qty = Math.min(99, existing.qty + item.qty);
      } else {
        const resolvedName =
          fallback?.name ||
          names[slug] ||
          (typeof item.name === 'string' && item.name.trim()
            ? item.name.trim().slice(0, 100)
            : slug);
        const resolvedPrice =
          fallback?.price ??
          bundlePrices[slug] ??
          (Number.isFinite(Number(item.price)) && Number(item.price) >= 0
            ? Number(item.price)
            : 89);
        migrated.set(slug, {
          slug,
          name: resolvedName,
          price: resolvedPrice,
          image: hasValidSlug
            ? safeImage(item.image, slug)
            : imageFor(slug),
          qty: item.qty,
        });
      }
    }

    return [...migrated.values()];
  } catch {
    return [];
  }
}

export function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart);
  const [toast, setToast] = useState('');
  const [locked, setLocked] = useState(false);

  const catalog = useRef(
    new Map(FALLBACK_PRODUCTS.map((product) => [product.slug, product]))
  );
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // The current cart still works if browser storage is unavailable.
    }
  }, [cart]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === CART_KEY && !locked) {
        setCart(readSavedCart());
      }
    }

    window.addEventListener('storage', handleStorage);

    return () => window.removeEventListener('storage', handleStorage);
  }, [locked]);

  useEffect(() => {
    return () => clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);

    toastTimer.current = setTimeout(() => {
      setToast('');
    }, 4000);
  }, []);

  const syncProducts = useCallback((products) => {
    for (const product of products) {
      catalog.current.set(product.slug, product);
    }

    setCart((current) =>
      current.map((item) => {
        const product = catalog.current.get(item.slug);

        return product
          ? {
              ...item,
              name: product.name,
              price: product.price,
              image: product.image || imageFor(product.slug),
            }
          : item;
      })
    );
  }, []);

  const addToCart = useCallback(
    (product, qty = 1) => {
      if (locked) {
        showToast('Please wait for the checkout request to finish.');
        return false;
      }

      if (
        !product ||
        typeof product.slug !== 'string' ||
        !SLUG_PATTERN.test(product.slug)
      ) {
        showToast('This product could not be loaded. Please refresh.');
        return false;
      }

      catalog.current.set(product.slug, product);

      const existing = cart.find((item) => item.slug === product.slug);
      const total = (existing?.qty || 0) + qty;
      const stock = Math.min(99, product.stockQuantity ?? 99);

      if (!Number.isInteger(qty) || qty < 1 || total > stock) {
        showToast('That quantity is unavailable.');
        return false;
      }

      setCart((current) => {
        const found = current.find((item) => item.slug === product.slug);

        if (found) {
          return current.map((item) =>
            item.slug === product.slug
              ? { ...item, qty: item.qty + qty }
              : item
          );
        }

        return [
          ...current,
          {
            slug: product.slug,
            name: product.name,
            price: product.price,
            image: product.image || imageFor(product.slug),
            qty,
          },
        ];
      });

      showToast(`${product.name} added to cart.`);
      return true;
    },
    [cart, locked, showToast]
  );

  const changeQty = useCallback(
    (slug, delta) => {
      if (locked) return;

      const item = cart.find((entry) => entry.slug === slug);
      if (!item) return;

      const qty = item.qty + delta;
      const product = catalog.current.get(slug);

      if (
        qty > 99 ||
        (delta > 0 && product && qty > product.stockQuantity)
      ) {
        showToast('That quantity is unavailable.');
        return;
      }

      setCart((current) =>
        qty <= 0
          ? current.filter((entry) => entry.slug !== slug)
          : current.map((entry) =>
              entry.slug === slug ? { ...entry, qty } : entry
            )
      );
    },
    [cart, locked, showToast]
  );

  const removeItem = useCallback(
    (slug) => {
      if (!locked) {
        setCart((current) =>
          current.filter((item) => item.slug !== slug)
        );
      }
    },
    [locked]
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  const shippingFee =
    cart.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 60;

  const value = {
    cart,
    toast,
    locked,
    setLocked,
    showToast,
    syncProducts,
    addToCart,
    changeQty,
    removeItem,
    clearCart,
    totalCount,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    formatPeso,
    FREE_SHIPPING_THRESHOLD,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used inside a CartProvider.');
  }

  return context;
}
