import type { Commodity, CommodityId } from "@/lib/domain/types";

// Commodity parameters are DEMO ASSUMPTIONS chosen to be plausible for a
// hackathon walkthrough. They are not agronomic or market-validated figures.

export const COMMODITIES: Record<CommodityId, Commodity> = {
  orange: {
    id: "orange",
    name: { en: "Nagpur orange", hi: "नागपुरी संतरा", mr: "नागपुरी संत्रा" },
    cropClass: "perishable",
    varieties: ["Nagpur Mandarin (Ambia)", "Nagpur Mandarin (Mrig)"],
    grades: [
      {
        id: "A",
        label: { en: "Grade A", hi: "ग्रेड A", mr: "ग्रेड A" },
        priceFactor: 1.1,
        description: {
          en: "Large, uniform fruit with good colour",
          hi: "बड़े, एकसमान, अच्छे रंग के फल",
          mr: "मोठी, एकसारखी, चांगल्या रंगाची फळे",
        },
      },
      {
        id: "B",
        label: { en: "Grade B", hi: "ग्रेड B", mr: "ग्रेड B" },
        priceFactor: 1.0,
        description: {
          en: "Medium fruit, minor blemishes",
          hi: "मध्यम फल, हल्के दाग",
          mr: "मध्यम फळे, किरकोळ डाग",
        },
      },
      {
        id: "C",
        label: { en: "Grade C (juice)", hi: "ग्रेड C (ज्यूस)", mr: "ग्रेड C (रस)" },
        priceFactor: 0.8,
        description: {
          en: "Small or blemished fruit, suited to processing",
          hi: "छोटे या दागी फल, प्रोसेसिंग योग्य",
          mr: "लहान किंवा डागाळलेली फळे, प्रक्रियेसाठी योग्य",
        },
      },
    ],
    defaultGradeId: "B",
    shelfLifeDays: 7,
    spoilagePctPerDay: 1.5,
    transitLossPctPer100Km: 1.5,
    storage: { suitable: false, rentPerQtlPerMonth: 0, lossPctPerMonth: 0, handlingPerQtl: 0 },
    packagingPerQtl: 40,
    packagingLabel: { en: "Crates", hi: "क्रेट", mr: "क्रेट" },
    hint: {
      en: "Perishable: every day of delay and every extra kilometre costs fruit quality. Sell within the shelf-life window.",
      hi: "जल्दी खराब होने वाली फसल: हर दिन की देरी और हर अतिरिक्त किलोमीटर से गुणवत्ता घटती है।",
      mr: "नाशवंत पीक: प्रत्येक दिवसाचा उशीर आणि जास्तीचा प्रवास गुणवत्तेवर परिणाम करतो.",
    },
  },
  soybean: {
    id: "soybean",
    name: { en: "Soybean", hi: "सोयाबीन", mr: "सोयाबीन" },
    cropClass: "storable_oilseed",
    varieties: ["JS 335", "JS 9560", "MAUS 71", "Other"],
    grades: [
      {
        id: "FAQ",
        label: { en: "FAQ", hi: "FAQ (औसत अच्छी गुणवत्ता)", mr: "FAQ (सरासरी चांगली प्रत)" },
        priceFactor: 1.0,
        description: {
          en: "Fair average quality, dry and clean",
          hi: "औसत अच्छी गुणवत्ता, सूखा और साफ",
          mr: "सरासरी चांगली प्रत, कोरडे व स्वच्छ",
        },
      },
      {
        id: "BFAQ",
        label: { en: "Below FAQ", hi: "FAQ से कम", mr: "FAQ पेक्षा कमी" },
        priceFactor: 0.93,
        description: {
          en: "Higher moisture or damaged grain",
          hi: "अधिक नमी या क्षतिग्रस्त दाने",
          mr: "जास्त ओलावा किंवा खराब दाणे",
        },
      },
    ],
    defaultGradeId: "FAQ",
    shelfLifeDays: null,
    spoilagePctPerDay: 0,
    transitLossPctPer100Km: 0,
    storage: { suitable: true, rentPerQtlPerMonth: 12, lossPctPerMonth: 0.25, handlingPerQtl: 15 },
    packagingPerQtl: 12,
    packagingLabel: { en: "Bags", hi: "बोरी", mr: "पोती" },
    hint: {
      en: "Storable: compare selling now against storing, after storage rent, losses and the cost of waiting for money.",
      hi: "भंडारण योग्य: अभी बेचने की तुलना भंडारण से करें — किराया, नुकसान और पैसे के इंतज़ार की लागत जोड़कर।",
      mr: "साठवणयोग्य: आत्ता विकणे आणि साठवणे यांची तुलना करा — भाडे, घट आणि पैशाच्या प्रतीक्षेचा खर्च धरून.",
    },
  },
  tur: {
    id: "tur",
    name: { en: "Tur (pigeon pea)", hi: "तुअर (अरहर)", mr: "तूर" },
    cropClass: "grain_pulse",
    varieties: ["BSMR 736", "ICPL 87119 (Asha)", "Vipula", "Other"],
    grades: [
      {
        id: "FAQ",
        label: { en: "FAQ", hi: "FAQ (औसत अच्छी गुणवत्ता)", mr: "FAQ (सरासरी चांगली प्रत)" },
        priceFactor: 1.0,
        description: {
          en: "Fair average quality, well dried",
          hi: "औसत अच्छी गुणवत्ता, अच्छी तरह सूखा",
          mr: "सरासरी चांगली प्रत, चांगले वाळलेले",
        },
      },
      {
        id: "BFAQ",
        label: { en: "Below FAQ", hi: "FAQ से कम", mr: "FAQ पेक्षा कमी" },
        priceFactor: 0.92,
        description: {
          en: "Shrivelled, damaged or high-moisture grain",
          hi: "सिकुड़े, क्षतिग्रस्त या नम दाने",
          mr: "आकसलेले, खराब किंवा ओले दाणे",
        },
      },
    ],
    defaultGradeId: "FAQ",
    shelfLifeDays: null,
    spoilagePctPerDay: 0,
    transitLossPctPer100Km: 0,
    storage: { suitable: true, rentPerQtlPerMonth: 14, lossPctPerMonth: 0.3, handlingPerQtl: 15 },
    packagingPerQtl: 12,
    packagingLabel: { en: "Bags", hi: "बोरी", mr: "पोती" },
    hint: {
      en: "Small lots pay more per quintal for transport. Pooling with an FPO can spread vehicle cost.",
      hi: "छोटे लॉट पर प्रति क्विंटल परिवहन खर्च ज़्यादा होता है। FPO के साथ मिलकर भेजने से खर्च बँट सकता है।",
      mr: "लहान लॉटला प्रति क्विंटल वाहतूक खर्च जास्त येतो. FPO सोबत एकत्र पाठवल्यास खर्च विभागला जाऊ शकतो.",
    },
  },
};

export const COMMODITY_LIST = Object.values(COMMODITIES);

export function getGrade(commodityId: CommodityId, gradeId: string) {
  const c = COMMODITIES[commodityId];
  return c.grades.find((g) => g.id === gradeId) ?? c.grades.find((g) => g.id === c.defaultGradeId)!;
}
