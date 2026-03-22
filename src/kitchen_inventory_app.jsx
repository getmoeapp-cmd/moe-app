import React, { useState, useEffect, useCallback, useRef } from "react";

const DEFAULT_INVENTORY = [
  { section: "🌾  DRY GOODS", items: [
    { id: 5,  name: "Flour",                          order_unit: "Unit",    upu: 1,   supplier: "Anacapri", max_stock: 17,   reorder: 4   },
    { id: 6,  name: "Yeast",                          order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
  ]},
  { section: "🥦  PRODUCE", items: [
    { id: 8,  name: "Basil - Fresh",                  order_unit: "Each",    upu: 1,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 9,  name: "Broccoli Crowns",                order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 10, name: "Cherry Tomatoes",                order_unit: "Unit",    upu: 1,   supplier: "Market",   max_stock: 4,    reorder: 1   },
    { id: 11, name: "Eggplant",                       order_unit: "Each",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 12, name: "Garlic - Peeled",                order_unit: "Each",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 13, name: "Jalapenos",                      order_unit: "Lbs",     upu: 1,   supplier: "Market",   max_stock: 4,    reorder: 1   },
    { id: 14, name: "Lemons",                         order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 15, name: "Mushrooms",                      order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 16, name: "Onions - Red",                   order_unit: "Bag",     upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 17, name: "Onions - Yellow",                order_unit: "Bag",     upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 18, name: "Parsley - Fresh",                order_unit: "Unit",    upu: 1,   supplier: "Market",   max_stock: 4,    reorder: 1   },
    { id: 19, name: "Potatoes",                       order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 20, name: "Romaine Lettuce",                order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 21, name: "Red Peppers",                    order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 22, name: "Green Peppers",                  order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 23, name: "Carrots",                        order_unit: "Bag",     upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 24, name: "Tomatoes",                       order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "🧀  DAIRY", items: [
    { id: 26, name: "American Cheese",                order_unit: "Unit",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 27, name: "Butter Blocks",                  order_unit: "Case",    upu: 36,  supplier: "Anacapri", max_stock: 36,   reorder: 6   },
    { id: 28, name: "Butter Cups",                    order_unit: "Case",    upu: 100, supplier: "Anacapri", max_stock: 200,  reorder: 50  },
    { id: 29, name: "Eggs 15 Doz",                    order_unit: "Case",    upu: 2,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 30, name: "Heavy Cream",                    order_unit: "Case",    upu: 12,  supplier: "Anacapri", max_stock: 12,   reorder: 4   },
    { id: 31, name: "Mozzarella - Curd",              order_unit: "Unit",    upu: 1,   supplier: "Anacapri", max_stock: 5,    reorder: 2   },
    { id: 32, name: "Mozzarella Grande",              order_unit: "Case",    upu: 2,   supplier: "Anacapri", max_stock: 10,   reorder: 3   },
    { id: 33, name: "Mozzarella Polly-O",             order_unit: "Case",    upu: 2,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 34, name: "Pecorino Romano - Wheel",        order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 35, name: "Ricotta Cheese Grande",          order_unit: "Case",    upu: 4,   supplier: "Anacapri", max_stock: 8,    reorder: 2   },
    { id: 36, name: "Velveeta Cheese",                order_unit: "Unit",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
    { id: 37, name: "Whole Milk",                     order_unit: "Case",    upu: 4,   supplier: "Anacapri", max_stock: 8,    reorder: 2   },
  ]},
  { section: "🥩  FRESH MEAT", items: [
    { id: 39, name: "Chicken Breast - Chicks Choice", order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 10,   reorder: 3   },
    { id: 40, name: "Chicken Wings - Party",          order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 4,    reorder: 1   },
    { id: 41, name: "Ham",                            order_unit: "Case",    upu: 1,   supplier: "Anacapri", max_stock: 2,    reorder: 1   },
  ]},
  { section: "🫙  OILS & CANNED GOODS", items: [
    { id: 43, name: "Liquid Clear Shortening",        order_unit: "Unit",    upu: 1,   supplier: "",         max_stock: 3,    reorder: 1   },
    { id: 44, name: "Soybean Oil",                    order_unit: "Unit",    upu: 1,   supplier: "",         max_stock: 3,    reorder: 1   },
    { id: 45, name: "711 (Tomato Sauce)",              order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 24,   reorder: 6   },
    { id: 46, name: "Saporito",                       order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 24,   reorder: 6   },
    { id: 47, name: "Valoroso",                       order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 24,   reorder: 6   },
    { id: 48, name: "Pineapple",                      order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 49, name: "Black Sliced Olives",            order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 50, name: "San Marzano Tomatoes",           order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
  ]},
  { section: "🍝  PASTA & RICE", items: [
    { id: 52, name: "Penne",                          order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 40,   reorder: 10  },
    { id: 53, name: "Spaghetti",                      order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 54, name: "Linguine",                       order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 55, name: "Fettuccine",                     order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 56, name: "Capellini",                      order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 57, name: "Rigatoni",                       order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 58, name: "Whole Wheat Pasta",              order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 59, name: "Jumbo Shells",                   order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 60, name: "Lasagna",                        order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 20,   reorder: 5   },
    { id: 61, name: "Carolina Rice Extra Long Grain", order_unit: "Bag",     upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 1", items: [
    { id: 63, name: "Chicken Nuggets",                order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 64, name: "Chicken Tenders",                order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 65, name: "Boneless Wings",                 order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 66, name: "French Fries",                   order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 67, name: "Sweet Potato Fries",             order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 68, name: "Burgers",                        order_unit: "Case",    upu: 20,  supplier: "",         max_stock: 60,   reorder: 20  },
    { id: 69, name: "Wraps",                          order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 70, name: "Zucchini Sticks",                order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 71, name: "Cheese Ravioli",                 order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 72, name: "Mozzarella Sticks",              order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
  ]},
  { section: "❄️  FREEZER 2", items: [
    { id: 74, name: "Chopped Spinach",                order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 75, name: "Bacon Bits",                     order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 76, name: "Turkey",                         order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 77, name: "Pepperoni",                      order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 78, name: "Ribeye Steak",                   order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 79, name: "Veal",                           order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 80, name: "Chopped Meat",                   order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 81, name: "Sausage",                        order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 82, name: "Calamari",                       order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 83, name: "Peeled Shrimp",                  order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 84, name: "Baby Clams",                     order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 85, name: "Mussels",                        order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 86, name: "Tilapia",                        order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
  ]},
  { section: "🗃️  RACK 1", items: [
    { id: 88, name: "Salt",                           order_unit: "Bag",     upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 89, name: "Sugar",                          order_unit: "Bag",     upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 90, name: "Bread Crumbs",                   order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 91, name: "Panko Bread Crumbs",             order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 92, name: "Napkins",                        order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 93, name: "Paper Plates",                   order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
  ]},
  { section: "🗄️  SHELF 1", items: [
    { id: 95,  name: "Powdered Sugar",                order_unit: "Bag",     upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 96,  name: "Cannoli Shells",                order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 97,  name: "Tie Bags",                      order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 98,  name: "Ziplock Bags Gallon",           order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 99,  name: "Straws",                        order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 100, name: "Forks",                         order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 101, name: "Knives",                        order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 102, name: "Spoons",                        order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 103, name: "Pizza Stack",                   order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 104, name: "Gloves L",                      order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 105, name: "Gloves XL",                     order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 106, name: "18in Clear Film",               order_unit: "Roll",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 107, name: "24in Clear Film",               order_unit: "Roll",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 108, name: "12in Aluminum Foil",            order_unit: "Roll",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 109, name: "Plastic Bags",                  order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 110, name: "Junior Wax",                    order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 111, name: "16oz Deli Container",           order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 112, name: "5¾x6x3 Container",              order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 113, name: "5¼x5⅜x2⅝ Container",           order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
  ]},
  { section: "🗄️  SHELF 2", items: [
    { id: 115, name: "8in Dome Lids",                 order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 116, name: "8in Aluminum Dish",             order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 117, name: "7in Dome Lids",                 order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 118, name: "7in Aluminum Dish",             order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 119, name: "20Lb Brown Bags",               order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 120, name: "12Lb Brown Bags",               order_unit: "Case",    upu: 500, supplier: "",         max_stock: 1000, reorder: 200 },
    { id: 121, name: "Hero Containers",               order_unit: "Case",    upu: 200, supplier: "",         max_stock: 400,  reorder: 100 },
    { id: 122, name: "4oz Souffle Lids",              order_unit: "Case",    upu: 200, supplier: "",         max_stock: 400,  reorder: 100 },
    { id: 123, name: "4oz Souffle Cups",              order_unit: "Case",    upu: 200, supplier: "",         max_stock: 400,  reorder: 100 },
    { id: 124, name: "2oz Souffle Lids",              order_unit: "Case",    upu: 200, supplier: "",         max_stock: 400,  reorder: 100 },
    { id: 125, name: "2oz Souffle Cups",              order_unit: "Case",    upu: 200, supplier: "",         max_stock: 400,  reorder: 100 },
    { id: 126, name: "Heinz Ketchup",                 order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 127, name: "Mayo",                          order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 128, name: "Honey Mustard Dressing",        order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 129, name: "Blue Cheese Dressing",          order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 130, name: "Ranch Dressing",                order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 131, name: "Vinegar",                       order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 132, name: "Italian Dressing",              order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 133, name: "Balsamic Dressing",             order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 134, name: "Olive Oil",                     order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 6,    reorder: 2   },
    { id: 135, name: "White Wine",                    order_unit: "Case",    upu: 12,  supplier: "",         max_stock: 12,   reorder: 4   },
    { id: 136, name: "Vodka",                         order_unit: "Case",    upu: 12,  supplier: "",         max_stock: 12,   reorder: 4   },
    { id: 137, name: "Marsala Wine",                  order_unit: "Case",    upu: 12,  supplier: "",         max_stock: 12,   reorder: 4   },
  ]},
  { section: "🥫  CONDIMENTS & SAUCES", items: [
    { id: 139, name: "Mango",                         order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 140, name: "Garlic Parm",                   order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 141, name: "Franks Red Hot",                order_unit: "Gallon",  upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 142, name: "BBQ Sauce",                     order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 143, name: "Honey BBQ Sauce",               order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 144, name: "Taco Sauce",                    order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 145, name: "Tarter Sauce",                  order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 146, name: "Lemon Juice",                   order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
  ]},
  { section: "📦  BOXES", items: [
    { id: 148, name: "18in Boxes",                    order_unit: "Bundle",  upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 149, name: "16in Boxes",                    order_unit: "Bundle",  upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 150, name: "14in Boxes",                    order_unit: "Bundle",  upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 151, name: "12in Boxes",                    order_unit: "Bundle",  upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 152, name: "10in Boxes",                    order_unit: "Bundle",  upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 153, name: "Tommys Paper Cups",             order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
  ]},
  { section: "🛍️  DISPOSABLES & PACKAGING", items: [
    { id: 155, name: "Full Size Medium Trays",        order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 156, name: "Half Size Medium Trays",        order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 157, name: "Full Size Deep Trays",          order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 158, name: "Half Size Deep Trays",          order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 50,   reorder: 15  },
    { id: 159, name: "Full Size Lids",                order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 160, name: "Half Size Lids",                order_unit: "Case",    upu: 50,  supplier: "",         max_stock: 100,  reorder: 25  },
    { id: 161, name: "Masking Tape Roll",             order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 162, name: "Clear Bags",                    order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
    { id: 163, name: "Black Bags",                    order_unit: "Case",    upu: 100, supplier: "",         max_stock: 200,  reorder: 50  },
  ]},
  { section: "🧹  CLEANING SUPPLIES", items: [
    { id: 166, name: "Bleach",                        order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 167, name: "Pine Cleaner",                  order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 168, name: "Oven Cleaner",                  order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 169, name: "Glass Cleaner",                 order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 170, name: "Joy Dish Soap",                 order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 171, name: "Steel Sponge",                  order_unit: "Case",    upu: 12,  supplier: "",         max_stock: 24,   reorder: 6   },
    { id: 172, name: "Broom Head",                    order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 173, name: "Mop Head",                      order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 174, name: "Toilet Bowl Gel",               order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 175, name: "Bathroom Bleach Foamer Spray",  order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 176, name: "Scrubbing Bubbles",             order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 177, name: "Lysol Spray",                   order_unit: "Case",    upu: 6,   supplier: "",         max_stock: 12,   reorder: 3   },
    { id: 178, name: "Brillo Pads",                   order_unit: "Case",    upu: 12,  supplier: "",         max_stock: 24,   reorder: 6   },
  ]},
  { section: "❄️  BOX ROOM FREEZER", items: [
    { id: 180, name: "Cheesecake",                    order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 181, name: "Tres Leche",                    order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 182, name: "Chocolate Moose",               order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
    { id: 183, name: "Red Velvet",                    order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 184, name: "Cannoli Cream",                 order_unit: "Each",    upu: 1,   supplier: "",         max_stock: 4,    reorder: 1   },
    { id: 185, name: "Tiramisu",                      order_unit: "Case",    upu: 1,   supplier: "",         max_stock: 2,    reorder: 1   },
  ]},
];

const USERS = {
  "owner@kitchen.com":    { password: "owner123",    role: "owner",    name: "Owner",    group: "demo" },
  "employee@kitchen.com": { password: "employee123", role: "employee", name: "Employee", group: "demo" },
  "ronnie@kitchen.com":   { password: "ronnie123",   role: "owner",    name: "Ronnie",   group: "tommys" },
  "roberto@kitchen.com":  { password: "roberto123",  role: "employee", name: "Roberto",  group: "tommys" },
};

// Blank starter inventory for new groups (one section, one example item)
const BLANK_INVENTORY = [
  { section: "📦  EXAMPLE SECTION", items: [
    { id: 1, name: "Example Item", order_unit: "Case", upu: 1, supplier: "", max_stock: 10, reorder: 2 },
  ]},
];

const storageKey = (group, name) => `moe_${group}_${name}_v1`;
const STOCK_KEY    = (g) => storageKey(g, "stock");
const ITEMDATA_KEY = (g) => storageKey(g, "itemdata");
const SECTION_KEY  = (g) => storageKey(g, "sections");
const ADDED_KEY    = (g) => storageKey(g, "added");
const ORDERS_KEY   = (g) => storageKey(g, "orders");
const SETTINGS_KEY = (g) => storageKey(g, "settings");
const USAGE_KEY    = (g) => storageKey(g, "usage");

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const SUPABASE_URL   = "https://fsvlxosbbevzyvegbqry.supabase.co";
const SUPABASE_ANON  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdmx4b3NiYmV2enl2ZWdicXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NzQ2MjgsImV4cCI6MjA4OTA1MDYyOH0.AcnnB4QecNHEu3-N_VS6aPHrpt9kq464arjNc2DNugU";
const SUPABASE_READY = true;

// Supabase JS client loaded from CDN
let _sb = null;
const getSB = () => {
  if (_sb) return _sb;
  if (window.supabase) {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _sb;
};

// Read a value (returns parsed JS object or null)
const sbGet = async (grp, key) => {
  const sb = getSB();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("moe_data")
      .select("data_value")
      .eq("group_id", grp)
      .eq("data_key", key)
      .single();
    if (error || !data) return null;
    return JSON.parse(data.data_value);
  } catch { return null; }
};

// Write a value (upsert)
const sbSet = async (grp, key, value) => {
  const sb = getSB();
  if (!sb) return;
  try {
    await sb.from("moe_data").upsert(
      { group_id: grp, data_key: key, data_value: JSON.stringify(value) },
      { onConflict: "group_id,data_key" }
    );
  } catch {}
};


// ─── GLOBAL KEY-VALUE STORE (for vendor connections, invites etc.) ───────────
const GLOBAL_GRP = "__moe_global__";
const globalGet = (key) => sbGet(GLOBAL_GRP, key);
const globalSet = (key, val) => sbSet(GLOBAL_GRP, key, val);

// ─── DATE UTILS ───────────────────────────────────────────────────────────────
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const getWeekNumber = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

const getWeekKey = (d = new Date()) => `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2,"0")}`;

const getWeekdayDate = (d, targetDay) => {
  const result = new Date(d);
  result.setDate(d.getDate() + (targetDay - d.getDay()));
  return result;
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" });

const DateWeekBadge = ({ orderDay = 3, style = {} }) => {
  const orderDate = getWeekdayDate(new Date(), orderDay);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, ...style }}>
      <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace" }}>Order:</span>
      <span style={{ color:"#94a3b8", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
        {fmtDate(orderDate)}
      </span>
      <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:6, padding:"2px 8px", color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
        WK {getWeekNumber()}
      </span>
    </div>
  );
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const calcOrderQty = (item, stock) => {
  const s = stock ?? 0;
  if (s >= item.reorder) return 0;
  return Math.ceil(Math.max(0, item.max_stock - s) / Math.max(1, item.upu));
};

const getStatus = (item, stock) => {
  const s = stock ?? 0;
  if (s >= item.max_stock) return { label:"FULL",      color:"#16a34a", bg:"#dcfce7" };
  if (s >= item.reorder)   return { label:"OK",        color:"#15803d", bg:"#f0fdf4" };
  if (s > 0)               return { label:"ORDER NOW", color:"#b91c1c", bg:"#fff1f2" };
  return                          { label:"EMPTY",     color:"#7f1d1d", bg:"#fef2f2" };
};

const applyOverridesAndAdded = (defaults, overrides, sectionOverrides, addedItems = {}) =>
  defaults.map(sec => ({
    ...sec,
    section: (sectionOverrides && sectionOverrides[sec.section]) || sec.section,
    items: [
      ...sec.items
        .map(item => (overrides && overrides[item.id]) ? { ...item, ...overrides[item.id] } : item)
        .filter(item => !item._hidden),
      ...((addedItems && addedItems[sec.section]) || []),
    ],
  }));

// ─── PDF HELPER ───────────────────────────────────────────────────────────────
const printSupplierPDF = ({ supplier, items, weekKey, orderDate, receiveDate }) => {
  const win = window.open("", "_blank");
  const rows = items.map(item =>
    `<tr><td>${item.name}</td><td style="text-align:center;font-weight:700">${item.qty} ${item.order_unit}</td></tr>`
  ).join("");
  win.document.write(`<html><head><title>${supplier} — ${weekKey}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:600px;margin:0 auto}
      h1{font-size:20px;margin:0 0 4px}
      .sup{font-size:26px;font-weight:800;color:#111;margin:0 0 6px}
      .meta{color:#666;font-size:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#1e293b;color:#fff;padding:10px 14px;text-align:left}
      th:last-child{text-align:center}
      td{padding:10px 14px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#f9fafb}
      .footer{margin-top:20px;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}
      @media print{body{padding:16px}}
    </style></head><body>
    <div class="sup">📦 ${supplier}</div>
    <h1>Kitchen Order — ${weekKey}</h1>
    <div class="meta">Order: ${orderDate} &nbsp;·&nbsp; Receive: ${receiveDate} &nbsp;·&nbsp; ${items.length} item${items.length!==1?"s":""}</div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty to Order</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Kitchen Inventory System &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}</div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
  win.document.close();
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]                           = useState(null);
  const [stock, setStock]                         = useState({});
  const [overrides, setOverrides]                 = useState({});
  const [sectionOverrides, setSectionOverrides]   = useState({});
  const [addedItems, setAddedItems]               = useState({});
  const [orders, setOrders]                       = useState({});
  const [settings, setSettings]                   = useState({ orderDay: 3, vendors: [] });
  const [usageLog, setUsageLog]                   = useState({});
  const [inventory, setInventory]                 = useState(DEFAULT_INVENTORY);
  const [view, setView]                           = useState("inventory");
  const [saveFlash, setSaveFlash]                 = useState("");
  const [loginError, setLoginError]               = useState("");
  const [group, setGroup]                         = useState("demo");
  const [lastSync, setLastSync]                   = useState(null);
  const [syncError, setSyncError]                 = useState(false);
  const [sidebarOpen, setSidebarOpen]             = useState(false);
  const [connections, setConnections]             = useState([]);

  const flash = () => { setSaveFlash("✓ Saved"); setTimeout(() => setSaveFlash(""), 2000); };

  // Load connected vendors for this merchant — only when logged in
  useEffect(() => {
    if (!user) return;
    const loadConnections = async () => {
      const all = await globalGet("connections") || {};
      setConnections(
        Object.entries(all)
          .filter(([, c]) => c.merchantEmail === user.email && c.status === "active")
          .map(([id, c]) => ({ id, ...c }))
      );
    };
    loadConnections();
    const iv = setInterval(loadConnections, 30000);
    return () => clearInterval(iv);
  }, [user]);

  // Submit order lines to a connected vendor portal
  const submitOrderToVendor = async (vendorId, vendorName, orderLines, weekKey) => {
    if (!user) return;
    const vOrders = await globalGet(`vendor_orders_${vendorId}`) || [];
    vOrders.push({
      id: `vord_${Date.now()}`,
      merchantId: user.authId || user.email,
      merchantName: user.businessName || user.name || group,
      vendorId, vendorName, weekKey,
      lines: orderLines,
      status: "pending",
      submittedAt: new Date().toISOString(),
    });
    await globalSet(`vendor_orders_${vendorId}`, vOrders);
  };

  useEffect(() => {
    if (!group || !user) return;
    const load = async () => {
      // Helper: try Supabase first, fall back to local storage
      const loadKey = async (sbKey, localKeyFn, fallback) => {
        const sbVal = await sbGet(group, sbKey);
        if (sbVal !== null) {
          // Supabase has data — cache locally and use it
          try { localStorage.setItem(localKeyFn(group), JSON.stringify(sbVal)); } catch(e) {}
          return sbVal;
        }
        // Supabase is empty for this key — check local storage
        try {
          const raw = localStorage.getItem(localKeyFn(group));
          if (raw) {
            const localVal = JSON.parse(raw);
            // Push local data up to Supabase so other devices can see it
            const isEmpty = !localVal || (typeof localVal === "object" && Object.keys(localVal).length === 0);
            if (!isEmpty) sbSet(group, sbKey, localVal);
            return localVal;
          }
        } catch {}
        return fallback;
      };

      const st    = await loadKey("stock",    STOCK_KEY,    {});
      const ov    = await loadKey("itemdata", ITEMDATA_KEY, {});
      const sv    = await loadKey("sections", SECTION_KEY,  {});
      const ai    = await loadKey("added",    ADDED_KEY,    {});
      const ord   = await loadKey("orders",   ORDERS_KEY,   {});
      const sett  = await loadKey("settings", SETTINGS_KEY, { orderDay: 3, vendors: [] });
      const usage = await loadKey("usage",    USAGE_KEY,    {});

      setStock(st); setOverrides(ov); setSectionOverrides(sv); setAddedItems(ai);
      setOrders(ord); setSettings(sett); setUsageLog(usage);
      const baseInv = (group === "tommys" || group === "demo") ? DEFAULT_INVENTORY : BLANK_INVENTORY;
      const inv = applyOverridesAndAdded(baseInv, ov, sv, ai);
      setInventory(inv);
      autoGenerateOrder(getWeekKey(), ord, inv, st, sett);
      // Check if previous week's order needs to be finalized
      // Any unsaved order from a past week gets auto-archived
      const currentWk = getWeekKey();
      const pastUnsaved = Object.entries(ord).filter(([wk, o]) => wk !== currentWk && !o.saved);
      if (pastUnsaved.length > 0) {
        const archived = { ...ord };
        pastUnsaved.forEach(([wk, o]) => {
          archived[wk] = { ...o, saved: true, autoArchived: true };
        });
        setOrders(archived);
        sbSet(group, "orders", archived);
        try { localStorage.setItem(ORDERS_KEY(group), JSON.stringify(archived)); } catch(e) {}
      }
      // Only push to Supabase if the value came from localStorage (not Supabase)
      // This prevents a fresh device from overwriting real data with empty defaults
      // sbGet returns null if Supabase had nothing — that's when we push local data up
      // We never overwrite existing Supabase data on load

      // Auto-reset stock for vendors whose order day was yesterday (end of day reset)
      if (sett.vendors && sett.vendors.length > 0) {
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const yesterdayDay = yesterday.getDay();
        const lastResetKey = `last_reset_${yesterdayDay}`;
        const lastResetDate = localStorage.getItem(lastResetKey);
        const todayStr = today.toISOString().split("T")[0];
        if (lastResetDate !== todayStr) {
          const vendorsToReset = sett.vendors.filter(v => v.autoReset && v.orderDay === yesterdayDay);
          if (vendorsToReset.length > 0) {
            const resetNames = new Set(vendorsToReset.map(v => v.name.toLowerCase().trim()));
            // Build new stock with only those vendor's items zeroed out
            const allItems = DEFAULT_INVENTORY.flatMap(s => s.items);
            const newSt = { ...st };
            allItems.forEach(item => {
              const sup = (item.supplier || "").toLowerCase().trim();
              if (resetNames.has(sup)) newSt[item.id] = 0;
            });
            if (JSON.stringify(newSt) !== JSON.stringify(st)) {
              setStock(newSt);
              try { localStorage.setItem(STOCK_KEY(group), JSON.stringify(newSt)); } catch(e) {}
              sbSet(group, "stock", newSt);
            }
            localStorage.setItem(lastResetKey, todayStr);
          }
        }
      }
      // Auto-archive vendor orders the day after their order day
      // e.g. Anacapri orders Tuesday → Wednesday morning it moves to history
      if (sett.vendors && sett.vendors.length > 0) {
        const now = new Date();
        const todayDay = now.getDay(); // 0=Sun, 1=Mon...
        let ordersChanged = false;
        const newOrd = { ...ord };
        sett.vendors.forEach(vendor => {
          if (!vendor.name || !vendor.orderDay === undefined) return;
          // The day AFTER the order day is when we archive
          const archiveDay = (vendor.orderDay + 1) % 7;
          if (todayDay !== archiveDay) return;
          const archiveKey = `archived_${vendor.name}_${now.toISOString().split("T")[0]}`;
          if (localStorage.getItem(archiveKey)) return; // already archived today
          // Find the most recent unsaved/saved order for this vendor's items
          Object.keys(newOrd).forEach(wk => {
            const o = newOrd[wk];
            if (!o || o._archived || !o.lines) return;
            // Check if this order contains this vendor's items
            const hasVendorItems = (o.lines || []).some(l =>
              (l.supplier || "").toLowerCase().trim() === vendor.name.toLowerCase().trim()
            );
            if (!hasVendorItems) return;
            // Archive it
            newOrd[wk] = { ...o, _archived: true, _archivedAt: now.toISOString(), _archivedVendor: vendor.name };
            ordersChanged = true;
          });
          localStorage.setItem(archiveKey, "1");
        });
        if (ordersChanged) {
          setOrders(newOrd);
          sbSet(group, "orders", newOrd);
          try { localStorage.setItem(ORDERS_KEY(group), JSON.stringify(newOrd)); } catch(e) {}
        }
      }
    };
    load();
  }, [group]);

  // ── Real-time sync ──────────────────────────────────────────────────────────
  // Employees poll every 8 seconds. Owners never auto-poll (they push, not pull).
  // Manual ↻ Sync button works for everyone.
  const lastLocalEdit = React.useRef(0);
  const markLocalEdit = () => { lastLocalEdit.current = Date.now(); };

  // ── Manual sync — fetch all keys from Supabase right now ──────────────────
  const pullFromSupabase = React.useCallback(async () => {
    // Never overwrite local state if we just made a local edit
    if (Date.now() - lastLocalEdit.current < 8000) return;
    const sb = getSB();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from("moe_data")
        .select("data_key,data_value")
        .eq("group_id", group);
      if (error || !Array.isArray(data)) { setSyncError(true); return; }
      const rd = {};
      data.forEach(r => { try { rd[r.data_key] = JSON.parse(r.data_value); } catch {} });
      const baseInv = (group==="tommys"||group==="demo") ? DEFAULT_INVENTORY : BLANK_INVENTORY;
      if (rd.stock    !== undefined) setStock(rd.stock);
      if (rd.itemdata !== undefined) setOverrides(rd.itemdata);
      if (rd.sections !== undefined) setSectionOverrides(rd.sections);
      if (rd.added    !== undefined) setAddedItems(rd.added);
      if (rd.settings !== undefined) setSettings(rd.settings);
      if (rd.orders   !== undefined) setOrders(rd.orders);
      setInventory(applyOverridesAndAdded(baseInv, rd.itemdata||{}, rd.sections||{}, rd.added||{}));
      setLastSync(new Date());
      setSyncError(false);
    } catch { setSyncError(true); }
  }, [group]);

  // ── Supabase Real-Time subscription ────────────────────────────────────────
  // Listens for INSERT/UPDATE on moe_data for this group
  // When owner saves → Supabase fires → all other devices update instantly
  useEffect(() => {
    if (!group) return;
    const sb = getSB();
    if (!sb) return;

    const channel = sb
      .channel(`moe_${group}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "moe_data",
        filter: `group_id=eq.${group}`,
      }, (payload) => {
        // A row changed — apply just that key to local state
        try {
          const { data_key, data_value } = payload.new;
          const value = JSON.parse(data_value);
          const baseInv = (group==="tommys"||group==="demo") ? DEFAULT_INVENTORY : BLANK_INVENTORY;
          switch(data_key) {
            case "stock":
              // Skip realtime echo if we just wrote stock ourselves (within 5s)
              if (Date.now() - lastLocalEdit.current < 10000) break;
              setStock(prev => {
                if (JSON.stringify(prev) === JSON.stringify(value)) return prev;
                return value;
              });
              break;
            case "itemdata":
              setOverrides(prev => {
                if (JSON.stringify(prev) === JSON.stringify(value)) return prev;
                setInventory(inv => applyOverridesAndAdded(baseInv, value, inv.__sv||{}, inv.__ai||{}));
                return value;
              });
              break;
            case "sections":
              setSectionOverrides(prev => {
                if (JSON.stringify(prev) === JSON.stringify(value)) return prev;
                return value;
              });
              break;
            case "added":
              setAddedItems(prev => {
                if (JSON.stringify(prev) === JSON.stringify(value)) return prev;
                return value;
              });
              break;
            case "settings": setSettings(value); break;
            case "orders":
              // Skip realtime echo if we just wrote orders ourselves (within 5s)
              if (Date.now() - lastLocalEdit.current < 10000) break;
              setOrders(value);
              break;
            default: break;
          }
          // Rebuild inventory after any structural change
          if (["itemdata","sections","added"].includes(data_key)) {
            setOverrides(ov => {
              setAddedItems(ai => {
                setSectionOverrides(sv => {
                  setInventory(applyOverridesAndAdded(baseInv, ov, sv, ai));
                  return sv;
                });
                return ai;
              });
              return ov;
            });
          }
          setLastSync(new Date());
          setSyncError(false);
        } catch {}
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncError(false);
        if (status === "CLOSED" || status === "CHANNEL_ERROR") setSyncError(true);
      });

    return () => { sb.removeChannel(channel); };
  }, [group]);

  // Watch for week change while app is open — start fresh order for new week
  useEffect(() => {
    if (!group || !inventory.length) return;
    const checkWeek = () => {
      const currentWk = getWeekKey();
      setOrders(prev => {
        // Auto-archive any past unsaved orders
        let changed = false;
        const updated = { ...prev };
        Object.entries(prev).forEach(([wk, o]) => {
          if (!o) return;  // skip null reserved slots
          if (wk !== currentWk && !o.saved) {
            updated[wk] = { ...o, saved: true, autoArchived: true };
            changed = true;
          }
        });
        // Generate new order for current week if missing
        if (!prev[currentWk]) {
          const today = new Date();
          const orderDate = getWeekdayDate(today, settings.orderDay);
          const receiveDate = new Date(orderDate);
          receiveDate.setDate(orderDate.getDate() + 1);
          const lines = inventory.flatMap(s => s.items.map(item => ({
            id: item.id, name: item.name, order_unit: item.order_unit, supplier: item.supplier,
            section: s.section, qty: calcOrderQty(item, stock[item.id] ?? 0),
          })));
          updated[currentWk] = {
            weekKey: currentWk,
            orderDate: orderDate.toISOString().split("T")[0],
            receiveDate: receiveDate.toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
            lines, saved: false,
          };
          changed = true;
        }
        if (changed) {
          sbSet(group, "orders", updated);
          try { localStorage.setItem(ORDERS_KEY(group), JSON.stringify(updated)); } catch(e) {}
          return updated;
        }
        return prev;
      });
    };
    checkWeek();
    // Check every hour in case the app is left open across midnight
    const interval = setInterval(checkWeek, 3600000);
    return () => clearInterval(interval);
  }, [group, inventory.length, settings.orderDay]);

  // Write to both local storage and Supabase
  const dualSet = useCallback((sbKey, localKeyFn, value) => {
    lastLocalEdit.current = Date.now();
    try { localStorage.setItem(localKeyFn(group), JSON.stringify(value)); } catch(e) {}
    sbSet(group, sbKey, value);
  }, [group]);

  // Force push all current state to Supabase — called on login and on demand
  const syncAllToSupabase = useCallback((st, ov, sv, ai, ord, sett, usage) => {
    if (!SUPABASE_READY) return;
    const g = group;
    sbSet(g, "stock",    st    || {});
    sbSet(g, "itemdata", ov    || {});
    sbSet(g, "sections", sv    || {});
    sbSet(g, "added",    ai    || {});
    sbSet(g, "orders",   ord   || {});
    sbSet(g, "settings", sett  || {});
    sbSet(g, "usage",    usage || {});
  }, [group]);

  const saveStock = useCallback(async (newStock) => {
    setStock(newStock);
    dualSet("stock", STOCK_KEY, newStock);
    flash();
    // Regenerate unsaved order with updated stock
    setOrders(prev => {
      const wk = getWeekKey();
      if (prev[wk]?.saved) return prev; // don't touch saved orders
      return prev; // OrderView recalculates live from stock — no need to update stored lines
    });
  }, [dualSet]);

  const saveItemField = useCallback(async (id, field, rawVal) => {
    const numFields = ["upu", "max_stock", "reorder"];
    const val = numFields.includes(field) ? (parseInt(rawVal) || 0) : rawVal;
    const isAdded = Object.values(addedItems).flat().some(i => i.id === id);
    if (isAdded) {
      setAddedItems(prev => {
        const newAi = {};
        Object.entries(prev).forEach(([sec, items]) => {
          newAi[sec] = items.map(i => i.id === id ? { ...i, [field]: val } : i);
        });
        dualSet("added", ADDED_KEY, newAi);
        const baseInv2 = (group==='tommys'||group==='demo') ? DEFAULT_INVENTORY : BLANK_INVENTORY;
        setInventory(applyOverridesAndAdded(baseInv2, overrides, sectionOverrides, newAi));
        return newAi;
      });
    } else {
      setOverrides(prev => {
        const newOv = { ...prev, [id]: { ...(prev[id] || {}), [field]: val } };
        setInventory(applyOverridesAndAdded(DEFAULT_INVENTORY, newOv, sectionOverrides, addedItems));
        dualSet("itemdata", ITEMDATA_KEY, newOv);
        return newOv;
      });
    }
    flash();
  }, [addedItems, overrides, sectionOverrides, group, dualSet]);

  // Add a brand new custom section
  const addSection = useCallback((sectionName) => {
    const key = sectionName.trim();
    if (!key) return;
    // Add an empty placeholder item so section is visible
    const newId = Date.now();
    const newItem = { id: newId, name: "New Item", order_unit: "Case", upu: 1, supplier: "", max_stock: 1, reorder: 1, _added: true };
    setAddedItems(prev => {
      const newAi = { ...prev, [key]: [...(prev[key] || []), newItem] };
      dualSet("added", ADDED_KEY, newAi);
      const baseInv = (group==='tommys'||group==='demo') ? DEFAULT_INVENTORY : BLANK_INVENTORY;
      setInventory(applyOverridesAndAdded(baseInv, overrides, sectionOverrides, newAi));
      return newAi;
    });
    flash();
  }, [overrides, sectionOverrides, group, dualSet]);

  // Delete an entire section (hides default sections, removes added sections)
  const deleteSection = useCallback((sectionKey) => {
    // Remove all added items in this section
    setAddedItems(prev => {
      const newAi = { ...prev };
      delete newAi[sectionKey];
      dualSet("added", ADDED_KEY, newAi);
      // Also hide all default items in this section via overrides
      setOverrides(prevOv => {
        const baseInv = (group==='tommys'||group==='demo') ? DEFAULT_INVENTORY : BLANK_INVENTORY;
        const sec = baseInv.find(s => s.section === sectionKey || (sectionOverrides[s.section] === sectionKey));
        let newOv = { ...prevOv };
        if (sec) {
          sec.items.forEach(item => {
            newOv[item.id] = { ...(newOv[item.id] || {}), _hidden: true };
          });
        }
        dualSet("itemdata", ITEMDATA_KEY, newOv);
        const inv = applyOverridesAndAdded(baseInv, newOv, sectionOverrides, newAi);
        setInventory(inv);
        return newOv;
      });
      return newAi;
    });
    flash();
  }, [overrides, sectionOverrides, group, dualSet]);

  const saveSectionName = useCallback(async (originalName, newName) => {
    if (!newName.trim() || newName === originalName) return;
    setSectionOverrides(prev => {
      const newSv = { ...prev, [originalName]: newName.trim() };
      setInventory(applyOverridesAndAdded(DEFAULT_INVENTORY, overrides, newSv, addedItems));
      dualSet("sections", SECTION_KEY, newSv);
      return newSv;
    });
    flash();
  }, [overrides, addedItems]);

  const addItem = useCallback((sectionKey) => {
    const newId = Date.now();
    const newItem = { id: newId, name: "New Item", order_unit: "Case", upu: 1, supplier: "", max_stock: 1, reorder: 1, _added: true };
    setAddedItems(prev => {
      const newAi = { ...prev, [sectionKey]: [...(prev[sectionKey] || []), newItem] };
      dualSet("added", ADDED_KEY, newAi);
      const baseInv3 = (group==='tommys'||group==='demo') ? DEFAULT_INVENTORY : BLANK_INVENTORY;
      setInventory(applyOverridesAndAdded(baseInv3, overrides, sectionOverrides, newAi));
      return newAi;
    });
    flash();
  }, [overrides, sectionOverrides]);

  const removeItem = useCallback((id, sectionKey) => {
    const isAdded = Object.values(addedItems).flat().some(i => i.id === id);
    if (isAdded) {
      setAddedItems(prev => {
        const newAi = { ...prev, [sectionKey]: (prev[sectionKey] || []).filter(i => i.id !== id) };
        dualSet("added", ADDED_KEY, newAi);
        const baseInv2 = (group==='tommys'||group==='demo') ? DEFAULT_INVENTORY : BLANK_INVENTORY;
        setInventory(applyOverridesAndAdded(baseInv2, overrides, sectionOverrides, newAi));
        return newAi;
      });
    } else {
      setOverrides(prev => {
        const newOv = { ...prev, [id]: { ...(prev[id] || {}), _hidden: true } };
        setInventory(applyOverridesAndAdded(DEFAULT_INVENTORY, newOv, sectionOverrides, addedItems));
        dualSet("itemdata", ITEMDATA_KEY, newOv);
        return newOv;
      });
    }
    flash();
  }, [addedItems, overrides, sectionOverrides, group, dualSet]);

  // Add a brand new custom section
  const autoGenerateOrder = useCallback((weekKey, existingOrders, inv, currentStock, sett) => {
    // Only skip if already saved — unsaved orders always regenerate
    if (existingOrders[weekKey]?.saved) return;
    const today = new Date();
    const orderDate   = getWeekdayDate(today, sett.orderDay);
    const receiveDate = new Date(orderDate);
    receiveDate.setDate(orderDate.getDate() + 1);
    const lines = inv.flatMap(s => s.items.map(item => ({
      id: item.id, name: item.name, order_unit: item.order_unit, supplier: item.supplier,
      section: s.section, qty: calcOrderQty(item, currentStock[item.id] ?? 0),
    })));
    const newOrder = {
      weekKey, orderDate: orderDate.toISOString().split("T")[0],
      receiveDate: receiveDate.toISOString().split("T")[0],
      createdAt: new Date().toISOString(), lines, saved: false,
    };
    const newOrders = { ...existingOrders, [weekKey]: newOrder };
    setOrders(newOrders);
    sbSet(group, "orders", newOrders); try { localStorage.setItem(ORDERS_KEY(group), JSON.stringify(newOrders)); } catch(e) {}
  }, []);

  const saveOrder = useCallback((weekKey, updatedOrder, currentStock, currentInventory) => {
    if (updatedOrder.submitted) {
      const archiveKey = `${weekKey}_sub_${Date.now()}`;

      // Zero stock for every ordered item
      const orderedLines = (updatedOrder.lines || []).filter(l => l.qty > 0);
      const newStock = { ...currentStock };
      orderedLines.forEach(l => { newStock[l.id] = 0; });

      // Build fresh order from zeroed stock
      const freshLines = currentInventory.flatMap(s => s.items.map(item => ({
        id: item.id, name: item.name, order_unit: item.order_unit, supplier: item.supplier,
        section: s.section, qty: calcOrderQty(item, newStock[item.id] ?? 0),
      })));
      const freshOrder = {
        weekKey,
        createdAt: new Date().toISOString(),
        lines: freshLines,
        saved: false,
      };

      // Stamp timestamp BEFORE writing so RT echo is suppressed (8s window)
      lastLocalEdit.current = Date.now();

      // Update local state immediately
      setStock(newStock);

      setOrders(prev => {
        const newOrders = {
          ...prev,
          [archiveKey]: { ...updatedOrder, saved: true },
          [weekKey]: freshOrder,
        };
        return newOrders;
      });

      // Write to localStorage immediately for persistence
      try { localStorage.setItem(STOCK_KEY(group), JSON.stringify(newStock)); } catch(e) {}

      // Delay Supabase writes by 3s so the RT echo arrives after our guard window
      setTimeout(() => {
        sbSet(group, "stock", newStock);
        sbSet(group, "orders", {
          ...(() => { try { return JSON.parse(localStorage.getItem(ORDERS_KEY(group)) || "{}"); } catch { return {}; } })(),
          [archiveKey]: { ...updatedOrder, saved: true },
          [weekKey]: freshOrder,
        });
        try {
          const finalOrders = {
            ...JSON.parse(localStorage.getItem(ORDERS_KEY(group)) || "{}"),
            [archiveKey]: { ...updatedOrder, saved: true },
            [weekKey]: freshOrder,
          };
          localStorage.setItem(ORDERS_KEY(group), JSON.stringify(finalOrders));
        } catch(e) {}
      }, 3000);
    } else {
      setOrders(prev => {
        const newOrders = { ...prev, [weekKey]: { ...updatedOrder, saved: true } };
        dualSet("orders", ORDERS_KEY, newOrders);
        return newOrders;
      });
    }
    flash();
  }, [dualSet]);

  const saveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    dualSet("settings", SETTINGS_KEY, newSettings);
    flash();
  }, []);

  // Snapshot current stock into this week's usage log entry
  const snapshotStock = useCallback((newStock) => {
    const wk = getWeekKey();
    setUsageLog(prev => {
      const entry = { ...(prev[wk] || {}), snapshot: { ...newStock }, ts: new Date().toISOString() };
      const newLog = { ...prev, [wk]: entry };
      dualSet("usage", USAGE_KEY, newLog);
      return newLog;
    });
  }, [dualSet]);

  // Compute weekly consumption for each item across all logged weeks
  const computeUsage = useCallback((log) => {
    const weeks = Object.keys(log).sort();
    if (weeks.length < 2) return {};
    const consumption = {}; // itemId -> [weeklyUsed, ...]
    for (let i = 1; i < weeks.length; i++) {
      const prev = log[weeks[i-1]]?.snapshot || {};
      const curr = log[weeks[i]]?.snapshot   || {};
      const allIds = new Set([...Object.keys(prev), ...Object.keys(curr)]);
      allIds.forEach(id => {
        const used = (prev[id] ?? 0) - (curr[id] ?? 0);
        if (used > 0) {
          if (!consumption[id]) consumption[id] = [];
          consumption[id].push(used);
        }
      });
    }
    return consumption;
  }, []);

  // Accept a par suggestion: apply new reorder + max_stock
  const applyParSuggestion = useCallback((itemId, newReorder, newMaxStock) => {
    saveItemField(itemId, "reorder",   newReorder);
    setTimeout(() => saveItemField(itemId, "max_stock", newMaxStock), 50);
  }, [saveItemField]);

  const updateStock = (id, val) => {
    const n = parseInt(val);
    const newStock = { ...stock, [id]: isNaN(n) ? 0 : Math.max(0, n) };
    saveStock(newStock);
    snapshotStock(newStock);
  };

  if (!user) return <LoginScreen onLogin={u => { setUser(u); setGroup(u.group || "demo"); setLoginError(""); }} error={loginError} setError={setLoginError} />;

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`@media (max-width: 768px) { .edit-pencil { display: none !important; } } .edit-cell:hover .edit-pencil { display: inline !important; }`}</style>
      {/* ── Sidebar overlay ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200 }} />
      )}

      {/* ── Sidebar panel ── */}
      <div style={{
        position:"fixed", top:0, left:0, height:"100vh", width:260,
        background:"#0f1a2e", borderRight:"1px solid #334155",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition:"transform 0.25s ease", zIndex:201,
        display:"flex", flexDirection:"column",
      }}>
        {/* Sidebar header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid #334155", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <MoeLogo size="md" />
          <button onClick={() => setSidebarOpen(false)}
            style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:20, lineHeight:1, padding:4 }}
            onMouseEnter={e => e.currentTarget.style.color="#f1f5f9"}
            onMouseLeave={e => e.currentTarget.style.color="#475569"}>
            ✕
          </button>
        </div>

        {/* User info */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #334155" }}>
          <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{user.name}</div>
          <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{user.role.toUpperCase()} · {group.toUpperCase()}</div>
        </div>

        {/* Nav items — owner only */}
        {user.role === "owner" && (
          <div style={{ flex:1, padding:"12px 12px", overflowY:"auto" }}>
            {[
              { key:"inventory", label:"Inventory",  icon:"📋", desc:"Stock count" },
              { key:"order",     label:"Order List", icon:"📦", desc:"Weekly orders" },
              { key:"usage",     label:"Usage",      icon:"📈", desc:"Trends & par suggestions" },
              { key:"history",   label:"History",    icon:"📚", desc:"Past orders" },
              { key:"backend",   label:"Backend",    icon:"⚙️",  desc:"Edit items & sections" },
              { key:"settings",  label:"Settings",   icon:"🔧", desc:"Vendors & schedule" },
            ].map(item => {
              const isActive = view === item.key;
              return (
                <button key={item.key} onClick={() => { setView(item.key); setSidebarOpen(false); }}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:12,
                    background: isActive ? "#080c14" : "transparent",
                    border:"none", borderRadius:10,
                    padding:"11px 14px", cursor:"pointer",
                    marginBottom:4, transition:"all 0.15s",
                    borderLeft: isActive ? "3px solid #94a3b8" : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background="#080c14"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background="transparent"; }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ color: isActive ? "#e2e8f0" : "#f1f5f9", fontSize:14, fontWeight: isActive ? 600 : 400 }}>{item.label}</div>
                    <div style={{ color:"#475569", fontSize:11, marginTop:1 }}>{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ padding:"12px 12px", borderTop:"1px solid #334155" }}>
          {SUPABASE_READY && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", marginBottom:8 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background: syncError ? "#ef4444" : "#22c55e", display:"inline-block", flexShrink:0 }}/>
              <span style={{ color: syncError ? "#ef4444" : "#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                {syncError ? "SYNC ERROR" : lastSync ? `SYNCED ${lastSync.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : "SYNCING..."}
              </span>
              <button onClick={() => pullFromSupabase(true)}
                style={{ marginLeft:"auto", background:"none", border:"1px solid #334155", borderRadius:5, color:"#475569", cursor:"pointer", fontSize:11, padding:"2px 7px", fontFamily:"'DM Mono',monospace" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#1e2d45";e.currentTarget.style.color="#475569";}}>
                ↻
              </button>
            </div>
          )}
          <button onClick={() => setUser(null)}
            style={{ width:"100%", background:"transparent", border:"1px solid #334155", borderRadius:8, color:"#64748b", padding:"10px", cursor:"pointer", fontSize:13, transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Top header ── */}
      <header style={{ background:"#0f1a2e", borderBottom:"1px solid #334155", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, position:"sticky", top:0, zIndex:101 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Hamburger button */}
          <button onClick={() => setSidebarOpen(true)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", borderRadius:8, display:"flex", flexDirection:"column", gap:4.5, justifyContent:"center" }}
            onMouseEnter={e => e.currentTarget.style.background="#1e2d45"}
            onMouseLeave={e => e.currentTarget.style.background="none"}>
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:20, height:2, background:"#94a3b8", borderRadius:2 }} />
          </button>
          <MoeLogo size="md" />
          {/* Current view label on mobile */}
          <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px" }}>
            {user.role === "owner" ? view.toUpperCase().replace("ORDER","ORDER LIST") : "EMPLOYEE VIEW"}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <DateWeekBadge orderDay={settings.orderDay} />
          {saveFlash && <span style={{ color:"#22c55e", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{saveFlash}</span>}
          <span style={{ color:"#64748b", fontSize:13 }}>{user.name}</span>
        </div>
      </header>
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>
        {(view==="inventory" || user.role==="employee") &&
          <EmployeeView inventory={inventory} stock={stock} updateStock={updateStock} orderDay={settings.orderDay} />}
        {view==="backend" && user.role==="owner" &&
          <BackendView inventory={inventory} stock={stock} saveItemField={saveItemField} saveSectionName={saveSectionName} addItem={addItem} removeItem={removeItem} addSection={addSection} deleteSection={deleteSection} onPublish={() => { sbSet(group,"stock",stock); sbSet(group,"itemdata",overrides); sbSet(group,"sections",sectionOverrides); sbSet(group,"added",addedItems); sbSet(group,"orders",orders); sbSet(group,"settings",settings); sbSet(group,"usage",usageLog); flash(); }} />}
        {view==="order" && user.role==="owner" &&
          <OrderView inventory={inventory} stock={stock} orders={orders} currentWeekKey={getWeekKey()} saveOrder={saveOrder} settings={settings} submitOrderToVendor={submitOrderToVendor} connections={connections} />}
        {view==="history" && user.role==="owner" &&
          <HistoryView orders={orders} />}
        {view==="usage" && user.role==="owner" &&
          <UsageView inventory={inventory} usageLog={usageLog} computeUsage={computeUsage} applyParSuggestion={applyParSuggestion} orders={orders} />}
        {view==="settings" && user.role==="owner" &&
          <SettingsView settings={settings} saveSettings={saveSettings} inventory={inventory} />}
      </main>
    </div>
  );
}

// ─── MOE LOGO ─────────────────────────────────────────────────────────────────
function MoeLogo({ size = "md" }) {
  // sizes: sm=header, md=default, lg=login screen
  const configs = {
    sm: { vw: 110, vh: 36, hx: 18, hy: 18, outerR: 16, midR: 11, innerR: 6,  spoke: 5,  dot: 1.8, tx: 36,  ty: 23, fs: 20 },
    md: { vw: 130, vh: 44, hx: 22, hy: 22, outerR: 20, midR: 13, innerR: 7,  spoke: 6,  dot: 2.2, tx: 44,  ty: 28, fs: 24 },
    lg: { vw: 220, vh: 72, hx: 36, hy: 36, outerR: 33, midR: 22, innerR: 11, spoke: 10, dot: 3.5, tx: 74,  ty: 46, fs: 40 },
  };
  const c = configs[size] || configs.md;
  const { vw, vh, hx, hy, outerR: oR, midR: mR, innerR: iR, spoke: sp, dot: d, tx, ty, fs } = c;

  // Hexagon points helper
  const hex = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(" ");
  };

  // Spoke endpoints: outer point to mid-hex edge
  const spokeLines = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 180 * (60 * i - 30);
    return {
      x1: (hx + oR * Math.cos(a)).toFixed(2), y1: (hy + oR * Math.sin(a)).toFixed(2),
      x2: (hx + mR * Math.cos(a)).toFixed(2), y2: (hy + mR * Math.sin(a)).toFixed(2),
    };
  });

  // Outer dot positions
  const outerDots = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 180 * (60 * i - 30);
    return { cx: (hx + oR * Math.cos(a)).toFixed(2), cy: (hy + oR * Math.sin(a)).toFixed(2) };
  });

  return (
    <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} xmlns="http://www.w3.org/2000/svg" style={{ display:"block", flexShrink:0 }}>
      {/* outer ring */}
      <polygon points={hex(hx, hy, oR)} fill="none" stroke="#94a3b8" strokeWidth="0.8" opacity="0.2"/>
      {/* spokes */}
      {spokeLines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#94a3b8" strokeWidth="0.7" opacity="0.3"/>)}
      {/* outer dots */}
      {outerDots.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={d} fill="#64748b" opacity="0.55"/>)}
      {/* mid ring */}
      <polygon points={hex(hx, hy, mR)} fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.55"/>
      {/* inner solid hex */}
      <polygon points={hex(hx, hy, iR)} fill="#f1f5f9"/>
      {/* center void */}
      <circle cx={hx} cy={hy} r={iR * 0.45} fill="#080c14" opacity="0.45"/>
      {/* wordmark */}
      <text x={tx} y={ty} fontFamily="'DM Sans',sans-serif" fontWeight="900" fontSize={fs} letterSpacing="-1" fill="#f1f5f9">
        M<tspan fill="#e2e8f0">OE</tspan>
      </text>
    </svg>
  );
}

// ─── NAV BUTTON ──────────────────────────────────────────────────────────────
function NavBtn({ children, active, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (accent ? "#e2e8f0" : "#1e2d45") : "transparent",
      color: active ? "#fff" : "#94a3b8",
      border: `1px solid ${active ? (accent ? "#e2e8f0" : "#475569") : "#1e2d45"}`,
      padding:"5px 14px", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500,
    }}>{children}</button>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, error, setError }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [show, setShow]   = useState(false);
  const handleLogin = () => {
    const u = USERS[email.toLowerCase().trim()];
    if (u && u.password === pass) onLogin({ ...u, email });
    else setError("Invalid email or password.");
  };
  return (
    <div style={{ minHeight:"100vh", background:"#080c14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width:380 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", marginBottom:12 }}>
            <MoeLogo size="lg" />
          </div>
          <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"2px", textAlign:"center", marginBottom:4 }}>MAKE ORDERING EASY</div>
          <p style={{ color:"#64748b", fontSize:14, margin:0 }}>Sign in to continue</p>
        </div>
        <div style={{ background:"#0f1a2e", borderRadius:16, border:"1px solid #334155", padding:28 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", color:"#94a3b8", fontSize:12, fontWeight:500, marginBottom:6, letterSpacing:"0.5px", textTransform:"uppercase" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()}
              placeholder="you@kitchen.com" type="email"
              style={{ width:"100%", background:"#080c14", border:"1px solid #334155", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", color:"#94a3b8", fontSize:12, fontWeight:500, marginBottom:6, letterSpacing:"0.5px", textTransform:"uppercase" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()}
                type={show ? "text" : "password"} placeholder="••••••••"
                style={{ width:"100%", background:"#080c14", border:"1px solid #334155", borderRadius:8, padding:"10px 40px 10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => setShow(!show)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:14 }}>{show ? "🙈" : "👁"}</button>
            </div>
          </div>
          {error && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:16 }}>{error}</div>}
          <button onClick={handleLogin} style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:12, color:"#080c14", fontSize:15, fontWeight:600, cursor:"pointer" }}>Sign In</button>
        </div>
        <div style={{ marginTop:20, background:"#0f1a2e", borderRadius:12, border:"1px solid #334155", padding:"14px 18px" }}>
          <div style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>Demo Credentials</div>
          <div style={{ color:"#94a3b8", fontSize:12, lineHeight:2 }}>
            <span style={{ color:"#e2e8f0" }}>Owner:</span> owner@kitchen.com / owner123<br />
            <span style={{ color:"#22c55e" }}>Employee:</span> employee@kitchen.com / employee123
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EMPLOYEE VIEW ────────────────────────────────────────────────────────────
function EmployeeView({ inventory, stock, updateStock, orderDay = 3 }) {
  const allItems = inventory.flatMap(s => s.items.map(i => ({ ...i, sectionLabel: s.section })));
  const urgentItems = allItems.filter(item => (stock[item.id] ?? 0) < item.reorder);

  // Group by vendor → then by section within vendor
  const vendorMap = {};
  allItems.forEach(item => {
    const vendor = (item.supplier || "").trim() || "No Vendor";
    if (!vendorMap[vendor]) vendorMap[vendor] = {};
    if (!vendorMap[vendor][item.sectionLabel]) vendorMap[vendor][item.sectionLabel] = [];
    vendorMap[vendor][item.sectionLabel].push(item);
  });
  const vendorOrder = Object.keys(vendorMap).sort((a,b) => {
    if (a === "No Vendor") return 1;
    if (b === "No Vendor") return -1;
    return a.localeCompare(b);
  });
  const [activeVendor, setActiveVendor] = React.useState("ALL");
  return (
    <div>
      {urgentItems.length > 0 && (
        <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:12, padding:"14px 18px", marginBottom:24, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>🔴</span>
          <div>
            <div style={{ color:"#fca5a5", fontWeight:600, fontSize:14 }}>{urgentItems.length} item{urgentItems.length!==1?"s":""} need to be ordered</div>
            <div style={{ color:"#f87171", fontSize:12, marginTop:2 }}>{urgentItems.slice(0,5).map(i=>i.name).join(", ")}{urgentItems.length>5?` +${urgentItems.length-5} more`:""}</div>
          </div>
        </div>
      )}
      {/* Vendor dropdown */}
      <div style={{ marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ position:"relative", flex:1, maxWidth:320 }}>
          <select value={activeVendor} onChange={e => setActiveVendor(e.target.value)}
            style={{ width:"100%", background:"#0f1a2e", border:"1px solid #475569", borderRadius:10, padding:"10px 40px 10px 14px", color:"#f1f5f9", fontSize:14, fontWeight:600, fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer", appearance:"none", WebkitAppearance:"none" }}>
            <option value="ALL">All Vendors</option>
            {vendorOrder.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {/* Dropdown arrow */}
          <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#e2e8f0", fontSize:12 }}>▼</div>
        </div>
        {/* Urgent badge */}
        {urgentItems.length > 0 && activeVendor === "ALL" && (
          <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:8, padding:"6px 12px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600, whiteSpace:"nowrap" }}>
            🔴 {urgentItems.length} to order
          </span>
        )}
        {urgentItems.length > 0 && activeVendor !== "ALL" && (() => {
          const urgent = Object.values(vendorMap[activeVendor]||{}).flat().filter(i => (stock[i.id]??0) < i.reorder).length;
          return urgent > 0 ? (
            <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:8, padding:"6px 12px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600, whiteSpace:"nowrap" }}>
              🔴 {urgent} to order
            </span>
          ) : null;
        })()}
      </div>

      {/* Stock count header */}
      <div style={{ marginBottom:16, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>
            {activeVendor === "ALL" ? "All Stock" : activeVendor}
          </h2>
          <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>
            {activeVendor === "ALL" ? `${allItems.length} items across ${vendorOrder.length} vendor${vendorOrder.length!==1?"s":""}` : `${Object.values(vendorMap[activeVendor]||{}).flat().length} items`}
          </p>
        </div>
        <DateWeekBadge orderDay={orderDay} />
      </div>

      {(activeVendor === "ALL" ? vendorOrder : [activeVendor]).map(vendor => {
        const sections = vendorMap[vendor];
        const isNoVendor = vendor === "No Vendor";
        const vendorItemCount = Object.values(sections).flat().length;
        const vendorUrgent = Object.values(sections).flat().filter(i => (stock[i.id] ?? 0) < i.reorder).length;
        return (
          <div key={vendor} style={{ marginBottom:20 }}>
            {/* Vendor header */}
            <div style={{ background:"#080c14", border:`1px solid ${isNoVendor?"#1e2d45":"#e2e8f0"}`, borderBottom:"none", borderRadius:"12px 12px 0 0", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:15 }}>{isNoVendor?"📋":"📦"}</span>
                <span style={{ color:isNoVendor?"#64748b":"#e2e8f0", fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{vendor}</span>
                <span style={{ color:"#1e2d45", fontSize:11 }}>· {vendorItemCount} items</span>
              </div>
              {vendorUrgent > 0 && <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"2px 8px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{vendorUrgent} to order</span>}
            </div>
            {/* Sections inside vendor */}
            <div style={{ border:`1px solid ${isNoVendor?"#1e2d45":"#e2e8f0"}`, borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
              {Object.entries(sections).map(([secName, items], secIdx) => (
                <div key={secName}>
                  <div style={{ background:"#091018", padding:"5px 16px", borderTop: secIdx>0?"1px solid #0f172a":"none" }}>
                    <span style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>{secName.replace(/[^\w\s\-&]/g,"").trim()}</span>
                  </div>
                  {items.map((item, idx) => {
                    const s = stock[item.id] ?? 0;
                    const status = getStatus(item, s);
                    return (
                      <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 120px 80px 100px", alignItems:"center", padding:"10px 16px", borderBottom:idx<items.length-1?"1px solid #0f172a":"none", background:idx%2===0?"#0f1a2e":"#0a1220" }}>
                        <div>
                          <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:500 }}>{item.name}</div>
                          <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:1 }}>{item.order_unit} · Max: {item.max_stock}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <button onClick={() => updateStock(item.id, Math.max(0,s-1))} style={{ width:26, height:26, background:"#1e2d45", border:"none", borderRadius:6, color:"#94a3b8", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                          <input type="number" value={s} min={0} onChange={e => updateStock(item.id, e.target.value)} onFocus={e => e.target.select()} style={{ width:48, background:"#080c14", border:"1px solid #22c55e", borderRadius:6, padding:"4px 6px", color:"#4ade80", fontSize:13, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                          <button onClick={() => updateStock(item.id, s+1)} style={{ width:26, height:26, background:"#1e2d45", border:"none", borderRadius:6, color:"#94a3b8", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          {calcOrderQty(item,s) > 0 ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"3px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>Order {calcOrderQty(item,s)}</span> : <span style={{ color:"#1e2d45", fontSize:12 }}>—</span>}
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <span style={{ background:status.bg, color:status.color, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>{status.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EDITABLE CELL ────────────────────────────────────────────────────────────
function EditableCell({ value, onSave, type="text", width=80 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));
  const open   = () => { setEditing(true); setDraft(String(value)); };
  const commit = () => { setEditing(false); if (String(draft)!==String(value)) onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(String(value)); };
  if (!editing) return (
    <div onClick={open} title="Click to edit"
      className="edit-cell" style={{ cursor:"text", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:width, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {value!==""&&value!==null&&value!==undefined ? String(value) : <span style={{ color:"#475569", fontStyle:"italic" }}>—</span>}
      </span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7, flexShrink:0 }}>✏</span>
    </div>
  );
  return (
    <input autoFocus value={draft} type={type} min={type==="number"?0:undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if(e.key==="Enter")commit(); if(e.key==="Escape")cancel(); }}
      style={{ width, background:"#080c14", border:"1px solid #475569", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }} />
  );
}

// ─── ORDER UNIT SELECT ────────────────────────────────────────────────────────
const ORDER_UNITS = ["Case","Each","Piece","Unit","Bag","Bundle","Gallon","Roll","Lbs"];
function OrderUnitSelect({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <div onClick={() => setEditing(true)}
      style={{ cursor:"pointer", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:80, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1 }}>{value||"—"}</span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7 }}>✏</span>
    </div>
  );
  return (
    <select autoFocus value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}
      style={{ background:"#080c14", border:"1px solid #475569", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none" }}>
      {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

// ─── EDITABLE SECTION HEADER ──────────────────────────────────────────────────
function EditableSectionHeader({ label, onSave, onDelete }) {
  const [editing, setEditing]   = useState(false);
  const [confirm, setConfirm]   = useState(false);
  const [draft, setDraft]       = useState(label);
  const open   = () => { setDraft(label); setEditing(true); };
  const commit = () => { setEditing(false); onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(label); };
  const handleDelete = () => {
    if (confirm) { onDelete(); }
    else { setConfirm(true); setTimeout(() => setConfirm(false), 2500); }
  };
  return (
    <div style={{ background:"#080c14", padding:"6px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #334155", borderBottom:"none", display:"flex", alignItems:"center", gap:8 }}>
      {editing ? (
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if(e.key==="Enter")commit(); if(e.key==="Escape")cancel(); }}
          style={{ background:"transparent", border:"none", borderBottom:"1px solid #475569", color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", outline:"none", width:220, padding:"2px 0" }} />
      ) : (
        <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", flex:1 }}>{label}</span>
      )}
      {!editing && (<>
        <button onClick={open} title="Rename section"
          style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, padding:"2px 6px", borderRadius:4, lineHeight:1, transition:"color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color="#e2e8f0"}
          onMouseLeave={e => e.currentTarget.style.color="#475569"}>✏ rename</button>
        <button onClick={handleDelete} title={confirm ? "Click again to confirm" : "Delete section"}
          style={{ background: confirm ? "#7f1d1d" : "none", border:`1px solid ${confirm ? "#ef4444" : "transparent"}`, color: confirm ? "#fca5a5" : "#475569", cursor:"pointer", fontSize:11, padding:"2px 8px", borderRadius:4, lineHeight:1.4, transition:"all 0.15s" }}
          onMouseEnter={e => { if(!confirm){ e.currentTarget.style.color="#ef4444"; e.currentTarget.style.borderColor="#ef4444"; }}}
          onMouseLeave={e => { if(!confirm){ e.currentTarget.style.color="#475569"; e.currentTarget.style.borderColor="transparent"; }}}>
          {confirm ? "confirm ✕" : "✕ delete"}
        </button>
      </>)}
    </div>
  );
}

// Add Section Button with inline input
function AddSectionButton({ onAdd }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState("");
  const submit = () => {
    if (name.trim()) { onAdd(name.trim()); setName(""); setOpen(false); }
  };
  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ background:"none", border:"1px dashed #334155", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"7px 16px", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
      ＋ Add Section
    </button>
  );
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Section name..."
        onKeyDown={e => { if(e.key==="Enter")submit(); if(e.key==="Escape"){setOpen(false);setName("");} }}
        style={{ background:"#0f1a2e", border:"1px solid #475569", borderRadius:7, padding:"7px 12px", color:"#f1f5f9", fontSize:13, outline:"none", width:180 }} />
      <button onClick={submit}
        style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
        Add
      </button>
      <button onClick={() => { setOpen(false); setName(""); }}
        style={{ background:"transparent", border:"1px solid #334155", borderRadius:7, padding:"7px 10px", color:"#64748b", fontSize:13, cursor:"pointer" }}>
        Cancel
      </button>
    </div>
  );
}

// ─── HOVER ROW (with remove button) ──────────────────────────────────────────
function HoverRow({ children, bg, onRemove }) {
  const [hovered, setHovered]   = useState(false);
  const [confirm, setConfirm]   = useState(false);
  const handleRemove = (e) => {
    e.stopPropagation();
    if (confirm) { onRemove(); }
    else { setConfirm(true); setTimeout(() => setConfirm(false), 2500); }
  };
  const childArray = React.Children.toArray(children);
  const firstTd = childArray[0];
  const restTds = childArray.slice(1);
  const enhancedFirstTd = React.cloneElement(firstTd, {
    style: { ...firstTd.props.style, position:"relative" },
    children: (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <div style={{ flex:1 }}>{firstTd.props.children}</div>
        {hovered && (
          <button onClick={handleRemove} title={confirm?"Click again to confirm":"Remove item"}
            style={{ background:confirm?"#7f1d1d":"transparent", border:`1px solid ${confirm?"#ef4444":"#475569"}`, borderRadius:4, color:confirm?"#fca5a5":"#64748b", cursor:"pointer", fontSize:10, padding:"2px 6px", whiteSpace:"nowrap", flexShrink:0, lineHeight:1.4, transition:"all 0.15s" }}>
            {confirm ? "confirm ✕" : "✕"}
          </button>
        )}
      </div>
    ),
  });
  return (
    <tr style={{ background:bg, borderTop:"1px solid #0f172a" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirm(false); }}>
      {enhancedFirstTd}{restTds}
    </tr>
  );
}

// ─── BACKEND VIEW ─────────────────────────────────────────────────────────────
function BackendView({ inventory, stock, saveItemField, saveSectionName, addItem, removeItem, addSection, deleteSection, onPublish }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Backend — Edit Item Details</h2>
          <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>Click any orange cell to edit · Hover a row to remove it</p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <AddSectionButton onAdd={addSection} />
          <button onClick={onPublish}
            style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}
            onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity="1"}>
            ☁ Publish Changes
          </button>
        </div>
      </div>
      {inventory.map(section => (
        <div key={section.section} style={{ marginBottom:12 }}>
          <EditableSectionHeader label={section.section} onSave={newName => saveSectionName(section._original || section.section, newName)} onDelete={() => deleteSection(section.section)} />
          <div style={{ maxHeight:400, overflowY:"auto", overflowX:"auto", position:"relative" }}>
            <table style={{ width:"100%", tableLayout:"fixed", borderCollapse:"collapse", background:"#0f1a2e", border:"1px solid #334155", borderTop:"none", borderRadius:"0 0 12px 12px" }}>
              <thead>
                <tr style={{ background:"#080c14" }}>
                  {[
                    ["Item Name",     "#e2e8f0", "left",   170, true],
                    ["Order Unit",    "#e2e8f0", "left",    90, false],
                    ["Units/Pkg",     "#e2e8f0", "center",  60, false],
                    ["Supplier",      "#e2e8f0", "left",   110, false],
                    ["Max Stock",     "#e2e8f0", "center",  75, false],
                    ["Reorder Pt",    "#e2e8f0", "center",  75, false],
                    ["Current Stock", "#475569", "center",  85, false],
                    ["Units Needed",  "#475569", "center",  85, false],
                    ["Order Qty",     "#475569", "center",  80, false],
                    ["Status",        "#475569", "center",  90, false],
                  ].map(([h, color, align, w, stickyLeft]) => (
                    <th key={h} style={{ position:"sticky", top:0, left:stickyLeft?0:undefined, zIndex:stickyLeft?4:2, background:"#080c14", color, fontSize:10, fontWeight:600, padding:"8px 10px", textAlign:align, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase", whiteSpace:"nowrap", minWidth:w, width:w, boxShadow:stickyLeft?"2px 0 8px rgba(0,0,0,0.4)":undefined }}>
                      <>{h}{color==="#e2e8f0"?<span className="edit-pencil"> ✏</span>:""}</>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, idx) => {
                  const s        = stock[item.id] ?? 0;
                  const needed   = Math.max(0, item.max_stock - s);
                  const orderQty = calcOrderQty(item, s);
                  const status   = getStatus(item, s);
                  const rowBg    = idx%2===0 ? "#0f1a2e" : "#0a1220";
                  return (
                    <HoverRow key={item.id} bg={rowBg} onRemove={() => removeItem(item.id, section.section)}>
                      <td style={{ padding:"5px 8px", position:"sticky", left:0, zIndex:1, background:rowBg, boxShadow:"2px 0 8px rgba(0,0,0,0.4)" }}>
                        <EditableCell value={item.name}      onSave={v => saveItemField(item.id,"name",v)} width={155} />
                      </td>
                      <td style={{ padding:"5px 8px" }}>
                        <OrderUnitSelect value={item.order_unit} onSave={v => saveItemField(item.id,"order_unit",v)} />
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"center" }}>
                        <EditableCell value={item.upu}       onSave={v => saveItemField(item.id,"upu",v)} type="number" width={50} />
                      </td>
                      <td style={{ padding:"5px 8px" }}>
                        <EditableCell value={item.supplier}  onSave={v => saveItemField(item.id,"supplier",v)} width={98} />
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"center" }}>
                        <EditableCell value={item.max_stock} onSave={v => saveItemField(item.id,"max_stock",v)} type="number" width={55} />
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"center" }}>
                        <EditableCell value={item.reorder}   onSave={v => saveItemField(item.id,"reorder",v)} type="number" width={55} />
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"center" }}>
                        <span style={{ color:"#4ade80", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700 }}>{s}</span>
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"center" }}>
                        <span style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:12 }}>{needed}</span>
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"center" }}>
                        {orderQty>0
                          ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:5, padding:"2px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{orderQty}</span>
                          : <span style={{ color:"#1e2d45", fontFamily:"'DM Mono',monospace", fontSize:12 }}>0</span>}
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"center" }}>
                        <span style={{ background:status.bg, color:status.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{status.label}</span>
                      </td>
                    </HoverRow>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={10} style={{ padding:"6px 10px", borderTop:"1px solid #0f172a" }}>
                    <button onClick={() => addItem(section.section)}
                      style={{ background:"none", border:"1px dashed #334155", borderRadius:6, color:"#475569", cursor:"pointer", fontSize:12, padding:"5px 14px", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s" }}
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
      ))}
    </div>
  );
}

// ─── ORDER VIEW ───────────────────────────────────────────────────────────────
function OrderView({ inventory, stock, orders, currentWeekKey, saveOrder, settings, submitOrderToVendor, connections = [] }) {
  // Per-vendor order view — show vendor tabs with their own order/delivery dates
  const vendors = (settings.vendors || []).filter(v => v.name);
  const [activeVendor, setActiveVendor] = useState(vendors[0]?.name || "ALL");
  const order       = orders[currentWeekKey];
  const wk = getWeekNumber();

  // Get order/delivery date for the active vendor
  const activeVendorData = vendors.find(v => v.name === activeVendor);
  const orderDay    = activeVendorData?.orderDay    ?? settings.orderDay ?? 3;
  const deliveryDay = activeVendorData?.deliveryDay ?? (orderDay + 1);
  const orderDate   = order ? fmtDate(order.orderDate) : fmtDate(getWeekdayDate(new Date(), orderDay));
  const receiveDate = order ? fmtDate(order.receiveDate) : fmtDate(getWeekdayDate(new Date(), deliveryDay));

  // Always recalculate from current stock — never use stale saved lines
  // Saved order in history preserves the snapshot, but live order list stays fresh
  const allLines = inventory.flatMap(s => s.items.map(item => ({
    id: item.id, name: item.name, order_unit: item.order_unit, supplier: item.supplier,
    section: s.section, qty: calcOrderQty(item, stock[item.id] ?? 0),
  })));

  // Filter by active vendor tab
  const lines = activeVendor === "ALL"
    ? allLines
    : allLines.filter(l => (l.supplier||"").toLowerCase().trim() === activeVendor.toLowerCase().trim());

  const activeLines = lines.filter(l => l.qty > 0);
  const bySupplier  = {};
  activeLines.forEach(item => {
    const sup = item.supplier || "General / No Supplier";
    if (!bySupplier[sup]) bySupplier[sup] = [];
    bySupplier[sup].push(item);
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    // Snapshot all lines at this moment (before stock reset)
    const allLinesSnapshot = inventory.flatMap(s => s.items.map(item => ({
      id: item.id, name: item.name, order_unit: item.order_unit, supplier: item.supplier,
      section: s.section, qty: calcOrderQty(item, stock[item.id] ?? 0),
    })));

    const toSave = {
      weekKey: currentWeekKey,
      orderDate: order?.orderDate || getWeekdayDate(new Date(), settings.orderDay).toISOString().split("T")[0],
      receiveDate: order?.receiveDate || getWeekdayDate(new Date(), (settings.vendors?.[0]?.deliveryDay ?? settings.orderDay+1)).toISOString().split("T")[0],
      createdAt: order?.createdAt || new Date().toISOString(),
      savedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      lines: allLinesSnapshot,
      saved: true,
      submitted: true,
    };

    // 1. Save to history — pass current stock + inventory so saveOrder has fresh values
    saveOrder(currentWeekKey, toSave, stock, inventory);

    // 2. Send to each connected vendor whose items are in this order
    if (submitOrderToVendor && connections.length > 0) {
      const activeOrderLines = allLinesSnapshot.filter(l => l.qty > 0);
      for (const conn of connections) {
        const vendorLines = activeOrderLines.filter(l =>
          (l.supplier || "").toLowerCase().trim() === (conn.vendorName || "").toLowerCase().trim()
        );
        if (vendorLines.length > 0) {
          await submitOrderToVendor(conn.vendorId, conn.vendorName, vendorLines, currentWeekKey);
        }
      }
    }

    setSubmitting(false);
  };

  // When submitted, show a confirmation banner with connected vendor count
  const connectedVendorCount = connections.filter(c =>
    allLines.some(l => (l.supplier||"").toLowerCase().trim() === (c.vendorName||"").toLowerCase().trim() && l.qty > 0)
  ).length;

  return (
    <div>
      {/* Vendor tabs */}
      {vendors.length > 0 && (
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", marginBottom:16 }}>
          <div style={{ display:"flex", gap:8, minWidth:"max-content" }}>
            {["ALL", ...vendors.map(v => v.name)].map(v => {
              const isActive = activeVendor === v;
              const vd = vendors.find(x => x.name === v);
              const nextOrder = vd ? fmtDate(getWeekdayDate(new Date(), vd.orderDay)) : null;
              return (
                <button key={v} onClick={() => setActiveVendor(v)}
                  style={{ padding:"8px 16px", borderRadius:10, border:`1px solid ${isActive?"#e2e8f0":"#1e2d45"}`, background:isActive?"#e2e8f0":"#0f1a2e", color:isActive?"#080c14":"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", flexShrink:0 }}>
                  {v === "ALL" ? "All Vendors" : v}
                  {nextOrder && !isActive && <span style={{ display:"block", fontSize:9, color:"#475569", marginTop:1 }}>orders {nextOrder}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Order List{activeVendor !== "ALL" ? ` — ${activeVendor}` : ""}</h2>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, flexWrap:"wrap" }}>
            <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:6, padding:"2px 8px", color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>WK {wk}</span>
            {order?.saved && <span style={{ background:"#14532d", border:"1px solid #16a34a", borderRadius:6, padding:"2px 8px", color:"#4ade80", fontSize:11, fontFamily:"'DM Mono',monospace" }}>✓ Saved</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:8, padding:"6px 14px", color:"#a5b4fc", fontSize:13, fontWeight:600 }}>
            {activeLines.length} item{activeLines.length!==1?"s":""} to order
          </div>
          {!order?.submitted ? (
            <button onClick={handleSubmit} disabled={submitting || activeLines.length === 0}
              style={{ background: activeLines.length === 0 ? "#0f1a2e" : "linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"8px 20px", color: activeLines.length === 0 ? "#475569" : "#0f172a", fontSize:13, fontWeight:700, cursor: activeLines.length === 0 ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display:"flex", alignItems:"center", gap:6 }}>
              {submitting ? "Submitting..." : "🚀 Submit Order"}
            </button>
          ) : (
            <span style={{ background:"#14532d", border:"1px solid #16a34a", borderRadius:8, padding:"8px 16px", color:"#4ade80", fontSize:13, fontWeight:600 }}>
              ✓ Order Submitted
            </span>
          )}
        </div>
      </div>

      {/* Submitted confirmation banner */}
      {order?.submitted && (
        <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:12, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:24 }}>✅</span>
          <div>
            <div style={{ color:"#4ade80", fontSize:15, fontWeight:700 }}>Order submitted successfully!</div>
            <div style={{ color:"#64748b", fontSize:13, marginTop:2 }}>
              Saved to history{connectedVendorCount > 0 ? ` · Sent to ${connectedVendorCount} vendor${connectedVendorCount > 1 ? "s" : ""}` : " · No vendors connected yet"}.
              {" "}Stock reset to max — order list is now clear for your next count.
            </div>
          </div>
        </div>
      )}

      {/* All stocked up */}
      {!order?.submitted && activeLines.length === 0 && (
        <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, padding:48, textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ color:"#4ade80", fontSize:18, fontWeight:700 }}>All stocked up!</div>
          <div style={{ color:"#64748b", fontSize:14, marginTop:6 }}>No items need to be ordered this week.</div>
        </div>
      )}

      {/* Order items by supplier */}
      {!order?.submitted && activeLines.length > 0 && Object.entries(bySupplier).map(([supplier, items]) => (
        <div key={supplier} style={{ marginBottom:16 }}>
          <div style={{ background:"#080c14", padding:"8px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #334155", borderBottom:"none", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>📦 {supplier}</span>
              <span style={{ color:"#475569", fontSize:11, marginLeft:10 }}>{items.length} item{items.length!==1?"s":""}</span>
            </div>
            <button
              onClick={() => printSupplierPDF({ supplier, items, weekKey:`WK ${wk}`, orderDate, receiveDate })}
              style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:6, padding:"5px 12px", color:"#080c14", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
              🖨 PDF
            </button>
          </div>
          <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 160px", background:"#080c14", padding:"7px 16px", borderBottom:"1px solid #334155" }}>
              <span style={{ color:"#475569", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Item</span>
              <span style={{ color:"#475569", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Qty to Order</span>
            </div>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 160px", alignItems:"center", padding:"10px 16px", background:idx%2===0?"#0f1a2e":"#0a1220", borderBottom:idx<items.length-1?"1px solid #0f172a":"none" }}>
                <div>
                  <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:500 }}>{item.name}</div>
                  <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:1 }}>{String(item.section||"").replace(/[^\w\s]/g,"").trim()}</div>
                </div>
                <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:7, padding:"4px 10px", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                  {item.qty} {item.order_unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HISTORY VIEW ─────────────────────────────────────────────────────────────
function HistoryView({ orders }) {
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  const sorted = Object.values(orders).filter(o => o && (o.saved || o._archived)).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filtered = sorted.filter(o => !search || (o.weekKey||"").includes(search) || fmtDate(o.orderDate||new Date().toISOString().split("T")[0]).toLowerCase().includes(search.toLowerCase()));
  const view = selected ? orders[selected] : null;

  if (view) {
    const activeLines = view.lines.filter(l => l.qty > 0);
    const bySupplier  = {};
    activeLines.forEach(item => {
      const sup = item.supplier || "General / No Supplier";
      if (!bySupplier[sup]) bySupplier[sup] = [];
      bySupplier[sup].push(item);
    });
    const orderDate   = fmtDate(view.orderDate);
    const receiveDate = fmtDate(view.receiveDate);
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background:"none", border:"1px solid #334155", borderRadius:7, color:"#94a3b8", padding:"5px 14px", cursor:"pointer", fontSize:13, marginBottom:20 }}>
          ← Back to History
        </button>
        <div style={{ marginBottom:20 }}>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Order — {view.weekKey}</h2>
          <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
            <span style={{ color:"#64748b", fontSize:12 }}>Order date: <span style={{ color:"#94a3b8" }}>{orderDate}</span></span>
            <span style={{ color:"#64748b", fontSize:12 }}>Receive date: <span style={{ color:"#94a3b8" }}>{receiveDate}</span></span>
            <span style={{ color:"#64748b", fontSize:12 }}>Items ordered: <span style={{ color:"#94a3b8" }}>{activeLines.length}</span></span>
          </div>
        </div>
        {Object.entries(bySupplier).map(([supplier, items]) => (
          <div key={supplier} style={{ marginBottom:16 }}>
            <div style={{ background:"#080c14", padding:"8px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #334155", borderBottom:"none", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>📦 {supplier}</span>
              <button
                onClick={() => printSupplierPDF({ supplier, items, weekKey:view.weekKey, orderDate, receiveDate })}
                style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:6, padding:"5px 12px", color:"#080c14", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                🖨 PDF
              </button>
            </div>
            <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 160px", alignItems:"center", padding:"10px 16px", background:idx%2===0?"#0f1a2e":"#0a1220", borderBottom:idx<items.length-1?"1px solid #0f172a":"none" }}>
                  <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:500 }}>{item.name}</div>
                  <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:7, padding:"4px 10px", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                    {item.qty} {item.order_unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Order History</h2>
        <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>Browse past saved orders</p>
      </div>
      <div style={{ marginBottom:16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by week or date..."
          style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:8, padding:"9px 14px", color:"#f1f5f9", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" }}
          onFocus={e => e.target.style.borderColor="#e2e8f0"}
          onBlur={e => e.target.style.borderColor="#1e2d45"} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, padding:48, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No saved orders yet</div>
          <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Save an order from the Order List tab to see it here</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(o => {
            const active = o.lines.filter(l => l.qty > 0);
            const bySupplier = {};
            active.forEach(item => {
              const sup = item.supplier || "General / No Supplier";
              if (!bySupplier[sup]) bySupplier[sup] = [];
              bySupplier[sup].push(item);
            });
            return (
              <div key={o.weekKey} style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:10, overflow:"hidden", transition:"border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"}
                onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
                <div onClick={() => setSelected(o.weekKey)} style={{ padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:6, padding:"2px 8px", color:"#a5b4fc", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{o.weekKey}</span>
                    </div>
                    <div style={{ color:"#94a3b8", fontSize:12 }}>Order: {fmtDate(o.orderDate)} · Receive: {fmtDate(o.receiveDate)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{active.length} items</div>
                    <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>View →</div>
                  </div>
                </div>
                {Object.keys(bySupplier).length > 0 && (
                  <div style={{ borderTop:"1px solid #0f172a", padding:"8px 18px", display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(bySupplier).map(([supplier, items]) => (
                      <button key={supplier}
                        onClick={(e) => { e.stopPropagation(); printSupplierPDF({ supplier, items, weekKey:o.weekKey, orderDate:fmtDate(o.orderDate), receiveDate:fmtDate(o.receiveDate) }); }}
                        style={{ background:"#080c14", border:"1px solid #334155", borderRadius:6, padding:"4px 10px", color:"#94a3b8", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4, transition:"all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#94a3b8"; }}>
                        🖨 {supplier} ({items.length})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── USAGE VIEW ───────────────────────────────────────────────────────────────
function UsageView({ inventory, usageLog, computeUsage, applyParSuggestion, orders = {} }) {
  const [activeTab, setActiveTab]     = React.useState("usage");
  const [search, setSearch]           = React.useState("");
  const [sortBy, setSortBy]           = React.useState("usage");
  const [accepted, setAccepted]       = React.useState({});
  const [dismissed, setDismissed]     = React.useState({});

  const weeks       = Object.keys(usageLog).sort();
  const hasData     = weeks.length >= 2;
  const consumption = computeUsage(usageLog);

  const itemMap = {};
  inventory.forEach(sec => sec.items.forEach(item => { itemMap[item.id] = { ...item, section: sec.section }; }));

  // Build total ordered per item from all saved orders
  const totalOrdered = {};
  Object.values(orders).filter(o => o && o.saved).forEach(o => {
    (o.lines || []).forEach(l => {
      if (l.qty > 0) totalOrdered[l.id] = (totalOrdered[l.id] || 0) + l.qty;
    });
  });

  const rows = Object.entries(consumption).map(([id, vals]) => {
    const item = itemMap[id];
    if (!item) return null;
    const avg  = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
    const peak = Math.max(...vals);
    const min  = Math.min(...vals);
    const ordered = totalOrdered[id] || 0;
    return { id: Number(id), name: item.name, section: item.section, supplier: item.supplier,
             avg, peak, min, weeks: vals.length, current_reorder: item.reorder, current_max: item.max_stock,
             order_unit: item.order_unit, ordered };
  }).filter(Boolean);

  const sittingIds = new Set(Object.keys(itemMap).filter(id => !consumption[id]));

  const suggestions = rows
    .filter(r => r.weeks >= 3)
    .map(r => {
      const suggestedReorder = Math.ceil(r.peak * 1.2);
      const suggestedMax     = Math.ceil(r.avg  * 2.5);
      const reorderDiff = suggestedReorder - r.current_reorder;
      const maxDiff     = suggestedMax     - r.current_max;
      if (Math.abs(reorderDiff) < 1 && Math.abs(maxDiff) < 1) return null;
      return { ...r, suggestedReorder, suggestedMax, reorderDiff, maxDiff };
    }).filter(Boolean);

  const activeSuggestions = suggestions.filter(s => !accepted[s.id] && !dismissed[s.id]);

  const filtered = rows
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.section.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "usage")   return b.avg - a.avg;
      if (sortBy === "name")    return a.name.localeCompare(b.name);
      if (sortBy === "sitting") return a.avg - b.avg;
      return 0;
    });

  const sittingItems = Object.values(itemMap).filter(i => sittingIds.has(String(i.id)) && weeks.length >= 2);

  const barColor = (avg, peak) => {
    const ratio = peak > 0 ? avg / peak : 1;
    if (ratio > 0.8) return "#ef4444";
    if (ratio > 0.5) return "#e2e8f0";
    return "#22c55e";
  };

  const Sub   = ({ style={}, children }) => <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace", ...style }}>{children}</span>;
  const Badge = ({ bg, color, children }) => <span style={{ background:bg, color, borderRadius:5, padding:"2px 7px", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{children}</span>;
  const TabPill = ({ id, label, count }) => (
    <button onClick={() => setActiveTab(id)} style={{
      background: activeTab===id ? "#e2e8f0" : "transparent",
      border: `1px solid ${activeTab===id ? "#e2e8f0" : "#1e2d45"}`,
      borderRadius: 7, padding: "5px 16px", color: activeTab===id ? "#fff" : "#64748b",
      fontSize: 13, fontWeight: activeTab===id ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
      display:"flex", alignItems:"center", gap:6,
    }}>
      {label}
      {count > 0 && <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:10, padding:"1px 6px", fontSize:10 }}>{count}</span>}
    </button>
  );

  if (!hasData) return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Usage Tracking</h2>
        <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>Compare stock levels week over week</p>
      </div>
      <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, padding:48, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>📊</div>
        <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:600, marginBottom:8 }}>Not enough data yet</div>
        <div style={{ color:"#64748b", fontSize:13, maxWidth:380, margin:"0 auto", lineHeight:1.7 }}>
          MOE needs at least 2 weeks of stock counts to calculate usage. Keep entering stock levels each week and this view will fill in automatically.
        </div>
        <div style={{ marginTop:24, background:"#080c14", borderRadius:8, padding:"10px 20px", display:"inline-block" }}>
          <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
            {weeks.length === 0 ? "No snapshots yet" : `${weeks.length} snapshot recorded — need 2+`}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Usage Tracking</h2>
          <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>{weeks.length} weeks of data · {rows.length} items tracked</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <TabPill id="usage"       label="📊 Usage"          count={0} />
          <TabPill id="suggestions" label="💡 Par Suggestions" count={activeSuggestions.length} />
        </div>
      </div>

      {activeTab === "usage" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or sections..."
              style={{ flex:1, minWidth:200, background:"#0f1a2e", border:"1px solid #334155", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none" }}
              onFocus={e => e.target.style.borderColor="#e2e8f0"}
              onBlur={e => e.target.style.borderColor="#1e2d45"} />
            {[["usage","Highest use"],["sitting","Lowest use"],["name","Name"]].map(([k,l]) => (
              <button key={k} onClick={() => setSortBy(k)} style={{
                background: sortBy===k ? "#1e2d45" : "transparent",
                border:`1px solid ${sortBy===k ? "#475569" : "#1e2d45"}`,
                borderRadius:7, padding:"7px 14px", color: sortBy===k ? "#f1f5f9" : "#64748b",
                fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10, marginBottom:20 }}>
            {[
              { label:"Weeks tracked",   value:weeks.length,                                                               color:"#a5b4fc", bg:"#0f2040", border:"#1a3070" },
              { label:"Items tracked",   value:rows.length,                                                                color:"#4ade80", bg:"#14532d", border:"#16a34a" },
              { label:"Not moving",      value:sittingItems.length,                                                        color:"#fbbf24", bg:"#422006", border:"#d97706" },
              { label:"Par suggestions", value:activeSuggestions.length,                                                   color:"#fca5a5", bg:"#7f1d1d", border:"#b91c1c" },
            ].map(c => (
              <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
                <div style={{ color:c.color, fontSize:24, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
                <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:10, padding:32, textAlign:"center", color:"#475569" }}>No items match</div>
          ) : (
            <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px 80px 110px", background:"#080c14", padding:"8px 16px", gap:8 }}>
                {[["Item","#475569"],["Avg/wk","#475569"],["Peak","#475569"],["Ordered","#e2e8f0"],["Min","#475569"],["Trend","#475569"]].map(([h,c]) => (
                  <span key={h} style={{ color:c, fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
                ))}
              </div>
              {filtered.map((row, idx) => {
                const pct = row.peak > 0 ? Math.round((row.avg / row.peak) * 100) : 0;
                return (
                  <div key={row.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px 80px 110px", padding:"10px 16px", gap:8, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #0f172a" }}>
                    <div>
                      <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:500 }}>{row.name}</div>
                      <Sub>{String(row.section||"").replace(/[^\w\s]/g,"").trim()} · {row.weeks}wk</Sub>
                    </div>
                    <span style={{ color:"#f1f5f9", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{row.avg}</span>
                    <span style={{ color:"#fbbf24", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{row.peak}</span>
                    <span style={{ color:"#22c55e", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{row.ordered > 0 ? row.ordered : "—"}</span>
                    <span style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{row.min}</span>
                    <div>
                      <div style={{ background:"#080c14", borderRadius:4, height:6, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:barColor(row.avg,row.peak), borderRadius:4 }} />
                      </div>
                      <Sub style={{ marginTop:3 }}>{pct}% of peak</Sub>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sittingItems.length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ color:"#fbbf24", fontSize:13, fontWeight:600, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                ⚠ {sittingItems.length} item{sittingItems.length!==1?"s":""} not moving
                <span style={{ color:"#64748b", fontSize:12, fontWeight:400 }}>— no usage across {weeks.length} weeks</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {sittingItems.map(item => (
                  <div key={item.id} style={{ background:"#422006", border:"1px solid #d97706", borderRadius:6, padding:"4px 10px", color:"#fbbf24", fontSize:12 }}>{item.name}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "suggestions" && (
        <>
          <div style={{ background:"#080c14", border:"1px solid #334155", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
            <span style={{ color:"#a5b4fc", fontSize:12 }}>How it works: </span>
            <span style={{ color:"#64748b", fontSize:12 }}>MOE analyzes peak weekly usage and suggests a reorder point with a 20% safety buffer. Max stock is set to 2.5× average usage. Requires 3+ weeks of data per item.</span>
          </div>

          {activeSuggestions.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, padding:48, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
              <div style={{ color:"#4ade80", fontSize:16, fontWeight:600 }}>All par levels look good</div>
              <div style={{ color:"#64748b", fontSize:13, marginTop:6 }}>
                {rows.filter(r=>r.weeks<3).length > 0
                  ? `${rows.filter(r=>r.weeks<3).length} items need more data (3+ weeks)`
                  : "MOE has no suggestions based on current usage patterns"}
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {activeSuggestions.map(s => (
                <div key={s.id} style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:600, marginBottom:4 }}>{s.name}</div>
                    <Sub>{String(s.section||"").replace(/[^\w\s]/g,"").trim()} · {s.weeks} weeks · avg {s.avg}/wk · peak {s.peak}/wk</Sub>
                  </div>
                  <div style={{ textAlign:"center", minWidth:110 }}>
                    <Sub>Reorder point</Sub>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, justifyContent:"center" }}>
                      <span style={{ color:"#64748b", fontSize:13, fontFamily:"'DM Mono',monospace", textDecoration:"line-through" }}>{s.current_reorder}</span>
                      <span style={{ color:"#64748b", fontSize:11 }}>→</span>
                      <span style={{ color:s.reorderDiff>0?"#4ade80":"#f87171", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.suggestedReorder}</span>
                      <Badge bg={s.reorderDiff>0?"#14532d":"#7f1d1d"} color={s.reorderDiff>0?"#4ade80":"#fca5a5"}>
                        {s.reorderDiff>0?"+"+s.reorderDiff:s.reorderDiff}
                      </Badge>
                    </div>
                  </div>
                  <div style={{ textAlign:"center", minWidth:110 }}>
                    <Sub>Max stock</Sub>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, justifyContent:"center" }}>
                      <span style={{ color:"#64748b", fontSize:13, fontFamily:"'DM Mono',monospace", textDecoration:"line-through" }}>{s.current_max}</span>
                      <span style={{ color:"#64748b", fontSize:11 }}>→</span>
                      <span style={{ color:s.maxDiff>0?"#4ade80":"#f87171", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.suggestedMax}</span>
                      <Badge bg={s.maxDiff>0?"#14532d":"#7f1d1d"} color={s.maxDiff>0?"#4ade80":"#fca5a5"}>
                        {s.maxDiff>0?"+"+s.maxDiff:s.maxDiff}
                      </Badge>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <button onClick={() => { applyParSuggestion(s.id, s.suggestedReorder, s.suggestedMax); setAccepted(prev=>({...prev,[s.id]:true})); }}
                      style={{ background:"linear-gradient(135deg,#16a34a,#15803d)", border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      ✓ Apply
                    </button>
                    <button onClick={() => setDismissed(prev=>({...prev,[s.id]:true}))}
                      style={{ background:"transparent", border:"1px solid #334155", borderRadius:7, padding:"7px 12px", color:"#64748b", fontSize:12, cursor:"pointer" }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(accepted).length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ color:"#4ade80", fontSize:12, fontFamily:"'DM Mono',monospace", marginBottom:8 }}>✓ Applied this session</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.keys(accepted).map(id => {
                  const s = suggestions.find(s => String(s.id)===String(id));
                  return s ? <div key={id} style={{ background:"#14532d", border:"1px solid #16a34a", borderRadius:6, padding:"4px 10px", color:"#4ade80", fontSize:12 }}>{s.name}</div> : null;
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SETTINGS VIEW ────────────────────────────────────────────────────────────
function SettingsView({ settings, saveSettings, inventory = [] }) {
  const [vendors, setVendors] = useState(
    settings.vendors && settings.vendors.length > 0
      ? settings.vendors
      : [{ id: Date.now(), name: "", orderDay: 3, deliveryDay: 4, autoReset: true }]
  );

  // Extract unique supplier names from inventory
  const supplierOptions = React.useMemo(() => {
    const names = new Set();
    inventory.forEach(sec => sec.items.forEach(item => {
      const s = (item.supplier || "").trim();
      if (s) names.add(s);
    }));
    return Array.from(names).sort();
  }, [inventory]);

  const updateVendor = (id, field, value) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const addVendor = () => {
    setVendors(prev => [...prev, { id: Date.now(), name: "", orderDay: 3, deliveryDay: 4, autoReset: true }]);
  };

  const removeVendor = (id) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const handleSave = () => {
    saveSettings({ ...settings, orderDay: vendors[0]?.orderDay ?? 3, vendors });
  };

  const inputStyle = { background:"#080c14", border:"1px solid #334155", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" };
  const selectStyle = { ...inputStyle, cursor:"pointer" };
  const labelStyle = { display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Settings</h2>
        <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>Set order and delivery schedules per vendor</p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
        {vendors.map((vendor, idx) => (
          <div key={vendor.id} style={{ background:"#0f1a2e", border:"1px solid #334155", borderRadius:12, padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>
                Vendor {idx + 1}
              </span>
              {vendors.length > 1 && (
                <button onClick={() => removeVendor(vendor.id)}
                  style={{ background:"transparent", border:"1px solid #334155", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"3px 8px" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
                  Remove
                </button>
              )}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={labelStyle}>Vendor Name</label>
                {supplierOptions.length > 0 ? (
                  <div style={{ display:"flex", gap:8 }}>
                    <select value={vendor.name} onChange={e => updateVendor(vendor.id, "name", e.target.value)}
                      style={{ ...selectStyle, flex:1 }}
                      onFocus={e => e.target.style.borderColor="#e2e8f0"}
                      onBlur={e => e.target.style.borderColor="#1e2d45"}>
                      <option value="">— Select supplier —</option>
                      {supplierOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__">+ Type manually...</option>
                    </select>
                    {vendor.name === "__custom__" && (
                      <input autoFocus placeholder="Type vendor name..."
                        onChange={e => updateVendor(vendor.id, "name", e.target.value)}
                        style={{ ...inputStyle, flex:1 }}
                        onFocus={e => e.target.style.borderColor="#e2e8f0"}
                        onBlur={e => e.target.style.borderColor="#1e2d45"} />
                    )}
                  </div>
                ) : (
                  <input value={vendor.name} onChange={e => updateVendor(vendor.id, "name", e.target.value)}
                    placeholder="e.g. Anacapri, Pepsi, Market..."
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor="#e2e8f0"}
                    onBlur={e => e.target.style.borderColor="#1e2d45"} />
                )}
              </div>
            </div>

            {/* ── Schedules (multiple order/delivery day pairs) ── */}
            <div style={{ marginBottom:12 }}>
              <label style={{ ...labelStyle, marginBottom:8 }}>Order & Delivery Schedule</label>
              {(vendor.schedules || [{ orderDay: vendor.orderDay ?? 3, deliveryDay: vendor.deliveryDay ?? 4 }]).map((sched, si) => (
                <div key={si} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, marginBottom:8, alignItems:"end" }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize:9, marginBottom:3 }}>Order Day</label>
                    <select value={sched.orderDay}
                      onChange={e => {
                        const newScheds = [...(vendor.schedules || [{ orderDay: vendor.orderDay ?? 3, deliveryDay: vendor.deliveryDay ?? 4 }])];
                        newScheds[si] = { ...newScheds[si], orderDay: parseInt(e.target.value) };
                        updateVendor(vendor.id, "schedules", newScheds);
                        if (si === 0) updateVendor(vendor.id, "orderDay", parseInt(e.target.value));
                      }}
                      style={selectStyle}
                      onFocus={e => e.target.style.borderColor="#e2e8f0"}
                      onBlur={e => e.target.style.borderColor="#1e2d45"}>
                      {DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize:9, marginBottom:3 }}>Delivery Day</label>
                    <select value={sched.deliveryDay}
                      onChange={e => {
                        const newScheds = [...(vendor.schedules || [{ orderDay: vendor.orderDay ?? 3, deliveryDay: vendor.deliveryDay ?? 4 }])];
                        newScheds[si] = { ...newScheds[si], deliveryDay: parseInt(e.target.value) };
                        updateVendor(vendor.id, "schedules", newScheds);
                        if (si === 0) updateVendor(vendor.id, "deliveryDay", parseInt(e.target.value));
                      }}
                      style={selectStyle}
                      onFocus={e => e.target.style.borderColor="#e2e8f0"}
                      onBlur={e => e.target.style.borderColor="#1e2d45"}>
                      {DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ display:"flex", gap:6, paddingBottom:1 }}>
                    <div style={{ background:"#080c14", borderRadius:6, padding:"6px 8px", fontSize:10, color:"#475569", whiteSpace:"nowrap" }}>
                      📅 {DAYS[sched.orderDay]?.slice(0,3)} → 📦 {DAYS[sched.deliveryDay]?.slice(0,3)}
                    </div>
                    {(vendor.schedules || []).length > 1 && (
                      <button onClick={() => {
                        const newScheds = (vendor.schedules || []).filter((_,i) => i !== si);
                        updateVendor(vendor.id, "schedules", newScheds);
                      }}
                        style={{ background:"none", border:"1px solid #334155", borderRadius:6, color:"#475569", cursor:"pointer", fontSize:12, padding:"0 8px", height:32 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Add schedule button */}
              {(vendor.schedules || [{ orderDay: vendor.orderDay ?? 3, deliveryDay: vendor.deliveryDay ?? 4 }]).length < 5 && (
                <button onClick={() => {
                  const current = vendor.schedules || [{ orderDay: vendor.orderDay ?? 3, deliveryDay: vendor.deliveryDay ?? 4 }];
                  updateVendor(vendor.id, "schedules", [...current, { orderDay: 1, deliveryDay: 2 }]);
                }}
                  style={{ background:"none", border:"1px dashed #334155", borderRadius:7, color:"#475569", cursor:"pointer", fontSize:12, padding:"6px 14px", display:"flex", alignItems:"center", gap:5, transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
                  ＋ Add another order day
                </button>
              )}
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ position:"relative", width:40, height:22, flexShrink:0 }}>
                <input type="checkbox" checked={vendor.autoReset} onChange={e => updateVendor(vendor.id, "autoReset", e.target.checked)}
                  style={{ opacity:0, width:"100%", height:"100%", position:"absolute", cursor:"pointer", zIndex:1, margin:0 }} />
                <div style={{ position:"absolute", inset:0, borderRadius:11, background: vendor.autoReset ? "#e2e8f0" : "#1e2d45", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:2, left: vendor.autoReset ? 20 : 2, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </div>
              </div>
              <div>
                <div style={{ color:"#f1f5f9", fontSize:12, fontWeight:500 }}>Auto-reset stock at end of order day</div>
                <div style={{ color:"#475569", fontSize:11, marginTop:1 }}>Only this vendor's items will reset to 0</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {vendors.length < 8 && (
          <button onClick={addVendor}
            style={{ background:"none", border:"1px dashed #334155", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"10px 20px", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
            ＋ Add Vendor
          </button>
        )}
        <button onClick={handleSave}
          style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"10px 24px", color:"#080c14", fontSize:14, fontWeight:600, cursor:"pointer" }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div style={{ background:"#080c14", padding:"8px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #334155", borderBottom:"none" }}>
      <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>{label}</span>
    </div>
  );
}
