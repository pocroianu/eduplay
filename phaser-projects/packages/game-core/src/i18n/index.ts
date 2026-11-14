export type Language = 'en' | 'ro';

export interface TranslationMeta {
	language: string;
	name: string;
	flag: string;
}

export interface Translations {
	meta: TranslationMeta;
	ui: Record<string, string>;
	feedback: {
		correct: string[];
		incorrect: string[];
	};
	results: Record<string, string>;
	questions: Record<string, string>;
	items: Record<string, string>;
}

// Inline translations to avoid webpack JSON import issues
const en: Translations = {
	meta: { language: "en", name: "English", flag: "🇬🇧" },
	ui: {
		pause: "Pause",
		resume: "Resume",
		repeat: "Repeat",
		player: "Player",
		progress: "{current} / {total}",
		loading: "Loading...",
		start: "Start",
		restart: "Play Again",
		home: "Home",
		settings: "Settings",
		language: "Language"
	},
	feedback: {
		correct: ["Great job!", "You got it!", "Amazing!", "Super!", "Wonderful!", "Excellent!", "Perfect!"],
		incorrect: ["Nice try!", "Almost! Keep going!", "You can do it!", "Good effort!", "Try again!"]
	},
	results: {
		title: "Great Work!",
		score: "Your Score",
		perfect: "Perfect Score!",
		excellent: "Excellent!",
		good: "Good Job!",
		tryAgain: "Keep Practicing!",
		stars: "{count} Stars",
		questionsCorrect: "{correct} of {total} correct"
	},
	questions: {
		whichOne: "Which one is {item}?",
		whatIs: "What is this?",
		select: "Select the correct answer"
	},
	items: {
		apple: "an apple",
		banana: "a banana",
		carrot: "a carrot",
		cat: "a cat",
		dog: "a dog",
		bird: "a bird",
		frog: "a frog",
		ax: "an ax",
		hat: "a hat",
		umbrella: "an umbrella"
	}
};

const ro: Translations = {
	meta: { language: "ro", name: "Română", flag: "🇷🇴" },
	ui: {
		pause: "Pauză",
		resume: "Continuă",
		repeat: "Repetă",
		player: "Jucător",
		progress: "{current} / {total}",
		loading: "Se încarcă...",
		start: "Start",
		restart: "Joacă din nou",
		home: "Acasă",
		settings: "Setări",
		language: "Limbă"
	},
	feedback: {
		correct: ["Bravo!", "Corect!", "Minunat!", "Super!", "Excelent!", "Foarte bine!", "Perfect!"],
		incorrect: ["Aproape!", "Mai încearcă!", "Poți să reușești!", "Bună încercare!", "Încearcă din nou!"]
	},
	results: {
		title: "Felicitări!",
		score: "Scorul tău",
		perfect: "Scor perfect!",
		excellent: "Excelent!",
		good: "Bine lucrat!",
		tryAgain: "Continuă să exersezi!",
		stars: "{count} Stele",
		questionsCorrect: "{correct} din {total} corecte"
	},
	questions: {
		whichOne: "Care este {item}?",
		whatIs: "Ce este asta?",
		select: "Selectează răspunsul corect"
	},
	items: {
		apple: "un măr",
		banana: "o banană",
		carrot: "un morcov",
		cat: "o pisică",
		dog: "un câine",
		bird: "o pasăre",
		frog: "o broască",
		ax: "un topor",
		hat: "o pălărie",
		umbrella: "o umbrelă"
	}
};

const translations: Record<Language, Translations> = { en, ro };

const STORAGE_KEY = 'edu-play-language';

class I18nManager {
	private static instance: I18nManager;
	private currentLanguage: Language = 'en';
	private listeners: Set<() => void> = new Set();

	private constructor() {
		this.loadSavedLanguage();
	}

	static getInstance(): I18nManager {
		if (!I18nManager.instance) {
			I18nManager.instance = new I18nManager();
		}
		return I18nManager.instance;
	}

	private loadSavedLanguage(): void {
		try {
			const saved = localStorage.getItem(STORAGE_KEY) as Language;
			if (saved && translations[saved]) {
				this.currentLanguage = saved;
			}
		} catch {
			// localStorage not available
		}
	}

	private saveLanguage(): void {
		try {
			localStorage.setItem(STORAGE_KEY, this.currentLanguage);
		} catch {
			// localStorage not available
		}
	}

	getLanguage(): Language {
		return this.currentLanguage;
	}

	setLanguage(lang: Language): void {
		if (translations[lang]) {
			this.currentLanguage = lang;
			this.saveLanguage();
			this.notifyListeners();
		}
	}

	getAvailableLanguages(): { code: Language; name: string; flag: string }[] {
		return Object.entries(translations).map(([code, trans]) => ({
			code: code as Language,
			name: trans.meta.name,
			flag: trans.meta.flag
		}));
	}

	t(key: string, params?: Record<string, string | number>): string {
		const keys = key.split('.');
		let value: any = translations[this.currentLanguage];

		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				// Fallback to English
				value = translations['en'];
				for (const fallbackKey of keys) {
					if (value && typeof value === 'object' && fallbackKey in value) {
						value = value[fallbackKey];
					} else {
						return key; // Return key if not found
					}
				}
				break;
			}
		}

		if (typeof value !== 'string') {
			return key;
		}

		// Replace parameters like {current}, {total}
		if (params) {
			return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
				return params[paramKey]?.toString() ?? `{${paramKey}}`;
			});
		}

		return value;
	}

	tRandom(key: string): string {
		const keys = key.split('.');
		let value: any = translations[this.currentLanguage];

		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				return key;
			}
		}

		if (Array.isArray(value)) {
			return value[Math.floor(Math.random() * value.length)];
		}

		return typeof value === 'string' ? value : key;
	}

	getMeta(): TranslationMeta {
		const trans = translations[this.currentLanguage];
		if (trans && trans.meta) {
			return trans.meta;
		}
		// Fallback
		return {
			language: this.currentLanguage,
			name: this.currentLanguage === 'en' ? 'English' : 'Română',
			flag: this.currentLanguage === 'en' ? '🇬🇧' : '🇷🇴'
		};
	}

	onLanguageChange(callback: () => void): () => void {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	private notifyListeners(): void {
		this.listeners.forEach(cb => cb());
	}
}

export const i18n = I18nManager.getInstance();
export default i18n;
