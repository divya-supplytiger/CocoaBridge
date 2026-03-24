// Commercial Item Description (CID) specifications — structured reference data.
// Key sections extracted from USDA CID PDFs. Keyed by CID code.

export const CID_SPECS = {
  "A-A-20177G": {
    cid: "A-A-20177G",
    pscCode: "8925",
    title: "Candy and Chocolate Confections",
    supersedes: "A-A-20177F",
    date: "May 14, 2025",

    scope:
      "This CID covers candy and chocolate confections (candy), packed in commercially acceptable containers, suitable for use by Federal, State, local governments, other interested parties, and as a component of operational rations.",

    classification: {
      description: "Types, styles, flavors, and flavor styles.",
      types: [
        { type: "I", name: "Chocolate flavored toffee", styles: ["A - Roll", "B - Cube"] },
        { type: "II", name: "Toffee with walnuts" },
        {
          type: "III", name: "Hard candy",
          styles: [
            "A - Square or rectangular fruit tablets, 28.35g (1.0 oz bar)",
            "B - Square fruit tablets, 45.40g (1.6 oz bar)",
            "C - Round or oval (flavors: caramel, butter rum, coffee, strawberry crème, other)",
            "D - Rings (flavors: assorted fruit, cherry, tropical fruit, butter rum, berry, other)",
            "E - Rings, sugar free (flavors: assorted fruit, cherry, other)",
            "F - Other",
          ],
        },
        {
          type: "IV", name: "Pan coated candy",
          styles: [
            "A - Disks (flavors: milk chocolate plain, fruit flavored [original/berry/tropical/sour], milk chocolate w/ peanut butter, peanut butter plain, cinnamon, dark chocolate plain, other)",
            "B - Oval/Round (flavors: milk chocolate w/ peanuts, dark chocolate coffee beans, milk chocolate w/ almonds, dark chocolate w/ peanuts, other)",
            "C - Flat bottom tear drop (flavors: milk chocolate plain, other)",
          ],
        },
        {
          type: "V", name: "Licorice style candy",
          styles: [
            "A - Twists (flavors: strawberry, cherry, watermelon, black licorice, grape, apple, chocolate, cinnamon, other)",
            "B - Bite size (flavors: cherry, black licorice, other)",
            "C - Rope/pull and peel (flavors: strawberry, cherry, watermelon, other)",
            "D - Other",
          ],
        },
        {
          type: "VI", name: "Mint candy",
          styles: [
            "A - Round tablets (flavors: wintergreen, peppermint, spearmint, crème de menthe, cinnamon, other)",
            "B - Rings (flavors: wintergreen, peppermint, spearmint, orange mint, butter mint, other)",
            "C - Rings, sugar free (flavors: wintergreen, peppermint, other)",
            "D - Squared mini tablets, sugar free (flavors: peppermint, cinnamon, wintergreen, other)",
          ],
        },
        {
          type: "VII", name: "Caffeinated mint",
          styles: [
            "A - Round tablets (flavors: peppermint, other)",
            "B - Round tablets, sugar free (flavors: peppermint, other)",
            "C - Other",
          ],
        },
        {
          type: "VIII", name: "Caffeinated jelly beans",
          styles: ["A - Bean-shaped (flavors: berry, cherry, fruit, lemon, orange, pomegranate, watermelon, mixed, other)", "B - Other"],
        },
        {
          type: "IX", name: "Caffeinated chewables/gels",
          styles: ["A - Dome-shaped (flavors: cherry cola, lime, kiwi, other)", "B - Other"],
        },
        { type: "X", name: "Other" },
      ],
    },

    salientCharacteristics: {
      sugarFree: "Defined per 21 CFR §101.60(c): less than 0.5g sugars per reference amount and per labeled serving.",
      labeling: "All ingredients declared by common name in descending order of predominance (21 CFR §101.4). Milk chocolate must comply with 21 CFR §163.130. Peanut butter must conform to 21 CFR §164.150. Dark chocolate must conform to 21 CFR §163.111.",
      dairyIngredients: "Must comply with 21 CFR Parts 131-169 and originate from USDA AMS Dairy Program approved plants.",
      additionalIngredients: "Must meet FCC or USP-National Formulary standards. Must be FDA-approved food additives (21 CFR Part 170) or GRAS (21 CFR Parts 182, 184).",
      finishedProduct: [
        "Type I (Chocolate toffee): corn syrup, sugar, palm oil, condensed milk, cocoa. Semi-sweet chocolate/caramel odor and flavor. Roll: 14g individually wrapped. Cube: 2.54cm x 2.54cm x 1.27cm, 5 pieces ≥ 40g.",
        "Type II (Toffee w/ walnuts): corn syrup, sugar, condensed whole milk, walnuts, coconut oil, cream. Soft, chewy. 5 pieces ≥ 40g.",
        "Type III Style A/B (Hard candy tablets): sugar, corn syrup, citric/malic acid, natural/artificial flavors. Sweet fruity odor and flavor. Style A: 10 units = 28.35g bar. Style B: 10 units = 45.40g bar.",
        "Type III Style C (Round/oval): sugar, corn syrup, hydrogenated coconut oil. Hard texture, dissolves slowly. Package ≥ 39.69g.",
        "Type III Style D (Rings): sugar, corn syrup, natural/artificial flavors. Hole in center. Package ≥ 32g.",
        "Type IV (Pan coated): sugar, corn syrup, natural/artificial flavors, FD&C colors. Hard candy shell, high gloss, vibrant uniform colors. Milk chocolate disks: 480-540 count/lb, 47.91g/bag.",
        "Type V (Licorice): corn syrup, wheat flour, artificial flavors, FD&C colors. Glossy, soft chewy texture. Bite size: 180-220 count/lb, ≥ 63g.",
        "Type VI (Mint): sugar, natural/artificial flavors. Firm, not hard or brittle. Round tablets: ≥ 49.89g. Rings: ≥ 32.03g.",
        "Type VII (Caffeinated mint): sugar, corn syrup, caffeine. Style A: 50-90mg caffeine per 10g package. Style B sugar free: 80-120mg caffeine per tablet.",
        "Type VIII (Caffeinated jelly beans): evaporated cane juice, fruit juices, caffeine. 50-100mg caffeine per 28g. Soft chewy interior, firm candy shell. ≥ 28.35g.",
        "Type IX (Caffeinated chewables/gels): cane sugar, tapioca syrup, caffeine. 50-100mg caffeine per 50g. Soft pectin-based bite. ≥ 50g.",
      ],
      aflatoxinTesting: "All USDA-certified candy tested for aflatoxin. Must not exceed 15 ppb. Manufacturer-certified candy requires Certificate of Analysis.",
      foreignMaterial: "Ingredients must not exceed Defect Action Levels (21 CFR §117.110). Free from extraneous plant material, hair, plastic, metal, rodent/insect infestation.",
    },

    analyticalRequirements: {
      table: [
        { type: "I Style A", description: "Chocolate toffee roll", moisture: "5.0-8.0%" },
        { type: "I Style B", description: "Chocolate toffee cube", moisture: "5.0-9.5%" },
        { type: "II", description: "Toffee with walnuts", moisture: "5.0-9.5%" },
        { type: "IV Style A Flavor 2", description: "Pan coated disks, fruit", pH: "2.0-4.0" },
        { type: "IV Style B Flavor 2", description: "Dark chocolate coffee beans", moisture: "NMT 2.0%" },
        { type: "V Styles A/B", description: "Licorice twists/bite size", moisture: "NMT 15.0%" },
        { type: "V Style C", description: "Licorice rope", moisture: "NMT 16.5%" },
        { type: "VII Style A", description: "Caffeinated mints round", caffeine: "50-90mg per 10g package" },
        { type: "VII Style B", description: "Caffeinated mints sugar free", caffeine: "80-120mg per tablet" },
        { type: "VIII Style A", description: "Caffeinated jelly beans", moisture: "NMT 6.0%", caffeine: "50-100mg per 28g" },
        { type: "IX Style A", description: "Caffeinated chewables/gels", moisture: "NMT 16.0%", caffeine: "50-100mg per 50g" },
      ],
      aflatoxin: "Type IV Style A Flavors 3/4 and Style B Flavors 1/3/4: not more than 15 ppb.",
      microbiological: "All chocolate flavors and Type IV candy must test negative for Salmonella.",
      testMethods: "Moisture: AOAC 925.45A/925.49/934.06. Salmonella: AOAC 967.26(e)/996.08/2001.09/2003.09/2004.03. pH: AOAC 981.12. Caffeine: AOAC 980.14. Aflatoxin: AOAC 970.45/991.31.",
    },

    qualityAssurance:
      "Purchaser specifies manufacturer's/distributor's certification (Sec 10.3) or USDA certification (Sec 10.4). Options for Food Defense Systems Survey (FDSS) or Plant Systems Audit (PSA) via USDA AMS SCP SCI Division. Manufacturer must certify candy meets CID salient characteristics and is same product sold commercially.",

    packaging:
      "Preservation, packaging, packing, labeling, and case marking must be commercial unless otherwise specified in the solicitation, contract, or purchase order.",
  },

  "A-A-20001C": {
    cid: "A-A-20001C",
    pscCode: "8950",
    title: "Spices and Spice Blends",
    supersedes: "A-A-20001B",
    date: "August 28, 2023",

    scope:
      "This CID covers spices and spice blends, packed in commercially acceptable containers, suitable for use by Federal, State, local governments, other interested parties, and as a component of operational rations.",

    classification: {
      description: "Types, spices, forms, spice blends, salt-free seasonings, and agricultural practices.",
      types: [
        {
          type: "I", name: "Spice",
          items: [
            "A - Allspice", "B - Anise Seed", "C - Basil, Sweet", "D - Bay Leaves",
            "E - Caraway Seed", "F - Cardamom Seed", "G - Celery Seed", "H - Chives",
            "I - Cinnamon", "J - Cloves", "K - Coriander", "L - Cumin", "M - Dill Weed",
            "N - Fennel Seed", "O - Fenugreek", "P - Ginger", "Q - Mace",
            "R - Marjoram, Sweet", "S - Mustard Flour", "T - Nutmeg", "U - Oregano",
            "V - Paprika", "W - Parsley", "X - Pepper, Black", "Y - Pepper, Red",
            "Z - Pepper, White", "AA - Poppy Seed", "BB - Rosemary", "CC - Sage",
            "DD - Savory", "EE - Sesame Seed", "FF - Tarragon", "GG - Thyme",
            "HH - Turmeric", "II - Vanilla Bean", "JJ - Other",
          ],
          forms: ["1 - Ground", "2 - Whole", "3 - Crushed", "4 - Chopped", "5 - Cut (Sticks)", "6 - Flakes"],
        },
        {
          type: "II", name: "Spice Blends",
          items: [
            "A - Barbecue Seasoning", "B - Cajun Seasoning",
            "C - Chesapeake Bay Style Seafood Seasoning", "D - Chili Powder",
            "E - Creole Seasoning", "F - Curry Powder", "G - Fajita Seasoning",
            "H - Italian Seasoning", "I - Jerk Seasoning", "J - Lemon Pepper Seasoning",
            "K - Picante Seasoning", "L - Pizza Seasoning", "M - Poultry Seasoning",
            "N - Powdered Hot Sauce Seasoning", "O - Southwest Seasoning", "P - Other",
          ],
        },
      ],
      saltFreeSeasonings: [
        "(1) With Herbs and Citrus", "(2) With Garlic and Herbs",
        "(3) Italian Seasoning", "(4) Lemon Pepper",
        "(5) With Vegetables", "(6) Other",
      ],
      agriculturalPractices: ["(i) Conventional", "(ii) Organic"],
    },

    salientCharacteristics: {
      definitions: {
        spice: "Any aromatic vegetable substance in whole, broken, or ground form whose significant function is seasoning rather than nutritional (21 CFR §101.22(a)(2)). True to name; no portion of volatile oil or flavoring principle removed.",
        spiceBlend: "A combination of two or more individual spices, optionally mixed with herbs, salts, vegetables, fruits, vinegar, or extracts. Dry form with names indicating main ingredients or intended use.",
      },
      blendDescriptions: [
        "Barbecue: reddish-brown powder, spicy/salty/slightly sweet with garlic, onion, hickory smoke. Includes celery seed, coriander, peppers, paprika, salt, cumin, natural smoke flavor.",
        "Cajun: red granular, spicy hot peppery. Includes salt, red pepper, paprika, garlic, onion.",
        "Chesapeake Bay Seafood: orange-brown blend, spicy hot with pungent aroma. Includes celery salt, mustard, red/black pepper, bay leaves, cloves, allspice, ginger, mace, cardamom, cinnamon, paprika.",
        "Chili Powder: reddish-brown, no lumps. Includes ground chili pepper, cumin, oregano, salt, garlic powder.",
        "Curry Powder: uniform color, fragrant aromatic, warm bitter taste. Includes turmeric, coriander, fenugreek, cinnamon, cumin, black pepper, ginger, cardamom.",
        "Italian Seasoning: green leaf blend. Includes thyme, rosemary, sage, oregano, basil. Pungent, spicy, slightly bitter.",
        "Jerk: brown powder with red/white specks and green leaf. Strong allspice with sweet red pepper and onion.",
        "Lemon Pepper: yellow/black granular. Sharp pungent pepper with tart lemon. Includes salt, black pepper, sugar, citric acid, lemon flavoring.",
        "Pizza: herbs with red/green flakes. Cheesy, medium pungent with garlic/onion. Includes parmesan, garlic, onion, red pepper, thyme, basil, oregano.",
        "Poultry: uniform color, fragrant aromatic, warm pungent. Includes sage, thyme, black pepper.",
        "Hot Sauce Powder: dark reddish-orange, salty/dry aged peppers/sour vinegar/garlic. Includes chili powder, salt, garlic powder, vinegar powder.",
        "Southwest: dark red-orange, salty/spicy chili pepper. Includes salt, paprika, chili powder, cumin, coriander, cayenne, black pepper, crushed red pepper, garlic.",
      ],
      saltFreeDescriptions: [
        "(1) Herbs & Citrus: black/brown/green/orange/red/tan particles. Slight pungency with garlic, pepper, herbs, citrus. Includes onion, peppers, parsley, celery seed, basil, bay leaves, lemon peel, orange peel.",
        "(2) Garlic & Herbs: black/green/yellow/tan particles. Garlic and onion flavor. Includes garlic, oregano, rosemary, basil, peppers, paprika, orange peel, onion.",
        "(3) Italian: green leaf pieces. Pungent, spicy, slightly bitter. Includes garlic, onion, oregano, rosemary, parsley, celery seed.",
        "(4) Lemon Pepper: yellow/black particles. Pungent pepper with lemon, hint of onion/garlic. Includes black pepper, citric acid, onion, oregano, thyme, cumin, garlic, lemon peel.",
        "(5) Vegetables: off-white/tan/red/green dehydrated vegetable pieces. Spicy with hint of citrus. Includes onion, garlic, carrot, tomato, red bell pepper, red pepper, spices, orange peel.",
      ],
      organicIngredients: "When organic is specified, must be produced/handled/labeled per USDA National Organic Program (7 CFR Part 205). Certificate of Organic Production or Handling required.",
      additionalIngredients: "Must meet FCC or USP-National Formulary standards. Must be FDA-approved food additives (21 CFR Part 170) or GRAS (21 CFR Parts 182, 184).",
      foreignMaterial: "Must be clean, sound, wholesome, free from extraneous plant material, dirt, plastic, insects, or rodent/insect infestation.",
    },

    analyticalRequirements: {
      note: "Detailed analytical tables specify moisture max %, volatile oil min %, total ash max %, acid insoluble ash max %, particle size, and ASTA color units per spice. Key examples below.",
      keySpecs: [
        { spice: "Allspice", moisture: "10.0%", volatileOil: "3.0%", totalAsh: "6.0%", acidInsolubleAsh: "0.5%" },
        { spice: "Cinnamon", moisture: "14.0%", volatileOil: "1.5%", totalAsh: "5.0%", acidInsolubleAsh: "2.0%" },
        { spice: "Pepper, Black", moisture: "12.0%", volatileOil: "1.0%", totalAsh: "7.0%", acidInsolubleAsh: "1.5%" },
        { spice: "Paprika", moisture: "11.0%", volatileOil: "--", totalAsh: "8.5%", acidInsolubleAsh: "1.0%", astaColor: "Min 120" },
        { spice: "Pepper, Red", moisture: "11.0%", volatileOil: "--", totalAsh: "8.5%", acidInsolubleAsh: "1.5%", scoville: "Min 30,000" },
      ],
      microbiological: "Aerobic plate count: <1,000,000 CFU/g (spices), <500,000 CFU/g (blends). E. coli: negative. Salmonella: negative per 25g.",
      testMethods: "Moisture: AOAC 925.10/934.01. Volatile oil: ASTA 5.0. Total/acid insoluble ash: AOAC 941.12/942.03. Salmonella: AOAC 967.26/996.08/2003.09. E. coli: AOAC 991.14.",
    },

    qualityAssurance:
      "Purchaser specifies manufacturer's/distributor's certification (Sec 10.3) or USDA certification (Sec 10.4). Options for FDSS or PSA via USDA AMS SCP SCI Division. Manufacturer must certify spices meet CID salient characteristics and are same product sold commercially.",

    packaging:
      "Preservation, packaging, packing, labeling, and case marking must be commercial unless otherwise specified in the solicitation, contract, or purchase order.",
  },

  "A-A-20331B": {
    cid: "A-A-20331B",
    pscCode: "8970",
    title: "Food Packets, Survival",
    supersedes: "A-A-20331A",
    date: "January 22, 2020",

    scope:
      "This CID covers special purpose food packets, designed for survival and for use in life rafts in aircraft or on abandon ships, packed in commercially acceptable flexible containers. The food packets are intended to provide survivors in life rafts adequate nutrition for 3 days.",

    classification: {
      description: "Types of survival food packets.",
      types: [
        { type: "I", name: "Consists of hard candy fruit tablets and chewing gum tablets" },
        { type: "II", name: "Consists of carbohydrate food bars" },
      ],
    },

    salientCharacteristics: {
      labeling: "All ingredients declared by common name in descending order of predominance (21 CFR §101.4(a)). Components must comply with 21 CFR §101.22.",
      typeI: {
        description: "Contains 2 packages hard candy fruit tablets (square/rectangular, individually wrapped, 10 per 28.35g/1.0oz bar) and 2 packages candy-coated chewing gum tablets (1 peppermint, 1 spearmint, 2 tablets each). Also contains instruction sheet and optional twine.",
        hardCandy: "Sugar, corn syrup, citric/malic acid, natural/artificial flavors. Various fruit flavors. Sweet fruity odor and flavor. Must not adhere to wrappers.",
        chewingGum: "Sucrose/dextrose/corn syrup, water-insoluble chewing gum base, softening/plasticizing ingredients, humectant, flavoring, FDA-approved colors. Coating: gum/gelatin/starch/protective materials. Each tablet: 1.1-1.6g, 1.4-2.5cm x 0.89-1.6cm x 0.4-0.9cm. Must be fresh, not sticky/grainy/flabby/stringy.",
      },
      typeII: {
        description: "Equally shaped individually wrapped portions providing 800 kcal per person per day. Must not exceed 600 cm³ volume and 567g weight. Minimum 10,000 kJ (2,390 kcal) with 45% kcals from carbohydrates.",
        ingredients: "Flour, vegetable oil/shortening, sweeteners, natural/artificial flavorings. May contain thickening agents, water, salt, FDA-approved colors, preservatives.",
        appearance: "Light to darker golden-brown, dense, flat surfaces. Sweet toasted grain, oily/buttery/slight dairy flavor. Firm, dense, slightly crunchy, slightly oily, easy to bite and chew. No off-odors or off-flavors.",
      },
      foreignMaterial: "Must be clean, sound, wholesome, free from extraneous plant material, dirt, plastic, insects, or rodent/insect infestation.",
      shelfLife: "5 years minimum when stored at 26.7°C (80°F).",
      ageRequirement: "Processed and packaged not more than 90 days prior to delivery unless otherwise specified.",
      thirstProvocation: "Components must not excessively provoke thirst.",
    },

    analyticalRequirements: {
      typeI: {
        test: "Water-insoluble base",
        requirement: "Not less than 13.0% by weight",
        method: "Chew sample vigorously 10 min, dry at 100°C in vacuum oven (≤100 mmHg) for ≥2 hours, calculate percentage.",
      },
      typeII: [
        { test: "Protein", requirement: "Calories from protein must not exceed 8.0%", method: "AOAC 984.13 or 992.15" },
        { test: "Sodium", requirement: "Not more than 50mg per 100g", method: "AOAC 985.35, 2011.14, or 2011.19" },
        { test: "Moisture", requirement: "Not more than 7.0%", method: "AOAC 925.45 at 70°C for 16 hours" },
      ],
    },

    qualityAssurance:
      "Purchaser specifies manufacturer's/distributor's certification (Sec 10.3) or USDA certification (Sec 10.4). Options for FDSS or PSA via USDA AMS SCP SCI Division. When DoD specifies, 6 units of Type I and II must be submitted to Army Combat Capabilities Command - Soldier Center, Natick, MA for evaluation.",

    packaging:
      "Preservation, packaging, packing, labeling, and case marking must be commercial unless otherwise specified in the solicitation, contract, or purchase order.",
  },
};

// Lookup by PSC code — returns array since a PSC may have multiple CIDs
export function getCidSpecsByPsc(pscCode) {
  return Object.values(CID_SPECS).filter((spec) => spec.pscCode === pscCode);
}

export const CID_PSC_CODES = ["8925", "8950", "8970"];
