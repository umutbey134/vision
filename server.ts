import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { PRODUCTS } from './src/data/products.js'; // Use .js for ES Module resolution when running under TSX/node

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client to prevent startup crash if API key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// AI Glasses Consultant Endpoint
app.post('/api/ai-consultant', async (req: Request, res: Response): Promise<void> => {
  try {
    const { faceShape, style, favoriteColor, lifestyle, gender } = req.body;

    if (!faceShape || !style || !lifestyle) {
       res.status(400).json({ error: 'Eksik parametreler (Yüz şekli, tarz, yaşam tarzı gereklidir).' });
       return;
    }

    const ai = getAiClient();

    const prompt = `
      Sen Elit Optik mağazasının modern, lüks ve uzman AI Gözlük Stilistisin. Müşterimize onun yüz yapısına, tarzına ve hayat biçimine en uygun lüks ve şık gözlüklerimizi önermekle görevlisin.
      
      Müşteri Özellikleri:
      - Yüz Şekli: ${faceShape}
      - Tarzı: ${style}
      - Favori Rengi/Tonları: ${favoriteColor || 'Belirtilmedi'}
      - Yaşam Tarzı / Kullanım Amacı: ${lifestyle}
      - Tercih Edilen Kategori/Cinsiyet: ${gender || 'Unisex / Herkes'}

      Elimizdeki Ürün Kataloğu:
      ${JSON.stringify(PRODUCTS, null, 2)}

      Lütfen bu kataloğumuzdaki ürünlerden müşteri özelliklerine en uygun olan en az 1, en fazla 3 ürünü seç. Seçtiğin ürünlerin 'id' değerleri bizim ürün kataloğumuzdaki 'id'lerle birebir eşleşmeli.
      
      Yanıtını kesinlikle aşağıdaki JSON formatında ver. Başka hiçbir açıklama, markdown bloğu veya süsleme ekleme, sadece saf geçerli bir JSON döndür:
      {
        "styleAdvice": "Müşterinin yüz şekli ve tarzına yönelik genel lüks stil ve çerçeve seçim tavsiyesi (Türkçe ve son derece premium/elit bir dille yazılmış)",
        "recommendations": [
          {
            "productId": "katalogdaki_eslesen_urun_id",
            "reason": "Bu gözlüğün bu müşteriye neden mükemmel uyum sağlayacağının elit, ikna edici açıklaması (Türkçe)"
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
      config: {
        // Enforce JSON format output
        responseMimeType: 'application/json',
      }
    });

    const replyText = response.text || '{}';
    try {
      const parsedReply = JSON.parse(replyText.trim());
      res.json(parsedReply);
    } catch (parseError) {
      console.error('Gemini output parse error:', replyText, parseError);
      res.json({
        styleAdvice: `${faceShape} yüz şekliniz ve ${style} tarzınız için size en uygun lüks çerçeveleri seçtik.`,
        recommendations: [
          {
            productId: PRODUCTS[0].id,
            reason: "Klasik ve asil duruşuyla yüz hatlarınızı mükemmel şekilde dengeler."
          }
        ]
      });
    }
  } catch (err: any) {
    console.error('AI Consultant Error:', err);
    res.status(500).json({ 
      error: 'AI Stilistimize şu anda ulaşılamıyor.',
      details: err.message 
    });
  }
});

// AI Product Detail Optimizer Endpoint
app.post('/api/ai/optimize-product', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, brand, type, gender, frameShape, material } = req.body;

    const ai = getAiClient();

    const prompt = `
      Sen lüks ve prestijli "Demir Optik" Nişantaşı mağazasının kıdemli ürün ve optik uzmanı AI asistanısın.
      Sana verilen temel gözlük bilgilerine dayanarak, bu gözlük için son derece detaylı, premium/elit dille yazılmış bir Türkçe ürün hikayesi (açıklama), önerilen fiziksel ölçüler (ekartman, köprü, sap uzunluğu), uygun yüz şekilleri ve estetik lüks renk kombinasyonları oluşturmalısın.

      Verilen Temel Gözlük Bilgileri:
      - Ürün Adı: ${name || 'Belirtilmedi'}
      - Marka: ${brand || 'Belirtilmedi'}
      - Tip: ${type === 'Sunglasses' ? 'Güneş Gözlüğü' : 'Mavi Işık Korumalı Gözlük'}
      - Hedef Cinsiyet: ${gender || 'Unisex'}
      - Çerçeve Formu: ${frameShape || 'Belirtilmedi'}
      - Çerçeve Malzemesi: ${material || 'Belirtilmedi'}

      Lütfen yanıtını aşağıdaki geçerli JSON formatında döndür. Başka hiçbir açıklama, markdown bloğu veya süsleme ekleme, sadece saf geçerli bir JSON döndür:
      {
        "description": "Gözlüğün tasarım dilini, lüks materyallerini ve asaletini vurgulayan, Nişantaşı butik kalitesinde elit ve ikna edici Türkçe açıklama (yaklaşık 2-3 cümle)",
        "specs": {
          "lensWidth": 50,
          "bridge": 18,
          "temple": 145
        },
        "faceShapes": ["Yuvarlak", "Oval", "Kare"],
        "colors": [
          {
            "name": "Parlak Siyah / Klasik Füme Cam",
            "hex": "#111111",
            "bgClass": "bg-black",
            "imageTint": "brightness-75"
          },
          {
            "name": "Havana Tortoise / Degrade Kahve Cam",
            "hex": "#633A11",
            "bgClass": "bg-[#633A11]",
            "imageTint": "hue-rotate-15 contrast-125"
          }
        ]
      }

      Notlar:
      - "specs" altındaki lensWidth, bridge ve temple değerleri sayı (number) olmalıdır.
      - "colors" altındaki "bgClass" geçerli bir Tailwind arka plan rengi sınıfı (örneğin bg-black, bg-amber-700 vb.) olmalıdır veya bg-[#HEX] formatında olmalıdır.
      - "colors" altındaki "imageTint" CSS filtre sınıfı olmalıdır (örneğin brightness-75, sepia, contrast-110, grayscale vb.).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const replyText = response.text || '{}';
    try {
      const parsedReply = JSON.parse(replyText.trim());
      res.json(parsedReply);
    } catch (parseError) {
      console.error('Gemini product optimize parse error:', replyText, parseError);
      res.status(500).json({ error: 'Yapay zeka yanıtı ayrıştırılamadı.' });
    }
  } catch (err: any) {
    console.error('AI Optimize Product Error:', err);
    res.status(500).json({ 
      error: 'Ürün yapay zeka asistanına şu anda ulaşılamıyor.',
      details: err.message 
    });
  }
});

// Memory cache for products
let cachedProducts: any[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in-memory cache

// Function to clean and capitalize brand
function cleanBrandName(urlPath: string): string {
  if (!urlPath) return 'Swing';
  const match = urlPath.match(/^\/([^\/]+)/);
  if (match) {
    const raw = match[1].toLowerCase();
    if (raw === 'lee-cooper' || raw === 'leecooper') return 'Lee Cooper';
    if (raw === 'infiniti-desing' || raw === 'infinitidesign') return 'Infiniti Design';
    if (raw === 'infiniti') return 'Infiniti';
    if (raw === 'swing') return 'Swing';
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  return 'Swing';
}

// Function to clean model name
function cleanModelName(name: string, brand: string): string {
  let clean = name.replace(/[-_]/g, ' ').trim();
  const brandRegex = new RegExp(brand, 'i');
  clean = clean.replace(brandRegex, '').trim();
  clean = clean.replace(/(güneş gözlüğü|unisex|eyewear|optik|gozlugu|gözlüğü|kadin|erkek|cocuk|bayan)/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  if (parts.length > 0 && parts[0].length > 1) {
    return parts[0].toUpperCase();
  }
  return 'Collection Model';
}

// Helper to map color code to luxury color
function getLuxuryColorName(code: string): { name: string, hex: string, bgClass: string } {
  const upper = code.toUpperCase();
  if (upper.includes('C1') || upper.includes('C2M') || upper.includes('BLACK') || upper.includes('SIYAH') || upper.includes('C2') || upper.includes('C101') || upper.includes('C5')) {
    return { name: 'Parlak Siyah / Klasik Füme', hex: '#111111', bgClass: 'bg-black' };
  }
  if (upper.includes('C6') || upper.includes('HAVANA') || upper.includes('BROWN') || upper.includes('KAHVE') || upper.includes('TORTOISE')) {
    return { name: 'Havana Tortoise / Degrade Kahve', hex: '#633A11', bgClass: 'bg-[#633A11]' };
  }
  if (upper.includes('C621') || upper.includes('C621M') || upper.includes('CARAMEL') || upper.includes('BAL') || upper.includes('HONEY')) {
    return { name: 'Karamel Bal Tonu / Kahve Cam', hex: '#92400E', bgClass: 'bg-[#92400E]' };
  }
  if (upper.includes('C4') || upper.includes('GOLD') || upper.includes('ALTIN') || upper.includes('YELLOW')) {
    return { name: 'Sarı Altın Çerçeve / Degrade', hex: '#E5C158', bgClass: 'bg-[#E5C158]' };
  }
  if (upper.includes('C3') || upper.includes('SILVER') || upper.includes('GUMUS') || upper.includes('GREY') || upper.includes('GRI')) {
    return { name: 'Saten Gümüş / Füme Cam', hex: '#9CA3AF', bgClass: 'bg-[#9CA3AF]' };
  }
  if (upper.includes('C193') || upper.includes('RED') || upper.includes('BORDO') || upper.includes('ROSE')) {
    return { name: 'Bordo Karadut / Degrade Gri', hex: '#881337', bgClass: 'bg-[#881337]' };
  }
  
  const colors = [
    { name: 'Mat Siyah / Polarize Füme', hex: '#1C1917', bgClass: 'bg-stone-900' },
    { name: 'Amber Kahve / Degrade Cam', hex: '#78350F', bgClass: 'bg-[#78350F]' },
    { name: 'Gece Mavisi / Aynalı Mavi', hex: '#1E3A8A', bgClass: 'bg-[#1E3A8A]' },
    { name: 'Tebeşir Beyazı / Gri Cam', hex: '#F3F4F6', bgClass: 'bg-gray-150' },
  ];
  const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function getDeterministicSpecs(idStr: string) {
  const hash = idStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    lensWidth: 50 + (hash % 6), // 50 to 55
    bridge: 17 + (hash % 5),    // 17 to 21
    temple: 140 + (hash % 3) * 5 // 140, 145, 150
  };
}

function getDeterministicFaceShapes(shape: string): string[] {
  if (shape === 'Round' || shape === 'Oval') return ['Kare', 'Köşeli', 'Dikdörtgen'];
  if (shape === 'Square' || shape === 'Rectangular') return ['Yuvarlak', 'Oval', 'Kalp'];
  if (shape === 'Cat-Eye') return ['Yuvarlak', 'Oval', 'Kalp'];
  return ['Oval', 'Kare', 'Yuvarlak'];
}

function getDeterministicShape(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('ROUND') || upper.includes('YUVARLAK')) return 'Round';
  if (upper.includes('SQUARE') || upper.includes('KARE')) return 'Square';
  if (upper.includes('CAT') || upper.includes('KEDİ')) return 'Cat-Eye';
  if (upper.includes('AVIATOR') || upper.includes('DAMLA')) return 'Aviator';
  if (upper.includes('RECT') || upper.includes('GEOMETRİK')) return 'Geometrik';
  
  const shapes = ['Square', 'Round', 'Rectangular', 'Aviator', 'Cat-Eye', 'Geometrik'];
  const hash = name.length;
  return shapes[hash % shapes.length];
}

function getDeterministicMaterial(brand: string): string {
  if (brand.toLowerCase().includes('swing')) return 'Acetate';
  if (brand.toLowerCase().includes('lee')) return 'Metal';
  if (brand.toLowerCase().includes('infiniti')) return 'Titanium';
  return 'Acetate';
}

function getProductType(name: string, url: string): 'Sunglasses' | 'BlueLight' {
  const combined = (name + ' ' + url).toLowerCase();
  if (combined.includes('mavi') || combined.includes('optik') || combined.includes('blue') || combined.includes('isik') || combined.includes('koruma')) {
    return 'BlueLight';
  }
  return 'Sunglasses';
}

function getProductGender(name: string, url: string): 'Erkek' | 'Kadın' | 'Çocuk' | 'Unisex' {
  const combined = (name + ' ' + url).toLowerCase();
  if (combined.includes('cocuk') || combined.includes('çocuk') || combined.includes('junior') || combined.includes('smart')) {
    return 'Çocuk';
  }
  if (combined.includes('kadin') || combined.includes('kadın') || combined.includes('bayan') || combined.includes('female') || combined.includes('lady')) {
    return 'Kadın';
  }
  if (combined.includes('erkek') || combined.includes('male') || combined.includes('men')) {
    return 'Erkek';
  }
  return 'Unisex';
}

function generateLuxuryDescription(brand: string, model: string, type: 'Sunglasses' | 'BlueLight'): string {
  const isBlue = type === 'BlueLight';
  if (isBlue) {
    return `${brand} ${model} ekran gözlüğü, modern dijital dünyada gözlerinizi korumak üzere tasarlanmış asil bir mühendislik ürünüdür. Yüksek teknolojili mavi ışık filtreli camları ve hafif yapısıyla gün boyu kusursuz bir konfor sunarken, prestijli stiliyle her anınıza şıklık katar.`;
  } else {
    return `Zarif tasarımı ve premium materyalleriyle öne çıkan ${brand} ${model} güneş gözlüğü, lüks sokak stilinin en rafine örneğidir. %100 UV-400 korumalı üst düzey cam kalitesi ve dayanıklı çerçeve yapısı ile hem göz sağlığınızı korur hem de asil duruşunuzu tamamlar.`;
  }
}

// Function to fetch and proxy the image with fallback resolution strategy
async function handleImageProxy(originalParamUrl: string, res: Response) {
  // 1. Create local cache path in our project folder
  const localDirPath = path.join(process.cwd(), 'src', 'data', 'images');
  if (!fs.existsSync(localDirPath)) {
    fs.mkdirSync(localDirPath, { recursive: true });
  }

  const fileHash = crypto.createHash('md5').update(originalParamUrl).digest('hex');
  const ext = path.extname(originalParamUrl.split('?')[0]) || '.jpg';
  const localFilename = `${fileHash}${ext}`;
  const localFilePath = path.join(localDirPath, localFilename);

  // 2. Check if the file already exists in our local directory (cache hit)
  if (fs.existsSync(localFilePath)) {
    const stats = fs.statSync(localFilePath);
    if (stats.size > 8000) { // Keep if it is above 8KB (to ensure we don't serve a tiny 128x192 thumbnail)
      const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.sendFile(localFilePath);
      return;
    } else {
      // It's a small thumbnail, let's delete it so we can fetch the ultra-high resolution instead!
      try {
        fs.unlinkSync(localFilePath);
      } catch (err) {
        console.error('Failed to unlink cached small thumbnail:', err);
      }
    }
  }

  // Create a sequence of candidate URLs to fetch the highest possible image quality
  const urlsToTry: string[] = [];
  
  if (originalParamUrl.includes('mnresize')) {
    // 1. Try original raw image without any mnresize (direct CDN source, highest quality, no scaling artifacts)
    const rawUrl = originalParamUrl.replace(/mnresize\/[^\/]+\/[^\/]+\//g, '');
    urlsToTry.push(rawUrl);

    // 2. Try standard 1200x1800 exact portrait zoom resolution
    const highResExact = originalParamUrl.replace(/mnresize\/[^\/]+\/[^\/]+\//g, 'mnresize/1200/1800/');
    urlsToTry.push(highResExact);

    // 3. Try standard 600x900 portrait zoom resolution
    const midResExact = originalParamUrl.replace(/mnresize\/[^\/]+\/[^\/]+\//g, 'mnresize/600/900/');
    urlsToTry.push(midResExact);

    // 4. Try standard 300x450 portrait size
    const lowResExact = originalParamUrl.replace(/mnresize\/[^\/]+\/[^\/]+\//g, 'mnresize/300/450/');
    urlsToTry.push(lowResExact);
  }
  
  // 5. Fallback to original url as-is
  urlsToTry.push(originalParamUrl);

  let lastError: any = null;
  for (const targetUrl of urlsToTry) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.trendyol.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          console.log(`Skipping non-image content type ${contentType} for ${targetUrl}`);
          continue;
        }

        const buffer = await response.arrayBuffer();
        
        // If the downloaded buffer is too small (e.g. less than 8KB, indicating a tiny thumbnail fallback or broken placeholder)
        // and we have other target URLs to try, let's continue to the next one to get a better high-res variant.
        if (buffer.byteLength < 8000 && targetUrl !== urlsToTry[urlsToTry.length - 1]) {
          console.log(`Image at ${targetUrl} is too small (${buffer.byteLength} bytes). Trying next candidate...`);
          continue;
        }

        // Save to our local folder so that it is permanently stored locally
        await fs.promises.writeFile(localFilePath, Buffer.from(buffer));
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(Buffer.from(buffer));
        return;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  res.status(500).send(`Error proxying image: ${lastError?.message || 'Failed to fetch any image variants'}`);
}

// Generate clean-looking domain-internal URL for images
function getCleanImageUrl(imgUrl: string): string {
  const fileHash = crypto.createHash('md5').update(imgUrl).digest('hex');
  const ext = path.extname(imgUrl.split('?')[0]) || '.jpg';
  return `/api/products/images/${fileHash}${ext}?url=${encodeURIComponent(imgUrl)}`;
}

// Image Proxy route for backwards-compatibility
app.get('/api/trendyol-image', async (req: Request, res: Response) => {
  const originalParamUrl = req.query.url as string;
  if (!originalParamUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }
  await handleImageProxy(originalParamUrl, res);
});

// Clean and custom-looking endpoint for our own site's images
app.get('/api/products/images/:filename', async (req: Request, res: Response) => {
  const originalParamUrl = req.query.url as string;
  if (!originalParamUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }
  await handleImageProxy(originalParamUrl, res);
});

// Functions to extract color attributes and products from the gozlukyeni.json file
function extractColors(item: any): { name: string; hex: string; bgClass: string; imageTint: string; image: string; id: string }[] {
  const colors: any[] = [];
  const slicing = item.slicingAttributes?.result || [];
  
  // Look for color slicing attribute
  const colorAttr = slicing.find((s: any) => 
    s.type === 'DsmColor' || 
    (s.title && s.title.toLowerCase().includes('renk'))
  );

  if (colorAttr && Array.isArray(colorAttr.values)) {
    colorAttr.values.forEach((val: any, idx: number) => {
      const prod = val.products?.[0];
      if (prod) {
        const luxury = getLuxuryColorName(val.name || `C${idx + 1}`);
        let imgUrl = prod.imageUrl || item.image;
        colors.push({
          id: String(prod.id || idx),
          name: val.name || luxury.name,
          hex: luxury.hex,
          bgClass: luxury.bgClass,
          imageTint: 'brightness-100',
          image: getCleanImageUrl(imgUrl)
        });
      }
    });
  }

  // Fallback if no colors extracted
  if (colors.length === 0) {
    const luxury = getLuxuryColorName('C1');
    colors.push({
      id: String(item.id),
      name: luxury.name,
      hex: luxury.hex,
      bgClass: luxury.bgClass,
      imageTint: 'brightness-100',
      image: getCleanImageUrl(item.image)
    });
  }

  return colors;
}

// Helper to map and load products from gozlukyeni.json
async function getGozlukyeniProducts(): Promise<any[]> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'gozlukyeni.json');
    if (!fs.existsSync(filePath)) {
      console.warn('gozlukyeni.json not found at:', filePath);
      return [];
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const rawData = JSON.parse(fileContent);

    if (!Array.isArray(rawData)) {
      console.warn('gozlukyeni.json is not an array');
      return [];
    }

    return rawData.map((item: any) => {
      const brand = item.brand || 'Elit Optik';
      const name = item.name || `${brand} Collection`;
      const type = getProductType(name, item.url || '');
      const gender = getProductGender(name, item.url || '');
      const shape = getDeterministicShape(name);
      const material = getDeterministicMaterial(brand);
      const price = item.price?.current || 1250;
      const description = generateLuxuryDescription(brand, name, type);
      const specs = getDeterministicSpecs(String(item.id));
      const faceShapes = getDeterministicFaceShapes(shape);
      const colors = extractColors(item);
      const mainImage = colors[0]?.image || getCleanImageUrl(item.image);
      const allImages = (item.images && item.images.length > 0)
        ? item.images.map((img: string) => getCleanImageUrl(img))
        : [mainImage];

      return {
        id: String(item.id),
        name: name,
        brand: brand,
        type: type,
        gender: gender,
        price: price,
        frameShape: shape,
        material: material,
        colors: colors,
        description: description,
        specs: specs,
        faceShapes: faceShapes,
        image: mainImage,
        images: allImages,
        featured: Math.random() > 0.7, // mark ~30% as featured
        slicingAttributes: item.slicingAttributes
      };
    });
  } catch (err) {
    console.error('Error loading or parsing gozlukyeni.json:', err);
    return [];
  }
}

// Premium Catalog Endpoint (Static PRODUCTS + Mapped Trendyol Products from gozlukyeni.json)
app.get('/api/products', async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedProducts && (now - lastFetchTime < CACHE_DURATION)) {
    res.json(cachedProducts);
    return;
  }

  try {
    const mappedJSONProducts = await getGozlukyeniProducts();
    
    // Merge local custom design-crafted static PRODUCTS with the catalog from gozlukyeni.json
    cachedProducts = [...PRODUCTS, ...mappedJSONProducts];
    lastFetchTime = now;
    res.json(cachedProducts);
  } catch (err: any) {
    console.error('Error fetching/mapping JSON products:', err);
    // Fallback to cache or static
    if (cachedProducts) {
      res.json(cachedProducts);
    } else {
      res.json(PRODUCTS);
    }
  }
});

// Configure Vite middleware or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
