// api/analyze.js

export default async function handler(req, res) {
  // 1. CORS Ayarları (GitHub Pages'in buraya erişebilmesi için şart)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight isteğini (OPTIONS) hemen cevapla
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Sadece POST isteklerini kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { brand, industry } = req.body;

    if (!brand || !industry) {
      return res.status(400).json({ error: 'Marka ve Sektör zorunludur.' });
    }

    // API Anahtarını Vercel'in güvenli kasasından al
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server Konfigürasyon Hatası: API Key yok.' });
    }

    // --- ENTEGRE EDİLMİŞ VE GÜNCELLENMİŞ PROMPT MANTIĞI BURADA ---
    const SYSTEM_INSTRUCTION = `
    Sen Iris, Gemini Teknolojisiyle çalışan en gelişmiş Marka İstihbarat Analistisin.
    Görevin: Markayı analiz etmek ve sadece aşağıdaki JSON formatında çıktı vermek. Başka hiçbir şey yazma.

    KURALLAR:
    1. GERÇEKLİK: Marka hakkında yeterli veri yoksa (çok yeni/çok niş ise) dürüstçe "Yetersiz Veri" de.
    2. KİMLİK KONTROLÜ: Kullanıcının beyanı ile dijital ayak izi uyuşmuyorsa "ALGI SAPMASI" uyarısı ver.
    3. FORMAT: Sadece geçerli JSON döndür.
    4. KESİN GEREKÇE: Her alt metrik için (DigitalPresence, SentimentHealth, IdentityMatch) 0-100 arasında bir puan ver. Gerekçe (rationale) yazarken, bu puanı *web aramalarından elde edilen gerçek zamanlı trendlere ve somut göstergelere* dayandır. Gerekçe, skorun nedenini güçlü bir şekilde açıklamalıdır.

    Marka: ${brand}
    Sektör: ${industry}

    JSON ŞEMASI:
    {
      "score": (0-100 arası nihai, yuvarlanmış sayı),
      "scoreRationale": (str - Nihai skorun nedenini açıklayan 1 cümlelik özet, alt metriklerin ortalamasına dayandır),
      "identityAnalysis": {
        "claimedSector": (str),
        "detectedSector": (str),
        "matchStatus": ("EŞLEŞME DOĞRULANDI" veya "ALGI SAPMASI" veya "Yetersiz Veri"),
        "insight": (str)
      },
      "competitors": {
        "direct": [{"name": "str", "status": "str"}], 
        "leaders": [{"name": "str", "status": "str"}]
      },
      "strategicSummary": (str),
      "strengths": [(str), (str)],
      "weaknesses": [(str), (str)],
      "optimization": {
        "objective": (str),
        "rationale": (str),
        "text": (str)
      },
      "platforms": [
        {"name": "Gemini", "status": "Analiz Edildi"}, 
        {"name": "GPT-5", "status": "Simüle Edildi"},
        {"name": "Claude", "status": "Tarandı"}
      ],
      "metrics": {
        "DigitalPresence": { 
          "name": "Dijital Ayak İzi & Hacim",
          "value": (0-100 arası sayı),
          "rationale": (str, 2 cümlelik gerekçe. Örn: "Marka, son 6 ayda Google Trends'de istikrarlı bir yükseliş göstermiştir ve anahtar kelime otoritesi rakiplerin %70'inden daha yüksektir.")
        },
        "SentimentHealth": { 
          "name": "Duygu Durumu Dengesi",
          "value": (0-100 arası sayı),
          "rationale": (str, 2 cümlelik gerekçe. Örn: "Sosyal medya ve haber yorumlarında pozitif-negatif oranı 4:1 düzeyindedir ancak son 1 ayda kurumsal kriz nedeniyle küçük bir duygu sapması mevcuttur.")
        },
        "IdentityMatch": { 
          "name": "Algı Tutarlılığı",
          "value": (0-100 arası sayı),
          "rationale": (str, 2 cümlelik gerekçe. Örn: "Beyan edilen 'yenilikçi teknoloji' algısı, son ürün lansmanlarıyla %95 oranında doğrulanmıştır. Pazarlama mesajı hedef kitlede tutarlıdır.")
        }
      }
    }`;

    // Gemini API'ye İstek At (Native Fetch ile - Paket kurmaya gerek yok)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_INSTRUCTION }] }],
        generationConfig: { 
            responseMimeType: 'application/json' // Bu ayar, her zaman geçerli JSON çıktısı almayı sağlar.
        }
      })
    });

    const data = await response.json();

    // Gemini'den gelen cevabı kontrol et
    if (!data.candidates || !data.candidates[0].content) {
       throw new Error(data.error?.message || "Gemini boş cevap döndü.");
    }

    const resultText = data.candidates[0].content.parts[0].text;
    
    // JSON'u parse edip frontend'e gönder
    // NOT: responseMimeType ayarı sayesinde temizleme kodu genelde gereksizdir, ama sağlamlık için eklenebilir.
    const parsedResult = JSON.parse(resultText);
    res.status(200).json(parsedResult);

  } catch (error) {
    console.error("Backend Hatası:", error);
    res.status(500).json({ error: error.message || 'Analiz sırasında sunucu hatası.' });
  }
}
