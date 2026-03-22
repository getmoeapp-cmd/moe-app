import React, { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MOE — Make Ordering Easy
// Kitchen inventory + ordering app for pizzerias & restaurants
//
// FLOW:
//   1. Owner sets up vendors (Anacapri, Market) with order days (Mon, Thu, etc.)
//   2. Owner adds items under each vendor, organized by store sections
//   3. Employees walk the kitchen, count stock (Inventory tab — by location)
//   4. On a vendor's order day, Orders tab shows that vendor ready to submit
//   5. Submit → saves to History, resets that vendor's items to 0
//   6. History shows past orders organized by week number, PDF per vendor
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DEFAULT INVENTORY (Tommy's Pizzeria starter data) ───────────────────────
const DEFAULT_INVENTORY = [
  { section: "🌾  DRY GOODS", items: [
    { id: 5,  name: "Flour",                          order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 17,   reorder: 4   },
    { id: 6,  name: "Yeast",                          order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
  ]},
  { section: "🥦  PRODUCE", items: [
    { id: 8,  name: "Basil - Fresh",                  order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 9,  name: "Broccoli Crowns",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 10, name: "Cherry Tomatoes",                order_unit: "Unit",    upu: 1,   vendor: "Market",   max_stock: 4,    reorder: 1   },
    { id: 11, name: "Eggplant",                       order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 12, name: "Garlic - Peeled",                order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 13, name: "Jalapenos",                      order_unit: "Lbs",     upu: 1,   vendor: "Market",   max_stock: 4,    reorder: 1   },
    { id: 14, name: "Lemons",                         order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 15, name: "Mushrooms",                      order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 16, name: "Onions - Red",                   order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 17, name: "Onions - Yellow",                order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 18, name: "Parsley - Fresh",                order_unit: "Unit",    upu: 1,   vendor: "Market",   max_stock: 4,    reorder: 1   },
    { id: 19, name: "Potatoes",                       order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 20, name: "Romaine Lettuce",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 21, name: "Red Peppers",                    order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 22, name: "Green Peppers",                  order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 23, name: "Carrots",                        order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 24, name: "Tomatoes",                       order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "🧀  DAIRY", items: [
    { id: 26, name: "American Cheese",                order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 27, name: "Butter Blocks",                  order_unit: "Case",    upu: 36,  vendor: "Anacapri", max_stock: 36,   reorder: 6   },
    { id: 28, name: "Butter Cups",                    order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 29, name: "Eggs 15 Doz",                    order_unit: "Case",    upu: 2,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 30, name: "Heavy Cream",                    order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 12,   reorder: 4   },
    { id: 31, name: "Mozzarella - Curd",              order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 5,    reorder: 2   },
    { id: 32, name: "Mozzarella Grande",              order_unit: "Case",    upu: 2,   vendor: "Anacapri", max_stock: 10,   reorder: 3   },
    { id: 33, name: "Mozzarella Polly-O",             order_unit: "Case",    upu: 2,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 34, name: "Pecorino Romano - Wheel",        order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 35, name: "Ricotta Cheese Grande",          order_unit: "Case",    upu: 4,   vendor: "Anacapri", max_stock: 8,    reorder: 2   },
    { id: 36, name: "Velveeta Cheese",                order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 37, name: "Whole Milk",                     order_unit: "Case",    upu: 4,   vendor: "Anacapri", max_stock: 8,    reorder: 2   },
  ]},
  { section: "🥩  FRESH MEAT", items: [
    { id: 39, name: "Chicken Breast - Chicks Choice", order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 10,   reorder: 3   },
    { id: 40, name: "Chicken Wings - Party",          order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 41, name: "Ham",                            order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "🫙  OILS & CANNED GOODS", items: [
    { id: 43, name: "Liquid Clear Shortening",        order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 3,    reorder: 1   },
    { id: 44, name: "Soybean Oil",                    order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 3,    reorder: 1   },
    { id: 45, name: "711 (Tomato Sauce)",             order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 24,   reorder: 6   },
    { id: 46, name: "Saporito",                       order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 24,   reorder: 6   },
    { id: 47, name: "Valoroso",                       order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 24,   reorder: 6   },
    { id: 48, name: "Pineapple",                      order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 49, name: "Black Sliced Olives",            order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 50, name: "San Marzano Tomatoes",           order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
  ]},
  { section: "🍝  PASTA & RICE", items: [
    { id: 52, name: "Penne",                          order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 40,   reorder: 10  },
    { id: 53, name: "Spaghetti",                      order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 54, name: "Linguine",                       order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 55, name: "Fettuccine",                     order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 56, name: "Capellini",                      order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 57, name: "Rigatoni",                       order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 58, name: "Whole Wheat Pasta",              order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 59, name: "Jumbo Shells",                   order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 60, name: "Lasagna",                        order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 20,   reorder: 5   },
    { id: 61, name: "Carolina Rice Extra Long Grain", order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 1", items: [
    { id: 63, name: "Chicken Nuggets",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 64, name: "Chicken Tenders",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 65, name: "Boneless Wings",                 order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 66, name: "French Fries",                   order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 67, name: "Sweet Potato Fries",             order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 68, name: "Burgers",                        order_unit: "Case",    upu: 20,  vendor: "Anacapri", max_stock: 60,   reorder: 20  },
    { id: 69, name: "Wraps",                          order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 70, name: "Zucchini Sticks",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 71, name: "Cheese Ravioli",                 order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 72, name: "Mozzarella Sticks",              order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 2", items: [
    { id: 74, name: "Chopped Spinach",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 75, name: "Bacon Bits",                     order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 76, name: "Turkey",                         order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 77, name: "Pepperoni",                      order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 78, name: "Ribeye Steak",                   order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 79, name: "Veal",                           order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 80, name: "Chopped Meat",                   order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 81, name: "Sausage",                        order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 82, name: "Calamari",                       order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 83, name: "Peeled Shrimp",                  order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 84, name: "Baby Clams",                     order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 85, name: "Mussels",                        order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 86, name: "Tilapia",                        order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "🗃️  RACK 1", items: [
    { id: 88, name: "Salt",                           order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 89, name: "Sugar",                          order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 90, name: "Bread Crumbs",                   order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 91, name: "Panko Bread Crumbs",             order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 92, name: "Napkins",                        order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 93, name: "Paper Plates",                   order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
  ]},
  { section: "🗄️  SHELF 1", items: [
    { id: 95,  name: "Powdered Sugar",                order_unit: "Bag",     upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 96,  name: "Cannoli Shells",                order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 97,  name: "Tie Bags",                      order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 98,  name: "Ziplock Bags Gallon",           order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 99,  name: "Straws",                        order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 100, name: "Forks",                         order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 101, name: "Knives",                        order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 102, name: "Spoons",                        order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 103, name: "Pizza Stack",                   order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 104, name: "Gloves L",                      order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 105, name: "Gloves XL",                     order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 106, name: "18in Clear Film",               order_unit: "Roll",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 107, name: "24in Clear Film",               order_unit: "Roll",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 108, name: "12in Aluminum Foil",            order_unit: "Roll",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 109, name: "Plastic Bags",                  order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 110, name: "Junior Wax",                    order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 111, name: "16oz Deli Container",           order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 112, name: "5¾x6x3 Container",             order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 113, name: "5¼x5⅜x2⅝ Container",          order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
  ]},
  { section: "🗄️  SHELF 2", items: [
    { id: 115, name: "8in Dome Lids",                 order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 116, name: "8in Aluminum Dish",             order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 117, name: "7in Dome Lids",                 order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 118, name: "7in Aluminum Dish",             order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 119, name: "20Lb Brown Bags",               order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 120, name: "12Lb Brown Bags",               order_unit: "Case",    upu: 500, vendor: "Anacapri", max_stock: 1000, reorder: 200 },
    { id: 121, name: "Hero Containers",               order_unit: "Case",    upu: 200, vendor: "Anacapri", max_stock: 400,  reorder: 100 },
    { id: 122, name: "4oz Souffle Lids",              order_unit: "Case",    upu: 200, vendor: "Anacapri", max_stock: 400,  reorder: 100 },
    { id: 123, name: "4oz Souffle Cups",              order_unit: "Case",    upu: 200, vendor: "Anacapri", max_stock: 400,  reorder: 100 },
    { id: 124, name: "2oz Souffle Lids",              order_unit: "Case",    upu: 200, vendor: "Anacapri", max_stock: 400,  reorder: 100 },
    { id: 125, name: "2oz Souffle Cups",              order_unit: "Case",    upu: 200, vendor: "Anacapri", max_stock: 400,  reorder: 100 },
    { id: 126, name: "Heinz Ketchup",                 order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 127, name: "Mayo",                          order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 128, name: "Honey Mustard Dressing",        order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 129, name: "Blue Cheese Dressing",          order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 130, name: "Ranch Dressing",                order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 131, name: "Vinegar",                       order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 132, name: "Italian Dressing",              order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 133, name: "Balsamic Dressing",             order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 134, name: "Olive Oil",                     order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 6,    reorder: 2   },
    { id: 135, name: "White Wine",                    order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 12,   reorder: 4   },
    { id: 136, name: "Vodka",                         order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 12,   reorder: 4   },
    { id: 137, name: "Marsala Wine",                  order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 12,   reorder: 4   },
  ]},
  { section: "🥫  CONDIMENTS & SAUCES", items: [
    { id: 139, name: "Mango",                         order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 140, name: "Garlic Parm",                   order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 141, name: "Franks Red Hot",                order_unit: "Gallon",  upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 142, name: "BBQ Sauce",                     order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 143, name: "Honey BBQ Sauce",               order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 144, name: "Taco Sauce",                    order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 145, name: "Tarter Sauce",                  order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 146, name: "Lemon Juice",                   order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
  ]},
  { section: "📦  BOXES", items: [
    { id: 148, name: "18in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 149, name: "16in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 150, name: "14in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 151, name: "12in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 152, name: "10in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 153, name: "Tommys Paper Cups",             order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
  ]},
  { section: "🛍️  DISPOSABLES & PACKAGING", items: [
    { id: 155, name: "Full Size Medium Trays",        order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 156, name: "Half Size Medium Trays",        order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 157, name: "Full Size Deep Trays",          order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 158, name: "Half Size Deep Trays",          order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 50,   reorder: 15  },
    { id: 159, name: "Full Size Lids",                order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 160, name: "Half Size Lids",                order_unit: "Case",    upu: 50,  vendor: "Anacapri", max_stock: 100,  reorder: 25  },
    { id: 161, name: "Masking Tape Roll",             order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 162, name: "Clear Bags",                    order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 163, name: "Black Bags",                    order_unit: "Case",    upu: 100, vendor: "Anacapri", max_stock: 200,  reorder: 50  },
  ]},
  { section: "🧹  CLEANING SUPPLIES", items: [
    { id: 166, name: "Bleach",                        order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 167, name: "Pine Cleaner",                  order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 168, name: "Oven Cleaner",                  order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 169, name: "Glass Cleaner",                 order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 170, name: "Joy Dish Soap",                 order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 171, name: "Steel Sponge",                  order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 24,   reorder: 6   },
    { id: 172, name: "Broom Head",                    order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 173, name: "Mop Head",                      order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 174, name: "Toilet Bowl Gel",               order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 175, name: "Bathroom Bleach Foamer Spray",  order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 176, name: "Scrubbing Bubbles",             order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 177, name: "Lysol Spray",                   order_unit: "Case",    upu: 6,   vendor: "Anacapri", max_stock: 12,   reorder: 3   },
    { id: 178, name: "Brillo Pads",                   order_unit: "Case",    upu: 12,  vendor: "Anacapri", max_stock: 24,   reorder: 6   },
  ]},
  { section: "❄️  BOX ROOM FREEZER", items: [
    { id: 180, name: "Cheesecake",                    order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 181, name: "Tres Leche",                    order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 182, name: "Chocolate Moose",               order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 183, name: "Red Velvet",                    order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 184, name: "Cannoli Cream",                 order_unit: "Each",    upu: 1,   vendor: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 185, name: "Tiramisu",                      order_unit: "Case",    upu: 1,   vendor: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
];

// ─── USERS (demo + Tommy's) ──────────────────────────────────────────────────
const USERS = {
  "owner@kitchen.com":    { password: "owner123",    role: "owner",    name: "Owner",    group: "demo" },
  "employee@kitchen.com": { password: "employee123", role: "employee", name: "Employee", group: "demo" },
  "ronnie@kitchen.com":   { password: "ronnie123",   role: "owner",    name: "Ronnie",   group: "tommys" },
  "roberto@kitchen.com":  { password: "roberto123",  role: "employee", name: "Roberto",  group: "tommys" },
};

// ─── DEFAULT VENDORS (Tommy's starter) ───────────────────────────────────────
const DEFAULT_VENDORS = [
  { id: 1, name: "Anacapri", orderDays: [3] },   // Wednesday
  { id: 2, name: "Market",   orderDays: [4] },   // Thursday
];

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://fsvlxosbbevzyvegbqry.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdmx4b3NiYmV2enl2ZWdicXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NzQ2MjgsImV4cCI6MjA4OTA1MDYyOH0.AcnnB4QecNHEu3-N_VS6aPHrpt9kq464arjNc2DNugU";
let _sb = null;
const getSB = () => { if (_sb) return _sb; if (window.supabase) { _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); } return _sb; };
const sbGet = async (grp, key) => { const sb = getSB(); if (!sb) return null; try { const { data, error } = await sb.from("moe_data").select("data_value").eq("group_id", grp).eq("data_key", key).single(); if (error || !data) return null; return JSON.parse(data.data_value); } catch { return null; } };
const sbSet = async (grp, key, value) => { const sb = getSB(); if (!sb) return; try { await sb.from("moe_data").upsert({ group_id: grp, data_key: key, data_value: JSON.stringify(value) }, { onConflict: "group_id,data_key" }); } catch {} };

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const getWeekNumber = (d = new Date()) => { const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return Math.ceil((((date - yearStart) / 86400000) + 1) / 7); };
const getToday = () => new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

// ─── STOCK HELPERS ────────────────────────────────────────────────────────────
const calcOrderQty = (item, stock) => {
  const s = stock ?? 0;
  if (s >= item.reorder) return 0;
  return Math.ceil(Math.max(0, item.max_stock - s) / Math.max(1, item.upu));
};

const getStatus = (item, stock) => {
  const s = stock ?? 0;
  if (s >= item.max_stock) return { label: "FULL",      color: "#16a34a", bg: "#052e16" };
  if (s >= item.reorder)   return { label: "OK",        color: "#22c55e", bg: "#052e16" };
  if (s > 0)               return { label: "LOW",       color: "#f59e0b", bg: "#422006" };
  return                          { label: "EMPTY",     color: "#ef4444", bg: "#450a0a" };
};

// Get all items flat with their section + vendor info
const flatItems = (inventory) => inventory.flatMap(s => s.items.map(i => ({ ...i, section: s.section })));

// Get vendors ordering today
const vendorsOrderingToday = (vendors) => {
  const today = getToday();
  return vendors.filter(v => v.orderDays && v.orderDays.includes(today));
};

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
const printVendorPDF = ({ vendorName, items, weekNum, date }) => {
  const win = window.open("", "_blank");
  const rows = items.filter(i => i.qty > 0).map(item =>
    `<tr><td>${item.name}</td><td style="text-align:center">${item.section.replace(/[^\w\s\-&]/g,"").trim()}</td><td style="text-align:center;font-weight:700">${item.qty} ${item.order_unit}</td></tr>`
  ).join("");
  const totalItems = items.filter(i => i.qty > 0).length;
  win.document.write(`<html><head><title>${vendorName} — WK${weekNum}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:700px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.vendor{font-size:28px;font-weight:800;margin:0 0 6px}.meta{color:#666;font-size:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1e293b;color:#fff;padding:10px 14px;text-align:left}th:last-child{text-align:center}td{padding:10px 14px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:20px;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}@media print{body{padding:16px}}</style></head><body>
    <div class="vendor">📦 ${vendorName}</div>
    <h1>Order — Week ${weekNum}</h1>
    <div class="meta">${date} · ${totalItems} item${totalItems!==1?"s":""}</div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Location</th><th style="text-align:center">Qty to Order</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">MOE · Make Ordering Easy · Printed ${new Date().toLocaleDateString()}</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser]         = useState(null);
  const [stock, setStock]       = useState({});
  const [vendors, setVendors]   = useState(DEFAULT_VENDORS);
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [history, setHistory]   = useState([]);
  const [view, setView]         = useState("inventory");
  const [group, setGroup]       = useState("demo");
  const [flash, setFlash]       = useState("");
  const [loginError, setLoginError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showFlash = (msg = "✓ Saved") => { setFlash(msg); setTimeout(() => setFlash(""), 2000); };

  // ── Persistence ──────────────────────────────────────────────────────────
  const save = useCallback((key, value) => {
    try { localStorage.setItem(`moe_${group}_${key}`, JSON.stringify(value)); } catch {}
    sbSet(group, key, value);
  }, [group]);

  const load = useCallback(async (key, fallback) => {
    const sbVal = await sbGet(group, key);
    if (sbVal !== null) { try { localStorage.setItem(`moe_${group}_${key}`, JSON.stringify(sbVal)); } catch {} return sbVal; }
    try { const raw = localStorage.getItem(`moe_${group}_${key}`); if (raw) { const v = JSON.parse(raw); sbSet(group, key, v); return v; } } catch {}
    return fallback;
  }, [group]);

  // ── Save inventory ────────────────────────────────────────────────────────
  const saveInventory = useCallback((newInv) => { setInventory(newInv); save("inventory", newInv); showFlash(); }, [save]);

  // ── Load data on login ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const st = await load("stock", {});
      const vd = await load("vendors", DEFAULT_VENDORS);
      const hi = await load("history", []);
      const inv = await load("inventory", DEFAULT_INVENTORY);
      setStock(st);
      setVendors(vd);
      setHistory(hi);
      setInventory(inv);
    };
    init();
  }, [user, group]);

  // ── Real-time sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!group || !user) return;
    const sb = getSB(); if (!sb) return;
    const channel = sb.channel(`moe_${group}`).on("postgres_changes", {
      event: "*", schema: "public", table: "moe_data", filter: `group_id=eq.${group}`
    }, (payload) => {
      try {
        const { data_key, data_value } = payload.new;
        const value = JSON.parse(data_value);
        if (data_key === "stock")     setStock(value);
        if (data_key === "vendors")   setVendors(value);
        if (data_key === "history")   setHistory(value);
        if (data_key === "inventory") setInventory(value);
      } catch {}
    }).subscribe();
    return () => { sb.removeChannel(channel); };
  }, [group, user]);

  // ── Stock update ─────────────────────────────────────────────────────────
  const updateStock = (id, val) => {
    const n = parseInt(val);
    const newStock = { ...stock, [id]: isNaN(n) ? 0 : Math.max(0, n) };
    setStock(newStock);
    save("stock", newStock);
  };

  // ── Submit order for a vendor ────────────────────────────────────────────
  const submitOrder = (vendorName) => {
    const allItems = flatItems(inventory);
    const vendorItems = allItems.filter(i => (i.vendor || "").trim().toLowerCase() === vendorName.toLowerCase());
    const orderLines = vendorItems.map(item => ({
      id: item.id, name: item.name, section: item.section,
      order_unit: item.order_unit, vendor: item.vendor,
      qty: calcOrderQty(item, stock[item.id] ?? 0),
      currentStock: stock[item.id] ?? 0,
    })).filter(l => l.qty > 0);

    if (orderLines.length === 0) return;

    // 1. Save to history
    const entry = {
      id: `ord_${Date.now()}`,
      vendor: vendorName,
      weekNumber: getWeekNumber(),
      year: new Date().getFullYear(),
      day: DAYS[getToday()],
      date: new Date().toISOString(),
      lines: orderLines,
      totalItems: orderLines.length,
    };
    const newHistory = [entry, ...history];
    setHistory(newHistory);
    save("history", newHistory);

    // 2. Reset this vendor's items to 0
    const newStock = { ...stock };
    vendorItems.forEach(item => { newStock[item.id] = 0; });
    setStock(newStock);
    save("stock", newStock);

    showFlash(`✓ ${vendorName} order submitted`);
  };

  // ── Save vendors ─────────────────────────────────────────────────────────
  const saveVendors = (newVendors) => { setVendors(newVendors); save("vendors", newVendors); showFlash(); };

  // ── Login ────────────────────────────────────────────────────────────────
  if (!user) return <LoginScreen onLogin={u => { setUser(u); setGroup(u.group || "demo"); setLoginError(""); }} error={loginError} setError={setLoginError} />;

  const todayVendors = vendorsOrderingToday(vendors);
  const weekNum = getWeekNumber();

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Sidebar overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200 }} />}

      {/* Sidebar */}
      <div style={{ position:"fixed", top:0, left:0, height:"100vh", width:260, background:"#0f1a2e", borderRight:"1px solid #1e2d45", transform:sidebarOpen?"translateX(0)":"translateX(-100%)", transition:"transform 0.25s ease", zIndex:201, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px", borderBottom:"1px solid #1e2d45", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ color:"#f1f5f9", fontSize:20, fontWeight:900, fontFamily:"'DM Sans',sans-serif" }}>M<span style={{ color:"#94a3b8" }}>OE</span></span>
          <button onClick={() => setSidebarOpen(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #1e2d45" }}>
          <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{user.name}</div>
          <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{user.role.toUpperCase()} · WK {weekNum} · {DAYS[getToday()]}</div>
        </div>
        <div style={{ flex:1, padding:"12px", overflowY:"auto" }}>
          {[
            { key:"inventory", label:"Inventory", icon:"📋", desc:"Count stock by location" },
            { key:"orders",    label:"Orders",    icon:"📦", desc:`${todayVendors.length} vendor${todayVendors.length!==1?"s":""} today`, badge: todayVendors.length },
            { key:"history",   label:"History",   icon:"📚", desc:"Past orders by week" },
            ...(user.role === "owner" ? [
              { key:"backend",  label:"Backend",  icon:"🔧", desc:"Add & edit items" },
              { key:"settings", label:"Settings", icon:"⚙️", desc:"Vendors & schedules" },
            ] : []),
          ].map(item => {
            const isActive = view === item.key;
            return (
              <button key={item.key} onClick={() => { setView(item.key); setSidebarOpen(false); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:isActive?"#080c14":"transparent", border:"none", borderRadius:10, padding:"11px 14px", cursor:"pointer", marginBottom:4, borderLeft:isActive?"3px solid #e2e8f0":"3px solid transparent" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#080c14"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize:18 }}>{item.icon}</span>
                <div style={{ textAlign:"left", flex:1 }}>
                  <div style={{ color:isActive?"#e2e8f0":"#94a3b8", fontSize:14, fontWeight:isActive?600:400 }}>{item.label}</div>
                  <div style={{ color:"#475569", fontSize:11, marginTop:1 }}>{item.desc}</div>
                </div>
                {item.badge > 0 && <span style={{ background:"#422006", color:"#fbbf24", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{item.badge}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding:"12px", borderTop:"1px solid #1e2d45" }}>
          <button onClick={() => setUser(null)} style={{ width:"100%", background:"transparent", border:"1px solid #1e2d45", borderRadius:8, color:"#64748b", padding:"10px", cursor:"pointer", fontSize:13 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Header */}
      <header style={{ background:"#0f1a2e", borderBottom:"1px solid #1e2d45", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:101 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", borderRadius:8, display:"flex", flexDirection:"column", gap:4 }}
            onMouseEnter={e => e.currentTarget.style.background="#1e2d45"} onMouseLeave={e => e.currentTarget.style.background="none"}>
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
          </button>
          <span style={{ color:"#f1f5f9", fontSize:18, fontWeight:900 }}>M<span style={{ color:"#94a3b8" }}>OE</span></span>
          <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{view.toUpperCase()}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {todayVendors.length > 0 && view !== "orders" && (
            <button onClick={() => setView("orders")} style={{ background:"#422006", border:"1px solid #d97706", borderRadius:8, padding:"4px 12px", color:"#fbbf24", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer" }}>
              📦 {todayVendors.length} order{todayVendors.length!==1?"s":""} due
            </button>
          )}
          <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:6, padding:"3px 8px", color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>WK {weekNum}</span>
          <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{DAYS_SHORT[getToday()]}</span>
          {flash && <span style={{ color:"#22c55e", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{flash}</span>}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"20px 16px" }}>
        {view === "inventory" && <InventoryView inventory={inventory} stock={stock} updateStock={updateStock} vendors={vendors} />}
        {view === "orders" && <OrdersView inventory={inventory} stock={stock} vendors={vendors} submitOrder={submitOrder} />}
        {view === "history" && <HistoryView history={history} />}
        {view === "backend" && user.role === "owner" && <BackendView inventory={inventory} saveInventory={saveInventory} vendors={vendors} stock={stock} />}
        {view === "settings" && user.role === "owner" && <SettingsView vendors={vendors} saveVendors={saveVendors} inventory={inventory} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, error, setError }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [show, setShow] = useState(false);
  const handleLogin = () => { const u = USERS[email.toLowerCase().trim()]; if (u && u.password === pass) onLogin({ ...u, email }); else setError("Invalid email or password."); };
  return (
    <div style={{ minHeight:"100vh", background:"#080c14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width:380 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:36, fontWeight:900, color:"#f1f5f9", marginBottom:4 }}>M<span style={{ color:"#94a3b8" }}>OE</span></div>
          <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"2px", marginBottom:4 }}>MAKE ORDERING EASY</div>
          <p style={{ color:"#64748b", fontSize:14, margin:0 }}>Sign in to continue</p>
        </div>
        <div style={{ background:"#0f1a2e", borderRadius:16, border:"1px solid #1e2d45", padding:28 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} placeholder="you@kitchen.com" type="email"
              style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} type={show?"text":"password"} placeholder="••••••••"
                style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 40px 10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => setShow(!show)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:14 }}>{show?"🙈":"👁"}</button>
            </div>
          </div>
          {error && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{error}</div>}
          <button onClick={handleLogin} style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:12, color:"#080c14", fontSize:15, fontWeight:700, cursor:"pointer" }}>Sign In</button>
        </div>
        <div style={{ marginTop:20, background:"#0f1a2e", borderRadius:12, border:"1px solid #1e2d45", padding:"14px 18px" }}>
          <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>Demo Credentials</div>
          <div style={{ color:"#94a3b8", fontSize:12, lineHeight:2 }}><span style={{ color:"#e2e8f0" }}>Owner:</span> owner@kitchen.com / owner123<br /><span style={{ color:"#22c55e" }}>Employee:</span> employee@kitchen.com / employee123</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY VIEW — Count stock by store location, vendor tags on each item
// ═══════════════════════════════════════════════════════════════════════════════
function InventoryView({ inventory, stock, updateStock, vendors }) {
  const todayVendors = vendorsOrderingToday(vendors);
  const allItems = flatItems(inventory);
  const urgentCount = allItems.filter(i => (stock[i.id] ?? 0) < i.reorder).length;

  return (
    <div>
      {/* Order day notification */}
      {todayVendors.length > 0 && (
        <div style={{ background:"#422006", border:"1px solid #d97706", borderRadius:12, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>📦</span>
          <div>
            <div style={{ color:"#fbbf24", fontWeight:600, fontSize:14 }}>Order day! {todayVendors.map(v => v.name).join(", ")} ordering today</div>
            <div style={{ color:"#d97706", fontSize:12, marginTop:2 }}>Count stock, then go to Orders to submit</div>
          </div>
        </div>
      )}

      {/* Urgent items banner */}
      {urgentCount > 0 && (
        <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:12, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:18 }}>🔴</span>
          <div style={{ color:"#fca5a5", fontWeight:600, fontSize:13 }}>{urgentCount} item{urgentCount!==1?"s":""} below reorder point</div>
        </div>
      )}

      <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Inventory Count</h2>
      <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>Walk the kitchen, count by location</p>

      {inventory.map(section => {
        const sectionItems = section.items;
        if (sectionItems.length === 0) return null;
        return (
          <div key={section.section} style={{ marginBottom:16 }}>
            {/* Section header */}
            <div style={{ background:"#080c14", border:"1px solid #1e2d45", borderBottom:"none", borderRadius:"12px 12px 0 0", padding:"8px 16px" }}>
              <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>{section.section}</span>
            </div>
            {/* Items */}
            <div style={{ border:"1px solid #1e2d45", borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
              {sectionItems.map((item, idx) => {
                const s = stock[item.id] ?? 0;
                const status = getStatus(item, s);
                const orderQty = calcOrderQty(item, s);
                return (
                  <div key={item.id} style={{ padding:"10px 14px", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:idx>0?"1px solid #080c14":"none" }}>
                    {/* Top row: name + vendor tag + status */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:6, flexWrap:"wrap" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
                        <span style={{ color:"#e2e8f0", fontSize:14, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
                        <span style={{ background:"#0f2040", border:"1px solid #1e3a5f", borderRadius:4, padding:"1px 6px", color:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{item.vendor}</span>
                      </div>
                      <span style={{ background:status.bg, color:status.color, borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{status.label}</span>
                    </div>
                    {/* Bottom row: stock controls + order qty */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <button onClick={() => updateStock(item.id, Math.max(0, s-1))} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                        <input type="number" value={s} min={0} onChange={e => updateStock(item.id, e.target.value)} onFocus={e => e.target.select()}
                          style={{ width:52, background:"#080c14", border:`1px solid ${status.color}`, borderRadius:8, padding:"6px", color:status.color, fontSize:15, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                        <button onClick={() => updateStock(item.id, s+1)} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                        <span style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", marginLeft:4 }}>{item.order_unit} · Max {item.max_stock}</span>
                      </div>
                      <div>{orderQty > 0 ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>Order {orderQty}</span> : null}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS VIEW — Shows vendors ordering today, submit per vendor
// ═══════════════════════════════════════════════════════════════════════════════
function OrdersView({ inventory, stock, vendors, submitOrder }) {
  const todayVendors = vendorsOrderingToday(vendors);
  const allItems = flatItems(inventory);
  const weekNum = getWeekNumber();
  const [submitted, setSubmitted] = useState({});

  const handleSubmit = (vendorName) => {
    submitOrder(vendorName);
    setSubmitted(prev => ({ ...prev, [vendorName]: true }));
  };

  if (todayVendors.length === 0) {
    // Show which vendors order on which days
    return (
      <div>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Orders</h2>
        <p style={{ color:"#475569", fontSize:13, margin:"0 0 24px" }}>No vendors ordering today ({DAYS[getToday()]})</p>
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📅</div>
          <div style={{ color:"#94a3b8", fontSize:15, fontWeight:600, marginBottom:16 }}>Upcoming order days</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:300, margin:"0 auto" }}>
            {vendors.map(v => (
              <div key={v.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#080c14", borderRadius:8, padding:"10px 14px" }}>
                <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>📦 {v.name}</span>
                <span style={{ color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{(v.orderDays || []).map(d => DAYS_SHORT[d]).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Orders — {DAYS[getToday()]}, Week {weekNum}</h2>
      <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>{todayVendors.length} vendor{todayVendors.length!==1?"s":""} ordering today</p>

      {todayVendors.map(vendor => {
        const vendorItems = allItems.filter(i => (i.vendor || "").trim().toLowerCase() === vendor.name.toLowerCase());
        const orderLines = vendorItems.map(item => ({
          ...item,
          qty: calcOrderQty(item, stock[item.id] ?? 0),
          currentStock: stock[item.id] ?? 0,
        }));
        const needsOrder = orderLines.filter(l => l.qty > 0);
        const isSubmitted = submitted[vendor.name];

        return (
          <div key={vendor.id} style={{ marginBottom:24 }}>
            {/* Vendor header */}
            <div style={{ background:"#080c14", border:"1px solid #1e2d45", borderBottom:"none", borderRadius:"12px 12px 0 0", padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#e2e8f0", fontSize:16, fontWeight:700 }}>📦 {vendor.name}</div>
                <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{vendorItems.length} items · {needsOrder.length} to order</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {!isSubmitted && needsOrder.length > 0 && (
                  <button onClick={() => printVendorPDF({ vendorName: vendor.name, items: orderLines, weekNum, date: fmtDate(new Date()) })}
                    style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:7, padding:"6px 14px", color:"#94a3b8", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#94a3b8"; }}>
                    🖨 PDF
                  </button>
                )}
                {isSubmitted ? (
                  <span style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:8, padding:"6px 16px", color:"#4ade80", fontSize:13, fontWeight:600 }}>✓ Submitted</span>
                ) : needsOrder.length > 0 ? (
                  <button onClick={() => handleSubmit(vendor.name)}
                    style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"8px 20px", color:"#080c14", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    🚀 Submit Order
                  </button>
                ) : null}
              </div>
            </div>

            {/* Order lines */}
            <div style={{ border:"1px solid #1e2d45", borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
              {isSubmitted ? (
                <div style={{ padding:32, textAlign:"center", background:"#0f1a2e" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ color:"#4ade80", fontSize:15, fontWeight:700 }}>Order submitted!</div>
                  <div style={{ color:"#475569", fontSize:12, marginTop:4 }}>Saved to history · Stock reset to zero for this vendor</div>
                </div>
              ) : needsOrder.length === 0 ? (
                <div style={{ padding:32, textAlign:"center", background:"#0f1a2e" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ color:"#4ade80", fontSize:14, fontWeight:600 }}>All stocked up — nothing to order</div>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 80px 100px", background:"#080c14", padding:"6px 16px", gap:8 }}>
                    {["Item","Stock","Status","Order Qty"].map(h => (
                      <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {needsOrder.map((item, idx) => {
                    const status = getStatus(item, item.currentStock);
                    return (
                      <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 100px 80px 100px", padding:"10px 16px", alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14", gap:8 }}>
                        <div>
                          <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:500 }}>{item.name}</div>
                          <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{item.section.replace(/[^\w\s\-&]/g,"").trim()} · {item.order_unit}</div>
                        </div>
                        <span style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{item.currentStock} / {item.max_stock}</span>
                        <span style={{ background:status.bg, color:status.color, borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>{status.label}</span>
                        <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:7, padding:"4px 10px", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{item.qty} {item.order_unit}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY VIEW — Past orders organized by week number, PDF per vendor
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryView({ history }) {
  // Group by year-week
  const byWeek = {};
  history.forEach(entry => {
    const key = `${entry.year}-WK${String(entry.weekNumber).padStart(2,"0")}`;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(entry);
  });
  const weekKeys = Object.keys(byWeek).sort().reverse();

  return (
    <div>
      <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Order History</h2>
      <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>Past orders by week</p>

      {weekKeys.length === 0 ? (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:48, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📚</div>
          <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No orders yet</div>
          <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Submitted orders will appear here</div>
        </div>
      ) : (
        weekKeys.map(weekKey => (
          <div key={weekKey} style={{ marginBottom:20 }}>
            <div style={{ background:"#080c14", border:"1px solid #1e2d45", borderBottom:"none", borderRadius:"12px 12px 0 0", padding:"10px 16px" }}>
              <span style={{ color:"#a5b4fc", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{weekKey}</span>
              <span style={{ color:"#475569", fontSize:12, marginLeft:10 }}>{byWeek[weekKey].length} order{byWeek[weekKey].length!==1?"s":""}</span>
            </div>
            <div style={{ border:"1px solid #1e2d45", borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
              {byWeek[weekKey].map((entry, idx) => (
                <div key={entry.id} style={{ background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:idx>0?"1px solid #080c14":"none" }}>
                  <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ color:"#e2e8f0", fontSize:14, fontWeight:600 }}>📦 {entry.vendor}</div>
                      <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{entry.day} · {fmtDate(entry.date)} · {entry.totalItems} item{entry.totalItems!==1?"s":""}</div>
                    </div>
                    <button onClick={() => printVendorPDF({ vendorName: entry.vendor, items: entry.lines, weekNum: entry.weekNumber, date: fmtDate(entry.date) })}
                      style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:6, padding:"5px 12px", color:"#94a3b8", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#94a3b8"; }}>
                      🖨 PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW — Manage vendors & their order days (owner only)
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsView({ vendors, saveVendors, inventory }) {
  const [localVendors, setLocalVendors] = useState(vendors);
  const [dirty, setDirty] = useState(false);

  const update = (id, field, value) => {
    setLocalVendors(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    setDirty(true);
  };

  const toggleDay = (vendorId, day) => {
    setLocalVendors(prev => prev.map(v => {
      if (v.id !== vendorId) return v;
      const days = v.orderDays || [];
      return { ...v, orderDays: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort() };
    }));
    setDirty(true);
  };

  const addVendor = () => {
    setLocalVendors(prev => [...prev, { id: Date.now(), name: "", orderDays: [] }]);
    setDirty(true);
  };

  const removeVendor = (id) => {
    setLocalVendors(prev => prev.filter(v => v.id !== id));
    setDirty(true);
  };

  const handleSave = () => {
    saveVendors(localVendors.filter(v => v.name.trim()));
    setDirty(false);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Settings</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Manage vendors and order schedules</p>
        </div>
        {dirty && (
          <button onClick={handleSave}
            style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            💾 Save Changes
          </button>
        )}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
        {localVendors.map((vendor, idx) => {
          const itemCount = flatItems(inventory).filter(i => (i.vendor||"").trim().toLowerCase() === vendor.name.toLowerCase()).length;
          return (
            <div key={vendor.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:18 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>Vendor {idx+1}</span>
                  {vendor.name && <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>· {itemCount} items</span>}
                </div>
                {localVendors.length > 1 && (
                  <button onClick={() => removeVendor(vendor.id)}
                    style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"3px 8px" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
                    Remove
                  </button>
                )}
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Vendor Name</label>
                <input value={vendor.name} onChange={e => update(vendor.id, "name", e.target.value)} placeholder="e.g. Anacapri, Market..."
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Order Days</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {DAYS.map((day, i) => {
                    const selected = (vendor.orderDays || []).includes(i);
                    return (
                      <button key={day} onClick={() => toggleDay(vendor.id, i)}
                        style={{ padding:"8px 14px", borderRadius:8, background:selected?"#e2e8f0":"#080c14", border:`1px solid ${selected?"#e2e8f0":"#1e2d45"}`, color:selected?"#080c14":"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {DAYS_SHORT[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addVendor}
        style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"10px 20px", display:"flex", alignItems:"center", gap:6 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
        ＋ Add Vendor
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITABLE CELL — Click to edit inline
// ═══════════════════════════════════════════════════════════════════════════════
function EditableCell({ value, onSave, type="text", width=80 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const open = () => { setEditing(true); setDraft(String(value)); };
  const commit = () => { setEditing(false); if (String(draft) !== String(value)) onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(String(value)); };
  if (!editing) return (
    <div onClick={open} title="Click to edit" className="edit-cell"
      style={{ cursor:"text", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:width, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {value !== "" && value !== null && value !== undefined ? String(value) : <span style={{ color:"#475569", fontStyle:"italic" }}>—</span>}
      </span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7, flexShrink:0, display:"none" }}>✏</span>
    </div>
  );
  return (
    <input autoFocus value={draft} type={type} min={type === "number" ? 0 : undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
      style={{ width, background:"#080c14", border:"1px solid #e2e8f0", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER UNIT SELECT
// ═══════════════════════════════════════════════════════════════════════════════
const ORDER_UNITS = ["Case","Each","Piece","Unit","Bag","Bundle","Gallon","Roll","Lbs"];
function OrderUnitSelect({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <div onClick={() => setEditing(true)}
      style={{ cursor:"pointer", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:80, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1 }}>{value || "—"}</span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7, display:"none" }}>✏</span>
    </div>
  );
  return (
    <select autoFocus value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}
      style={{ background:"#080c14", border:"1px solid #e2e8f0", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none" }}>
      {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOVER ROW — Shows remove button on hover
// ═══════════════════════════════════════════════════════════════════════════════
function HoverRow({ children, bg, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const handleRemove = (e) => { e.stopPropagation(); if (confirm) { onRemove(); } else { setConfirm(true); setTimeout(() => setConfirm(false), 2500); } };
  const childArray = React.Children.toArray(children);
  const firstTd = childArray[0]; const restTds = childArray.slice(1);
  const enhancedFirstTd = React.cloneElement(firstTd, {
    style: { ...firstTd.props.style, position:"relative" },
    children: (<div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ flex:1 }}>{firstTd.props.children}</div>
      {hovered && <button onClick={handleRemove} title={confirm ? "Click again to confirm" : "Remove item"} style={{ background:confirm?"#7f1d1d":"transparent", border:`1px solid ${confirm?"#ef4444":"#475569"}`, borderRadius:4, color:confirm?"#fca5a5":"#64748b", cursor:"pointer", fontSize:10, padding:"2px 6px", whiteSpace:"nowrap", flexShrink:0, lineHeight:1.4 }}>{confirm ? "confirm ✕" : "✕"}</button>}
    </div>),
  });
  return (<tr style={{ background:bg, borderTop:"1px solid #0f172a" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setConfirm(false); }}>{enhancedFirstTd}{restTds}</tr>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKEND VIEW — Original table layout with click-to-edit
// ═══════════════════════════════════════════════════════════════════════════════
function BackendView({ inventory, saveInventory, vendors, stock }) {
  // ── Helpers that mutate inventory and persist ──
  const saveItemField = (itemId, field, rawVal) => {
    const numFields = ["upu", "max_stock", "reorder"];
    const val = numFields.includes(field) ? (parseInt(rawVal) || 0) : rawVal;
    saveInventory(inventory.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, [field]: val } : i) })));
  };

  const addItem = (sectionKey) => {
    const newItem = { id: Date.now(), name: "New Item", order_unit: "Case", upu: 1, vendor: vendors[0]?.name || "", max_stock: 1, reorder: 1 };
    saveInventory(inventory.map(s => s.section === sectionKey ? { ...s, items: [...s.items, newItem] } : s));
  };

  const removeItem = (itemId) => {
    const newInv = inventory.map(s => ({ ...s, items: s.items.filter(i => i.id !== itemId) })).filter(s => s.items.length > 0);
    saveInventory(newInv);
  };

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const addSection = () => {
    if (!newSectionName.trim()) return;
    saveInventory([...inventory, { section: newSectionName.trim(), items: [{ id: Date.now(), name: "New Item", order_unit: "Case", upu: 1, vendor: vendors[0]?.name || "", max_stock: 1, reorder: 1 }] }]);
    setNewSectionName(""); setShowAddSection(false);
  };

  const deleteSection = (sectionKey) => {
    saveInventory(inventory.filter(s => s.section !== sectionKey));
  };

  const saveSectionName = (oldName, newName) => {
    if (!newName.trim() || newName === oldName) return;
    saveInventory(inventory.map(s => s.section === oldName ? { ...s, section: newName.trim() } : s));
  };

  return (
    <div>
      <style>{`@media (max-width: 768px) { .edit-pencil { display: none !important; } } .edit-cell:hover .edit-pencil { display: inline !important; }`}</style>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Backend — Edit Item Details</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Click any cell to edit · Hover a row to remove it</p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          {!showAddSection ? (
            <button onClick={() => setShowAddSection(true)}
              style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"7px 16px", display:"flex", alignItems:"center", gap:6 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
              ＋ Add Section
            </button>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name..."
                onKeyDown={e => { if (e.key === "Enter") addSection(); if (e.key === "Escape") { setShowAddSection(false); setNewSectionName(""); } }}
                style={{ background:"#0f1a2e", border:"1px solid #e2e8f0", borderRadius:7, padding:"7px 12px", color:"#f1f5f9", fontSize:13, outline:"none", width:180 }} />
              <button onClick={addSection} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add</button>
              <button onClick={() => { setShowAddSection(false); setNewSectionName(""); }} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"7px 10px", color:"#64748b", fontSize:13, cursor:"pointer" }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {inventory.map(section => (
        <BackendSection key={section.section} section={section} stock={stock} vendors={vendors}
          saveItemField={saveItemField} addItem={addItem} removeItem={removeItem}
          saveSectionName={saveSectionName} deleteSection={deleteSection} />
      ))}
    </div>
  );
}

// ── Section inside BackendView ────────────────────────────────────────────────
function BackendSection({ section, stock, vendors, saveItemField, addItem, removeItem, saveSectionName, deleteSection }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.section);
  const [confirmDel, setConfirmDel] = useState(false);
  const commitRename = () => { saveSectionName(section.section, draft); setEditing(false); };

  return (
    <div style={{ marginBottom:12 }}>
      {/* Section header */}
      <div style={{ background:"#080c14", padding:"6px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #1e2d45", borderBottom:"none", display:"flex", alignItems:"center", gap:8 }}>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditing(false); setDraft(section.section); } }}
            style={{ background:"transparent", border:"none", borderBottom:"1px solid #e2e8f0", color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", outline:"none", width:220, padding:"2px 0" }} />
        ) : (
          <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", flex:1 }}>{section.section}</span>
        )}
        {!editing && <>
          <button onClick={() => { setDraft(section.section); setEditing(true); }} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, padding:"2px 6px", borderRadius:4 }} onMouseEnter={e => e.currentTarget.style.color="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.color="#475569"}>✏ rename</button>
          <button onClick={() => { if (confirmDel) deleteSection(section.section); else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); } }}
            style={{ background:confirmDel?"#7f1d1d":"none", border:`1px solid ${confirmDel?"#ef4444":"transparent"}`, color:confirmDel?"#fca5a5":"#475569", cursor:"pointer", fontSize:11, padding:"2px 8px", borderRadius:4, lineHeight:1.4 }}
            onMouseEnter={e => { if (!confirmDel) { e.currentTarget.style.color="#ef4444"; e.currentTarget.style.borderColor="#ef4444"; } }}
            onMouseLeave={e => { if (!confirmDel) { e.currentTarget.style.color="#475569"; e.currentTarget.style.borderColor="transparent"; } }}>
            {confirmDel ? "confirm ✕" : "✕ delete"}
          </button>
        </>}
      </div>

      {/* Table */}
      <div style={{ maxHeight:400, overflowY:"auto", overflowX:"auto", position:"relative" }}>
        <table style={{ width:"100%", tableLayout:"fixed", borderCollapse:"collapse", background:"#0f1a2e", border:"1px solid #1e2d45", borderTop:"none", borderRadius:"0 0 12px 12px" }}>
          <thead>
            <tr style={{ background:"#080c14" }}>
              {[
                ["Item Name","left",170,true], ["Vendor","left",100,false], ["Order Unit","left",90,false],
                ["Units/Pkg","center",60,false], ["Max Stock","center",75,false], ["Reorder Pt","center",75,false],
                ["Current","center",70,false], ["Needed","center",70,false], ["Order Qty","center",70,false], ["Status","center",80,false],
              ].map(([h, align, w, stickyLeft]) => (
                <th key={h} style={{ position:"sticky", top:0, left:stickyLeft?0:undefined, zIndex:stickyLeft?4:2, background:"#080c14", color:"#e2e8f0", fontSize:10, fontWeight:600, padding:"8px 8px", textAlign:align, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase", whiteSpace:"nowrap", minWidth:w, width:w, boxShadow:stickyLeft?"2px 0 8px rgba(0,0,0,0.4)":undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item, idx) => {
              const s = stock[item.id] ?? 0;
              const needed = Math.max(0, item.max_stock - s);
              const orderQty = calcOrderQty(item, s);
              const status = getStatus(item, s);
              const rowBg = idx % 2 === 0 ? "#0f1a2e" : "#0a1220";
              return (
                <HoverRow key={item.id} bg={rowBg} onRemove={() => removeItem(item.id)}>
                  <td style={{ padding:"5px 8px", position:"sticky", left:0, zIndex:1, background:rowBg, boxShadow:"2px 0 8px rgba(0,0,0,0.4)" }}>
                    <EditableCell value={item.name} onSave={v => saveItemField(item.id, "name", v)} width={155} />
                  </td>
                  <td style={{ padding:"5px 8px" }}>
                    <select value={item.vendor || ""} onChange={e => saveItemField(item.id, "vendor", e.target.value)}
                      style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"4px 6px", color:"#f1f5f9", fontSize:11, outline:"none", cursor:"pointer", width:"100%" }}>
                      <option value="">—</option>
                      {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"5px 8px" }}><OrderUnitSelect value={item.order_unit} onSave={v => saveItemField(item.id, "order_unit", v)} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.upu} onSave={v => saveItemField(item.id, "upu", v)} type="number" width={50} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.max_stock} onSave={v => saveItemField(item.id, "max_stock", v)} type="number" width={55} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.reorder} onSave={v => saveItemField(item.id, "reorder", v)} type="number" width={55} /></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ color:"#4ade80", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700 }}>{s}</span></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:12 }}>{needed}</span></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}>{orderQty > 0 ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:5, padding:"2px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{orderQty}</span> : <span style={{ color:"#1e2d45", fontSize:12 }}>0</span>}</td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ background:status.bg, color:status.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{status.label}</span></td>
                </HoverRow>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10} style={{ padding:"6px 10px", borderTop:"1px solid #0f172a" }}>
                <button onClick={() => addItem(section.section)}
                  style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:6, color:"#475569", cursor:"pointer", fontSize:12, padding:"5px 14px", display:"flex", alignItems:"center", gap:6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
                  <span style={{ fontSize:14, lineHeight:1 }}>＋</span> Add Item
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
