import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { FALLBACK_PRODUCTS } from '../data/catalogFallback';
import { PRODUCT_MODELS } from '../data/productModels';
import PaginationBar from '../components/PaginationBar';

const ProductViewer3D = lazy(() => import('../components/ProductViewer3D'));

const shopProducts = [
  {
    slug: 'dumpling',
    edition: '01',
    featured: true,
    name: 'Steamed Dumpling Squishy',
    shortName: 'Dumpling',
    category: 'savory',
    description: 'Plump pleated bao bun in ultra-dense slow-rise foam.',
    spotlightCopy:
      'Hand-sculpted top pleats and a cloud-soft memory-foam core that takes a full 40 seconds to float back up after a deep desk squeeze.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — 3D steamed bao bun',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
    riseTime: '40s Slow-Rise',
    feel: 'Velvet Cloud TPR',
    scentNote: 'Warm Vanilla Bao',
    softness: 98,
    quote: 'Bao-tiful squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 224, 206, 0.72), rgba(255, 158, 198, 0.25) 55%, transparent 75%)',
    accentColor: '#ffb6d5',
  },
  {
    slug: 'cheese',
    edition: '02',
    featured: true,
    name: 'Cheese Cube Squishy',
    shortName: 'Cheese Cube',
    category: 'savory',
    description: 'Golden Swiss cheddar block with sculpted air pockets.',
    spotlightCopy:
      'Chunky golden cheddar geometry with recessed Swiss pockets that give your fingertips natural grip for satisfying one-handed squeezes.',
    image: '/assets/images/product-cheese.svg',
    alt: 'Cheese Cube Squishy — 3D Swiss cheese cube',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '36s Slow-Rise',
    feel: 'Whipped Cheddar Foam',
    scentNote: 'Sweet Cream',
    softness: 94,
    quote: 'So cheesy & soft!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 241, 168, 0.76), rgba(251, 200, 82, 0.24) 55%, transparent 75%)',
    accentColor: '#ffe07d',
  },
  {
    slug: 'catpaw',
    edition: '03',
    featured: true,
    name: 'Cat Paw Squishy',
    shortName: 'Cat Paw',
    category: 'plush',
    description: 'Chubby pink jelly toe beans on a plush palm pad.',
    spotlightCopy:
      'Four chubby pink toe beans and a heart-shaped palm pad sculpted to fit right in the center of your hand during study breaks.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — 3D pink paw pads',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    riseTime: '38s Slow-Rise',
    feel: 'Mochi Jelly Pad',
    scentNote: 'Strawberry Milk',
    softness: 99,
    quote: 'Soft toe-bean squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 210, 234, 0.78), rgba(244, 134, 184, 0.28) 55%, transparent 75%)',
    accentColor: '#ff9ec7',
  },
  {
    slug: 'toast',
    edition: '04',
    featured: true,
    name: 'Pastel Toast Squishy',
    shortName: 'Pastel Toast',
    category: 'bakery',
    description: 'Thick-cut milk bread slice built for two-hand crushes.',
    spotlightCopy:
      'Thick Japanese shokupan toast with a golden crust rim and pillowy center. Wide enough for a full two-handed crush.',
    image: '/assets/images/product-toast.svg',
    alt: 'Pastel Toast Squishy — 3D milk bread slice',
    badge: 'Trending',
    badgeClass: 'badge--peach',
    riseTime: '42s Slow-Rise',
    feel: 'Fluffy Brioche Core',
    scentNote: 'Toasted Honey Milk',
    softness: 96,
    quote: 'Warm toasty rebound!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 232, 194, 0.75), rgba(235, 174, 108, 0.25) 55%, transparent 75%)',
    accentColor: '#ffd199',
  },
  {
    slug: 'butter',
    edition: '05',
    featured: true,
    name: 'Butter Stick Squishy',
    shortName: 'Butter Stick',
    category: 'bakery',
    description: 'Smooth salted sweet-cream pat with end-to-end give.',
    spotlightCopy:
      'Modeled after a classic 4oz pat of salted sweet cream butter — smooth, weighty in the hand, and melts under your thumb.',
    image: '/assets/images/product-butter.svg',
    alt: 'Butter Stick Squishy — 3D butter block',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '36s Slow-Rise',
    feel: 'Silky Cream Block',
    scentNote: 'Salted Caramel Cream',
    softness: 95,
    quote: 'Smooth as butter!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 238, 175, 0.76), rgba(255, 166, 206, 0.28) 55%, transparent 75%)',
    accentColor: '#ffe699',
  },
  {
    slug: 'peanut',
    edition: '06',
    featured: true,
    name: 'Peanut Squishy',
    shortName: 'Peanut',
    category: 'savory',
    description: 'Ergonomic twin-lobe woven shell for finger grip.',
    spotlightCopy:
      'Twin-lobe peanut shell with a woven lattice texture that massages your fingers while you type, read, or cram for exams.',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — 3D textured peanut shell',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
    riseTime: '45s Slow-Rise',
    feel: 'Textured Ribbed Shell',
    scentNote: 'Roasted Honey Nut',
    softness: 93,
    quote: 'Double-lobe crunch!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(247, 224, 188, 0.75), rgba(210, 160, 105, 0.26) 55%, transparent 75%)',
    accentColor: '#f3cfa0',
  },
  {
    slug: 'strawberry-mochi',
    edition: '07',
    featured: false,
    name: 'Strawberry Daifuku Mochi',
    shortName: 'Berry Mochi',
    category: 'cafe',
    description: 'Sakura rice-cake dome crowned with a ruby 3D berry.',
    spotlightCopy:
      'Plump pastel-pink daifuku mochi dome topped with a whipped cream collar and a sculpted ruby strawberry crown.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Strawberry Daifuku Mochi — 3D mochi squishy',
    badge: 'Sweet Pick',
    badgeClass: 'badge--pink',
    riseTime: '42s Slow-Rise',
    feel: 'Silky Mochi Skin',
    scentNote: 'Sweet Ichigo Cream',
    softness: 98,
    quote: 'Berry cloud squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 205, 226, 0.78), rgba(235, 75, 118, 0.24) 55%, transparent 75%)',
    accentColor: '#ff9ec4',
  },
  {
    slug: 'matcha-roll',
    edition: '08',
    featured: false,
    name: 'Matcha Swiss Roll Squishy',
    shortName: 'Matcha Roll',
    category: 'cafe',
    description: 'Uji green-tea sponge cylinder with a vanilla swirl core.',
    spotlightCopy:
      'Thick slice of Uji matcha sponge cake rolled around a generous spiral of whipped vanilla cream and topped with a cream rosette.',
    image: '/assets/images/product-toast.svg',
    alt: 'Matcha Swiss Roll Squishy — 3D green tea roll cake',
    badge: 'Cafe Series',
    badgeClass: 'badge--mint',
    riseTime: '40s Slow-Rise',
    feel: 'Velvet Sponge Grain',
    scentNote: 'Roasted Uji Matcha',
    softness: 96,
    quote: 'Zen matcha squeeze!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(206, 244, 190, 0.72), rgba(118, 184, 98, 0.25) 55%, transparent 75%)',
    accentColor: '#a6e090',
  },
  {
    slug: 'boba-cup',
    edition: '09',
    featured: false,
    name: 'Brown Sugar Boba Cup',
    shortName: 'Boba Cup',
    category: 'cafe',
    description: 'Milk-tea tumbler with frosted dome lid & tapioca pearls.',
    spotlightCopy:
      'Tall brown-sugar milk tea cup complete with a translucent dome lid, chunky pastel straw, and sculpted tapioca pearls at the base.',
    image: '/assets/images/product-peanut.svg',
    alt: 'Brown Sugar Boba Cup — 3D milk tea cup squishy',
    badge: 'Trending',
    badgeClass: 'badge--peach',
    riseTime: '38s Slow-Rise',
    feel: 'Smooth Tumbler Core',
    scentNote: 'Caramel Milk Tea',
    softness: 94,
    quote: 'Boba break time!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(248, 218, 184, 0.75), rgba(185, 122, 69, 0.26) 55%, transparent 75%)',
    accentColor: '#f3cfa8',
  },
  {
    slug: 'macaron',
    edition: '10',
    featured: false,
    name: 'Berry French Macaron',
    shortName: 'Macaron',
    category: 'bakery',
    description: 'Twin ruffled almond shells with thick buttercream filling.',
    spotlightCopy:
      'Delicate raspberry meringue domes with textured pied ruffles sandwiching a thick ring of vanilla bean buttercream.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Berry French Macaron — 3D macaron squishy',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    riseTime: '36s Slow-Rise',
    feel: 'Matte Meringue Shell',
    scentNote: 'Raspberry Ganache',
    softness: 97,
    quote: 'Sweet Parisian squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 204, 228, 0.76), rgba(240, 118, 172, 0.26) 55%, transparent 75%)',
    accentColor: '#ffa8cb',
  },
  {
    slug: 'croissant',
    edition: '11',
    featured: false,
    name: 'Golden Butter Croissant',
    shortName: 'Croissant',
    category: 'bakery',
    description: 'Seven-layer crescent pastry built for two-hand squeezes.',
    spotlightCopy:
      'Sculpted with seven graduated golden-baked pastry segments in a classic crescent arc that rebounds slowly from tip to tip.',
    image: '/assets/images/product-butter.svg',
    alt: 'Golden Butter Croissant — 3D crescent pastry squishy',
    badge: 'Bakery Pick',
    badgeClass: 'badge--peach',
    riseTime: '44s Slow-Rise',
    feel: 'Layered Pastry Foam',
    scentNote: 'Warm French Butter',
    softness: 95,
    quote: 'Flaky golden rebound!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 224, 172, 0.76), rgba(224, 148, 58, 0.26) 55%, transparent 75%)',
    accentColor: '#f7be6d',
  },
  {
    slug: 'melon-bun',
    edition: '12',
    featured: false,
    name: 'Hokkaido Melon Pan',
    shortName: 'Melon Pan',
    category: 'bakery',
    description: 'Diamond-scored biscuit crust over a pillowy sweet bun.',
    spotlightCopy:
      'Iconic Japanese bakery bun featuring criss-cross cookie grooves across the dome for unmistakable texture in your palm.',
    image: '/assets/images/product-cheese.svg',
    alt: 'Hokkaido Melon Pan — 3D diamond-scored sweet bun',
    badge: 'Fan Fave',
    badgeClass: 'badge--peach',
    riseTime: '41s Slow-Rise',
    feel: 'Scored Cookie Dome',
    scentNote: 'Melon Sugar Crust',
    softness: 97,
    quote: 'Crisp-look cloud bun!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 236, 178, 0.76), rgba(232, 168, 68, 0.25) 55%, transparent 75%)',
    accentColor: '#f8c96b',
  },
  {
    slug: 'taiyaki',
    edition: '13',
    featured: false,
    name: 'Custard Taiyaki Waffle',
    shortName: 'Taiyaki',
    category: 'bakery',
    description: 'Sculpted golden waffle-fish with embossed belly ribs.',
    spotlightCopy:
      'Street-festival taiyaki waffle sculpted with a flared tail fin, dorsal crest, and warm golden waffle ribs.',
    image: '/assets/images/product-peanut.svg',
    alt: 'Custard Taiyaki Waffle — 3D fish waffle squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '39s Slow-Rise',
    feel: 'Embossed Waffle Foam',
    scentNote: 'Custard Cream',
    softness: 94,
    quote: 'Lucky taiyaki squeeze!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(252, 218, 174, 0.75), rgba(216, 140, 50, 0.26) 55%, transparent 75%)',
    accentColor: '#e8a24a',
  },
  {
    slug: 'onigiri',
    edition: '14',
    featured: false,
    name: 'Nori Rice Onigiri',
    shortName: 'Onigiri',
    category: 'savory',
    description: 'Rounded triangular rice ball wrapped in crisp dark nori.',
    spotlightCopy:
      'Plump three-cornered rice cushion banded with a matte dark-green nori wrap that sits naturally in one hand.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Nori Rice Onigiri — 3D rice triangle squishy',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
    riseTime: '37s Slow-Rise',
    feel: 'Plump Rice Cushion',
    scentNote: 'Toasted Sesame Rice',
    softness: 96,
    quote: 'Konbini classic!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(235, 245, 238, 0.75), rgba(112, 164, 126, 0.25) 55%, transparent 75%)',
    accentColor: '#b8e0c2',
  },
  {
    slug: 'pudding',
    edition: '15',
    featured: false,
    name: 'Caramel Custard Pudding',
    shortName: 'Purin Pudding',
    category: 'cafe',
    description: 'Golden custard frustum topped with glossy caramel & cherry.',
    spotlightCopy:
      'Retro kissaten custard pudding crowned with rich caramel drips, a dollop of cream, and a bright red cherry.',
    image: '/assets/images/product-cheese.svg',
    alt: 'Caramel Custard Pudding — 3D custard pudding squishy',
    badge: 'Cafe Series',
    badgeClass: 'badge--peach',
    riseTime: '40s Slow-Rise',
    feel: 'Jiggly Custard Foam',
    scentNote: 'Burnt Sugar Caramel',
    softness: 98,
    quote: 'Sweet purin bounce!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 235, 166, 0.78), rgba(196, 118, 52, 0.25) 55%, transparent 75%)',
    accentColor: '#ffe074',
  },
  {
    slug: 'donut',
    edition: '16',
    featured: false,
    name: 'Strawberry Frosted Donut',
    shortName: 'Glazed Donut',
    category: 'bakery',
    description: 'Plump yeast ring dipped in pink icing & 3D sprinkles.',
    spotlightCopy:
      'Golden ring donut coated in glossy strawberry icing and scattered with pastel rainbow pill sprinkles.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Strawberry Frosted Donut — 3D ring donut squishy',
    badge: 'Sweet Pick',
    badgeClass: 'badge--pink',
    riseTime: '38s Slow-Rise',
    feel: 'Glazed Ring Foam',
    scentNote: 'Strawberry Sugar Glaze',
    softness: 96,
    quote: 'Sprinkle joy squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 206, 228, 0.76), rgba(242, 184, 107, 0.26) 55%, transparent 75%)',
    accentColor: '#ff8ec1',
  },
  {
    slug: 'waffle',
    edition: '17',
    featured: false,
    name: 'Honey Belgian Waffle',
    shortName: 'Belgian Waffle',
    category: 'bakery',
    description: 'Deep-pocket square waffle topped with melting butter.',
    spotlightCopy:
      'Thick golden Belgian waffle with nine recessed grid pockets and a tilted square pat of sweet cream butter on top.',
    image: '/assets/images/product-toast.svg',
    alt: 'Honey Belgian Waffle — 3D waffle squishy',
    badge: 'Bakery Pick',
    badgeClass: 'badge--peach',
    riseTime: '43s Slow-Rise',
    feel: 'Deep Grid Cushion',
    scentNote: 'Maple Butter Drizzle',
    softness: 95,
    quote: 'Golden waffle crush!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 228, 176, 0.76), rgba(207, 134, 46, 0.26) 55%, transparent 75%)',
    accentColor: '#f0ae54',
  },
  {
    slug: 'dango',
    edition: '18',
    featured: false,
    name: 'Hanami Tri-Color Dango',
    shortName: 'Hanami Dango',
    category: 'cafe',
    description: 'Three sakura, snow-white & matcha mochi balls on a skewer.',
    spotlightCopy:
      'Springtime trio of pink, white, and green mochi spheres skewered together for a full-hand triple squeeze.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Hanami Tri-Color Dango — 3D skewered dango squishy',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    riseTime: '36s Slow-Rise',
    feel: 'Triple Mochi Grip',
    scentNote: 'Sakura Blossom',
    softness: 97,
    quote: 'Triple mochi pop!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 214, 232, 0.75), rgba(149, 207, 130, 0.26) 55%, transparent 75%)',
    accentColor: '#ffa8cb',
  },
  {
    slug: 'cloud-puff',
    edition: '19',
    featured: false,
    name: 'Dreamy Cloud Puff',
    shortName: 'Cloud Puff',
    category: 'plush',
    description: 'Multi-lobed cumulus cloud cushion in pastel sky blue.',
    spotlightCopy:
      'Six overlapping cumulus puffs sculpted into one weightless desk pillow with our slowest 46-second rebound.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Dreamy Cloud Puff — 3D cloud cushion squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    riseTime: '46s Slow-Rise',
    feel: 'Feather Cloud TPR',
    scentNote: 'Clean Cotton Sky',
    softness: 99,
    quote: 'Floating on a cloud!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(224, 240, 255, 0.8), rgba(162, 196, 255, 0.28) 55%, transparent 75%)',
    accentColor: '#c4dfff',
  },
  {
    slug: 'star-jelly',
    edition: '20',
    featured: false,
    name: 'Shooting Star Jelly',
    shortName: 'Star Jelly',
    category: 'plush',
    description: 'Plump five-point star cushion in warm pastel gold.',
    spotlightCopy:
      'Chubby five-pointed star with rounded tips that align with every finger for effortless full-palm stress relief.',
    image: '/assets/images/product-cheese.svg',
    alt: 'Shooting Star Jelly — 3D star cushion squishy',
    badge: 'Collector',
    badgeClass: 'badge--mint',
    riseTime: '40s Slow-Rise',
    feel: 'Starlight Jelly Foam',
    scentNote: 'Honey Citrus Glow',
    softness: 97,
    quote: 'Starry night squish!',
    aura: 'radial-gradient(circle at 50% 48%, rgba(255, 240, 172, 0.8), rgba(255, 196, 86, 0.28) 55%, transparent 75%)',
    accentColor: '#ffdf6b',
  },
];

const FEATURED_SLIDES = shopProducts.slice(0, 6);

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
  const [products, setProducts] = useState(
    () => SquishiesAPI.getCachedProducts?.() || FALLBACK_PRODUCTS
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // 3D Spotlight Carousel state
  const [activeSlide, setActiveSlide] = useState(0);
  const [spotlightQty, setSpotlightQty] = useState(1);
  const [squishPulses, setSquishPulses] = useState({});
  const [activeQuote, setActiveQuote] = useState('');
  const quoteTimerRef = useRef(null);

  const { addToCart, syncProducts, showToast } = useCart();

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await SquishiesAPI.fetchProducts();
        const catalog = getCatalogArray(result);

        if (cancelled || catalog.length === 0) return;

        setProducts(catalog);
        syncProducts(catalog);
      } catch (error) {
        if (cancelled) return;
        console.warn('Using fallback Squishies catalog:', error.message);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [syncProducts]);

  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  const catalogItems = useMemo(() => {
    const knownSlugs = new Set(shopProducts.map((item) => item.slug));
    const mergedKnown = shopProducts
      .filter((item) => productsBySlug.has(item.slug))
      .map((item) => {
        const live = productsBySlug.get(item.slug);
        return {
          ...item,
          name: live?.name || item.name,
          description: live?.description || item.description,
          badge: live?.badge ?? item.badge,
          badgeClass: live?.badgeClass || item.badgeClass,
          image: live?.image
            ? live.image.startsWith('/') || live.image.startsWith('http')
              ? live.image
              : `/${live.image}`
            : item.image,
        };
      });

    const dynamicSingles = products
      .filter((prod) => prod.kind === 'single' && !knownSlugs.has(prod.slug))
      .map((prod, idx) => ({
        slug: prod.slug,
        edition: String(shopProducts.length + idx + 1).padStart(2, '0'),
        featured: false,
        name: prod.name,
        shortName: prod.name.slice(0, 18),
        category: 'bakery',
        description:
          prod.description ||
          'Slow-rising memory foam squishy crafted for stress relief.',
        spotlightCopy:
          prod.description ||
          'Slow-rising memory foam squishy crafted for stress relief.',
        image: prod.image
          ? prod.image.startsWith('/') || prod.image.startsWith('http')
            ? prod.image
            : `/${prod.image}`
          : '/assets/images/product-dumpling.svg',
        alt: `${prod.name} squishy`,
        badge: prod.badge || 'New Drop',
        badgeClass: prod.badgeClass || 'badge--pink',
        riseTime: '40s Slow-Rise',
        feel: 'Slow-Rising Foam',
        scentNote: 'Sweet Vanilla',
        softness: 96,
        quote: 'Super squishy!',
        aura: 'radial-gradient(circle at 50% 48%, rgba(255, 214, 232, 0.78), rgba(255, 130, 184, 0.25) 55%, transparent 75%)',
        accentColor: '#ff9ac6',
      }));

    const combined = [...mergedKnown, ...dynamicSingles];
    return combined.length > 0 ? combined : shopProducts;
  }, [products, productsBySlug]);

  const spotlightItem = shopProducts[activeSlide] || shopProducts[0];
  const spotlightProduct = productsBySlug.get(spotlightItem.slug);
  const spotlightStock = Number(spotlightProduct?.stockQuantity ?? 100);
  const spotlightUnavailable = !spotlightProduct || spotlightStock <= 0;

  function triggerSquish(item) {
    setSquishPulses((prev) => ({
      ...prev,
      [item.slug]: (prev[item.slug] || 0) + 1,
    }));
    setActiveQuote(item.quote);
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => {
      setActiveQuote('');
    }, 2200);
  }

  function stepCarousel(delta) {
    setActiveSlide(
      (prev) => (prev + delta + shopProducts.length) % shopProducts.length
    );
    setSpotlightQty(1);
    setActiveQuote('');
  }

  function selectSlide(index) {
    setActiveSlide(index);
    setSpotlightQty(1);
    setActiveQuote('');
  }

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return catalogItems.filter((item) => {
      const matchesCategory =
        category === 'all' || item.category === category;

      const matchesSearch =
        !query ||
        `${item.name} ${item.description} ${item.category} ${item.feel} ${item.scentNote}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [catalogItems, search, category]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleProducts.slice(start, start + pageSize);
  }, [visibleProducts, safePage, pageSize]);

  function handleAddToCart(slug, quantity = 1) {
    const product = productsBySlug.get(slug);

    if (!product) {
      showToast('This product could not be loaded. Please refresh.');
      return;
    }

    if (product.stockQuantity <= 0) {
      showToast('Sorry, this product is out of stock.');
      return;
    }

    addToCart(product, quantity);
  }

  return (
    <div className="shop-jelly">
      {/* ============ COMPACT HEADER + 3D SPOTLIGHT CAROUSEL ============ */}
      <section
        className="shop-hero shop-hero--runway"
        aria-label="3D Squishy Spotlight Carousel"
      >
        <div className="container container--wide">
          {/* Compact Single-Row Top Bar (eliminates wasted vertical dead space) */}
          <div className="shop-top-bar">
            <div className="shop-top-bar__left">
              <span className="shop-top-bar__kicker">
                3D Collector’s Showroom
              </span>
              <h1>Pick Your Squish</h1>
            </div>
            <p className="shop-top-bar__sub">
              20 faceless 3D squishy editions in slow-rising memory foam — drag
              any model to spin or press it to squish.
            </p>
          </div>

          <div
            className="shop-carousel"
            style={{ '--spotlight-accent': spotlightItem.accentColor }}
          >
            <div className="shop-carousel__main">
              {/* LEFT: Clean 3D Interactive Stage with Edge Arrows */}
              <div className="shop-carousel__stage-wrap">
                <div
                  className="shop-carousel__aura"
                  style={{ background: spotlightItem.aura }}
                  aria-hidden="true"
                />
                <div className="shop-carousel__pedestal" aria-hidden="true" />

                <div className="shop-carousel__stage-top">
                  <span className="shop-carousel__edition-label">
                    Edition #{spotlightItem.edition} of {shopProducts.length}
                  </span>
                  <span className={`badge ${spotlightItem.badgeClass}`}>
                    {spotlightItem.badge}
                  </span>
                </div>

                {activeQuote && (
                  <div className="shop-carousel__speech" role="status">
                    {activeQuote}
                  </div>
                )}

                <button
                  type="button"
                  className="shop-carousel__edge-arrow shop-carousel__edge-arrow--prev"
                  onClick={() => stepCarousel(-1)}
                  aria-label="Previous 3D squishy"
                >
                  ‹
                </button>

                <div className="shop-carousel__viewer">
                  <Suspense
                    fallback={
                      <img
                        src={spotlightItem.image}
                        alt={spotlightItem.alt}
                        width="420"
                        height="420"
                      />
                    }
                  >
                    <ProductViewer3D
                      key={spotlightItem.slug}
                      url={PRODUCT_MODELS[spotlightItem.slug]}
                      alt={spotlightItem.alt}
                      fallbackImage={spotlightItem.image}
                      compact
                      hideHint
                      scaleBoost={1.08}
                      pulseSignal={squishPulses[spotlightItem.slug] || 0}
                      onSquish={() => triggerSquish(spotlightItem)}
                    />
                  </Suspense>
                </div>

                <button
                  type="button"
                  className="shop-carousel__edge-arrow shop-carousel__edge-arrow--next"
                  onClick={() => stepCarousel(1)}
                  aria-label="Next 3D squishy"
                >
                  ›
                </button>

                <p className="shop-carousel__stage-caption">
                  Drag to rotate 360° · Press model to squish
                </p>
              </div>

              {/* RIGHT: Calm, Focused Details & Single Primary CTA */}
              <div className="shop-carousel__details">
                <p className="shop-carousel__meta-line">
                  <span>{spotlightItem.riseTime}</span>
                  <span aria-hidden="true">·</span>
                  <span>{spotlightItem.feel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{spotlightItem.scentNote}</span>
                </p>

                <h2 className="shop-carousel__title">
                  <Link to={`/product.html?slug=${spotlightItem.slug}`}>
                    {spotlightItem.name}
                  </Link>
                </h2>

                <div className="shop-carousel__price-inline">
                  <strong className="shop-carousel__price">
                    {spotlightProduct
                      ? formatPeso(spotlightProduct.price)
                      : '₱89'}
                  </strong>
                  <span className="shop-carousel__stock-text">
                    {spotlightUnavailable
                      ? '· Out of stock'
                      : `· ✓ ${spotlightStock} in stock`}
                  </span>
                </div>

                <p className="shop-carousel__copy">
                  {spotlightItem.spotlightCopy}
                </p>

                {/* Single Clean Softness Bar */}
                <div
                  className="shop-telemetry shop-telemetry--single"
                  aria-label="Squish softness rating"
                >
                  <div className="shop-telemetry__label">
                    <span>Squish Softness & Slow-Rise</span>
                    <strong>{spotlightItem.softness}%</strong>
                  </div>
                  <div className="shop-telemetry__track">
                    <div
                      className="shop-telemetry__fill"
                      style={{ width: `${spotlightItem.softness}%` }}
                    />
                  </div>
                </div>

                {/* Single Primary Action Row */}
                <div className="shop-carousel__cta-row">
                  <div className="shop-carousel__qty" aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => setSpotlightQty((q) => Math.max(1, q - 1))}
                      disabled={spotlightUnavailable || spotlightQty <= 1}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span>{spotlightQty}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightQty((q) =>
                          Math.min(99, spotlightStock, q + 1)
                        )
                      }
                      disabled={
                        spotlightUnavailable || spotlightQty >= spotlightStock
                      }
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn--pink btn--lg shop-carousel__buy-btn"
                    disabled={spotlightUnavailable}
                    onClick={() =>
                      handleAddToCart(spotlightItem.slug, spotlightQty)
                    }
                  >
                    {spotlightUnavailable
                      ? 'Out of Stock'
                      : `+ Add ${
                          spotlightQty > 1 ? `${spotlightQty} ` : ''
                        }to Bag`}
                  </button>
                </div>

                <div className="shop-carousel__sub-link-row">
                  <Link
                    to={`/product.html?slug=${spotlightItem.slug}`}
                    className="shop-carousel__text-link"
                  >
                    View full specifications & reviews →
                  </Link>
                </div>
              </div>
            </div>

            {/* BOTTOM: Minimal Quick-Select Strip */}
            <div
              className="shop-carousel__strip"
              role="tablist"
              aria-label="Featured 3D editions"
            >
              <span className="shop-carousel__strip-label">
                Featured Picks:
              </span>
              <div className="shop-carousel__strip-pills">
                {FEATURED_SLIDES.map((item, idx) => {
                  const isSelected = idx === activeSlide;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`shop-carousel__pill${
                        isSelected ? ' is-active' : ''
                      }`}
                      onClick={() => selectSlide(idx)}
                    >
                      {item.shortName}
                    </button>
                  );
                })}
              </div>
              <span className="shop-carousel__strip-counter">
                Showing #{spotlightItem.edition} of {shopProducts.length} (use ‹
                › for all 20)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ALL 20 3D EDITIONS SHOWROOM GRID ============ */}
      <section className="shop-grid-section">
        <div className="container container--wide">
          <div className="shop-catalog-bar">
            <div className="shop-catalog-bar__title">
              <h2>All 20 3D Squishy Editions</h2>
              <p>
                Faceless 3D collector models — drag any squishy to rotate or
                press it to test the rebound.
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
                  placeholder="Search 20 3D squishies (mochi, croissant, boba, dumpling…)"
                  aria-label="Search squishies"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div
                className="filter-pills"
                id="filterPills"
                role="group"
                aria-label="Filter by category"
              >
                {[
                  { value: 'all', label: `All (${shopProducts.length})` },
                  { value: 'bakery', label: 'Sweet Bakery' },
                  { value: 'cafe', label: 'Mochi & Cafe' },
                  { value: 'savory', label: 'Savory Bites' },
                  { value: 'plush', label: 'Plush & Shapes' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`filter-pill ${
                      category === filter.value ? 'is-active' : ''
                    }`}
                    aria-pressed={category === filter.value}
                    onClick={() => {
                      setCategory(filter.value);
                      setPage(1);
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className="product-grid product-grid--shop product-grid--shop-3d"
            id="shopGrid"
          >
            {paginatedProducts.map((item, idx) => {
              const product = productsBySlug.get(item.slug);
              const unavailable = !product || product.stockQuantity <= 0;
              const modelUrl = PRODUCT_MODELS[item.slug];
              const pulseCount = squishPulses[item.slug] || 0;
              const globalIndex = shopProducts.findIndex(
                (p) => p.slug === item.slug
              );

              let buttonText = '+ Add to Cart';

              if (!product) buttonText = 'Unavailable';
              else if (product.stockQuantity <= 0) {
                buttonText = 'Out of stock';
              }

              return (
                <article
                  className="product-card product-card--3d product-card--shop-3d"
                  data-category={item.category}
                  data-name={item.name.toLowerCase()}
                  key={item.slug}
                  onPointerEnter={() =>
                    SquishiesAPI.prefetchProduct?.(item.slug)
                  }
                >
                  <div
                    className="product-card__media product-card__media--3d product-card__media--shop-3d"
                    style={{ '--card-aura': item.aura }}
                  >
                    <div className="product-card__aura" aria-hidden="true" />
                    <div className="product-card__pedestal" aria-hidden="true" />

                    {modelUrl ? (
                      <Suspense
                        fallback={
                          <img
                            src={item.image}
                            alt={item.alt}
                            width="420"
                            height="340"
                            loading="lazy"
                          />
                        }
                      >
                        <ProductViewer3D
                          url={modelUrl}
                          alt={item.alt}
                          fallbackImage={item.image}
                          compact
                          hideHint
                          scaleBoost={1.02}
                          pulseSignal={pulseCount}
                        />
                      </Suspense>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.alt}
                        width="420"
                        height="340"
                        loading="lazy"
                      />
                    )}

                    <span className="shop-card__edition">#{item.edition}</span>

                    <span className={`badge ${item.badgeClass}`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className="product-card__body product-card__body--shop-3d">
                    <p className="product-card__meta-line">
                      <span>{item.riseTime}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.feel}</span>
                    </p>

                    <h3>
                      <Link to={`/product.html?slug=${item.slug}`}>
                        {item.name}
                      </Link>
                    </h3>

                    <p className="product-card__desc">{item.description}</p>

                    <div className="product-card__footer product-card__footer--shop">
                      <div className="product-card__price-stack">
                        <span className="price">
                          {product ? formatPeso(product.price) : '₱89'}
                        </span>
                        <span className="shop-card__stock-note">
                          {unavailable
                            ? 'Out of stock'
                            : `✓ ${product.stockQuantity} in stock`}
                        </span>
                      </div>

                      <div className="product-card__btns">
                        <button
                          type="button"
                          className="btn btn--pink btn--sm"
                          disabled={unavailable}
                          onClick={() => handleAddToCart(item.slug, 1)}
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

          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            totalItems={visibleProducts.length}
            pageSize={pageSize}
            pageSizeOptions={[6, 9, 20]}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            itemLabel="3D squishies"
          />

          <p
            className="shop-empty"
            id="shopEmpty"
            hidden={visibleProducts.length !== 0}
          >
            No squishies match your search. Try “mochi”, “croissant”, “boba”, or
            “dumpling”.
          </p>
        </div>
      </section>
    </div>
  );
}
