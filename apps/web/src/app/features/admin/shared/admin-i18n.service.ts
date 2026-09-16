import { Injectable, signal } from "@angular/core";
import {
  Locale,
  parseLocale,
  supportedLocales,
} from "../../../core/i18n/i18n.service";

const copy = {
  hy: {
    admin: "Կառավարում",
    dashboard: "Ամփոփում",
    products: "Ապրանքներ",
    categories: "Կատեգորիաներ",
    brands: "Ապրանքանիշեր",
    logout: "Դուրս գալ",
    logoutError:
      "Չհաջողվեց դուրս գալ։ Ձեր նիստը կարող է դեռ ակտիվ լինել։ Կրկին փորձեք։",
    login: "Մուտք",
    email: "Էլ. փոստ",
    password: "Գաղտնաբառ",
    loginError: "Չհաջողվեց մուտք գործել։ Ստուգեք տվյալները և կրկին փորձեք։",
    loading: "Բեռնում…",
    error: "Չհաջողվեց բեռնել տվյալները։",
    retry: "Կրկնել",
    language: "Լեզու",
    publicSite: "Դիտել կայքը",
    empty: "Կատալոգը դատարկ է։",
    discard: "Չպահված փոփոխությունները կկորչեն։ Շարունակե՞լ։",
  },
  ru: {
    admin: "Управление",
    dashboard: "Обзор",
    products: "Товары",
    categories: "Категории",
    brands: "Бренды",
    logout: "Выйти",
    logoutError:
      "Не удалось выйти. Сессия может быть активна. Попробуйте ещё раз.",
    login: "Войти",
    email: "Электронная почта",
    password: "Пароль",
    loginError: "Не удалось войти. Проверьте данные и попробуйте ещё раз.",
    loading: "Загрузка…",
    error: "Не удалось загрузить данные.",
    retry: "Повторить",
    language: "Язык",
    publicSite: "Открыть сайт",
    empty: "Каталог пуст.",
    discard: "Несохранённые изменения будут потеряны. Продолжить?",
  },
  en: {
    admin: "Administration",
    dashboard: "Dashboard",
    products: "Products",
    categories: "Categories",
    brands: "Brands",
    logout: "Log out",
    logoutError:
      "Could not log out. Your session may still be active. Try again.",
    login: "Log in",
    email: "Email",
    password: "Password",
    loginError: "Could not log in. Check your details and try again.",
    loading: "Loading…",
    error: "Could not load data.",
    retry: "Retry",
    language: "Language",
    publicSite: "View website",
    empty: "The catalog is empty.",
    discard: "Unsaved changes will be lost. Continue?",
  },
};
export type AdminCopyKey = keyof typeof copy.hy;

@Injectable({ providedIn: "root" })
export class AdminI18nService {
  readonly locale = signal<Locale>("hy");
  readonly locales = supportedLocales;
  setLocale(value: string): void {
    this.locale.set(parseLocale(value));
  }
  translate(key: AdminCopyKey): string {
    return copy[this.locale()][key];
  }
}
