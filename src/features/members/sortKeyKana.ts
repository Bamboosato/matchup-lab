const COMMON_NAME_READINGS = new Map([
  ["佐藤", "さとう"],
  ["鈴木", "すずき"],
  ["高橋", "たかはし"],
  ["髙橋", "たかはし"],
  ["田中", "たなか"],
  ["渡辺", "わたなべ"],
  ["伊藤", "いとう"],
  ["山本", "やまもと"],
  ["中村", "なかむら"],
  ["小林", "こばやし"],
  ["加藤", "かとう"],
  ["吉田", "よしだ"],
  ["山田", "やまだ"],
  ["佐々木", "ささき"],
  ["山口", "やまぐち"],
  ["松本", "まつもと"],
  ["井上", "いのうえ"],
  ["木村", "きむら"],
  ["林", "はやし"],
  ["斎藤", "さいとう"],
  ["斉藤", "さいとう"],
  ["齋藤", "さいとう"],
  ["清水", "しみず"],
  ["山崎", "やまざき"],
  ["森", "もり"],
  ["阿部", "あべ"],
  ["池田", "いけだ"],
  ["橋本", "はしもと"],
  ["山下", "やました"],
  ["石川", "いしかわ"],
  ["中島", "なかじま"],
  ["前田", "まえだ"],
  ["藤田", "ふじた"],
  ["小川", "おがわ"],
  ["岡田", "おかだ"],
  ["後藤", "ごとう"],
  ["長谷川", "はせがわ"],
  ["村上", "むらかみ"],
  ["近藤", "こんどう"],
  ["石井", "いしい"],
  ["坂本", "さかもと"],
  ["遠藤", "えんどう"],
  ["青木", "あおき"],
  ["藤井", "ふじい"],
  ["西村", "にしむら"],
  ["福田", "ふくだ"],
  ["太田", "おおた"],
  ["三浦", "みうら"],
  ["藤原", "ふじわら"],
  ["岡本", "おかもと"],
  ["松田", "まつだ"],
  ["中川", "なかがわ"],
  ["中野", "なかの"],
  ["原田", "はらだ"],
  ["小野", "おの"],
  ["田村", "たむら"],
  ["竹内", "たけうち"],
  ["金子", "かねこ"],
  ["和田", "わだ"],
  ["中山", "なかやま"],
  ["石田", "いしだ"],
  ["上田", "うえだ"],
  ["森田", "もりた"],
  ["原", "はら"],
  ["柴田", "しばた"],
  ["酒井", "さかい"],
  ["工藤", "くどう"],
  ["横山", "よこやま"],
  ["宮崎", "みやざき"],
  ["宮本", "みやもと"],
  ["内田", "うちだ"],
  ["高木", "たかぎ"],
  ["安藤", "あんどう"],
  ["谷口", "たにぐち"],
  ["大野", "おおの"],
  ["丸山", "まるやま"],
  ["今井", "いまい"],
  ["高田", "たかだ"],
  ["藤本", "ふじもと"],
  ["武田", "たけだ"],
  ["村田", "むらた"],
  ["上野", "うえの"],
  ["杉山", "すぎやま"],
  ["増田", "ますだ"],
  ["小島", "こじま"],
  ["平野", "ひらの"],
  ["大塚", "おおつか"],
  ["千葉", "ちば"],
  ["久保", "くぼ"],
  ["松井", "まつい"],
  ["岩崎", "いわさき"],
  ["桜井", "さくらい"],
  ["野口", "のぐち"],
  ["松尾", "まつお"],
  ["菊池", "きくち"],
  ["佐野", "さの"],
  ["大西", "おおにし"],
  ["杉本", "すぎもと"],
  ["新井", "あらい"],
  ["浜田", "はまだ"],
  ["市川", "いちかわ"],
  ["小松", "こまつ"],
]);

export function buildSortKeyKana(value: string) {
  const normalized = value.trim().normalize("NFKC").toLowerCase();
  const exactReading = COMMON_NAME_READINGS.get(normalized);

  if (exactReading) {
    return exactReading;
  }

  const prefixReading = findCommonNamePrefixReading(normalized);

  if (prefixReading) {
    return `${prefixReading.reading}${normalizeKanaCharacters(normalized.slice(prefixReading.name.length))}`;
  }

  return normalizeKanaCharacters(normalized);
}

function findCommonNamePrefixReading(value: string) {
  let matched: { name: string; reading: string } | null = null;

  for (const [name, reading] of COMMON_NAME_READINGS) {
    if (!value.startsWith(name)) {
      continue;
    }

    if (!matched || name.length > matched.name.length) {
      matched = { name, reading };
    }
  }

  return matched;
}

function normalizeKanaCharacters(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);

      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCharCode(code - 0x60);
      }

      return char;
    })
    .join("");
}
