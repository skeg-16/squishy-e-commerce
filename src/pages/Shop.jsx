import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';

const shopProducts = [
  {
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    category: 'food',
    description: 'Pastel bao with a happy face',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — pastel bao with a happy face',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'cheese',
    name: 'Cheese Cube Squishy',
    category: 'food',
    description: 'Cuboid slow-rise memory foam',
    image: '/assets/images/product-cheese.svg',
    alt: 'Cheese Cube Squishy — cuboid slow-rise memory foam',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
  },
  {
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    category: 'animal',
    description: 'Pink paw pads, ultra soft',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — pink paw pads, ultra soft',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'toast',
    name: 'Pastel Toast Squishy',
    category: 'food',
    description: 'Pastel square toast, 4 colors',
    image: '/assets/images/product-toast.svg',
    alt: 'Pastel Toast Squishy — pastel square toast, 4 colors',
    badge: 'Trending',
    badgeClass: 'badge--peach',
  },
  {
    slug: 'butter',
    name: 'Butter Stick Squishy',
    category: 'food',
    description: 'Salted butter block, pink and yellow',
    image: '/assets/images/product-butter.svg',
    alt: 'Butter Stick Squishy — salted butter block, pink and yellow',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
  },
  {
    slug: 'peanut',
    name: 'Peanut Squishy',
    category: 'food',
    description: 'Textured shell, mega squeezable',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — textured shell, mega squeezable',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
  },
];

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })}`;
}

function getCatalogArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  return [];
}

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const { addToCart, syncProducts, showToast } = useCart();

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await SquishiesAPI.fetchProducts();
        const catalog = getCatalogArray(result);

        if (cancelled) return;

        setProducts(catalog);
        syncProducts(catalog);
        setLoadError(false);
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to load Squishies catalog:', error);
        setLoadError(true);
        showToast(
          'The store could not load live inventory. Please refresh to try again.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [syncProducts, showToast]);

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shopProducts.filter((item) => {
      const matchesCategory =
        category === 'all' || item.category === category;

      const matchesSearch =
        !query ||
        `${item.name} ${item.description} ${item.category}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  function handleAddToCart(slug) {
    if (loading || loadError) {
      showToast('Live inventory is unavailable. Please try again.');
      return;
    }

    const product = productsBySlug.get(slug);

    if (!product) {
      showToast('This product could not be loaded. Please refresh.');
      return;
    }

    if (product.stockQuantity <= 0) {
      showToast('Sorry, this product is out of stock.');
      return;
    }

    addToCart(product);
  }

  return (
    <>
      <section className="shop-hero">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow eyebrow--pink">All Squishies</span>
            <h1>Pick Your Squish</h1>
            <p>
              Every Squishy is made from premium TPR and memory foam —
              slow-rising, non-toxic, and impossibly cute.
            </p>
          </div>

          <div className="shop-controls">
            <div className="search-field">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="#B7ADC0"
                  strokeWidth="2"
                />
                <path
                  d="M20 20l-4.5-4.5"
                  stroke="#B7ADC0"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <input
                type="search"
                id="shopSearch"
                placeholder="Search squishies…"
                aria-label="Search squishies"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div
              className="filter-pills"
              id="filterPills"
              role="group"
              aria-label="Filter by category"
            >
              {[
                { value: 'all', label: 'All' },
                { value: 'food', label: 'Food' },
                { value: 'animal', label: 'Animal' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`filter-pill ${
                    category === filter.value ? 'is-active' : ''
                  }`}
                  aria-pressed={category === filter.value}
                  onClick={() => setCategory(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shop-grid-section">
        <div className="container">
          <div className="product-grid product-grid--shop" id="shopGrid">
            {visibleProducts.map((item) => {
              const product = productsBySlug.get(item.slug);
              const unavailable =
                loading ||
                loadError ||
                !product ||
                product.stockQuantity <= 0;

              let buttonText = '+ Cart';

              if (loading) buttonText = 'Loading…';
              else if (loadError || !product) buttonText = 'Unavailable';
              else if (product.stockQuantity <= 0) {
                buttonText = 'Out of stock';
              }

              return (
                <article
                  className="product-card"
                  data-category={item.category}
                  data-name={item.name.toLowerCase()}
                  key={item.slug}
                >
                  <div className="product-card__media">
                    <img
                      src={item.image}
                      alt={item.alt}
                      width="400"
                      height="300"
                      loading="lazy"
                    />
                    <span className={`badge ${item.badgeClass}`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className="product-card__body">
                    <h3>
                      <Link to={`/product.html?slug=${item.slug}`}>
                        {item.name}
                      </Link>
                    </h3>

                    <p className="product-card__desc">
                      {item.description}
                    </p>

                    <div className="product-card__footer product-card__footer--shop">
                      <span className="price">
                        {product && !loadError
                          ? formatPeso(product.price)
                          : '—'}
                      </span>

                      <div className="product-card__btns">
                        <Link
                          className="btn btn--outline btn--sm"
                          to={`/product.html?slug=${item.slug}`}
                        >
                          View Item
                        </Link>

                        <button
                          type="button"
                          className="btn btn--pink btn--sm add-to-cart"
                          data-slug={item.slug}
                          disabled={unavailable}
                          onClick={() => handleAddToCart(item.slug)}
                        >
                          {buttonText}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {visibleProducts.length === 0 && (
            <p className="shop-empty" id="shopEmpty">
              No squishies match your search. Try a different keyword or
              filter.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
