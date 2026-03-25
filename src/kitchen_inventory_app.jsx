import React, { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MOE — Make Ordering Easy
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_INVENTORY = [
  { section: "🌾  DRY GOODS", items: [
    { id: 5,  name: "Flour",                          order_unit: "Unit",    upu: 1,   vendor: "Anacapri", max_stock: 17,   reorder: 4   },
    { id: 6,  name: "Yeast",                          order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
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
    { id: 43, name: "Liquid Clear Shortening",        order_unit: "Unit",    upu: 1,   vendor: "",         max_stock: 3,    reorder: 1   },
    { id: 44, name: "Soybean Oil",                    order_unit: "Unit",    upu: 1,   vendor: "",         max_stock: 3,    reorder: 1   },
    { id: 45, name: "711 (Tomato Sauce)",             order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 24,   reorder: 6   },
    { id: 46, name: "Saporito",                       order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 24,   reorder: 6   },
    { id: 47, name: "Valoroso",                       order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 24,   reorder: 6   },
    { id: 48, name: "Pineapple",                      order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 49, name: "Black Sliced Olives",            order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 50, name: "San Marzano Tomatoes",           order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
  ]},
  { section: "🍝  PASTA & RICE", items: [
    { id: 52, name: "Penne",                          order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 40,   reorder: 10  },
    { id: 53, name: "Spaghetti",                      order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 54, name: "Linguine",                       order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 55, name: "Fettuccine",                     order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 56, name: "Capellini",                      order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 57, name: "Rigatoni",                       order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 58, name: "Whole Wheat Pasta",              order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 59, name: "Jumbo Shells",                   order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 60, name: "Lasagna",                        order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 20,   reorder: 5   },
    { id: 61, name: "Carolina Rice Extra Long Grain", order_unit: "Bag",     upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 1", items: [
    { id: 63, name: "Chicken Nuggets",                order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 64, name: "Chicken Tenders",                order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 65, name: "Boneless Wings",                 order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 66, name: "French Fries",                   order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 67, name: "Sweet Potato Fries",             order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 68, name: "Burgers",                        order_unit: "Case",    upu: 20,  vendor: "",         max_stock: 60,   reorder: 20  },
    { id: 69, name: "Wraps",                          order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 70, name: "Zucchini Sticks",                order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 71, name: "Cheese Ravioli",                 order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 72, name: "Mozzarella Sticks",              order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 2", items: [
    { id: 74, name: "Chopped Spinach",                order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 75, name: "Bacon Bits",                     order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 76, name: "Turkey",                         order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 77, name: "Pepperoni",                      order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 78, name: "Ribeye Steak",                   order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 79, name: "Veal",                           order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 80, name: "Chopped Meat",                   order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 81, name: "Sausage",                        order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 82, name: "Calamari",                       order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 83, name: "Peeled Shrimp",                  order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 84, name: "Baby Clams",                     order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 85, name: "Mussels",                        order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 86, name: "Tilapia",                        order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
  ]},
  { section: "🗃️  RACK 1", items: [
    { id: 88, name: "Salt",                           order_unit: "Bag",     upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 89, name: "Sugar",                          order_unit: "Bag",     upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 90, name: "Bread Crumbs",                   order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 91, name: "Panko Bread Crumbs",             order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 92, name: "Napkins",                        order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 93, name: "Paper Plates",                   order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
  ]},
  { section: "🗄️  SHELF 1", items: [
    { id: 95,  name: "Powdered Sugar",                order_unit: "Bag",     upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 96,  name: "Cannoli Shells",                order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 97,  name: "Tie Bags",                      order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 98,  name: "Ziplock Bags Gallon",           order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 99,  name: "Straws",                        order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 100, name: "Forks",                         order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 101, name: "Knives",                        order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 102, name: "Spoons",                        order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 103, name: "Pizza Stack",                   order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 104, name: "Gloves L",                      order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 105, name: "Gloves XL",                     order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 106, name: "18in Clear Film",               order_unit: "Roll",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 107, name: "24in Clear Film",               order_unit: "Roll",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 108, name: "12in Aluminum Foil",            order_unit: "Roll",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 109, name: "Plastic Bags",                  order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 110, name: "Junior Wax",                    order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 111, name: "16oz Deli Container",           order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 112, name: "5¾x6x3 Container",             order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 113, name: "5¼x5⅜x2⅝ Container",          order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
  ]},
  { section: "🗄️  SHELF 2", items: [
    { id: 115, name: "8in Dome Lids",                 order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 116, name: "8in Aluminum Dish",             order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 117, name: "7in Dome Lids",                 order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 118, name: "7in Aluminum Dish",             order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 119, name: "20Lb Brown Bags",               order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 120, name: "12Lb Brown Bags",               order_unit: "Case",    upu: 500, vendor: "",         max_stock: 1000, reorder: 200 },
    { id: 121, name: "Hero Containers",               order_unit: "Case",    upu: 200, vendor: "",         max_stock: 400,  reorder: 100 },
    { id: 122, name: "4oz Souffle Lids",              order_unit: "Case",    upu: 200, vendor: "",         max_stock: 400,  reorder: 100 },
    { id: 123, name: "4oz Souffle Cups",              order_unit: "Case",    upu: 200, vendor: "",         max_stock: 400,  reorder: 100 },
    { id: 124, name: "2oz Souffle Lids",              order_unit: "Case",    upu: 200, vendor: "",         max_stock: 400,  reorder: 100 },
    { id: 125, name: "2oz Souffle Cups",              order_unit: "Case",    upu: 200, vendor: "",         max_stock: 400,  reorder: 100 },
    { id: 126, name: "Heinz Ketchup",                 order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 127, name: "Mayo",                          order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 128, name: "Honey Mustard Dressing",        order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 129, name: "Blue Cheese Dressing",          order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 130, name: "Ranch Dressing",                order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 131, name: "Vinegar",                       order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 132, name: "Italian Dressing",              order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 133, name: "Balsamic Dressing",             order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 134, name: "Olive Oil",                     order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 6,    reorder: 2   },
    { id: 135, name: "White Wine",                    order_unit: "Case",    upu: 12,  vendor: "",         max_stock: 12,   reorder: 4   },
    { id: 136, name: "Vodka",                         order_unit: "Case",    upu: 12,  vendor: "",         max_stock: 12,   reorder: 4   },
    { id: 137, name: "Marsala Wine",                  order_unit: "Case",    upu: 12,  vendor: "",         max_stock: 12,   reorder: 4   },
  ]},
  { section: "🥫  CONDIMENTS & SAUCES", items: [
    { id: 139, name: "Mango",                         order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 140, name: "Garlic Parm",                   order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 141, name: "Franks Red Hot",                order_unit: "Gallon",  upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 142, name: "BBQ Sauce",                     order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 143, name: "Honey BBQ Sauce",               order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 144, name: "Taco Sauce",                    order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 145, name: "Tarter Sauce",                  order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 146, name: "Lemon Juice",                   order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
  ]},
  { section: "📦  BOXES", items: [
    { id: 148, name: "18in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 149, name: "16in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 150, name: "14in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 151, name: "12in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 152, name: "10in Boxes",                    order_unit: "Bundle",  upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 153, name: "Tommys Paper Cups",             order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
  ]},
  { section: "🛍️  DISPOSABLES & PACKAGING", items: [
    { id: 155, name: "Full Size Medium Trays",        order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 156, name: "Half Size Medium Trays",        order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 157, name: "Full Size Deep Trays",          order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 158, name: "Half Size Deep Trays",          order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 50,   reorder: 15  },
    { id: 159, name: "Full Size Lids",                order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 160, name: "Half Size Lids",                order_unit: "Case",    upu: 50,  vendor: "",         max_stock: 100,  reorder: 25  },
    { id: 161, name: "Masking Tape Roll",             order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 162, name: "Clear Bags",                    order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
    { id: 163, name: "Black Bags",                    order_unit: "Case",    upu: 100, vendor: "",         max_stock: 200,  reorder: 50  },
  ]},
  { section: "🧹  CLEANING SUPPLIES", items: [
    { id: 166, name: "Bleach",                        order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 167, name: "Pine Cleaner",                  order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 168, name: "Oven Cleaner",                  order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 169, name: "Glass Cleaner",                 order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 170, name: "Joy Dish Soap",                 order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 171, name: "Steel Sponge",                  order_unit: "Case",    upu: 12,  vendor: "",         max_stock: 24,   reorder: 6   },
    { id: 172, name: "Broom Head",                    order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 173, name: "Mop Head",                      order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 174, name: "Toilet Bowl Gel",               order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 175, name: "Bathroom Bleach Foamer Spray",  order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 176, name: "Scrubbing Bubbles",             order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 177, name: "Lysol Spray",                   order_unit: "Case",    upu: 6,   vendor: "",         max_stock: 12,   reorder: 3   },
    { id: 178, name: "Brillo Pads",                   order_unit: "Case",    upu: 12,  vendor: "",         max_stock: 24,   reorder: 6   },
  ]},
  { section: "❄️  BOX ROOM FREEZER", items: [
    { id: 180, name: "Cheesecake",                    order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 181, name: "Tres Leche",                    order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 182, name: "Chocolate Moose",               order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
    { id: 183, name: "Red Velvet",                    order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 184, name: "Cannoli Cream",                 order_unit: "Each",    upu: 1,   vendor: "",         max_stock: 4,    reorder: 1   },
    { id: 185, name: "Tiramisu",                      order_unit: "Case",    upu: 1,   vendor: "",         max_stock: 2,    reorder: 1   },
  ]},
];

const USERS = {
  "owner@kitchen.com":    { password: "owner123",    role: "owner",    name: "Owner",    group: "demo" },
  "employee@kitchen.com": { password: "employee123", role: "employee", name: "Employee", group: "demo" },
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
const getSB = () => {
  if (_sb) return _sb;
  if (typeof window !== "undefined" && window.supabase) { _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
  return _sb;
};

// Load Supabase client script
const loadSupabase = () => {
  if (typeof window === "undefined" || document.getElementById("sb-script")) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = "sb-script";
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
};
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

// ─── SUBSCRIPTION PLANS ──────────────────────────────────────────────────────
const PLANS = {
  starter:    { name: "Starter",    price: 299, vendors: 3,        items: 100,      users: 2,        label: "For small kitchens" },
  pro:        { name: "Pro",        price: 399, vendors: Infinity, items: Infinity,  users: 10,       label: "For growing operations" },
  enterprise: { name: "Enterprise", price: 499, vendors: Infinity, items: Infinity,  users: Infinity, label: "For multi-location businesses" },
};
const TRIAL_DAYS = 14;
const DEMO_GROUPS = ["demo"]; // Demo accounts skip subscription

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
const printVendorPDF = ({ vendorName, items, weekNum, date, businessName, orderedBy }) => {
  const win = window.open("", "_blank");
  const rows = items.filter(i => i.qty > 0).map(item =>
    `<tr><td>${item.name}</td><td style="text-align:center">${item.section.replace(/[^\w\s\-&]/g,"").trim()}</td><td style="text-align:center;font-weight:700">${item.qty} ${item.order_unit}</td></tr>`
  ).join("");
  const totalItems = items.filter(i => i.qty > 0).length;
  win.document.write(`<html><head><title>${vendorName} — WK${weekNum}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:700px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.biz{font-size:24px;font-weight:900;color:#111;margin:0 0 2px;text-transform:uppercase;letter-spacing:1px}.vendor{font-size:22px;font-weight:700;color:#444;margin:0 0 6px}.meta{color:#666;font-size:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1e293b;color:#fff;padding:10px 14px;text-align:left}th:last-child{text-align:center}td{padding:10px 14px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:20px;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}@media print{body{padding:16px}}</style></head><body>
    ${businessName ? `<div class="biz">${businessName}</div>` : ""}
    <div class="vendor">📦 ${vendorName}</div>
    <h1>Order — Week ${weekNum}</h1>
    <div class="meta">${date} · ${totalItems} item${totalItems!==1?"s":""} · Ordered by: <strong>${orderedBy || "—"}</strong></div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Location</th><th style="text-align:center">Qty to Order</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">MOE · Make Ordering Easy · Printed ${new Date().toLocaleDateString()}</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
function MoeApp() {
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
  const [usageLog, setUsageLog]     = useState({});
  const [subscription, setSubscription] = useState(null); // { plan, status, trialStart, trialEnd, subscribedAt }
  const [team, setTeam]                 = useState([]); // [{ id, email, name, role, addedAt }]
  const [wasteLog, setWasteLog]         = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [dataLoaded, setDataLoaded]     = useState(false); // { [itemId]: [{ price, date, weekKey, vendor, source }] } // [{ id, itemId, itemName, qty, unit, reason, loggedBy, date, weekKey }]

  const showFlash = (msg = "✓ Saved") => { setFlash(msg); setTimeout(() => setFlash(""), 2000); };

  // ── Persistence ──────────────────────────────────────────────────────────
  const groupRef = React.useRef(group);
  React.useEffect(() => { groupRef.current = group; }, [group]);

  const save = useCallback((key, value) => {
    const g = groupRef.current;
    try { localStorage.setItem(`moe_${g}_${key}`, JSON.stringify(value)); } catch {}
    sbSet(g, key, value);
  }, []);

  const load = useCallback(async (key, fallback) => {
    const g = groupRef.current;
    const sbVal = await sbGet(g, key);
    if (sbVal !== null) { try { localStorage.setItem(`moe_${g}_${key}`, JSON.stringify(sbVal)); } catch {} return sbVal; }
    try { const raw = localStorage.getItem(`moe_${g}_${key}`); if (raw) { const v = JSON.parse(raw); sbSet(g, key, v); return v; } } catch {}
    return fallback;
  }, []);

  // ── Save inventory ────────────────────────────────────────────────────────
  const saveInventory = useCallback((newInv) => { setInventory(newInv); save("inventory", newInv); showFlash(); }, [save]);

  // ── Load data on login ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await loadSupabase();
      const st = await load("stock", {});
      const vd = await load("vendors", DEFAULT_VENDORS);
      const hi = await load("history", []);
      const inv = await load("inventory", DEFAULT_INVENTORY);
      const ul = await load("usageLog", {});
      const sub = await load("subscription", null);
      const tm = await load("team", []);
      const wl = await load("wasteLog", []);
      const ph = await load("priceHistory", {});
      setStock(st); setVendors(vd); setHistory(hi); setInventory(inv);
      setUsageLog(ul); setSubscription(sub); setTeam(tm); setWasteLog(wl); setPriceHistory(ph);
      setDataLoaded(true);
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
        if (data_key === "usageLog")     setUsageLog(value);
        if (data_key === "subscription") setSubscription(value);
        if (data_key === "team")         setTeam(value);
        if (data_key === "wasteLog")    setWasteLog(value);
        if (data_key === "priceHistory") setPriceHistory(value);
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

    // 1. Log usage — record what was ordered per item for this week
    const wk = `${new Date().getFullYear()}-WK${String(getWeekNumber()).padStart(2,"0")}`;
    const newUsageLog = { ...usageLog };
    if (!newUsageLog[wk]) newUsageLog[wk] = {};
    if (!newUsageLog[wk][vendorName]) newUsageLog[wk][vendorName] = {};
    orderLines.forEach(line => {
      newUsageLog[wk][vendorName][line.id] = {
        name: line.name, qty: line.qty, order_unit: line.order_unit,
        stockBefore: line.currentStock, maxStock: vendorItems.find(i => i.id === line.id)?.max_stock || 0,
      };
    });
    setUsageLog(newUsageLog);
    save("usageLog", newUsageLog);

    // 2. Save to history
    const entry = {
      id: `ord_${Date.now()}`,
      vendor: vendorName,
      weekNumber: getWeekNumber(),
      year: new Date().getFullYear(),
      day: DAYS[getToday()],
      date: new Date().toISOString(),
      lines: orderLines,
      totalItems: orderLines.length,
      orderedBy: user?.name || "",
    };
    const newHistory = [entry, ...history];
    setHistory(newHistory);
    save("history", newHistory);

    // 3. Reset this vendor's items to 0
    const newStock = { ...stock };
    vendorItems.forEach(item => { newStock[item.id] = 0; });
    setStock(newStock);
    save("stock", newStock);

    showFlash(`✓ ${vendorName} order submitted`);
  };

  // ── Save vendors ─────────────────────────────────────────────────────────
  const saveVendors = (newVendors) => { setVendors(newVendors); save("vendors", newVendors); showFlash(); };

  // ── Save team ──────────────────────────────────────────────────────────
  const saveTeam = useCallback((newTeam) => { setTeam(newTeam); save("team", newTeam); showFlash(); }, [save]);

  // ── Save waste log ────────────────────────────────────────────────────
  const saveWasteLog = useCallback((newLog) => { setWasteLog(newLog); save("wasteLog", newLog); }, [save]);

  // ── Save price history ────────────────────────────────────────────────
  const savePriceHistory = useCallback((newPH) => { setPriceHistory(newPH); save("priceHistory", newPH); }, [save]);

  // ── Apply par suggestion — update an item's max_stock in inventory ──────
  const applyParSuggestion = (itemId, newMaxStock) => {
    const newInv = inventory.map(s => ({
      ...s, items: s.items.map(i => i.id === itemId ? { ...i, max_stock: newMaxStock } : i),
    }));
    setInventory(newInv);
    save("inventory", newInv);
    showFlash("✓ Par updated");
  };

  // ── Login ────────────────────────────────────────────────────────────────
  if (!user) return <LoginScreen onLogin={u => { setUser(u); setGroup(u.group || "demo"); setLoginError(""); }} error={loginError} setError={setLoginError} />;

  // ── Subscription gate (skip for demo accounts) ─────────────────────────
  const isDemo = DEMO_GROUPS.includes(group);
  const now = new Date();
  const trialEndDate = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const trialDaysLeft = trialEndDate ? Math.max(0, Math.ceil((trialEndDate - now) / 86400000)) : 0;
  const isTrialing = subscription?.status === "trialing" && trialDaysLeft > 0;
  const isActive = subscription?.status === "active";
  const hasAccess = isDemo || isTrialing || isActive;

  // Auto-start trial for new accounts (only after data loaded from Supabase)
  if (dataLoaded && !isDemo && !subscription && user) {
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const newSub = { plan: "pro", status: "trialing", trialStart: new Date().toISOString(), trialEnd: trialEnd.toISOString() };
    setSubscription(newSub);
    save("subscription", newSub);
  }

  // Show pricing page if trial expired and no active subscription
  if (!hasAccess && !isDemo) {
    return <PricingPage subscription={subscription} user={user} onLogout={() => setUser(null)}
      onSelectPlan={(plan) => {
        const newSub = { ...subscription, plan, status: "active", subscribedAt: new Date().toISOString() };
        setSubscription(newSub);
        save("subscription", newSub);
      }} />;
  }

  // Get current plan limits
  const currentPlan = PLANS[subscription?.plan] || PLANS.pro;

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
          <MoeLogo size="md" />
          <button onClick={() => setSidebarOpen(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #1e2d45" }}>
          <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{user.name}</div>
          <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{user.role.toUpperCase()} · WK {weekNum} · {DAYS[getToday()]}</div>
        </div>
        <div style={{ flex:1, padding:"12px", overflowY:"auto" }}>
          {[
            { key:"inventory", label:"Inventory", icon:"📋", desc:"Count stock by location" },
            { key:"waste",     label:"Waste Log", icon:"🗑️", desc:"Track what's going in the trash" },
            ...((user.role === "owner" || user.role === "manager") ? [
              { key:"orders",    label:"Orders",    icon:"📦", desc:`${todayVendors.length} vendor${todayVendors.length!==1?"s":""} today`, badge: todayVendors.length },
              { key:"history",   label:"History",   icon:"📚", desc:"Past orders by week" },
              { key:"insights", label:"Insights", icon:"📊", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "Par suggestions by usage", locked: currentPlan === PLANS.starter && !isTrialing },
              { key:"prices",  label:"Price Tracker", icon:"💲", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "Invoice price checker", locked: currentPlan === PLANS.starter && !isTrialing },
              { key:"backend",  label:"Backend",  icon:"🔧", desc:"Add & edit items" },
              { key:"settings", label:"Settings", icon:"⚙️", desc:"Vendors & team" },
            ] : []),
            ...(user.role === "owner" ? [
              { key:"import",   label:"Import Items", icon:"📤", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "Upload list or invoice photo", locked: currentPlan === PLANS.starter && !isTrialing },
              { key:"subscription", label:"Subscription", icon:"💳", desc: isTrialing ? `Trial — ${trialDaysLeft}d left` : (isActive ? currentPlan.name : "Choose plan") },
            ] : []),
          ].map(item => {
            const isActive = view === item.key;
            return (
              <button key={item.key} onClick={() => { if (!item.locked) { setView(item.key); setSidebarOpen(false); } else { setView("subscription"); setSidebarOpen(false); } }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:isActive?"#080c14":"transparent", border:"none", borderRadius:10, padding:"11px 14px", cursor:"pointer", marginBottom:4, borderLeft:isActive?"3px solid #e2e8f0":"3px solid transparent", opacity:item.locked?0.5:1 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#080c14"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize:18 }}>{item.icon}</span>
                <div style={{ textAlign:"left", flex:1 }}>
                  <div style={{ color:isActive?"#e2e8f0":"#94a3b8", fontSize:14, fontWeight:isActive?600:400 }}>{item.label}{item.locked ? " 🔒" : ""}</div>
                  <div style={{ color:item.locked?"#d97706":"#475569", fontSize:11, marginTop:1 }}>{item.desc}</div>
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
          <MoeLogo size="sm" />
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

      {/* Trial banner */}
      {isTrialing && !isDemo && (
        <div style={{ background:"#422006", borderBottom:"1px solid #d97706", padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <span style={{ color:"#fbbf24", fontSize:12, fontWeight:600 }}>Free trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</span>
          <button onClick={() => setView("subscription")} style={{ background:"#d97706", border:"none", borderRadius:6, padding:"3px 12px", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>Upgrade</button>
        </div>
      )}

      {/* Main content */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"20px 16px" }}>
        {view === "inventory" && <InventoryView inventory={inventory} stock={stock} updateStock={updateStock} vendors={vendors} />}
        {view === "waste" && <WasteLogView inventory={inventory} wasteLog={wasteLog} saveWasteLog={saveWasteLog} userName={user.name} priceHistory={priceHistory} />}
        {view === "orders" && (user.role === "owner" || user.role === "manager") && <OrdersView inventory={inventory} stock={stock} vendors={vendors} submitOrder={submitOrder} user={user} />}
        {view === "history" && (user.role === "owner" || user.role === "manager") && <HistoryView history={history} user={user} />}
        {view === "insights" && (user.role === "owner" || user.role === "manager") && <InsightsView inventory={inventory} usageLog={usageLog} vendors={vendors} applyParSuggestion={applyParSuggestion} />}
        {view === "prices" && (user.role === "owner" || user.role === "manager") && <PriceTrackerView inventory={inventory} priceHistory={priceHistory} savePriceHistory={savePriceHistory} vendors={vendors} />}
        {view === "import" && user.role === "owner" && <ImportView inventory={inventory} saveInventory={saveInventory} vendors={vendors} />}
        {view === "backend" && (user.role === "owner" || user.role === "manager") && <BackendView inventory={inventory} saveInventory={saveInventory} vendors={vendors} stock={stock} />}
        {view === "settings" && (user.role === "owner" || user.role === "manager") && <SettingsView vendors={vendors} saveVendors={saveVendors} inventory={inventory} team={team} saveTeam={saveTeam} currentPlan={currentPlan} isTrialing={isTrialing} />}
        {view === "subscription" && user.role === "owner" && <SubscriptionView subscription={subscription} onSelectPlan={(plan) => { const newSub = { ...subscription, plan, status: "active", subscribedAt: new Date().toISOString() }; setSubscription(newSub); save("subscription", newSub); showFlash("✓ Plan updated"); }} trialDaysLeft={trialDaysLeft} isTrialing={isTrialing} isActive={isActive} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOE LOGO — Hex SVG logo
// ═══════════════════════════════════════════════════════════════════════════════
function MoeLogo({ size = "md" }) {
  const configs = { sm: { vw: 110, vh: 36, hx: 18, hy: 18, outerR: 16, midR: 11, innerR: 6, dot: 1.8, tx: 36, ty: 23, fs: 20 }, md: { vw: 130, vh: 44, hx: 22, hy: 22, outerR: 20, midR: 13, innerR: 7, dot: 2.2, tx: 44, ty: 28, fs: 24 }, lg: { vw: 220, vh: 72, hx: 36, hy: 36, outerR: 33, midR: 22, innerR: 11, dot: 3.5, tx: 74, ty: 46, fs: 40 } };
  const c = configs[size] || configs.md;
  const { vw, vh, hx, hy, outerR: oR, midR: mR, innerR: iR, dot: d, tx, ty, fs } = c;
  const hex = (cx, cy, r) => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`); } return pts.join(" "); };
  const spokeLines = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { x1: (hx + oR * Math.cos(a)).toFixed(2), y1: (hy + oR * Math.sin(a)).toFixed(2), x2: (hx + mR * Math.cos(a)).toFixed(2), y2: (hy + mR * Math.sin(a)).toFixed(2) }; });
  const outerDots = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { cx: (hx + oR * Math.cos(a)).toFixed(2), cy: (hy + oR * Math.sin(a)).toFixed(2) }; });
  return (
    <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} xmlns="http://www.w3.org/2000/svg" style={{ display:"block", flexShrink:0 }}>
      <polygon points={hex(hx, hy, oR)} fill="none" stroke="#94a3b8" strokeWidth="0.8" opacity="0.2"/>
      {spokeLines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#94a3b8" strokeWidth="0.7" opacity="0.3"/>)}
      {outerDots.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={d} fill="#64748b" opacity="0.55"/>)}
      <polygon points={hex(hx, hy, mR)} fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.55"/>
      <polygon points={hex(hx, hy, iR)} fill="#f1f5f9"/>
      <circle cx={hx} cy={hy} r={iR * 0.45} fill="#080c14" opacity="0.45"/>
      <text x={tx} y={ty} fontFamily="'DM Sans',sans-serif" fontWeight="900" fontSize={fs} letterSpacing="-1" fill="#f1f5f9">M<tspan fill="#e2e8f0">OE</tspan></text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, error, setError }) {
  const [mode, setMode] = useState("signin"); // "signin" or "register"
  const [show, setShow] = useState(false);

  // Sign In fields
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  // Registration fields
  const [reg, setReg] = useState({
    ownerFirst: "", ownerLast: "", ownerEmail: "", ownerPhone: "",
    password: "", confirmPassword: "",
    bizName: "", bizType: "restaurant", bizPhone: "", bizAddress: "", bizCity: "", bizState: "", bizZip: "",
  });
  const [regStep, setRegStep] = useState(1); // 1 = owner info, 2 = business info
  const [regError, setRegError] = useState("");

  const updateReg = (field, val) => setReg(prev => ({ ...prev, [field]: val }));

  const handleLogin = () => {
    const u = USERS[email.toLowerCase().trim()];
    if (u && u.password === pass) onLogin({ ...u, email });
    else setError("Invalid email or password.");
  };

  const handleRegister = async () => {
    setRegError("");
    await loadSupabase();
    // Validate
    if (!reg.ownerFirst.trim() || !reg.ownerLast.trim()) return setRegError("First and last name required.");
    if (!reg.ownerEmail.trim() || !reg.ownerEmail.includes("@")) return setRegError("Valid email required.");
    if (!reg.ownerPhone.trim()) return setRegError("Phone number required.");
    if (!reg.password || reg.password.length < 6) return setRegError("Password must be at least 6 characters.");
    if (reg.password !== reg.confirmPassword) return setRegError("Passwords don't match.");
    if (!reg.bizName.trim()) return setRegError("Business name required.");
    if (!reg.bizPhone.trim()) return setRegError("Business phone required.");
    if (!reg.bizAddress.trim()) return setRegError("Business address required.");
    if (!reg.bizCity.trim() || !reg.bizState.trim() || !reg.bizZip.trim()) return setRegError("Full address required.");

    // Generate a group ID from business name
    const groupId = reg.bizName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30);

    // Check if email already exists in registered accounts
    const existing = await sbGet("__moe_accounts__", "accounts") || {};
    if (existing[reg.ownerEmail.toLowerCase().trim()]) return setRegError("An account with this email already exists.");

    // Save account
    const account = {
      ownerFirst: reg.ownerFirst.trim(), ownerLast: reg.ownerLast.trim(),
      email: reg.ownerEmail.toLowerCase().trim(), phone: reg.ownerPhone.trim(),
      password: reg.password, role: "owner", group: groupId,
      business: {
        name: reg.bizName.trim(), type: reg.bizType,
        phone: reg.bizPhone.trim(), address: reg.bizAddress.trim(),
        city: reg.bizCity.trim(), state: reg.bizState.trim(), zip: reg.bizZip.trim(),
      },
      createdAt: new Date().toISOString(),
    };
    existing[account.email] = account;
    await sbSet("__moe_accounts__", "accounts", existing);

    // Log them in
    onLogin({ name: `${account.ownerFirst} ${account.ownerLast}`, role: "owner", group: groupId, email: account.email, business: account.business });
  };

  // Also check registered accounts and team members on login
  const handleLoginWithAccounts = async () => {
    await loadSupabase();
    const emailLower = email.toLowerCase().trim();

    // Check hardcoded demo users first
    const u = USERS[emailLower];
    if (u && u.password === pass) { onLogin({ ...u, email: emailLower }); return; }

    // Check registered owner accounts
    const accounts = await sbGet("__moe_accounts__", "accounts") || {};
    const acct = accounts[emailLower];
    if (acct && acct.password === pass) {
      onLogin({ name: `${acct.ownerFirst} ${acct.ownerLast}`, role: acct.role, group: acct.group, email: acct.email, business: acct.business });
      return;
    }

    // Check team members across all registered accounts
    for (const [ownerEmail, ownerAcct] of Object.entries(accounts)) {
      const teamData = await sbGet(ownerAcct.group, "team");
      if (Array.isArray(teamData)) {
        const member = teamData.find(m => m.email.toLowerCase() === emailLower && m.password === pass);
        if (member) {
          onLogin({ name: member.name, role: member.role || "employee", group: ownerAcct.group, email: member.email, business: ownerAcct.business });
          return;
        }
      }
    }

    setError("Invalid email or password.");
  };

  const inp = { width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" };

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width:420 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><MoeLogo size="lg" /></div>
          <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"2px", marginBottom:4 }}>MAKE ORDERING EASY</div>
        </div>

        {/* ── SIGN IN ── */}
        {mode === "signin" && (
          <>
            <p style={{ color:"#64748b", fontSize:14, margin:"0 0 20px", textAlign:"center" }}>Sign in to continue</p>
            <div style={{ background:"#0f1a2e", borderRadius:16, border:"1px solid #1e2d45", padding:28 }}>
              <div style={{ marginBottom:16 }}>
                <label style={lbl}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLoginWithAccounts()} placeholder="you@business.com" type="email" style={inp} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Password</label>
                <div style={{ position:"relative" }}>
                  <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLoginWithAccounts()} type={show?"text":"password"} placeholder="••••••••"
                    style={{ ...inp, paddingRight:40 }} />
                  <button onClick={() => setShow(!show)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:14 }}>{show?"🙈":"👁"}</button>
                </div>
              </div>
              {error && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{error}</div>}
              <button onClick={handleLoginWithAccounts} style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:12, color:"#080c14", fontSize:15, fontWeight:700, cursor:"pointer" }}>Sign In</button>
              <div style={{ textAlign:"center", marginTop:16 }}>
                <span style={{ color:"#475569", fontSize:13 }}>Don't have an account? </span>
                <button onClick={() => { setMode("register"); setError(""); setRegError(""); setRegStep(1); }}
                  style={{ background:"none", border:"none", color:"#e2e8f0", fontSize:13, fontWeight:600, cursor:"pointer", textDecoration:"underline", padding:0 }}>
                  Create Account
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── CREATE ACCOUNT ── */}
        {mode === "register" && (
          <div style={{ background:"#0f1a2e", borderRadius:16, border:"1px solid #1e2d45", padding:28 }}>
            {/* Back + title */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <button onClick={() => { setMode("signin"); setRegError(""); }}
                style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#94a3b8", cursor:"pointer", fontSize:12, padding:"4px 10px" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#94a3b8"; }}>
                ← Back
              </button>
              <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>Create Account</span>
            </div>
            {/* Step indicator */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              {[1, 2].map(step => (
                <React.Fragment key={step}>
                  <div onClick={() => { if (step < regStep) setRegStep(step); }}
                    style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, cursor:step<=regStep?"pointer":"default",
                      background:regStep>=step?"#e2e8f0":"#1e2d45", color:regStep>=step?"#080c14":"#475569" }}>
                    {step}
                  </div>
                  {step < 2 && <div style={{ flex:1, height:2, background:regStep>1?"#e2e8f0":"#1e2d45", borderRadius:1 }} />}
                </React.Fragment>
              ))}
              <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginLeft:8 }}>
                {regStep === 1 ? "Owner Info" : "Business Info"}
              </span>
            </div>

            {/* Step 1: Owner Information */}
            {regStep === 1 && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={lbl}>First Name *</label>
                    <input value={reg.ownerFirst} onChange={e => updateReg("ownerFirst", e.target.value)} placeholder="John" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Last Name *</label>
                    <input value={reg.ownerLast} onChange={e => updateReg("ownerLast", e.target.value)} placeholder="Doe" style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Email Address *</label>
                  <input value={reg.ownerEmail} onChange={e => updateReg("ownerEmail", e.target.value)} placeholder="john@mybusiness.com" type="email" style={inp} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Phone Number *</label>
                  <input value={reg.ownerPhone} onChange={e => updateReg("ownerPhone", e.target.value)} placeholder="(555) 123-4567" type="tel" style={inp} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  <div>
                    <label style={lbl}>Password *</label>
                    <input value={reg.password} onChange={e => updateReg("password", e.target.value)} type="password" placeholder="Min 6 chars" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Confirm Password *</label>
                    <input value={reg.confirmPassword} onChange={e => updateReg("confirmPassword", e.target.value)} type="password" placeholder="••••••••" style={inp} />
                  </div>
                </div>
                <button onClick={() => {
                  if (!reg.ownerFirst.trim() || !reg.ownerLast.trim()) { setRegError("First and last name required."); return; }
                  if (!reg.ownerEmail.trim() || !reg.ownerEmail.includes("@")) { setRegError("Valid email required."); return; }
                  if (!reg.ownerPhone.trim()) { setRegError("Phone number required."); return; }
                  if (!reg.password || reg.password.length < 6) { setRegError("Password must be at least 6 characters."); return; }
                  if (reg.password !== reg.confirmPassword) { setRegError("Passwords don't match."); return; }
                  setRegError(""); setRegStep(2);
                }}
                  style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:12, color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  Next — Business Info →
                </button>
              </>
            )}

            {/* Step 2: Business Information */}
            {regStep === 2 && (
              <>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Business Name *</label>
                  <input value={reg.bizName} onChange={e => updateReg("bizName", e.target.value)} placeholder="Tommy's Pizzeria" style={inp} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={lbl}>Business Type</label>
                    <select value={reg.bizType} onChange={e => updateReg("bizType", e.target.value)}
                      style={{ ...inp, cursor:"pointer" }}>
                      <option value="restaurant">Restaurant</option>
                      <option value="pizzeria">Pizzeria</option>
                      <option value="bakery">Bakery</option>
                      <option value="cafe">Café</option>
                      <option value="bar">Bar / Lounge</option>
                      <option value="catering">Catering</option>
                      <option value="food_truck">Food Truck</option>
                      <option value="deli">Deli</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Business Phone *</label>
                    <input value={reg.bizPhone} onChange={e => updateReg("bizPhone", e.target.value)} placeholder="(555) 987-6543" type="tel" style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Street Address *</label>
                  <input value={reg.bizAddress} onChange={e => updateReg("bizAddress", e.target.value)} placeholder="123 Main Street" style={inp} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:16 }}>
                  <div>
                    <label style={lbl}>City *</label>
                    <input value={reg.bizCity} onChange={e => updateReg("bizCity", e.target.value)} placeholder="Brooklyn" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>State *</label>
                    <input value={reg.bizState} onChange={e => updateReg("bizState", e.target.value)} placeholder="NY" maxLength={2} style={{ ...inp, textTransform:"uppercase" }} />
                  </div>
                  <div>
                    <label style={lbl}>Zip *</label>
                    <input value={reg.bizZip} onChange={e => updateReg("bizZip", e.target.value)} placeholder="11201" style={inp} />
                  </div>
                </div>
                {regError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{regError}</div>}
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setRegStep(1)}
                    style={{ flex:1, background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:12, color:"#94a3b8", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                    ← Back
                  </button>
                  <button onClick={handleRegister}
                    style={{ flex:2, background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Create Account
                  </button>
                </div>
              </>
            )}

            {regStep === 1 && regError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginTop:16 }}>{regError}</div>}
          </div>
        )}

        {/* Demo credentials */}
        {mode === "signin" && (
          <div style={{ marginTop:20, background:"#0f1a2e", borderRadius:12, border:"1px solid #1e2d45", padding:"14px 18px" }}>
            <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>Demo Credentials</div>
            <div style={{ color:"#94a3b8", fontSize:12, lineHeight:2 }}><span style={{ color:"#e2e8f0" }}>Owner:</span> owner@kitchen.com / owner123<br /><span style={{ color:"#22c55e" }}>Employee:</span> employee@kitchen.com / employee123</div>
          </div>
        )}
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
                        <span style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", marginRight:2 }}>Current Stock</span>
                        <button onClick={() => updateStock(item.id, Math.max(0, s-1))} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                        <input type="number" value={s} min={0} onChange={e => updateStock(item.id, e.target.value)} onFocus={e => e.target.select()}
                          style={{ width:52, background:"#080c14", border:"1px solid #475569", borderRadius:8, padding:"6px", color:"#f1f5f9", fontSize:15, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                        <button onClick={() => updateStock(item.id, s+1)} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
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
function OrdersView({ inventory, stock, vendors, submitOrder, user }) {
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
                  <button onClick={() => printVendorPDF({ vendorName: vendor.name, items: orderLines, weekNum, date: fmtDate(new Date()), businessName: user.business?.name || "", orderedBy: user.name })}
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
                    Submit Order
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
function HistoryView({ history, user }) {
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
                    <button onClick={() => printVendorPDF({ vendorName: entry.vendor, items: entry.lines, weekNum: entry.weekNumber, date: fmtDate(entry.date), businessName: user.business?.name || "", orderedBy: entry.orderedBy || user.name })}
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
function SettingsView({ vendors, saveVendors, inventory, team, saveTeam, currentPlan, isTrialing }) {
  const [activeTab, setActiveTab] = useState("vendors");
  const [localVendors, setLocalVendors] = useState(vendors);
  const [dirty, setDirty] = useState(false);

  // ── Vendor management ──────────────────────────────────────────────────
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

  // ── Employee management ────────────────────────────────────────────────
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empRole, setEmpRole] = useState("employee");
  const [empError, setEmpError] = useState("");
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const maxUsers = currentPlan?.users || 2;
  const atLimit = !isTrialing && maxUsers !== Infinity && team.length >= maxUsers;

  const addEmployee = () => {
    setEmpError("");
    if (!empName.trim()) return setEmpError("Name is required.");
    if (!empEmail.trim() || !empEmail.includes("@")) return setEmpError("Valid email is required.");
    if (!empPassword || empPassword.length < 6) return setEmpError("Password must be at least 6 characters.");
    if (team.some(m => m.email.toLowerCase() === empEmail.toLowerCase().trim())) return setEmpError("This email is already on your team.");

    const newMember = {
      id: Date.now(), name: empName.trim(), email: empEmail.toLowerCase().trim(),
      password: empPassword, role: empRole, addedAt: new Date().toISOString(),
    };
    saveTeam([...team, newMember]);
    setEmpName(""); setEmpEmail(""); setEmpPassword(""); setEmpRole("employee"); setShowAddEmp(false);
  };

  const removeEmployee = (id) => saveTeam(team.filter(m => m.id !== id));

  const updateEmployee = (id, field, value) => {
    saveTeam(team.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Settings</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Manage vendors, schedules, and team members</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[{ key:"vendors", label:"Vendors", icon:"📦" }, { key:"team", label:"Team", icon:"👥" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ background:activeTab===tab.key?"#e2e8f0":"transparent", border:`1px solid ${activeTab===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:activeTab===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:activeTab===tab.key?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            {tab.icon} {tab.label}
            {tab.key === "team" && <span style={{ background:"#0f2040", color:"#a5b4fc", borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{team.length}</span>}
          </button>
        ))}
      </div>

      {/* ── VENDORS TAB ── */}
      {activeTab === "vendors" && (
        <>
          {dirty && (
            <div style={{ marginBottom:16 }}>
              <button onClick={handleSave}
                style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Save Changes
              </button>
            </div>
          )}
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
        </>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <>
          {/* Info bar */}
          <div style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
            <span style={{ color:"#a5b4fc", fontSize:12 }}>Add employees so they can sign in and access the inventory for your store. </span>
            <span style={{ color:"#64748b", fontSize:12 }}>Employees see Inventory, Orders, and History — not Backend or Settings.</span>
          </div>

          {/* Usage bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#94a3b8", fontSize:13 }}>Team Members</span>
              <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:6, padding:"2px 8px", color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
                {team.length} / {maxUsers === Infinity ? "∞" : maxUsers}
              </span>
            </div>
            {!showAddEmp && (
              <button onClick={() => { if (atLimit) return; setShowAddEmp(true); }}
                style={{ background: atLimit ? "#1e2d45" : "linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 16px", color: atLimit ? "#475569" : "#fff", fontSize:13, fontWeight:600, cursor: atLimit ? "not-allowed" : "pointer" }}>
                {atLimit ? `Limit reached — upgrade plan` : "＋ Add Employee"}
              </button>
            )}
          </div>

          {/* Add employee form */}
          {showAddEmp && (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:20, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>New Team Member</span>
                <button onClick={() => { setShowAddEmp(false); setEmpError(""); }}
                  style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16 }}>✕</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Full Name *</label>
                  <input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Roberto Garcia"
                    style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Role</label>
                  <select value={empRole} onChange={e => setEmpRole(e.target.value)}
                    style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box", cursor:"pointer" }}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Email Address *</label>
                <input value={empEmail} onChange={e => setEmpEmail(e.target.value)} placeholder="roberto@email.com" type="email"
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Temporary Password *</label>
                <input value={empPassword} onChange={e => setEmpPassword(e.target.value)} placeholder="Min 6 characters"
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                <div style={{ color:"#475569", fontSize:11, marginTop:4 }}>Share this with your employee so they can sign in</div>
              </div>
              {empError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:12 }}>{empError}</div>}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={addEmployee}
                  style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Add to Team
                </button>
                <button onClick={() => { setShowAddEmp(false); setEmpError(""); }}
                  style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Team list */}
          {team.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No team members yet</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Add employees so they can sign in and count inventory</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {team.map(member => (
                <div key={member.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{member.name}</span>
                      <span style={{ background: member.role === "manager" ? "#422006" : "#0f2040", border:`1px solid ${member.role === "manager" ? "#d97706" : "#1e40af"}`, borderRadius:5, padding:"1px 7px", color: member.role === "manager" ? "#fbbf24" : "#a5b4fc", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>
                        {member.role}
                      </span>
                    </div>
                    <div style={{ color:"#475569", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{member.email}</div>
                    <div style={{ color:"#334155", fontSize:10, fontFamily:"'DM Mono',monospace", marginTop:2 }}>Added {new Date(member.addedAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <select value={member.role} onChange={e => updateEmployee(member.id, "role", e.target.value)}
                      style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:6, padding:"4px 8px", color:"#f1f5f9", fontSize:11, outline:"none", cursor:"pointer" }}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button onClick={() => removeEmployee(member.id)}
                      style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"4px 10px" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS VIEW — Analyzes ordering patterns, suggests new par levels after 3 weeks
// ═══════════════════════════════════════════════════════════════════════════════
function InsightsView({ inventory, usageLog, vendors, applyParSuggestion }) {
  const [accepted, setAccepted] = useState({});
  const [dismissed, setDismissed] = useState({});
  const [filterVendor, setFilterVendor] = useState("ALL");

  const allItems = flatItems(inventory);
  const weeks = Object.keys(usageLog).sort();

  // Build per-item ordering history: { itemId: { name, vendor, order_unit, max_stock, weeklyQty: [qty, qty, ...] } }
  const itemStats = {};
  weeks.forEach(wk => {
    const weekData = usageLog[wk] || {};
    Object.entries(weekData).forEach(([vendorName, items]) => {
      Object.entries(items).forEach(([itemId, data]) => {
        if (!itemStats[itemId]) {
          itemStats[itemId] = {
            id: Number(itemId), name: data.name, vendor: vendorName,
            order_unit: data.order_unit, max_stock: data.maxStock,
            weeklyQty: [], weeks: [],
          };
        }
        itemStats[itemId].weeklyQty.push(data.qty);
        itemStats[itemId].weeks.push(wk);
      });
    });
  });

  // Update max_stock from current inventory (may have changed)
  Object.values(itemStats).forEach(stat => {
    const item = allItems.find(i => i.id === stat.id);
    if (item) { stat.max_stock = item.max_stock; stat.name = item.name; }
  });

  // Build suggestions for items with 3+ weeks of data
  const suggestions = Object.values(itemStats)
    .filter(stat => stat.weeklyQty.length >= 3)
    .map(stat => {
      const avg = Math.round(stat.weeklyQty.reduce((a, b) => a + b, 0) / stat.weeklyQty.length);
      const peak = Math.max(...stat.weeklyQty);
      const min = Math.min(...stat.weeklyQty);
      // Suggested max_stock = average order qty * 1.3 (30% buffer over average)
      // But at least peak qty (never suggest less than what was needed at peak)
      const suggested = Math.max(Math.ceil(avg * 1.3), peak);
      const diff = suggested - stat.max_stock;
      if (Math.abs(diff) < 1) return null; // No meaningful change
      return { ...stat, avg, peak, min, suggested, diff };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const activeSuggestions = suggestions
    .filter(s => !accepted[s.id] && !dismissed[s.id])
    .filter(s => filterVendor === "ALL" || s.vendor === filterVendor);

  // Items still building data (< 3 weeks)
  const buildingData = Object.values(itemStats).filter(s => s.weeklyQty.length > 0 && s.weeklyQty.length < 3);

  // Vendor names from usage data
  const usedVendors = [...new Set(Object.values(itemStats).map(s => s.vendor))].sort();

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>📊 Insights</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>
            {weeks.length} week{weeks.length !== 1 ? "s" : ""} of order data · {Object.keys(itemStats).length} items tracked
          </p>
        </div>
        {usedVendors.length > 1 && (
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer" }}>
            <option value="ALL">All Vendors</option>
            {usedVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
      </div>

      {/* How it works */}
      <div style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
        <span style={{ color:"#a5b4fc", fontSize:12 }}>How it works: </span>
        <span style={{ color:"#64748b", fontSize:12 }}>MOE tracks what you order each week per vendor. After 3 weeks, it calculates your average + peak usage and recommends a new max stock with a 30% safety buffer. You can apply or dismiss each suggestion.</span>
      </div>

      {/* Stats cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Weeks tracked", value:weeks.length, color:"#a5b4fc", bg:"#0f2040", border:"#1e40af" },
          { label:"Items tracked", value:Object.keys(itemStats).length, color:"#4ade80", bg:"#052e16", border:"#16a34a" },
          { label:"Suggestions", value:activeSuggestions.length, color:"#fbbf24", bg:"#422006", border:"#d97706" },
          { label:"Building data", value:buildingData.length, color:"#94a3b8", bg:"#0f1a2e", border:"#1e2d45" },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ color:c.color, fontSize:24, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
            <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Not enough data yet */}
      {weeks.length < 3 && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:600, marginBottom:8 }}>Building your data</div>
          <div style={{ color:"#475569", fontSize:13, lineHeight:1.7 }}>
            MOE needs at least 3 weeks of submitted orders to make recommendations.
            {weeks.length > 0 ? ` You have ${weeks.length} week${weeks.length !== 1 ? "s" : ""} so far — ${3 - weeks.length} more to go.` : " Start submitting orders and check back."}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {activeSuggestions.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ color:"#fbbf24", fontSize:14, fontWeight:700, margin:"0 0 12px", display:"flex", alignItems:"center", gap:8 }}>
            💡 Recommended Changes
            <span style={{ background:"#422006", border:"1px solid #d97706", borderRadius:10, padding:"2px 8px", fontSize:11 }}>{activeSuggestions.length}</span>
          </h3>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {activeSuggestions.map(s => (
              <div key={s.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{s.name}</span>
                      <span style={{ background:"#0f2040", border:"1px solid #1e3a5f", borderRadius:4, padding:"1px 6px", color:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }}>{s.vendor}</span>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <div><span style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>AVG/WK </span><span style={{ color:"#a5b4fc", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.avg}</span></div>
                      <div><span style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>PEAK </span><span style={{ color:"#fbbf24", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.peak}</span></div>
                      <div><span style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>MIN </span><span style={{ color:"#94a3b8", fontSize:13, fontFamily:"'DM Mono',monospace" }}>{s.min}</span></div>
                      <div><span style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{s.weeklyQty.length} WKS</span></div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", marginBottom:4 }}>Max Stock</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ color:"#64748b", fontSize:14, fontFamily:"'DM Mono',monospace", textDecoration:"line-through" }}>{s.max_stock}</span>
                        <span style={{ color:"#475569" }}>→</span>
                        <span style={{ color:s.diff > 0 ? "#4ade80" : "#f87171", fontSize:16, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.suggested}</span>
                        <span style={{ background:s.diff > 0 ? "#052e16" : "#450a0a", border:`1px solid ${s.diff > 0 ? "#16a34a" : "#7f1d1d"}`, color:s.diff > 0 ? "#4ade80" : "#fca5a5", borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                          {s.diff > 0 ? "+" : ""}{s.diff}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => { applyParSuggestion(s.id, s.suggested); setAccepted(prev => ({ ...prev, [s.id]: true })); }}
                        style={{ background:"linear-gradient(135deg,#16a34a,#15803d)", border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        ✓ Apply
                      </button>
                      <button onClick={() => setDismissed(prev => ({ ...prev, [s.id]: true }))}
                        style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"7px 12px", color:"#64748b", fontSize:12, cursor:"pointer" }}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
                {/* Weekly breakdown bar */}
                <div style={{ marginTop:10, display:"flex", gap:4, alignItems:"end", height:32 }}>
                  {s.weeklyQty.map((qty, i) => {
                    const maxQ = Math.max(...s.weeklyQty);
                    const pct = maxQ > 0 ? (qty / maxQ) * 100 : 0;
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                        <div style={{ width:"100%", maxWidth:40, height:`${Math.max(4, pct * 0.28)}px`, background:qty === s.peak ? "#fbbf24" : "#1e40af", borderRadius:2 }} />
                        <span style={{ color:"#475569", fontSize:8, fontFamily:"'DM Mono',monospace" }}>{qty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All good */}
      {weeks.length >= 3 && activeSuggestions.length === 0 && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
          <div style={{ color:"#4ade80", fontSize:16, fontWeight:600 }}>All par levels look good</div>
          <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>No recommendations based on current ordering patterns</div>
        </div>
      )}

      {/* Applied this session */}
      {Object.keys(accepted).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ color:"#4ade80", fontSize:12, fontFamily:"'DM Mono',monospace", marginBottom:8 }}>✓ Applied this session</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.keys(accepted).map(id => {
              const s = suggestions.find(s => String(s.id) === String(id));
              return s ? <div key={id} style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:6, padding:"4px 10px", color:"#4ade80", fontSize:12 }}>{s.name} → {s.suggested}</div> : null;
            })}
          </div>
        </div>
      )}

      {/* Items building data */}
      {buildingData.length > 0 && (
        <div>
          <h3 style={{ color:"#94a3b8", fontSize:13, fontWeight:600, margin:"0 0 10px" }}>⏳ Building data ({buildingData.length} items need {3 - Math.min(...buildingData.map(s => s.weeklyQty.length))}+ more weeks)</h3>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {buildingData.map(s => (
              <span key={s.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:6, padding:"4px 10px", color:"#94a3b8", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                {s.name} <span style={{ color:"#475569" }}>({s.weeklyQty.length}wk)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PAGE — Shown when trial expired, must pick a plan
// ═══════════════════════════════════════════════════════════════════════════════
function PricingPage({ subscription, user, onLogout, onSelectPlan }) {
  const [selected, setSelected] = useState("pro");
  const trialExpired = subscription?.status === "trialing";

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:960, margin:"0 auto", padding:"40px 20px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:40 }}>
          <div>
            <MoeLogo size="md" />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ color:"#64748b", fontSize:13 }}>{user?.name}</span>
            <button onClick={onLogout} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", padding:"5px 12px", cursor:"pointer", fontSize:12 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Trial expired banner */}
        {trialExpired && (
          <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:12, padding:"16px 20px", marginBottom:32, textAlign:"center" }}>
            <div style={{ color:"#fca5a5", fontSize:16, fontWeight:700, marginBottom:4 }}>Your free trial has ended</div>
            <div style={{ color:"#f87171", fontSize:13 }}>Choose a plan below to continue using MOE</div>
          </div>
        )}

        {/* Title */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h1 style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:"0 0 8px" }}>Choose Your Plan</h1>
          <p style={{ color:"#64748b", fontSize:15, margin:0 }}>Simple pricing for kitchens of every size. Cancel anytime.</p>
        </div>

        {/* Plan cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, marginBottom:40 }}>
          {Object.entries(PLANS).map(([key, plan]) => {
            const isSelected = selected === key;
            const isPro = key === "pro";
            return (
              <div key={key} onClick={() => setSelected(key)}
                style={{ background:"#0f1a2e", border:`2px solid ${isSelected ? "#e2e8f0" : isPro ? "#1e2d45" : "#1e2d45"}`, borderRadius:16, padding:"28px 24px", cursor:"pointer", position:"relative", transition:"all 0.2s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "#475569"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isPro ? "#1e2d45" : "#1e2d45"; }}>

                {isPro && (
                  <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"#e2e8f0", color:"#080c14", borderRadius:20, padding:"3px 14px", fontSize:11, fontWeight:700, letterSpacing:"0.5px" }}>
                    MOST POPULAR
                  </div>
                )}

                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1px", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>{plan.name}</div>
                <div style={{ color:"#f1f5f9", fontSize:36, fontWeight:800, marginBottom:4 }}>
                  ${plan.price}<span style={{ fontSize:15, fontWeight:400, color:"#64748b" }}>/mo</span>
                </div>
                <div style={{ color:"#475569", fontSize:13, marginBottom:20 }}>{plan.label}</div>

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <PlanFeature label={plan.vendors === Infinity ? "Unlimited vendors" : `${plan.vendors} vendors`} included />
                  <PlanFeature label={plan.items === Infinity ? "Unlimited items" : `${plan.items} items`} included />
                  <PlanFeature label={plan.users === Infinity ? "Unlimited users" : `${plan.users} user${plan.users !== 1 ? "s" : ""}`} included />
                  <PlanFeature label="Inventory tracking" included />
                  <PlanFeature label="Order submission & history" included />
                  <PlanFeature label="PDF export" included />
                  <PlanFeature label="Insights & par suggestions" included={key !== "starter"} />
                  <PlanFeature label="Priority support" included={key === "enterprise"} />
                  <PlanFeature label="Custom onboarding" included={key === "enterprise"} />
                </div>

                <button onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                  style={{ width:"100%", marginTop:24, padding:"12px", borderRadius:10, border: isSelected ? "none" : "1px solid #1e2d45", background: isSelected ? "linear-gradient(135deg,#e2e8f0,#94a3b8)" : "transparent", color: isSelected ? "#080c14" : "#94a3b8", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  {isSelected ? "Selected" : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Subscribe button */}
        <div style={{ textAlign:"center" }}>
          <button onClick={() => onSelectPlan(selected)}
            style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:12, padding:"16px 48px", color:"#fff", fontSize:17, fontWeight:700, cursor:"pointer", letterSpacing:"0.5px" }}>
            Subscribe to {PLANS[selected].name} — ${PLANS[selected].price}/mo
          </button>
          <p style={{ color:"#475569", fontSize:12, marginTop:12 }}>Stripe payment integration coming soon. Your subscription will activate immediately.</p>
        </div>
      </div>
    </div>
  );
}

function PlanFeature({ label, included }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color: included ? "#4ade80" : "#334155", fontSize:14, flexShrink:0 }}>{included ? "✓" : "—"}</span>
      <span style={{ color: included ? "#94a3b8" : "#334155", fontSize:13 }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION VIEW — Manage plan from inside the app (owner sidebar)
// ═══════════════════════════════════════════════════════════════════════════════
function SubscriptionView({ subscription, onSelectPlan, trialDaysLeft, isTrialing, isActive }) {
  const currentPlanKey = subscription?.plan || "pro";
  const currentPlan = PLANS[currentPlanKey];
  const trialStartDate = subscription?.trialStart ? new Date(subscription.trialStart) : null;
  const trialEndDate = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const trialProgress = trialStartDate && trialEndDate ? Math.max(0, Math.min(100, ((new Date() - trialStartDate) / (trialEndDate - trialStartDate)) * 100)) : 0;

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>💳 Subscription</h2>
        <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Manage your plan and billing</p>
      </div>

      {/* Trial countdown card */}
      {isTrialing && (
        <div style={{ background:"#422006", border:"1px solid #d97706", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
            <div style={{ color:"#fbbf24", fontSize:16, fontWeight:700 }}>Free Trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</div>
            <span style={{ color:"#92400e", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
              {trialStartDate?.toLocaleDateString("en-US", { month:"short", day:"numeric" })} → {trialEndDate?.toLocaleDateString("en-US", { month:"short", day:"numeric" })}
            </span>
          </div>
          <div style={{ background:"#78350f", borderRadius:6, height:8, overflow:"hidden", marginBottom:10 }}>
            <div style={{ width:`${trialProgress}%`, height:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:6, transition:"width 0.5s" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ color:"#92400e", fontSize:12 }}>{Math.round(trialProgress)}% elapsed</span>
            <span style={{ color:"#fbbf24", fontSize:12, fontWeight:600 }}>Pro features included during trial</span>
          </div>
        </div>
      )}

      {/* Current plan status */}
      <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"20px 24px", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ color:"#f1f5f9", fontSize:20, fontWeight:700 }}>{currentPlan.name}</span>
              {isTrialing && (
                <span style={{ background:"#422006", border:"1px solid #d97706", borderRadius:6, padding:"3px 10px", color:"#fbbf24", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                  TRIAL — {trialDaysLeft}d left
                </span>
              )}
              {isActive && (
                <span style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:6, padding:"3px 10px", color:"#4ade80", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ color:"#475569", fontSize:13 }}>{currentPlan.label}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#f1f5f9", fontSize:28, fontWeight:800 }}>{isTrialing ? "FREE" : `$${currentPlan.price}`}<span style={{ fontSize:14, fontWeight:400, color:"#64748b" }}>{isTrialing ? "" : "/mo"}</span></div>
            {isTrialing && <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>${currentPlan.price}/mo after trial</div>}
          </div>
        </div>

        {/* Current plan limits */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginTop:16, paddingTop:16, borderTop:"1px solid #1e2d45" }}>
          {[
            { label:"Vendors", value: currentPlan.vendors === Infinity ? "Unlimited" : currentPlan.vendors, color:"#a5b4fc" },
            { label:"Items", value: currentPlan.items === Infinity ? "Unlimited" : currentPlan.items, color:"#4ade80" },
            { label:"Users", value: currentPlan.users === Infinity ? "Unlimited" : currentPlan.users, color:"#fbbf24" },
          ].map(l => (
            <div key={l.label} style={{ background:"#080c14", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ color:l.color, fontSize:18, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{l.value}</div>
              <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>{l.label}</div>
            </div>
          ))}
        </div>

        {subscription?.subscribedAt && (
          <div style={{ marginTop:12, color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
            Subscribed: {new Date(subscription.subscribedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Change plan */}
      <h3 style={{ color:"#94a3b8", fontSize:14, fontWeight:600, margin:"0 0 12px" }}>{isActive ? "Change Plan" : "Upgrade Plan"}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
        {Object.entries(PLANS).map(([key, plan]) => {
          const isCurrent = key === currentPlanKey;
          return (
            <div key={key} style={{ background:"#0f1a2e", border:`1px solid ${isCurrent ? "#e2e8f0" : "#1e2d45"}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{plan.name}</span>
                  {isCurrent && <span style={{ color:"#475569", fontSize:11, marginLeft:8 }}>(current)</span>}
                </div>
                <span style={{ color:"#f1f5f9", fontSize:18, fontWeight:700 }}>${plan.price}<span style={{ fontSize:12, fontWeight:400, color:"#64748b" }}>/mo</span></span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                <span style={{ color:"#94a3b8", fontSize:12 }}>✓ {plan.vendors === Infinity ? "Unlimited" : plan.vendors} vendors · {plan.items === Infinity ? "Unlimited" : plan.items} items · {plan.users === Infinity ? "Unlimited" : plan.users} users</span>
                {key !== "starter" && <span style={{ color:"#94a3b8", fontSize:12 }}>✓ Insights & par suggestions</span>}
                {key === "enterprise" && <span style={{ color:"#94a3b8", fontSize:12 }}>✓ Priority support & onboarding</span>}
              </div>
              {isCurrent ? (
                <div style={{ padding:"8px", textAlign:"center", color:"#475569", fontSize:12, border:"1px solid #1e2d45", borderRadius:8 }}>Current Plan</div>
              ) : (
                <button onClick={() => onSelectPlan(key)}
                  style={{ width:"100%", padding:"8px", borderRadius:8, border:"none", background: key === "enterprise" ? "linear-gradient(135deg,#e2e8f0,#94a3b8)" : "linear-gradient(135deg,#22c55e,#16a34a)", color: key === "enterprise" ? "#080c14" : "#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {isTrialing ? `Subscribe — $${plan.price}/mo` : `Switch to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:24, background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px" }}>
        <span style={{ color:"#475569", fontSize:12 }}>Stripe payment integration coming soon. Plan changes take effect immediately. Need help? Contact support.</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT VIEW — Upload CSV/Excel or invoice photo to populate inventory
// ═══════════════════════════════════════════════════════════════════════════════
function ImportView({ inventory, saveInventory, vendors }) {
  const [mode, setMode] = useState(null); // "file" | "photo"
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [imported, setImported] = useState(false);
  const [targetSection, setTargetSection] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const fileRef = React.useRef(null);
  const photoRef = React.useRef(null);

  const sections = inventory.map(s => s.section);

  // ── Parse CSV / TSV text into items ──────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headerLine = lines[0].toLowerCase();
    const sep = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(sep).map(h => h.trim().replace(/"/g, ""));

    // Map column names to fields
    const colMap = {};
    headers.forEach((h, i) => {
      if (h.match(/item|name|product|description/i)) colMap.name = i;
      if (h.match(/unit|order.?unit|pkg/i)) colMap.order_unit = i;
      if (h.match(/upu|units.?per|per.?pkg|pack/i)) colMap.upu = i;
      if (h.match(/vendor|supplier/i)) colMap.vendor = i;
      if (h.match(/max|par|max.?stock/i)) colMap.max_stock = i;
      if (h.match(/reorder|min|reorder.?point/i)) colMap.reorder = i;
      if (h.match(/section|category|location|area/i)) colMap.section = i;
    });

    if (colMap.name === undefined) {
      // No header match — treat first column as name
      colMap.name = 0;
      // Try the rest positionally
      if (headers.length > 1) colMap.order_unit = 1;
      if (headers.length > 2) colMap.vendor = 2;
      if (headers.length > 3) colMap.max_stock = 3;
      if (headers.length > 4) colMap.reorder = 4;
    }

    return lines.slice(1).map((line, idx) => {
      const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const name = cols[colMap.name] || "";
      if (!name) return null;
      return {
        id: Date.now() + idx,
        name,
        order_unit: cols[colMap.order_unit] || "Case",
        upu: parseInt(cols[colMap.upu]) || 1,
        vendor: cols[colMap.vendor] || "",
        max_stock: parseInt(cols[colMap.max_stock]) || 10,
        reorder: parseInt(cols[colMap.reorder]) || 2,
        _section: cols[colMap.section] || "",
      };
    }).filter(Boolean);
  };

  // ── Handle file upload (CSV, TSV, TXT) ──────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedItems([]); setImported(false);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const items = parseCSV(text);
        if (items.length === 0) { setParseError("No items found. Make sure your file has a header row with at least an item name column."); }
        else { setParsedItems(items); }
      } catch (err) { setParseError("Failed to parse file: " + err.message); }
      setParsing(false);
    };
    reader.onerror = () => { setParseError("Failed to read file."); setParsing(false); };
    reader.readAsText(file);
  };

  // ── Handle photo upload — use Claude API to extract items ───────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedItems([]); setImported(false);
    setParsing(true);

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewImage(url);

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(",")[1]);
        r.onerror = () => reject(new Error("Read failed"));
        r.readAsDataURL(file);
      });

      const mediaType = file.type || "image/jpeg";

      // Call Claude API to extract items from the invoice/photo
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Extract ALL inventory items from this image (invoice, order sheet, or inventory list). Return ONLY a JSON array with no other text, no markdown backticks. Each object should have these fields:
- "name": item name (string)
- "order_unit": unit of measurement like Case, Each, Bag, Lbs, Unit, Bundle, Roll, Gallon (string, default "Case")
- "vendor": vendor/supplier name if visible (string, default "")
- "max_stock": suggested max stock quantity (number, default 10)
- "reorder": suggested reorder point (number, default 2)
- "upu": units per package (number, default 1)
- "section": category like Produce, Dairy, Frozen, Dry Goods, etc. if you can determine it (string, default "")

Be thorough — extract every single item you can see. If quantities are shown, use them for max_stock. Return ONLY the JSON array.` }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const items = JSON.parse(clean);

      if (Array.isArray(items) && items.length > 0) {
        setParsedItems(items.map((item, idx) => ({
          id: Date.now() + idx,
          name: item.name || "Unknown Item",
          order_unit: item.order_unit || "Case",
          upu: parseInt(item.upu) || 1,
          vendor: item.vendor || "",
          max_stock: parseInt(item.max_stock) || 10,
          reorder: parseInt(item.reorder) || 2,
          _section: item.section || "",
        })));
      } else {
        setParseError("No items could be extracted from this image. Try a clearer photo.");
      }
    } catch (err) {
      setParseError("Failed to process image: " + err.message);
    }
    setParsing(false);
  };

  // ── Edit a parsed item ──────────────────────────────────────────────────
  const updateParsedItem = (idx, field, value) => {
    setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const removeParsedItem = (idx) => {
    setParsedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Import parsed items into inventory ──────────────────────────────────
  const handleImport = () => {
    if (parsedItems.length === 0) return;

    const newInv = [...inventory];

    parsedItems.forEach(item => {
      // Determine which section
      const sec = item._section || targetSection || (newSectionName.trim() || "📦  Imported Items");
      const cleanItem = {
        id: item.id, name: item.name, order_unit: item.order_unit,
        upu: parseInt(item.upu) || 1, vendor: item.vendor || "",
        max_stock: parseInt(item.max_stock) || 10, reorder: parseInt(item.reorder) || 2,
      };

      const existing = newInv.find(s => s.section === sec);
      if (existing) {
        // Skip duplicates by name
        if (!existing.items.some(i => i.name.toLowerCase() === cleanItem.name.toLowerCase())) {
          existing.items.push(cleanItem);
        }
      } else {
        newInv.push({ section: sec, items: [cleanItem] });
      }
    });

    saveInventory(newInv);
    setImported(true);
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const reset = () => {
    setMode(null); setParsedItems([]); setParseError(""); setPreviewImage(null);
    setImported(false); setTargetSection(""); setNewSectionName("");
    if (fileRef.current) fileRef.current.value = "";
    if (photoRef.current) photoRef.current.value = "";
  };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>📤 Import Items</h2>
        <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Upload an inventory list or take a photo of an invoice to add items to your backend</p>
      </div>

      {/* Success state */}
      {imported && (
        <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:12, padding:32, textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ color:"#4ade80", fontSize:18, fontWeight:700, marginBottom:6 }}>{parsedItems.length} items imported</div>
          <div style={{ color:"#22c55e", fontSize:13, marginBottom:16 }}>Items have been added to your inventory. Go to Backend to review and edit.</div>
          <button onClick={reset} style={{ background:"transparent", border:"1px solid #16a34a", borderRadius:8, padding:"8px 20px", color:"#4ade80", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Import More
          </button>
        </div>
      )}

      {/* Method selection */}
      {!mode && !imported && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
          <button onClick={() => setMode("file")}
            style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
            <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, marginBottom:6 }}>Upload a File</div>
            <div style={{ color:"#475569", fontSize:12 }}>CSV, TSV, or TXT with item names, units, vendors, quantities</div>
          </button>
          <button onClick={() => setMode("photo")}
            style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
            <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, marginBottom:6 }}>Photo of Invoice</div>
            <div style={{ color:"#475569", fontSize:12 }}>Take a photo or upload an image — AI will extract the items</div>
          </button>
        </div>
      )}

      {/* File upload */}
      {mode === "file" && !imported && parsedItems.length === 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={reset} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#94a3b8", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>← Back</button>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Upload Inventory File</span>
          </div>
          <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", textAlign:"center" }}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display:"none" }} />
            <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
            <button onClick={() => fileRef.current?.click()}
              style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"10px 24px", color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
              Choose File
            </button>
            <div style={{ color:"#475569", fontSize:12 }}>Accepts CSV, TSV, or TXT files</div>
          </div>
          {parsing && <div style={{ textAlign:"center", color:"#a5b4fc", marginTop:16 }}>Parsing file...</div>}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginTop:16 }}>{parseError}</div>}

          {/* Format guide */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"14px 16px", marginTop:16 }}>
            <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, marginBottom:8 }}>Expected Format</div>
            <div style={{ background:"#080c14", borderRadius:6, padding:"10px 12px", fontFamily:"'DM Mono',monospace", fontSize:11, color:"#64748b", overflowX:"auto", whiteSpace:"pre" }}>
{`Name, Order Unit, Vendor, Max Stock, Reorder, Section
Flour, Unit, Anacapri, 17, 4, Dry Goods
Mozzarella, Case, Anacapri, 10, 3, Dairy
French Fries, Case, , 12, 3, Freezer`}
            </div>
            <div style={{ color:"#475569", fontSize:11, marginTop:8 }}>Only the Name column is required. Other columns are optional — MOE will auto-detect headers.</div>
          </div>
        </div>
      )}

      {/* Photo upload */}
      {mode === "photo" && !imported && parsedItems.length === 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={reset} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#94a3b8", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>← Back</button>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Photo of Invoice / Order Sheet</span>
          </div>
          <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", textAlign:"center" }}>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display:"none" }} />
            <div style={{ fontSize:36, marginBottom:12 }}>📸</div>
            <button onClick={() => photoRef.current?.click()}
              style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"10px 24px", color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
              Take Photo or Upload Image
            </button>
            <div style={{ color:"#475569", fontSize:12 }}>JPG, PNG, HEIC — invoices, order sheets, inventory lists</div>
          </div>
          {parsing && (
            <div style={{ textAlign:"center", marginTop:20 }}>
              <div style={{ color:"#a5b4fc", fontSize:14, fontWeight:600, marginBottom:8 }}>Analyzing image with AI...</div>
              <div style={{ color:"#475569", fontSize:12 }}>Extracting item names, quantities, and vendors</div>
            </div>
          )}
          {previewImage && !parsing && parsedItems.length === 0 && (
            <div style={{ marginTop:16, textAlign:"center" }}>
              <img src={previewImage} alt="Preview" style={{ maxWidth:"100%", maxHeight:300, borderRadius:10, border:"1px solid #1e2d45" }} />
            </div>
          )}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginTop:16 }}>{parseError}</div>}
        </div>
      )}

      {/* Preview & edit parsed items */}
      {parsedItems.length > 0 && !imported && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{parsedItems.length} items found</div>
              <div style={{ color:"#475569", fontSize:12, marginTop:2 }}>Review, edit, or remove items before importing</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={reset} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>Cancel</button>
              <button onClick={handleImport} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Import {parsedItems.length} Items
              </button>
            </div>
          </div>

          {/* Target section picker */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Import to Section</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <select value={targetSection} onChange={e => setTargetSection(e.target.value)}
                style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer", flex:1, minWidth:180 }}>
                <option value="">Auto-detect from data</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ New section...</option>
              </select>
              {targetSection === "__new__" && (
                <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name..."
                  style={{ background:"#080c14", border:"1px solid #e2e8f0", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", flex:1, minWidth:160 }} />
              )}
            </div>
            <div style={{ color:"#475569", fontSize:11, marginTop:6 }}>Items with a detected section will use that. Others go to the section selected here.</div>
          </div>

          {/* Items table */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 80px 80px 36px", background:"#080c14", padding:"8px 12px", gap:6 }}>
              {["Item Name", "Vendor", "Unit", "Max", "Reorder", ""].map(h => (
                <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight:400, overflowY:"auto" }}>
              {parsedItems.map((item, idx) => (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 80px 80px 36px", padding:"8px 12px", gap:6, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                  <input value={item.name} onChange={e => updateParsedItem(idx, "name", e.target.value)}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 8px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input value={item.vendor} onChange={e => updateParsedItem(idx, "vendor", e.target.value)} placeholder="—"
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 8px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <select value={item.order_unit} onChange={e => updateParsedItem(idx, "order_unit", e.target.value)}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:11, outline:"none", cursor:"pointer" }}>
                    {["Case","Each","Piece","Unit","Bag","Bundle","Gallon","Roll","Lbs"].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" value={item.max_stock} onChange={e => updateParsedItem(idx, "max_stock", parseInt(e.target.value)||0)} min={0}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center" }} />
                  <input type="number" value={item.reorder} onChange={e => updateParsedItem(idx, "reorder", parseInt(e.target.value)||0)} min={0}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center" }} />
                  <button onClick={() => removeParsedItem(idx)}
                    style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:14 }}
                    onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color="#475569"}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE (served at getmoe.ai/)
// ═══════════════════════════════════════════════════════════════════════════════

const LANDING_PLANS = [
  { name: "Starter", price: 299, vendors: "3", items: "100", users: "2", features: ["Inventory tracking", "Order submission & history", "PDF export"], cta: "Start Free Trial" },
  { name: "Pro", price: 399, vendors: "Unlimited", items: "Unlimited", users: "10", features: ["Everything in Starter", "AI-powered import", "Insights & par suggestions", "Smart reorder recommendations"], popular: true, cta: "Start Free Trial" },
  { name: "Enterprise", price: 499, vendors: "Unlimited", items: "Unlimited", users: "Unlimited", features: ["Everything in Pro", "Priority support", "Custom onboarding", "Multi-location ready"], cta: "Contact Sales" },
];

const STEPS = [
  { num: "01", title: "Set Up Your Business", desc: "Add your vendors, items, and sections. Or upload an invoice photo and let AI do it for you.", icon: "🏪" },
  { num: "02", title: "Count Your Stock", desc: "Walk your space and tap to count. Employees can do it from their phones — no training needed.", icon: "📋" },
  { num: "03", title: "Submit Orders", desc: "MOE calculates what you need based on par levels. One tap to submit, auto-generates a PDF for your vendor.", icon: "📦" },
  { num: "04", title: "Get Smarter Each Week", desc: "After 3 weeks, MOE analyzes your ordering patterns and recommends better par levels automatically.", icon: "📊" },
];

const FEATURES = [
  { title: "Vendor-Based Ordering", desc: "Set order days per vendor. MOE shows you who to order from today and auto-calculates quantities.", icon: "📦" },
  { title: "AI Invoice Import", desc: "Snap a photo of any invoice or order sheet. AI extracts every item, unit, and quantity into your inventory.", icon: "📸" },
  { title: "Smart Par Suggestions", desc: "After 3 weeks of data, MOE recommends optimal stock levels based on your actual usage patterns.", icon: "🧠" },
  { title: "Team Access Control", desc: "Owners, managers, and employees each see exactly what they need. No confusion, no mistakes.", icon: "👥" },
  { title: "Real-Time Sync", desc: "Everyone sees the same inventory in real-time. Count stock on one phone, it updates everywhere instantly.", icon: "⚡" },
  { title: "One-Tap PDF Orders", desc: "Generate clean, printable order sheets per vendor. Email or text them directly — no more handwritten lists.", icon: "🖨️" },
];

const FAQS = [
  { q: "How long is the free trial?", a: "14 days with full Pro features. No credit card required to start." },
  { q: "Can my employees use it?", a: "Yes. Add employees in Settings with their email. They sign in and see only what they need — the inventory count screen." },
  { q: "Do I need to enter all my items manually?", a: "No. You can upload a CSV, or just take a photo of any invoice or order sheet. Our AI will extract all the items for you." },
  { q: "What happens after the trial?", a: "Choose a plan that fits. Your data carries over — nothing is lost. Cancel anytime." },
  { q: "Does it work on phones?", a: "MOE is built mobile-first. Your team counts stock on their phones while walking the floor." },
  { q: "Can I use it for multiple locations?", a: "Yes. Enterprise plan supports multiple locations, each with their own inventory and team." },
];

function HexIcon({ size = 48 }) {
  const r = size / 2;
  const hex = (cx, cy, rad) => {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`); }
    return pts.join(" ");
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={hex(r, r, r * 0.95)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      <polygon points={hex(r, r, r * 0.6)} fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
      <polygon points={hex(r, r, r * 0.3)} fill="#0f172a" />
    </svg>
  );
}

function MoeLogoLanding({ size = "lg" }) {
  const configs = { md: { vw: 130, vh: 44, hx: 22, hy: 22, oR: 20, mR: 13, iR: 7, d: 2.2, tx: 44, ty: 28, fs: 24 }, lg: { vw: 200, vh: 64, hx: 32, hy: 32, oR: 29, mR: 19, iR: 10, d: 3, tx: 64, ty: 42, fs: 34 } };
  const c = configs[size] || configs.lg;
  const hex = (cx, cy, r) => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`); } return pts.join(" "); };
  const spokes = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { x1: (c.hx + c.oR * Math.cos(a)).toFixed(2), y1: (c.hy + c.oR * Math.sin(a)).toFixed(2), x2: (c.hx + c.mR * Math.cos(a)).toFixed(2), y2: (c.hy + c.mR * Math.sin(a)).toFixed(2) }; });
  const dots = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { cx: (c.hx + c.oR * Math.cos(a)).toFixed(2), cy: (c.hy + c.oR * Math.sin(a)).toFixed(2) }; });
  return (
    <svg width={c.vw} height={c.vh} viewBox={`0 0 ${c.vw} ${c.vh}`} style={{ display: "block" }}>
      <polygon points={hex(c.hx, c.hy, c.oR)} fill="none" stroke="#94a3b8" strokeWidth="0.8" opacity="0.4" />
      {spokes.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#94a3b8" strokeWidth="0.7" opacity="0.3" />)}
      {dots.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={c.d} fill="#64748b" opacity="0.5" />)}
      <polygon points={hex(c.hx, c.hy, c.mR)} fill="none" stroke="#475569" strokeWidth="1" opacity="0.5" />
      <polygon points={hex(c.hx, c.hy, c.iR)} fill="#0f172a" />
      <circle cx={c.hx} cy={c.hy} r={c.iR * 0.4} fill="#f8fafc" opacity="0.3" />
      <text x={c.tx} y={c.ty} fontFamily="'Syne',sans-serif" fontWeight="800" fontSize={c.fs} letterSpacing="-1" fill="#0f172a">M<tspan fill="#475569">OE</tspan></text>
    </svg>
  );
}

function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState({});
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(prev => ({ ...prev, [e.target.dataset.section]: true }));
      });
    }, { threshold: 0.15 });
    Object.values(sectionRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const regSection = (id) => (el) => { sectionRefs.current[id] = el; if (el) el.dataset.section = id; };
  const isVis = (id) => visible[id];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8fafc", color: "#1e293b", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .fade-up { opacity: 0; animation: fadeUp 0.7s ease forwards; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        .fade-up-d4 { animation-delay: 0.4s; }
        .vis .fade-up { opacity: 0; animation: fadeUp 0.7s ease forwards; }
        .cta-btn { transition: all 0.2s; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(15,23,42,0.2); }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(15,23,42,0.08); }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 16px 50px rgba(15,23,42,0.1); }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(248,250,252,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid #e2e8f0" : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <MoeLogoLanding size="md" />
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a href="#features" style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>Features</a>
            <a href="#how-it-works" style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>How It Works</a>
            <a href="#pricing" style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>Pricing</a>
            <a href="#faq" style={{ color: "#64748b", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>FAQ</a>
            <button onClick={() => window.__moeNavigate("/app")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "6px 0" }}>
              Sign In
            </button>
            <button className="cta-btn" onClick={() => window.__moeNavigate("/app")} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ paddingTop: 160, paddingBottom: 100, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Subtle grid background */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 0%, #e2e8f0 0%, transparent 60%)", opacity: 0.4 }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)", backgroundSize: "60px 60px", opacity: 0.3 }} />

        <div style={{ position: "relative", maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
          <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 40, padding: "6px 18px 6px 8px", marginBottom: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>NEW</span>
            <span style={{ color: "#64748b", fontSize: 13 }}>AI-powered invoice import is here</span>
          </div>

          <h1 className="fade-up fade-up-d1" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-2px", color: "#0f172a", marginBottom: 24 }}>
            Your business is losing<br /><span style={{ color: "#dc2626" }}>$500 a week</span> on bad orders.
          </h1>

          <p className="fade-up fade-up-d2" style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "#64748b", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 40px" }}>
            Over-ordering, waste, emergency runs, and guesswork add up fast. MOE tracks your inventory, calculates exactly what you need, and gets smarter every week — so you stop bleeding money.
          </p>

          <div className="fade-up fade-up-d3" style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => window.__moeNavigate("/app")} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 12, padding: "16px 36px", fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.3px" }}>
              Start 14-Day Free Trial
            </button>
            <button className="cta-btn" style={{ background: "#fff", color: "#0f172a", border: "2px solid #e2e8f0", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              See How It Works ↓
            </button>
          </div>

          <p className="fade-up fade-up-d4" style={{ color: "#94a3b8", fontSize: 13, marginTop: 16 }}>No credit card required · 14 days free · Cancel anytime</p>
        </div>

        {/* Floating stats */}
        <div className="fade-up fade-up-d4" style={{ maxWidth: 700, margin: "60px auto 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, padding: "0 24px" }}>
          {[
            { value: "$500+", label: "Saved per week on average", sub: "Less waste, fewer emergency orders" },
            { value: "$26K", label: "Average annual savings", sub: "Pays for itself 4x over" },
            { value: "30s", label: "To submit a vendor order", sub: "Down from 20+ minutes" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "24px 16px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, color: "#0f172a", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ color: "#475569", fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section style={{ background: "#fff", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", padding: "24px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap", padding: "0 24px" }}>
          <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>Trusted by businesses that order and stock</span>
          {["Restaurants", "Retail Shops", "Salons", "Auto Shops", "Warehouses"].map(t => (
            <span key={t} style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" ref={regSection("features")} style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60, opacity: isVis("features") ? 1 : 0, transform: isVis("features") ? "translateY(0)" : "translateY(30px)", transition: "all 0.7s" }}>
          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>Features</span>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "#0f172a", marginTop: 12, letterSpacing: "-1px" }}>Everything your business needs</h2>
          <p style={{ color: "#64748b", fontSize: 16, marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>Built for any business that orders supplies and tracks inventory — restaurants, retail, salons, shops, warehouses, and more.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, idx) => (
            <div key={f.title} className="feature-card"
              style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #f1f5f9", transition: "all 0.3s", cursor: "default",
                opacity: isVis("features") ? 1 : 0, transform: isVis("features") ? "translateY(0)" : "translateY(20px)", transitionDelay: `${idx * 0.08}s` }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" ref={regSection("hiw")} style={{ background: "#0f172a", padding: "100px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64, opacity: isVis("hiw") ? 1 : 0, transform: isVis("hiw") ? "translateY(0)" : "translateY(30px)", transition: "all 0.7s" }}>
            <span style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>How It Works</span>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "#f1f5f9", marginTop: 12, letterSpacing: "-1px" }}>Up and running in minutes</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            {STEPS.map((step, idx) => (
              <div key={step.num}
                style={{ background: "#1e293b", borderRadius: 16, padding: "32px 24px", border: "1px solid #334155", position: "relative",
                  opacity: isVis("hiw") ? 1 : 0, transform: isVis("hiw") ? "translateY(0)" : "translateY(20px)", transition: "all 0.6s", transitionDelay: `${idx * 0.12}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{step.icon}</span>
                  <span style={{ color: "#475569", fontSize: 32, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{step.num}</span>
                </div>
                <h3 style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>{step.title}</h3>
                <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ QUOTE / PAIN POINT ═══ */}
      <section ref={regSection("quote")} style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", opacity: isVis("quote") ? 1 : 0, transition: "all 0.8s" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>💬</div>
          <blockquote style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "#0f172a", lineHeight: 1.4, letterSpacing: "-0.5px", fontStyle: "normal" }}>
            "I was over-ordering $600 a week and didn't even realize it. MOE showed me exactly where the waste was and cut it to almost zero in the first month."
          </blockquote>
          <div style={{ marginTop: 24, color: "#64748b", fontSize: 14 }}>
            <strong style={{ color: "#0f172a" }}>Small Business Owner</strong> · Queens, NY
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" ref={regSection("pricing")} style={{ padding: "100px 24px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60, opacity: isVis("pricing") ? 1 : 0, transform: isVis("pricing") ? "translateY(0)" : "translateY(30px)", transition: "all 0.7s" }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>Pricing</span>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "#0f172a", marginTop: 12, letterSpacing: "-1px" }}>Simple pricing, no surprises</h2>
            <p style={{ color: "#64748b", fontSize: 16, marginTop: 12 }}>Every plan pays for itself in the first week. Start with a 14-day free trial — no credit card required.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {LANDING_PLANS.map((plan, idx) => (
              <div key={plan.name} className="plan-card"
                style={{ background: plan.popular ? "#0f172a" : "#fff", borderRadius: 20, padding: "36px 28px", border: plan.popular ? "2px solid #334155" : "1px solid #e2e8f0", position: "relative", transition: "all 0.3s",
                  opacity: isVis("pricing") ? 1 : 0, transform: isVis("pricing") ? "translateY(0)" : "translateY(20px)", transitionDelay: `${idx * 0.1}s` }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#f1f5f9", color: "#0f172a", borderRadius: 20, padding: "4px 16px", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px" }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ color: plan.popular ? "#94a3b8" : "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: plan.popular ? "#f1f5f9" : "#0f172a", fontFamily: "'Syne',sans-serif", letterSpacing: "-2px" }}>
                  ${plan.price}<span style={{ fontSize: 16, fontWeight: 400, color: plan.popular ? "#64748b" : "#94a3b8" }}>/mo</span>
                </div>

                <div style={{ display: "flex", gap: 12, margin: "20px 0", flexWrap: "wrap" }}>
                  {[["Vendors", plan.vendors], ["Items", plan.items], ["Users", plan.users]].map(([l, v]) => (
                    <span key={l} style={{ background: plan.popular ? "#1e293b" : "#f8fafc", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: plan.popular ? "#94a3b8" : "#64748b", fontFamily: "'DM Mono',monospace" }}>
                      <strong style={{ color: plan.popular ? "#f1f5f9" : "#0f172a" }}>{v}</strong> {l}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0 28px" }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#22c55e", fontSize: 16, flexShrink: 0 }}>✓</span>
                      <span style={{ color: plan.popular ? "#cbd5e1" : "#475569", fontSize: 14 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button className="cta-btn" onClick={() => window.__moeNavigate("/app")} style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  background: plan.popular ? "#f1f5f9" : "#0f172a",
                  color: plan.popular ? "#0f172a" : "#fff",
                }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" ref={regSection("faq")} style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48, opacity: isVis("faq") ? 1 : 0, transform: isVis("faq") ? "translateY(0)" : "translateY(30px)", transition: "all 0.7s" }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>FAQ</span>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 800, color: "#0f172a", marginTop: 12, letterSpacing: "-1px" }}>Questions? Answers.</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} onClick={() => setOpenFaq(isOpen ? null : idx)}
                  style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #f1f5f9", padding: "18px 24px", cursor: "pointer", transition: "all 0.2s",
                    opacity: isVis("faq") ? 1 : 0, transform: isVis("faq") ? "translateY(0)" : "translateY(10px)", transitionDelay: `${idx * 0.06}s` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#0f172a", fontSize: 15, fontWeight: 600 }}>{faq.q}</span>
                    <span style={{ color: "#94a3b8", fontSize: 20, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 16 }}>+</span>
                  </div>
                  {isOpen && <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ padding: "100px 24px", background: "#0f172a", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-1px", marginBottom: 16 }}>
            Stop losing $500 a week.
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            Over-ordering, waste, and last-minute vendor runs cost the average business $26,000+ a year. MOE pays for itself in the first week — and keeps saving you money every week after.
          </p>
          <button className="cta-btn" onClick={() => window.__moeNavigate("/app")} style={{ background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 14, padding: "18px 44px", fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.5px" }}>
            Start Your Free Trial
          </button>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 16 }}>14 days free · No credit card · Set up in 5 minutes</p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: "#0f172a", borderTop: "1px solid #1e293b", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <div>
            <MoeLogoLanding size="md" />
            <p style={{ color: "#475569", fontSize: 12, marginTop: 8 }}>Make Ordering Easy</p>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <a href="#features" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Features</a>
            <a href="#pricing" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Pricing</a>
            <a href="#faq" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>FAQ</a>
            <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Privacy</a>
            <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Terms</a>
          </div>
          <div style={{ color: "#334155", fontSize: 12 }}>© {new Date().getFullYear()} MOE. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER — getmoe.ai/ → Landing, getmoe.ai/app → MOE App
// ═══════════════════════════════════════════════════════════════════════════════
export default function Router() {
  const isSandbox = window.location.hostname === "localhost" || window.location.pathname.includes("artifact");

  const getRoute = () => {
    const p = window.location.pathname;
    const h = window.location.hash;
    // Production: check pathname
    if (p === "/app" || p.startsWith("/app/")) return "app";
    // Sandbox fallback: check hash
    if (h === "#/app" || h === "#app") return "app";
    return "landing";
  };

  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onNav = () => setRoute(getRoute());
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => { window.removeEventListener("popstate", onNav); window.removeEventListener("hashchange", onNav); };
  }, []);

  window.__moeNavigate = (to) => {
    if (to === "/app") {
      try { window.history.pushState({}, "", "/app"); } catch {
        window.location.hash = "#/app";
      }
      setRoute("app");
    } else {
      try { window.history.pushState({}, "", "/"); } catch {
        window.location.hash = "";
      }
      setRoute("landing");
    }
  };

  if (route === "app") return <MoeApp />;
  return <LandingPage />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WASTE LOG — Track items going in the trash
// ═══════════════════════════════════════════════════════════════════════════════
function WasteLogView({ inventory, wasteLog, saveWasteLog, userName, priceHistory }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [viewMode, setViewMode] = useState("log"); // "log" | "summary"
  const [filterWeek, setFilterWeek] = useState("all");

  const allItems = flatItems(inventory);
  const wk = `${new Date().getFullYear()}-WK${String(getWeekNumber()).padStart(2, "0")}`;

  // Get latest price for an item from price tracker
  const getPrice = (itemId) => {
    const hist = priceHistory?.[itemId];
    if (!hist || hist.length === 0) return null;
    return [...hist].sort((a, b) => new Date(b.date) - new Date(a.date))[0].price;
  };
  const getCost = (entry) => { const p = getPrice(entry.itemId); return p ? p * entry.qty : null; };

  const reasons = [
    { key: "expired", label: "Expired", icon: "📅" },
    { key: "spoiled", label: "Spoiled", icon: "🤢" },
    { key: "damaged", label: "Damaged", icon: "💥" },
    { key: "overproduced", label: "Over-produced", icon: "📈" },
    { key: "dropped", label: "Dropped / Spilled", icon: "💧" },
    { key: "other", label: "Other", icon: "📝" },
  ];

  // Add waste entry
  const logWaste = () => {
    if (!selectedItem || qty < 1) return;
    const entry = {
      id: Date.now(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty,
      unit: selectedItem.order_unit,
      reason,
      note: note.trim(),
      loggedBy: userName,
      date: new Date().toISOString(),
      weekKey: wk,
      vendor: selectedItem.vendor || "",
      section: selectedItem.section || "",
    };
    saveWasteLog([entry, ...wasteLog]);
    setSelectedItem(null); setQty(1); setReason("expired"); setNote(""); setShowAdd(false); setSearch("");
  };

  const removeEntry = (id) => saveWasteLog(wasteLog.filter(e => e.id !== id));

  // Filter items for search
  const filteredItems = allItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.section || "").toLowerCase().includes(search.toLowerCase())
  );

  // Get all week keys from log
  const weekKeys = [...new Set(wasteLog.map(e => e.weekKey))].sort().reverse();

  // Filter log entries
  const displayLog = filterWeek === "all" ? wasteLog : wasteLog.filter(e => e.weekKey === filterWeek);

  // Summary stats
  const summaryData = {};
  const targetEntries = filterWeek === "all" ? wasteLog : wasteLog.filter(e => e.weekKey === filterWeek);
  targetEntries.forEach(e => {
    if (!summaryData[e.itemId]) summaryData[e.itemId] = { name: e.itemName, unit: e.unit, vendor: e.vendor, totalQty: 0, totalCost: 0, reasons: {}, entries: 0 };
    summaryData[e.itemId].totalQty += e.qty;
    summaryData[e.itemId].totalCost += getCost(e) || 0;
    summaryData[e.itemId].entries++;
    summaryData[e.itemId].reasons[e.reason] = (summaryData[e.itemId].reasons[e.reason] || 0) + e.qty;
  });
  const summaryRows = Object.values(summaryData).sort((a, b) => b.totalQty - a.totalQty);
  const totalWasted = targetEntries.reduce((s, e) => s + e.qty, 0);
  const totalEntries = targetEntries.length;

  // Reason breakdown
  const reasonTotals = {};
  targetEntries.forEach(e => { reasonTotals[e.reason] = (reasonTotals[e.reason] || 0) + e.qty; });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>🗑️ Waste Log</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Track what's going in the trash to reduce waste over time</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[{ key:"log", label:"Log" }, { key:"summary", label:"Summary" }].map(tab => (
            <button key={tab.key} onClick={() => setViewMode(tab.key)}
              style={{ background:viewMode===tab.key?"#e2e8f0":"transparent", border:`1px solid ${viewMode===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:viewMode===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:viewMode===tab.key?600:400, cursor:"pointer" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Est. $ lost", value: "$" + targetEntries.reduce((s, e) => s + (getCost(e) || 0), 0).toFixed(0), color:"#fca5a5", bg:"#450a0a", border:"#7f1d1d" },
          { label:"This week $", value: "$" + wasteLog.filter(e => e.weekKey === wk).reduce((s, e) => s + (getCost(e) || 0), 0).toFixed(0), color:"#f87171", bg:"#450a0a", border:"#7f1d1d" },
          { label:"Total units", value:totalWasted, color:"#fbbf24", bg:"#422006", border:"#d97706" },
          { label:"Items logged", value:totalEntries, color:"#a5b4fc", bg:"#0f2040", border:"#1e40af" },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ color:c.color, fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
            <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Week filter + add button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}
          style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer" }}>
          <option value="all">All weeks</option>
          <option value={wk}>This week ({wk})</option>
          {weekKeys.filter(w => w !== wk).map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:8, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            + Log Waste
          </button>
        )}
      </div>

      {/* Add waste form */}
      {showAdd && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Log Wasted Item</span>
            <button onClick={() => { setShowAdd(false); setSelectedItem(null); setSearch(""); }}
              style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16 }}>✕</button>
          </div>

          {/* Item search */}
          {!selectedItem ? (
            <div>
              <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Search Item</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Start typing item name..."
                autoFocus style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
              {search.length > 0 && (
                <div style={{ maxHeight:200, overflowY:"auto", borderRadius:8, border:"1px solid #1e2d45" }}>
                  {filteredItems.slice(0, 15).map((item, idx) => (
                    <div key={item.id} onClick={() => { setSelectedItem(item); setSearch(""); }}
                      style={{ padding:"10px 14px", cursor:"pointer", background:idx%2===0?"#0f1a2e":"#0a1220", borderBottom:"1px solid #080c14", display:"flex", alignItems:"center", justifyContent:"space-between" }}
                      onMouseEnter={e => e.currentTarget.style.background="#1e2d45"}
                      onMouseLeave={e => e.currentTarget.style.background=idx%2===0?"#0f1a2e":"#0a1220"}>
                      <div>
                        <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{item.name}</div>
                        <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{(item.section || "").replace(/[^\w\s]/g,"").trim()}</div>
                      </div>
                      <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{item.order_unit}</span>
                    </div>
                  ))}
                  {filteredItems.length === 0 && <div style={{ padding:"14px", color:"#475569", textAlign:"center", fontSize:13 }}>No items found</div>}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Selected item */}
              <div style={{ background:"#080c14", borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{selectedItem.name}</div>
                  <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{selectedItem.order_unit}{selectedItem.vendor ? ` · ${selectedItem.vendor}` : ""}</div>
                </div>
                <button onClick={() => setSelectedItem(null)} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"3px 8px" }}>Change</button>
              </div>

              {/* Quantity */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Quantity Wasted</label>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => setQty(Math.max(1, qty-1))} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <input type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, parseInt(e.target.value)||1))}
                      style={{ width:60, background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"6px", color:"#f1f5f9", fontSize:16, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                    <button onClick={() => setQty(qty+1)} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    <span style={{ color:"#475569", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{selectedItem.order_unit}</span>
                  </div>
                </div>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Reason</label>
                  <select value={reason} onChange={e => setReason(e.target.value)}
                    style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                    {reasons.map(r => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. left out overnight, past date by 2 days..."
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={logWaste}
                  style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Log Waste
                </button>
                <button onClick={() => { setShowAdd(false); setSelectedItem(null); setSearch(""); }}
                  style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LOG VIEW ── */}
      {viewMode === "log" && (
        <>
          {displayLog.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No waste logged yet</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Tap "Log Waste" to start tracking what's being thrown away</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {displayLog.map(entry => {
                const r = reasons.find(r => r.key === entry.reason) || { icon:"📝", label:entry.reason };
                return (
                  <div key={entry.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:200 }}>
                      <span style={{ fontSize:20 }}>{r.icon}</span>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{entry.itemName}</span>
                          <span style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:5, padding:"1px 7px", color:"#fca5a5", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{entry.qty} {entry.unit}</span>
                          {getCost(entry) !== null && <span style={{ color:"#ef4444", fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>−${getCost(entry).toFixed(2)}</span>}
                        </div>
                        <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                          {r.label}{entry.note ? ` — ${entry.note}` : ""} · {entry.loggedBy} · {new Date(entry.date).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeEntry(entry.id)}
                      style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:14, flexShrink:0 }}
                      onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color="#334155"}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── SUMMARY VIEW ── */}
      {viewMode === "summary" && (
        <>
          {/* Reason breakdown */}
          {Object.keys(reasonTotals).length > 0 && (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Waste by Reason</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {Object.entries(reasonTotals).sort((a,b) => b[1]-a[1]).map(([key, total]) => {
                  const r = reasons.find(r => r.key === key) || { icon:"📝", label:key };
                  const pct = totalWasted > 0 ? Math.round((total / totalWasted) * 100) : 0;
                  return (
                    <div key={key} style={{ background:"#080c14", borderRadius:8, padding:"10px 14px", minWidth:100, flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:14 }}>{r.icon}</span>
                        <span style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>{r.label}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                        <span style={{ color:"#fca5a5", fontSize:20, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{total}</span>
                        <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
                      </div>
                      <div style={{ background:"#1e2d45", borderRadius:3, height:4, marginTop:6, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:"#ef4444", borderRadius:3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top wasted items */}
          {summaryRows.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No waste data to summarize</div>
            </div>
          ) : (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 80px 80px 1fr", background:"#080c14", padding:"8px 16px", gap:8 }}>
                {["Item", "Wasted", "$ Lost", "Times", "Top Reason"].map(h => (
                  <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
                ))}
              </div>
              {summaryRows.map((row, idx) => {
                const topReason = Object.entries(row.reasons).sort((a,b) => b[1]-a[1])[0];
                const r = reasons.find(r => r.key === topReason?.[0]) || { icon:"📝", label:topReason?.[0] || "—" };
                return (
                  <div key={row.name} style={{ display:"grid", gridTemplateColumns:"2fr 80px 80px 80px 1fr", padding:"10px 16px", gap:8, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                    <div>
                      <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{row.name}</div>
                      {row.vendor && <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{row.vendor}</div>}
                    </div>
                    <span style={{ color:"#fca5a5", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{row.totalQty} <span style={{ fontSize:10, color:"#475569" }}>{row.unit}</span></span>
                    <span style={{ color:"#ef4444", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{row.totalCost > 0 ? `$${row.totalCost.toFixed(0)}` : "—"}</span>
                    <span style={{ color:"#a5b4fc", fontSize:13, fontFamily:"'DM Mono',monospace" }}>{row.entries}x</span>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:12 }}>{r.icon}</span>
                      <span style={{ color:"#94a3b8", fontSize:12 }}>{r.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE TRACKER — Track vendor prices, flag increases, upload invoices
// ═══════════════════════════════════════════════════════════════════════════════
function PriceTrackerView({ inventory, priceHistory, savePriceHistory, vendors }) {
  const [mode, setMode] = useState("dashboard"); // "dashboard" | "enter" | "upload"
  const [filterVendor, setFilterVendor] = useState("ALL");
  const [search, setSearch] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPrices, setParsedPrices] = useState([]);
  const photoRef = React.useRef(null);
  const fileRef = React.useRef(null);

  const allItems = flatItems(inventory);
  const wk = `${new Date().getFullYear()}-WK${String(getWeekNumber()).padStart(2, "0")}`;
  const vendorNames = [...new Set(allItems.map(i => (i.vendor || "").trim()).filter(Boolean))].sort();

  // ── Manual price entry ──────────────────────────────────────────────────
  const [manualPrices, setManualPrices] = useState({});
  const updateManualPrice = (itemId, price) => setManualPrices(prev => ({ ...prev, [itemId]: price }));

  const saveManualPrices = () => {
    const newPH = { ...priceHistory };
    Object.entries(manualPrices).forEach(([id, price]) => {
      const p = parseFloat(price);
      if (isNaN(p) || p <= 0) return;
      const item = allItems.find(i => String(i.id) === String(id));
      if (!newPH[id]) newPH[id] = [];
      newPH[id].push({ price: p, date: new Date().toISOString(), weekKey: wk, vendor: item?.vendor || "", source: "manual" });
    });
    savePriceHistory(newPH);
    setManualPrices({});
    setMode("dashboard");
  };

  // ── Photo upload — AI extracts prices ───────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedPrices([]); setParsing(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = () => reject(new Error("Read failed")); r.readAsDataURL(file);
      });
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 4000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
            { type: "text", text: `Extract ALL item prices from this invoice/receipt. Return ONLY a JSON array, no markdown. Each object: {"name": "item name", "price": number, "unit": "Case/Each/Lbs/etc"}. Extract every line item you can see with its price. Return ONLY the JSON array.` }
          ]}]
        })
      });
      const data = await response.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      const items = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(items) && items.length > 0) setParsedPrices(items.map((p, i) => ({ ...p, id: Date.now() + i, matched: null })));
      else setParseError("No prices found in image.");
    } catch (err) { setParseError("Failed to process: " + err.message); }
    setParsing(false);
  };

  // ── CSV upload ──────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedPrices([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setParseError("No data rows found."); return; }
        const sep = lines[0].includes("\t") ? "\t" : ",";
        const headers = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));
        let nameCol = headers.findIndex(h => h.match(/item|name|product|description/i));
        let priceCol = headers.findIndex(h => h.match(/price|cost|amount|total/i));
        let unitCol = headers.findIndex(h => h.match(/unit|uom|pkg/i));
        if (nameCol === -1) nameCol = 0;
        if (priceCol === -1) priceCol = 1;
        const items = lines.slice(1).map((line, i) => {
          const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
          const name = cols[nameCol] || "";
          const price = parseFloat((cols[priceCol] || "").replace(/[$,]/g, ""));
          if (!name || isNaN(price)) return null;
          return { id: Date.now() + i, name, price, unit: cols[unitCol] || "", matched: null };
        }).filter(Boolean);
        if (items.length > 0) setParsedPrices(items);
        else setParseError("No valid price rows found.");
      } catch (err) { setParseError("Parse error: " + err.message); }
    };
    reader.readAsText(file);
  };

  // ── Match parsed prices to inventory items ──────────────────────────────
  const matchItem = (parsedIdx, itemId) => {
    setParsedPrices(prev => prev.map((p, i) => i === parsedIdx ? { ...p, matched: itemId } : p));
  };

  const saveParsedPrices = (source) => {
    const newPH = { ...priceHistory };
    parsedPrices.forEach(p => {
      if (!p.matched || isNaN(p.price)) return;
      const item = allItems.find(i => i.id === p.matched);
      if (!newPH[p.matched]) newPH[p.matched] = [];
      newPH[p.matched].push({ price: p.price, date: new Date().toISOString(), weekKey: wk, vendor: item?.vendor || "", source });
    });
    savePriceHistory(newPH);
    setParsedPrices([]);
    setMode("dashboard");
  };

  // ── Auto-match by name similarity ───────────────────────────────────────
  React.useEffect(() => {
    if (parsedPrices.length === 0) return;
    setParsedPrices(prev => prev.map(p => {
      if (p.matched) return p;
      const lower = p.name.toLowerCase();
      const match = allItems.find(i => i.name.toLowerCase() === lower) || allItems.find(i => lower.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(lower));
      return match ? { ...p, matched: match.id } : p;
    }));
  }, [parsedPrices.length]);

  // ── Build dashboard data ────────────────────────────────────────────────
  const flagged = [];
  const allTracked = [];
  allItems.forEach(item => {
    const history = priceHistory[item.id];
    if (!history || history.length === 0) return;
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const current = sorted[0];
    const previous = sorted[1];
    const entry = { id: item.id, name: item.name, vendor: item.vendor || "", unit: item.order_unit, currentPrice: current.price, currentDate: current.date, currentWeek: current.weekKey, previousPrice: previous?.price || null, previousDate: previous?.date || null, totalEntries: sorted.length, priceHistory: sorted };
    if (previous) {
      entry.change = current.price - previous.price;
      entry.changePct = ((entry.change / previous.price) * 100).toFixed(1);
    }
    allTracked.push(entry);
    if (entry.change && entry.change > 0) flagged.push(entry);
  });

  flagged.sort((a, b) => parseFloat(b.changePct) - parseFloat(a.changePct));
  const filteredTracked = allTracked.filter(e => (filterVendor === "ALL" || e.vendor === filterVendor) && (!search || e.name.toLowerCase().includes(search.toLowerCase())));

  // Items for manual entry
  const manualItems = allItems.filter(i => (filterVendor === "ALL" || (i.vendor || "") === filterVendor) && (!search || i.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>💲 Price Tracker</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Track vendor prices week to week — flag increases automatically</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Items tracked", value:allTracked.length, color:"#a5b4fc", bg:"#0f2040", border:"#1e40af" },
          { label:"Price increases", value:flagged.length, color:"#fca5a5", bg:"#450a0a", border:"#7f1d1d" },
          { label:"Biggest jump", value: flagged[0] ? `+${flagged[0].changePct}%` : "—", color:"#fbbf24", bg:"#422006", border:"#d97706" },
          { label:"This week", value: allTracked.filter(e => e.currentWeek === wk).length, color:"#4ade80", bg:"#052e16", border:"#16a34a" },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ color:c.color, fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
            <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        {[
          { key:"dashboard", label:"Dashboard" },
          { key:"enter", label:"Enter Prices" },
          { key:"upload", label:"Upload Invoice" },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setMode(tab.key); setParsedPrices([]); setParseError(""); }}
            style={{ background:mode===tab.key?"#e2e8f0":"transparent", border:`1px solid ${mode===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:mode===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:mode===tab.key?600:400, cursor:"pointer" }}>
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {vendorNames.length > 0 && (
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
              style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"7px 12px", color:"#f1f5f9", fontSize:12, outline:"none", cursor:"pointer" }}>
              <option value="ALL">All Vendors</option>
              {vendorNames.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {mode === "dashboard" && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"7px 12px", color:"#f1f5f9", fontSize:12, outline:"none", width:140 }} />}
        </div>
      </div>

      {/* ── FLAGGED INCREASES ── */}
      {mode === "dashboard" && flagged.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ color:"#fca5a5", fontSize:13, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>🚩 Price Increases Detected <span style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"1px 8px", fontSize:11 }}>{flagged.length}</span></div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {flagged.map(e => (
              <div key={e.id} style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{e.name}</span>
                    {e.vendor && <span style={{ background:"#0f2040", border:"1px solid #1e3a5f", borderRadius:4, padding:"1px 6px", color:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }}>{e.vendor}</span>}
                  </div>
                  <div style={{ color:"#7f1d1d", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:3 }}>{e.unit}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#64748b", fontSize:10, fontFamily:"'DM Mono',monospace" }}>PREVIOUS</div>
                    <div style={{ color:"#94a3b8", fontSize:15, fontFamily:"'DM Mono',monospace", textDecoration:"line-through" }}>${e.previousPrice.toFixed(2)}</div>
                  </div>
                  <span style={{ color:"#475569", fontSize:14 }}>→</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#64748b", fontSize:10, fontFamily:"'DM Mono',monospace" }}>CURRENT</div>
                    <div style={{ color:"#fca5a5", fontSize:15, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>${e.currentPrice.toFixed(2)}</div>
                  </div>
                  <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>+{e.changePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {mode === "dashboard" && (
        <>
          {filteredTracked.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>💲</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No prices tracked yet</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Enter prices manually or upload an invoice to start tracking</div>
            </div>
          ) : (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 100px 100px 80px", background:"#080c14", padding:"8px 16px", gap:8 }}>
                {["Item", "Current", "Previous", "Change"].map(h => (
                  <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
                ))}
              </div>
              {filteredTracked.sort((a,b) => a.name.localeCompare(b.name)).map((e, idx) => (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:"2fr 100px 100px 80px", padding:"10px 16px", gap:8, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                  <div>
                    <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{e.name}</div>
                    <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{e.vendor}{e.vendor ? " · " : ""}{e.unit} · {e.totalEntries} entries</div>
                  </div>
                  <span style={{ color:"#f1f5f9", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>${e.currentPrice.toFixed(2)}</span>
                  <span style={{ color:"#64748b", fontSize:13, fontFamily:"'DM Mono',monospace" }}>{e.previousPrice !== null ? `$${e.previousPrice.toFixed(2)}` : "—"}</span>
                  {e.change != null ? (
                    <span style={{ background:e.change > 0 ? "#450a0a" : e.change < 0 ? "#052e16" : "transparent", border:`1px solid ${e.change > 0 ? "#7f1d1d" : e.change < 0 ? "#16a34a" : "#1e2d45"}`, color:e.change > 0 ? "#fca5a5" : e.change < 0 ? "#4ade80" : "#475569", borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
                      {e.change > 0 ? "+" : ""}{e.changePct}%
                    </span>
                  ) : <span style={{ color:"#334155", fontSize:11 }}>—</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MANUAL ENTRY ── */}
      {mode === "enter" && (
        <div>
          <div style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
            <span style={{ color:"#a5b4fc", fontSize:12 }}>Enter prices from your latest invoice. </span>
            <span style={{ color:"#64748b", fontSize:12 }}>Only fill in items that have a price — skip the rest.</span>
          </div>
          <div style={{ marginBottom:12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
              style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"9px 14px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden", maxHeight:500, overflowY:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 100px", background:"#080c14", padding:"8px 16px", gap:8, position:"sticky", top:0, zIndex:2 }}>
              {["Item", "Last Price", "New Price"].map(h => (
                <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
              ))}
            </div>
            {manualItems.map((item, idx) => {
              const hist = priceHistory[item.id];
              const lastPrice = hist?.length > 0 ? [...hist].sort((a,b) => new Date(b.date) - new Date(a.date))[0].price : null;
              return (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"2fr 80px 100px", padding:"8px 16px", gap:8, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                  <div>
                    <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{item.name}</div>
                    <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{item.order_unit}{item.vendor ? ` · ${item.vendor}` : ""}</div>
                  </div>
                  <span style={{ color:"#64748b", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{lastPrice !== null ? `$${lastPrice.toFixed(2)}` : "—"}</span>
                  <input type="number" step="0.01" min="0" value={manualPrices[item.id] || ""} onChange={e => updateManualPrice(item.id, e.target.value)}
                    placeholder="$0.00" style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:6, padding:"6px 8px", color:"#4ade80", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:600, outline:"none", textAlign:"right", width:"100%", boxSizing:"border-box" }} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:16, display:"flex", gap:10 }}>
            <button onClick={saveManualPrices}
              style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"10px 24px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              Save Prices
            </button>
            <button onClick={() => { setMode("dashboard"); setManualPrices({}); }}
              style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── UPLOAD INVOICE ── */}
      {mode === "upload" && parsedPrices.length === 0 && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer" }}
              onClick={() => photoRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
              <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display:"none" }} />
              <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
              <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600, marginBottom:4 }}>Photo of Invoice</div>
              <div style={{ color:"#475569", fontSize:12 }}>AI extracts item prices</div>
            </div>
            <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer" }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display:"none" }} />
              <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
              <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600, marginBottom:4 }}>Upload Price List</div>
              <div style={{ color:"#475569", fontSize:12 }}>CSV with item names & prices</div>
            </div>
          </div>
          {parsing && <div style={{ textAlign:"center", color:"#a5b4fc", fontSize:14, padding:20 }}>Analyzing invoice with AI...</div>}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13 }}>{parseError}</div>}
        </div>
      )}

      {/* ── MATCH & SAVE PARSED PRICES ── */}
      {parsedPrices.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{parsedPrices.length} prices extracted</div>
              <div style={{ color:"#475569", fontSize:12 }}>{parsedPrices.filter(p => p.matched).length} matched to inventory items — click to fix unmatched</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setParsedPrices([]); setMode("dashboard"); }} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 14px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => saveParsedPrices("invoice")} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Save {parsedPrices.filter(p => p.matched).length} Prices
              </button>
            </div>
          </div>
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden", maxHeight:500, overflowY:"auto" }}>
            {parsedPrices.map((p, idx) => {
              const matchedItem = p.matched ? allItems.find(i => i.id === p.matched) : null;
              return (
                <div key={p.id} style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:12, background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:idx>0?"1px solid #080c14":"none", flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ color:"#f1f5f9", fontSize:13 }}>{p.name}</div>
                    <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{p.unit || "—"}</div>
                  </div>
                  <span style={{ color:"#4ade80", fontSize:15, fontFamily:"'DM Mono',monospace", fontWeight:700, minWidth:70, textAlign:"right" }}>${Number(p.price).toFixed(2)}</span>
                  {matchedItem ? (
                    <span style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:6, padding:"3px 10px", color:"#4ade80", fontSize:11, fontFamily:"'DM Mono',monospace" }}>✓ {matchedItem.name}</span>
                  ) : (
                    <select onChange={e => { if (e.target.value) matchItem(idx, parseInt(e.target.value)); }}
                      style={{ background:"#080c14", border:"1px solid #7f1d1d", borderRadius:6, padding:"4px 8px", color:"#fca5a5", fontSize:11, outline:"none", cursor:"pointer", maxWidth:160 }}>
                      <option value="">Match to item...</option>
                      {allItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
