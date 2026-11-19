/* =============================================================================
   Sophie Barat — collection data (the single file to edit)
   -----------------------------------------------------------------------------
   This data feeds both the collection cards and the 3D configurator.
   Fabrics and finishes are PROPOSALS, to be approved by the school
   (field `aValider: true` = a "To be confirmed" tag is shown).
   ========================================================================== */

export const COLORS = {
  nuit:       { label: 'Midnight blue', hex: '#0b1a40' },
  electrique: { label: 'Electric blue', hex: '#075cf0' },
  violet:     { label: 'Violet',        hex: '#6026d9' },
  blanc:      { label: 'White',         hex: '#e9edf6' },
};

/* Each item:
   - id            : identifier (do not change: it matches the 3D model)
   - type          : 'haut' (top) or 'bas' (bottom)
   - pour          : 3D models the item is offered on
   - couleurDefaut : colour shown on load */
export const ITEMS = [
  {
    id: 'bomber', type: 'haut', pour: ['garcon', 'fille'], categorie: 'Bombers / jackets',
    nom: 'The signature bomber',
    description: 'A modern, comfortable and elegant uniform, designed for today and for tomorrow. Stand-up collar, zip fastening and striped ribbing in the school’s colours.',
    matiere: 'Proposed: technical twill, light lining',
    coupe: 'Straight, hip length',
    details: ['Ribbed stand-up collar', 'Full-length zip', 'Electric blue and violet striped ribbing', 'Contrast band on the sleeves', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['coupe', 'Contemporary cut'], ['palette', 'Electric blue details'], ['nuage', 'Comfortable fabrics']],
    couleurs: ['nuit', 'electrique', 'violet', 'blanc'], couleurDefaut: 'nuit', aValider: true,
  },
  {
    id: 'polo', type: 'haut', pour: ['garcon', 'fille'], categorie: 'Polos',
    nom: 'The signature polo',
    description: 'A clean silhouette, a contrast collar and subtle embroidery: the everyday essential, easy to wear and easy to care for.',
    matiere: 'Proposed: cotton piqué',
    coupe: 'Straight, short sleeves',
    details: ['Ribbed collar and cuffs', 'Contrast tipping on the sleeves', 'Three-button placket', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['col', 'Contrast collar'], ['palette', 'Electric blue tipping'], ['nuage', 'Breathable knit']],
    couleurs: ['blanc', 'nuit', 'electrique', 'violet'], couleurDefaut: 'blanc', aValider: true,
  },
  {
    id: 'pullv', type: 'haut', pour: ['garcon', 'fille'], categorie: 'V-neck jumpers',
    nom: 'The V-neck jumper',
    description: 'A classic, reimagined: a fine knit, a V-neck that frames the polo collar and a contrast band on the sleeve.',
    matiere: 'Proposed: fine knit',
    coupe: 'Fitted',
    details: ['Ribbed V-neck, hem and cuffs', 'Electric blue band on the sleeve', 'Worn over the polo', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['coupe', 'Fitted cut'], ['palette', 'Contrast band'], ['nuage', 'Soft knit']],
    couleurs: ['nuit', 'electrique', 'violet', 'blanc'], couleurDefaut: 'nuit', aValider: true,
  },
  {
    id: 'hoodie', type: 'haut', pour: ['garcon', 'fille'], categorie: 'Hoodies',
    nom: 'The essential hoodie',
    description: 'A comfortable piece with a confident style, marked with the SB monogram. Hood, kangaroo pocket and ribbed trims.',
    matiere: 'Proposed: brushed fleece',
    coupe: 'Relaxed',
    details: ['Drawstring hood', 'Kangaroo pocket', 'Ribbed hem and cuffs', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['coupe', 'Relaxed fit'], ['poche', 'Kangaroo pocket'], ['nuage', 'Cosy fleece']],
    couleurs: ['nuit', 'electrique', 'violet', 'blanc'], couleurDefaut: 'nuit', aValider: true,
  },
  {
    id: 'pantalon', type: 'bas', pour: ['garcon', 'fille'], categorie: 'Trousers',
    nom: 'The campus trousers',
    description: 'A generous straight leg, a sharp front crease and side piping that echoes the school’s palette.',
    matiere: 'Proposed: cotton twill',
    coupe: 'Wide straight leg',
    details: ['Waistband', 'Pressed front crease', 'Electric blue side piping', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['coupe', 'Straight leg'], ['palette', 'Side piping'], ['nuage', 'Everyday comfort']],
    couleurs: ['nuit', 'electrique', 'violet', 'blanc'], couleurDefaut: 'nuit', aValider: true,
  },
  {
    id: 'jupe', type: 'bas', pour: ['fille'], categorie: 'Skirts',
    nom: 'The pleated skirt',
    description: 'Even pleats and a clean waistband, for an elegant silhouette that moves with you.',
    matiere: 'Proposed: twill',
    coupe: 'Pleated, above the knee',
    details: ['Waistband', 'Even knife pleats', 'Embroidered SB monogram'],
    points: [['broderie', 'SB embroidery'], ['coupe', 'Knife pleats'], ['palette', 'The school’s palette'], ['nuage', 'Fluid drape']],
    couleurs: ['nuit', 'electrique', 'violet', 'blanc'], couleurDefaut: 'nuit', aValider: true,
  },
];

/* 3D outfits: one realistic figure per outfit (files in assets/models/personnages/).
   zones: height range (in metres, feet = 0) taken up by each piece, and its original shade
   ('navy' = midnight blue, 'white' = white) — used for recolouring.
   bras: for each arm, [x, y, z of the top of the forearm, x, y, z of the wrist, radius] in metres
   (measured on the baked model by source/ai/measure_arms.py, values copied as is): the bottom of the sleeves,
   which falls below the top of the skirt or trousers, therefore follows the colour of the top. */
export const TENUES = [
  { id: 'garcon-bomber', model: 'garcon', haut: 'bomber', bas: 'pantalon', zones: { haut: [0.92, 1.62, 'navy'], bas: [0.03, 0.905, 'navy'] }, bras: [[-0.2553,0.97,0.0209,-0.2159,0.8758,0.0538,0.0689],[0.2299,0.97,0.0272,0.2163,0.875,0.0583,0.07]] },
  { id: 'garcon-polo', model: 'garcon', haut: 'polo', bas: 'pantalon', zones: { haut: [1.0, 1.52, 'white'], bas: [0.03, 1.03, 'navy'] } },
  { id: 'garcon-pullv', model: 'garcon', haut: 'pullv', bas: 'pantalon', zones: { haut: [0.92, 1.6, 'navy'], bas: [0.03, 0.895, 'navy'] }, bras: [[-0.2147,0.97,0.0129,-0.218,0.8691,0.0377,0.07],[0.2261,0.98,0.0184,0.2138,0.8713,0.0567,0.0628]] },
  { id: 'garcon-hoodie', model: 'garcon', haut: 'hoodie', bas: 'pantalon', zones: { haut: [0.92, 1.62, 'navy'], bas: [0.03, 0.91, 'navy'] }, bras: [[-0.2276,0.97,0.032,-0.2258,0.8845,0.0604,0.07],[0.2613,0.96,0.0386,0.2216,0.8874,0.0765,0.0608]] },
  { id: 'fille-pullv', model: 'fille', haut: 'pullv', bas: 'jupe', zones: { haut: [0.94, 1.5, 'navy'], bas: [0.5, 0.93, 'navy'] }, bras: [[-0.207,0.99,-0.0029,-0.1813,0.8195,0.0523,0.0594],[0.2146,0.98,0.0085,0.1787,0.8192,0.0717,0.0615]] },
  { id: 'fille-polo', model: 'fille', haut: 'polo', bas: 'pantalon', zones: { haut: [0.95, 1.41, 'white'], bas: [0.03, 0.99, 'navy'] } },
  { id: 'fille-bomber', model: 'fille', haut: 'bomber', bas: 'jupe', zones: { haut: [0.935, 1.5, 'navy'], bas: [0.5, 0.925, 'navy'] }, bras: [[-0.2213,0.985,0.0225,-0.1852,0.8187,0.0403,0.0572],[0.2161,0.975,0.0054,0.1766,0.8206,0.0602,0.0561]] },
  { id: 'fille-hoodie', model: 'fille', haut: 'hoodie', bas: 'jupe', zones: { haut: [0.935, 1.52, 'navy'], bas: [0.5, 0.925, 'navy'] }, bras: [[-0.2214,0.995,0.0102,-0.1849,0.8189,0.0727,0.058],[0.2168,0.985,0.0142,0.1748,0.8197,0.0738,0.0557]] },
];

/* Outfit shown on load for each model */
export const DEFAULT_TENUE = { garcon: 'garcon-bomber', fille: 'fille-pullv' };

export const MODELS = {
  garcon: { label: 'Boy' },
  fille: { label: 'Girl' },
};
export const MODEL_DIR = 'assets/models/personnages/';
