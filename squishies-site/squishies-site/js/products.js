/* ==========================================================================
   SQUISHIES — products.js
   Single source of truth for product detail content, keyed by slug.
   Used by product.html to render the "View Item" page dynamically.
   ========================================================================== */

const PRODUCTS = {
  dumpling: {
    name: 'Steamed Dumpling Squishy',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
    rating: 4.8,
    reviews: 188,
    price: 89,
    image: 'assets/images/product-dumpling.svg',
    description: "Our plumpest, most satisfying squishy yet. Modeled after a perfectly steamed bao — round, soft-faced, slow-rising, and impossible to put down.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Ultra-Soft, slow-rising',
      'Rise time': '40 seconds from a full squeeze',
      'Dimensions': 'Approx. 3 × 3 × 2.5 in (varies slightly by design)',
      'Weight': '45–55 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },

  cheese: {
    name: 'Cheese Cube Squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    rating: 4.7,
    reviews: 96,
    price: 89,
    image: 'assets/images/product-cheese.svg',
    description: "A cuboid slow-rise squishy with just the right amount of give. Dotted with soft dimples for extra texture while you squeeze.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Soft, slow-rising, lightly textured',
      'Rise time': '35 seconds from a full squeeze',
      'Dimensions': 'Approx. 3 × 3 × 3 in (varies slightly by design)',
      'Weight': '50–60 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },

  catpaw: {
    name: 'Cat Paw Squishy',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    rating: 4.9,
    reviews: 214,
    price: 89,
    image: 'assets/images/product-catpaw.svg',
    description: "Pastel paw pads in ultra-soft memory foam. Small, pocket-friendly, and endlessly squeezable — a desk favorite for a reason.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Pillowy-soft, slow-rising',
      'Rise time': '30 seconds from a full squeeze',
      'Dimensions': 'Approx. 2.5 × 2 × 1.5 in (varies slightly by design)',
      'Weight': '25–35 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },

  toast: {
    name: 'Pastel Toast Squishy',
    badge: 'Trending',
    badgeClass: 'badge--peach',
    rating: 4.6,
    reviews: 74,
    price: 89,
    image: 'assets/images/product-toast.svg',
    description: "Soft square toast in four pastel colorways. Stack them, collect them, or line your desk with a slice of everyday comfort.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Ultra-soft, slow-rising',
      'Rise time': '40 seconds from a full squeeze',
      'Dimensions': 'Approx. 3.5 × 3.5 × 1.5 in (varies slightly by design)',
      'Weight': '40–50 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },

  butter: {
    name: 'Butter Stick Squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    rating: 4.7,
    reviews: 58,
    price: 89,
    image: 'assets/images/product-butter.svg',
    description: "A salted-butter-block lookalike in pink and yellow. Extra-long shape makes it satisfying to squeeze from end to end.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Firm-soft, slow-rising',
      'Rise time': '45 seconds from a full squeeze',
      'Dimensions': 'Approx. 4.5 × 2 × 2 in (varies slightly by design)',
      'Weight': '55–65 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },

  peanut: {
    name: 'Peanut Squishy',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
    rating: 4.8,
    reviews: 231,
    price: 89,
    image: 'assets/images/product-peanut.svg',
    description: "Textured peanut shell on the outside, mega-squeezable cream filling on the inside. Our most gifted squishy, and it's easy to see why.",
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Textured shell, ultra-soft slow-rising interior',
      'Rise time': '40 seconds from a full squeeze',
      'Dimensions': 'Approx. 4 × 2 × 2 in (varies slightly by design)',
      'Weight': '45–55 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    },
  },
};

const PRODUCT_FAQS = [
  {
    question: 'How to clean it',
    answer: "Wipe with a damp cloth and mild soap, then air-dry away from direct sun. The surface is water-resistant, but don't soak or machine wash it — trapped water slows the rise permanently.",
  },
  {
    question: 'Is it safe for kids?',
    answer: "Yes, for ages 3 and up. Materials are non-toxic, BPA-free and hypoallergenic. It isn't a teether and isn't edible, so younger children shouldn't be left alone with it.",
  },
];
