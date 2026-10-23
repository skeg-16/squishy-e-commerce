import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';

const PRODUCT_FAQS = [
  {
    question: 'How to clean it',
    answer:
      "Wipe with a damp cloth and mild soap, then air-dry away from direct sun. The surface is water-resistant, but don't soak or machine wash it — trapped water slows the rise permanently.",
  },
  {
    question: 'Is it safe for kids?',
    answer:
      "Yes, for ages 3 and up. Materials are non-toxic, BPA-free and hypoallergenic. It isn't a teether and isn't edible, so younger children shouldn't be left alone with it.",
  },
];

function getErrorMessage(error) {
  return error.status === 404
    ? 'Product not found'
    : 'Product temporarily unavailable';
}

export default function Product() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = searchParams.get('slug') || 'dumpling';

  const { syncProducts, addToCart, formatPeso, showToast } = useCart();

  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [openFaqs, setOpenFaqs] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [reviewsError, setReviewsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setProduct(null);
    setLoadError(null);
    setReviews(null);
    setReviewsError(false);
    setQuantity(1);
    setOpenFaqs([]);

    async function loadProduct() {
      try {
        const result = await SquishiesAPI.fetchProductBySlug(slug);
        if (cancelled) return;

        setProduct(result);
        syncProducts([result]);
        document.title = `${result.name} — Squishies`;

        try {
          const reviewData =
            await SquishiesAPI.fetchProductReviews(slug);

          if (!cancelled) setReviews(reviewData);
        } catch {
          if (!cancelled) setReviewsError(true);
        }
      } catch (error) {
        if (cancelled) return;

        setLoadError({
          title: getErrorMessage(error),
          message: error.message,
        });
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const stock = Number(product?.stockQuantity ?? 0);
  const available = Boolean(product && stock > 0);
  const rating = reviews?.averageRating ?? product?.rating ?? 0;
  const reviewCount =
    reviews?.reviewsCount ?? product?.reviewsCount ?? 0;

  function handleAddToCart() {
    if (!product || !available) return;
    addToCart(product, quantity);
  }

  function handleBuyNow() {
    if (!product || !available) return;

    if (addToCart(product, quantity)) {
      navigate('/checkout.html');
    }
  }

  function changeQuantity(amount) {
    setQuantity((current) =>
      Math.max(1, Math.min(99, stock, current + amount))
    );
  }

  function toggleFaq(index) {
    setOpenFaqs((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  if (loadError) {
    return (
      <main>
        <div className="container product-page">
          <div className="product-page__top">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link> / <Link to="/shop.html">Shop</Link>
            </nav>
            <Link to="/shop.html" className="continue-shopping">
              ← Continue Shopping
            </Link>
          </div>

          <h1>{loadError.title}</h1>
          <p>{loadError.message}</p>
          <p>Please return to the shop or refresh to retry.</p>
          <Link to="/shop.html" className="btn btn--pink">
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  const badgeClass =
    /^badge--[a-z]+$/.test(product?.badgeClass || '')
      ? product.badgeClass
      : '';

  return (
    <main>
      <div className="container product-page">
        <div className="product-page__top">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link> / <Link to="/shop.html">Shop</Link> /{' '}
            <span>{product?.name || 'Product'}</span>
          </nav>

          <Link to="/shop.html" className="continue-shopping">
            ← Continue Shopping
          </Link>
        </div>

        <div className="product-page__main">
          <div className="product-page__image">
            {product ? (
              <img
                src={product.image}
                alt={product.name}
                width="420"
                height="420"
              />
            ) : (
              <div role="status">Loading product…</div>
            )}
          </div>

          <div className="product-page__info">
            <span className={`badge ${badgeClass}`}>
              {product?.badge || 'Squishies'}
            </span>

            <h1>{product?.name || 'Loading product…'}</h1>

            <div className="product-page__rating" id="productRating">
              <span className="stars" aria-label={`${rating} out of 5 stars`}>
                {'★'.repeat(Math.round(Number(rating) || 0)).padEnd(5, '☆')}
              </span>
              <span>
                {!product
                  ? 'Loading reviews…'
                  : reviewCount
                    ? `${rating} · ${reviewCount} verified review${
                        reviewCount === 1 ? '' : 's'
                      }`
                    : 'No reviews yet'}
              </span>
            </div>

            <p className="product-page__price">
              {product ? formatPeso(product.price) : '—'}
            </p>

            <p className="product-page__desc">
              {product?.description || ''}
            </p>

            <p className="stock-pill">
              {!product
                ? 'Checking availability…'
                : stock
                  ? `✓ ${stock} available · school demo inventory`
                  : 'Out of stock'}
            </p>

            <div className="product-page__actions">
              <div className="qty-stepper qty-stepper--lg">
                <button
                  className="qty-btn"
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={!available || quantity <= 1}
                  onClick={() => changeQuantity(-1)}
                >
                  −
                </button>

                <span className="qty-value" aria-live="polite">
                  {quantity}
                </span>

                <button
                  className="qty-btn"
                  type="button"
                  aria-label="Increase quantity"
                  disabled={!available || quantity >= Math.min(99, stock)}
                  onClick={() => changeQuantity(1)}
                >
                  +
                </button>
              </div>

              <button
                className="btn btn--pink btn--lg"
                type="button"
                disabled={!available}
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
            </div>

            <button
              className="btn btn--dark btn--lg product-page__buy-now"
              type="button"
              disabled={!available}
              onClick={handleBuyNow}
            >
              Buy it now
            </button>
          </div>
        </div>

        <div className="product-page__specs">
          <h2>Specifications</h2>
          <dl className="specs-list">
            {Object.entries(product?.specs || {}).map(([label, value]) => (
              <div key={label} className="specs-list__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="product-page__faqs">
          {PRODUCT_FAQS.map((faq, index) => {
            const isOpen = openFaqs.includes(index);

            return (
              <div
                className={`faq-item${isOpen ? ' is-open' : ''}`}
                key={faq.question}
              >
                <button
                  className="faq-item__question"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleFaq(index)}
                >
                  <span>{faq.question}</span>
                  <span className="faq-item__icon" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                <div
                  className="faq-item__answer"
                  style={{
                    maxHeight: isOpen ? '500px' : null,
                  }}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

        <section
          className="product-page__specs"
          id="verifiedReviewsContainer"
        >
          <h2>Verified Buyer Reviews</h2>

          {reviewsError && (
            <p role="status">
              Reviews could not load. Please refresh to retry.
            </p>
          )}

          {reviews && reviews.reviews.length === 0 && (
            <p>
              Be the first to review after a completed demo delivery.
            </p>
          )}

          {reviews?.reviews.map((review, index) => (
            <article
              className="checkout-card"
              key={review.id ?? `${review.reviewerName}-${index}`}
            >
              <strong>
                {review.reviewerName} · Verified Purchase
              </strong>
              <p>
                {'★'.repeat(review.rating)} ({review.rating}/5)
              </p>
              <p>{review.comment}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
