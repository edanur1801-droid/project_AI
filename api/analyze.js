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

    // --- GÜNCEL, RASYONEL PUANLAMA MANTIĞI BURADA ---
    const SYSTEM_INSTRUCTION = `
Sen Iris, Gemini Teknolojisiyle çalışan en gelişmiş Marka İstihbarat Analistisin.
Görevin: Markayı analiz etmek ve sadece aşağıdaki JSON formatında çıktı vermek. Başka hiçbir şey yazma.

KURALLAR:
1. GERÇEKLİK: Marka hakkında yeterli veri yoksa (çok yeni/çok niş ise) dürüstçe "Yetersiz Veri" de.
2. KİMLİK KONTROLÜ: Kullanıcının beyanı ile dijital ayak izi uyuşmuyorsa "ALGI SAPMASI" uyarısı ver.
3. FORMAT: Sadece geçerli JSON döndür.
4. KESİN GEREKÇE: Her bir ana metrik (DigitalPresence, SentimentHealth, IdentityMatch) 0-100 arasında bir değer alır. **Nihai skor (score), bu 3 metriğin ağırlıklı ortalamasıdır.**
5. DETAYLI KIRILIM: Her ana metrik içinde, puanın neden kırıldığını rasyonel verilerle destekleyen, nicel (quantitative) göstergeler içeren 3 alt faktörü (alt_metrics) zorunlu olarak listele.

Marka: ${brand}
Sektör: ${industry}

JSON ŞEMASI:
{
  "score": (0-100 arası nihai, yuvarlanmış sayı. Ağırlıklı ortalamayı kullan.),
  "scoreRationale": (str - Nihai skorun nedenini açıklayan 1 cümlelik özet, ağırlıklı ortalamayı ve kırılan ana nedeni belirt),
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
      "name": "Dijital Ayak İzi & Hacim (Ağırlık: %40)",
      "value": (0-100 arası sayı),
      "rationale": (str, 2 cümlelik gerekçe. Örn: "Marka, son 6 ayda arama hacminde %15 artış göstermiş ancak anahtar kelime otoritesi rakiplerin %30 gerisindedir."),
      "sub_metrics": [
          {"name": "Arama Hacmi Trendi (Son 6 Ay)", "score": (0-100), "rationale": "Artış/Düşüş yüzdesi belirtilir."},
          {"name": "Sosyal Medya Etkileşim Oranı", "score": (0-100), "rationale": "Rakiplerine göre etkileşim yüzdesi (Örn: %70) belirtilir."},
          {"name": "Site Otoritesi (Domain Authority)", "score": (0-100), "rationale": "Sektör liderine kıyasla otorite puanı belirtilir."}
      ]
    },
    "SentimentHealth": { 
      "name": "Duygu Durumu Dengesi (Ağırlık: %35)",
      "value": (0-100 arası sayı),
      "rationale": (str, 2 cümlelik gerekçe. Örn: "Pozitif-Negatif yorum oranı 3:1 düzeyindedir ancak son 1 ayda hijyen sorunu kaynaklı %20 negatif sapma yaşanmıştır."),
      "sub_metrics": [
          {"name": "Pozitif/Negatif Oranı", "score": (0-100), "rationale": "Gerçek oran (Örn: 3:1) belirtilir."},
          {"name": "Kriz Etki Skoru (Son 3 Ay)", "score": (0-100), "rationale": "Krizin toplam duyguya etkisi yüzdesi belirtilir."},
          {"name": "Müşteri Hizmetleri Algısı", "score": (0-100), "rationale": "Geri bildirimlerdeki hizmet kalitesi algısı puanı belirtilir."}
      ]
    },
    "IdentityMatch": { 
      "name": "Algı Tutarlılığı (Ağırlık: %25)",
      "value": (0-100 arası sayı),
      "rationale": (str, 2 cümlelik gerekçe. Örn: "Beyan edilen 'hızlı servis' algısı, müşteri şikayetlerinde %15 sapma göstermiştir. Pazarlama mesajı tutarlıdır."),
      "sub_metrics": [
          {"name": "Pazarlama-Ürün Uyum Skoru", "score": (0-100), "rationale": "Pazarlama ve ürün kalitesi uyum yüzdesi belirtilir."},
          {"name": "Sektör Doğrulama Skoru", "score": (0-100), "rationale": "Halkın algıladığı sektör ile beyan edilen sektörün eşleşme yüzdesi belirtilir."},
          {"name": "Kurumsal Kimlik Tutarlılığı", "score": (0-100), "rationale": "Farklı platformlarda (PR, Sosyal Medya) mesaj tutarlılığı puanı belirtilir."}
      ]
    }
  }
}
`;

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
