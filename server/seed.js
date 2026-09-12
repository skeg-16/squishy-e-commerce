const db = require('./db');

const initialProducts = [
  {
    id: 1,
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
    rating: 4.8,
    reviews: 188,
    price: 89,
    image: 'assets/images/product-dumpling.svg',
    description: "Our plumpest, most satisfying squishy yet. Modeled after a perfectly steamed bao — round, soft-faced, slow-rising, and impossible to put down.",
    stockQuantity: 100,
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Ultra-Soft, slow-rising',
      'Rise time': '40 seconds from a full squeeze',
      'Dimensions': 'Approx. 3 × 3 × 2.5 in (varies slightly by design)',
      'Weight': '45–55 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    }
  },
  {
    id: 2,
    slug: 'cheese',
    name: 'Cheese Cube Squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    rating: 4.7,
    reviews: 96,
    price: 89,
    image: 'assets/images/product-cheese.svg',
    description: "A cuboid slow-rise squishy with just the right amount of give. Dotted with soft dimples for extra texture while you squeeze.",
    stockQuantity: 85,
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Soft, slow-rising, lightly textured',
      'Rise time': '35 seconds from a full squeeze',
      'Dimensions': 'Approx. 3 × 3 × 3 in (varies slightly by design)',
      'Weight': '50–60 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    }
  },
  {
    id: 3,
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    rating: 4.9,
    reviews: 214,
    price: 89,
    image: 'assets/images/product-catpaw.svg',
    description: "Pastel paw pads in ultra-soft memory foam. Small, pocket-friendly, and endlessly squeezable — a desk favorite for a reason.",
    stockQuantity: 120,
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Pillowy-soft, slow-rising',
      'Rise time': '30 seconds from a full squeeze',
      'Dimensions': 'Approx. 2.5 × 2 × 1.5 in (varies slightly by design)',
      'Weight': '25–35 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    }
  },
  {
    id: 4,
    slug: 'toast',
    name: 'Pastel Toast Squishy',
    badge: 'Trending',
    badgeClass: 'badge--peach',
    rating: 4.6,
    reviews: 74,
    price: 89,
    image: 'assets/images/product-toast.svg',
    description: "Soft square toast in four pastel colorways. Stack them, collect them, or line your desk with a slice of everyday comfort.",
    stockQuantity: 60,
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Ultra-soft, slow-rising',
      'Rise time': '40 seconds from a full squeeze',
      'Dimensions': 'Approx. 3.5 × 3.5 × 1.5 in (varies slightly by design)',
      'Weight': '40–50 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    }
  },
  {
    id: 5,
    slug: 'butter',
    name: 'Butter Stick Squishy',
    badge: 'New Drop',
    badgeClass: 'badge--purple',
    rating: 4.7,
    reviews: 58,
    price: 89,
    image: 'assets/images/product-butter.svg',
    description: "A salted-butter-block lookalike in pink and yellow. Extra-long shape makes it satisfying to squeeze from end to end.",
    stockQuantity: 45,
    specs: {
      'Material': 'Premium Thermoplastic Rubber (TPR) and memory foam',
      'Texture': 'Firm-soft, slow-rising',
      'Rise time': '45 seconds from a full squeeze',
      'Dimensions': 'Approx. 4 × 2 × 1.5 in (varies slightly by design)',
      'Weight': '50–60 g',
      'Packaging': 'Individually wrapped in an eco-friendly matte zip pouch with care instructions',
      'Safety': 'Non-toxic, BPA-free, hypoallergenic, low-odor. Ages 3+. Not edible.',
    }
  }
];

function seed() {
  db.seedProducts(initialProducts);
  console.log(`Successfully seeded ${initialProducts.length} products into JSON database.`);
}

seed();
