import da from './locales/da.json'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fi from './locales/fi.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import nb from './locales/nb.json'
import nl from './locales/nl.json'
import pl from './locales/pl.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import sv from './locales/sv.json'
import zh from './locales/zh.json'

export const languages = [
  { code: 'en', label: 'English', messages: en },
  { code: 'de', label: 'Deutsch', messages: de },
  { code: 'fr', label: 'Français', messages: fr },
  { code: 'es', label: 'Español', messages: es },
  { code: 'it', label: 'Italiano', messages: it },
  { code: 'nl', label: 'Nederlands', messages: nl },
  { code: 'nb', label: 'Norsk', messages: nb },
  { code: 'sv', label: 'Svenska', messages: sv },
  { code: 'da', label: 'Dansk', messages: da },
  { code: 'fi', label: 'Suomi', messages: fi },
  { code: 'pl', label: 'Polski', messages: pl },
  { code: 'pt', label: 'Português', messages: pt },
  { code: 'zh', label: '简体中文', messages: zh },
  { code: 'ja', label: '日本語', messages: ja },
  { code: 'ko', label: '한국어', messages: ko },
  { code: 'ru', label: 'Русский', messages: ru },
]

export let currentLanguage = 'en'

for (const value of [localStorage.getItem('tc-language'), ...navigator.languages]) {
  if (!value) continue
  const base = value.toLowerCase().replace('_', '-').split('-')[0]
  const code = base === 'no' ? 'nb' : base
  if (languages.some((language) => language.code === code)) {
    currentLanguage = code
    break
  }
}
document.documentElement.lang = currentLanguage
const currentMessages = languages.find((language) => language.code === currentLanguage)?.messages ?? en

export function loc(
  key: string,
  values: Record<string, string | number> = {},
): string {
  let lookupKey = key
  if (typeof values.count === 'number') {
    const plural = new Intl.PluralRules(currentLanguage).select(values.count)
    const pluralKey = `${key}_${plural}`
    if (pluralKey in en) lookupKey = pluralKey
  }

  const translationKey = lookupKey as keyof typeof en
  const template = currentMessages[translationKey] ?? en[translationKey] ?? key
  return template.replace(/{{(\w+)}}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  )
}

export function setLanguage(language: string): void {
  if (language === currentLanguage || !languages.some((item) => item.code === language)) return
  localStorage.setItem('tc-language', language)
  location.reload()
}
