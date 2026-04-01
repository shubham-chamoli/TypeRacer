const EASY_WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
]

const NORMAL_WORDS = [
  "about", "above", "after", "again", "against", "along", "already", "also",
  "always", "among", "another", "answer", "around", "asked", "away", "back",
  "became", "because", "become", "been", "before", "began", "begin", "being",
  "below", "better", "between", "both", "build", "building", "built", "called",
  "came", "change", "children", "city", "close", "come", "could", "country",
  "course", "current", "develop", "different", "does", "during", "each", "early",
  "earth", "enough", "every", "example", "family", "father", "found", "general",
  "given", "great", "group", "growing", "hand", "having", "head", "help",
  "here", "high", "home", "house", "human", "important", "include", "interest",
  "keep", "kind", "large", "last", "later", "learn", "leave", "left",
  "level", "light", "line", "little", "live", "long", "looking", "made",
  "major", "making", "many", "might", "million", "mind", "money", "more",
  "morning", "mother", "move", "much", "must", "name", "national", "need",
  "never", "night", "nothing", "number", "often", "once", "open", "order",
  "other", "over", "own", "part", "people", "place", "point", "possible",
  "power", "problem", "program", "public", "question", "quite", "rather", "real",
  "right", "room", "running", "school", "second", "seem", "should", "show",
  "side", "since", "small", "social", "something", "special", "started", "state",
  "still", "story", "strong", "study", "system", "taken", "tell", "their",
  "them", "these", "thing", "think", "those", "thought", "through", "time",
  "together", "toward", "turn", "under", "united", "until", "upon", "using",
  "very", "water", "while", "whole", "without", "woman", "word", "work",
  "world", "would", "write", "young",
]

const HARD_WORDS = [
  "aberration", "abstraction", "accelerate", "accommodate", "accomplishment",
  "acknowledge", "acquisition", "administration", "advantageous", "algorithm",
  "ambiguous", "approximately", "architecture", "authenticate", "bibliography",
  "bureaucratic", "catastrophe", "circumstance", "collaboration", "comprehension",
  "concatenation", "configuration", "consciousness", "consolidation", "contemporary",
  "controversial", "correspondence", "cryptocurrency", "decentralized", "demonstrate",
  "deteriorate", "differentiate", "disambiguation", "electromagnetic", "encapsulation",
  "entrepreneurial", "environmental", "establishment", "extraordinary", "fundamentally",
  "heterogeneous", "hypothetical", "implementation", "incomprehensible", "independently",
  "infrastructure", "initialization", "instantaneous", "interdependent", "interpretation",
  "juxtaposition", "kindergarten", "knowledgeable", "legitimately", "manufacturing",
  "metaphorical", "microprocessor", "miscellaneous", "nevertheless", "nomenclature",
  "optimization", "paradoxically", "parliamentary", "perpendicular", "pharmaceutical",
  "philosophical", "photosynthesis", "predominantly", "prerequisites", "psychologically",
  "questionnaire", "quintessential", "reconnaissance", "rehabilitation", "representative",
  "revolutionary", "simultaneously", "sophisticated", "specifications", "standardization",
  "straightforward", "superintendent", "supplementary", "sustainability", "synchronization",
  "technological", "thermodynamics", "transformation", "transparency", "troubleshooting",
  "uncharacteristic", "understanding", "unfortunately", "unprecedented", "vulnerability",
]

export type Difficulty = "easy" | "normal" | "hard"

function getWordList(difficulty: Difficulty): string[] {
  switch (difficulty) {
    case "easy":
      return EASY_WORDS
    case "normal":
      return NORMAL_WORDS
    case "hard":
      return HARD_WORDS
  }
}

export function generateWords(count: number, difficulty: Difficulty): string[] {
  const wordList = getWordList(difficulty)
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    words.push(wordList[Math.floor(Math.random() * wordList.length)])
  }
  return words
}
